# 11 — Fixture corpus readiness: the medic's letters vs `ExtractedBundle`

**Date:** 2026-07-25 · **Corpus:** `fixtures/discharge-summaries/` (5 JSON +
5 PDF + 1 blank template) · **Target shape:**
`01-track-1-clinical-schema.md §Zod-4 sketch` · **Plan under test:**
`tasks/plan.md` (incl. `## ⚠️ READ FIRST` C1–C10) and `tasks/todo.md`.

---

## Scope

What this pass answers, and only this:

1. Does the landed corpus supply what `ExtractedBundle` requires, field by
   field, with the demo gold letter (`04_Sinclair_Margaret_NOF_Fracture`)
   treated as the one that matters?
2. What is the medic's `.json` actually _for_ — extraction ground truth, seed
   source, or both — and is the plan's answer coherent?
3. Are the PDFs realistic enough to extract from a photo, and is
   `SourceRef.page` meaningful?
4. What tasks are now missing or wrong in `tasks/plan.md` because the corpus
   exists?
5. Is Task A1 still sized correctly?

**Method.** Read all 10 corpus files plus the blank template. Extracted every
PDF with `pdftotext` in both `-layout` and raw mode and `pdfinfo`. Ran a
mechanical substring check of every JSON leaf string against the extracted
PDF text (whitespace-normalised) — that is the exact check
`01:1415` names as post-parse invariant 3. Read `CLAUDE.md`, `tasks/plan.md`,
`tasks/todo.md`, `00-locked-decisions.md`, `01-track-1-clinical-schema.md`,
`07-track-1-track-a-holes.md`, and `plan/medic-brief.md` (from `HEAD` — see
M20).

**Out of scope, deliberately:** NHS.uk drug-slug resolution (owned
elsewhere; nhs.uk was not probed), Track B, and anything that would require
writing feature code. **No file other than this one was created or
modified.** Every plan change below is a quoted patch, not an edit.

---

## Corpus at a glance

| #   | Patient            | `episode.kind` | `procedureDate` | Pages | Anticoagulant     |
| --- | ------------------ | -------------- | --------------- | ----- | ----------------- |
| 04  | Sinclair, Margaret | `surgical`     | `2026-07-15`    | 2     | **Enoxaparin** 🔴 |
| 01  | Clarke, Emma       | `surgical`     | `2026-07-21`    | 2     | none              |
| 02  | Whitfield, Harold  | `medical`      | `null`          | 2     | Apixaban          |
| 03  | Okafor, David      | ambiguous 🟡   | `2026-07-20`    | 2     | none (DAPT)       |
| 05  | Bradley, Susan     | `medical`      | `null`          | 2     | none              |

`episode.kind` evidence:

- **04 Sinclair** — `"operations_and_procedures": "Left cemented
hemiarthroplasty (15/07/2026) under spinal anaesthetic, uncomplicated."` →
  `surgical`.
- **01 Clarke** — `"Laparoscopic cholecystectomy (21/07/2026),
uncomplicated."` → `surgical`.
- **02 Whitfield** — `"operations_and_procedures": "None."` → `medical`,
  `procedureDate: null`.
- **05 Bradley** — `"operations_and_procedures": "None."` → `medical`,
  `procedureDate: null`.
- **03 Okafor** — `"Coronary angiogram + PCI to proximal RCA with drug-eluting
stent (20/07/2026), radial access, uncomplicated."` A percutaneous
  intervention is not surgery, but it _has_ a procedure date, and `01:1183`
  makes the real discriminator explicit: _"A medical admission has no
  procedure and no wound; it is the same record with `procedureDate` null."_
  By that rule it is `surgical`. **Nothing written down says so** — see M13.

**Good news first:** the corpus genuinely proves the schema is not
surgery-shaped (3 surgical, 2 medical). `01 §R7`'s "linear-medical" worry is
answered by Whitfield and Bradley. That was the single biggest structural
risk to the schema and it is now retired.

**All five letters are the same blank template with values typed in.** The
form has 18 top-level keys and is identical across all five. That means every
gap below is a gap in _all five_ letters, not a quirk of one.

---

## Field-by-field coverage table

Legend: ✅ supplied · ◐ partial (present but needs inference, parsing, or
authoring) · ✗ absent from the corpus entirely.

All quotes are from **04 Sinclair** unless stated. Quotes marked **[PDF]**
are copied from `pdftotext -layout` output and are safe to paste into a
`SourceRef.quote`. Quotes marked **[JSON-only]** exist in the `.json` but
**do not survive linear text extraction of the PDF** — see M3.

### Root

| Field                     | Status | Evidence / what the dev must do                                                                                                                        |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`           | ✅ n/a | Constant. Land as `"portico-extract/1"` per **C8**, not `"juno-extract/1"`.                                                                            |
| `documents[]` (`.min(1)`) | ◐      | One document, `kind: "discharge_summary"`, `capture: "pdf"`, `pageCount: 2`. `blobUrl` / `blobPathname` are **not in the corpus at all** — see **M4**. |
| `patient`                 | ◐      | See below.                                                                                                                                             |
| `episode`                 | ✅     | See below.                                                                                                                                             |
| `contacts[]`              | ◐      | Labels yes, phone numbers **no**. See **M5**.                                                                                                          |
| `medications[]`           | ◐      | Best-covered section. Six rows. See below.                                                                                                             |
| `instructions[]`          | ◐      | Thin. Counselling _summaries_, not patient-directed steps. See **M14**.                                                                                |
| `appointments[]`          | ◐      | Two promised follow-ups, zero booked slots. See below.                                                                                                 |
| `redFlags[]`              | ◐ 🔴   | **The weak point of the gold letter.** See below.                                                                                                      |
| `extraction.unresolved[]` | ✗      | Zero coverage — nothing is illegible, ambiguous or missing. See **M7**.                                                                                |
| `extraction.conflicts[]`  | ◐      | Exactly one candidate exists, and it is a good one. See below.                                                                                         |

### `documents[]` — `SourceDocument`

| Field                      | Status | Evidence                                                                                                                                                                                                                     |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | ✅ n/a | Dev-assigned (`"doc_1"`).                                                                                                                                                                                                    |
| `kind`                     | ✅     | `"discharge_summary"`. **[PDF]** `"Discharge Summary USE BLACK INK ONLY"`. Only 1 of the 8 enum members has a fixture; `appointment_letter`, `wound_care_advice`, `physio_advice`, `medicine_label`, `alert_card` have none. |
| `displayName`              | ✅ n/a | Dev-assigned.                                                                                                                                                                                                                |
| `capture`                  | ◐      | `"pdf"` only. `"photo"` and `"scan"` untested by this corpus (see PDF findings).                                                                                                                                             |
| `pageCount`                | ✅     | `2`, confirmed by `pdfinfo` and by the letter's own **[PDF]** `"Page 1 of 2"` / `"Page 2 of 2"` footers.                                                                                                                     |
| `blobUrl` (`z.url()`)      | ✗      | Non-nullable, and there is no upload in the seed path. `01:1630` says a `file:///fixtures/...` string passes `z.url()` — but that guidance lives in `§R7`, a section about throwaway dev samples that no task cites. **M4.** |
| `blobPathname` (`.min(1)`) | ✗      | Same. And a `file:///` value **breaks A9**, whose source-trace route calls `get(pathname, { access: "private" })` (C5). **M4.**                                                                                              |

### `patient`

| Field               | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `givenName`         | ✅     | **[PDF]** `"Forename Margaret"` → `"Margaret"`.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `preferredLanguage` | ✗      | Always `null`. **The blank template has no communication-needs section at all** — verified against `NHS Discharge Summary Template (corrected).pdf`. `01`'s expectation that this comes from the eDischarge "Individual requirements" heading does not apply to this form. **M16.**                                                                                                                                                                             |
| `redactedByPolicy`  | ✅     | Field names available to drop: `surname`, `sex`, `date_of_birth`, `nhs_or_hospital_number`, `address`, `telephone`, `gp_details`. Note the JSONC example lists `"safetyAlerts"`; this form's nearest analogue is `relevant_legal_information` — **[PDF]** `"Mild cognitive impairment but retained capacity to consent to surgery/discharge planning; no DoLS or IMCA required."` That is V10-class content and must be redacted under a differently-named key. |

### `episode`

| Field                     | Status | Evidence                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                    | ✅     | `"surgical"`.                                                                                                                                                                                                                                                                                                                 |
| `titleVerbatim`           | ◐      | **[JSON-only]** `"Left cemented hemiarthroplasty (15/07/2026) under spinal anaesthetic, uncomplicated."` In the PDF this wraps mid-sentence in the right column and is interleaved with the left column's diagnosis text. A safe **[PDF]** substring is `"Left cemented hemiarthroplasty (15/07/2026) under spinal"`. **M3.** |
| `titlePlain`              | ✅ n/a | Generated (I6). E.g. "Surgery to replace the top of your left thigh bone".                                                                                                                                                                                                                                                    |
| `dischargeDate`           | ✅     | **[PDF]** `"Date of Discharge 25/07/2026"` → `"2026-07-25"`. **Format conversion DD/MM/YYYY → ISO is required on every date in the corpus and no task owns it (M4).**                                                                                                                                                         |
| `procedureDate`           | ◐      | `"2026-07-15"`, but **there is no procedure-date field on this form** — it is embedded in the free-text `operations_and_procedures` prose. Must be parsed out.                                                                                                                                                                |
| `dischargingTeamVerbatim` | ✅     | **[PDF]** `"Discharging Speciality/ Department T&O/Orthogeriatrics"`, plus **[PDF]** `"Discharging Consultant Mr A. Chalmers"`.                                                                                                                                                                                               |
| `source` (`SourceRef?`)   | ◐      | Satisfiable on page 1, but note the audit's own JSONC example quote (`"Date of discharge: 20/07/2026   Procedure: ..."`) is a **concatenation across two form cells in different columns** and would fail invariant 3. Do not copy that pattern.                                                                              |

### `contacts[]` — 🔴 the structural hole

| Field           | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `labelVerbatim` | ◐      | Nameable: the GP (**[JSON-only]** `"Dr L. Marsh, Fleet Road Surgery"` — wraps across columns in the PDF as `"G.P. Details Dr L. Marsh,"` / `"Fleet Road Surgery"`), the rehab unit (**[PDF]** `"Fleet Grange"`), and **[JSON-only]** `"Fleet Grange / District nurses"`. No ward, no specialist team, no out-of-hours line.                                                                                                             |
| `phone`         | ✗ 🔴   | **There is not one callable clinical phone number anywhere in the corpus.** Grep across all five PDFs returns only patient/NOK numbers (`01252 334 5567`, `07890 123456`, `0118 496 2233`, `01256 778 3345`, `07712 345678`, `01483 556 9012`, `01252 611 7789`) and the discharging doctor's internal **[PDF]** `"Bleep No. 4456"`, which is not patient-dialable. **04 Sinclair does not contain the strings `999` or `111` at all.** |
| `channel`       | ◐      | Derivable (`gp`, `district_nurse`) but thin. `999`, `111`, `ward`, `pharmacy`, `specialist_team` have no instance in the gold letter.                                                                                                                                                                                                                                                                                                   |
| `hoursVerbatim` | ✗      | Zero instances. `plan/medic-brief.md §5` explicitly asked for the "three numbers for one symptom list, split by hours" shape ("_write it that way — we handle it_"). It was not delivered.                                                                                                                                                                                                                                              |
| `source`        | ◐      | Non-nullable. Satisfiable, subject to M3.                                                                                                                                                                                                                                                                                                                                                                                               |

### `medications[]` — best covered, but with two hard blockers

The Sinclair discharge-medications table, exactly as it appears **[PDF]** on
page 2 (this is the whole of what the form gives per drug):

```
Discharge Medications          Dose     Frequency  Route  Duration            Quantity Supplied
Paracetamol 1g                 1 tab    QDS        Oral   Regular             28 tabs
Oxycodone IR 5mg               1 tab    QDS PRN    Oral   1 week then review  20 tabs
Alendronic acid 70mg           1 tab    Weekly     Oral   Ongoing             4 tabs
Adcal-D3                       1 tab    BD         Oral   Ongoing             56 tabs
Amlodipine 5mg                 1 tab    OD         Oral   Ongoing (reduced)   28 tabs
Enoxaparin 40mg                1 inj    OD         SC     To day 28 post-op   14 syringes
```

| Field                    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nameAsWritten`          | ✅     | Six rows above, with strength baked into the name.                                                                                                                                                                                                                                                                                                       |
| `lookupKey.*`            | ◐      | Derivable (`"alendronic acid"` / `"tablet"` / `"70 mg"`). But see **M1** — the demo's clot-preventer is enoxaparin, which D6 forbade.                                                                                                                                                                                                                    |
| `doseDirectionsVerbatim` | ✗ 🔴   | `.min(1)`, **never null**, described in `01` as "the national standard's primary field" and "what the voice agent reads aloud". **This form has no free-text directions field.** There is no `"Take ONE tablet once daily"` sentence anywhere in the corpus. Any value the dev writes is a concatenation of five table cells, i.e. not verbatim. **M2.** |
| `dose`                   | ✅     | `"1 tab"` / `"1 inj"`. (Note `-layout` collapses `"2 puffs"` → `"2puffs"` in 02 and 05.)                                                                                                                                                                                                                                                                 |
| `route`                  | ✅     | `"Oral"`, `"SC"`, `"Inhaled"`, `"Sublingual"`.                                                                                                                                                                                                                                                                                                           |
| `schedule.timesPerDay`   | ◐ 🔴   | `QDS`→4, `BD`→2, `OD`→1. **`Weekly` (alendronic acid 70mg) cannot be expressed** — `Medication` has no `everyDays`; only `Instruction.recurrence` does. Encoding it as `null` makes `buildTimeline` render a weekly bisphosphonate as either a daily task or no task. **M10.**                                                                           |
| `schedule.timesOfDay`    | ✗      | Correctly `[]` everywhere — the letter never states a time of day. This is the good case: it matches the JSONC's `absent_from_bundle` `unresolved` entry exactly, and it is the corpus's only honest `unresolved` source.                                                                                                                                |
| `schedule.verbatim`      | ✅     | `"QDS"`, `"QDS PRN"`, `"Weekly"`, `"BD"`, `"OD"`, `"Nocte"`, `"PRN"`, `"TDS PRN"`. **All clinical abbreviations. Nothing expands them for patient display or for the voice agent — M12.**                                                                                                                                                                |
| `withFood`               | ✗      | `"not_stated"` for all six. Correct per schema. (Alendronic acid has real food/posture rules; the letter does not state them, so we must not either.)                                                                                                                                                                                                    |
| `duration.start`         | ✗      | No letter gives a start anchor. Honest value is `null`; synthesising `{ kind: "offset", from: "discharge", days: 0, verbatim: "from discharge" }` invents a verbatim that is not in the document and fails invariant 3.                                                                                                                                  |
| `duration.end`           | ◐      | See DateAnchor section — `"1 week then review"`, `"To day 28 post-op"`, `"Ongoing"`, `"Regular"`, `"Ongoing (reduced)"`.                                                                                                                                                                                                                                 |
| `changeStatus`           | ◐      | Not per-row. Only prose: **[PDF]** `"Amlodipine dose reduced (postural hypotension). Co-codamol changed to paracetamol+short course oxycodone post-op, to be weaned."` → amlodipine `amended`, oxycodone/paracetamol `added`, and **co-codamol is `stopped` but has no table row at all**. Requires clinical inference per row.                          |
| `changeNoteVerbatim`     | ✅     | The sentence above, for the two rows it names.                                                                                                                                                                                                                                                                                                           |
| `indicationVerbatim`     | ◐ 🔴   | **The form has no indication column.** Sinclair yields exactly two: **[PDF]** `"Bone health assessed, bisphosphonate/vitamin D started."` and **[PDF]** `"For GP: continue bone protection (alendronic acid + AdCal D3) long-term"` — both for the bone drugs. Paracetamol, oxycodone and **enoxaparin have no stated indication at all**.               |
| `purposePlain`           | ◐ 🔴   | Hard rule: `null` whenever `indicationVerbatim` is `null`. So on the demo screen, **4 of 6 drugs — including the anticoagulant — render "your letter doesn't say what this is for"**. That is the honest behaviour and it is also a weak demo. Worth a conscious call, not a discovery at hour 18.                                                       |
| `escalationClass`        | ✗ 🔴   | `"letter_flagged"` has no instance — no letter flags anything. So every row must be `"configured_class_list"`, and **that list does not exist and no task creates it**. `plan/medic-brief.md §5` asked the medic for it ("_Two-minute job for you_"); it was not delivered. **M6.**                                                                      |
| `enteredBy`              | ✅ n/a | `"extracted"`.                                                                                                                                                                                                                                                                                                                                           |
| `source`                 | ◐      | `page: 2` for every medication. Table-cell quotes are fragile under `-layout` (see M3).                                                                                                                                                                                                                                                                  |

### `instructions[]`

| Field            | Status | Evidence                                                                                                                                                                                                                                                                                             |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`           | ◐      | Only `wound_care` (staple removal) and `other` are reachable. **`activity`, `exercise`, `appointment_prep` have no source in the corpus.**                                                                                                                                                           |
| `detailVerbatim` | ◐      | Real ones exist, but they are third-person _counselling summaries_, not patient-directed steps: **[PDF]** `"Both counselled on hip precautions, falls-prevention at home, and bone-health medication compliance."` and **[PDF]** `"Arrange staple removal by 27/07/2026 if not done at rehab unit."` |
| `anchor`         | ◐      | See DateAnchor.                                                                                                                                                                                                                                                                                      |
| `recurrence`     | ✗      | **Zero instances across all five letters.** Nothing repeats. `everyDays` is non-nullable inside `recurrence`, and A3's `buildTimeline` recurrence branch has no fixture at all. **M14.**                                                                                                             |
| `actor`          | ✅     | Genuinely well served, and it preserves V9: staple removal is done by the rehab unit / district nurses → `actor: "clinician"`. The voice agent must not ask Margaret whether she removed her own staples.                                                                                            |
| `contactIds`     | ◐      | Mostly `[]` — see contacts.                                                                                                                                                                                                                                                                          |

**Critical caveat for whoever writes A1:** the three exemplar instructions in
`01`'s JSONC (dressing/clip removal, driving at ~6 weeks, short walks 3–4×
daily) all came from a **wound-care advice leaflet**. The corpus contains no
leaflets — only the discharge-summary form. Those three items have **no
analogue in the corpus** and must not be copied into the seed. See M19.

### `appointments[]`

| Field              | Status | Evidence                                                                                                                                                                                                                                  |
| ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withVerbatim`     | ✅     | **[JSON-only]** `"Orthopaedic OP follow-up in 6 weeks with hip X-ray; Fracture Liaison Service follow-up for osteoporosis."` (wraps across three table lines in the PDF). Person responsible **[JSON-only]** `"Mr Chalmers' team / FLS"`. |
| `when` (non-null)  | ◐ 🔴   | Only `"~05/09/2026"` — a **tilde-prefixed approximate absolute date**. `DateAnchor`'s `date` variant has **no `approximate` flag**; only `offset` does. So the letter's own hedge cannot be encoded. **M9.**                              |
| `locationVerbatim` | ✗      | Zero instances across the corpus. Always `null`.                                                                                                                                                                                          |
| `isBooked`         | ◐      | `false` for every appointment in every letter. **No booked slot with a time exists anywhere in the corpus**, so `when.time` is `null` everywhere and the `isBooked: true` path is untested.                                               |
| `contactIds`       | ✗      | `[]`.                                                                                                                                                                                                                                     |

### `redFlags[]` — do the letters contain quotable trigger/action pairs?

**Answer: 04 Sinclair is the weakest of the five letters on exactly this
axis.** Its one safety-netting sentence names symptoms but **names no
recipient**:

> **[PDF]** `"Advised to seek urgent review for worsening pain, wound issues,
fevers or new inability to weight-bear."`

That is the complete set of red-flag material in the gold letter. Splitting
it into the required pair gives:

- `triggerVerbatim`: `"worsening pain, wound issues, fevers or new inability
to weight-bear"`
- `actionVerbatim`: `"Advised to seek urgent review"`

Per I7, `escalationChannel` is a function of `actionVerbatim`'s named
recipient **only**. "seek urgent review" names nobody, so the only honest
value is `"other"`, and `contactIds` is `[]` because there is no contact with
a number. The other quotable-adjacent lines are counselling, not red flags:

> **[PDF]** `"Both counselled on hip precautions, falls-prevention at home,
and bone-health medication compliance."`
>
> **[PDF]** `"Family/rehab staff aware of falls and cognitive history;
escalation plan discussed with son."`

**The four QA letters all have better pairs than the gold letter:**

| Letter       | `triggerVerbatim` / `actionVerbatim` — **[PDF]** verbatim                                                                                                            | Channel |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 03 Okafor    | `"Advised to call 999 for recurrent chest pain unrelieved by GTN."` — clean pair, named recipient                                                                    | `999`   |
| 05 Bradley   | `"Advised to contact GP/111 if breathless, feverish or coughing blood; call 999 if severe."` — a **ladder**, the exact "take the most urgent rung" case I7 describes | `999`   |
| 01 Clarke    | `"Told to return to A&E if fever, worsening pain, jaundice or wound discharge/redness."` — named destination                                                         | `other` |
| 02 Whitfield | `"Advised to seek urgent help if breathless, feverish or confused again."` — vague, same failure as Sinclair                                                         | `other` |

So the corpus _does_ contain properly-shaped red-flag pairs — just not in the
letter the demo is locked to. This is **M5**, and it is a decision for a human
before A1 is written.

`matchHints` is generated (I6) and needs no corpus support.
`triggerFr` / `actionFr` (P2) must be hand-authored — with one vague red flag
on the gold letter, that is now a ~10-minute job, not a risk (**M17**).

### `extraction.unresolved[]` / `conflicts[]` / `readConfidence`

- `readConfidence: "unclear"` — **zero instances possible.** All five PDFs are
  born-digital with a perfect text layer. Nothing is illegible.
- `unresolved[]` — the only honest entries available are
  `reason: "absent_from_bundle"` for `schedule.timesOfDay` (six of them) and
  for missing indications. **No `illegible`, no `ambiguous`, no
  `conflicting_sources` instance exists.** `01 §R7` specified a `degraded.txt`
  fixture precisely for this, and the plan dropped it when the corpus landed.
  **M7.**
- `conflicts[]` — **exactly one candidate, and it is genuinely good:**
  Enoxaparin is **[PDF]** `"To day 28 post-op"` with **[PDF]**
  `"14 syringes"` supplied. A 28-day once-daily course dispensed as 14 doses
  is a real internal inconsistency. `Conflict.positions` requires `.min(2)`
  but places no distinctness constraint on `documentId`, so both positions can
  cite `doc_1` at `page: 2`. This is the one place the honesty channel can be
  demonstrated from the corpus as it stands.

### `SourceRef` — is a non-nullable quote satisfiable from these PDFs?

**Yes for a vision model reading the page. No for the mechanical check the
plan specifies.** These are different questions and the plan conflates them.

`01:1415` post-parse invariant 3:

> Every `SourceRef.quote` is a substring of the text extracted from the
> document it names (whitespace-normalised).

I ran exactly that check — every JSON leaf string against `pdftotext -layout`
output, whitespace-normalised. Results:

| Letter       | JSON leaf strings not found verbatim in the PDF text |
| ------------ | ---------------------------------------------------- |
| 04 Sinclair  | **9 / 83 (11%)**                                     |
| 01 Clarke    | 4 / 59 (7%)                                          |
| 02 Whitfield | 8 / 89 (9%)                                          |
| 03 Okafor    | 7 / 89 (8%)                                          |
| 05 Bradley   | 8 / 89 (9%)                                          |

The Sinclair failures, and why each fails:

| Field                                      | Cause                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `patient_details.address`                  | Two-column header: address line 2 is separated from line 1 by `"Date of Discharge 25/07/2026"`.   |
| `admission_and_gp_details.gp_details`      | Same — `"G.P. Details Dr L. Marsh,"` and `"Fleet Road Surgery"` are separated by `"Tel No. ..."`. |
| `diagnosis_at_discharge`                   | Left column wraps and is interleaved with the right column's `operations_and_procedures`.         |
| `operations_and_procedures`                | Same, mirror image. **This is `episode.titleVerbatim`'s source.**                                 |
| `actions_and_outstanding_investigations.*` | Four fields — the follow-up table wraps cells across three physical lines each.                   |
| `discharging_doctor.print_name`            | Rendered with dot-leader fill: `"Mr_ _A._ _ _ _ Chalmers (ST5)"`.                                 |

Raw (no `-layout`) mode does not fix this — it splits each column cell into
its own paragraph, so the address still breaks. And `-layout` introduces its
own corruption: `"2 puffs"` renders as `"2puffs"` in 02 and 05, so the JSON's
own `"dose": "2 puffs"` is unfindable.

**Consequences, all real:**

1. Invariant 3 will produce **false `unresolved` entries** on correct
   extractions, on the demo letter, in the demo path.
2. **No task defines how "the text extracted from the document" is
   produced.** A6 sends PDF/image bytes to a vision model (C5: bytes inline,
   never a URL); it never produces a reference text stream. So the invariant
   as written has no implementation and no owner. **M3.**
3. **A1 must not lift `SourceRef.quote` values from the `.json`.** The obvious
   move — copy the JSON string — puts unverifiable quotes into the seed on 11%
   of fields.

`SourceRef.page` **is meaningful and load-bearing** — see PDF findings.

### `DateAnchor` — real examples of each variant

All three variants exist in the corpus. The base date for `offset` is
**provably `discharge`**, which is worth knowing before writing the seed:

| Letter | Discharge  | Stated offset  | Stated date   | Δ days       |
| ------ | ---------- | -------------- | ------------- | ------------ |
| 04     | 25/07/2026 | "in 6 weeks"   | `~05/09/2026` | **42** ✓     |
| 02     | 25/07/2026 | "in 6 weeks"   | `~05/09/2026` | **42** ✓     |
| 03     | 23/07/2026 | "in 6 weeks"   | `~03/09/2026` | **42** ✓     |
| 05     | 25/07/2026 | "in 6-8 weeks" | `~15/09/2026` | 52 (42–56) ✓ |

The medic's arithmetic is internally consistent and anchored on the discharge
date, not the procedure date. Use `from: "discharge"`.

**`kind: "offset"`** — plentiful:

- **[JSON-only]** `"Orthopaedic OP follow-up in 6 weeks with hip X-ray"` →
  `{ from: "discharge", days: 42, daysUntil: null, approximate: true }`
- **[PDF]** `"To day 28 post-op"` (enoxaparin) →
  `{ from: "procedure", days: 28, daysUntil: null, approximate: false }`
  (15/07/2026 + 28 = 12/08/2026)
- **[PDF]** `"1 week then review"` (oxycodone) →
  `{ from: "discharge", days: 7 }`
- **Ranged** (05) **[JSON-only]** `"Respiratory OP follow-up in 6-8 weeks with
spirometry"` → `{ days: 42, daysUntil: 56 }` — the `daysUntil` field's only
  real fixture, and it is on a QA letter, not the gold one.
- Ranged, 03: `"Check U&E and lipid profile in 4-6 weeks"`,
  `"recheck lipids in 6-8 weeks (target LDL<1.4)"`.
- 02: `"Recheck U&E and CRP in 1 week"`, `"Within 2 weeks"`.
- 03: `"DVLA driving restriction (1 week)"`.

**`kind: "date"`** — sparse and all hedged:

- **[PDF]** `"Arrange staple removal by 27/07/2026 if not done at rehab
unit."` → `{ date: "2026-07-27", time: null }`. **But it is also
  conditional** — see below.
- `"~05/09/2026"` / `"~03/09/2026"` / `"~15/09/2026"` — every absolute
  follow-up date in the corpus carries a tilde. `DateAnchor.date` has no
  `approximate` flag, so encoding these as `kind: "date"` asserts a precision
  the clinician explicitly denied with their own punctuation. **M9.**
- `time` is `null` in every instance — no appointment slot exists.

**`kind: "conditional"`** — plentiful, and the best examples are on QA
letters:

- **[PDF]** `"Ongoing"` (alendronic acid, Adcal-D3 duration).
- **[PDF]** `"Ongoing (reduced)"` (amlodipine).
- **[PDF]** `"Regular"` (paracetamol).
- **[PDF]** `"Ongoing"` (community services follow-up date).
- 02 Whitfield, the textbook case: **[PDF]** `"WITHHELD-GP review"` as a
  medication `Duration`, plus **[PDF]** `"Ramipril withheld - review and
restart once renal function stable"`.
- 03 Okafor: `"continue dual antiplatelets 12 months post-PCI - do not stop
early without cardiology input"`.
- 01 Clarke: `"Suture/glue check at day 5 if any concerns"`.

**Two modelling problems the corpus exposes and Phase 0 has not decided:**

1. **`"Ongoing"` has two equally defensible encodings** — `duration.end:
null` (nothing to compute) or `{ kind: "conditional", verbatim: "Ongoing" }`
   (preserve the word). Two devs will pick differently and A3's
   `buildTimeline` branches on it. **M11.**
2. **The union is exclusive but the corpus has hybrids.** `"Arrange staple
removal by 27/07/2026 if not done at rehab unit"` is date **and** condition.
   `"Suture/glue check at day 5 if any concerns"` is offset **and** condition.
   `DateAnchor` forces a lossy choice. **M9.**

---

## What the gold JSON is for

**The plan says both, in different places. Both uses are legitimate, but the
plan does not state the rule that keeps them from corrupting each other — and
without that rule the seed will be written wrongly.**

The evidence:

- `plan/medic-brief.md §2` is unambiguous that it is **(a) ground truth**:
  > "we ingest the **letters** (photos / PDFs). Your JSON is what we check our
  > extraction _against_ — the answer key. If we ingested your JSON directly
  > we'd be skipping the entire extraction step."
- `01 §R8` operationalises exactly that: _"run extraction over his PDFs, then
  diff the result against his JSON on five fields — medication names, dose
  directions, course durations, red-flag lines, appointment dates. Not a
  structural diff (his shape will differ), a hand-mapped one."_
- `tasks/plan.md:411` and `tasks/todo.md:118` say **(b) seed source**: "Form
  JSON → `ExtractedBundle`".
- `tasks/plan.md` A6 acceptance says **(a)** again: "spot-check each against
  its sibling form JSON (not `ExtractedBundle`)".

**Is that coherent? For four of the five letters, yes.** Clarke, Whitfield,
Okafor and Bradley are only ever answer keys; nothing seeds from them. Their
diff is a clean, quotable measurement.

**For Sinclair it is coherent only with a rule the plan does not state, and is
misleading without one.** Two specific problems:

1. **A measurement problem.** If A1 transcribes Sinclair's JSON into the seed
   and A6's QA diff then compares Sinclair extraction against that same JSON,
   the number is not independent. It is still a valid _correctness_ check —
   the JSON is genuinely derived from the letter — but "our extraction matches
   the doctor's answer key" is only an honest **demo claim** on 01/02/03/05.
   Say that out loud, or someone will put the Sinclair number on the slide.
2. **A correctness problem, and this is the one that bites.** The two roles
   demand different source material. As an answer key, the JSON supplies
   _facts_. As a seed source it would also have to supply _strings_ — and
   `ExtractedBundle`'s `*Verbatim` fields and `SourceRef.quote` are defined as
   verifiable against the **document**, not against the answer key. 11% of
   Sinclair's JSON strings do not appear in the PDF text at all.

**The rule the plan is missing, stated precisely:**

> The `.json` supplies **facts and field mapping**. The `.pdf` supplies
> **strings**. Every `*Verbatim` value and every `SourceRef.quote` in
> `lib/plan/samples/demo-plan.ts` is copied from the PDF, never from the JSON.
> The JSON is the answer key for A6's diff and is never re-read at render
> time.

With that rule, the answer to the question is **(c) both** — and coherent.
Without it, (b) silently poisons the seed's provenance.

**One more thing the framing hides:** the JSON does not make A1 a
transcription task. Roughly 40% of `ExtractedBundle`'s clinically-loaded
fields have no source in the form at all (`doseDirectionsVerbatim`,
`indicationVerbatim`, `purposePlain`, `escalationClass`, `duration.start`,
`contacts[].phone`, `triggerFr`/`actionFr`, `matchHints`, `titlePlain`). Those
must be **authored**. See the sizing section.

---

## PDF findings

**Structure.** All six PDFs (5 letters + blank template) are **2 pages**,
612×792 pt. Metadata is identical across all six: `Title: Discharge Summary
template`, `Author: IT Support Royal College of`, `Creator: Acrobat PDFMaker
9.0 for Word`, `Producer: macOS Version 26.3.1 ... Quartz PDFContext`,
`Tagged: yes`, `Form: none`. They are the RCP/NHS discharge-summary template
with values typed in and re-exported.

**Are they visually realistic NHS discharge letters?** **Yes, as forms.** The
template is real: ruled two-column header, `"USE BLACK INK ONLY"`, a
re-identification band at the top of page 2, a discharge-medications table
with proper column headers, a pharmacy dispensed/checked block, a signature
block with a grade selector and bleep field, and `"Page 1 of 2"` /
`"Page 2 of 2"` footers. A clinician would recognise it immediately.

**Will they extract well from a photo? Two caveats, both material to A6:**

1. **They have never been through a camera.** Born-digital, perfect text
   layer, no skew, no glare, no shadow, no fold, no staple, no handwriting,
   no wonky angle. `plan/medic-brief.md §5` explicitly asked for that
   ("_Messy is good... handwriting or a wonky photo angle... Don't sand it
   smooth_") and it was not delivered. **A6's photo path — the actual demo
   input — is untested by this corpus.** Somebody must physically photograph
   the Sinclair PDF and re-run extraction before the demo. No task says so.
2. **Page 1 is dense.** Two columns of ~9pt text on US Letter. A phone photo
   of page 1 at typical hand-held distance will put the smaller table cells
   near the legibility floor. Page 2's medication table is more forgiving.

Minor: 612×792 is **US Letter, not A4** (595×842). Cosmetic only, but a
British clinician looking closely would notice.

**Content in the PDF that the JSON does not carry** (a vision model will see
all of it):

- Trust header, both pages: `"St Elsewhere and Somewhere Hospitals"` /
  `"NHS Trust"`.
- Form title, both pages: `"Discharge Summary USE BLACK INK ONLY"`.
- Page footers: `"Page 1 of 2"`, `"Page 2 of 2"`.
- **Page-2 re-identification band** — `Name` / `D.O.B` / `NHS/ Hosp No.`
  repeated: `"Margaret Sinclair    03/01/1947    654 128 7743"`. Directly
  relevant to `patient.redactedByPolicy`: the identifiers appear **twice**.
- Blank signature line: `"Doctors Signature _ _ _ _ _ _ _ _ ..."`.
- **Uncrossed option lists that a model may read as data** — `"Grade FY/ ST<
3/ ST> 3/ SpR/ Con"`, `"Compliance aid? Dossette/ Nomad/ Other"`,
  `"Medications Stopped/ Changed   Yes/ No"`, `"M / F/ (Female)"`. The grade
  list is the trap: the answer (`ST5`) is in the print-name field, not here.
- Med-table column headers and the parenthetical `"Quantity Supplied
(Pharmacy used)"`.
- Form field hints: `"(e.g. was an independent Mental Capacity Act Advocate
required)"`, `"(including e.g. see GP in 2 weeks)"`, `"(e.g. OP Appt)"`,
  `"(e.g. nursing, therapy)"`.

**Content in the JSON that is not in the PDF:** none clinically — every JSON
value has a visual home on the page. But 11% of Sinclair's values do not
survive linear text extraction (table above), which is a different and more
dangerous statement.

**Is `SourceRef.page` meaningful? Yes — and it is load-bearing.** The split is
clean and consistent across all five letters:

| Page | Contents                                                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Patient details, admission/GP details, diagnosis, operations, presenting complaint, clinical narrative, investigations, discharge destination, legal info, information-given-to-patient, ability/cognition, advice + GP actions, strategies |
| 2    | Actions & outstanding investigations table, medications stopped/changed, allergies, **the whole discharge-medications table**, pharmacy block, discharging-doctor block                                                                     |

So in the seed: every `medications[].source.page` is `2`; every
`episode.source.page`, every advice-derived instruction, and the red flag are
`1`; appointments are `2`. A single-page fixture would have made the field
decorative — this one exercises it properly. Keep it.

---

## Missing or wrong tasks

### 🔴 M1 — The demo gold letter's clot-preventer is enoxaparin, which D6 explicitly forbade

`04_Sinclair` prescribes **[PDF]** `"Enoxaparin 40mg   1 inj   OD   SC   To
day 28 post-op   14 syringes"`. Against:

- `00-locked-decisions.md:168` — _"The demo's clot-preventer must be
  **apixaban or rivaroxaban**, \_not_ enoxaparin or dalteparin — the injectable
  LMWHs 404 on the NHS medicines A-Z, so the red-flag lookup would return
  nothing on the single most important drug in the demo... **Raf needs this
  before he writes the bundle.**"\_
- `tasks/plan.md:522` (Task A7 verify) — _"enoxaparin/dalteparin return `{
kind: "absent" }` (confirms why the demo must use the oral agent)."_

**The locked demo letter and the locked drug-lookup demo path contradict each
other.** The only letter in the corpus containing apixaban is **02 Whitfield**
(pneumonia) — a QA letter, a medical episode, no wound, no procedure date.

This is a human decision and it **blocks A1**, because A1 hardcodes the
medication list. Options, cost-ordered:

- **(a)** Ask the medic to reissue 04 with apixaban 2.5mg BD substituted for
  enoxaparin. ~10 min of his time, zero cost to us, keeps every other locked
  decision intact. **Recommended.**
- **(b)** Move the demo to 02 Whitfield. Loses the post-op recovery arc,
  wound care, `procedureDate`, and `episode.kind: "surgical"` — i.e. most of
  what makes the timeline interesting. Not recommended.
- **(c)** Keep enoxaparin and make `{ kind: "absent" }` the demo beat ("the
  NHS site has nothing on this injectable, and we say so rather than
  inventing"). Defensible, arguably a stronger honesty beat, but it removes
  the drug-lookup feature from the demo's most important drug and A7's whole
  verification story inverts.

**Nobody should start A1 until this is answered.**

### 🔴 M2 — `doseDirectionsVerbatim` has no source string in this form

`.min(1)`, never null, and `01` calls it "the national standard's primary
medication field" and "what the voice agent reads aloud". The form provides
five discrete table cells and **no directions sentence**. Whatever a dev
writes is a synthesis, so it is not verbatim, so it fails invariant 3 and it
is not the clinician's words — which is the entire regulatory shield the
`*Verbatim` convention exists to provide.

No task addresses this. Phase 0 must decide one of:

- Define a deterministic assembly rule (`"{dose} {frequency} {route}"` →
  `"1 tab QDS Oral"`), record it as **generated, not verbatim**, and exempt it
  from invariant 3; or
- Add a sibling `doseDirectionsSource: "verbatim" | "assembled_from_table"`
  so the UI can render assembled text differently from a quoted sentence.

Either way it is a **shared-contract change** and therefore Phase 0 work, not
something A1 improvises at 2am.

### 🔴 M3 — Invariant 3 has no owner, no defined text source, and fails on the demo letter

`01:1415` mandates that every `SourceRef.quote` be a substring of "the text
extracted from the document". **Nothing produces that text.** A6 sends bytes
to a vision model (C5) and never generates a reference stream. And the obvious
implementation — `pdftotext` — produces **9 false failures out of 83 fields on
the gold letter alone**, because the form is two-column and the extractor
interleaves columns.

`09:640 (F20)` insists all three invariants be kept and correctly notes that
invariant 3 must degrade to an `unresolved` entry rather than throw. That is
right, and it makes this worse, not better: an 11% false-positive rate turns
the honesty channel into noise, and an operator learns to ignore it.

Needs a Phase 0 decision: either name the text-extraction method and accept
its column behaviour, or scope invariant 3 to a whitespace-and-punctuation-
insensitive **token-subsequence** match, or drop it and say why.

### 🔴 M4 — No task converts or verifies the corpus. Propose Task A0

Nothing owns any of the following, and all of it is prerequisite to A1:

- **Date conversion.** Every date in the corpus is `DD/MM/YYYY`
  (`"25/07/2026"`); `ExtractedBundle` wants `z.iso.date()`
  (`"2026-07-25"`). ~8 conversions in the gold letter, ~40 across the corpus.
- **`documents[]` for the seed.** `blobUrl` is `z.url()` non-nullable and
  `blobPathname` is `.min(1)` non-nullable, and the seed path involves no
  upload. `01:1630`'s `file:///fixtures/...` workaround lives in `§R7`, a
  section about throwaway samples that no task cites — the A1 dev will not
  find it.
- **A1 → A9 dependency nobody has stated.** A9's source-trace route calls
  `get(pathname, { access: "private" })` (C5). A `file:///` pathname 404s
  there. **So either the Sinclair PDF is uploaded to Blob once and its real
  pathname is pasted into the seed, or "tap to see where it says that" cannot
  be demonstrated from the seeded demo state.** A9 lists no dependency on A1
  today.
- **Confirming all five JSONs still share one shape** so the QA sweep can be
  written once rather than five times. (They do — verified — but that is a
  fact somebody should own, not one they should rediscover.)

### 🔴 M5 — The gold letter's red flag names no recipient, and the corpus has no phone numbers

Full evidence in the `redFlags[]` section above. In summary: 04 Sinclair
contains no `999`, no `111`, and no callable clinical phone number; its one
safety-netting line is **[PDF]** `"Advised to seek urgent review for worsening
pain, wound issues, fevers or new inability to weight-bear."` — symptoms
without an actor.

Downstream, this starves four things that the plan treats as working:

- `contacts[].phone` is `null` for every contact → A9's red-flag card has
  nothing to dial.
- `redFlags[].contactIds` is `[]` → the tie from a red flag to a channel is
  broken.
- `escalationChannel` collapses to `"other"` on the demo path.
- B5's `assess()` and `escalate_to_next_of_kin` route to a channel that names
  nobody.

Fixable in the same medic message as M1: ask for one line in 04 with a named
recipient — the shape 03 and 05 already have. Or, if he cannot, author the
contacts as `enteredBy: "patient_added"` and be explicit on screen that the
patient supplied the number, not the letter.

### 🔴 M6 — The `configured_class_list` for `escalationClass` does not exist

`Medication.escalationClass` is `"standard" | "high_stakes"` with
`escalationClassSource: "letter_flagged" | "configured_class_list"`. **No
letter flags anything**, so every row is `configured_class_list` — and that
list does not exist, no task creates it, and `plan/medic-brief.md §5` asked
the medic for it explicitly:

> "Our escalation logic needs to know which drugs are serious enough that
> missing them twice should alert the next of kin. No letter ever says this,
> so it can't be extracted — it has to be a list we configure. Two-minute job
> for you."

It was not delivered. Without it, `escalationClass` is an LLM judgement —
which V11 bans by name — or it is hardcoded twice, once per dev. It belongs in
Phase 0 next to the schema, because B5 reads it and A1 writes it.

### 🔴 M7 — The honesty channel has zero fixture coverage

`readConfidence: "unclear"`: 0 instances possible. `unresolved.reason:
"illegible"`: 0. `"ambiguous"`: 0. `"conflicting_sources"`: 0 (one weak
same-document candidate — the enoxaparin 28-day/14-syringe mismatch).

`01` calls the honesty channel "the schema's most important feature" and `§R7`
specified a `degraded.txt` fixture to prove it:

> "If extraction on this file produces a confident, complete, conflict-free
> result, the schema's most important feature is not working."

When the corpus landed, `§R7` was implicitly retired. It should not have
been for `degraded.txt` — that file tests something the medic's clean,
born-digital corpus structurally cannot. ~15 lines, ~15 minutes, and it is the
difference between "we handle unreadable letters" being a claim and being a
demo.

### 🔴 M8 — `Medication.schedule` cannot express weekly dosing, and the demo letter has a weekly drug

**[PDF]** `"Alendronic acid 70mg   1 tab   Weekly   Oral   Ongoing   4 tabs"`.
`schedule.timesPerDay` is `z.number().int().positive().nullable()` and there
is no `everyDays` on `Medication` — only on `Instruction.recurrence`. So the
only encodings are `timesPerDay: null` (A3 renders it never, or every day) or
`1` (A3 renders it daily, which is wrong and clinically visible on the demo
screen: alendronate daily instead of weekly).

This is a shared-contract gap on the locked demo path. Phase 0 fix:
add `everyDays: z.number().int().positive().nullable()` to
`Medication.schedule`, default `1` semantics via `null`.

### 🟡 M9 — `DateAnchor` cannot express the corpus's actual date shapes

Two distinct gaps:

- **No `approximate` on the `date` variant.** Every absolute follow-up date in
  the corpus is tilde-prefixed (`~05/09/2026`, `~03/09/2026`, `~15/09/2026`).
  Encoding these as `kind: "date"` renders a precision the clinician denied in
  writing. V5 and `plan/medic-brief.md §5` both say we must not do that.
- **The union is exclusive; the corpus has hybrids.** `"Arrange staple removal
by 27/07/2026 if not done at rehab unit"` (date + condition) and
  `"Suture/glue check at day 5 if any concerns"` (offset + condition) both
  force a lossy choice.

Cheapest fix: add `approximate: z.boolean()` to the `date` variant (mirrors
`offset`), and add `conditionVerbatim: z.string().nullable()` to `offset` and
`date`. Both are Phase 0, and both are ~5 lines.

### 🟡 M10 — The QA sweep across the other four letters has no task, no owner, no budget, no artifact

It exists today only as a sub-bullet of A6's acceptance:

> "QA path = run the other four PDFs too and spot-check each against its
> sibling form JSON (not `ExtractedBundle`) so demographics, meds, and dates
> are not invented."

No owner, no pass/fail criterion, no time. And it is scheduled inside A6,
which lands at **Checkpoint 2 (~hour 10–12)** — 4 extractions plus a
hand-mapped 5-field diff each is 45–60 minutes that is not in anybody's
budget, at the point in the schedule where slack has already been spent.

`01 §R8` already specifies the diff precisely (medication names, dose
directions, course durations, red-flag lines, appointment dates) and notes
_"That number is quotable on stage."_ It deserves its own task, its own
half-hour, and a named owner.

### 🟡 M11 — `"Ongoing"` has two defensible encodings and Phase 0 picks neither

`duration.end: null` (nothing to compute) vs
`{ kind: "conditional", verbatim: "Ongoing" }` (preserve the clinician's
word). Four of Sinclair's six medications use `"Ongoing"` or `"Regular"`, and
A3's `buildTimeline` branches on which one it sees. Two devs, two answers,
discovered at Checkpoint 1 when the timeline is either empty or infinite.

### 🟡 M12 — Nothing expands the clinical abbreviations, and they are the only schedule text there is

`QDS`, `TDS`, `BD`, `OD`, `Nocte`, `PRN`, `QDS PRN`, `SC` are the complete
schedule vocabulary of the corpus. I6's "generated plain language" covers
`titlePlain` and `purposePlain` only. As written, the timeline renders "QDS"
and **the voice agent reads "QDS" aloud to a 79-year-old with mild cognitive
impairment**. Either `schedule.verbatim` gets a plain-language sibling, or B3's
prompt gets an explicit expansion table. Neither exists.

### 🟡 M13 — `episode.kind` for a PCI has no written rule

03 Okafor: `"Coronary angiogram + PCI to proximal RCA with drug-eluting
stent"`. Not surgery; has a procedure date. `01:1183`'s comment implies the
discriminator is "is there a procedure", which makes it `surgical` — but that
is inference from a code comment. One sentence in Task 0.2 settles it.

### 🟡 M14 — `instructions[]` is nearly empty, and `recurrence` has no fixture at all

The corpus is a discharge-summary form only — **no wound-care leaflet, no
physio sheet, no appointment letter**. So `instructions[].kind` reaches only
`wound_care` and `other`; `activity`, `exercise` and `appointment_prep` have
no source. `recurrence` has **zero instances across all five letters** —
nothing in the corpus repeats — so A3's recurrence branch ships untested and
undemonstrated. `01`'s "short walk 3 to 4 times a day" exemplar came from a
leaflet we do not have.

If the day-by-day timeline is the product, a plan whose only recurring items
are medications is a thin timeline. Worth one more ask of the medic: a
half-page physio/wound-care sheet as `doc_2`.

### 🟢 M15 — `documents[]` enum coverage is 1-of-8, `capture` is 1-of-3

Only `discharge_summary` / `pdf`. Not a blocker; worth knowing before someone
claims multi-document extraction works.

### 🟢 M16 — `patient.preferredLanguage` is structurally always `null`

The blank template has no communication-needs field. Say so in Task 0.2 so
nobody hunts for it, and so the French demo's locale is understood as a user
setting only.

### 🟢 M17 — `triggerFr` / `actionFr` (P2/H4) got much cheaper

With one vague red flag on the gold letter, hand-authoring the French is
~10 minutes. H4 was rated 🔴 on the assumption of a full red-flag set. It is
now small — but note the flip side: **the French dual-render demo has one card
to show.**

### 🟢 M18 — A1's "the audit JSONC remains a shape reference" needs a boundary

The JSONC is a **right total hip replacement** with rivaroxaban, Ward 9's
phone number, a booked 10:20am clinic slot, and three leaflet-derived
instructions. Sinclair is a **left cemented hemiarthroplasty** with enoxaparin,
no phone numbers, no booked slot, and no leaflet. Left as-is, a dev will copy
JSONC content into the seed and it will be clinically wrong for the letter on
screen. The plan should say "shape only, never content".

### 🟢 M19 — `01 §R7`'s status is undeclared

`§R7` specified three throwaway `fixtures/dev/` samples. Two are now
superseded by the corpus; **`degraded.txt` is not** (M7). Nothing says which.

### 🟢 M20 — `plan/` is currently deleted in the working tree

`git status` shows ` D plan/spec.md`, ` D plan/medic-brief.md`,
` D plan/initial-idea.md`, ` D plan/raw-transcript.md`, while the files are
present in `HEAD` (`a6dd869`). `tasks/plan.md:3` and roughly 40 audit
citations point into `plan/`. If this deletion is not intentional, restore
before the fork or every citation dangles for both devs. **Not touched by this
pass** — flagged only.

---

## Task sizing check — is A1 still correctly sized?

**No. It reads like a 30–45 minute transcription and it is a 90–150 minute
authoring task on the critical path.**

What A1 actually has to produce for Sinclair:

| Work                                                                                                                                                                                                             | Est.          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `documents[]` + `patient` + `episode` (incl. 8 DD/MM/YYYY → ISO conversions)                                                                                                                                     | 10 min        |
| 6 × `Medication`, ~18 fields each ≈ 110 fields; form supplies ~7 per row                                                                                                                                         | 35–45 min     |
| — of which **authored, not transcribed**: `doseDirectionsVerbatim` ×6 (M2), `indicationVerbatim`/`purposePlain` ×6 (4 must be `null`), `escalationClass` ×6 (blocked on M6), `duration.start` ×6, `lookupKey` ×6 | (included)    |
| `contacts[]` — must be constructed from thin material, all `phone: null` (M5)                                                                                                                                    | 10 min        |
| `redFlags[]` + `matchHints` + hand-authored `triggerFr`/`actionFr` (P2)                                                                                                                                          | 15 min        |
| `instructions[]` + `appointments[]` (thin, but the DateAnchor calls are fiddly)                                                                                                                                  | 15 min        |
| `extraction.unresolved[]` — the honest entries for every absent field                                                                                                                                            | 10 min        |
| Every `SourceRef` (quote from the **PDF**, not the JSON — M3) + `page`                                                                                                                                           | 15 min        |
| `portico:log:demo` seeded with two prior misses (P11)                                                                                                                                                            | 10 min        |
| `app/api/seed/route.ts`                                                                                                                                                                                          | 10 min        |
| **Total**                                                                                                                                                                                                        | **~2h ± 30m** |

Three things make this worse than the raw number:

1. **It is the critical path.** A2, A3, A4 and A7 all depend on it, and Track
   B's B3 needs a real bundle to build the prompt from. A 2-hour A1 inside a
   Phase 1 slot that Checkpoint 1 puts at "~4–5h in" consumes most of it.
2. **It is blocked on two human decisions** — M1 (which anticoagulant) and M6
   (the high-stakes list). Both are in-flight with the medic, not with the
   dev, and A1 cannot be finished without them.
3. **Six `purposePlain` lines are clinical judgement, not code.** Getting them
   from the medic in the same message as M1/M5 is 5 minutes of his time and
   avoids a developer writing patient-facing drug explanations.

**Recommendation: split A1 in two.**

- **A1a (~45 min, unblocks everyone):** `documents`, `patient`, `episode`,
  `medications`, `contacts`, and `POST /api/seed`. Enough for A2, A3, A7 and
  B3 to start. Can proceed with a placeholder `escalationClass` if M6 is still
  open, provided the placeholder is `"standard"` and is recorded as such.
- **A1b (~45–60 min, can land after Checkpoint 1):** `redFlags` (incl. FR),
  `instructions`, `appointments`, `extraction.unresolved`, and the primed
  `portico:log:demo`.

---

## Proposed patches (not yet applied)

Quoted for a human to apply to `tasks/plan.md` / `tasks/todo.md`. **Nothing
below has been written to either file.**

### PA — New Task A0, first in Track A Phase 1, before A1 (fixes M4)

> - [ ] **Task A0: Corpus normalisation + seed prerequisites.** Before the
>       seed can be written, three things must exist and none of them do.
>   - **Dates.** Every date in `fixtures/discharge-summaries/` is
>     `DD/MM/YYYY`; `ExtractedBundle` wants `z.iso.date()`. Convert by hand as
>     you transcribe — do not add a parser to `lib/`, this is fixture work.
>     Sinclair: admission `2026-07-14`, procedure `2026-07-15`, discharge
>     `2026-07-25`, staple removal `2026-07-27`, ortho follow-up
>     `2026-09-05` (= discharge + 42, arithmetic verified).
>   - **Blob.** Upload `04_Sinclair_Margaret_NOF_Fracture.pdf` to the
>     `juno-letters` store **once**, by hand, and paste the real `blobUrl` and
>     `blobPathname` into `demo-plan.ts`. **A `file:///` placeholder makes A9
>     undemonstrable** — the store is Private (C5) and A9's route calls
>     `get(pathname, { access: "private" })`, which cannot resolve a fake
>     pathname. This makes **A9 depend on A0**, which is currently unstated.
>   - **Shape check.** Confirm all five `.json` files still share the same 18
>     top-level keys, so the QA sweep (Task A6.1) can be written once.
>   - Files: none in `lib/` — this task produces facts and one Blob object.
>   - Dependencies: Task 0.2, 0.3. **Blocks A1.**

### PB — Task A1 replacement (fixes M18, the seed-provenance rule, and the split)

> - [ ] **Task A1a: Seed fixture — core.** `lib/plan/samples/demo-plan.ts`,
>       `satisfies ExtractedBundle`, grounded in **Margaret Sinclair / NOF
>       fracture**. Produce `documents`, `patient`, `episode`, `medications`,
>       `contacts`, plus `POST /api/seed` writing `portico:plan:demo` and
>       `portico:patient:demo`.
>   - **Provenance rule — this is the one that matters.** The `.json` supplies
>     **facts and field mapping**. The `.pdf` supplies **strings**. Every
>     `*Verbatim` value and every `SourceRef.quote` is copied from the PDF,
>     never from the JSON. **11% of the JSON's strings do not appear in the
>     PDF's text at all** (see `11 §SourceRef`), so lifting them makes the
>     seed's source refs unverifiable.
>   - **`SourceRef.page` is real here**: medications and the follow-up table
>     are on page 2; episode, diagnosis and advice are on page 1.
>   - **The JSONC in `01` is a shape reference only, never a content
>     reference.** It describes a _right total hip replacement_ with
>     rivaroxaban, a ward phone number and a booked 10:20 clinic slot. Sinclair
>     has none of those. Do not copy its values.
>   - Acceptance: `curl -X POST localhost:3000/api/seed` populates both keys
>     with Sinclair-derived facts (hemiarthroplasty / NOF, her six drugs).
>   - Dependencies: Task 0.2, 0.3, **A0**. **Blocked on the M1 and M6 medic
>     answers** — see the risk table.
> - [ ] **Task A1b: Seed fixture — safety and timeline content.** `redFlags`
>       (with hand-authored `triggerFr`/`actionFr` per Locked D7),
>       `instructions`, `appointments`, and `extraction.unresolved[]` — one
>       honest entry per genuinely-absent field (`schedule.timesOfDay` ×6,
>       missing indications). Also seeds `portico:log:demo` with **two prior
>       misses on the clot-preventer**, so B14's `make seed` resets straight
>       into a primed escalation without manual Redis surgery.
>   - **Sinclair's only red-flag material names no recipient:** "Advised to
>     seek urgent review for worsening pain, wound issues, fevers or new
>     inability to weight-bear." Per I7 that is `escalationChannel: "other"`
>     with `contactIds: []` unless M1/M5 lands a corrected letter. Do not
>     upgrade it to `999` to make the card look better.
>   - Can land after Checkpoint 1.

### PC — New Task A6.1: the QA sweep, with an owner and a budget (fixes M10)

> - [ ] **Task A6.1: Cross-condition QA sweep (30–45 min, Track A owns).**
>       Run `/api/extract` over `01_Clarke`, `02_Whitfield`, `03_Okafor` and
>       `05_Bradley`, and hand-diff each result against its sibling `.json` on
>       the five fields `01 §R8` names: **medication names, dose directions,
>       course durations, red-flag lines, appointment dates**. Structural
>       diffing is pointless — the shapes differ by design.
>   - **Purpose is to prove the pipeline is not one-letter-shaped**: 02 and 05
>     are `episode.kind: "medical"` with `procedureDate: null` and no wound; 03
>     is a percutaneous intervention. If extraction only works on 04, the
>     schema is surgery-shaped after all.
>   - **Do not diff 04 Sinclair here.** Its `.json` was used to write the seed,
>     so that number is not independent and must not be quoted on stage.
>   - Acceptance: a five-row table of hit/miss per letter, written into
>     `tasks/todo.md`. That number is the quotable one.
>   - Dependencies: A6.

### PD — Task 0.2 additions: the four shared-contract gaps the corpus exposed (M2, M8, M9, M11, M13, M16)

> - **`Medication.schedule` gains `everyDays: z.number().int().positive()
.nullable()`.** The demo letter contains "Alendronic acid 70mg ... Weekly",
>   and `timesPerDay` cannot express a weekly drug. Without this, `/plan`
>   renders a weekly bisphosphonate as a daily task — a clinically wrong row on
>   the demo screen.
> - **`DateAnchor`'s `date` variant gains `approximate: z.boolean()`**, mirror-
>   ing `offset`. Every absolute follow-up date in the corpus is written
>   `~05/09/2026` — the clinician hedged in their own punctuation and V5
>   forbids us rendering a precision they denied.
> - **`DateAnchor`'s `offset` and `date` variants gain `conditionVerbatim:
z.string().nullable()`.** The corpus contains genuine hybrids the exclusive
>   union cannot hold: "Arrange staple removal by 27/07/2026 **if not done at
>   rehab unit**" (date + condition) and "Suture/glue check at day 5 **if any
>   concerns**" (offset + condition).
> - **Decide `doseDirectionsVerbatim` for table-shaped letters.** The NHS form
>   has five columns and no directions sentence, so the field's `.min(1)` can
>   only be satisfied by assembling cells. Either exempt assembled values from
>   invariant 3 and label them, or add `doseDirectionsSource: "verbatim" |
"assembled_from_table"`. Pick one **here**, not in A1.
> - **Write down three one-line rules** so two devs do not answer them
>   differently: (1) a medication `Duration` of "Ongoing" / "Regular" is
>   `duration.end: null`, not a `conditional` anchor; (2) `episode.kind` is
>   `"surgical"` whenever a procedure with a date occurred, including
>   percutaneous ones (03 Okafor's PCI); (3) `patient.preferredLanguage` is
>   always `null` — this form has no communication-needs field.

### PE — Task 0.2 / new Phase 0 item: the high-stakes drug list (fixes M6)

> - **`lib/plan/high-stakes.ts` — the configured class list.** `escalationClass`
>   is `"letter_flagged" | "configured_class_list"` and **no letter in the
>   corpus flags anything**, so every value comes from a list that does not
>   exist. V11 bans making this an LLM judgement. Phase 0 because B5 reads it
>   and A1 writes it. Ask the medic (it was `plan/medic-brief.md §5`, still
>   unanswered); failing that, seed it with the anticoagulant, the opioid and
>   the bisphosphonate and mark it as ours, not his.

### PF — Risk-table row to add to `tasks/plan.md` (fixes M1)

> | The demo gold letter's clot-preventer is **enoxaparin**, which D6 forbade and A7 verifies as absent from NHS.uk | **High — blocks A1 and inverts A7's demo** | Ask the medic to reissue `04` with apixaban (~10 min of his time), in the same message as the missing red-flag recipient (M5) and the high-stakes list (M6). Fallback: keep enoxaparin and make `{ kind: "absent" }` the honesty beat — but decide **before** A1 is written, not at rehearsal |

### PG — `tasks/plan.md` corpus table: add what the corpus does **not** contain

> **What the corpus does not contain** (all five letters are the same blank
> template, so every gap is corpus-wide): no callable clinical phone number
> and no `999`/`111` in the gold letter; no free-text dose directions; no
> indication column; no wound-care leaflet, physio sheet or appointment
> letter; no booked appointment slot; no recurring instruction; nothing
> illegible, ambiguous or conflicting; no photograph — all five are
> born-digital 2-page PDFs with a perfect text layer. Details and quotes:
> `audit/juno-recovery-companion/11-fixture-corpus-readiness.md`.

---

## Residual risk

| #   | Risk                                                                                                                                                                            | Severity | How to close                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | I did not photograph any PDF and re-extract. The demo's actual input is a phone photo, and this corpus has never been through a lens — no skew, glare, shadow or fold.          | 🔴       | 10 minutes at Checkpoint 2: photograph Sinclair page 1 and page 2 on a phone, run `/api/extract`, compare to the PDF run.                  |
| R2  | I did not run extraction. Every "will extract well" claim is inference from layout and text-layer quality, not measurement.                                                     | 🟡       | Task A6.1 measures it. Do not treat this file's field table as a prediction of extraction accuracy — it is a prediction of _availability_. |
| R3  | Invariant-3 numbers are `pdftotext`-specific. A different extractor (or the vision model's own reading order) will produce a different failure set — possibly smaller.          | 🟡       | Whatever M3 settles on, re-run the substring check against _that_ method before trusting the number.                                       |
| R4  | The `episode.kind` call for 03 Okafor is my reading of a code comment in `01:1183`, not a stated rule. A clinician might say a PCI is a medical admission with an intervention. | 🟢       | One sentence in Task 0.2 (PD rule 2), or one question to the medic.                                                                        |
| R5  | I read `plan/medic-brief.md` from `HEAD` because it is deleted in the working tree (M20). If someone has since edited and re-deleted it, my §2/§3/§5 quotes could be stale.     | 🟢       | `git show HEAD:plan/medic-brief.md` to re-verify; the three quoted sections are §2, §3 and §5.                                             |
| R6  | Time estimates in the sizing section are mine, unvalidated against how fast this pair actually works.                                                                           | 🟢       | Track A1a against the clock; if it overruns 45 min the A1a/A1b split has already paid for itself.                                          |

---

## Skills applied

- **`/typescript-best-practices`** — used to judge the schema against the
  corpus: discriminated-union exhaustiveness (`DateAnchor`'s three variants
  cannot express the corpus's date+condition hybrids — M9), `.nullable()` vs
  `.optional()` at the trust boundary, `satisfies` (never `as`) for the seed
  fixture literal, and making illegal states unrepresentable (`Medication`
  currently permits no honest encoding of a weekly drug — M8).
- **`/haider-engineering-defaults`** — "validate at the edge, trust nothing
  crossing a process boundary" is why invariant 3 matters enough to be M3
  rather than a footnote; "fail closed and name which thing is missing" is why
  M6's absent class list is 🔴 rather than a TODO; no secret values are
  printed anywhere in this file.
- **`/nextjs-app-router-patterns`** — used on the A0/A1/A9 seam: the seed is
  read by an async Server Component doing `Promise.all([readPlan(),
readLog()])`, and the private-Blob source-trace must be a route handler
  streaming bytes, which is what makes a `file:///` placeholder
  `blobPathname` a demo-breaking choice rather than a cosmetic one (M4).
- Project law applied throughout: `CLAUDE.md` — no defensive programming (so
  "absent" must be representable, not defaulted), no silent fallbacks
  [Locked D9], obvious over clever, and Zod only at trust boundaries.
