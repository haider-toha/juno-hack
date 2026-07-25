import { z } from "zod";

// The extraction contract — what a model may return, what Redis stores, and
// what every screen renders. Both tracks read it, so it is frozen after
// Checkpoint 1: it has no `.default()` and no `.optional()`, so any change
// invalidates every stored bundle and forces a reseed.
//
// Three constraints, each load-bearing:
//   - `.nullable()` everywhere, never `.optional()`. Structured-output modes
//     require every property present, so absence has to be `T | null`. It also
//     makes "the letter did not say" representable rather than an afterthought.
//   - No `.default()` and no `.transform()`. A default hides the difference
//     between "the letter said none" and "the model said nothing".
//   - Discriminated unions for every variant, so illegal states are
//     unrepresentable and the renderer's `switch` is exhaustive.

const ReadConfidence = z.enum(["clear", "unclear"]);

// The locator behind "show me where it says that". The QUOTE is primary, not a
// character offset: offsets die on any re-run of OCR, a quote is stable,
// greppable against the document text and human-verifiable on screen. `page` is
// a navigation hint. `documentId` resolves to `documents[]` — the URL is not
// duplicated here, so re-uploading a clearer photo updates every reference at
// once.
const SourceRef = z.object({
  documentId: z.string(),
  page: z.number().int().positive().nullable(),
  quote: z.string().min(1),
  readConfidence: ReadConfidence,
});

// Three variants, all observed in the corpus. `conditional` is what stops a
// model inventing a stop date for a drug described as "until your mobility
// returns to normal".
const DateAnchor = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("offset"),
    from: z.enum(["discharge", "procedure", "upload"]),
    days: z.number().int(),
    // Non-null for ranges: "2 to 3 weeks" -> days 14, daysUntil 21.
    daysUntil: z.number().int().nullable(),
    approximate: z.boolean(),
    verbatim: z.string().min(1),
  }),
  z.object({
    kind: z.literal("date"),
    date: z.iso.date(),
    time: z.string().nullable(),
    // Every absolute follow-up date in the corpus is written `~05/09/2026`.
    // The clinician hedged in their own punctuation; rendering a firm date
    // would present a precision they denied.
    approximate: z.boolean(),
    verbatim: z.string().min(1),
  }),
  z.object({
    kind: z.literal("conditional"),
    verbatim: z.string().min(1),
  }),
]);

const EnteredBy = z.enum(["extracted", "patient_added"]);

const SourceDocument = z.object({
  id: z.string(),
  kind: z.enum([
    "discharge_summary",
    "medication_list",
    "medicine_label",
    "wound_care_advice",
    "physio_advice",
    "appointment_letter",
    "alert_card",
    "unknown",
  ]),
  displayName: z.string(),
  capture: z.enum(["photo", "pdf", "scan"]),
  pageCount: z.number().int().positive().nullable(),
  // Storage identity. NOT produced by the model — upload writes to Blob first,
  // then the known documents are passed into the extraction prompt and these
  // two are merged back in after parse. Asking a model for a URL is asking it
  // to invent one, which is why `ExtractedBundleFromModel` omits them.
  blobUrl: z.url(),
  blobPathname: z.string().min(1),
});

const Patient = z.object({
  givenName: z.string().nullable(),
  preferredLanguage: z.string().nullable(), // BCP-47
  redactedByPolicy: z.array(z.string()), // field NAMES only, never values
});

const Episode = z.object({
  kind: z.enum(["surgical", "medical", "other"]),
  titleVerbatim: z.string().nullable(),
  titlePlain: z.string().nullable(),
  dischargeDate: z.iso.date().nullable(), // the primary timeline anchor
  procedureDate: z.iso.date().nullable(),
  dischargingTeamVerbatim: z.string().nullable(),
  source: SourceRef.nullable(),
});

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
  // Letters routinely name three numbers for one symptom list, split by time
  // of day.
  hoursVerbatim: z.string().nullable(),
  source: SourceRef,
});

// Thin by design — `lib/drugs/` owns everything past this.
const DrugLookupKey = z.object({
  normalisedName: z.string().min(1),
  form: z.string().nullable(),
  strength: z.string().nullable(),
  nameConfidence: ReadConfidence,
});

const Medication = z.object({
  id: z.string(),
  nameAsWritten: z.string().min(1),
  lookupKey: DrugLookupKey.nullable(), // null for devices, e.g. TED stockings

  // The national standard's primary field. Never null — if the directions
  // cannot be read we do not have a medication record, we have an `unresolved`
  // entry. NHS discharge forms are table-shaped and carry no directions
  // sentence, so this is assembled from the dose/frequency/route cells.
  doseDirectionsVerbatim: z.string().min(1),

  dose: z.string().nullable(),
  route: z.string().nullable(),
  schedule: z.object({
    timesPerDay: z.number().int().positive().nullable(),
    // Empty array means "the letter did not say". Distinct from null.
    timesOfDay: z.array(z.enum(["morning", "midday", "evening", "night"])),
    // Weekly dosing: the corpus carries "Alendronic acid 70mg ... Weekly", and
    // `timesPerDay` alone renders a weekly bisphosphonate as a daily task.
    everyDays: z.number().int().positive().nullable(),
    verbatim: z.string().nullable(),
  }),
  withFood: z.enum(["with", "without", "either", "not_stated"]),

  duration: z.object({
    start: DateAnchor.nullable(),
    end: DateAnchor.nullable(), // null for "Ongoing" / "Regular"
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
  purposePlain: z.string().nullable(),

  escalationClass: z.enum(["standard", "high_stakes"]),
  escalationClassSource: z.enum(["letter_flagged", "configured_class_list"]),

  enteredBy: EnteredBy,
  source: SourceRef,
});

const Instruction = z.object({
  id: z.string(),
  kind: z.enum([
    "wound_care",
    "activity",
    "exercise",
    "appointment_prep",
    "other",
  ]),
  titlePlain: z.string().nullable(),
  detailVerbatim: z.string().min(1),
  anchor: DateAnchor.nullable(), // null => standing, undated
  recurrence: z
    .object({
      timesPerDay: z.number().int().positive().nullable(),
      everyDays: z.number().int().positive(),
      until: DateAnchor.nullable(),
    })
    .nullable(),
  // Drives the voice script: "did you..." vs "has someone been to...".
  actor: z.enum(["patient", "carer", "clinician"]),
  contactIds: z.array(z.string()),
  enteredBy: EnteredBy,
  source: SourceRef,
});

const Appointment = z.object({
  id: z.string(),
  withVerbatim: z.string().min(1),
  when: DateAnchor,
  locationVerbatim: z.string().nullable(),
  // False when the letter only promises contact ("Physiotherapy will contact
  // you within 2 to 3 weeks") rather than giving a slot.
  isBooked: z.boolean(),
  contactIds: z.array(z.string()),
  enteredBy: EnteredBy,
  source: SourceRef,
});

const RedFlag = z.object({
  id: z.string(),
  triggerVerbatim: z.string().min(1),
  actionVerbatim: z.string().min(1),
  // Hand-authored alongside the verbatim English, never machine-translated at
  // runtime, and never replacing it. Null means "no French authored yet", which
  // the French card must say in French — it must not fall through to English.
  triggerFr: z.string().nullable(),
  actionFr: z.string().nullable(),
  contactIds: z.array(z.string()),
  // A function of the recipient named in `actionVerbatim` ONLY, never of the
  // symptom. Where the letter names a ladder, take its most urgent rung.
  escalationChannel: EscalationChannel,
  // The only place the model writes symptom words: retrieval keys for routing
  // speech to this line. Never rendered, never spoken.
  matchHints: z.array(z.string()),
  relatedMedicationIds: z.array(z.string()),
  source: SourceRef,
});

// The honesty channel. An empty `unresolved` on a real letter is a claim, not a
// default — it says the model found nothing it could not read.
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

const bundleShape = z.object({
  schemaVersion: z.literal("portico-extract/1"),
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
    unresolved: z.array(Unresolved),
    conflicts: z.array(Conflict),
  }),
});

type BundleShape = z.infer<typeof bundleShape>;

type Reference = { path: Array<string | number>; id: string };

// Every document reference in the bundle, wherever it lives.
function documentRefs(bundle: BundleShape): Reference[] {
  const refs: Reference[] = [];

  if (bundle.episode.source) {
    refs.push({
      path: ["episode", "source", "documentId"],
      id: bundle.episode.source.documentId,
    });
  }
  const sourced = [
    ["contacts", bundle.contacts],
    ["medications", bundle.medications],
    ["instructions", bundle.instructions],
    ["appointments", bundle.appointments],
    ["redFlags", bundle.redFlags],
  ] as const;
  for (const [key, items] of sourced) {
    items.forEach((item, i) => {
      refs.push({
        path: [key, i, "source", "documentId"],
        id: item.source.documentId,
      });
    });
  }
  bundle.extraction.unresolved.forEach((item, i) => {
    if (item.documentId) {
      refs.push({
        path: ["extraction", "unresolved", i, "documentId"],
        id: item.documentId,
      });
    }
  });
  bundle.extraction.conflicts.forEach((conflict, i) => {
    conflict.positions.forEach((position, j) => {
      refs.push({
        path: ["extraction", "conflicts", i, "positions", j, "documentId"],
        id: position.documentId,
      });
    });
  });

  return refs;
}

// Every contact reference. Three shapes carry one, and all three render the
// same way.
function contactRefs(bundle: BundleShape): Reference[] {
  const refs: Reference[] = [];
  const referring = [
    ["instructions", bundle.instructions],
    ["appointments", bundle.appointments],
    ["redFlags", bundle.redFlags],
  ] as const;
  for (const [key, items] of referring) {
    items.forEach((item, i) => {
      item.contactIds.forEach((id, j) => {
        refs.push({ path: [key, i, "contactIds", j], id });
      });
    });
  }
  return refs;
}

function medicationRefs(bundle: BundleShape): Reference[] {
  return bundle.redFlags.flatMap((flag, i) =>
    flag.relatedMedicationIds.map((id, j) => ({
      path: ["redFlags", i, "relatedMedicationIds", j],
      id,
    })),
  );
}

// Referential integrity. A dangling id parses cleanly and only fails on stage.
// A `documentId` fails visibly — "tap to see where it says that" resolves to
// nothing. A `contactId` fails invisibly, and worse: the red-flag card prints
// "your letter does not say who to contact for this", the same sentence it
// prints when the letter genuinely named nobody, over a flag whose action is
// "call the ward on 0123 456 7890".
export const ExtractedBundle = bundleShape.superRefine((bundle, ctx) => {
  const collections = [
    [
      "documents",
      new Set(bundle.documents.map((document) => document.id)),
      documentRefs(bundle),
    ],
    [
      "contacts",
      new Set(bundle.contacts.map((contact) => contact.id)),
      contactRefs(bundle),
    ],
    [
      "medications",
      new Set(bundle.medications.map((medication) => medication.id)),
      medicationRefs(bundle),
    ],
  ] as const;

  for (const [name, known, refs] of collections) {
    for (const ref of refs) {
      if (!known.has(ref.id)) {
        ctx.addIssue({
          code: "custom",
          path: ref.path,
          message: `"${ref.id}" is not in ${name}[]`,
        });
      }
    }
  }
});

export type ExtractedBundle = z.infer<typeof ExtractedBundle>;

// What the model is asked for: the same shape minus the storage identity it
// cannot know. Deliberately unrefined — a dangling reference from the model is
// caught by the full-bundle parse after the merge, which is a different failure
// with a different message than "the model produced nothing schema-shaped".
export const ExtractedBundleFromModel = bundleShape.extend({
  documents: z.array(
    SourceDocument.omit({ blobUrl: true, blobPathname: true }),
  ),
});

export type ExtractedBundleFromModel = z.infer<typeof ExtractedBundleFromModel>;

export type SourceRef = z.infer<typeof SourceRef>;
export type SourceDocument = z.infer<typeof SourceDocument>;
export type DateAnchor = z.infer<typeof DateAnchor>;
export type Medication = z.infer<typeof Medication>;
export type Instruction = z.infer<typeof Instruction>;
export type Appointment = z.infer<typeof Appointment>;
export type RedFlag = z.infer<typeof RedFlag>;
export type Contact = z.infer<typeof Contact>;
export type EscalationChannel = z.infer<typeof EscalationChannel>;
