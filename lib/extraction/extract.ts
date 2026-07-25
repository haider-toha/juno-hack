import "server-only";

import { anthropic } from "@ai-sdk/anthropic";
import { get } from "@vercel/blob";
import { generateText } from "ai";
import { z } from "zod";

import { blobEnv, env, llmEnv } from "../env";
import { DEMO_PLAN } from "../plan/samples/demo-plan";
import { ExtractedBundle, ExtractedBundleFromModel } from "../plan/schema";

// Straight to the Anthropic API rather than through a gateway. Haiku is the
// cheapest model that reads a two-page discharge PDF, and `make eval` is what
// says whether it reads one well enough. Recorded on every bundle as
// `extraction.modelId`, so a plan on screen can always name what read it.
const MODEL_ID = "claude-haiku-4-5";

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

// The provider's strict structured-output mode refuses this schema: every
// clinical field is `.nullable()`, which compiles to 51 union-typed parameters
// and exceeds its ceiling. The constraint producing those unions is the one
// that makes absence representable, so the schema stays frozen and the shape is
// asked for in the prompt instead — generation is still schema-guided, and both
// 422 surfaces are raised in this file rather than by the SDK.
const OUTPUT_CONTRACT = `Reply with one JSON object and nothing else: no sentence before or after it, and no markdown fence. It must validate against this JSON Schema.

${JSON.stringify(z.toJSONSchema(ExtractedBundleFromModel, { target: "draft-7" }))}`;

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
  // Anthropic 401 halfway through a patient's upload.
  llmEnv();

  const ided = documents.map((document, index) => ({
    ...document,
    id: `doc-${index + 1}`,
  }));
  const files = await Promise.all(ided.map(readBytes));

  // The contract goes last, after the pages, because it is the instruction the
  // model acts on immediately.
  const result = await generateText({
    model: anthropic(MODEL_ID),
    system: SYSTEM_PROMPT,
    maxOutputTokens: 24000,
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
          { type: "text", text: OUTPUT_CONTRACT },
        ],
      },
    ],
  });

  // Models fence JSON even when told not to. That is a formatting habit, not a
  // failure to read the letter, so the fence comes off before the parse instead
  // of becoming a 422.
  const text = result.text.trim();
  const json = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(text)?.[1] ?? text;

  let candidate: unknown;
  try {
    candidate = JSON.parse(json);
  } catch (error) {
    return {
      kind: "unreadable",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const output = ExtractedBundleFromModel.safeParse(candidate);
  if (!output.success) {
    return { kind: "unreadable", detail: describeIssues(output.error) };
  }

  const merged = mergeStorageIdentity(output.data, ided);
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
        modelId: MODEL_ID,
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

Plain-language fields (titlePlain, purposePlain, and the red-flag French) are yours to write, in clear everyday English or French, at the reading level of an anxious eighty-year-old. Never put clinical jargon in a Plain field, and never put your own words in a Verbatim one.

PATIENT IDENTITY
patient.givenName is the patient's first name and nothing else. The letter also carries their surname, date of birth, NHS number, address and telephone number. Read them, store none of them, and list the field NAME of each one the letter carries in patient.redactedByPolicy, using exactly these spellings: "surname", "dateOfBirth", "nhsNumber", "address", "telephone". That array holds names, never values — a value written into it is the leak the field exists to prevent.

SOURCE REFS
Every source ref carries a quote that appears in the document it names, and the page that quote is on. The quote is what the patient will be shown when they tap "where does it say that", so a quote that is not on the page is a broken promise, not a formatting slip. Prefer a short, distinctive, contiguous run of text over a long one that spans a column break.

WHAT THIS FORM DOES NOT HAVE
The NHS discharge form is a table. It has no directions sentence per drug, so assemble doseDirectionsVerbatim from that row's cells in the order dose, frequency, route, duration, comma separated — for a row reading "1 tab | BD | Oral | Ongoing" that is "1 tab, BD, Oral, Ongoing".

It has no indication column. Only set indicationVerbatim when the letter itself ties that named drug to a condition somewhere on the page — a diagnosis line naming the drug, or a narrative sentence naming it. A drug's usual purpose is not evidence. When indicationVerbatim is null, purposePlain must be null too, and the drug gets an unresolved entry with reason "absent_from_bundle".

DATES
Rewrite every date as YYYY-MM-DD. A leading tilde ("~05/09/2026") is the clinician hedging: set approximate true and keep the tilde in verbatim. "in 6 weeks" is an offset of 42 days from discharge. "within 2 weeks" is an offset with days 0 and daysUntil 14. "2 to 3 weeks" is days 14, daysUntil 21. A duration described by a condition rather than a date ("until your mobility returns") is a conditional anchor with no numbers at all. "Ongoing" or "Regular" means duration.end is null — it is not a conditional anchor, because the letter names no condition.

MEDICATIONS
A withheld or stopped drug has no duration.start: it is on the list but it is not to be taken. Record why in changeNoteVerbatim, and if the letter both lists it and withholds it, that is a genuine conflicts[] entry.

schedule.timesOfDay is only filled when the letter names a time — "Nocte" means night, "Mane" morning. A frequency like OD or BD says how often, not when, so leave timesOfDay empty and add an unresolved entry. "PRN" means as required: leave timesPerDay null. Weekly dosing sets everyDays to 7.

escalationClass is "high_stakes" for anticoagulants, opioids, insulin and bisphosphonates, with escalationClassSource "configured_class_list". Use "letter_flagged" only when the letter itself singles the drug out as high risk.

RED FLAGS
A red flag is a pair: a trigger (what to watch for) and an action (what to do). escalationChannel is a function of the recipient the ACTION names, never of how alarming the symptom sounds. "call 999" is "999". "contact GP or 111" then "call 999 if severe" is a ladder — take its most urgent rung. "seek urgent help", naming nobody, is "other", and contactIds stays empty. Do not upgrade a vague instruction to 999 because the symptom sounds serious; that is you speaking, not the doctor.

matchHints are everyday words a patient might say for that trigger, for routing speech. They are never shown or spoken.

triggerFr and actionFr are your French translation of the trigger and the action, for a patient reading in French. Translate the meaning faithfully and keep clinical proper nouns (drug names, "999", "111", "GP") untranslated. The English is always shown next to it, so never paraphrase away a specific instruction.

THE HONESTY CHANNEL
extraction.unresolved is where the letter's gaps go: one entry per field you could not fill, with the reason and a short note a patient could read. extraction.conflicts is for two places in the bundle that genuinely disagree. Both may be empty, but an empty unresolved on a real discharge letter is a claim that the letter answered everything, so make sure that is true before you leave it empty.

extraction.extractedAt and extraction.modelId are overwritten by the server. Emit any valid values.`;
