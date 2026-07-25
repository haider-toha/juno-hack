import "server-only";

import { get } from "@vercel/blob";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import { blobEnv, llmEnv } from "../env";
import { ExtractedBundle, ExtractedBundleFromModel } from "../plan/schema";

// Verified against the gateway's live model list, not remembered. Recorded on
// every bundle as `extraction.modelId`, so a plan on screen can always name
// what read it.
const MODEL_ID = "anthropic/claude-opus-5";

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

export async function extractBundle(
  documents: UploadedDocument[],
): Promise<ExtractionResult> {
  // Asserted here, at the config boundary, rather than left to surface as a
  // gateway 401 halfway through a patient's upload.
  llmEnv();

  const ided = documents.map((document, index) => ({
    ...document,
    id: `doc-${index + 1}`,
  }));
  const files = await Promise.all(ided.map(readBytes));

  let output: unknown;
  try {
    const result = await generateText({
      model: MODEL_ID,
      system: SYSTEM_PROMPT,
      output: Output.object({ schema: ExtractedBundleFromModel }),
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
    output = result.output;
  } catch (error) {
    // The SDK validates inside `Output.object` and throws rather than handing
    // back a parse result, so this is the only place the "nothing
    // schema-shaped came back" case is observable. Anything else — a gateway
    // outage, a bad key — is not an unreadable letter and is left to throw.
    if (!NoObjectGeneratedError.isInstance(error)) throw error;
    return { kind: "unreadable", detail: error.message };
  }

  const merged = mergeStorageIdentity(output, ided);
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
