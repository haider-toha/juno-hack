import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { put } from "@vercel/blob";
import { Redis } from "@upstash/redis";

// Measures the real extraction against the medic's gold labels. This is what
// lets us say the AI works with a number instead of a vibe, and it is the only
// thing that licenses demo mode's baked bundle: a recording of a capability we
// have demonstrated, not a substitute for having it.
//
// Which means the one thing this file must never do is report a pass without
// measuring anything. Every family is scored against the GOLD letter, not
// against our own output, so an empty bundle cannot score 0/0 and vanish into
// an "n/a". A family that ran no checks is a failure; the only score that is
// neither a pass nor a failure is `nothing-to-check`, which is reachable only
// from an empty gold field and is always printed with the reason.
//
// Node 26 strips types natively, so this is a plain `.ts` file run by `node` —
// no test runner. It drives the shipped `/api/extract` over HTTP rather than
// importing the extractor, so what it scores is what the phone would get.
//
//   make eval

const CORPUS = "fixtures/discharge-summaries";
const BASE_URL = process.env.PORTICO_URL ?? "http://localhost:3000";

// `lib/store/keys.ts` is `server-only`, so this script cannot import
// `planKey()` and the prefix has to be spelled a second time.
// `assertPlanKeyPrefix` is what stops the two copies drifting: rename the
// prefix over there and this fails by name, instead of reading back `null` and
// reporting five extraction failures with the wrong cause.
const KEYS_MODULE = "lib/store/keys.ts";
const PLAN_KEY_PREFIX = "portico:plan:";

// Six families, scored separately. A single blended percentage hides the
// failures that matter: a dropped drug and a slightly-off dose are not the same
// kind of wrong, which is why the plan's one "medications" family is two here.
const FAMILIES = [
  { key: "identity", label: "Patient identity", threshold: 1 },
  { key: "medNames", label: "Medication names (recall)", threshold: 1 },
  { key: "medDetail", label: "Dose, frequency, route", threshold: 0.9 },
  { key: "appointments", label: "Appointments (recall)", threshold: 1 },
  { key: "redFlags", label: "Red-flag safety-netting", threshold: 1 },
  { key: "sourceRefs", label: "Source refs resolve and quote", threshold: 1 },
] as const;

type FamilyKey = (typeof FAMILIES)[number]["key"];

// Measuring nothing has two causes and they must never print the same. A
// `scored` family with `total: 0` checked nothing it was supposed to check —
// that is a failure. `nothing-to-check` is the gold letter having nothing in
// this family at all; every scorer derives it from an empty GOLD field, so our
// own output being empty can never produce it.
type Score =
  | {
      kind: "scored";
      hit: number;
      total: number;
      misses: string[];
      skipped: string[];
    }
  | { kind: "nothing-to-check"; reason: string };

type Letter = {
  id: string;
  patientId: string;
  pdf: string;
  gold: Record<string, unknown>;
};

// Whitespace- and punctuation-insensitive. The NHS form wraps values across
// lines and columns, so a naive `includes()` reports text that is plainly on
// the page as missing.
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// "N/A" and its cousins are the medic writing "nothing here", not a value.
// Scored as data they match everything: `squash("N/A")` is "na", which the
// harness once searched our appointment verbatims for — matching "renal" and
// "named" and calling it a hit.
const ABSENT = new Set(["", "na", "none", "nil", "notapplicable", "notstated"]);

function isAbsent(value: string): boolean {
  return ABSENT.has(squash(value));
}

function pdfText(path: string): string {
  // Not `-layout`: it keeps each form row on one line, so a value that wraps
  // inside its own cell gets the neighbouring columns spliced into the middle
  // of it ("None - no routine surgical follow-up  N/A  N/A  required.") and
  // `squash` can no longer find it. Measured over the corpus: 158/174 gold
  // values found without it, 141/174 with. It is NOT the cause of "2puffs" —
  // the PDF has no space there and both modes emit it that way.
  return execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
}

function planKey(patientId: string): string {
  return `${PLAN_KEY_PREFIX}${patientId}`;
}

function assertPlanKeyPrefix(): void {
  const source = readFileSync(KEYS_MODULE, "utf8");
  if (!source.includes(`return \`${PLAN_KEY_PREFIX}\${patientId}\``)) {
    throw new Error(
      `planKey() in ${KEYS_MODULE} no longer builds "${PLAN_KEY_PREFIX}<id>"; update PLAN_KEY_PREFIX in this file to match`,
    );
  }
}

function loadCorpus(): Letter[] {
  const letters = readdirSync(CORPUS)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const gold: unknown = JSON.parse(
        readFileSync(join(CORPUS, name), "utf8"),
      );
      if (!isRecord(gold)) {
        throw new Error(`${join(CORPUS, name)} is not a JSON object`);
      }
      const id = basename(name, ".json");
      const pdf = join(CORPUS, `${id}.pdf`);
      if (!existsSync(pdf)) {
        throw new Error(`${join(CORPUS, name)} has no matching PDF at ${pdf}`);
      }
      // Prefixed so a `make eval` run can never be mistaken for, or overwrite,
      // the demo patient's plan.
      return { id, patientId: `eval-${id}`, pdf, gold };
    });

  // A green run over nothing is the worst thing this harness can print: it is
  // the measurement demo mode is licensed by.
  if (letters.length === 0) {
    throw new Error(
      `no gold letters in ${CORPUS}/ — nothing would be measured`,
    );
  }
  return letters;
}

async function extract(letter: Letter, token: string): Promise<void> {
  const blob = await put(`eval/${letter.id}.pdf`, readFileSync(letter.pdf), {
    access: "private",
    contentType: "application/pdf",
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });

  const response = await fetch(`${BASE_URL}/api/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      patientId: letter.patientId,
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
}

// Arrays are excluded deliberately: `Object.values` and `get()` both do
// something plausible but wrong on one, and every value this narrows — a gold
// file, an API body, a nested gold section — is meant to be a plain object.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// An HTML error page is thousands of lines; the useful part is at the top. A
// streamed 500 aborts with no body at all, and `"".split("\n")[0]` is `""`, not
// `undefined` — which printed `HTTP 500 — ` and left the reader with a failure
// that names no cause.
function firstLine(body: string): string {
  const first = body.trim().split("\n")[0]?.slice(0, 200) ?? "";
  return first === "" ? "(no response body; check the dev server log)" : first;
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

// For miss messages only — an absent value reads as `(none)` rather than as an
// empty pair of quotes the reader has to squint at.
function shown(value: string): string {
  return value === "" ? "(none)" : `"${value}"`;
}

// ── Families ────────────────────────────────────────────────────────────────

// The schema stores a first name and nothing else identifying: surname, date of
// birth, NHS number and address are read and deliberately discarded. So this
// scores the one identifier we keep, and checks the rest are declared as
// dropped rather than quietly missing. The two halves fail for entirely
// different reasons, so their misses are worded apart: one means the model read
// the wrong patient, the other means it never said what it threw away.
function scoreIdentity(bundle: unknown, gold: Letter["gold"]): Score {
  const expected = asString(get(gold, "patient_details", "forename"));
  // An empty expected value is not a check. `squash(undefined)` and
  // `squash(null)` are both "", so a renamed gold key would score every bundle
  // 1/1 on forename forever and the number would depend on the gold file's
  // spelling rather than on the extraction.
  if (expected === "") {
    throw new Error(
      "gold patient_details.forename is missing or empty — this harness's mapping is stale",
    );
  }

  const misses: string[] = [];
  let hit = 0;

  const actual = asString(get(bundle, "patient", "givenName"));
  if (squash(expected) === squash(actual)) hit += 1;
  else {
    misses.push(
      `WRONG PATIENT — gold forename ${shown(expected)}, bundle patient.givenName ${shown(actual)}`,
    );
  }

  const redacted = asArray(get(bundle, "patient", "redactedByPolicy")).map(
    asString,
  );
  for (const field of ["surname", "dateOfBirth", "nhsNumber"]) {
    if (redacted.includes(field)) hit += 1;
    else {
      misses.push(
        `UNDECLARED DROP — patient.redactedByPolicy does not list "${field}", so "read and discarded" is indistinguishable from "never read"; the patient itself may be correct`,
      );
    }
  }
  return { kind: "scored", hit, total: 4, misses, skipped: [] };
}

// A dropped drug is the dangerous failure, so names are scored as recall on the
// gold list and held at 100%.
function scoreMedNames(bundle: unknown, gold: Letter["gold"]): Score {
  const goldMeds = asArray(gold.discharge_medications);
  if (goldMeds.length === 0) {
    return {
      kind: "nothing-to-check",
      reason: "the gold letter discharges no medications",
    };
  }

  const ours = asArray(get(bundle, "medications")).map((medication) =>
    squash(asString(get(medication, "nameAsWritten"))),
  );
  const misses: string[] = [];
  let hit = 0;

  for (const medication of goldMeds) {
    const name = squash(asString(get(medication, "name")));
    if (
      ours.some(
        (candidate) =>
          candidate !== "" &&
          (candidate.includes(name) || name.includes(candidate)),
      )
    ) {
      hit += 1;
    } else {
      misses.push(`missing drug: ${asString(get(medication, "name"))}`);
    }
  }
  return { kind: "scored", hit, total: goldMeds.length, misses, skipped: [] };
}

function scoreMedDetail(bundle: unknown, gold: Letter["gold"]): Score {
  const goldMeds = asArray(gold.discharge_medications);
  if (goldMeds.length === 0) {
    return {
      kind: "nothing-to-check",
      reason: "the gold letter discharges no medications",
    };
  }

  const ours = asArray(get(bundle, "medications"));
  const misses: string[] = [];
  const skipped: string[] = [];
  let hit = 0;
  let total = 0;

  for (const medication of goldMeds) {
    const goldName = asString(get(medication, "name"));
    const name = squash(goldName);
    const match = ours.find((candidate) => {
      const written = squash(asString(get(candidate, "nameAsWritten")));
      return (
        written !== "" && (written.includes(name) || name.includes(written))
      );
    });
    if (match === undefined) {
      // The drug is missing outright, which is `medNames`' failure to report.
      // Recorded rather than dropped so a shrunken denominator here is never
      // mistaken for a full run.
      skipped.push(
        `${goldName}: no matching medication in the bundle, so its dose, frequency and route were not scored`,
      );
      continue;
    }

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
      // Comparing two empty strings is not a check that passed, it is a check
      // that never happened — and it would score a null on our side as correct.
      if (isAbsent(expected)) {
        skipped.push(
          `${goldName} ${field}: the letter gives no value (${shown(expected)}), so there is nothing to compare`,
        );
        continue;
      }
      total += 1;
      if (squash(expected) === squash(actual)) hit += 1;
      else {
        misses.push(
          `${goldName} ${field}: expected "${expected}", got ${shown(actual)}`,
        );
      }
    }
  }
  return { kind: "scored", hit, total, misses, skipped };
}

// Never silently lose a follow-up. Each gold action must appear as an
// appointment carrying the same date and the same responsible party.
function scoreAppointments(bundle: unknown, gold: Letter["gold"]): Score {
  const goldActions = get(gold, "actions_and_outstanding_investigations");
  if (!isRecord(goldActions)) {
    throw new Error(
      "gold actions_and_outstanding_investigations is missing or is not an object — this harness's mapping is stale",
    );
  }

  const appointments = asArray(get(bundle, "appointments"));
  const contacts = new Map(
    asArray(get(bundle, "contacts")).map((contact) => [
      asString(get(contact, "id")),
      asString(get(contact, "labelVerbatim")),
    ]),
  );

  const misses: string[] = [];
  const skipped: string[] = [];
  let hit = 0;
  let total = 0;

  for (const [row, action] of Object.entries(goldActions)) {
    const dateText = asString(get(action, "date"));
    const ownerText = asString(get(action, "person_responsible"));

    // Both columns "N/A" is the medic recording that there is no follow-up
    // here, so there is nothing to lose and nothing to score.
    if (isAbsent(dateText) && isAbsent(ownerText)) {
      skipped.push(
        `${row}: the letter records no follow-up (date ${shown(dateText)}, responsible ${shown(ownerText)})`,
      );
      continue;
    }
    // A named owner with no date is a real follow-up the harness cannot locate
    // among our appointments. Counted as a miss rather than skipped: it must
    // not take credit for a check it could not run.
    if (isAbsent(dateText)) {
      total += 1;
      misses.push(
        `${row}: gold names "${ownerText}" as responsible but gives no date, so no appointment can be matched to it`,
      );
      continue;
    }

    total += 1;
    const date = squash(dateText);
    const dated = appointments.filter((appointment) =>
      squash(asString(get(appointment, "when", "verbatim"))).includes(date),
    );
    if (dated.length === 0) {
      misses.push(`${row}: no appointment dated "${dateText}"`);
      continue;
    }
    hit += 1;

    if (isAbsent(ownerText)) {
      skipped.push(
        `${row}: the letter names nobody responsible, so who owns the "${dateText}" appointment was not scored`,
      );
      continue;
    }

    total += 1;
    const owner = squash(ownerText);
    const ids = dated.flatMap((appointment) =>
      asArray(get(appointment, "contactIds")).map(asString),
    );
    // A dangling contactId used to become "", and `owner.includes("")` is true
    // for every owner — so any appointment with any contactId scored a hit
    // whoever it named. Unresolved ids are dropped here and named in the miss
    // instead of silently satisfying the check.
    const labels = ids.flatMap((id) => {
      const label = contacts.get(id);
      return label === undefined || squash(label) === "" ? [] : [label];
    });
    const named = labels.some((label) => {
      const candidate = squash(label);
      return candidate.includes(owner) || owner.includes(candidate);
    });
    if (named) hit += 1;
    else {
      const dangling = ids.filter((id) => !contacts.has(id));
      const unresolved =
        dangling.length === 0 ? "" : `; unresolved ids: ${dangling.join(", ")}`;
      misses.push(
        `${row}: the "${dateText}" appointment does not name ${ownerText} (contacts: ${labels.join(", ") || "none"}${unresolved})`,
      );
    }
  }

  if (total === 0) {
    return {
      kind: "nothing-to-check",
      reason: `no gold action records a follow-up — ${skipped.join("; ")}`,
    };
  }
  return { kind: "scored", hit, total, misses, skipped };
}

// The escalation routes the corpus's safety-netting actually uses. Matched as
// words on the raw text, never squashed: `squash("A&E")` is "ae", which is a
// substring of half the English language.
const ESCALATION_ROUTES = [
  { label: "999", pattern: /\b999\b/ },
  { label: "111", pattern: /\b111\b/ },
  { label: "A&E", pattern: /\bA&E\b/i },
  { label: "urgent help", pattern: /urgent/i },
] as const;

// The medic's form keeps safety-netting in two places: what the patient was
// told on the ward, and the plan written for the GP.
function safetyNetting(gold: Letter["gold"]): string {
  const told = asString(
    get(gold, "information_given_to_patient_or_representative"),
  );
  const plans = get(gold, "advice_recommendations_and_future_plans");
  if (told === "" || !isRecord(plans)) {
    throw new Error(
      "gold information_given_to_patient_or_representative or advice_recommendations_and_future_plans is missing — this harness's mapping is stale",
    );
  }
  return [told, ...Object.values(plans).map(asString)].join(" ");
}

// Two halves, because either alone is unfalsifiable.
//
// Recall, against the gold letter: a bundle that dropped every red flag has no
// quotes to check, and precision alone would score it 0/0 and call it "n/a" —
// the safety-netting family passing by finding nothing at all. So the letter's
// own escalation routes are the denominator.
//
// Precision, against the PDF: everything Portico says is meant to be the
// clinician's own words, so a quote that is not in the document is a
// hallucination and one occurrence fails.
function scoreRedFlags(
  bundle: unknown,
  gold: Letter["gold"],
  text: string,
): Score {
  const netting = safetyNetting(gold);
  const flags = asArray(get(bundle, "redFlags"));
  const misses: string[] = [];
  let hit = 0;
  let total = 0;

  total += 1;
  if (flags.length > 0) hit += 1;
  else {
    misses.push(
      "the letter documents safety-netting and the bundle carries no red flag at all",
    );
  }

  const actions = flags
    .map((flag) => asString(get(flag, "actionVerbatim")))
    .join(" | ");
  for (const route of ESCALATION_ROUTES) {
    if (!route.pattern.test(netting)) continue;
    total += 1;
    if (route.pattern.test(actions)) hit += 1;
    else {
      misses.push(
        `the letter sends the patient to ${route.label}; no red flag's actionVerbatim does`,
      );
    }
  }

  const squashed = squash(text);
  for (const flag of flags) {
    for (const field of ["triggerVerbatim", "actionVerbatim"]) {
      const quote = asString(get(flag, field));
      total += 1;
      if (quote !== "" && squashed.includes(squash(quote))) hit += 1;
      else misses.push(`${field} is not a quote from the PDF: ${shown(quote)}`);
    }
  }
  return { kind: "scored", hit, total, misses, skipped: [] };
}

// Precision by nature — every reference we emit must resolve and must quote the
// document. A bundle with no references at all therefore scores 0/0, which is
// counted as a failure rather than an "n/a": a real letter always yields some.
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
    if (quote !== "" && squashed.includes(squash(quote))) hit += 1;
    else {
      misses.push(
        `${path}: not a quote from the PDF: ${shown(quote.slice(0, 60))}`,
      );
    }
  }
  return { kind: "scored", hit, total, misses, skipped: [] };
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

const CELL = 10;

function cell(score: Score, threshold: number): string {
  if (score.kind === "nothing-to-check") return "none";
  if (score.total === 0) return "0/0 FAIL";
  const rate = score.hit / score.total;
  const verdict = rate >= threshold ? "pass" : "FAIL";
  return `${String(Math.round(rate * 100)).padStart(3)}% ${verdict}`;
}

function isMissed(score: Score, threshold: number): boolean {
  // `nothing-to-check` is the only score that is neither: the gold letter has
  // nothing here and says so. Everything else has to clear the bar, including a
  // family that ran zero checks — measuring nothing is not passing.
  if (score.kind === "nothing-to-check") return false;
  return score.total === 0 || score.hit / score.total < threshold;
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
  assertPlanKeyPrefix();
  const redis = new Redis({ url: redisUrl, token: redisToken });

  const letters = loadCorpus();
  console.log(`Scoring ${letters.length} letters against ${BASE_URL}\n`);

  const results = new Map<string, Record<FamilyKey, Score>>();
  const failures: string[] = [];

  try {
    for (const [index, letter] of letters.entries()) {
      process.stdout.write(`  [${index + 1}] ${letter.id} … `);
      let bundle: unknown;
      try {
        await extract(letter, token);
        bundle = await redis.get<unknown>(planKey(letter.patientId));
        if (bundle === null) {
          throw new Error("nothing was stored for this letter");
        }
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
        redFlags: scoreRedFlags(bundle, letter.gold, text),
        sourceRefs: scoreSourceRefs(bundle, text),
      });
      console.log("done");
    }
  } finally {
    // Otherwise every run leaves a plan per letter behind, and the next reader
    // of Redis cannot tell an eval artefact from a real patient.
    const removed = await redis.del(
      ...letters.map((letter) => planKey(letter.patientId)),
    );
    console.log(`\nRemoved ${removed} eval plan key(s) from Redis.`);
  }

  console.log();
  const width = Math.max(...FAMILIES.map((family) => family.label.length));
  const columns = letters.map((letter, index) => ({
    id: letter.id,
    head: `[${index + 1}]`,
  }));
  console.log(
    `${"Family".padEnd(width)}  ${columns.map((column) => column.head.padStart(CELL)).join("  ")}`,
  );

  let missed = 0;
  let unmeasured = 0;
  for (const family of FAMILIES) {
    const cells = columns.map((column) => {
      const score = results.get(column.id)?.[family.key];
      // No column for a letter that never extracted: the table has to show the
      // gap, not close over it.
      if (score === undefined) return "—".padStart(CELL);
      if (score.kind === "nothing-to-check") unmeasured += 1;
      if (isMissed(score, family.threshold)) missed += 1;
      return cell(score, family.threshold).padStart(CELL);
    });
    console.log(`${family.label.padEnd(width)}  ${cells.join("  ")}`);
  }

  console.log();
  let skippedChecks = 0;
  for (const [id, scores] of results) {
    for (const family of FAMILIES) {
      const score = scores[family.key];
      if (score.kind === "scored") skippedChecks += score.skipped.length;
      const lines =
        score.kind === "nothing-to-check"
          ? [`nothing to check — ${score.reason}`]
          : [
              ...(score.total === 0
                ? [
                    "ran no checks at all, which is scored as a failure and not as an n/a",
                  ]
                : []),
              ...score.misses.map((miss) => `miss     ${miss}`),
              ...score.skipped.map((skip) => `skipped  ${skip}`),
            ];
      if (lines.length === 0) continue;
      console.log(`${id} — ${family.label}`);
      for (const line of lines) console.log(`    ${line}`);
    }
  }

  for (const failure of failures) console.log(`EXTRACTION FAILED  ${failure}`);

  const cellCount = letters.length * FAMILIES.length;
  const scoredCells = results.size * FAMILIES.length - unmeasured;
  console.log(
    `\nMeasured ${results.size}/${letters.length} letters and ${scoredCells}/${cellCount} family scores` +
      ` (${unmeasured} had nothing in the gold letter to check, ${skippedChecks} individual check(s) skipped).`,
  );
  // Whitfield's gold JSON was used to write the seed fixture, so its score is
  // not an independent measurement and must not be quoted as one.
  console.log(
    "Note: 02_Whitfield's gold labels were used to author the seed, so its column is not independent.",
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
