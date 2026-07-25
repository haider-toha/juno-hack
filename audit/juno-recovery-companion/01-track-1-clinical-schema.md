# Track 1 — Clinical bundle research & the extraction schema

Research pass only. No implementation code was written. This file is the seam
definition between Raf's mock discharge bundle and Juno's ingestion pipeline.

---

## Scope

What I investigated, in order:

1. **What a real UK/NHS discharge bundle actually contains** — the eDischarge
   summary and the national standard behind it, the TTO ("to take out")
   medication list and the dispensing label, wound-care advice sheets,
   physio/rehab sheets, follow-up appointment arrangements, and
   safety-netting / red-flag advice. Every claim below carries a URL I
   retrieved during this pass.
2. **Cross-check against meeting 2 of `plan/raw-transcript.md`** — what Raf
   (speaking as "Them") actually committed to producing, what he pushed back
   on, and the gap he flagged between what clinicians _say_ and what reaches
   the letter.
3. **A concrete draft JSON extraction schema** — commented JSON example, Zod-4
   sketch, field-by-field rationale, with the "verbatim + source-traced"
   regulatory shield made structurally enforceable rather than a convention.
4. **Robustness to real-letter variation** — trust-to-trust formatting drift,
   free-text vs tabular medications, missing sections, 1-document vs
   5-document bundles, and the throwaway synthetic samples worth having
   locally before Raf's bundle lands.
5. **Honest gaps** — what I could not retrieve or confirm.

Out of scope by instruction: the drug side-effect database (separate track —
this schema only has to name drugs cleanly enough to key a lookup off), and
anything on the `initial-idea.md` cut list.

**Storage context (updated mid-pass).** There is no Supabase and no relational
database, but there _is_ real persistence: **Upstash Redis** (via the Vercel
Marketplace) holds application state — patient, the extracted plan JSON, the
daily adherence log, the caregiver — and **Vercel Blob** holds the uploaded
discharge-bundle images and PDFs. Extraction runs through the Vercel AI SDK via
the AI Gateway. The schema below is storage-agnostic and unchanged by this: it
is the contract the medic's bundle is extracted _into_, and it is persisted as
a single JSON value in Redis rather than held in memory. Two consequences are
folded in — see [Persistence & serialisation](#persistence--serialisation).

**Retrieval note:** `nice.org.uk` returns HTTP 403 to programmatic fetches and
several NHS trust PDFs returned undecodable binary. Where I could only get the
content through the search index rather than a full page retrieval, I say so
inline. No citation below is fabricated; every URL was actually requested.

---

## Verdicts & Evidence

### V1 — The discharge summary is a nationally standardised, contractually mandated document with 22 named sections

This is the single most useful research finding, because it means the "shape"
of the primary document in the bundle is not trust-specific guesswork.

The PRSB **eDischarge Summary Standard** (v2.1) "comprises 22 sections, 6
mandatory (must be included), 10 required (should be included where the
information is available), 6 optional"
([theprsb.org/standards/edischargesummary](https://theprsb.org/standards/edischargesummary/)).
Ownership transferred to NHS England on 1 January 2026 under Open Government
Licence v3.0.

The **exact heading names**, from the NHS Digital ITK3 FHIR implementation
([nhsconnect.github.io/ITK-FHIR-eDischarge/explore_headings.html](https://nhsconnect.github.io/ITK-FHIR-eDischarge/explore_headings.html)):

| Conformance   | Headings                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mandatory** | Allergies and adverse reactions; Clinical summary; Diagnoses; GP practice; Patient demographics; Person completing record                                                                                                                           |
| **Required**  | Admission details; Discharge details; Distribution list; Individual requirements; Information and advice given; Legal information; Patient and carer concerns, expectations and wishes; Plan and requested actions; Referrer details; Safety alerts |
| **Optional**  | Assessment scales; Investigation results; Medications and Medical Devices; Procedures; Participation in research; Social context                                                                                                                    |

And it is not advisory. The corresponding NHS England standard —
**Transfer of Care: Acute Inpatient Discharge Standard**, reference
**DAPB4042 Amd 75/2021** — states that "Conformance with this standard is a
requirement of the NHS Standard Contract, Service Condition 11"
([standards.nhs.uk](https://standards.nhs.uk/published-standards/transfer-of-care-acute-inpatient-discharge-standard)).

**Two consequences for us.** First, we can name our extraction targets after
real national headings rather than inventing vocabulary — which is a genuine
credibility beat with a medic in the room and with judges. Second, and more
importantly: _"Medications and Medical Devices" is an **Optional** heading._
The section carrying the entire medication timeline is not guaranteed to be
present in a conformant discharge summary. That is a real robustness
requirement, not a hypothetical one — see [R3](#r3--missing-sections-are-the-normal-case-not-the-error-case).

### V2 — The standard's medication cluster already tells us exactly which medication fields to extract, and its primary field is a single free-text phrase

From
[explore_medication.html](https://nhsconnect.github.io/ITK-FHIR-eDischarge/explore_medication.html),
the Medication Item cluster carries: **medication name** ("May be generic name
or brand name (as appropriate)"), **form**, **quantity supplied**, **route**,
**site**, **method**, **dose directions description** — defined as "A single
plain text phrase describing the entire medication dosage" — **dose amount
description**, **dose timing description**, a **structured dose direction
cluster** as the computable alternative, and **additional instruction**
("Multiple dosage or administration instructions as plain text").

There is also a **Medication Change Summary** cluster: **status** ("Continued,
Added, or Amended"), **indication** (reason for change), **date of latest
change**, **description of amendment**, plus discontinued medications carried
with status "stopped".

The design lesson is the one the national standard already learned: **the
authoritative dose field is a single plain-text phrase, and the structured
breakdown is a secondary refinement.** Our schema copies that exactly. A
free-text letter yields a valid record with the phrase populated and the
structured fields null; a tabular letter yields the same record with more
fields filled. We never have to make tabular-vs-prose a branch in the parser.

**Also load-bearing: there is no side-effects field anywhere in the medication
cluster.** See [D3](#d3--the-letter-does-not-list-common-side-effects-the-demo-beat-in-initial-ideamd-needs-rerouting).

### V3 — What the patient physically walks out with: 7–14 days of medicine, a labelled box per medicine, and a letter written for the GP

NHS.uk: "You'll usually be given enough for the following 7 days" of
medication, and "a letter for your GP, providing information about your
treatment and future care needs"
([nhs.uk — Being discharged from hospital](https://www.nhs.uk/nhs-services/hospitals/going-into-hospital/being-discharged-from-hospital/)).

Rotherham NHS FT is more precise and gives us the **label** fields: "A supply
of medicines will be provided to last you until the course is finished, or for
2 weeks if this is a long-term medicine that you need to continue," and "Every
medicine has a label containing your name, the name and dose of the medicine
and how often to take this." It also names the escalation channel for medicine
questions: the label "contains a telephone number for this Hospital's Pharmacy
Department… our 'Medicines Information Line' on 01709 424126"
([therotherhamft.nhs.uk](https://www.therotherhamft.nhs.uk/patients-and-visitors/patient-information/medicines-after-discharge)).

Rotherham also gives the standing instruction that our app must never
contradict: "Only stop taking a medicine, if you are advised to do so by a
doctor or other health professional."

Trusts publish dedicated patient leaflets on the TTO specifically — East and
North Herts has one titled "Patient Information: Your To Take Out (TTO)
Medication"
([enherts-tr.nhs.uk PDF](https://www.enherts-tr.nhs.uk/wp-content/uploads/2019/10/TTO-Medications-v4-01.2020.pdf))
and UHB has "Information for patients being discharged home – Medicines"
([uhb.nhs.uk PDF](https://www.uhb.nhs.uk/media/zaskgrjp/pi_pharmacy-information-for-patients-being-discharged-home_medicines.pdf)).
Both returned undecodable binary to my fetches — I am citing their existence
and titles, not their contents (see [Could not confirm](#could-not-confirm)).

**Consequence for us:** the medicine _label_ is a distinct document type in the
bundle with a distinct (smaller) field set from the discharge summary, and a
patient photographing "everything they got" will very plausibly include a
photo of a box. Our `documents[].kind` union includes `medicine_label` for
that reason. It is also the most likely source of a **conflict** with the
letter, which is why conflicts are first-class in the schema.

### V4 — NICE requires the discharge plan to carry medicine purpose, timing and dose in language the patient understands

NICE NG27 recommendation **1.5.16**: the discharge plan should include a
complete, accurate list of medicines, including any changes made during the
hospital stay, with information about when to take the medicine, correct
dosage, and an explanation of what it is for; and all the information should
be in a format that is easy for the person to understand. This is restated in
NICE quality standard **QS136, Quality statement 4: Discharge plans**
([nice.org.uk/guidance/qs136](https://www.nice.org.uk/guidance/qs136/chapter/quality-statement-4-discharge-plans);
guideline at [nice.org.uk/guidance/ng27](https://www.nice.org.uk/guidance/ng27)).

_Retrieval caveat: nice.org.uk returned 403 to direct fetch. The above is from
the search index of those NICE pages plus the NHS medicines-resources mirror,
which states NG27 recommends "giving people information about their diagnoses
and treatment and a complete list of their medicines when they transfer
between hospital and home (including their care home)"
([medicinesresources.nhs.uk](https://www.medicinesresources.nhs.uk/en/Medicines-Awareness/Guidance-and-Advice/Guidance/Transition-between-inpatient-hospital-settings-and-community-or-care-home-settings-for-adults-with-social-care-needs--guidance-NG27/)).
I did not retrieve the full recommendation text verbatim._

**Consequence for us:** "explanation of what it is for" is a NICE-required
field, which is why `indicationVerbatim` is in our medication record — and why
its _absence_ is a finding worth surfacing rather than papering over. Juno
telling a patient "your letter doesn't say what this one is for" is
demonstrating the standard, not failing it.

### V5 — Patient-facing advice sheets anchor almost everything **relative** to the operation, and this is the most important schema decision

Hull University Teaching Hospitals, _Discharge Advice following Hip and Knee
Replacement_
([hey.nhs.uk](https://www.hey.nhs.uk/patient-leaflet/discharge-advice-following-hip-and-knee-replacement/)) —
every temporal instruction on the sheet, verbatim:

- "The Aquacel dressing can stay on the wound for **14 days after your operation**."
- "The District Nurse or Practice Nurse will take off your dressing and remove any clips **two weeks after the operation**."
- "You should wear your stockings for **6 weeks**."
- "We normally suggest returning to work no earlier than **6 weeks following your surgery** if you have a non-manual job."
- driving: "For most patients this would be **around 6 weeks after surgery**."
- "A follow-up appointment is booked for **approximately 6 weeks after the operation**."

Buckinghamshire Healthcare, _Going home after orthopaedic surgery_
([buckshealthcare.nhs.uk](https://www.buckshealthcare.nhs.uk/pifs/going-home-after-orthopaedic-surgery-helpful-hints/)):
"Physiotherapy will contact you **within 2 to 3 weeks after your surgery** if
you need a follow up."

Leeds Teaching Hospitals, _Post-operative wound care_
([leedsth.nhs.uk](https://www.leedsth.nhs.uk/patients/resources/post-operative-wound-care-2/)):
"Please leave any dressing on your wound(s) for **the number of days we tell
you**" — i.e. the sheet is a template and the number is written in by hand or
spoken. That is a real, common failure mode for extraction.

Three distinct anchoring patterns fall out, and all three are real:

1. **Offset from an episode event** — "14 days after your operation". Dominant.
2. **Approximate / ranged offset** — "around 6 weeks", "2 to 3 weeks",
   "approximately 6 weeks".
3. **Conditional, with no date at all** — Hull on the anticoagulant: blood
   thinning medication "**until your mobility returns to normal**"; Bucks on
   driving: "**Do not drive until your consultant tells you**"; Hull on
   driving: "only return to driving **when you can be in complete control of
   your car and can comfortably manage an emergency stop**".

**Verdict: store offsets as authored, resolve to absolute dates in code at
render time.** Two reasons, both concrete:

- The absolute anchors are the two fields the national standard makes most
  reliable — **Date/Time of discharge is the only Mandatory (1..1) item in the
  Discharge details section** ([explore_discharge_details.html](https://nhsconnect.github.io/ITK-FHIR-eDischarge/explore_discharge_details.html)),
  and the Procedures section carries the procedure date. If the extractor
  misreads _one_ anchor date, one correction repairs the entire timeline.
  Under absolute-date extraction, a bad anchor means twenty independently
  wrong dates and no way to spot the systematic error.
- Converting "approximately 6 weeks" into "Tuesday 8 September" **invents
  precision the clinician did not write**. That is the guiding principle
  violated at the data layer. So the anchor keeps `approximate: true` and the
  verbatim phrase, and the voice agent reads "about six weeks after your
  operation", not a date.

And pattern 3 is why `conditional` must be a first-class anchor variant. If the
schema can only express numbers, the model will produce a number for "until
your mobility returns to normal" — silently fabricating a stop date for an
anticoagulant. The union makes that unrepresentable.

### V6 — Red-flag lines in real sheets are always a **pair**: a symptom phrase and a named recipient, and the recipient varies by time of day

Hull's red flags, verbatim — contact your GP if you develop: "Increase in pain
in the calf of your operated leg"; "Increased redness or swelling around the
wound area"; "Increase in wound leakage/discharge"; "Bleeding from the wound".
For immediate concerns the sheet names a different route: "contact Ward 9 on
01482 623009", and separately "01482 675181 Orthopaedic outpatients"
([hey.nhs.uk](https://www.hey.nhs.uk/patient-leaflet/discharge-advice-following-hip-and-knee-replacement/)).

Bucks: contact the ward for "any unusual swelling, oozing from the wound,
increased pain, excessive bruising"
([buckshealthcare.nhs.uk](https://www.buckshealthcare.nhs.uk/pifs/going-home-after-orthopaedic-surgery-helpful-hints/)).

Leeds gives infection signs as "very painful, very hot, red and swollen with a
yellow coloured discharge", and then gives **three different phone numbers
selected by time of day**: 0113 392 4292 (Mon–Thu 8am–5pm, Fri 8am–1pm),
0113 392 4202 (Mon–Thu after 5pm, Fri after 1pm), 0113 392 4602 (Fri 1pm –
Mon 8am)
([leedsth.nhs.uk](https://www.leedsth.nhs.uk/patients/resources/post-operative-wound-care-2/)).

Hull's medicines-on-discharge leaflet carries a sepsis safety-net with an
explicit escalation ladder: "Early treatment saves lives. **Call your GP or 111
immediately if you're concerned. Call 999 if you are very concerned, or if
there's a delay in talking to your doctor.**"
([hey.nhs.uk](https://www.hey.nhs.uk/patient-leaflet/general-information-leaflet-prescribed-medication-discharge/)).

**Consequences for the schema, all three earned by the above:**

- A red flag is `{ triggerVerbatim, actionVerbatim }`, not a single string. The
  voice agent reads back _both_ halves. Splitting them is what makes
  "read the doctor's instruction" mechanically possible.
- Contacts are a **separate top-level array referenced by id**, because one
  contact serves many red flags and one red flag can name several contacts
  (Leeds: three numbers, one symptom list). Inlining the phone number on each
  red flag would triplicate Leeds' data and lose the hours.
- Contacts carry `hoursVerbatim`. A companion that reads out a weekday number
  at 9pm on a Saturday is actively harmful, and this is not an edge case — it
  is on the face of a mainstream trust leaflet.

### V7 — "Escalation urgency" can be derived safely, but only from the recipient the letter names — never from the symptom

This is the sharpest safety design question in the schema, so stating the
reasoning explicitly.

Deciding _"calf pain is urgent"_ is clinical judgement, and
`initial-idea.md` cuts it. But observing _"this line of the letter names 999"_
versus _"this line names the practice nurse"_ is a lexical property of the
clinician's own text. Classifying the **named recipient** into a closed set
(`999 | 111 | gp | ward | specialist_team | pharmacy | district_nurse |
practice_nurse | other`) reformats the doctor's words; it does not interpret
the patient's symptoms. The Hull sepsis ladder above is the clinician
themselves ordering the channels.

So `RedFlag.escalationChannel` is derived **only** from `actionVerbatim`, and
the schema comment says so. If the letter names no recipient, the value is
`other` and the app falls back to the universal "call your care team / call
111" tap that `initial-idea.md` already mandates.

### V8 — Safety netting is a named clinical technique with a defined shape, and our red-flag record is a faithful encoding of it

From the peer-reviewed literature on safety netting in primary care
([PMC10811715](https://pmc.ncbi.nlm.nih.gov/articles/PMC10811715/)): safety
netting is "a technique in consultation to communicate uncertainty, provide
patient with information on red-flag symptoms, and plan for future
appointments to ensure timely re-assessment." Its components, quoted:

- **Red flags** — "If there is a recognised risk of deterioration or
  complications developing then the safety-net advice should include the
  specific clinical features (including red flags) that the patient (or
  parent/carer) should look out for."
- **Expected timeline** — information on "the likely time course" of symptoms.
- **Access to care** — "Specific information about when and how to re-consult
  if symptoms do not resolve in the expected time course."
- **Documentation** — "Document specific advice given, rather than simply
  writing 'advice given.'"

Roger Neighbour's original three questions are quoted in the same paper: "If
I'm right, what do I expect to happen? How will I know if I am wrong? And what
would I do then?"

Our `RedFlag` record maps one-to-one onto components 1 and 3
(`triggerVerbatim`, `actionVerbatim` + `contactIds`). Component 2 — the
expected time course — is the timeline. **This is worth saying out loud in the
pitch: Juno is an automated safety net, and it uses the profession's own
vocabulary for the thing it does.**

The documentation point cuts both ways for us. It is also the reason the
extractor will regularly find the literal string "safety netting advice given"
in a discharge summary's _Information and advice given_ section with no
content behind it — and the PRSB standard confirms that section is **free text
only**: "The ITK3 FHIR eDischarge specification does not currently support
coded representations of information and advice given"
([explore_information_given.html](https://nhsconnect.github.io/ITK-FHIR-eDischarge/explore_information_given.html)).
Same for the plan: "The ITK3 FHIR eDischarge does not currently support coded
Plan and requested actions information"
([explore_plan_req_actions.html](https://nhsconnect.github.io/ITK-FHIR-eDischarge/explore_plan_req_actions.html)).

**So the two sections Juno depends on most — advice given, and the plan — are
precisely the two the national standard leaves as unstructured prose.** That is
not a problem; it is the product's reason to exist. It is also why our
extraction cannot lean on document structure and must be prose-first.

### V9 — The standard already distinguishes actions for professionals from actions for the patient, and we must too

"Plan and requested actions" separates **"Actions for healthcare
professionals"** from **"Actions for patient or their carer"**, both cardinality
0..many, both Required
([explore_plan_req_actions.html](https://nhsconnect.github.io/ITK-FHIR-eDischarge/explore_plan_req_actions.html)).

This is directly load-bearing for the voice agent. Hull's clip removal is
performed by "The District Nurse or Practice Nurse". A check-in call that asks
"did you remove your clips today?" is wrong, and unnerving. Every timeline
instruction therefore carries `actor: "patient" | "carer" | "clinician"`, and
the voice script branches on it: patient-actor items get "did you…", clinician-actor
items get "someone should be coming to…, has that happened?".

### V10 — "Safety alerts" in the standard is **not** what we mean by a red flag

Worth pinning down so nobody wires the wrong section. The eDischarge
**Safety alerts** heading covers "risks the patient poses to themselves or
others" — three text fields: risks to self ("e.g., suicide, overdose,
self-harm, self-neglect"), risks to others, and risk from others
([explore_safety_alerts.html](https://nhsconnect.github.io/ITK-FHIR-eDischarge/explore_safety_alerts.html)).

Our red flags live in _Information and advice given_ and in the separate
patient advice sheets — not here. And Juno should **never surface the Safety
alerts section to the patient or to a next-of-kin.** It is safeguarding
content. It goes on the `patient.redactedByPolicy` list.

### V11 — Anticoagulants are the correct "high-stakes" class, and they come with their own document

NICE NG89 recommends extended-duration VTE prophylaxis after joint
replacement: for hip, LMWH for 10 days then aspirin 75/150 mg for a further
28 days, or LMWH for 28 days, or rivaroxaban; for knee, aspirin for 14 days,
or LMWH for 14 days, or rivaroxaban
([nice.org.uk/guidance/ng89](https://www.nice.org.uk/guidance/ng89/chapter/recommendations) —
_search-index retrieval, nice.org.uk 403s on direct fetch_). The RECORD trials
underpinning the 35-day rivaroxaban course are summarised at
[ecrjournal.com](https://www.ecrjournal.com/articles/role-direct-oral-anticoagulants-post-operative-venous-thromboembolism-prophylaxis?language_content_entity=en).

Hull's leaflet states it in patient words: "You will be discharged home with
blood thinning medication to reduce your risk of developing any blood clots
until your mobility returns to normal."

Patients on a DOAC are additionally issued a **patient alert card** to "carry
with you at all times" — NHS Greater Glasgow & Clyde distributes the DOAC
Patient Information Booklet and Alert Card
([ggcmedicines.org.uk](https://ggcmedicines.org.uk/information-for-patients/direct-oral-anticoagulants/)),
and manufacturer alert cards are published on the eMC
([medicines.org.uk apixaban alert card](https://www.medicines.org.uk/emc/rmm/2443/Document)).
Bleeding warning signs commonly listed on these — bruising or bleeding under
the skin, tar-coloured stools, blood in urine, nose-bleed, dizziness,
tiredness, paleness or weakness, sudden severe headache, coughing up or
vomiting blood — came from the search index of those pages; **the GGC page
itself only links the PDFs and I did not decode them**, so treat the specific
list as indicative and have Raf author the actual wording.

**Schema consequence:** `alert_card` is a `documents[].kind`. It is a small,
high-signal, red-flag-dense document, and it is a plausible thing for a
patient to photograph. It is also the cleanest evidence that "high-stakes"
is a real category recognised by the system, not something Juno invented.

**But how the flag gets set matters.** A discharge letter will not say "this
drug is high-stakes". So `escalationClass` must not be an LLM judgement. It is
set by one of exactly two auditable routes, recorded in
`escalationClassSource`:

- `letter_flagged` — the bundle itself singles the drug out (an alert card
  exists for it; the letter's own wording marks it).
- `configured_class_list` — a short, hand-written, checked-in list of drug
  classes that the team (with Raf's sign-off) has decided drive next-of-kin
  escalation.

That is honest: it is a **product** rule about which missed doses wake up a
family member, not a clinical claim about the drug. Recording which route set
it makes it defensible to a judge who asks.

### V12 — The verbal/written gap Raf raised is real and evidenced

Raf, meeting 2, verbatim:

> "I think from my perspective, because I probably know the best of what a
> discharge letter contains. I'm gonna think of what it does contain and what
> it doesn't. And then because **I know for certain discharge letters, not
> necessarily with surgeries, but I know a certain gps, they say stuff and
> they expect you to remember it, like certain things. It's not on the letter.**
> If that makes sense."

The literature backs him. A UK realist evaluation of discharge communication
across 36 cases found that patients wanted letters to contain "more
information regarding how they can improve their condition and recommended
patient actions", in cases where clinicians rated the letters as successful;
and — strikingly — "26 patients had received the discharge letter and 10 had
not", with "negative outcomes more commonly manifested when patients had not
received letters, rather than when they had"
([PMC8296817](https://pmc.ncbi.nlm.nih.gov/articles/PMC8296817/)).

Recall research points the same way: pooled recall was 47% for verbal-only
information vs 58% with written information vs 67% with video
([Frontiers in Communication, 2021](https://www.frontiersin.org/journals/communication/articles/10.3389/fcomm.2021.736095/full);
systematic review at
[ScienceDirect / Annals of Emergency Medicine](https://www.sciencedirect.com/science/article/abs/pii/S0196064419304986)).
Among older patients, roughly two-thirds reported receiving care instructions
"verbally" only
([Flacker, _J Hosp Med_ 2007](https://shmpublications.onlinelibrary.wiley.com/doi/10.1002/jhm.166)).
_These figures are from search-index summaries of those papers; I did not
retrieve the full texts._

**This is a product decision, not just a caveat.** Two schema affordances fall
out, and both are cheap:

1. `extraction.unresolved[]` accepts `reason: "absent_from_bundle"`. When the
   bundle has an antibiotic course with no stated stop date, or a wound with
   no stated review, Juno says so — "your letter doesn't say when to stop
   this; worth asking your pharmacist" — instead of inventing it. **Naming the
   gap is a feature.** It is also, precisely, the guiding principle: we route
   to a human rather than generate judgement.
2. Every clinician-authored item carries `enteredBy: "extracted" | "patient_added"`.
   That single field is the entire honest answer to "the GP told me something
   that isn't on the letter": the patient (or next of kin) can add it, it
   appears on the timeline, and it is **visually and structurally
   distinguishable** from what the clinician wrote. It never gains verbatim
   status and it never drives red-flag matching.

_Scope note:_ affordance 2 is one enum field in the schema and costs nothing
to define now. Whether the UI ships an "add a note" flow in 24h is Track 4/5's
call. Defining the field now means it doesn't require a schema migration later.

### V13 — What Raf actually committed to, and what he refused

Reading meeting 2 as the superseding source:

**He is generating the entire bundle.** Haider: "if you can basically go and be
like to claude or whoever and make it look actually legitimate so maybe even
get the nhs logo… if you can generate like a very realistic bundle it could be
one discharge letter it could be bundle of documentation or docs." Raf: "Yeah.
And I can get pretty realistic one." And: "I can give you, like, a sample of,
like, what they would get, like, literally as a patient where you'd get."

**Everything he generates is the demo.** Raf: "Do we make a few more just for
the demo?" Haider: "No no whatever you're going to generate is going to be for
the demo." Raf: "Okay, whatever I generate is for the demo. Everything I
generate. Okay. Yeah, I'll make it clean."

**He has NOT picked the scenario, and he pushed back on hip replacement.**
Haider: "pick one application or one example it could be surgery it could be
whatever recovery… where there's like enough content there's nuance…we don't
want something too linear." Raf: "I'll, like, try and think of, like, a few
cases that I have quite complex. **But then I feel like it's good to have one
case that is linear because, bro, that's like 99 of cases.** …**there's not
like when you hear hooves, like, on the street, you think there's a horse, not
zebras.** …So it's good to just show that this will work for, like, **old
people that have, like, a chronic condition.**"

**He will also emit a JSON.** Haider: "I might ask also ask you to ask your
claw to give me a Jason data structure but I'll confirm that with you… it'll
just be easy for me to read." Raf: "Yeah. Yeah. Okay. Yeah, that's fine."

**He named the BNF as the drug reference** (owned by another track): "Do you
know what the bnf is? …it will have, like, a list of pretty much every
medication, the indications. Common side effects, rare side effects."
([bnf.nice.org.uk](https://bnf.nice.org.uk/) — _403 on fetch; described at
[UKCPA's guide to the BNF](https://ukclinicalpharmacy.org/profession/resources/guide-to-the-bnf-how-to-use-the-british-national-formulary/)
and [Wikipedia](https://en.wikipedia.org/wiki/British_National_Formulary),
which state monographs carry "indications, contraindications, side effects,
doses, legal classification"._)

**He set the escalation-tone constraint himself**, and it matches
`initial-idea.md` exactly: "every medication has, like, red flag side effects…
If you get, like, a certain symptom with this, like, we'd advise you to
contact, and I should probably say, like, **it should probably just advise them
to do it. Like, don't make it call anything or any. Yeah. Like, just say,
like, are we strongly advising to see follow-up.**"

That last quote is the strongest single justification for the
`{triggerVerbatim, actionVerbatim}` pair and for `escalationChannel` being
advisory routing rather than automated action. **The medic independently
arrived at our regulatory shield.** Say that in the pitch.

### V14 — Raf's JSON is a fixture, not an input path

A verdict the transcript implies but nobody stated.

If Juno ingests Raf's LLM-emitted JSON, the demo shows nothing: extraction —
which `initial-idea.md` calls "the biggest technical risk" and Tier 1 item 1 —
is bypassed, and a judge who notices will discount the whole build.

**Recommendation:** the PDFs/photos are the input; Raf's JSON is checked in as
an **expected-output fixture** and diffed against our extraction output. That
converts a shortcut into a genuinely useful asset: a clinician-authored ground
truth to measure extraction accuracy against, on stage if we want to.

Two caveats to hand back to whoever briefs Raf. First, his JSON **will not
match this schema** — his LLM will invent its own shape — so the diff is
field-mapped by hand, not structural; keep it to the fields that matter
(medication names, doses, durations, red-flag lines, dates). Second, and more
important for briefing him: **ask him to author the letters first and derive
the JSON from them, not the other way round.** If the JSON comes first the
letters become renderings of clean structured data, and we lose exactly the
messiness — the free-text dosing, the hand-written-in day number, the
template gap — that makes the extraction demo credible.

---

## Draft extraction schema

### Design invariants

These are the properties that make the regulatory shield structural rather
than a matter of discipline. A later reviewer should be able to check each one
mechanically.

| #       | Invariant                                                                                                         | Enforced by                                                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I1**  | Anything read aloud to a patient as clinical content is a `*Verbatim` field.                                      | Naming convention: no other string field is ever passed to the voice agent as clinical content.                                                                              |
| **I2**  | Every `*Verbatim` field is accompanied by a `SourceRef` whose `quote` contains it.                                | `SourceRef` is non-nullable on every record carrying a verbatim field.                                                                                                       |
| **I3**  | The LLM never emits a day-by-day timeline. It emits dated facts; code computes the schedule.                      | There is no `days[]` / `timeline[]` array in the extraction output.                                                                                                          |
| **I4**  | Absence is representable. A field the model could not read is `null` **plus** an `extraction.unresolved[]` entry. | Every clinical field is nullable; `unresolved[]` is required (may be empty).                                                                                                 |
| **I5**  | Disagreement between documents is surfaced, never silently resolved.                                              | `extraction.conflicts[]`.                                                                                                                                                    |
| **I6**  | Generated text is quarantined and never substitutes for clinician text.                                           | Exactly three generated fields exist: `titlePlain`, `purposePlain`, `matchHints`. Each is documented below with why it is safe.                                              |
| **I7**  | Escalation urgency derives from the recipient the letter names, never from the symptom.                           | `escalationChannel` is documented as a function of `actionVerbatim` only.                                                                                                    |
| **I8**  | Patient identifiers are dropped at extraction, not at render.                                                     | `patient` has two fields; everything else goes on `redactedByPolicy` as a _name_, never a value.                                                                             |
| **I9**  | The whole document is JSON round-trippable. `JSON.parse(JSON.stringify(x))` is lossless.                          | No `Date`, `Map`, `Set`, `undefined`, `BigInt` or class instance anywhere. Dates are ISO-8601 strings; "absent" is `null`, never `undefined`.                                |
| **I10** | Every verbatim line resolves to a durable, fetchable source document.                                             | `SourceRef.documentId` → `documents[].blobUrl`, a permanent Vercel Blob URL. The quote is verifiable against the original image forever, not just during the upload request. |

### The commented JSON example

A three-document surgical bundle. Values are illustrative but every verbatim
string below is lifted from a real NHS leaflet cited in Verdicts & Evidence,
so the shape is known to survive real text.

This is **JSONC** — it carries `//` comments and (after Prettier) trailing
commas, so it is documentation, not a parseable payload. The Zod sketch below
is the machine-readable source of truth; if the two ever disagree, the Zod
wins.

```jsonc
{
  "schemaVersion": "juno-extract/1",

  // ── 1. What we ran extraction over ───────────────────────────────────────
  // Always an array. A one-document bundle is this array with one entry —
  // there is no separate single-document code path.
  "documents": [
    {
      // Stable internal id. Every sourceRef in this document points here, and
      // this record is the ONE place the durable storage URL lives — a bundle
      // has dozens of sourceRefs and duplicating a blob URL on each is waste.
      "id": "doc_1",
      // Closed set, grounded in V1/V3/V5/V6/V11. `unknown` exists because Raf
      // has not picked the scenario and may include something unanticipated;
      // an unknown document is still fully usable — its text still yields
      // instructions and red flags, we just cannot label it in the UI.
      "kind": "discharge_summary",
      "displayName": "Discharge summary — Ward 9, Orthopaedics",
      "capture": "photo", // "photo" | "pdf" | "scan"
      "pageCount": 2,
      // I10 — the durable pointer. Vercel Blob returns a permanent URL on
      // upload; storing it here is what makes "tap to see where it says that"
      // work weeks later, not just during the upload request. This is the
      // physical end of the audit trail behind the regulatory shield.
      "blobUrl": "https://xxxxxxxx.public.blob.vercel-storage.com/bundles/pt_margaret/doc_1-discharge-summary-a7f3.jpg",
      // Blob's own path key. Kept because deletion and re-upload address by
      // pathname, not by URL.
      "blobPathname": "bundles/pt_margaret/doc_1-discharge-summary-a7f3.jpg",
    },
    {
      "id": "doc_2",
      "kind": "wound_care_advice",
      "displayName": "Discharge Advice following Hip and Knee Replacement",
      "capture": "pdf",
      "pageCount": 4,
      "blobUrl": "https://xxxxxxxx.public.blob.vercel-storage.com/bundles/pt_margaret/doc_2-wound-care-1b90.pdf",
      "blobPathname": "bundles/pt_margaret/doc_2-wound-care-1b90.pdf",
    },
    {
      "id": "doc_3",
      "kind": "appointment_letter",
      "displayName": "Orthopaedic outpatients follow-up",
      "capture": "photo",
      "pageCount": 1,
      "blobUrl": "https://xxxxxxxx.public.blob.vercel-storage.com/bundles/pt_margaret/doc_3-appointment-4c21.jpg",
      "blobPathname": "bundles/pt_margaret/doc_3-appointment-4c21.jpg",
    },
  ],

  // ── 2. Patient — deliberately minimal (I8) ───────────────────────────────
  "patient": {
    // The only identity field we keep. The voice agent needs to say a name.
    "givenName": "Margaret",
    // BCP-47. Null unless the bundle states it (the eDischarge "Individual
    // requirements" heading is where communication needs live). The app's
    // language is a user setting; this is only a hint for the default.
    "preferredLanguage": null,
    // Field NAMES we saw and dropped. Never values. Demo-able privacy beat,
    // and it instructs the extractor to notice-and-discard rather than
    // notice-and-include-in-some-free-text-blob.
    // Note "safetyAlerts": per V10 that section is safeguarding content and
    // must never reach the patient or next-of-kin view.
    "redactedByPolicy": [
      "nhsNumber",
      "dateOfBirth",
      "address",
      "hospitalNumber",
      "gpPracticeAddress",
      "safetyAlerts",
    ],
  },

  // ── 3. The episode, and the two absolute anchors everything hangs off ────
  "episode": {
    // Not surgery-specific. Raf has not picked the case and pushed back on
    // hip replacement (V13). A medical admission has no procedure and no
    // wound; it is the same record with procedureDate null.
    "kind": "surgical", // "surgical" | "medical" | "other"
    "titleVerbatim": "Right total hip replacement",
    "titlePlain": "Hip replacement on your right side", // generated (I6)
    // The two anchors. Discharge date is the Mandatory 1..1 field in the
    // national standard (V5) and is our primary anchor. procedureDate is the
    // secondary anchor and is null for medical episodes.
    "dischargeDate": "2026-07-20",
    "procedureDate": "2026-07-17",
    "dischargingTeamVerbatim": "Ward 9, Trauma & Orthopaedics",
    "source": {
      "documentId": "doc_1",
      "page": 1,
      "quote": "Date of discharge: 20/07/2026   Procedure: Right total hip replacement 17/07/2026",
      "readConfidence": "clear",
    },
  },

  // ── 4. Contacts — separate and referenced by id (V6) ─────────────────────
  // One contact serves many red flags; one red flag names several contacts;
  // Leeds names three numbers for one symptom list, split by time of day.
  "contacts": [
    {
      "id": "c_ward9",
      "labelVerbatim": "Ward 9",
      "phone": "01482 623009",
      "channel": "ward",
      "hoursVerbatim": null,
      "source": {
        "documentId": "doc_2",
        "page": 3,
        "quote": "contact Ward 9 on 01482 623009",
        "readConfidence": "clear",
      },
    },
    {
      "id": "c_gp",
      "labelVerbatim": "your GP",
      "phone": null,
      "channel": "gp",
      "hoursVerbatim": null,
      "source": {
        "documentId": "doc_2",
        "page": 2,
        "quote": "Contact your GP if you develop:",
        "readConfidence": "clear",
      },
    },
    {
      "id": "c_111",
      "labelVerbatim": "NHS 111",
      "phone": "111",
      "channel": "111",
      "hoursVerbatim": "24 hours",
      "source": {
        "documentId": "doc_1",
        "page": 2,
        "quote": "Call your GP or 111 immediately if you're concerned.",
        "readConfidence": "clear",
      },
    },
  ],

  // ── 5. Medications ───────────────────────────────────────────────────────
  "medications": [
    {
      "id": "m_rivaroxaban",
      "nameAsWritten": "Rivaroxaban 10mg tablets",

      // The handle the on-demand drug-lookup track keys off. Deliberately
      // thin — we are NOT building a drug database. Just enough to resolve
      // a BNF monograph. `normalisedName` is the extractor's best generic
      // name; `nameConfidence` lets the lookup track refuse to guess.
      "lookupKey": {
        "normalisedName": "rivaroxaban",
        "form": "tablet",
        "strength": "10 mg",
        "nameConfidence": "clear", // "clear" | "unclear"
      },

      // REQUIRED and never null. This is the national standard's primary
      // medication field: "A single plain text phrase describing the entire
      // medication dosage" (V2). A free-text letter fills only this. This is
      // what the voice agent reads aloud.
      "doseDirectionsVerbatim": "Take ONE tablet once daily",

      // Structured refinements. All nullable. A tabular letter fills them;
      // prose does not. Nothing downstream may REQUIRE these.
      "dose": "10 mg",
      "route": "oral",
      "schedule": {
        "timesPerDay": 1,
        // Empty array is meaningful: the letter did not say when. The app
        // places it at a default and TELLS the patient it chose.
        "timesOfDay": ["morning"],
        "verbatim": "once daily",
      },
      // Four-valued, not boolean. "not_stated" is the common case and must
      // not collapse into "either".
      "withFood": "not_stated", // "with"|"without"|"either"|"not_stated"

      // Course boundaries as anchors, not dates (V5).
      "duration": {
        "start": {
          "kind": "offset",
          "from": "discharge",
          "days": 0,
          "daysUntil": null,
          "approximate": false,
          "verbatim": "starting today",
        },
        "end": {
          "kind": "offset",
          "from": "procedure",
          "days": 35,
          "daysUntil": null,
          "approximate": false,
          "verbatim": "for 35 days following your operation",
        },
      },

      // From the standard's Medication Change Summary cluster (V2).
      "changeStatus": "added", // "continued"|"added"|"amended"|"stopped"|"not_stated"
      "changeNoteVerbatim": null,

      // NICE NG27 1.5.16 requires "an explanation of what it is for" (V4).
      "indicationVerbatim": "to reduce your risk of developing any blood clots",
      // GENERATED (I6) — a plain-language rendering of indicationVerbatim.
      // HARD RULE: null whenever indicationVerbatim is null. We never invent
      // a purpose; the UI says "your letter doesn't say what this is for".
      "purposePlain": "Stops blood clots forming while you're moving around less.",

      // Drives next-of-kin escalation. NOT an LLM judgement (V11).
      "escalationClass": "high_stakes", // "standard" | "high_stakes"
      "escalationClassSource": "configured_class_list",
      // "letter_flagged" | "configured_class_list"

      "enteredBy": "extracted", // "extracted" | "patient_added"  (V12)
      "source": {
        "documentId": "doc_1",
        "page": 1,
        "quote": "Rivaroxaban 10mg tablets — take ONE tablet once daily for 35 days following your operation, to reduce your risk of developing any blood clots.",
        "readConfidence": "clear",
      },
    },

    {
      // The realistic messy one: a conditional stop with no date at all.
      "id": "m_teds",
      "nameAsWritten": "Anti-embolism stockings (TEDs)",
      "lookupKey": null, // not a drug; lookup track skips it
      "doseDirectionsVerbatim": "Wear your stockings 24 hours a day",
      "dose": null,
      "route": null,
      "schedule": {
        "timesPerDay": null,
        "timesOfDay": [],
        "verbatim": "24 hours a day",
      },
      "withFood": "not_stated",
      "duration": {
        "start": {
          "kind": "offset",
          "from": "discharge",
          "days": 0,
          "daysUntil": null,
          "approximate": false,
          "verbatim": "from discharge",
        },
        // Both a stated duration AND a condition appear in real leaflets.
        // Here the leaflet gave 6 weeks, so we use offset. Where it gives ONLY
        // a condition (Hull's anticoagulant: "until your mobility returns to
        // normal"), `end` is { "kind": "conditional", ... } and the item is
        // rendered as a standing instruction with NO computed end day.
        "end": {
          "kind": "offset",
          "from": "procedure",
          "days": 42,
          "daysUntil": null,
          "approximate": false,
          "verbatim": "for 6 weeks",
        },
      },
      "changeStatus": "added",
      "changeNoteVerbatim": null,
      "indicationVerbatim": null,
      "purposePlain": null, // null because indication is null
      "escalationClass": "standard",
      "escalationClassSource": "configured_class_list",
      "enteredBy": "extracted",
      "source": {
        "documentId": "doc_2",
        "page": 2,
        "quote": "You should wear your stockings for 6 weeks. You are able to remove the stockings to wash your legs but this should not be for any longer than 30 minutes.",
        "readConfidence": "clear",
      },
    },
  ],

  // ── 6. Non-medication instructions ───────────────────────────────────────
  // NOT a timeline. Dated facts. Code computes the day-by-day view (I3).
  "instructions": [
    {
      "id": "i_dressing",
      // Five kinds, each earning its place by rendering + voice-script
      // differences, plus `other` as the honest escape hatch.
      "kind": "wound_care",
      "titlePlain": "Your dressing and clips come off", // generated (I6)
      "detailVerbatim": "The District Nurse or Practice Nurse will take off your dressing and remove any clips two weeks after the operation.",
      "anchor": {
        "kind": "offset",
        "from": "procedure",
        "days": 14,
        "daysUntil": null,
        "approximate": false,
        "verbatim": "two weeks after the operation",
      },
      "recurrence": null,
      // CRITICAL (V9): a nurse does this, not Margaret. The voice agent must
      // not ask "did you remove your clips?".
      "actor": "clinician",
      "contactIds": ["c_ward9"],
      "enteredBy": "extracted",
      "source": {
        "documentId": "doc_2",
        "page": 2,
        "quote": "The District Nurse or Practice Nurse will take off your dressing and remove any clips two weeks after the operation.",
        "readConfidence": "clear",
      },
    },
    {
      "id": "i_driving",
      "kind": "activity",
      "titlePlain": "Driving",
      "detailVerbatim": "You should only return to driving when you can be in complete control of your car and can comfortably manage an emergency stop. For most patients this would be around 6 weeks after surgery.",
      // Ranged + approximate. Rendered as "about 6 weeks after your
      // operation" — NEVER as a specific date (V5).
      "anchor": {
        "kind": "offset",
        "from": "procedure",
        "days": 42,
        "daysUntil": null,
        "approximate": true,
        "verbatim": "around 6 weeks after surgery",
      },
      "recurrence": null,
      "actor": "patient",
      "contactIds": [],
      "enteredBy": "extracted",
      "source": {
        "documentId": "doc_2",
        "page": 3,
        "quote": "You should only return to driving when you can be in complete control of your car and can comfortably manage an emergency stop. For most patients this would be around 6 weeks after surgery.",
        "readConfidence": "clear",
      },
    },
    {
      "id": "i_walk",
      "kind": "exercise",
      "titlePlain": "Short walks",
      "detailVerbatim": "Gradually increase the amount you do starting with a short walk 3 to 4 times a day",
      "anchor": {
        "kind": "offset",
        "from": "discharge",
        "days": 0,
        "daysUntil": null,
        "approximate": false,
        "verbatim": "from discharge",
      },
      // Repeats. Null for one-off items.
      "recurrence": { "timesPerDay": 3, "everyDays": 1, "until": null },
      "actor": "patient",
      "contactIds": [],
      "enteredBy": "extracted",
      "source": {
        "documentId": "doc_2",
        "page": 3,
        "quote": "Gradually increase the amount you do starting with a short walk 3 to 4 times a day",
        "readConfidence": "clear",
      },
    },
  ],

  // ── 7. Appointments ──────────────────────────────────────────────────────
  // Separate from `instructions` because they have distinct fields (who,
  // where, booked-vs-promised) and distinct voice copy. They are folded into
  // the computed timeline at render, not stored there.
  "appointments": [
    {
      "id": "a_ortho6wk",
      "withVerbatim": "Orthopaedic outpatients",
      // Absolute — appointment letters carry real dates (V5).
      "when": {
        "kind": "date",
        "date": "2026-08-28",
        "time": "10:20",
        "verbatim": "Friday 28 August 2026 at 10:20am",
      },
      "locationVerbatim": "Orthopaedic Outpatients, Clinic 4",
      // False when the bundle only promises one ("Physiotherapy will contact
      // you within 2 to 3 weeks") — in that case `when` is an offset anchor
      // with approximate:true and the UI says "expect a call around then".
      "isBooked": true,
      "contactIds": ["c_ward9"],
      "enteredBy": "extracted",
      "source": {
        "documentId": "doc_3",
        "page": 1,
        "quote": "Your appointment is on Friday 28 August 2026 at 10:20am in Orthopaedic Outpatients, Clinic 4.",
        "readConfidence": "clear",
      },
    },
  ],

  // ── 8. Red flags — the safety spine ──────────────────────────────────────
  "redFlags": [
    {
      "id": "rf_calf",
      // The pair (V6). Both halves read aloud, both verbatim.
      "triggerVerbatim": "Increase in pain in the calf of your operated leg",
      "actionVerbatim": "Contact your GP",
      "contactIds": ["c_gp"],
      // Derived ONLY from actionVerbatim's named recipient (V7/I7).
      "escalationChannel": "gp",
      // GENERATED (I6) — retrieval keys for matching what the patient SAYS
      // to this line. Used only to ROUTE. Never rendered, never spoken,
      // never stored as clinical content. This is the single place the model
      // writes symptom words, and it is structurally quarantined.
      "matchHints": [
        "calf pain",
        "pain in my leg",
        "sore calf",
        "swollen calf",
        "leg hurts",
      ],
      // Ties a red flag to the drug that motivates it, so the family alert
      // can say "she's missed her clot-preventer twice AND mentioned calf
      // pain" — correlation of two logged facts, not a diagnosis.
      "relatedMedicationIds": ["m_rivaroxaban"],
      "source": {
        "documentId": "doc_2",
        "page": 2,
        "quote": "Contact your GP if you develop: Increase in pain in the calf of your operated leg",
        "readConfidence": "clear",
      },
    },
    {
      "id": "rf_sepsis",
      "triggerVerbatim": "Slurred speech or confusion, extreme shivering or muscle pain, passing no urine in a day, severe breathlessness, skin mottled or discoloured",
      "actionVerbatim": "Call your GP or 111 immediately if you're concerned. Call 999 if you are very concerned, or if there's a delay in talking to your doctor.",
      "contactIds": ["c_111"],
      // Where the letter names a ladder, take the MOST urgent channel it
      // names. Reading the ladder verbatim preserves the clinician's own
      // ordering; the channel is only used to pick the button.
      "escalationChannel": "999",
      "matchHints": [
        "confused",
        "shivering",
        "can't breathe",
        "haven't passed urine",
        "skin looks blotchy",
      ],
      "relatedMedicationIds": [],
      "source": {
        "documentId": "doc_1",
        "page": 2,
        "quote": "Early treatment saves lives. Call your GP or 111 immediately if you're concerned. Call 999 if you are very concerned, or if there's a delay in talking to your doctor.",
        "readConfidence": "clear",
      },
    },
  ],

  // ── 9. The honesty channel (I4/I5) ───────────────────────────────────────
  "extraction": {
    "extractedAt": "2026-07-25T18:04:00Z",
    "modelId": "gpt-5.1",

    // Every field the model could not resolve. Required (may be empty).
    // Without this, an unreadable field is indistinguishable from an absent
    // one, and both are indistinguishable from an invented one.
    "unresolved": [
      {
        "path": "medications[1].duration.end", // dot-path into this doc
        "documentId": "doc_2",
        "reason": "illegible", // "illegible" | "absent_from_bundle"
        //  | "ambiguous" | "conflicting_sources"
        "verbatimContext": "You should wear your stockings for ___ weeks",
        "note": "Number handwritten and not legible in the photo.",
      },
      {
        "path": "medications[0].schedule.timesOfDay",
        "documentId": "doc_1",
        "reason": "absent_from_bundle",
        "verbatimContext": "Take ONE tablet once daily",
        // This is Raf's verbal/written gap (V12) made concrete and useful.
        "note": "Letter states frequency but not time of day.",
      },
    ],

    // Documents disagreeing. NEVER auto-resolved — a 5-document bundle WILL
    // contain a letter and a box label that differ, and picking a winner is
    // clinical judgement.
    "conflicts": [
      {
        "topic": "Co-amoxiclav course length",
        "positions": [
          {
            "documentId": "doc_1",
            "quote": "Co-amoxiclav 625mg three times a day for 7 days",
            "readConfidence": "clear",
          },
          {
            "documentId": "doc_4",
            "quote": "CO-AMOXICLAV 625MG  TAKE ONE THREE TIMES A DAY  QTY 15",
            "readConfidence": "clear",
          },
        ],
        "note": "Letter says 7 days (21 tablets); label supplies 15.",
      },
    ],
  },
}
```

### Zod-4 sketch

Zod 4.4.3, matching the repo's existing trust-boundary pattern in
`/Users/haidertoha/Code/juno-hack/lib/env.ts`. An LLM extraction response is
unambiguously a trust boundary, so Zod belongs here.

Three deliberate constraints on how this is written, each with a reason:

- **`.nullable()` everywhere, never `.optional()`.** OpenAI structured outputs
  in strict mode require every property to be present in `required` and
  `additionalProperties: false`. Optionality has to be expressed as `T | null`.
  Writing it that way from the start means `z.toJSONSchema()` output is
  directly usable, and it makes I4 (absence is representable) the default
  rather than an afterthought.
- **No `.default()`, no `.transform()` on the wire schema.** Defaults hide the
  difference between "the letter said 0" and "the model said nothing", which
  is exactly the distinction I4 exists to preserve.
- **Discriminated unions for every variant.** Illegal states unrepresentable,
  exhaustive `switch` in the renderer — per project rules.

```ts
import { z } from "zod";

// ── Primitives ─────────────────────────────────────────────────────────────

const ReadConfidence = z.enum(["clear", "unclear"]);

// The locator. The QUOTE is the primary locator, not a character offset:
// offsets are invalidated by any re-run of OCR, while a quote is stable,
// greppable against the document text, and directly human-verifiable in the
// "show me where it says that" UI. Page is a navigation hint only.
//
// I10: `documentId` resolves to `documents[].blobUrl` — a durable Vercel Blob
// URL. So a sourceRef is a permanent deep link (blobUrl + page + quote), not a
// pointer into an ephemeral request-scoped upload. The URL is NOT duplicated
// here: one indirection keeps the persisted JSON small and means re-uploading
// a clearer photo of a document updates every reference to it at once.
const SourceRef = z.object({
  documentId: z.string(),
  page: z.number().int().positive().nullable(),
  quote: z.string().min(1),
  readConfidence: ReadConfidence,
});

// V5. Three variants, all observed in real leaflets.
const DateAnchor = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("offset"),
    from: z.enum(["discharge", "procedure", "upload"]),
    days: z.number().int(),
    // Non-null for ranges: "2 to 3 weeks" -> days 14, daysUntil 21.
    daysUntil: z.number().int().nullable(),
    // "around 6 weeks" / "approximately". Suppresses date rendering.
    approximate: z.boolean(),
    verbatim: z.string().min(1),
  }),
  z.object({
    kind: z.literal("date"),
    date: z.iso.date(),
    time: z.string().nullable(),
    verbatim: z.string().min(1),
  }),
  // The variant that stops the model inventing a stop date for an
  // anticoagulant described as "until your mobility returns to normal".
  z.object({
    kind: z.literal("conditional"),
    verbatim: z.string().min(1),
  }),
]);

const EnteredBy = z.enum(["extracted", "patient_added"]);

// ── Documents ──────────────────────────────────────────────────────────────

const SourceDocument = z.object({
  id: z.string(),
  kind: z.enum([
    "discharge_summary", // PRSB eDischarge / TTO letter
    "medication_list", // standalone TTO / TTA sheet
    "medicine_label", // photo of a dispensed box
    "wound_care_advice",
    "physio_advice",
    "appointment_letter",
    "alert_card", // anticoagulant / steroid alert card
    "unknown",
  ]),
  displayName: z.string(),
  capture: z.enum(["photo", "pdf", "scan"]),
  pageCount: z.number().int().positive().nullable(),
  // I10 — durable storage identity. NOTE: these two are NOT produced by the
  // model. Upload writes to Blob first, then the known documents (with their
  // ids and URLs) are passed INTO the extraction prompt. So the model-facing
  // JSON schema omits them and they are merged in server-side after parse.
  // Letting a model emit a URL is asking it to hallucinate one.
  blobUrl: z.url(),
  blobPathname: z.string().min(1),
});

// ── Patient (minimal — I8) ─────────────────────────────────────────────────

const Patient = z.object({
  givenName: z.string().nullable(),
  preferredLanguage: z.string().nullable(), // BCP-47
  redactedByPolicy: z.array(z.string()), // field NAMES only, never values
});

// ── Episode ────────────────────────────────────────────────────────────────

const Episode = z.object({
  kind: z.enum(["surgical", "medical", "other"]),
  titleVerbatim: z.string().nullable(),
  titlePlain: z.string().nullable(), // generated (I6)
  dischargeDate: z.iso.date().nullable(), // primary anchor
  procedureDate: z.iso.date().nullable(), // null for medical episodes
  dischargingTeamVerbatim: z.string().nullable(),
  source: SourceRef.nullable(),
});

// ── Contacts ───────────────────────────────────────────────────────────────

const EscalationChannel = z.enum([
  "999",
  "111",
  "gp",
  "ward",
  "specialist_team",
  "pharmacy",
  "district_nurse",
  "practice_nurse",
  "other",
]);

const Contact = z.object({
  id: z.string(),
  labelVerbatim: z.string().min(1),
  phone: z.string().nullable(),
  channel: EscalationChannel,
  // Leeds names three numbers for one symptom list, split by time of day.
  hoursVerbatim: z.string().nullable(),
  source: SourceRef,
});

// ── Medications ────────────────────────────────────────────────────────────

// Thin by design. The drug-lookup track owns everything past this.
const DrugLookupKey = z.object({
  normalisedName: z.string().min(1),
  form: z.string().nullable(),
  strength: z.string().nullable(),
  nameConfidence: ReadConfidence,
});

const Medication = z.object({
  id: z.string(),
  nameAsWritten: z.string().min(1),
  lookupKey: DrugLookupKey.nullable(), // null for devices e.g. TEDs

  // The national standard's primary field (V2). Never null — if we cannot
  // read the directions we do not have a medication record, we have an
  // `unresolved` entry.
  doseDirectionsVerbatim: z.string().min(1),

  dose: z.string().nullable(),
  route: z.string().nullable(),
  schedule: z.object({
    timesPerDay: z.number().int().positive().nullable(),
    // Empty array means "letter did not say". Distinct from null.
    timesOfDay: z.array(z.enum(["morning", "midday", "evening", "night"])),
    verbatim: z.string().nullable(),
  }),
  withFood: z.enum(["with", "without", "either", "not_stated"]),

  duration: z.object({
    start: DateAnchor.nullable(),
    end: DateAnchor.nullable(),
  }),

  changeStatus: z.enum([
    "continued",
    "added",
    "amended",
    "stopped",
    "not_stated",
  ]),
  changeNoteVerbatim: z.string().nullable(),

  indicationVerbatim: z.string().nullable(),
  // Generated (I6). Invariant checked in code after parse:
  // purposePlain !== null implies indicationVerbatim !== null.
  purposePlain: z.string().nullable(),

  escalationClass: z.enum(["standard", "high_stakes"]),
  escalationClassSource: z.enum(["letter_flagged", "configured_class_list"]),

  enteredBy: EnteredBy,
  source: SourceRef,
});

// ── Instructions ───────────────────────────────────────────────────────────

const Instruction = z.object({
  id: z.string(),
  kind: z.enum([
    "wound_care", // one-off dated action on the wound
    "activity", // a standing restriction/permission over a window
    "exercise", // repeated, adherence-logged, different copy from meds
    "appointment_prep",
    "other",
  ]),
  titlePlain: z.string().nullable(), // generated (I6)
  detailVerbatim: z.string().min(1),
  anchor: DateAnchor.nullable(), // null => standing, undated
  recurrence: z
    .object({
      timesPerDay: z.number().int().positive().nullable(),
      everyDays: z.number().int().positive(),
      until: DateAnchor.nullable(),
    })
    .nullable(),
  // V9. Drives the voice script: "did you…" vs "has someone been to…".
  actor: z.enum(["patient", "carer", "clinician"]),
  contactIds: z.array(z.string()),
  enteredBy: EnteredBy,
  source: SourceRef,
});

// ── Appointments ───────────────────────────────────────────────────────────

const Appointment = z.object({
  id: z.string(),
  withVerbatim: z.string().min(1),
  when: DateAnchor,
  locationVerbatim: z.string().nullable(),
  // False when the bundle only promises contact ("Physiotherapy will contact
  // you within 2 to 3 weeks") rather than giving a slot.
  isBooked: z.boolean(),
  contactIds: z.array(z.string()),
  enteredBy: EnteredBy,
  source: SourceRef,
});

// ── Red flags ──────────────────────────────────────────────────────────────

const RedFlag = z.object({
  id: z.string(),
  triggerVerbatim: z.string().min(1),
  actionVerbatim: z.string().min(1),
  contactIds: z.array(z.string()),
  // I7: a function of actionVerbatim's named recipient ONLY. Never of the
  // symptom. Where the letter names a ladder, take its most urgent rung.
  escalationChannel: EscalationChannel,
  // I6: the only place the model writes symptom words. Retrieval keys for
  // routing speech to this line. Never rendered, never spoken.
  matchHints: z.array(z.string()),
  relatedMedicationIds: z.array(z.string()),
  source: SourceRef,
});

// ── The honesty channel ────────────────────────────────────────────────────

const Unresolved = z.object({
  path: z.string().min(1), // dot-path into this document
  documentId: z.string().nullable(),
  reason: z.enum([
    "illegible",
    "absent_from_bundle",
    "ambiguous",
    "conflicting_sources",
  ]),
  verbatimContext: z.string().nullable(),
  note: z.string(),
});

const Conflict = z.object({
  topic: z.string().min(1),
  positions: z
    .array(
      z.object({
        documentId: z.string(),
        quote: z.string().min(1),
        readConfidence: ReadConfidence,
      }),
    )
    .min(2),
  note: z.string(),
});

// ── Root ───────────────────────────────────────────────────────────────────

export const ExtractedBundle = z.object({
  schemaVersion: z.literal("juno-extract/1"),
  documents: z.array(SourceDocument).min(1),
  patient: Patient,
  episode: Episode,
  contacts: z.array(Contact),
  medications: z.array(Medication),
  instructions: z.array(Instruction),
  appointments: z.array(Appointment),
  redFlags: z.array(RedFlag),
  extraction: z.object({
    extractedAt: z.iso.datetime(),
    modelId: z.string(),
    unresolved: z.array(Unresolved), // required; may be empty
    conflicts: z.array(Conflict), // required; may be empty
  }),
});

export type ExtractedBundle = z.infer<typeof ExtractedBundle>;
```

**Feeding it to the model.** Zod 4 ships `z.toJSONSchema()`, so the extraction
call gets its schema from the same source of truth that validates the
response. One wrinkle: `blobUrl` / `blobPathname` are known _before_ the call
(upload writes to Blob, then we prompt), so the model must not be asked to
produce them — a model asked for a URL will invent one. Derive the model-facing
schema by omitting them, and merge them back after parse:

```ts
// What the model is asked for — same shape minus the storage identity.
const ExtractedBundleFromModel = ExtractedBundle.extend({
  documents: z.array(
    SourceDocument.omit({ blobUrl: true, blobPathname: true }),
  ),
});

const jsonSchema = z.toJSONSchema(ExtractedBundleFromModel, {
  target: "draft-7",
});
```

Then parse the response with `ExtractedBundleFromModel`, re-attach each
document's `blobUrl` / `blobPathname` from the upload result by `id`, and
validate the merged object once with `ExtractedBundle` before it goes to Redis.
The second parse is not redundant belt-and-braces — it is the boundary check on
our own merge step, and it is where a mismatched `id` between the upload result
and the model's document list surfaces.

Three post-parse invariants that Zod cannot express cleanly. Keep them as plain
`if` statements, not a validation framework:

1. `purposePlain !== null` implies `indicationVerbatim !== null` (I6).
2. Every `contactIds` / `relatedMedicationIds` / `documentId` string resolves
   to an existing `id`. Dangling references are the most likely LLM error in a
   cross-referenced document and they are trivially detectable.
3. Every `SourceRef.quote` is a substring of the text extracted from the
   document it names (whitespace-normalised). This is the mechanical
   enforcement of I2 — it catches a paraphrase masquerading as a verbatim
   quote, which is the single failure mode that would break the regulatory
   shield. A failure here becomes an `unresolved` entry with
   `reason: "ambiguous"`, not a thrown error: one bad quote must not discard a
   whole bundle.

### Persistence & serialisation

The extracted bundle is persisted as one JSON value in Upstash Redis (keyed per
patient) and the uploaded originals live in Vercel Blob. Three notes for
whoever wires that up.

**I9 — nothing in this schema needs a serialiser.** Checked deliberately:
there is no `Date`, `Map`, `Set` or class instance anywhere. `z.iso.date()` and
`z.iso.datetime()` validate _strings_ and return strings, so
`JSON.parse(JSON.stringify(bundle))` is lossless and `redis.set(key, bundle)` /
`redis.get<ExtractedBundle>(key)` round-trip cleanly.

The temptation to flag explicitly: `episode.dischargeDate`,
`episode.procedureDate`, `DateAnchor.date` and `extraction.extractedAt`
all _feel_ like they want to be `Date` objects, because the timeline
computation does arithmetic on them. **Do not put a `Date` in the schema.** A
`Date` serialises to a string on the way into Redis and comes back as a string,
so the type would lie about what is actually stored, and the lie surfaces as a
`TypeError` on the first `.getTime()` after a page refresh. Parse to a `Date`
inside the timeline function, throw it away on return. The stored shape stays
ISO-8601 strings throughout.

Same rule for `null` vs `undefined`: `JSON.stringify` drops `undefined`
properties entirely, so a field that was "explicitly absent" would come back
"missing" and fail the schema on re-read. Everything optional in this schema is
`.nullable()`, never `.optional()` — a decision already forced by OpenAI strict
mode, and Redis round-tripping is the second, independent reason for it.

**Blob URLs make the audit trail durable, which is the point (I10).** Before
this change a `SourceRef` was a pointer into a request-scoped upload; now
`documentId → documents[].blobUrl` is a permanent deep link, so "show me where
the letter says that" works on day 30, not just at upload time. That is worth
saying out loud in the pitch — the claim "everything traces back to the
doctor's words" is only as strong as the ability to _produce the document_, and
now it can.

Two consequences worth handing to whoever owns storage. First, blob URLs are
public-by-URL: they are unguessable, but they are not access-controlled, so a
leaked URL is a leaked medical document. Randomised pathnames (Blob's default
`addRandomSuffix`) are the mitigation, and this is worth one honest sentence to
judges rather than an overclaim about security. Second, the redaction policy in
`patient.redactedByPolicy` covers the _extracted JSON only_ — the original
photo in Blob still shows the NHS number. Deleting the blobs is what actually
discards those identifiers, so retention is a Blob-lifecycle question, not a
schema question. Flagging it so nobody claims more privacy than we deliver.

### Field-by-field rationale (the non-obvious choices)

**`documents` is always an array, and everything references it by id.**
Removes the 1-doc-vs-5-doc branch entirely, and it is what makes `conflicts`
expressible at all — a conflict is by definition two `documentId`s.

**`SourceRef.quote` is the locator, not a character offset.** Offsets die the
moment OCR is re-run or the image is re-cropped. A quote is stable, greppable,
and directly renderable in a "tap to see where it says that" UI. This is the
mechanism behind the whole regulatory shield: **if you cannot produce the
quote, you do not get to say the thing.**

**No `timeline[]` in the output (I3).** The single highest-leverage decision
here. The model produces dated facts; a pure function
`(bundle, today) => Day[]` produces the schedule. Consequences: day arithmetic
becomes deterministic and unit-testable, the model cannot hallucinate a day
number, a corrected anchor date re-derives the whole plan for free, and the
"what does day 7 look like" view is a `filter`, not a database. It also means
the extraction prompt gets materially shorter and cheaper — it never has to
reason about calendars.

**`episode.kind` instead of surgery-shaped top-level fields.** Raf has not
picked the case and pushed back on hip replacement (V13). There is no
top-level `wound`, no top-level `sutureRemovalDate`. A medical admission is
the same record with `procedureDate: null` and zero `wound_care` instructions.

**`DateAnchor.approximate`.** Rendering "approximately 6 weeks" as a specific
date is generating precision the clinician did not write. This flag makes the
renderer say "about six weeks after your operation" and is a one-line
enforcement of the guiding principle.

**Five `Instruction.kind`s plus `other`.** Each of the five changes either the
rendering or the voice script: `wound_care` is a dated one-off the patient
confirms; `activity` is a standing restriction over a window and must NOT
appear as a daily checkbox; `exercise` recurs with counts; `appointment_prep`
is a task attached to a date someone else set; `other` prevents the extractor
force-fitting. Anything narrower (a separate `suture_removal`) is a
`wound_care` with `actor: "clinician"` — no new variant earned.

**No `adherenceTracked` field.** It is fully derivable from
`kind + actor` (`activity` is never tracked; `clinician`-actor items are never
"did you"). Storing a derivable boolean invites the two to drift. Noted here
so nobody adds it back.

**`withFood` is four-valued.** NICE NG27 1.5.16 and the dispensing label both
carry food timing, and "not stated" is the common case. A boolean would force
the model to guess, and the guess would be silent.

**`escalationClassSource`.** Makes the high-stakes decision auditable and
honest — a product rule about escalation, not a clinical claim (V11).

**`matchHints` is the only symptom text the model writes, and it is
quarantined.** It routes speech to a verbatim line; it is never rendered or
spoken. This is the structural answer to "how is symptom matching not
triage": the model's generated text can only _select_ among the doctor's
lines, never _become_ one.

**`enteredBy`.** One enum field that answers Raf's "they say stuff and they
expect you to remember it. It's not on the letter." Patient-added items appear
on the timeline, are visually distinct, never gain verbatim status, and never
drive red-flag matching (V12).

---

## Robustness to real-letter variation

### R1 — Free-text vs tabular medications

Solved by copying the national standard: `doseDirectionsVerbatim` is the one
required medication field and is "a single plain text phrase describing the
entire medication dosage" (V2). Structured fields (`dose`, `route`,
`schedule`, `withFood`) are nullable refinements. A prose letter yields a valid
record; a table yields a richer one. **No downstream consumer may require a
structured field.** The voice agent reads `doseDirectionsVerbatim`; the
timeline places the item using `schedule.timesOfDay` if present and a stated
default if not.

### R2 — Trust-to-trust vocabulary drift

Real bundles say clips / staples / sutures / stitches; TTO / TTA / "take home
medicines"; "Ward 9" / "the surgical team" / "Clinic 4". The schema **never
enumerates clinical vocabulary** — all of it lives in `*Verbatim` strings.
Enums appear only where the value space is genuinely closed and
system-defined: `escalationChannel` (which service to route to),
`DateAnchor.kind`, `Instruction.kind`, `documents[].kind`, `withFood`,
`changeStatus`. Every one of those is a _Juno_ concept, not a clinical one.

### R3 — Missing sections are the normal case, not the error case

"Medications and Medical Devices" is an **Optional** heading in the national
standard (V1), and _Information and advice given_ / _Plan and requested
actions_ are free-text-only (V8). Trust leaflets are templates with blanks
filled in by hand — Leeds literally prints "leave any dressing on your
wound(s) for the number of days we tell you" (V5).

Therefore: **our required set must be strictly smaller than the standard's
mandatory set.** The only non-nullable things in the schema are structural
(`schemaVersion`, the arrays themselves, `documents.length >= 1`) plus
`doseDirectionsVerbatim` and `*Verbatim` strings _on records that exist at
all_. `episode.dischargeDate` is nullable. Every array may be empty. Empty
arrays are not silent: they should produce `unresolved` entries with
`reason: "absent_from_bundle"`, which is a UI beat, not a bug.

### R4 — 1 document vs 5

No special case exists. `documents` is an array; every other record points at
it by id. A single-document bundle is the same code path with one entry. The
only thing that changes at 5 documents is that `conflicts` becomes non-empty —
which is why it exists.

### R5 — The anchor-date failure mode, and its fallback

The one thing that genuinely breaks the timeline is a bundle where neither
`dischargeDate` nor `procedureDate` is legible. Handled explicitly rather than
by silent default: `DateAnchor.from` includes `"upload"`, so the app can
resolve offsets against the upload date and **say so in the UI** ("we couldn't
read your discharge date, so we've counted from today — tap to correct it").
A single correction re-derives the entire plan (this is the payoff of I3).
The corresponding `unresolved` entry with `reason: "illegible"` drives that UI.

### R6 — Photographs, not PDFs

Raf will supply "pdfs and stuff… images", and the product story is "they take
a picture of all of the documentation" (transcript, meeting 2). Photos are
skewed, glared, partially cropped and shot at an angle. `readConfidence` is
deliberately **binary, not a float** — an uncalibrated 0.83 from an LLM is
false precision that will get rendered as a percentage by someone. "Could I
read this cleanly, yes or no" is a question a vision model can actually answer
about an image, and it maps directly to one UI state: a "check this" badge.

### R7 — Recommended synthetic dev samples (throwaway, three files)

Small plain-text files so the extraction pipeline can be exercised _today_,
before Raf's bundle lands. Deliberately not polished — the moment the real
bundle arrives these are deleted, not maintained. Suggested home:
`fixtures/dev/` (or wherever Track 2 puts its extraction fixtures), clearly
marked as scratch.

1. **`linear-medical.txt`** — the horse, not the zebra, per Raf. A single
   plain-text discharge summary for a common **medical** admission (no wound,
   no procedure date): a 5-day antibiotic course, a reducing steroid course
   across a fortnight, one 111-routed red flag, one absolutely-dated GP
   follow-up. ~30 lines. This is the sample that proves the schema is not
   surgery-shaped.
2. **`multi-doc-surgical.txt`** — three short docs concatenated with clear
   separators (or three files): discharge summary + wound-care advice sheet +
   appointment letter. Exercises cross-document `sourceRef`s, a relative wound
   anchor against an absolute appointment date, a high-stakes anticoagulant,
   and a `conditional` duration ("until your mobility returns to normal").
   ~50 lines total.
3. **`degraded.txt`** — ~15 lines, exists solely to prove the honesty channel.
   One section replaced with `[illegible]`, one dose that disagrees between
   the letter body and a transcribed box label, one instruction with no date
   at all. If extraction on this file produces a confident, complete,
   conflict-free result, the schema's most important feature is not working.

**Do not build a polished synthetic bundle.** That is Raf's deliverable and
duplicating it wastes hours we do not have. These three exist only so the
extraction prompt and the Zod parse can be iterated in parallel with him.

These fixtures exercise extraction, not upload, so they never touch Blob. Give
each fixture document a placeholder `blobUrl` (a `file:///fixtures/...` string
passes `z.url()`) and merge it in exactly where the real pipeline merges the
real one — that way the fixture path and the production path differ in the
_value_ of one field, not in the shape of the code.

### R8 — The contract test worth having

When Raf's JSON arrives (V14), the single highest-value test is: run extraction
over his PDFs, then diff the result against his JSON on five fields —
medication names, dose directions, course durations, red-flag lines,
appointment dates. Not a structural diff (his shape will differ), a
hand-mapped one. That number is quotable on stage.

---

## What changed vs the prior assumption

Deltas against `/Users/haidertoha/Code/juno-hack/plan/initial-idea.md`, all
driven by meeting 2 or by the research above.

### D1 — Hip replacement is not the case, and the schema must not assume surgery

`initial-idea.md` builds its demo script entirely on "Margaret, 74. Home after
a hip replacement." Raf explicitly declined that framing (V13): "when you hear
hooves, like, on the street, you think there's a horse, not zebras… it's good
to just show that this will work for, like, old people that have, like, a
chronic condition."

**Change:** `episode.kind` is a three-way union, there are no surgery-specific
top-level fields, and wound care is one `Instruction.kind` among five. The
demo script in `initial-idea.md` should be treated as a _placeholder_ until
Raf names the scenario — a task-splitting agent should not schedule work that
hard-codes hip-replacement copy.

### D2 — The input is a multi-document bundle, not "a discharge letter"

`initial-idea.md` Tier 1 says "Upload PDF/photo → LLM extracts". Research (V1,
V3, V5, V11) plus Raf's commitment show the real bundle is: discharge summary

- TTO medication list + one or more advice sheets + appointment letter +
  possibly a dispensed-medicine label and an alert card.

**Change:** `documents[]` is first-class, `sourceRef` is document-scoped, and
`conflicts[]` exists because multi-document bundles disagree.

### D3 — The letter does not list common side effects; the demo beat in `initial-idea.md` needs rerouting

`initial-idea.md` and meeting 1 both assume the letter carries side-effect
information ("maybe we say like this could be the common side effects…so it
triggers that side effect"). **The eDischarge medication cluster has no
side-effects field** (V2) — it carries name, form, quantity, route, site,
method, dose directions, additional instruction, indication and change
summary. Side effects live in the BNF and in the patient information leaflet
in the box, which is exactly why Raf pointed at the BNF.

**Change (flag for the spec writer, two options, pick one):**
either (a) ask Raf to deliberately author a "possible side effects" line into
his letter so the beat has a verbatim source, or (b) move the demo beat onto
the **red-flag** path, which is better grounded anyway — advice sheets
demonstrably do carry "contact us if" lines (V6). Option (b) is the safer
default and costs nothing. What must NOT happen is Juno telling a patient
about a side effect the letter never mentioned; that is generated clinical
content and it fails the guiding principle. The on-demand BNF lookup track can
answer "what are the side effects of this drug" **on the patient's explicit
request**, which is a different interaction and a different track's call.

### D4 — "High-stakes" cannot be extracted; it is configured

`initial-idea.md` Tier 2 escalates on "a _pattern_ of missed high-stakes meds"
without saying how a med becomes high-stakes. A letter will not say so (V11).

**Change:** `escalationClass` + `escalationClassSource`, with a short
checked-in class list as the default route. Get Raf to sign the list off — it
is a two-minute conversation and it converts a hand-wave into a defensible
product rule.

### D5 — Extraction does not produce the timeline

`initial-idea.md` Tier 1 item 2 reads as though the model places items on
days. It should not (I3). This is a scope _reduction_ on the riskiest
component and a correctness _improvement_: dates become deterministic code.

### D6 — Raf's JSON is a fixture, not an ingestion path

New in meeting 2 and not in `initial-idea.md` at all. See V14. Also: brief him
to write the **letters first** and derive the JSON, not the reverse.

### D7 — Nothing on the cut list is reintroduced

Checked explicitly. No symptom checker (matching is retrieval over the
doctor's own lines, and `matchHints` is quarantined to routing). No pill
identification. No label OCR as a feature — `medicine_label` is a _document
kind_ the user may photograph as part of the bundle, extracted by the same
prose pipeline as everything else, not a "point your camera at a pill" flow;
if the spec writer thinks that is too close to the line, dropping
`medicine_label` from the union costs nothing. No open-web Q&A. No
discharge-conversation dictation — `enteredBy: "patient_added"` is a typed
note the patient chooses to add, not a recorded consultation.

---

## Could not confirm

Honest list. None of these are guessed at above.

1. **Two trust TTO leaflets returned undecodable binary.** East & North Herts
   ([PDF](https://www.enherts-tr.nhs.uk/wp-content/uploads/2019/10/TTO-Medications-v4-01.2020.pdf))
   and UHB
   ([PDF](https://www.uhb.nhs.uk/media/zaskgrjp/pi_pharmacy-information-for-patients-being-discharged-home_medicines.pdf)).
   I am citing their existence and titles as evidence that trusts publish
   dedicated TTO patient leaflets; I have **not** verified their contents.
   The TTO field claims above rest on Rotherham, which I did retrieve.
2. **nice.org.uk blocks programmatic fetch (403).** NG27 rec 1.5.16, QS136
   statement 4, and the NG89 VTE durations are all from the search index of
   those pages plus the NHS medicines-resources mirror. Directionally solid,
   not verbatim-verified. If a claim about NICE ends up on a slide, re-check
   it in a browser first.
3. **The DOAC bleeding red-flag list is indicative, not verified.** The GGC
   page only links the booklet and alert-card PDFs
   ([ggcmedicines.org.uk](https://ggcmedicines.org.uk/information-for-patients/direct-oral-anticoagulants/));
   I did not decode them. The specific symptom list came from the search
   index. Have Raf author the actual wording.
4. **The "with or without food" label field.** Rotherham (retrieved) confirms
   the label carries name, dose and frequency. The food clause comes from the
   Kent Community Health leaflet, which 404'd on direct fetch and was only
   available through the search index. `withFood` is retained in the schema
   because NICE NG27 requires timing information and it is a well-known
   dispensing cautionary — but treat the specific citation as weak.
5. **Whether patients routinely receive the eDischarge summary itself.** The
   PRSB guide is silent on it
   ([theprsb.org/edischarge-summaries-a-guide](https://theprsb.org/edischarge-summaries-a-guide/)),
   and the UK realist evaluation found only 26 of 36 patients had received a
   discharge letter at all ([PMC8296817](https://pmc.ncbi.nlm.nih.gov/articles/PMC8296817/)).
   So "the patient has the letter" is a product assumption, not a guarantee.
   It does not change the schema.
6. **Raf's "HRC" is an unresolved transcription.** Meeting 2: "when I was
   thinking of was that HRC, that's like a really common one. They might. They
   get symptoms. They think they have cancer. It's just HRC." The phonetics
   don't resolve to a condition I can confirm — the "think they have cancer,
   it's actually benign" shape fits several common presentations. **Ask him
   directly.** It may be his chosen scenario.
7. **The shape of Raf's forthcoming JSON.** He agreed to produce one; nobody
   specified a format. Assume it will not match this schema.
8. **BNF site content.** [bnf.nice.org.uk](https://bnf.nice.org.uk/) returned 403. Monograph contents are described via
   [UKCPA](https://ukclinicalpharmacy.org/profession/resources/guide-to-the-bnf-how-to-use-the-british-national-formulary/)
   and [Wikipedia](https://en.wikipedia.org/wiki/British_National_Formulary).
   Whether it exposes anything machine-readable is the drug-lookup track's
   problem, not mine, but flagging that direct fetch is blocked will save them
   a cycle.
9. **The BJGP safety-netting literature review**
   ([bjgp.org/content/69/678/e70](https://bjgp.org/content/69/678/e70))
   returned navigation chrome only. The safety-netting claims in V8 rest on
   [PMC10811715](https://pmc.ncbi.nlm.nih.gov/articles/PMC10811715/), which I
   did retrieve.
10. **Recall statistics** (47% / 58% / 67%, and the two-thirds verbal-only
    figure) are from search-index summaries of the
    [Frontiers 2021](https://www.frontiersin.org/journals/communication/articles/10.3389/fcomm.2021.736095/full),
    [Annals of Emergency Medicine](https://www.sciencedirect.com/science/article/abs/pii/S0196064419304986)
    and [Flacker 2007](https://shmpublications.onlinelibrary.wiley.com/doi/10.1002/jhm.166)
    papers. Not full-text verified. Fine as supporting colour, not as a
    headline slide number.

---

## Residual risk

**Ranked by what actually threatens the build.**

1. **Raf has not picked the scenario, and the schema cannot be validated until
   he does.** Everything above is designed to be scenario-agnostic, but
   scenario-agnostic is not the same as scenario-proof. Highest-value action
   available right now: get him to name the case, even provisionally. A
   one-line answer unblocks the extraction prompt, the demo copy, and the
   high-stakes drug list simultaneously.

2. **The prose sections we depend on most are the least structured.** The
   national standard leaves _Information and advice given_ and _Plan and
   requested actions_ as free text with no coded representation (V8).
   Extraction quality on those two sections is the product. There is no
   structural fallback — if the model reads them badly, Juno is wrong in the
   specific way that matters. Mitigation is prompt quality plus `unresolved`
   plus `readConfidence`, all of which degrade honestly rather than silently.

3. **`matchHints` is where the safety argument is thinnest.** It is
   structurally quarantined and only routes to verbatim lines, and I believe
   that holds. But a hostile reading is "the model wrote symptom words". Two
   cheap hardenings worth doing if time permits: cap the list (say 8 hints),
   and have Raf eyeball the generated hints for the demo bundle. A medic
   signing off the routing vocabulary is a strong answer to that question on
   stage.

4. **Dangling id references.** Cross-referenced JSON from an LLM will
   occasionally point `contactIds` at a contact it did not emit. Zod will not
   catch it. The post-parse referential check is ~15 lines and must not be
   skipped — a red flag whose contact does not resolve is a red flag the
   patient cannot act on, which is the worst possible failure in this product.

5. **`escalationChannel` on a ladder.** Where the letter says "GP or 111…
   999 if very concerned", taking the most urgent rung is a defensible reading
   but it _is_ a reading. The mitigation already in the schema is that
   `actionVerbatim` carries the full ladder and is what gets read aloud — the
   channel only picks which button is highlighted. Worth stating explicitly in
   the voice-agent spec so nobody drops the verbatim in favour of the enum.

6. **`purposePlain` and `titlePlain` are generated text on screen.** They are
   translations of verbatim source and therefore inside the guiding principle,
   but they are the two places where a bad generation would put invented
   clinical wording in front of a patient. The `purposePlain ⇒
indicationVerbatim` invariant handles the worst case (inventing a purpose
   from nothing). Rendering them adjacent to, not instead of, the verbatim
   line handles the rest — a UI decision, flagged here for Track 4/5.

7. **Schema churn once the real bundle lands.** `juno-extract/1` is versioned
   for a reason. Expect one revision after Raf's documents arrive. The pieces
   most likely to move are `Instruction.kind` and `documents[].kind`; the
   pieces that should not move are `SourceRef`, `DateAnchor`, and the
   `extraction` honesty channel. Anyone planning tasks off this file should
   treat the two `kind` unions as soft and the other three as load-bearing.
   `schemaVersion` is a `z.literal`, so a bundle written by an older build
   fails the parse loudly on read from Redis rather than half-loading — which
   is the behaviour we want, but it does mean a mid-hackathon schema change
   invalidates whatever is already in Redis. Flush the key rather than writing
   a migration; there is no data worth keeping tonight.

8. **The originals in Blob are unredacted, and their URLs are public-by-URL.**
   `patient.redactedByPolicy` governs the extracted JSON only — the photo still
   shows the NHS number, and a Vercel Blob URL is unguessable but not
   access-controlled. Nothing in the schema can fix that; it is a Blob
   lifecycle and access question. Flagged so the privacy claim made on stage
   matches what is actually true: _we don't extract your identifiers_, not
   _we don't store them_.
