# Track 3 — Per-drug side-effect / red-flag lookup: feasibility

Research pass, 2026-07-25. Every access-model, rate-limit and licence claim below has a URL
that was actually retrieved during this pass, or is explicitly marked in
[Could not confirm](#could-not-confirm).

---

## Scope

The medic (Meeting 2) raised the BNF. Verbatim, `plan/raw-transcript.md`:

> **Them (L45):** "Do you know what the bnf is? It's a. It's a really good resource to use. I think I
> can send you it. Hold on. Bnn it will have, like, a list of pretty much every medication, the
> indications. Common side effects, rare side effects."

> **Them (L47):** "Even if it mentions a drug, it will know, okay, this is a side effect of what
> you're taking. But then it should also know, like, because every medication has, like, **red flag
> side effects**."

> **Them (L49):** "If you get, like, a certain symptom with this, like, we'd advise you to contact,
> and I should probably say, like, **it should probably just advise them to do it. Like, don't make
> it call anything** or any. Yeah. Like, just say, like, are we strongly advising to see follow-up
> [care]."

> **Them (L51):** "I'll give you the. Bro, this is beautiful. Look at this. I'm gonna send you a link
> here. **Straight database.** On WhatsApp."

Two things follow, and they pull in opposite directions.

1. **L49 is a hard product constraint, not a suggestion.** Advisory only. The app surfaces an
   instruction to seek help; it never takes the action, never decides urgency, never diagnoses.
   This is the same shield as `plan/initial-idea.md` L26 — _"The app only ever reformats, schedules,
   and reads back the clinician's own words, and routes to humans."_ Drug data is only admissible
   if it too is **someone else's words, read back**.
2. **L51's "straight database" does not exist for us.** That is the finding of this track. See
   [Sources evaluated](#sources-evaluated).

**In scope:** is there a programmatic source of per-drug common side effects + red-flag/seek-help
symptoms + the advisory text, fetchable on demand for the 4–8 drugs named in _one_ patient's
letter, inside a <24h build with two coders.

**Out of scope / already cut:** any standing drug database we build and maintain; any triage or
symptom-checking (`initial-idea.md` L96); any inference that a symptom _is_ caused by a drug.

### Stack constraints as of this revision

The original brief said "no database of any kind; cache in memory or a JSON file". **That is
superseded.** The stack now has **Upstash Redis** (`@upstash/redis`, via the Vercel Marketplace) for
state and **Vercel Blob** for uploaded files. Still no Supabase. Extraction runs through the **Vercel
AI SDK via the AI Gateway**, and the voice interaction is an **in-app two-way orb conversation**
(notification → tap → talk), not an outbound phone call.

This strengthens the recommendation below rather than changing it, and it turns one hand-wave into a
real design: see [The cache, and why its TTL is 24 hours](#the-cache-and-why-its-ttl-is-24-hours).

**The hard rule is unchanged and absolute:** on-demand, per-patient, keyed off the drugs actually
named in that patient's letter. A Redis cache of the handful of drugs one patient is on is a cache.
A pre-populated formulary is a database, and we are not building one. Three guardrails keep that
line crisp, and they are testable:

1. **Nothing pre-populates the cache.** No seed script, no warm-up job, no build step. The only
   writer is a real patient's ingestion.
2. **Every entry expires.** TTL on every key, so the store trends to empty when nobody is using it.
   A database persists; a cache decays.
3. **No enumeration.** Nothing in the app lists, searches or browses cached drugs. Reads are by
   exact key, derived from a drug named in a letter. There is no "browse medicines" surface.

---

## Sources evaluated

| #   | Source                                                                  | Access model                                                                                                           | Rate limit / latency                                            | Licence for a demo app                                                                                                                          | UK relevance                                                                                               | Verdict                                                                           |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **BNF via NICE** (`bnf.nice.org.uk`)                                    | **Geo-blocked.** HTTP 403 outside UK IPs                                                                               | n/a                                                             | **No.** Excluded from NICE's open licence; scraping explicitly prohibited                                                                       | Gold standard                                                                                              | ❌ **Blocked**                                                                    |
| 2   | **BNF/BNFC data feed** (Pharmaceutical Press / RPS / MedicinesComplete) | Commercial licence, sales contact `licensing@rpharms.com`                                                              | n/a                                                             | Commercial licence required; standard MedicinesComplete terms are non-commercial only and forbid scraping/TDM                                   | Gold standard                                                                                              | ❌ **Not in 24h**                                                                 |
| 3   | **NICE syndication API**                                                | Application → licence → API key. Organisations only; cyber-security certification; applications considered **monthly** | n/a                                                             | Separate licence                                                                                                                                | High, but **BNF is not in it**                                                                             | ❌ **Wrong content + timeline**                                                   |
| 4   | **NHS.uk medicines A-Z** (public pages, embedded schema.org JSON-LD)    | **Open, keyless, no registration**                                                                                     | 154–869 ms measured (median ~200 ms); 260 medicines             | **OGL v3.0** with attribution                                                                                                                   | **Native UK, patient-facing, plain English, carries explicit "Call NHS 111 if:" blocks**                   | ✅ **PRIMARY**                                                                    |
| 5   | **NHS Website Content API v2** (`api.nhs.uk`)                           | Subscription key — verified `HTTP 401 "Access denied due to missing subscription key"`                                 | Unknown                                                         | Same NHS content, OGL                                                                                                                           | Same as #4                                                                                                 | ⚠️ **Same data, gated. Roadmap**                                                  |
| 6   | **eMC / datapharm** (`medicines.org.uk`, SPC + PIL)                     | Site publicly fetchable (0.4–0.9 s); API only via commercial "emc market intelligence"                                 | n/a                                                             | **No.** _"must not be used, reproduced, linked to and/or sold for commercial benefit"_; forbids creating databases, re-circulating, summarising | Excellent UK PIL text                                                                                      | ❌ **Licence says no**                                                            |
| 7   | **dm+d** (NHSBSA, via NHS TRUD)                                         | Account + licence acceptance, bulk download                                                                            | n/a                                                             | TRUD licence                                                                                                                                    | UK identifiers                                                                                             | ❌ **Wrong data — it is a dictionary, contains no side-effect prose**             |
| 8   | **MHRA** (`products.mhra.gov.uk`)                                       | Public site, 200 OK                                                                                                    | n/a                                                             | Could not confirm                                                                                                                               | Same SPC/PIL corpus as eMC                                                                                 | ⚠️ **No documented API found**                                                    |
| 9   | **openFDA drug label API**                                              | **Open.** Key optional                                                                                                 | 1,000/day/IP keyless; 120,000/day with free key. 1.5 s measured | Public domain, but self-disclaims medical use                                                                                                   | **Poor.** Verified misses on paracetamol, co-codamol, flucloxacillin, co-amoxiclav, salbutamol, adrenaline | ❌ **Wrong country, wrong register**                                              |
| 10  | **DailyMed** (NLM)                                                      | **Open, keyless**, REST v2, JSON/XML                                                                                   | 2.15 s measured                                                 | US Government                                                                                                                                   | Same US SPL corpus as #9                                                                                   | ❌ **Same problem as #9**                                                         |
| 11  | **RxNorm / RxNav** (NLM)                                                | **Open, keyless**                                                                                                      | 0.94 s measured                                                 | US Government                                                                                                                                   | Useful _only_ as a UK→US name bridge                                                                       | ⚠️ **Contains no side-effect data. Not needed under the primary rec**             |
| 12  | **NHSBSA Open Data "BNF" datasets**                                     | Open CKAN API                                                                                                          | n/a                                                             | Open                                                                                                                                            | UK                                                                                                         | ❌ **Trap: BNF _classification codes_ for prescribing analytics, not monographs** |

### 1–3. The BNF: the honest answer is no

`https://bnf.nice.org.uk/drugs/apixaban/` returns **HTTP 403**, page title _"BNF is only available in
the UK | NICE"_. Its body text is unusually explicit and settles all three BNF routes at once:

> "The BNF and BNFC is third-party content hosted on the NICE site on behalf of the publishers. It
> is not [NICE content] and **is excluded from the NICE UK Open Content Licence**."
>
> "This content is only available to NHS and members of the public (**for personal reference**)
> within the UK countries of England, Scotland and Wales."
>
> "**Private sector/commercial organisations, universities and academic institutions should contact
> BNF regarding licensing subscriptions** licensing@rpharms.com or Medicines Complete."
>
> "IP addresses that are not recognised as originating from the UK will be automatically blocked and
> cannot be granted access. Similarly, **data scraping and data mining of the NICE BNF is not
> permitted** and will also result in IP blocking."

So: geo-fenced; a hackathon team is a "private sector organisation", not an eligible user; the
personal-reference permission does not extend to putting the text in an app; and scraping is named
and prohibited. Pharmaceutical Press confirms a feed exists but only through sales — _"RPS can
provide a (customisable) data feed or API for customers interested in integrating BNF and BNFC
content into their systems"_ — with contact-us as the only entry point and no published price or
turnaround. Their standard MedicinesComplete terms _"prohibit web scraping and text and data mining
of RPS websites"_.

The NICE syndication API is a different product and does not solve it: per NICE's own syndication
pages, BNF has a **separate** API and is not part of the NICE API, applications are from
**organisations not individuals**, require cyber-security certification, and are **considered
monthly**. Monthly review alone ends the conversation for a 24-hour build. _(This paragraph is from
search-result summaries of nice.org.uk — those pages 403'd my fetcher. See
[Could not confirm](#could-not-confirm).)_

**Tell the medic this plainly.** He was right that the BNF is the right _content_. It is simply not
reachable. Saying so in the pitch is a credibility gain, not a loss.

### 4. NHS.uk medicines A-Z — the find

Every page at `https://www.nhs.uk/medicines/<slug>/` embeds a single `application/ld+json` block:
a schema.org `MedicalWebPage` whose `hasPart` is a list of `HealthTopicContent` objects keyed by
`hasHealthAspect`. Retrieved from `https://www.nhs.uk/medicines/apixaban/`:

```
OverviewHealthAspect · BenefitsHealthAspect · UsageOrScheduleHealthAspect
MedicalHelpUrgentHealthAspect · SideEffectsHealthAspect
SuitabilityHealthAspect · InteractionsHealthAspect
```

Inside each aspect, `hasPart` holds `WebPageElement` objects, and — this is the whole finding — they
carry an **`identifier` field with the value `"urgent"` or `"primary"`**. Actual extracted content
for apixaban:

```
aspect=SideEffectsHealthAspect  id=urgent   "Call NHS 111 if:"
  -> "You're taking apixaban and: you have symptoms of bleeding, you've had a head
      injury, you think you might be having any other serious side effects"

aspect=SideEffectsHealthAspect  id=primary  "Speak to a pharmacist or doctor if:"
  -> "you have any side effects that bother you or do not go away ... Keep taking
      your medicine unless you're advised to stop."

aspect=UsageOrScheduleHealthAspect  id=urgent  "Get help from NHS 111 if:"
  -> "you or your child have taken more than your prescribed dose of apixaban"

(untagged, SideEffects)  "Serious side effects"
  -> "...heavy bleeding or internal bleeding. This might include: blood in your pee or
      poo; blood in your vomit or coughing up blood; bleeding in the brain – you might
      have a sudden bad headache with confusion, sensitivity to light, slurred speech,
      difficulty moving your arms or legs..."
```

That `identifier: "urgent"` block **is** the medic's "red flag side effects", already written as an
_advisory_ — "Call NHS 111 if" — never as an action the app performs. It satisfies L49 verbatim,
without us authoring a single clinical word.

**Measured across 20 slugs** (single-shot, cold): 15 present, all 200 OK, **154–869 ms, median
~200 ms**. The A-Z index at `https://www.nhs.uk/medicines/` is one 78 KB fetch yielding **260**
`/medicines/<slug>/` links.

Known slug quirks, all handled by resolving against that index rather than guessing:

- Split adult/child pages: `paracetamol-for-adults` / `-for-children`, `co-codamol-for-adults` / `-for-children`
- Split by indication: `amitriptyline-for-depression` / `amitriptyline-for-pain`
- **Coverage gaps that matter here:** `enoxaparin`, `dalteparin`, `tinzaparin` are **absent**. The
  injectable LMWHs are not in the A-Z. See [What changed](#what-changed-vs-the-prior-assumption) —
  this changes what the synthetic letter should prescribe.
- Some drugs have **no** urgent block at all (`lansoprazole`, `senna`, `docusate`, `amoxicillin`,
  `flucloxacillin`). Empty is a normal, expected result.

Licence: the JSON-LD self-declares `"license": "https://developer.api.nhs.uk/terms"` and
`copyrightHolder: Crown Copyright`. That URL now 301s (the portal retires Spring 2026); the live
authority is `https://www.nhs.uk/our-policies/terms-and-conditions/`, which states content is
_"released free-of-charge under the current version of the Open Government Licence"_, sets the
attribution wording, and requires that _"You may not directly or indirectly suggest any endorsement
or approval by the NHS of your site or service."_ See
[Safety framing](#safety-framing-and-attribution).

### 5. The official NHS Website Content API — same data, gated

Verified by direct call:

```
GET https://api.nhs.uk/medicines/apixaban
  → HTTP 401 {"statusCode":401,"message":"Access denied due to missing subscription
     key. Make sure to include subscription key when making requests to an API."}

GET https://int.api.service.nhs.uk/nhs-website-content/medicines/apixaban
  → HTTP 401 {"fault":{"faultstring":"Failed to resolve API Key variable
     request.header.apikey"}}
```

Both routes need a key we do not have. The v2 catalogue page did not state the access mode or
onboarding time, and the community onboarding thread 404'd. The content is the same as #4 under the
same OGL licence — so this is a **post-hackathon hardening step, not a blocker**. Note the platform
is mid-migration: `developer.api.nhs.uk` retires Spring 2026 and everything moves to
`digital.nhs.uk/developer`.

### 6–8. UK regulatory documents — technically reachable, contractually not

eMC serves SPCs and PILs as fetchable HTML (`/emc/product/{id}/pil`, 0.86 s), and the PIL is genuinely
good UK patient-facing text — section 4 "Possible side effects" with _"tell your doctor
immediately"_ phrasing. The licence forbids it. `medicines.org.uk/emc/privacy-notice-and-legal`:

> "The material on the site **must not be used, reproduced, linked to and/or sold for commercial
> benefit**." … Prohibited: _creating databases from downloaded material_, _re-circulating material
> to third parties without permission_, _systematic tracking of third-party information changes_,
> _summarising content for commercial purposes_.

There is no permission for third-party apps to display SPC/PIL content. `robots.txt` only disallows
`/cdn-cgi/`, but robots.txt is not a licence. Their API exists solely inside the commercial "emc
market intelligence" product over emc + dm+d. **Do not use eMC.**

dm+d via TRUD is the wrong artefact entirely: it is a _dictionary_ of medicine identifiers (VTM /
VMP / AMP, strengths, forms) and contains no side-effect prose. It would be relevant only if we
needed canonical UK drug coding, which we don't.

### 9–11. US open data — free, fast, and the wrong country

openFDA works well and fast (1.5 s, 200 OK, `adverse_reactions`, `warnings_and_cautions`,
`boxed_warning`, `information_for_patients`). It fails on the thing that matters. Live lookups on
`openfda.generic_name`:

```
paracetamol    NOT_FOUND      acetaminophen  3530 hits
co-codamol     NOT_FOUND      codeine          95 hits
flucloxacillin NOT_FOUND      amoxicillin     387 hits
co-amoxiclav   NOT_FOUND      apixaban         11 hits
salbutamol     NOT_FOUND      albuterol       133 hits
adrenaline     NOT_FOUND      epinephrine     185 hits
```

RxNav can bridge most of those (`paracetamol`→RxCUI 161 `acetaminophen`; `salbutamol`→435
`albuterol`; `adrenaline`→3992 `epinephrine`; `glyceryl trinitrate`→4917 `nitroglycerin`) but
**fails on exactly the UK combination products** — `co-codamol` and `co-amoxiclav` have no RxCUI.

Even where it resolves, the output is wrong for this product. openFDA returns 15,000-character US
_prescribing information_ written for clinicians. Juno needs a sentence a 74-year-old can act on.
And openFDA's own response envelope says:

> "**Do not rely on openFDA to make decisions regarding medical care.** While we make every effort
> to ensure that data is accurate, you should assume all results are unvalidated."

Reading that to a patient as recovery advice would be indefensible. DailyMed is the same corpus with
the same problems. **Considered and rejected on the merits, not overlooked.**

### 12. The NHSBSA "BNF" trap

`opendata.nhsbsa.net` returns 409 packages for `q=BNF` — "BNF Code Information – Current Year", etc.
These are **BNF classification codes** for prescribing-spend analytics. There are no monographs and
no side effects. Anyone Googling "BNF API" lands here. It is not the BNF.

---

## RECOMMENDATION — primary

> **Fetch the NHS.uk medicines page for each drug named in the letter, once, at ingestion time.
> Extract only the verbatim side-effect and `identifier: "urgent"` advisory blocks from the embedded
> schema.org JSON-LD. Cache each drug in Redis under a 24-hour TTL, and denormalise the resolved
> objects into the patient's plan. The voice conversation reads from the plan and performs no I/O for
> drug data at all.**

### Why this source

It is the only candidate that is simultaneously all six of:

1. **UK.** Correct drug names, correct escalation routes (111, 999, A&E, "speak to a pharmacist").
   Every US source fails here, verifiably.
2. **Patient-facing.** Written at the reading level of the person on the phone. `initial-idea.md`
   L17 makes comprehension the whole premise; an SPC would reintroduce the problem we are solving.
3. **Already advisory-shaped.** "Call NHS 111 if:" is _literally_ L49's requirement. We do not have
   to author, soften or classify anything. We read it out.
4. **Machine-structured**, with a stable-looking taxonomy and an explicit urgency flag, so the
   extraction is a filter — not an LLM.
5. **Licensed for this.** OGL v3.0. Contrast eMC (forbidden), BNF (forbidden), openFDA (permitted
   but self-disclaiming).
6. **Free, keyless, ~200 ms.** No registration, no approval, no email thread. Buildable now.

Critically, it **preserves the regulatory shield unchanged**. We are still only reformatting
someone else's words and routing to humans — the author is now the NHS instead of the discharging
surgeon, and we say so out loud. The scope-creep test in `initial-idea.md` L30 — _"Does this feature
generate new clinical judgment, or does it just move the doctor's existing words around?"_ — passes,
because nothing is generated.

### Why ingestion-time, re-weighed against durable Redis

Durable persistence makes the live-lookup option genuinely better than it was — a mid-conversation
tool call would now hit a warm cache instead of the origin. It is worth re-testing the answer rather
than restating it. The answer holds, and one of the four original reasons has to be retired:

- **Latency inside a live voice turn is still the enemy, and Redis does not remove it.** A warm
  Redis read is fast, but the expensive parts are unchanged: the ElevenLabs tool round-trip, plus the
  model re-reasoning over freshly-arrived text mid-turn. And a cache _miss_ — the first patient on a
  given drug, which in a one-patient demo is _every_ drug — still pays the full 150–870 ms to
  nhs.uk. Redis improves the average case of a path we should not be on.
- **The drug set is fully known before the conversation exists.** This is the load-bearing argument
  and Redis does not touch it. Extraction yields the medication list; that is the natural join
  point. There is no scenario where a drug appears mid-conversation that was not already in the
  letter. Fetching at ingestion is not an optimisation — it is fetching at the moment the need is
  actually known.
- ~~No database, and none needed.~~ **Retired.** This argument is obsolete and I am not going to
  pretend otherwise. Redis exists; a live-lookup design could have had a proper cache. The
  recommendation now rests on the other three.
- **Demo determinism, now stronger.** Previously "the plan JSON holds it" meant in-memory state that
  dies with the serverless invocation — honestly, a best-effort hack. With Redis the plan and its
  drug context genuinely survive across invocations and across the whole demo. The thing I was
  recommending on faith is now actually true.

A fourth reason appears that did not exist before: **Redis lets the cache be keyed by drug rather
than by patient**, so the fetch is deduplicated across patients while the _plan_ still only ever
references drugs from its own letter. That is strictly better than stuffing a private copy into
every patient record, and it is what makes the 24-hour refresh obligation below cheap to honour.

It also keeps the grounding story clean: one document per patient containing the letter's verbatim
red-flags **and** the NHS blocks, clearly separated by tier, matching `initial-idea.md` L58's
"everything traces to a source" framing.

### The cache, and why its TTL is 24 hours

The TTL is not a tuning knob. It is **derived from the licence**, and picking it correctly also
buys the stronger attribution wording. NHS terms and conditions, clause 3.7:

> "**We recommend you refresh your copy of the NHS Website Content every 24 hours** to ensure you
> have the most up-to-date version."

And clause 3.6(a) makes refresh cadence the thing that decides how you are allowed to attribute:
unmodified content that is refreshed **"at least every 7 days"** may be attributed as _"Information
from the NHS website"_; content that is **not** refreshed falls into clause 3.6(b) and must instead
carry the weaker, un-branded _"Contains public sector information licensed under the Open Government
Licence v3.0."_ — and, per 3.6(b), **must not be attributed to the NHS at all**.

So `ex: 86400` sits inside the 3.7 recommendation, comfortably inside the 7-day 3.6(a) threshold,
and means safety-critical text can never be more than a day stale. Three obligations, one number.

```
nhs:az-index:v1        → { slug: displayName }    ex: 86400   (~260 entries, no clinical content)
nhs:med:v1:<slug>      → NhsMedicine              ex: 86400   (written ONLY on a real ingestion)
plan:<patientId>       → Plan (drug data denormalised in)     (no TTL — it is the user's own data)
```

Denormalising into `plan:<patientId>` is deliberate: the conversation does **one** Redis read, not
`1 + N`. The drug-keyed entries are a fetch cache, not the read path.

**On whether the licence permits caching at all** — it does, explicitly. OGL v3.0 grants the right
to _"copy, publish, distribute and transmit the Information"_, _"adapt the Information"_ and
_"exploit the Information commercially and non-commercially"_. Nothing about storing NHS content is
prohibited; the obligations are about **refresh cadence and attribution**, which the TTL and the UI
handle. This is the sharpest practical contrast with eMC, whose terms forbid _"creating databases
from downloaded material"_ outright — under eMC's licence a Redis cache would itself be a breach.
Under OGL it is fine. That asymmetry is a large part of why NHS.uk wins.

`@upstash/redis` serialises objects to JSON automatically, so `redis.set(key, obj, { ex: 86400 })`
round-trips. Keep every timestamp an ISO **string** in the schema — the SDK does not revive `Date`
instances, and the schema below already does this.

### Explicitly rejected: having an LLM summarise a retrieved source document

This was on the table in the brief. **Do not do it.** The single property that makes third-party
drug data safe in this product is that it is _verbatim text with a URL attached_. An LLM summary is
new clinical content with a citation stapled to it — precisely the thing `initial-idea.md` L96 cut,
reintroduced through a side door and harder to spot because it looks sourced.

The guardrail that would make summarisation acceptable is per-output clinician sign-off. We have a
medic on the team, but he is generating documents and doing QA, not approving generated safety text
at runtime. So the rule is **verbatim or nothing** — and because NHS.uk is already written for
patients, verbatim costs us nothing. This is the most important call in this track.

_(One honest asymmetry: the agent speaks Urdu, so red-flag lines get translated. Translation is a
transformation of safety-critical text. It is not a new risk — the letter is already translated and
that was accepted at L68 — but keep the English original in the plan JSON and render English on the
family dashboard. Flag it in the pitch as a known limitation rather than letting a judge find it.)_

---

## Fallback plan

The drug layer is **strictly additive**. It must be possible to delete it entirely and still have a
working product. Concretely, three layers, in this order:

**Layer 0 — the product without this feature (already the plan).** Letter-only red-flag matching,
per `initial-idea.md` L86. If Track 3 delivers nothing, Juno still demos its hero beat: Margaret
mentions calf pain, the agent matches the surgeon's own red-flag line, reads it back, offers to help
her call. **Nothing downstream may depend on the drug layer existing.**

**Layer 1 — per-drug fetch returns `null`.** When a slug doesn't resolve (`enoxaparin`), or the
fetch fails, or the page has no urgent block (`lansoprazole`), the medication simply carries no
`nhs` field. The agent's behaviour is byte-identical to Layer 0 for that drug. This is not an error
path and must not log an error or surface a warning to the patient — absence of supplementary
context is the normal case for most drugs.

**Layer 2 — commit a seed snapshot for the demo.** After ingestion works, write the fetched objects
for the demo letter's drugs to `data/nhs-medicines-seed.json` and commit it. `fetchNhsMedicine`
resolves Redis → seed file → network. Cost: ~20 minutes. Benefit: the demo cannot be broken by
nhs.uk, by conference wifi, by an NHS markup change mid-hackathon, or by a cold Redis.

Keep Redis in the chain rather than replacing it with the file — the file is the floor, not the
path. And note the seed file does **not** violate the no-formulary rule: it contains only the drugs
in the one demo letter, which is exactly the on-demand per-patient set. If it ever grows to drugs no
demo patient is prescribed, it has become a formulary and must be cut back.

**If time runs out before ingestion is wired:** ship Layer 0 + the hand-checked seed file for the
demo drugs only, and say so on stage — _"the drug context is fetched from the NHS medicines A-Z at
ingestion and cached for 24 hours; for the demo it's pre-seeded."_ That is true, demonstrable, and a
roadmap item rather than a fudge. It is a better answer than a live lookup that hangs.

**Roadmap line for the pitch (one sentence, do not build):** move from the public page's embedded
JSON-LD to the credentialed NHS Website Content API v2, which serves the same OGL-licensed content
under a supported contract.

---

## Call shape

### Contract

**Input:** the drug's name as extracted from the letter, plus the surrounding plan context (dose,
route, frequency) which is **carried through for display only and never used to select content** —
the NHS page describes the medicine in general, not this prescription.

**Output:** `NhsMedicine | null`. `null` means "not in the NHS A-Z, or fetch failed" and is a normal
result, not an exception. Per `CLAUDE.md` — a network call is genuinely uncertain input and must be
modelled, so `null` in the union is correct here and a thrown error is not.

```ts
export async function fetchNhsMedicine(
  drugName: string,
): Promise<NhsMedicine | null>;
```

Resolution order inside it: `nhs:med:v1:<slug>` in Redis → committed seed file → nhs.uk. On a
network fetch, write back with `{ ex: 86400 }`. On any failure at any layer, return `null`.

**Slug resolution** (do this, don't guess slugs): read `nhs:az-index:v1` from Redis; on a miss fetch
`https://www.nhs.uk/medicines/`, extract the ~260 `/medicines/<slug>/` hrefs, and cache the index
with the same 24-hour TTL. Match the lowercased hyphenated drug name by: exact slug →
`slug.startsWith(name + "-for-")` preferring `-for-adults`. Anything unmatched returns `null`.

The index holds slugs and display names only — no clinical content — so it is a URL routing table,
not a drug database. Worth stating explicitly when someone asks whether we built a formulary.

### Zod sketch

Two schemas. The **wire schema** is the trust boundary — third-party HTML we do not control. The
**domain schema** is what the rest of the app sees. Verified against the installed `zod@4.4.3`.

```ts
// lib/nhs-medicines.ts
import { z } from "zod";

// --- wire: the schema.org JSON-LD embedded in an nhs.uk medicines page.
// Optionality here is real, not defensive: aspects and identifiers vary per drug.
const webPageElement = z.object({
  identifier: z.string().optional(),
  headline: z.string().optional(),
  text: z.string().optional(),
});

const healthTopicContent = z.object({
  hasHealthAspect: z.string().optional(),
  headline: z.string().optional(),
  hasPart: z.array(webPageElement).optional(),
});

const medicalWebPage = z.object({
  about: z.object({ name: z.string() }),
  url: z.url(),
  // NHS.uk emits "2026-01-21T17:09:00+00:00" — the offset is REQUIRED.
  // Bare z.iso.datetime() rejects it. Verified against zod 4.4.3.
  lastReviewed: z.array(z.iso.datetime({ offset: true })).optional(),
  hasPart: z.array(healthTopicContent),
});

// --- domain: what the plan JSON and the voice agent consume.
const advisoryBlock = z.object({
  headline: z.string().min(1), // "Call NHS 111 if:"      — NHS wording, verbatim
  text: z.string().min(1), //     the symptom list        — NHS wording, verbatim
  aspect: z.enum(["side-effects", "dosage", "other"]),
});

export const nhsMedicineSchema = z.object({
  slug: z.string().min(1), //            "apixaban"
  displayName: z.string().min(1), //     "Apixaban"
  sourceUrl: z.url(), //                 shown to the patient and the family
  lastReviewed: z.iso.datetime({ offset: true }).nullable(),
  commonSideEffects: z.array(z.string()), //  verbatim prose
  seriousSideEffects: z.array(z.string()), // verbatim "Serious side effects" prose
  urgentAdvice: z.array(advisoryBlock), //    identifier === "urgent"  — may be empty
  routineAdvice: z.array(advisoryBlock), //   identifier === "primary" — may be empty
  fetchedAt: z.iso.datetime({ offset: true }),
});

export type NhsMedicine = z.infer<typeof nhsMedicineSchema>;
```

### Extraction rules (get these exact — two are non-obvious)

1. **Scan every `hasPart` for `identifier === "urgent"`, not just the side-effects aspect.** Verified:
   the overdose red-flag sits under `UsageOrScheduleHealthAspect`, the side-effect red-flag under
   `SideEffectsHealthAspect`. `co-codamol-for-adults` has _only_ the `UsageOrSchedule` one — filtering
   to side-effects alone silently loses it.
2. **Record the parent aspect** (`aspect` field above) so the agent can tell an overdose warning from
   a side-effect warning. They are answers to different questions.
3. **Take nothing else from `UsageOrScheduleHealthAspect`.** The general dosing prose describes the
   medicine, not this patient's prescription — the letter owns dosing, always. Ingest the urgent
   block from that aspect and discard the rest.
4. **`urgentAdvice` is frequently empty and that is fine** (`lansoprazole`, `senna`, `amoxicillin`,
   `flucloxacillin` all have none).
5. **Never paraphrase.** Strip tags, collapse whitespace, keep the words.
6. Send a descriptive `User-Agent`. This is a handful of requests per patient, but be a good citizen.

### Where it plugs into the voice design

**Ingestion (Vercel AI SDK / AI Gateway).** Extraction is a `generateObject` call returning the
structured plan. The drug lookup is the step immediately after it — not part of the model call, and
never a tool the model can invoke:

```
generateObject(letter) → plan.medications[]
  → Promise.all(medications.map(m => fetchNhsMedicine(m.name)))
  → merge into plan.medications[].nhs
  → redis.set(`plan:${patientId}`, plan)
```

Keeping the fetch outside `generateObject` matters. If the model could call it as a tool, the model
would decide _which_ drugs to look up and could pass a name that was never in the letter. As a plain
`Promise.all` over the extracted array, the drug set is structurally guaranteed to be exactly the
letter's — which is the no-formulary rule enforced by construction rather than by prompt.

**Conversation (in-app orb).** The voice screen is an in-app two-way session, so the plan is read
server-side and passed down: a Server Component reads `plan:<patientId>` from Redis and passes the
resolved data into the existing client boundary at `components/voice/voice-session.tsx`, which
already takes a `systemPrompt` prop and applies it as a per-session override. The drug context is
composed into that prompt alongside the letter, extending the existing `lib/check-in-prompt.ts`
block. **Zero network calls for drug data at conversation time**, and no new route handler.

Note the existing prompt already carries the right instinct — _"You are not a clinician and you never
make a clinical judgement… tell them plainly to call 111 — or 999 if it sounds severe — and stop
there."_ The tiering below is that rule made precise, not a replacement for it.

Then the agent applies **strict precedence**. This ordering is the safety design; it is not a
preference.

**Tier 1 — the doctor's letter always wins.** If the reported symptom matches a red-flag line the
surgeon wrote, read _that line_ back verbatim with the letter's own contact number, exactly as
`initial-idea.md` L86 specifies. **Do not mention the drug source at all.** Stop here.

**Tier 2 — NHS block, only if Tier 1 found nothing.** If the symptom appears in that drug's
`urgentAdvice`, read the text verbatim, hedged — and **attributed differently depending on the
language**, for a licensing reason established in
[Safety framing](#safety-framing-and-attribution): under NHS terms 3.6(b), _translation into another
language_ makes content "adapted", and adapted content **must not be attributed to the NHS**.

_In English — unmodified, so NHS attribution is required and permitted:_

> "I'm not a doctor, so I'll read you what the NHS website says about your apixaban. It says:
> _call NHS 111 if you're taking apixaban and you have symptoms of bleeding, you've had a head
> injury, or you think you might be having any other serious side effects._ Would you like me to
> read that again, or shall I help you get to 111?"

_In any other language — adapted, so the NHS must not be named as the source:_

> "I'm not a doctor. The official information about your apixaban mentions this, and it says to call 111. Shall I help you do that?"

Log it. Notify the caregiver. **Never** say the drug caused the symptom.

Note what the agent recommends in both cases is the app's own universal fallback — _speak to your
doctor / call 111_ — which is Juno's wording, not NHS content. Only the **symptom list** is quoted.
That split keeps the advice stable across languages even where the quotation cannot be.

**Tier 3 — everything else: log and trend.** No commentary on the symptom whatsoever. Escalate on a
_pattern_, to a human. Per L87.

**Tier 0, always available, never gated behind any of the above:** "call your care team / call 111."

Two prohibitions to bake into the system prompt, because they are the failure modes:

- **No causal attribution.** Banned: _"your dizziness is from the amlodipine."_ Required framing:
  _"your medicine's information mentions dizziness — please speak to your doctor."_ The app reports
  co-occurrence with a source; it never asserts causation.
- **No free-form matching.** The match is against the enumerated symptom phrases in `urgentAdvice`
  and nothing else. If a model does the matching, constrain its output to _which_ enumerated block
  matched (or none) — never to prose about the symptom. A free-text answer here is a symptom checker
  with extra steps, and that was cut.

---

## Safety framing and attribution

Two obligations that mostly point the same way: the NHS licence requires specific attribution, and
the product requires that Juno never looks like the clinical authority. One place they **diverge** —
translation — is the single most important finding in this section, and it was not obvious.

### The two attribution buckets

All quotes verbatim from `https://www.nhs.uk/our-policies/terms-and-conditions/`.

**Bucket A — clause 3.6(a): unmodified English, refreshed within 7 days.** Our 24-hour TTL puts us
here. Required attribution:

> "…then you must attribute us as follows: **"Information from the NHS website"**, and "as at
> DDMMYY" if you are not refreshing your copy… The relevant attribution must be made for **every
> separate instance, use or appearance** of NHS Website Content, and in each case you must **make a
> clear distinction between NHS Website Content and your other content**."

That last clause is a licence mandate for the exact UI rule below: per-instance sourcing, and a
visible boundary between the NHS's words and ours. It is not merely good taste.

Plus, prominently: _"Information from the NHS website is licensed under the Open Government Licence
v3.0"_, with a link to the OGL where possible.

**Bucket B — clause 3.6(b): adapted, updated or non-refreshed content.** Required attribution is the
generic OGL string, **and NHS attribution is forbidden**:

> "you must include the standard attribution **"Contains public sector information licensed under
> the Open Government Licence v3.0."** … **You must not attribute the content to the NHS website or
> cite the NHS specifically as the source** of the adapted, updated or non-refreshed content."

### Translation puts Juno in Bucket B, and this is easy to get wrong

The terms enumerate what counts as an adaptation:

> "Any change to wording that serves to change its meaning or impact. Taking wording out of a context
> that is important to its meaning. **Translation into another language.**"

Juno is multilingual by design — the Urdu call is the hero demo. **Every non-English rendering of NHS
content is adapted content**, so in Urdu the app must not say "the NHS says". My own first draft of
the Tier 2 agent script said exactly that; it is corrected above. Concretely:

| Rendering                | Bucket | Attribution                                                       | May name the NHS? |
| ------------------------ | ------ | ----------------------------------------------------------------- | ----------------- |
| English, verbatim, <24h  | A      | "Information from the NHS website" + link + OGL notice            | **Yes**           |
| Any translation          | B      | "Contains public sector information licensed under the OGL v3.0." | **No**            |
| Stale (TTL lapsed, seed) | B      | Same as B, or Bucket A with "as at DDMMYY"                        | Only if dated     |

And the clause that should decide how much of this we lean on:

> "**Any adaptation of NHS Website Content or use of non-refreshed NHS Website Content may
> invalidate its formal clinical approval**; therefore if you use any such NHS Website Content you
> will bear any risk associated with such adaptation or failure to refresh."

Translating a safety-critical red-flag line voids its clinical approval and moves the risk onto us.
That is a real reason — beyond attribution mechanics — to keep the **advice** in Juno's own words
(_"please speak to your doctor, or call 111"_) and quote only the **symptom list**. Store the English
original in `NhsMedicine` regardless of display language, and render English on the family dashboard.

### Other clauses that bind us

- **3.11 — no implied endorsement:** _"You may not directly or indirectly suggest any endorsement or
  approval by the NHS of your site or service…"_ So: **no NHS logo, no NHS blue, no "NHS-approved",
  no NHS-styled chrome.** The NHS logo is excluded from the OGL anyway. Render attribution as plain
  `text-ink-muted` using the repo's own tokens.
- **3.10 — no charging for NHS content:** _"no specific charge may be levied on any customers or
  users for access to any NHS Website Content."_ Irrelevant to a free demo; a business-model
  constraint worth knowing before anyone pitches a paywall.
- **3.9 — Medical Device Legislation** is named explicitly in these terms, and Juno's whole
  regulatory shield is that it is not a medical device. Using NHS content does not change that
  — we reformat and route — but it is one more reason the Tier 1/2/3 precedence must not drift into
  triage.
- Each attribution must **link to the source page** — this is why `sourceUrl` is non-optional.

**Required by the product's safety posture:**

- **Spoken, before any drug-derived line:** in English, _"I'm not a doctor — that's from the NHS
  website, not from me."_ In any other language, _"I'm not a doctor — that's from the official
  information about your medicine, not from me."_ Sits alongside the persona line in
  `initial-idea.md` L90 and the existing rule in `lib/check-in-prompt.ts`.
- **On screen, the source line is part of the component, not a prop.** Any component rendering
  NHS-derived text renders its attribution unconditionally — Bucket A wording in English, Bucket B
  wording when translated. Make it structurally impossible to show the text without its provenance;
  that is the difference between quoting and impersonating, and clause 3.6(a) requires it "for every
  separate instance".
- **Visual hierarchy must encode precedence.** The doctor's own words are primary: full weight,
  `text-ink`, top of the card. NHS-derived content is visibly secondary — indented or set behind a
  hairline `rule`, labelled "General information about this medicine". A patient must be able to see
  at a glance which words came from _their_ surgeon.
- **Show `lastReviewed`.** It is in the JSON-LD; it tells the patient how current the advice is and
  it costs one line.
- **Never present a drug red-flag as a finding about the patient.** "Your medicine's information
  says…" — never "you may have…". The subject of the sentence is the leaflet, not the person.
- **Say all of this on stage.** _"We never generate clinical content. Everything Juno says is either
  the patient's own discharge letter or the NHS's own medicines page, read back verbatim with a
  link."_ That sentence is the pitch's strongest safety moment and it is free — the architecture
  already earns it.

---

## What changed vs the prior assumption

`plan/initial-idea.md` was written before this research and does not mention drug lookup at all; the
transcript assumed it was solved. Seven deltas:

1. **"Straight database" (transcript L51) does not exist for the BNF.** It is geo-blocked, excluded
   from NICE's open licence, requires a commercial RPS licence for a private-sector team, and
   explicitly prohibits scraping. The link the medic sent over WhatsApp is a _reading_ resource for
   him as an eligible UK clinician — it is not a data source we can build on. **This is the headline
   change and it needs to be communicated to him.**

2. **But the requirement survives intact, via a better-fitting source.** NHS.uk's medicines A-Z
   delivers exactly what L47/L49 asked for — red-flag side effects, phrased as advice to seek help —
   in plain English, under OGL v3.0, keyless, at ~200 ms. It is arguably _better_ than the BNF for
   this product: the BNF is written for prescribers, and Juno's user is a 74-year-old on the phone.

3. **The demo's clot-preventer must be apixaban or rivaroxaban, not enoxaparin/dalteparin.**
   `initial-idea.md` L129 hinges the hero moment on a missed "clot-preventer". The injectable LMWHs
   are **not** in the NHS A-Z (verified 404 for `enoxaparin`, `dalteparin`, `tinzaparin`), so that
   drug would carry no supplementary context. Apixaban and rivaroxaban are both present with rich
   urgent blocks, and apixaban's own PIL states it is _"used in adults: to prevent blood clots (deep
   vein thrombosis [DVT]) from forming after hip or knee replacement operations"_ — so this is
   clinically correct for Margaret, not a demo convenience. **Action: tell Raf to prescribe apixaban
   in the synthetic letter.** Worth confirming with him that the oral agent is the plausible choice
   for the discharge scenario he is writing.

4. **"Data to train it on" (transcript L105) is not what happens.** No model is trained or
   fine-tuned. This is retrieval of verbatim third-party text at ingestion. Worth correcting
   explicitly — it changes how the safety story is told.

5. **Transcript L44's instinct was right and stays primary.** The plan's assumption that the letter
   itself carries the side-effect information is correct and remains Tier 1. NHS data is Tier 2 —
   supplementary context for drugs the letter mentions but doesn't elaborate on. It never overrides
   the surgeon.

6. **`initial-idea.md` L109's "mock the persistence layer" no longer applies to this feature.** With
   Upstash Redis the per-drug cache is genuinely durable across serverless invocations, so the
   caching story stops being a hand-wave. The pitch line changes from _"we mocked persistence"_ to
   _"drug context is fetched once at ingestion and cached for 24 hours"_ — which is both true and a
   better answer. Note the reason the number is 24 hours is a licence obligation, not a guess.

7. **Multilingual delivery has a licensing consequence nobody had costed.** NHS terms 3.6(b) classes
   _translation_ as adaptation, so the Urdu hero demo cannot say "the NHS says" and, per the same
   clause, translated content "may invalidate its formal clinical approval". This does not block
   anything, but it changes agent copy, dashboard copy and the attribution component — and it is the
   kind of detail a judge with a health background will notice. It is cheap to get right and
   expensive to be caught on.

---

## Could not confirm

- **NICE syndication API specifics.** `nice.org.uk` returned HTTP 403 to my fetcher for
  `/reusing-our-content/nice-syndication-api`, `/corporate/ecd10/chapter/getting-started` and the
  syndication guide PDF. The claims that BNF is excluded from the NICE API, that applications are
  organisation-only, that cyber-security certification is required, and that applications are
  considered **monthly** come from search-result summaries of those pages, **not from pages I
  retrieved**. Directionally certain, exact terms unverified. Does not change the recommendation —
  the BNF block page (which I _did_ retrieve) is independently decisive.
- **BNF/BNFC commercial data-feed pricing and turnaround.** Behind `licensing@rpharms.com`. No
  published figure. I cannot state it is impossible to license in 24h — only that there is no
  self-serve path and no published SLA, which is disqualifying enough.
- **NHS Website Content API v2 onboarding process and timeline.** Verified only that both endpoints
  return 401 without a subscription key. The v2 catalogue page did not state the access mode; the
  community onboarding thread returned 404. Whether a key is self-serve or approved, and how long it
  takes, is unknown.
- **The NHS syndication Standard Licence Terms PDF** (`developer.api.nhs.uk/documents/NHS.UK
Syndication Terms 30-11-22.pdf`) 301s to `digital.nhs.uk/developer` — the document is effectively
  gone during the portal migration. The OGL v3.0 statement and attribution wording quoted above come
  from the **live** `nhs.uk/our-policies/terms-and-conditions/`, which is authoritative for the
  website content itself.
- **Whether `products.mhra.gov.uk` exposes a documented public API.** Site returns 200; no API
  documentation found.
- **Whether nhs.uk's embedded JSON-LD is a supported interface.** It is page markup, not a published
  contract. I found no NHS document that commits to its stability. Treat as observed behaviour.
- **eMC's position on non-commercial hackathon use.** Their terms turn on "commercial benefit" and
  say _"Datapharm's decision, on whether it is of commercial benefit, is final."_ I did not ask them.
  Given a clean OGL alternative exists, don't.
- **Whether NHS terms treat a 24-hour server-side cache as "refreshing your copy".** Clause 3.7
  recommends refreshing every 24 hours and 3.6(a) sets the 7-day attribution threshold, but neither
  defines "copy" for a cache-with-TTL specifically. A 24-hour TTL is a good-faith reading with a
  6-day margin on the binding threshold. Not confirmed with NHS England.
- **`@upstash/redis` exact option names** are from vendor/community documentation, not from running
  the SDK — the Upstash docs URL I tried 404'd. `redis.set(key, value, { ex: seconds })` and
  automatic JSON serialisation are well attested but were not executed in this pass. Verify on first
  use; it is a one-line check.

---

## Residual risk

**Undocumented interface.** The JSON-LD could change shape without notice. _Mitigated_ by
ingestion-time fetching, the 24-hour Redis entry and the committed seed file — a change breaks
tomorrow's ingestion, never tonight's demo. Zod parse failure must return `null`, not throw.

**Coverage.** 260 medicines. Injectables, hospital-only and most specialist drugs are absent. The
feature must degrade silently to Layer 0 and the UI must not render an empty "no information"
state — show nothing.

**Generality mismatch.** The NHS page is about the medicine, not this prescription. If dosing prose
leaks into the plan the app starts contradicting the surgeon. _Mitigated_ by extraction rule 3 —
take the urgent block from `UsageOrSchedule` and nothing else.

**Translation of safety-critical text.** Now the highest-rated residual risk, because it is both a
safety and a licensing issue and it lands squarely on the hero demo. NHS terms 3.6(b) state
adaptation _"may invalidate its formal clinical approval… you will bear any risk"_. Keep the English
original in `NhsMedicine`, render English on the family dashboard, use Bucket B attribution in every
non-English rendering, keep the recommended _action_ in Juno's own words, and name the limitation in
the pitch rather than waiting to be asked.

**Cache drifting into a formulary.** The failure mode is gradual: someone adds a seed script "so the
demo is faster", or drops the TTL "to save requests", and the cache quietly becomes the standing
drug database we said we would not build. The three guardrails in [Scope](#scope) —
no pre-population, TTL on every key, no enumeration — are the test. Any PR touching them is the one
to review.

**Attribution drift.** The moment NHS text renders without its source line, Juno becomes the
apparent author. _Mitigated_ by making the source line structural, not optional.

**Precedence inversion.** If a drug's generic NHS block fires _before_ the surgeon's specific
red-flag line, the product has inverted its own safety model. Tier 1 must short-circuit. This is the
one behaviour worth an explicit test.

**Scope creep back into triage.** Once per-drug side effects are in the plan JSON, "just have the
agent reason about them" is one prompt edit away. Guard it in the system prompt: match against the
enumerated list, emit the matched block verbatim, never reason about the symptom. `initial-idea.md`
L119 warned about exactly this pressure — _"the only remaining trap is making the voice agent do
more."_

**Combination products.** `co-codamol` / `co-amoxiclav` exist on NHS.uk but have no RxCUI. Don't
route drug-name resolution through RxNorm — resolve against the NHS A-Z index directly.

---

## URLs retrieved during this pass

| What                                                            | URL                                                                                                                                                                                   | Result                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| BNF drug page (geo-block + licence text)                        | `https://bnf.nice.org.uk/drugs/apixaban/`                                                                                                                                             | HTTP 403, full text quoted         |
| BNF/BNFC data licensing                                         | `https://www.pharmaceuticalpress.com/services/content-licensing-and-integration/information-for-prospective-data-licensing-customers-about-bnf-and-bnfc-content-on-the-nice-website/` | Retrieved                          |
| NHS.uk medicine page (JSON-LD)                                  | `https://www.nhs.uk/medicines/apixaban/`                                                                                                                                              | 200, 156–181 ms                    |
| NHS.uk medicines A-Z index                                      | `https://www.nhs.uk/medicines/`                                                                                                                                                       | 200, 260 links                     |
| NHS.uk terms — clauses 3.6(a), 3.6(b), 3.7–3.11 quoted verbatim | `https://www.nhs.uk/our-policies/terms-and-conditions/`                                                                                                                               | Retrieved, full text parsed        |
| OGL v3.0 — rights granted + attribution                         | `https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/`                                                                                                          | Retrieved                          |
| NHS Content API v2 (auth probe)                                 | `https://api.nhs.uk/medicines/apixaban`                                                                                                                                               | HTTP 401, missing subscription key |
| NHS Content API (Apigee probe)                                  | `https://int.api.service.nhs.uk/nhs-website-content/medicines/apixaban`                                                                                                               | HTTP 401, FailedToResolveAPIKey    |
| NHS Content API catalogue                                       | `https://digital.nhs.uk/developer/api-catalogue/nhs-website-content/v2`                                                                                                               | Retrieved; access mode not stated  |
| eMC legal terms                                                 | `https://www.medicines.org.uk/emc/privacy-notice-and-legal`                                                                                                                           | Retrieved, quoted                  |
| eMC PIL (apixaban)                                              | `https://www.medicines.org.uk/emc/product/102130/pil`                                                                                                                                 | 200, 0.86 s                        |
| openFDA drug label                                              | `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"apixaban"`                                                                                                          | 200, 1.49 s                        |
| openFDA rate limits                                             | `https://open.fda.gov/apis/authentication/`                                                                                                                                           | Retrieved                          |
| openFDA label docs                                              | `https://open.fda.gov/apis/drug/label/`                                                                                                                                               | Retrieved                          |
| DailyMed v2                                                     | `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=apixaban`                                                                                                      | 200, 2.15 s                        |
| RxNav                                                           | `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=paracetamol`                                                                                                                          | 200, 0.94 s, RxCUI 161             |
| NHS TRUD (dm+d)                                                 | `https://isd.digital.nhs.uk/trud/users/guest/filters/0/categories/6`                                                                                                                  | 200, account required              |
| NHSBSA open data                                                | `https://opendata.nhsbsa.net/api/3/action/package_search?q=BNF`                                                                                                                       | 200, codes only                    |
| MHRA products                                                   | `https://products.mhra.gov.uk/`                                                                                                                                                       | 200, no documented API found       |
