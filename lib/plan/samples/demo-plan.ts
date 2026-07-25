import type { ExtractedBundle, SourceRef } from "@/lib/plan/schema";

// The demo seed, transcribed by hand from
// `fixtures/discharge-summaries/02_Whitfield_Harold_Pneumonia.{pdf,json}`.
//
// Provenance rule: the JSON supplies FACTS and field mapping, the PDF supplies
// STRINGS. Around 9% of the JSON's values do not appear in the PDF's text at
// all — the form's two-column layout interleaves label cells with value cells,
// so a value that reads as one sentence on the page is not one contiguous run
// of text — and lifting those would put unverifiable quotes behind "tap to see
// where it says that".
//
// So every `SourceRef.quote` is a contiguous run of the PDF, sometimes shorter
// than the field it locates. The display fields are allowed to be assembled
// from adjacent cells, and the ones that are say so where they are defined:
// `doseDirectionsVerbatim` on all seven medications, `episode.titleVerbatim`,
// the GP contact's label, and the community appointment's `withVerbatim`.
//
// What the letter does NOT contain is as load-bearing as what it does. It has
// no per-drug directions sentence, no indication column, no callable clinical
// phone number, and its one piece of safety-netting names no recipient. Those
// gaps are recorded in `extraction.unresolved` and in `escalationChannel:
// "other"` — not filled in with something plausible.

const DOC_ID = "doc-discharge";

// Page 1 is the episode, the advice and the counselling; page 2 is the whole
// medication table and the follow-up actions. `SourceRef.page` is a real
// navigation hint here, not decoration.
function onPage(page: 1 | 2, quote: string): SourceRef {
  return { documentId: DOC_ID, page, quote, readConfidence: "clear" };
}

const DISCHARGE_DATE = "2026-07-25";

export const DEMO_PLAN = {
  schemaVersion: "portico-extract/1",

  documents: [
    {
      id: DOC_ID,
      kind: "discharge_summary",
      displayName: "Discharge summary — St Elsewhere and Somewhere Hospitals",
      capture: "pdf",
      pageCount: 2,
      blobUrl:
        "https://d2wuxecbkxmspvzn.private.blob.vercel-storage.com/letters/demo/02_Whitfield_Harold_Pneumonia.pdf",
      blobPathname: "letters/demo/02_Whitfield_Harold_Pneumonia.pdf",
    },
  ],

  // Minimal by design: a first name is all the app needs to speak to him.
  // Surname, date of birth, NHS number, address and telephone are on the letter
  // and deliberately not stored — `redactedByPolicy` names the fields, never
  // their values.
  patient: {
    givenName: "Harold",
    preferredLanguage: null,
    redactedByPolicy: [
      "surname",
      "dateOfBirth",
      "nhsNumber",
      "address",
      "telephone",
    ],
  },

  episode: {
    kind: "medical",
    titleVerbatim:
      "Community-acquired pneumonia (right lower lobe); infective exacerbation of COPD.",
    titlePlain: "A chest infection, with a flare-up of your COPD",
    dischargeDate: DISCHARGE_DATE,
    procedureDate: null,
    dischargingTeamVerbatim: "Resp Med / COTE",
    source: onPage(1, "Community-acquired pneumonia (right lower lobe);"),
  },

  // No letter in this corpus carries a callable clinical number. The daughter's
  // mobile is the only phone on the page, so three of these four contacts have
  // `phone: null` — which is the letter's gap, not ours to fill.
  contacts: [
    {
      id: "contact-daughter",
      labelVerbatim: "Daughter",
      phone: "07712 345678",
      channel: "other",
      hoursVerbatim: null,
      source: onPage(
        1,
        "Daughter aware/involved in care; has contact details for community matron and falls team.",
      ),
    },
    {
      id: "contact-gp",
      labelVerbatim: "Dr N. Patel, Kingsclere Road Surgery, Basingstoke",
      phone: null,
      channel: "gp",
      hoursVerbatim: null,
      source: onPage(1, "Kingsclere Road Surgery, Basingstoke"),
    },
    {
      id: "contact-respiratory-team",
      labelVerbatim: "Dr Osei's team",
      phone: null,
      channel: "specialist_team",
      hoursVerbatim: null,
      source: onPage(2, "Dr Osei's team"),
    },
    {
      id: "contact-community-services",
      labelVerbatim: "District nurses / Falls team",
      phone: null,
      channel: "district_nurse",
      hoursVerbatim: null,
      source: onPage(2, "District nurses / Falls team"),
    },
  ],

  // The form is a five-column table with no directions sentence, so
  // `doseDirectionsVerbatim` is assembled from the dose, frequency, route and
  // duration cells of one row, in that order. Every cell value is the letter's;
  // only the commas are ours.
  medications: [
    {
      id: "med-doxycycline",
      nameAsWritten: "Doxycycline 100mg",
      lookupKey: {
        normalisedName: "doxycycline",
        form: "tablet",
        strength: "100mg",
        nameConfidence: "clear",
      },
      doseDirectionsVerbatim: "1 tab, OD, Oral, 2 days (complete)",
      dose: "1 tab",
      route: "Oral",
      schedule: {
        timesPerDay: 1,
        timesOfDay: [],
        everyDays: null,
        verbatim: "OD",
      },
      withFood: "not_stated",
      duration: {
        start: {
          kind: "offset",
          from: "discharge",
          days: 0,
          daysUntil: null,
          approximate: false,
          verbatim: "2 days (complete)",
        },
        // Two tablets supplied, one a day, starting the day of discharge: the
        // last dose is the day after. This is the course that expires on
        // camera.
        end: {
          kind: "offset",
          from: "discharge",
          days: 1,
          daysUntil: null,
          approximate: false,
          verbatim: "2 days (complete)",
        },
      },
      changeStatus: "not_stated",
      changeNoteVerbatim: null,
      indicationVerbatim: null,
      purposePlain: null,
      escalationClass: "standard",
      escalationClassSource: "configured_class_list",
      enteredBy: "extracted",
      source: onPage(2, "Doxycycline 100mg"),
    },
    {
      id: "med-apixaban",
      nameAsWritten: "Apixaban 5mg",
      lookupKey: {
        normalisedName: "apixaban",
        form: "tablet",
        strength: "5mg",
        nameConfidence: "clear",
      },
      doseDirectionsVerbatim: "1 tab, BD, Oral, Ongoing",
      dose: "1 tab",
      route: "Oral",
      schedule: {
        timesPerDay: 2,
        timesOfDay: [],
        everyDays: null,
        verbatim: "BD",
      },
      withFood: "not_stated",
      duration: {
        start: {
          kind: "offset",
          from: "discharge",
          days: 0,
          daysUntil: null,
          approximate: false,
          verbatim: "Ongoing",
        },
        // "Ongoing" is an open end, not a conditional anchor: the letter names
        // no condition that would stop it.
        end: null,
      },
      changeStatus: "continued",
      changeNoteVerbatim: null,
      indicationVerbatim: "permanent AF (on apixaban)",
      purposePlain:
        "Stops clots forming, because your heartbeat is irregular (atrial fibrillation).",
      // No letter in this corpus flags a drug as high-stakes, so this comes
      // from our own configured class list, and says so.
      escalationClass: "high_stakes",
      escalationClassSource: "configured_class_list",
      enteredBy: "extracted",
      source: onPage(2, "Apixaban 5mg"),
    },
    {
      id: "med-metformin",
      nameAsWritten: "Metformin 500mg",
      lookupKey: {
        normalisedName: "metformin",
        form: "tablet",
        strength: "500mg",
        nameConfidence: "clear",
      },
      doseDirectionsVerbatim: "1 tab, BD, Oral, Ongoing (reduced)",
      dose: "1 tab",
      route: "Oral",
      schedule: {
        timesPerDay: 2,
        timesOfDay: [],
        everyDays: null,
        verbatim: "BD",
      },
      withFood: "not_stated",
      duration: {
        start: {
          kind: "offset",
          from: "discharge",
          days: 0,
          daysUntil: null,
          approximate: false,
          verbatim: "Ongoing (reduced)",
        },
        end: null,
      },
      changeStatus: "amended",
      changeNoteVerbatim:
        "Metformin reduced from 1g BD to 500mg BD due to reduced eGFR.",
      indicationVerbatim: null,
      purposePlain: null,
      escalationClass: "standard",
      escalationClassSource: "configured_class_list",
      enteredBy: "extracted",
      source: onPage(2, "Metformin 500mg"),
    },
    {
      id: "med-ramipril",
      nameAsWritten: "Ramipril 5mg",
      lookupKey: {
        normalisedName: "ramipril",
        form: "tablet",
        strength: "5mg",
        nameConfidence: "clear",
      },
      doseDirectionsVerbatim: "1 tab, OD, Oral, WITHHELD-GP review",
      dose: "1 tab",
      route: "Oral",
      schedule: {
        timesPerDay: 1,
        timesOfDay: [],
        everyDays: null,
        verbatim: "OD",
      },
      withFood: "not_stated",
      // Withheld: there is no start, so there is no day it belongs on.
      duration: { start: null, end: null },
      changeStatus: "stopped",
      changeNoteVerbatim:
        "Ramipril withheld due to AKI - GP to review/restart once renal function stable.",
      indicationVerbatim: null,
      purposePlain: null,
      escalationClass: "standard",
      escalationClassSource: "configured_class_list",
      enteredBy: "extracted",
      source: onPage(2, "Ramipril 5mg"),
    },
    {
      id: "med-atorvastatin",
      nameAsWritten: "Atorvastatin 20mg",
      lookupKey: {
        normalisedName: "atorvastatin",
        form: "tablet",
        strength: "20mg",
        nameConfidence: "clear",
      },
      doseDirectionsVerbatim: "1 tab, Nocte, Oral, Ongoing",
      dose: "1 tab",
      route: "Oral",
      schedule: {
        timesPerDay: 1,
        // "Nocte" is the one row where the letter does name a time of day.
        timesOfDay: ["night"],
        everyDays: null,
        verbatim: "Nocte",
      },
      withFood: "not_stated",
      duration: {
        start: {
          kind: "offset",
          from: "discharge",
          days: 0,
          daysUntil: null,
          approximate: false,
          verbatim: "Ongoing",
        },
        end: null,
      },
      changeStatus: "not_stated",
      changeNoteVerbatim: null,
      indicationVerbatim: null,
      purposePlain: null,
      escalationClass: "standard",
      escalationClassSource: "configured_class_list",
      enteredBy: "extracted",
      source: onPage(2, "Atorvastatin 20mg"),
    },
    {
      id: "med-salbutamol",
      nameAsWritten: "Salbutamol 100mcg inh",
      lookupKey: {
        normalisedName: "salbutamol",
        form: "inhaler",
        strength: "100mcg",
        nameConfidence: "clear",
      },
      doseDirectionsVerbatim: "2 puffs, PRN, Inhaled, Ongoing",
      dose: "2 puffs",
      route: "Inhaled",
      schedule: {
        // "PRN" — as required. A null count is the letter's answer, not a gap.
        timesPerDay: null,
        timesOfDay: [],
        everyDays: null,
        verbatim: "PRN",
      },
      withFood: "not_stated",
      duration: {
        start: {
          kind: "offset",
          from: "discharge",
          days: 0,
          daysUntil: null,
          approximate: false,
          verbatim: "Ongoing",
        },
        end: null,
      },
      changeStatus: "not_stated",
      changeNoteVerbatim: null,
      indicationVerbatim: null,
      purposePlain: null,
      escalationClass: "standard",
      escalationClassSource: "configured_class_list",
      enteredBy: "extracted",
      source: onPage(2, "Salbutamol 100mcg inh"),
    },
    {
      id: "med-tiotropium",
      nameAsWritten: "Tiotropium 18mcg",
      lookupKey: {
        normalisedName: "tiotropium",
        form: "inhaler",
        strength: "18mcg",
        nameConfidence: "clear",
      },
      doseDirectionsVerbatim: "1 puff, OD, Inhaled, Ongoing",
      dose: "1 puff",
      route: "Inhaled",
      schedule: {
        timesPerDay: 1,
        timesOfDay: [],
        everyDays: null,
        verbatim: "OD",
      },
      withFood: "not_stated",
      duration: {
        start: {
          kind: "offset",
          from: "discharge",
          days: 0,
          daysUntil: null,
          approximate: false,
          verbatim: "Ongoing",
        },
        end: null,
      },
      changeStatus: "not_stated",
      changeNoteVerbatim: null,
      indicationVerbatim: null,
      purposePlain: null,
      escalationClass: "standard",
      escalationClassSource: "configured_class_list",
      enteredBy: "extracted",
      source: onPage(2, "Tiotropium 18mcg"),
    },
  ],

  instructions: [
    {
      id: "inst-antibiotics",
      kind: "other",
      titlePlain: "Finish the whole antibiotic course, even if you feel better",
      detailVerbatim:
        "Both counselled on signs of worsening chest infection, completing antibiotics and correct inhaler use.",
      anchor: null,
      recurrence: null,
      actor: "patient",
      contactIds: [],
      enteredBy: "extracted",
      source: onPage(
        1,
        "Both counselled on signs of worsening chest infection, completing antibiotics and correct inhaler use.",
      ),
    },
    {
      id: "inst-bloods",
      kind: "appointment_prep",
      titlePlain: "Blood test at your GP surgery, about a week after leaving",
      detailVerbatim:
        "Recheck U&E and CRP in 1 week; review inhaler technique at next review.",
      anchor: {
        kind: "offset",
        from: "discharge",
        days: 7,
        daysUntil: null,
        approximate: false,
        verbatim: "in 1 week",
      },
      recurrence: null,
      // The letter addresses this to the GP, not to Harold. The check-in asks
      // "has someone been in touch about..." rather than "did you...".
      actor: "clinician",
      contactIds: ["contact-gp"],
      enteredBy: "extracted",
      source: onPage(
        1,
        "Recheck U&E and CRP in 1 week; review inhaler technique at next review.",
      ),
    },
    {
      id: "inst-falls",
      kind: "activity",
      titlePlain: "Keep using your frame, and take care on the stairs",
      detailVerbatim:
        "Patient/daughter counselled as above re infection signs, antibiotic compliance and falls prevention; referral made to community falls clinic.",
      anchor: null,
      recurrence: null,
      actor: "patient",
      contactIds: ["contact-community-services"],
      enteredBy: "extracted",
      source: onPage(
        1,
        "Patient/daughter counselled as above re infection signs, antibiotic compliance and falls prevention; referral made to community falls clinic.",
      ),
    },
  ],

  appointments: [
    {
      id: "appt-respiratory",
      withVerbatim: "Respiratory OP follow-up",
      // The clinician wrote "~05/09/2026". The tilde is theirs, so the date is
      // carried as approximate rather than rendered as a firm appointment.
      when: {
        kind: "date",
        date: "2026-09-05",
        time: null,
        approximate: true,
        verbatim: "~05/09/2026",
      },
      locationVerbatim: null,
      isBooked: false,
      contactIds: ["contact-respiratory-team"],
      enteredBy: "extracted",
      source: onPage(
        2,
        "Respiratory OP follow-up in 6 weeks with repeat CXR to confirm radiological resolution.",
      ),
    },
    {
      id: "appt-community",
      withVerbatim:
        "District nursing POC review; community falls team referral",
      // "Within 2 weeks" is a window, not a day: earliest is discharge itself,
      // latest is day 14.
      when: {
        kind: "offset",
        from: "discharge",
        days: 0,
        daysUntil: 14,
        approximate: false,
        verbatim: "Within 2 weeks",
      },
      locationVerbatim: null,
      isBooked: false,
      contactIds: ["contact-community-services"],
      enteredBy: "extracted",
      // Stops at "community": the form's label column ("Services (e.g.
      // nursing, therapy)") is interleaved between this line and "falls team
      // referral.", so the full sentence is not a contiguous run of the
      // document and would not survive the "show me where it says that" check.
      source: onPage(2, "District nursing POC review; community"),
    },
  ],

  redFlags: [
    {
      id: "flag-worsening-chest-infection",
      triggerVerbatim: "breathless, feverish or confused again",
      actionVerbatim: "Advised to seek urgent help",
      triggerFr: "essoufflé, fiévreux, ou de nouveau confus",
      actionFr: "Il vous a été conseillé de demander de l'aide en urgence",
      // The letter names no recipient for this advice, so there is no contact
      // to route to and the channel is "other". Upgrading it to 999 would make
      // the card look better and would be us, not the doctor, saying it.
      contactIds: [],
      escalationChannel: "other",
      matchHints: [
        "breathless",
        "breathing",
        "short of breath",
        "can't catch my breath",
        "fever",
        "feverish",
        "temperature",
        "hot",
        "confused",
        "confusion",
        "muddled",
        "not making sense",
      ],
      relatedMedicationIds: ["med-doxycycline"],
      source: onPage(
        1,
        "Advised to seek urgent help if breathless, feverish or confused again.",
      ),
    },
  ],

  extraction: {
    extractedAt: "2026-07-25T09:15:00Z",
    // Not a model. Naming the seed here is what lets the UI say so.
    modelId: "seed/02-whitfield",
    unresolved: [
      ...[
        "med-doxycycline",
        "med-apixaban",
        "med-metformin",
        "med-ramipril",
        "med-tiotropium",
      ].map((id) => ({
        path: `medications[${id}].schedule.timesOfDay`,
        documentId: DOC_ID,
        reason: "absent_from_bundle" as const,
        verbatimContext: null,
        note: "The table gives a frequency but never a time of day, so the plan cannot say morning or evening without inventing it.",
      })),
      ...[
        "med-doxycycline",
        "med-metformin",
        "med-ramipril",
        "med-atorvastatin",
        "med-salbutamol",
        "med-tiotropium",
      ].map((id) => ({
        path: `medications[${id}].indicationVerbatim`,
        documentId: DOC_ID,
        reason: "absent_from_bundle" as const,
        verbatimContext: null,
        note: "The discharge form has no indication column, and the narrative does not name this drug, so what it is for is not stated on the letter.",
      })),
    ],
    conflicts: [
      {
        topic:
          "Ramipril is on the discharge list and withheld at the same time",
        positions: [
          {
            documentId: DOC_ID,
            quote: "Ramipril 5mg",
            readConfidence: "clear",
          },
          {
            documentId: DOC_ID,
            quote:
              "Ramipril withheld due to AKI - GP to review/restart once renal function stable.",
            readConfidence: "clear",
          },
        ],
        note: 'The medication table lists ramipril with a quantity of "0 - see note" while the changes box says it is withheld. The plan treats it as not to be taken until the GP says otherwise, and shows both lines.',
      },
    ],
  },
} satisfies ExtractedBundle;

// The next-of-kin the letter already names. D5's family dashboard gets a real
// persona from the source rather than an invented one — she is unnamed on the
// page, so she stays unnamed here.
export const DEMO_PATIENT = {
  id: "demo",
  givenName: "Harold",
  nextOfKin: {
    relationshipVerbatim: "Daughter",
    name: null,
    phone: "07712 345678",
  },
};

// The item the primed adherence log misses. Two skipped doses of a high-stakes
// anticoagulant is the history the escalation rule needs, and it would
// otherwise take three real days to accrue.
export const DEMO_MISSED_ITEM_ID = "med-apixaban";
