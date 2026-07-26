import "server-only";

import { openai } from "@ai-sdk/openai";
import { get } from "@vercel/blob";
import {
  generateText,
  jsonSchema,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  zodSchema,
} from "ai";
import { z } from "zod";

import { blobEnv, env, openAiEnv } from "../env";
import { DEMO_PLAN } from "../plan/samples/demo-plan";
import { ExtractedBundle, ExtractedBundleFromModel } from "../plan/schema";

// Straight to the OpenAI API rather than through a gateway. `make eval` is what
// says which model reads a two-page discharge PDF well enough, and it ruled out
// the two cheaper tiers on this same prompt: gpt-5.4-nano held identity, drug
// names, dose and red flags but swung between 71% and 100% on source quotes,
// and gpt-5.4-mini took the other five families to 100% on every letter yet
// still dropped one quote in roughly every other run — which fails a family
// scored at 100%. This is the cheapest tier that came back green three times
// with nothing to explain away. What the bundle records is the id the API
// reports back rather than this constant — on the 5.4 tier that is a dated
// snapshot — so a plan on screen names the build that read it rather than the
// pointer we asked for.
const MODEL_ID = "gpt-5.6-luna";

// What the browser tells us it uploaded. A trust boundary — this arrives from a
// client that could send anything — so it is parsed before a single byte is
// fetched.
export const UploadedDocument = z.object({
  pathname: z.string().min(1),
  url: z.url(),
  contentType: z.string().min(1),
  displayName: z.string().min(1),
});

export type UploadedDocument = z.infer<typeof UploadedDocument>;

// Two failure surfaces, deliberately not collapsed into one. They mean
// different things to whoever is holding the phone: one says "that does not
// look like a discharge letter", the other says "the letter was read but what
// came back does not hold together". Neither ever becomes a plan.
export type ExtractionResult =
  | { kind: "extracted"; bundle: ExtractedBundle }
  | { kind: "unreadable"; detail: string }
  | { kind: "invalid"; detail: string };

// OpenAI's strict mode constrains generation to this schema, so the shape is
// no longer described in the prompt and the model cannot answer with anything
// else. It takes the bundle as-is against every ceiling it publishes — 193
// properties against 5000, four levels of nesting against five, 98 enum values
// against 1000 — with one exception: it permits `anyOf` and rejects `oneOf`,
// and Zod compiles a discriminated union to `oneOf`. Both accept the same
// documents here, because a discriminated union's branches are mutually
// exclusive by construction, so the five `DateAnchor` sites are rewritten and
// `lib/plan/schema.ts` stays frozen. Nothing else needs touching: no field is
// `.optional()`, so every object already emits as fully `required` with
// `additionalProperties: false`, which is exactly what strict mode demands.
const OUTPUT_SCHEMA = jsonSchema(async () => {
  const schema = await zodSchema(ExtractedBundleFromModel).jsonSchema;
  oneOfToAnyOf(schema);
  return schema;
});

function oneOfToAnyOf(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) oneOfToAnyOf(item);
    return;
  }
  if (!isBranch(node)) return;
  if (Array.isArray(node.oneOf)) {
    node.anyOf = node.oneOf;
    delete node.oneOf;
  }
  for (const value of Object.values(node)) oneOfToAnyOf(value);
}

function isBranch(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function extractBundle(
  documents: UploadedDocument[],
): Promise<ExtractionResult> {
  // Demo mode is a human-set config switch, and this is the only place it is
  // read. It is checked BEFORE the model call, never after one fails: no catch
  // below may reach the baked bundle, or a live failure would quietly serve a
  // plan belonging to a different patient. The bundle records
  // `modelId: "seed/…"`, so what is on screen names what produced it.
  if (env.NEXT_PUBLIC_PORTICO_MODE === "demo") {
    return { kind: "extracted", bundle: DEMO_PLAN };
  }

  // Asserted here, at the config boundary, rather than left to surface as an
  // OpenAI 401 halfway through a patient's upload.
  openAiEnv();

  const ided = documents.map((document, index) => ({
    ...document,
    id: `doc-${index + 1}`,
  }));
  const files = await Promise.all(ided.map(readBytes));

  let generated: { modelId: string; output: unknown };
  try {
    const result = await generateText({
      model: openai(MODEL_ID),
      system: SYSTEM_PROMPT,
      maxOutputTokens: 32000,
      output: Output.object({ schema: OUTPUT_SCHEMA }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: documentManifest(ided) },
            ...files.map((file) => ({
              type: "file" as const,
              data: file.bytes,
              mediaType: file.mediaType,
              filename: file.filename,
            })),
          ],
        },
      ],
    });
    generated = { modelId: result.response.modelId, output: result.output };
  } catch (error) {
    // The two ways constrained decoding still ends without an object: the run
    // ran into `maxOutputTokens` mid-JSON, or what came back would not parse.
    // Both mean the letter was not read. Everything else — a 401, a rate
    // limit, a dropped connection — is rethrown, because telling a patient we
    // could not find a discharge letter in their pages when the real cause was
    // an expired key is a lie the screen cannot be corrected from.
    if (
      !NoObjectGeneratedError.isInstance(error) &&
      !NoOutputGeneratedError.isInstance(error)
    ) {
      throw error;
    }
    return { kind: "unreadable", detail: error.message };
  }

  // Strict mode guarantees the JSON Schema, not the Zod schema behind it: the
  // formats it does not enforce (`date`, `date-time`) and the `min(1)` lengths
  // are checked here or nowhere.
  const output = ExtractedBundleFromModel.safeParse(generated.output);
  if (!output.success) {
    return { kind: "unreadable", detail: describeIssues(output.error) };
  }

  const merged = mergeStorageIdentity(output.data, ided, generated.modelId);
  if (!merged.success) return { kind: "invalid", detail: merged.detail };

  const parsed = ExtractedBundle.safeParse(merged.bundle);
  if (!parsed.success) {
    return { kind: "invalid", detail: describeIssues(parsed.error) };
  }
  return { kind: "extracted", bundle: parsed.data };
}

async function readBytes(document: UploadedDocument & { id: string }) {
  // The store is Private, so the model cannot be handed a URL — an
  // unauthenticated fetch of it 401s. The bytes go inline instead.
  const blob = await get(document.pathname, {
    access: "private",
    token: blobEnv().BLOB_READ_WRITE_TOKEN,
  });
  if (blob === null || blob.statusCode !== 200) {
    throw new Error(`Uploaded file is not in the store: ${document.pathname}`);
  }
  return {
    bytes: new Uint8Array(await new Response(blob.stream).arrayBuffer()),
    mediaType: blob.blob.contentType,
    filename: document.displayName,
  };
}

function documentManifest(
  documents: Array<UploadedDocument & { id: string }>,
): string {
  const lines = documents.map(
    (document, index) =>
      `- id "${document.id}" is attachment ${index + 1}, filename "${document.displayName}"`,
  );
  return `These are the pages of one discharge bundle, in order. Use exactly these ids in documents[].id and in every documentId you write:\n${lines.join("\n")}`;
}

type MergeResult =
  | { success: true; bundle: unknown }
  | { success: false; detail: string };

// `blobUrl` and `blobPathname` are known before the call and are never asked
// for — a model asked for a URL invents one. `extractedAt` and `modelId` are
// overwritten for the same reason: only the server knows them.
function mergeStorageIdentity(
  output: unknown,
  uploaded: Array<UploadedDocument & { id: string }>,
  modelId: string,
): MergeResult {
  const shape = z
    .object({
      documents: z.array(z.object({ id: z.string() }).loose()),
      extraction: z.looseObject({}),
    })
    .loose();
  const base = shape.safeParse(output);
  if (!base.success) {
    return { success: false, detail: describeIssues(base.error) };
  }

  // Checked in both directions. A model that returns only the first page of a
  // four-page bundle parses cleanly and silently drops three — and on an NHS
  // discharge form the whole medication table is on page 2.
  const returned = new Set(base.data.documents.map((document) => document.id));
  const missing = uploaded.filter((document) => !returned.has(document.id));
  if (missing.length > 0) {
    const names = missing
      .map((document) => `"${document.displayName}"`)
      .join(", ");
    return {
      success: false,
      detail: `The model read ${returned.size} of the ${uploaded.length} pages we uploaded and left out ${names}.`,
    };
  }

  const byId = new Map(uploaded.map((document) => [document.id, document]));
  const documents = [];
  for (const document of base.data.documents) {
    const source = byId.get(document.id);
    if (source === undefined) {
      return {
        success: false,
        detail: `The model returned a document id we did not upload: "${document.id}".`,
      };
    }
    documents.push({
      ...document,
      blobUrl: source.url,
      blobPathname: source.pathname,
    });
  }

  return {
    success: true,
    bundle: {
      ...base.data,
      documents,
      extraction: {
        ...base.data.extraction,
        extractedAt: new Date().toISOString(),
        modelId,
      },
    },
  };
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

const SYSTEM_PROMPT = `You are reading an NHS hospital discharge summary on behalf of the patient who was discharged. You produce a structured record of what the letter says. You never produce a record of what a discharge letter usually says.

The single rule everything else follows from: if it is not on the page, it does not go in the output. A plausible value is worse than a null, because the patient cannot tell them apart.

VERBATIM FIELDS
Every field whose name ends in "Verbatim", and every SourceRef.quote, is copied character for character from the document. Do not correct spelling, expand abbreviations, fix punctuation, or tidy spacing inside them. If the letter writes "Ramipril withheld due to AKI - GP to review/restart once renal function stable.", that hyphen and that wording are what you write.

A value that wraps onto a second line is one value and gains no word in the wrapping: "District nurses / Falls" above "team" is "District nurses / Falls team", not "District nurses / Falls a team". Adding a word nobody printed is the same failure as inventing a value, and it is harder to see.

Plain-language fields (titlePlain, purposePlain, and the red-flag French) are yours to write, in clear everyday English or French, at the reading level of an anxious eighty-year-old. Never put clinical jargon in a Plain field, and never put your own words in a Verbatim one.

PATIENT IDENTITY
patient.givenName is the patient's first name and nothing else. The letter also carries their surname, date of birth, NHS number, address and telephone number. Read them, store none of them, and list the field NAME of each one the letter carries in patient.redactedByPolicy, using exactly these spellings: "surname", "dateOfBirth", "nhsNumber", "address", "telephone". That array holds names, never values — a value written into it is the leak the field exists to prevent.

SOURCE REFS
Every source ref carries a quote that appears in the document it names, and the page that quote is on. The quote is what the patient will be shown when they tap "where does it say that", so a quote that is not on the page is a broken promise, not a formatting slip.

Almost everything on this form sits in a table, and a table is where quotes go wrong. Three rules, each for a way this one breaks.

ONE CELL. A row of the medication table reads to the eye as a single line but is seven separate cells, and "Aspirin 75mg 1 tab OD Oral Ongoing 28 tabs" is a run of text that exists nowhere in the document. Quote the drug's own name cell, "Aspirin 75mg", and stop. The follow-up table is three cells across in the same way: "Dr Marchetti's team" and "~15/09/2026" are neighbours on the page and never one quote.

ONE LINE, INSIDE A BOX. Nearly all of this form is boxes set side by side, and wherever a box's text wraps, the box beside it prints into the gap: "Respiratory OP follow-up in 6-8 weeks with" and "spirometry; pulmonary rehabilitation referral." are two lines of one cell with the responsible clinician's name set between them. So a quote taken from any boxed field — the patient and GP header, Diagnosis at Discharge, Operations and Procedures, the ability and function grid, the follow-up table, the medication table — stops at the end of the line it starts on, even mid-sentence.

The full-width paragraphs are the only exception: the clinical narrative, the reason for admission, the investigations, the information given to the patient, and the advice and recommendations to the GP run the width of the page with nothing set beside them, so a sentence there may be quoted across its wrap.

ONE PLACE. Never assemble a quote from two passages that say the same thing in different words. This form states its plan twice — once in the "G.P. Actions" row, again in the advice paragraph below it — and a sentence blended from both is printed in neither.

Short is safe. Six words that are really there beat a whole sentence that is nearly there.

WHAT THIS FORM DOES NOT HAVE
The NHS discharge form is a table. It has no directions sentence per drug, so assemble doseDirectionsVerbatim from that row's cells in the order dose, frequency, route, duration, comma separated — for a row reading "1 tab | BD | Oral | Ongoing" that is "1 tab, BD, Oral, Ongoing". Each of those cells also has a field of its own, holding that one cell and nothing else: dose is "1 tab", schedule.verbatim is "BD", route is "Oral". A cell printed on the page and left null in the output is a value thrown away.

It has no indication column. Only set indicationVerbatim when the letter itself ties that named drug to a condition somewhere on the page — a diagnosis line naming the drug, or a narrative sentence naming it. A drug's usual purpose is not evidence. When indicationVerbatim is null, purposePlain must be null too, and the drug gets an unresolved entry with reason "absent_from_bundle".

THE FOLLOW-UP TABLE
"Actions and Outstanding Investigations" carries one row per follow-up in three columns: Action, Person Responsible, Date. Every row that is not "N/A" across all three is an appointment — including the ones that read like standing advice, because "GP to monitor BP and diabetes control" is the letter's entire record of that follow-up and dropping it loses it.

Per row: withVerbatim is the Action cell. The Person Responsible cell becomes a contact whose labelVerbatim is that cell, and that contact's id goes in the appointment's contactIds. Build that contact from the cell even where the letter names the same clinician elsewhere: "Mr A. Chalmers" in the header and "Mr Chalmers' team / FLS" in the row are two contacts, and the appointment names the row's, because the row is who is answerable for that follow-up.

when comes from the Date cell, and when.verbatim is that cell and nothing else — "~05/09/2026", "Within 2 weeks", "Ongoing". The Action cell usually names an interval of its own ("follow-up in 6 weeks"); that interval belongs in the offset's days, never in the verbatim. A row dated "~03/09/2026" whose appointment reads "6 weeks" has thrown away the only date the letter gave.

All three cells wrap, and this table is boxed, so the source quote stops at the end of its first line: "Respiratory OP follow-up in 6-8 weeks with", not the whole action. Short actions wrap too, and the row's own label prints into the break — "GP review in 2 weeks; no district nursing" is one line and "input required." is the next, with "Services (e.g. nursing," set between them. A sentence that reads whole to the eye is still two lines.

CONTACTS
contacts[] is everyone the letter routes somebody to: the person responsible on a follow-up row, a named team, service or ward, the GP practice, and any telephone number given for a symptom. labelVerbatim is copied from the page.

The source quote for a contact is the name as printed on its own line, with nothing joined to it. The "G.P. Details" box sets the doctor, the practice and the town as separate cells with the patient's address printed between them, so "Dr T. Nguyen," is a quote and "Dr T. Nguyen, Farnborough Medical Practice" is not.

An empty contacts[] on a letter that names a consultant and a practice is not a letter that named nobody; it is a screen that tells the patient nobody is responsible for them.

DATES
Rewrite every date as YYYY-MM-DD. A leading tilde ("~05/09/2026") is the clinician hedging: set approximate true and keep the tilde in verbatim. "in 6 weeks" is an offset of 42 days from discharge. "within 2 weeks" is an offset with days 0 and daysUntil 14. "2 to 3 weeks" is days 14, daysUntil 21. A duration described by a condition rather than a date ("until your mobility returns") is a conditional anchor with no numbers at all. "Ongoing" or "Regular" in a medication's Duration column means duration.end is null — not a conditional anchor, because the letter names no condition. An appointment's when has no null to fall back on, so a follow-up row dated "Ongoing" is a conditional anchor carrying that word as its verbatim.

MEDICATIONS
A withheld or stopped drug has no duration.start: it is on the list but it is not to be taken. Record why in changeNoteVerbatim, and if the letter both lists it and withholds it, that is a genuine conflicts[] entry.

schedule.timesOfDay is only filled when the letter names a time — "Nocte" means night, "Mane" morning. A frequency like OD or BD says how often, not when, so leave timesOfDay empty and add an unresolved entry. "PRN" means as required: leave timesPerDay null. Weekly dosing sets everyDays to 7.

escalationClass is "high_stakes" for anticoagulants, opioids, insulin and bisphosphonates, with escalationClassSource "configured_class_list". Use "letter_flagged" only when the letter itself singles the drug out as high risk.

RED FLAGS
A red flag is a pair: a trigger (what to watch for) and an action (what to do). escalationChannel is a function of the recipient the ACTION names, never of how alarming the symptom sounds. "call 999" is "999". "seek urgent help", naming nobody, is "other", and contactIds stays empty.

Where the letter writes a ladder — "Advised to contact GP/111 if breathless, feverish or coughing blood; call 999 if severe" — actionVerbatim is the WHOLE ladder, every rung, copied as written, and escalationChannel names its most urgent rung. Cropping it to the 999 half deletes the instruction that applies on almost every day the patient is not dying. Do not upgrade a vague instruction to 999 because the symptom sounds serious; that is you speaking, not the doctor.

matchHints are everyday words a patient might say for that trigger, for routing speech. They are never shown or spoken.

triggerFr and actionFr are your French translation of the trigger and the action, for a patient reading in French. Translate the meaning faithfully and keep clinical proper nouns (drug names, "999", "111", "GP") untranslated. The English is always shown next to it, so never paraphrase away a specific instruction.

THE HONESTY CHANNEL
extraction.unresolved is where the letter's gaps go: one entry per field you could not fill, with the reason and a short note a patient could read. extraction.conflicts is for two places in the bundle that genuinely disagree. Both may be empty, but an empty unresolved on a real discharge letter is a claim that the letter answered everything, so make sure that is true before you leave it empty.

extraction.extractedAt and extraction.modelId are overwritten by the server. Emit any valid values.`;
