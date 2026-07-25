import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { put } from "@vercel/blob";
import { Redis } from "@upstash/redis";

// Measures the real extraction against the medic's gold labels. This is what
// lets us say the AI works with a number instead of a vibe, and it is the only
// thing that licenses demo mode's baked bundle: a recording of a capability we
// have demonstrated, not a substitute for having it.
//
// Node 26 strips types natively, so this is a plain `.ts` file run by `node` —
// no test runner. It drives the shipped `/api/extract` over HTTP rather than
// importing the extractor, so what it scores is what the phone would get.
//
//   make eval

const CORPUS = "fixtures/discharge-summaries";
const BASE_URL = process.env.PORTICO_URL ?? "http://localhost:3000";

// Five families, scored separately. A single blended percentage hides the
// failures that matter: a dropped drug and a slightly-off dose are not the same
// kind of wrong.
const FAMILIES = [
  { key: "identity", label: "Patient identity", threshold: 1 },
  { key: "medNames", label: "Medication names (recall)", threshold: 1 },
  { key: "medDetail", label: "Dose, frequency, route", threshold: 0.9 },
  { key: "appointments", label: "Appointments (recall)", threshold: 1 },
  { key: "redFlags", label: "Red-flag quotes in the PDF", threshold: 1 },
  { key: "sourceRefs", label: "Source refs resolve and quote", threshold: 1 },
] as const;

type FamilyKey = (typeof FAMILIES)[number]["key"];
type Score = { hit: number; total: number; misses: string[] };
type Letter = { id: string; pdf: string; gold: Record<string, unknown> };

// Whitespace- and punctuation-insensitive. The NHS form wraps values across
// lines and columns, so a naive `includes()` reports text that is plainly on
// the page as missing.
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pdfText(path: string): string {
  // Not `-layout`: it pads columns inside lines and scores worse, turning
  // "2 puffs" into "2puffs".
  return execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
}

function loadCorpus(): Letter[] {
  return readdirSync(CORPUS)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({
      id: basename(name, ".json"),
      pdf: join(CORPUS, name.replace(/\.json$/, ".pdf")),
      gold: JSON.parse(readFileSync(join(CORPUS, name), "utf8")) as Record<
        string,
        unknown
      >,
    }));
}

async function extract(letter: Letter, token: string) {
  const pathname = `eval/${letter.id}.pdf`;
  const blob = await put(pathname, readFileSync(letter.pdf), {
    access: "private",
    contentType: "application/pdf",
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });

  const patientId = `eval-${letter.id}`;
  const response = await fetch(`${BASE_URL}/api/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      patientId,
      documents: [
        {
          pathname: blob.pathname,
          url: blob.url,
          contentType: "application/pdf",
          displayName: `${letter.id}.pdf`,
        },
      ],
    }),
  });

  // An infrastructure failure is left to throw inside the route, so the body
  // may be Next's HTML error page rather than JSON. Reading it as text first
  // means the harness reports what actually went wrong instead of a parse
  // error about the report.
  const raw = await response.text();
  const body: unknown = raw.startsWith("{") ? JSON.parse(raw) : raw;
  if (!response.ok) {
    const detail =
      typeof body === "string" ? firstLine(body) : JSON.stringify(body);
    throw new Error(`HTTP ${response.status} — ${detail}`);
  }
  // Demo mode returns the baked Whitfield bundle for every letter, which would
  // score four letters against the wrong patient and the fifth against itself.
  if (isRecord(body) && body.mode === "demo") {
    throw new Error(
      "the server is in demo mode; run with NEXT_PUBLIC_PORTICO_MODE=live",
    );
  }
  return patientId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// An HTML error page is thousands of lines; the useful part is at the top.
function firstLine(body: string): string {
  return body.trim().split("\n")[0]?.slice(0, 200) ?? "(empty response body)";
}

function get(source: unknown, ...path: string[]): unknown {
  let cursor = source;
  for (const key of path) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// ── Families ────────────────────────────────────────────────────────────────

// The schema stores a first name and nothing else identifying: surname, date of
// birth, NHS number and address are read and deliberately discarded. So this
// scores the one identifier we keep, and checks the rest are declared as
// dropped rather than quietly missing.
function scoreIdentity(bundle: unknown, gold: Letter["gold"]): Score {
  const misses: string[] = [];
  let hit = 0;

  const expected = squash(asString(get(gold, "patient_details", "forename")));
  const actual = squash(asString(get(bundle, "patient", "givenName")));
  if (expected === actual) hit += 1;
  else misses.push(`forename: expected "${expected}", got "${actual}"`);

  const redacted = asArray(get(bundle, "patient", "redactedByPolicy")).map(
    asString,
  );
  for (const field of ["surname", "dateOfBirth", "nhsNumber"]) {
    if (redacted.includes(field)) hit += 1;
    else misses.push(`${field} is neither stored nor declared as redacted`);
  }
  return { hit, total: 4, misses };
}

// A dropped drug is the dangerous failure, so names are scored as recall on the
// gold list and held at 100%.
function scoreMedNames(bundle: unknown, gold: Letter["gold"]): Score {
  const ours = asArray(get(bundle, "medications")).map((medication) =>
    squash(asString(get(medication, "nameAsWritten"))),
  );
  const goldMeds = asArray(gold.discharge_medications);
  const misses: string[] = [];
  let hit = 0;

  for (const medication of goldMeds) {
    const name = squash(asString(get(medication, "name")));
    if (
      ours.some(
        (candidate) => candidate.includes(name) || name.includes(candidate),
      )
    ) {
      hit += 1;
    } else {
      misses.push(`missing drug: ${asString(get(medication, "name"))}`);
    }
  }
  return { hit, total: goldMeds.length, misses };
}

function scoreMedDetail(bundle: unknown, gold: Letter["gold"]): Score {
  const ours = asArray(get(bundle, "medications"));
  const misses: string[] = [];
  let hit = 0;
  let total = 0;

  for (const medication of asArray(gold.discharge_medications)) {
    const name = squash(asString(get(medication, "name")));
    const match = ours.find((candidate) => {
      const written = squash(asString(get(candidate, "nameAsWritten")));
      return written.includes(name) || name.includes(written);
    });
    if (match === undefined) continue;

    const checks: Array<[string, string, string]> = [
      ["dose", asString(get(medication, "dose")), asString(get(match, "dose"))],
      [
        "frequency",
        asString(get(medication, "frequency")),
        asString(get(match, "schedule", "verbatim")),
      ],
      [
        "route",
        asString(get(medication, "route")),
        asString(get(match, "route")),
      ],
    ];
    for (const [field, expected, actual] of checks) {
      total += 1;
      if (squash(expected) === squash(actual)) hit += 1;
      else {
        misses.push(
          `${asString(get(medication, "name"))} ${field}: expected "${expected}", got "${actual}"`,
        );
      }
    }
  }
  return { hit, total, misses };
}

// Never silently lose a follow-up. Each gold action must appear as an
// appointment carrying the same date and the same responsible party.
function scoreAppointments(bundle: unknown, gold: Letter["gold"]): Score {
  const appointments = asArray(get(bundle, "appointments"));
  const contacts = new Map(
    asArray(get(bundle, "contacts")).map((contact) => [
      asString(get(contact, "id")),
      squash(asString(get(contact, "labelVerbatim"))),
    ]),
  );
  const actions = Object.values(
    (get(gold, "actions_and_outstanding_investigations") ?? {}) as Record<
      string,
      unknown
    >,
  );

  const misses: string[] = [];
  let hit = 0;
  let total = 0;

  for (const action of actions) {
    const date = squash(asString(get(action, "date")));
    const owner = squash(asString(get(action, "person_responsible")));
    if (date === "") continue;

    total += 2;
    const dated = appointments.filter((appointment) =>
      squash(asString(get(appointment, "when", "verbatim"))).includes(date),
    );
    if (dated.length === 0) {
      misses.push(`no appointment dated "${asString(get(action, "date"))}"`);
      continue;
    }
    hit += 1;

    const named = dated.some((appointment) =>
      asArray(get(appointment, "contactIds"))
        .map((id) => contacts.get(asString(id)) ?? "")
        .some((label) => label.includes(owner) || owner.includes(label)),
    );
    if (named) hit += 1;
    else {
      misses.push(
        `appointment "${asString(get(action, "date"))}" does not name ${asString(get(action, "person_responsible"))}`,
      );
    }
  }
  return { hit, total, misses };
}

// Everything Portico says is meant to be the clinician's own words. A quote
// that is not in the document is a hallucination, so one occurrence fails.
function scoreRedFlags(bundle: unknown, text: string): Score {
  const squashed = squash(text);
  const misses: string[] = [];
  let hit = 0;
  let total = 0;

  for (const flag of asArray(get(bundle, "redFlags"))) {
    for (const field of ["triggerVerbatim", "actionVerbatim"]) {
      const quote = asString(get(flag, field));
      total += 1;
      if (squashed.includes(squash(quote))) hit += 1;
      else misses.push(`${field} not in the PDF: "${quote}"`);
    }
  }
  return { hit, total, misses };
}

function scoreSourceRefs(bundle: unknown, text: string): Score {
  const squashed = squash(text);
  const documentIds = new Set(
    asArray(get(bundle, "documents")).map((document) =>
      asString(get(document, "id")),
    ),
  );
  const misses: string[] = [];
  let hit = 0;
  let total = 0;

  for (const [path, ref] of sourceRefs(bundle)) {
    total += 2;
    if (documentIds.has(asString(get(ref, "documentId")))) hit += 1;
    else misses.push(`${path}: dangling documentId`);

    const quote = asString(get(ref, "quote"));
    if (squashed.includes(squash(quote))) hit += 1;
    else misses.push(`${path}: quote not in the PDF: "${quote.slice(0, 60)}"`);
  }
  return { hit, total, misses };
}

function sourceRefs(bundle: unknown): Array<[string, unknown]> {
  const refs: Array<[string, unknown]> = [];
  const episode = get(bundle, "episode", "source");
  if (isRecord(episode)) refs.push(["episode.source", episode]);
  for (const key of [
    "contacts",
    "medications",
    "instructions",
    "appointments",
    "redFlags",
  ]) {
    asArray(get(bundle, key)).forEach((item, index) => {
      const ref = get(item, "source");
      if (isRecord(ref)) refs.push([`${key}[${index}].source`, ref]);
    });
  }
  return refs;
}

// ── Run ─────────────────────────────────────────────────────────────────────

function bar(score: Score, threshold: number): string {
  if (score.total === 0) return "     n/a";
  const rate = score.hit / score.total;
  const pass = rate >= threshold ? "pass" : "FAIL";
  return `${String(Math.round(rate * 100)).padStart(3)}% ${pass}`;
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!token || !redisUrl || !redisToken) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN, UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set",
    );
  }
  const redis = new Redis({ url: redisUrl, token: redisToken });

  const letters = loadCorpus();
  console.log(`Scoring ${letters.length} letters against ${BASE_URL}\n`);

  const results = new Map<string, Record<FamilyKey, Score>>();
  const failures: string[] = [];

  for (const letter of letters) {
    process.stdout.write(`  ${letter.id} … `);
    let bundle: unknown;
    try {
      const patientId = await extract(letter, token);
      bundle = await redis.get<unknown>(`portico:plan:${patientId}`);
      if (bundle === null)
        throw new Error("nothing was stored for this letter");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.log("extraction failed");
      failures.push(`${letter.id}: ${detail}`);
      continue;
    }

    const text = pdfText(letter.pdf);
    results.set(letter.id, {
      identity: scoreIdentity(bundle, letter.gold),
      medNames: scoreMedNames(bundle, letter.gold),
      medDetail: scoreMedDetail(bundle, letter.gold),
      appointments: scoreAppointments(bundle, letter.gold),
      redFlags: scoreRedFlags(bundle, text),
      sourceRefs: scoreSourceRefs(bundle, text),
    });
    console.log("done");
  }

  console.log();
  const width = Math.max(...FAMILIES.map((family) => family.label.length));
  const ids = [...results.keys()];
  console.log(
    `${"Family".padEnd(width)}  ${ids.map((id) => id.slice(0, 12).padStart(12)).join("  ")}`,
  );

  let missed = 0;
  for (const family of FAMILIES) {
    const cells = ids.map((id) => {
      const score = results.get(id)?.[family.key];
      if (score === undefined) return "         —";
      if (score.total > 0 && score.hit / score.total < family.threshold) {
        missed += 1;
      }
      return bar(score, family.threshold).padStart(12);
    });
    console.log(`${family.label.padEnd(width)}  ${cells.join("  ")}`);
  }

  console.log();
  for (const [id, scores] of results) {
    for (const family of FAMILIES) {
      const score = scores[family.key];
      if (score.misses.length === 0) continue;
      console.log(`${id} — ${family.label}`);
      for (const miss of score.misses) console.log(`    ${miss}`);
    }
  }

  for (const failure of failures) console.log(`EXTRACTION FAILED  ${failure}`);

  // Whitfield's gold JSON was used to write the seed fixture, so its score is
  // not an independent measurement and must not be quoted as one.
  console.log(
    "\nNote: 02_Whitfield's gold labels were used to author the seed, so its row is not independent.",
  );

  if (missed > 0 || failures.length > 0) {
    console.log(
      `\n${missed} threshold(s) missed, ${failures.length} letter(s) failed to extract.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log("\nAll thresholds met.");
}

await main();
