import { Redis } from "@upstash/redis";
import { z } from "zod";

// Asserts that every piece of demo state the film relies on is COMPUTED and
// STORED, not painted — by writing it through one route and reading it back
// through a different one, on a later request. `scripts/e2e-demo.ts` proves the
// screens look right in a browser; this proves the state behind them survives a
// reload, a second reader and an operator who does the wrong thing.
//
// Node 26 strips types natively, so this is a plain `.ts` file run by `node` —
// no test runner, matching `scripts/eval-extraction.ts` and `scripts/e2e-demo.ts`.
// It imports no app code: `lib/store/*` is `server-only` and throws in a plain
// Node process, so every key and every dictionary string it asserts on is
// spelled out here. That is the point — a harness that imported `assess()` would
// be asserting the function against itself.
//
//   make dev        # in another terminal
//   make state
//   PORTICO_URL=https://… make state
//
// It leaves the app seeded, the same way `make arc` does.

const BASE_URL = (process.env.PORTICO_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

// Every assertion below is about demo-mode state — the clock, the seed, the
// operator routes. Against a live build they would all correctly 403, which is
// a different harness's job (`make arc` has the mode-boundary beats).
const MODE = z
  .enum(["live", "demo"])
  .default("live")
  .parse(process.env.NEXT_PUBLIC_PORTICO_MODE);

// TTLs and idempotency are invisible over HTTP — the app has no route that
// exposes "how long does this key have left". Parsed here rather than at the
// call site so a misconfiguration fails by name before anything is written.
const REDIS = z
  .object({
    UPSTASH_REDIS_REST_URL: z.url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  })
  .parse(process.env);

// The same secret ElevenLabs' backend sends. Without it the three tool routes
// only ever answer 401 and half of this file cannot run.
const TOOL_SECRET = z.string().min(1).parse(process.env.PORTICO_TOOL_SECRET);

// There is one patient in this build and every screen is hardcoded to it.
// Spelled out rather than imported because `lib/store/keys.ts` is `server-only`.
const PATIENT = "demo";
const PLAN_KEY = `portico:plan:${PATIENT}`;
const CHECK_IN_KEY = `portico:incoming:${PATIENT}`;
const NUDGE_KEY = `portico:nudge:${PATIENT}`;
const logKey = (day: string) => `portico:log:${PATIENT}:${day}`;
const reminderKey = (day: string) => `portico:reminders:${PATIENT}:${day}`;
const escalationKey = (day: string) => `portico:escalation:${PATIENT}:${day}`;

// `lib/store/check-in.ts` and `lib/store/reminder.ts` both set 15 minutes.
const RING_TTL_SECONDS = 15 * 60;

// The medicine the escalation rule is written about, and one that is not: the
// threshold only fires on `high_stakes`, and a harness that only ever tests
// apixaban cannot tell that rule from "two misses of anything".
const HIGH_STAKES = { id: "med-apixaban", name: "Apixaban 5mg" };
const STANDARD = { id: "med-metformin", name: "Metformin 500mg" };

const client = new Redis({
  url: REDIS.UPSTASH_REDIS_REST_URL,
  token: REDIS.UPSTASH_REDIS_REST_TOKEN,
});

// ── Assertions ──────────────────────────────────────────────────────────────

// Every failure carries what was actually observed. A red row that does not say
// what came back costs a second run to diagnose, which is most of the reason to
// have a harness at all.
function must(ok: boolean, expectation: string, observed: string): void {
  if (ok) return;
  const flat = observed.replace(/\s+/g, " ").trim();
  throw new Error(
    `${expectation}\n      observed: ${flat.length > 500 ? `${flat.slice(0, 500)}…` : flat}`,
  );
}

// ── HTTP ────────────────────────────────────────────────────────────────────

type Reply = { status: number; body: string; headers: Headers };

async function call(
  method: string,
  path: string,
  init: { body?: string; headers?: Record<string, string> } = {},
): Promise<Reply> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: init.headers,
    body: init.body,
  });
  return {
    status: response.status,
    body: await response.text(),
    headers: response.headers,
  };
}

// A JSON reply as `unknown`. Every caller narrows it with a schema: these
// responses are the contract the operator panel and the ElevenLabs tool config
// are written against, so a shape change has to fail here by name.
async function jsonCall(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; value: unknown; body: string }> {
  const reply = await call(method, path, {
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let value: unknown = null;
  try {
    value = JSON.parse(reply.body);
  } catch {
    // Left as null. Every caller that cares asserts on the parsed shape, and a
    // body that is not JSON fails that assertion with the raw text attached.
  }
  return { status: reply.status, value, body: reply.body };
}

async function screen(path: string, locale?: string): Promise<string> {
  const reply = await call("GET", path, {
    headers:
      locale === undefined ? undefined : { cookie: `portico_locale=${locale}` },
  });
  must(reply.status === 200, `GET ${path} → HTTP ${reply.status}`, reply.body);
  return reply.body;
}

async function tool(
  path: string,
  body: unknown,
  secret: string = TOOL_SECRET,
): Promise<{ status: number; value: unknown; body: string }> {
  const reply = await call("POST", path, {
    headers: {
      "content-type": "application/json",
      "x-portico-tool-secret": secret,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let value: unknown = null;
  try {
    value = JSON.parse(reply.body);
  } catch {
    // See `jsonCall`.
  }
  return { status: reply.status, value, body: reply.body };
}

// ── Dates ───────────────────────────────────────────────────────────────────

// Same UTC arithmetic as `lib/timeline/schedule.ts`, restated rather than
// imported for the reason at the top of the file.
function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

const EN_DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

// ── App state helpers ───────────────────────────────────────────────────────

const Seeded = z.object({
  patientId: z.string(),
  today: z.iso.date(),
  medications: z.number(),
  redFlags: z.number(),
  missed: z.object({ itemId: z.string(), days: z.array(z.iso.date()) }),
  clearedLogDays: z.array(z.string()),
});

async function seed(): Promise<z.infer<typeof Seeded>> {
  const reply = await jsonCall("POST", "/api/seed");
  must(
    reply.status === 200,
    `POST /api/seed → HTTP ${reply.status}`,
    reply.body,
  );
  return Seeded.parse(reply.value);
}

const Clock = z.object({ today: z.iso.date() });

async function today(): Promise<string> {
  const reply = await jsonCall("GET", "/api/demo/clock");
  return Clock.parse(reply.value).today;
}

async function setDay(day: string): Promise<string> {
  const reply = await jsonCall("POST", "/api/demo/clock", { day });
  must(
    reply.status === 200,
    `POST /api/demo/clock {day} → HTTP ${reply.status}`,
    reply.body,
  );
  return Clock.parse(reply.value).today;
}

async function answer(
  itemId: string,
  day: string | null,
  status: "taken" | "missed",
): Promise<void> {
  const reply = await jsonCall("POST", "/api/demo/log", {
    itemId,
    day,
    status,
  });
  must(
    reply.status === 200,
    `POST /api/demo/log ${itemId} ${day ?? "today"} ${status} → HTTP ${reply.status}`,
    reply.body,
  );
}

// The escalation card's heading — the whole claim of the family screen. Keyed
// on the id its own `aria-labelledby` points at, never on its class list: the
// alert branch and the calm branch carry different classes, which is exactly
// how `scripts/demo-arc.sh` came to have three assertions that could not pass.
const FAMILY_HEADINGS = {
  none: "Nothing needs your attention.",
  nudge: "A dose was missed.",
  "alert-kin": "A dose that matters needs your attention.",
} as const;

type AssessmentKind = keyof typeof FAMILY_HEADINGS;

async function familySays(): Promise<string> {
  const html = await screen("/family");
  const match = /<h2 id="family-assessment"[^>]*>([^<]*)/.exec(html);
  return match?.[1] ?? "(no escalation heading on /family)";
}

// Asserted twice on purpose: `/family` renders the card and `/operator` prints
// the raw `assess()` result. Two independent readers of the same computation, so
// a card that agreed with itself but not with the rule would be caught.
async function assertAssessment(
  kind: AssessmentKind,
  because: string,
): Promise<void> {
  const heading = await familySays();
  must(
    heading === FAMILY_HEADINGS[kind],
    `${because}: /family should read "${FAMILY_HEADINGS[kind]}"`,
    heading,
  );
  const panel = await screen("/operator");
  const row =
    /assess\(\)<\/span><span[^>]*>([^<]*)/.exec(panel)?.[1] ?? "(no row)";
  must(
    kind === "none" ? row === "none" : row.startsWith(kind),
    `${because}: the operator panel should read assess() as ${kind}`,
    row,
  );
}

// Every day this patient currently has an answer on, straight out of Redis.
async function logDays(): Promise<string[]> {
  const prefix = logKey("");
  const days: string[] = [];
  let cursor = "0";
  do {
    const [next, keys] = await client.scan(cursor, {
      match: `${prefix}*`,
      count: 200,
    });
    days.push(...keys.map((key) => key.slice(prefix.length)));
    cursor = String(next);
  } while (cursor !== "0");
  return days.sort();
}

// The stored bundle, read as `unknown` and narrowed to the two fields this
// harness needs. Never typed off the app's schema: the whole point of reading it
// here is to see what is actually in Redis.
const StoredPlan = z.object({
  episode: z.object({ dischargeDate: z.iso.date() }),
  medications: z
    .array(z.object({ id: z.string(), nameAsWritten: z.string() }))
    .min(1),
});

async function storedPlan(): Promise<z.infer<typeof StoredPlan>> {
  return StoredPlan.parse(await client.get<unknown>(PLAN_KEY));
}

// ── Steps ───────────────────────────────────────────────────────────────────

type Step = { name: string; run: () => Promise<void> };

const STEPS: Step[] = [
  {
    name: "The seed leaves exactly the state it names, and nothing else",
    run: async () => {
      // Prime a day no backwards window from `today` would reach, then re-seed.
      // A reset that only cleared a fixed window would leave this behind and let
      // a third missed dose reach `assess()` out of residue.
      await setDay("2026-08-10");
      await answer(HIGH_STAKES.id, "2026-08-09", "missed");
      const seeded = await seed();

      must(
        seeded.medications === 7 && seeded.redFlags === 1,
        `the demo arc is written against the Whitfield bundle: 7 medicines, 1 red flag`,
        JSON.stringify(seeded),
      );
      must(
        seeded.missed.itemId === HIGH_STAKES.id,
        `the primed misses should be ${HIGH_STAKES.id}`,
        JSON.stringify(seeded.missed),
      );
      must(
        seeded.clearedLogDays.includes(logKey("2026-08-09")),
        "the seed should name the forward-dated day it removed, not silently skip it",
        JSON.stringify(seeded.clearedLogDays),
      );

      // Read back from Redis, not from the response the seed wrote about itself.
      const days = await logDays();
      const expected = [
        addDays(seeded.today, -2),
        addDays(seeded.today, -1),
      ].sort();
      must(
        JSON.stringify(days) === JSON.stringify(expected),
        `after a seed the store should hold exactly ${expected.join(", ")}`,
        days.join(", "),
      );
      must(
        (await today()) === seeded.today,
        `a second request should read the clock the seed parked at ${seeded.today}`,
        await today(),
      );
      must(
        (await client.get<unknown>(CHECK_IN_KEY)) === null,
        "the seed should clear a check-in left ringing by the previous take",
        String(await client.get<unknown>(CHECK_IN_KEY)),
      );
    },
  },

  {
    name: "The demo clock persists, and moves backward as well as forward",
    run: async () => {
      const start = await today();

      const forward = await jsonCall("POST", "/api/demo/clock", {
        shiftDays: 1,
      });
      must(
        Clock.parse(forward.value).today === addDays(start, 1),
        `+1 day from ${start} should land on ${addDays(start, 1)}`,
        forward.body,
      );
      must(
        (await today()) === addDays(start, 1),
        "a second request should read the moved clock, not the one it started on",
        await today(),
      );

      // `make arc` only ever moves back by naming an absolute day. A negative
      // shift is the operator panel's "−1 day" button, and it is computed from
      // the CURRENT demo day on the server — so it is a different code path.
      const back = await jsonCall("POST", "/api/demo/clock", { shiftDays: -1 });
      must(
        Clock.parse(back.value).today === start,
        `−1 day should return to ${start}`,
        back.body,
      );
      const backTwo = await jsonCall("POST", "/api/demo/clock", {
        shiftDays: -2,
      });
      must(
        Clock.parse(backTwo.value).today === addDays(start, -2),
        `−2 days from ${start} should land on ${addDays(start, -2)}`,
        backTwo.body,
      );

      // The whole app moves, not one screen. `/operator` prints the ISO day and
      // `/family` prints the same day formatted for the reader.
      const panel = await screen("/operator");
      must(
        panel.includes(`>${addDays(start, -2)}<`),
        `the operator panel should read ${addDays(start, -2)}`,
        panel.slice(panel.indexOf("Today"), panel.indexOf("Today") + 200),
      );
      const family = await screen("/family");
      const formatted = EN_DAY.format(
        new Date(`${addDays(start, -2)}T00:00:00Z`),
      );
      must(
        family.includes(formatted),
        `/family should read the same day, formatted: ${formatted}`,
        family.slice(family.indexOf("Today"), family.indexOf("Today") + 200),
      );

      must(
        (await setDay(start)) === start,
        `the clock should return to ${start}`,
        start,
      );
    },
  },

  {
    name: "A clock moved before the discharge date is named, not faked",
    run: async () => {
      const plan = await storedPlan();
      const parked = await today();

      await setDay(addDays(plan.episode.dischargeDate, -3));
      const before = await screen("/plan");
      must(
        before.includes("Today is not on this plan"),
        "a today before the plan's first day should say so, not render the opening days as the near term",
        before.slice(0, 400),
      );
      must(
        before.includes("so nothing on it can be ticked yet"),
        "it should name which side of the plan today falls on",
        before.slice(0, 400),
      );
      must(
        !before.includes("Tap the circle when you have done it."),
        "no day can be answered for when today is not on the plan",
        before.slice(0, 400),
      );

      await setDay(parked);
      const restored = await screen("/plan");
      must(
        restored.includes("Tap the circle when you have done it."),
        "moving the clock back onto the plan should restore today's tickable card",
        restored.slice(0, 400),
      );
    },
  },

  {
    name: "assess() escalates on two misses inside the window and nowhere else",
    run: async () => {
      const seeded = await seed();
      const t = seeded.today;

      await assertAssessment("alert-kin", "freshly seeded");

      await answer(HIGH_STAKES.id, addDays(t, -1), "taken");
      await assertAssessment("nudge", "one of the two seeded misses answered");
      await answer(HIGH_STAKES.id, addDays(t, -2), "taken");
      await assertAssessment("none", "both seeded misses answered");

      // Two misses, both OUTSIDE the three-day window. The escalation rule
      // exists to notice a run of misses NOW, and a rule that counted every
      // miss ever recorded would escalate off history the patient has already
      // recovered from.
      await answer(HIGH_STAKES.id, addDays(t, -3), "missed");
      await answer(HIGH_STAKES.id, addDays(t, -4), "missed");
      await assertAssessment("none", "two misses three and four days back");

      // One in, one out. Straddling the edge is a nudge, not an alert — this is
      // the assertion that would catch an off-by-one in `assessmentWindow`.
      await answer(HIGH_STAKES.id, addDays(t, -2), "missed");
      await assertAssessment(
        "nudge",
        "one miss inside the window, one outside",
      );

      await answer(HIGH_STAKES.id, addDays(t, -1), "missed");
      await assertAssessment("alert-kin", "two misses inside the window");

      // The threshold is written about high-stakes medicines. Two missed doses
      // of a standard-class one is a nudge — if this ever reads alert-kin, the
      // family screen has stopped meaning what its own copy says.
      const clean = await seed();
      await answer(HIGH_STAKES.id, addDays(clean.today, -1), "taken");
      await answer(HIGH_STAKES.id, addDays(clean.today, -2), "taken");
      await answer(STANDARD.id, addDays(clean.today, -1), "missed");
      await answer(STANDARD.id, addDays(clean.today, -2), "missed");
      const heading = await familySays();
      must(
        heading === FAMILY_HEADINGS.nudge,
        "two missed doses of a standard-class medicine should nudge, never alert the next of kin",
        heading,
      );
      const panel = await screen("/operator");
      must(
        panel.includes(STANDARD.name),
        `the nudge should name ${STANDARD.name}`,
        panel.slice(panel.indexOf("assess()"), panel.indexOf("assess()") + 200),
      );
    },
  },

  {
    name: "An explicit family note creates one miss and an immediate alert",
    run: async () => {
      const seeded = await seed();
      const t = seeded.today;

      // Remove the primed pattern first. This isolates the explicit tool call:
      // if the family card turns red, it came from the escalation record rather
      // than from the two historical misses the seed normally carries.
      await answer(HIGH_STAKES.id, addDays(t, -1), "taken");
      await answer(HIGH_STAKES.id, addDays(t, -2), "taken");
      await assertAssessment("none", "before the explicit family note");

      const before = await client.hgetall<Record<string, unknown>>(logKey(t));
      must(
        before === null || before[HIGH_STAKES.id] === undefined,
        "today should have no apixaban answer before escalate_to_next_of_kin",
        JSON.stringify(before),
      );

      const reason = "I forgot my apixaban. Please tell my daughter.";
      const escalated = await tool("/api/escalate", {
        patient_id: PATIENT,
        check_in_id: "explicit-family-note",
        item_id: HIGH_STAKES.id,
        reason,
      });
      must(
        escalated.status === 200,
        `POST /api/escalate → HTTP 200`,
        `HTTP ${escalated.status} ${escalated.body}`,
      );
      const reply = z
        .object({
          recorded_as: z.literal("missed"),
          tell_the_patient: z.string(),
        })
        .parse(escalated.value);
      must(
        reply.tell_the_patient.includes("note on the family view") &&
          reply.tell_the_patient.includes("Nobody has been called or messaged"),
        "the tool response should promise only a note on the family view",
        escalated.body,
      );

      await assertAssessment(
        "alert-kin",
        "after one explicit family note and no missed-dose pattern",
      );

      const entries = await client.hgetall<Record<string, unknown>>(logKey(t));
      const fields = Object.keys(entries ?? {});
      const miss = z
        .object({
          itemId: z.literal(HIGH_STAKES.id),
          status: z.literal("missed"),
          source: z.object({
            kind: z.literal("voice"),
            checkInId: z.literal("explicit-family-note"),
          }),
        })
        .parse(entries?.[HIGH_STAKES.id]);
      must(
        fields.length === 1 && miss.status === "missed",
        "escalate_to_next_of_kin should create exactly one missed entry when none existed",
        JSON.stringify(entries),
      );

      const escalations = await client.hgetall<Record<string, unknown>>(
        escalationKey(t),
      );
      const stored = z
        .object({
          itemId: z.literal(HIGH_STAKES.id),
          reason: z.string(),
        })
        .parse(escalations?.[HIGH_STAKES.id]);
      must(
        stored.reason === reason,
        "the family note should retain the patient's own words exactly",
        JSON.stringify(stored),
      );
    },
  },

  {
    name: "Moving the clock past the window drops the escalation, and back restores it",
    run: async () => {
      // Track 3's residual risk R8, re-run. It is not a defect — it is the rule
      // working — but an operator who moves the clock forward mid-rehearsal
      // loses the money shot, and this says by how much.
      const seeded = await seed();
      await assertAssessment("alert-kin", "seeded");

      await jsonCall("POST", "/api/demo/clock", { shiftDays: 1 });
      await assertAssessment(
        "nudge",
        "clock +1, one seeded miss now outside the window",
      );
      await jsonCall("POST", "/api/demo/clock", { shiftDays: 1 });
      await assertAssessment(
        "none",
        "clock +2, both seeded misses outside the window",
      );

      await setDay(seeded.today);
      await assertAssessment("alert-kin", "clock back on the seeded day");
    },
  },

  {
    name: "An answer written by any of the three writers survives to the next request",
    run: async () => {
      const seeded = await seed();
      const t = seeded.today;

      // 1 · the operator panel (manual source).
      await answer(STANDARD.id, null, "taken");
      const afterManual = await screen("/plan");
      must(
        afterManual.includes(
          `aria-label="${STANDARD.name}, today: recorded as taken. Tap to change to missed."`,
        ),
        `/plan should show ${STANDARD.name} as taken after the operator answered for it`,
        afterManual.slice(
          afterManual.indexOf(STANDARD.name) - 200,
          afterManual.indexOf(STANDARD.name) + 200,
        ),
      );
      // A SECOND request, not a re-read of the same body: this is the assertion
      // that separates stored state from an optimistic render.
      const again = await screen("/plan");
      must(
        again.includes(
          `aria-label="${STANDARD.name}, today: recorded as taken. Tap to change to missed."`,
        ),
        "the answer should still be there on a second request",
        again.slice(0, 200),
      );

      // 2 · the voice tool (`/api/log`, shared secret, day taken from the clock).
      const logged = await tool("/api/log", {
        patient_id: PATIENT,
        check_in_id: "state-harness",
        item_id: "med-atorvastatin",
        status: "missed",
      });
      must(
        logged.status === 200,
        `POST /api/log with the shared secret → HTTP ${logged.status}`,
        logged.body,
      );
      must(
        z.object({ day: z.iso.date() }).parse(logged.value).day === t,
        "the voice tool must take the day from the demo clock, never from the model",
        logged.body,
      );
      const afterVoice = await screen("/plan");
      must(
        afterVoice.includes(
          'aria-label="Atorvastatin 20mg, today: recorded as missed. Tap to change to taken."',
        ),
        "a voice-tool write should render on /plan like any other answer",
        afterVoice.slice(0, 200),
      );

      // 3 · idempotency. `(patient, item, day)` is the key: answering twice
      // replaces. If it appended, one honest correction would become two misses
      // and manufacture an escalation.
      await answer(STANDARD.id, null, "missed");
      await answer(STANDARD.id, null, "missed");
      const entries = await client.hgetall<Record<string, unknown>>(logKey(t));
      const forItem = Object.keys(entries ?? {}).filter(
        (k) => k === STANDARD.id,
      );
      must(
        forItem.length === 1,
        `answering three times about ${STANDARD.id} today should leave one field, not three`,
        JSON.stringify(Object.keys(entries ?? {})),
      );

      // The check-in summary reads the same log the plan does.
      const summary = await screen("/check-in/summary");
      must(
        summary.includes(STANDARD.name) && summary.includes("Missed"),
        "the check-in summary should show today's answers from the same log",
        summary.slice(
          summary.indexOf("Today's check-in"),
          summary.indexOf("Today's check-in") + 600,
        ),
      );
    },
  },

  {
    name: "The tool routes refuse what they should, by name",
    run: async () => {
      await seed();

      const cases: Array<{
        what: string;
        path: string;
        body: unknown;
        secret?: string;
        status: number;
        error: string;
      }> = [
        {
          what: "no secret",
          path: "/api/log",
          body: {
            patient_id: PATIENT,
            check_in_id: "c",
            item_id: HIGH_STAKES.id,
            status: "missed",
          },
          secret: "",
          status: 401,
          error: "unauthorized",
        },
        {
          what: "wrong secret",
          path: "/api/log",
          body: {
            patient_id: PATIENT,
            check_in_id: "c",
            item_id: HIGH_STAKES.id,
            status: "missed",
          },
          secret: "not-the-secret",
          status: 401,
          error: "unauthorized",
        },
        {
          what: "an item id that is not in the plan",
          path: "/api/log",
          body: {
            patient_id: PATIENT,
            check_in_id: "c",
            item_id: "med-invented",
            status: "taken",
          },
          status: 422,
          error: "unknown_item",
        },
        {
          what: "a patient with no plan stored",
          path: "/api/log",
          body: {
            patient_id: "nobody",
            check_in_id: "c",
            item_id: HIGH_STAKES.id,
            status: "taken",
          },
          status: 409,
          error: "no_plan_stored",
        },
        {
          what: "a status the schema does not hold",
          path: "/api/log",
          body: {
            patient_id: PATIENT,
            check_in_id: "c",
            item_id: HIGH_STAKES.id,
            status: "skipped",
          },
          status: 400,
          error: "invalid_arguments",
        },
        {
          what: "a missing field",
          path: "/api/log",
          body: {
            patient_id: PATIENT,
            item_id: HIGH_STAKES.id,
            status: "taken",
          },
          status: 400,
          error: "invalid_arguments",
        },
        {
          what: "an instruction id where a medicine is required",
          path: "/api/escalate",
          body: {
            patient_id: PATIENT,
            check_in_id: "c",
            item_id: "inst-falls",
            reason: "x",
          },
          status: 422,
          error: "unknown_medication",
        },
        {
          what: "an empty reason",
          path: "/api/escalate",
          body: {
            patient_id: PATIENT,
            check_in_id: "c",
            item_id: HIGH_STAKES.id,
            reason: "",
          },
          status: 400,
          error: "invalid_arguments",
        },
        {
          what: "a time that is not a 24-hour clock",
          path: "/api/remind",
          body: {
            patient_id: PATIENT,
            check_in_id: "c",
            item_id: HIGH_STAKES.id,
            time: "10pm",
          },
          status: 400,
          error: "invalid_arguments",
        },
      ];

      for (const each of cases) {
        const reply = await tool(
          each.path,
          each.body,
          each.secret ?? TOOL_SECRET,
        );
        must(
          reply.status === each.status,
          `${each.path} with ${each.what} → HTTP ${each.status}`,
          `HTTP ${reply.status} ${reply.body}`,
        );
        must(
          z.object({ error: z.string() }).safeParse(reply.value).data?.error ===
            each.error,
          `${each.path} with ${each.what} should name the error "${each.error}"`,
          reply.body,
        );
      }

      // `escalate` records a miss and hands back the relationship word off the
      // letter — and nothing it could embellish into a phone call.
      const escalated = await tool("/api/escalate", {
        patient_id: PATIENT,
        check_in_id: "state-harness",
        item_id: HIGH_STAKES.id,
        reason: "Could not open the packet.",
      });
      const shape = z
        .object({ next_of_kin: z.string(), tell_the_patient: z.string() })
        .parse(escalated.value);
      must(
        shape.next_of_kin === "Daughter",
        "escalate should name the next of kin exactly as the letter wrote it",
        escalated.body,
      );
      must(
        shape.tell_the_patient.includes("Nobody has been called or messaged"),
        "escalate must hand the agent a sentence that does not claim a message was sent",
        escalated.body,
      );
    },
  },

  {
    name: "Every POST route answers a malformed body with a named error, not a bare 500",
    run: async () => {
      const routes = [
        "/api/demo/clock",
        "/api/demo/log",
        "/api/demo/reminder",
        "/api/log",
        "/api/escalate",
        "/api/remind",
        "/api/extract",
        "/api/blob/upload",
      ];

      for (const path of routes) {
        for (const body of ["not json at all", "", '{"unclosed": ']) {
          const reply = await tool(path, body);
          must(
            reply.status >= 400 && reply.status < 500,
            `POST ${path} with a body that is not JSON should be a client error, not a server one`,
            `HTTP ${reply.status} ${reply.body || "(empty body)"}`,
          );
          must(
            reply.body.trim().length > 0 && reply.value !== null,
            `POST ${path} with a body that is not JSON must say what was wrong`,
            `HTTP ${reply.status} ${reply.body || "(empty body)"}`,
          );
        }
      }

      // Well-formed JSON of the wrong shape has to reach the same named error —
      // the two are the same client mistake and a caller cannot tell them apart
      // from a bare 500.
      const wrongShape = await jsonCall("POST", "/api/demo/clock", {
        day: "not-a-date",
      });
      must(
        wrongShape.status >= 400 &&
          wrongShape.status < 500 &&
          wrongShape.value !== null,
        "POST /api/demo/clock with a day that is not a date should be a named client error",
        `HTTP ${wrongShape.status} ${wrongShape.body || "(empty body)"}`,
      );
      const emptyDay = await jsonCall("POST", "/api/demo/clock", { day: "" });
      must(
        emptyDay.status >= 400 &&
          emptyDay.status < 500 &&
          emptyDay.value !== null,
        "an operator who clears the panel's date field and presses Set should be told why, not shown a blank 500",
        `HTTP ${emptyDay.status} ${emptyDay.body || "(empty body)"}`,
      );

      // The clock has to be unmoved by all of that.
      must(
        (await today()) === (await today()),
        "a refused clock write must not have moved the clock",
        await today(),
      );
    },
  },

  {
    name: "Drug guidance keeps its four states, and its scope line, apart",
    run: async () => {
      await seed();

      const found = await jsonCall(
        "GET",
        `/api/drug-info?patientId=${PATIENT}&name=${encodeURIComponent(HIGH_STAKES.name)}`,
      );
      const foundShape = z
        .object({
          kind: z.literal("found"),
          slug: z.string(),
          urgent: z.array(z.object({ headline: z.string() })).min(1),
          provenance: z.object({
            origin: z.literal("seed"),
            stale: z.literal(false),
          }),
        })
        .parse(found.value);
      must(
        foundShape.slug === "apixaban",
        "apixaban should resolve to its own NHS page",
        found.body,
      );

      const quiet = await jsonCall(
        "GET",
        `/api/drug-info?patientId=${PATIENT}&name=ramipril`,
      );
      must(
        z.object({ kind: z.string() }).parse(quiet.value).kind ===
          "no-urgent-guidance",
        '"the page carries no urgent advice" is not the same answer as "not listed", and ramipril is the first',
        quiet.body,
      );

      // The scope line. This is not an open drug lookup, and the two 404s say
      // different things — "we hold no plan for you" and "that drug is not on
      // your plan" must never collapse into one sentence.
      const offPlan = await jsonCall(
        "GET",
        `/api/drug-info?patientId=${PATIENT}&name=warfarin`,
      );
      must(
        offPlan.status === 404 && offPlan.body.includes("is not on this plan"),
        "a drug that is not on this patient's plan should 404 with the scope message",
        `HTTP ${offPlan.status} ${offPlan.body}`,
      );
      const noPlan = await jsonCall(
        "GET",
        `/api/drug-info?patientId=nobody&name=apixaban`,
      );
      must(
        noPlan.status === 404 && noPlan.body.includes("no plan stored"),
        "a patient with no plan should 404 with a different message from a drug off the plan",
        `HTTP ${noPlan.status} ${noPlan.body}`,
      );
      const noName = await jsonCall(
        "GET",
        `/api/drug-info?patientId=${PATIENT}`,
      );
      must(
        noName.status === 400,
        "a query with no medicine name should 400",
        `HTTP ${noName.status} ${noName.body}`,
      );
    },
  },

  {
    name: "A device on the plan is not a medicine the A-Z is missing",
    run: async () => {
      // The seeded bundle gives all seven medicines a `lookupKey`, so the
      // `device` branch and the `absent` branch are unreachable from it. Both
      // are real states of a real schema, so the harness writes a plan that
      // reaches them and then puts the seed back.
      const bundle = z
        .record(z.string(), z.unknown())
        .parse(await client.get<unknown>(PLAN_KEY));
      const medications = z
        .array(z.record(z.string(), z.unknown()))
        .parse(bundle.medications);

      const rewritten = medications.map((medication, index) => {
        // 0 · a dressing or a stocking: on the plan, but not a drug at all.
        if (index === 0) return { ...medication, lookupKey: null };
        // 1 · a drug the committed NHS map records as genuinely not on the A-Z.
        if (index === 1) {
          return {
            ...medication,
            lookupKey: {
              normalisedName: "enoxaparin",
              form: "injection",
              strength: "40mg",
              nameConfidence: "clear",
            },
          };
        }
        return medication;
      });
      const firstName = z
        .object({ nameAsWritten: z.string() })
        .parse(medications[0]).nameAsWritten;
      const secondName = z
        .object({ nameAsWritten: z.string() })
        .parse(medications[1]).nameAsWritten;

      await client.set(PLAN_KEY, { ...bundle, medications: rewritten });

      try {
        const device = await jsonCall(
          "GET",
          `/api/drug-info?patientId=${PATIENT}&name=${encodeURIComponent(firstName)}`,
        );
        must(
          z.object({ kind: z.string() }).parse(device.value).kind === "device",
          '"a thing with no drug behind it" must not render as "not in the NHS medicines A to Z"',
          device.body,
        );

        const absent = await jsonCall(
          "GET",
          `/api/drug-info?patientId=${PATIENT}&name=${encodeURIComponent(secondName)}`,
        );
        must(
          z.object({ kind: z.string() }).parse(absent.value).kind === "absent",
          "a drug the map records as not on the A-Z should come back absent",
          absent.body,
        );
      } finally {
        await seed();
      }

      const restored = await jsonCall(
        "GET",
        `/api/drug-info?patientId=${PATIENT}&name=${encodeURIComponent(HIGH_STAKES.name)}`,
      );
      must(
        z.object({ kind: z.string() }).parse(restored.value).kind === "found",
        "the seed should put the real plan back",
        restored.body,
      );
    },
  },

  {
    name: "The letter behind a red flag is a real PDF, and only this patient's",
    run: async () => {
      await seed();
      const pathname = "letters/demo/02_Whitfield_Harold_Pneumonia.pdf";

      const reply = await call(
        "GET",
        `/api/blob/source/${pathname}?patientId=${PATIENT}`,
      );
      must(
        reply.status === 200,
        `the source page → HTTP ${reply.status}`,
        reply.body.slice(0, 200),
      );
      must(
        reply.headers.get("content-type") === "application/pdf",
        "the bytes behind the viewer should be a PDF, not an error page wearing its content-type",
        String(reply.headers.get("content-type")),
      );
      must(
        (reply.headers.get("cache-control") ?? "").includes("no-store"),
        "a private health document must not sit in a shared cache",
        String(reply.headers.get("cache-control")),
      );
      must(
        reply.body.startsWith("%PDF"),
        "the response body should begin with a PDF header",
        reply.body.slice(0, 40),
      );

      // The scope guard: this route is not a reader for the whole Blob store.
      for (const [what, url] of [
        [
          "a pathname not in this plan",
          `/api/blob/source/letters/demo/somebody-else.pdf?patientId=${PATIENT}`,
        ],
        [
          "a patient with no plan",
          `/api/blob/source/${pathname}?patientId=nobody`,
        ],
      ] as const) {
        const refused = await call("GET", url);
        must(
          refused.status === 404,
          `${what} should 404`,
          `HTTP ${refused.status} ${refused.body}`,
        );
      }
      const unnamed = await call("GET", `/api/blob/source/${pathname}`);
      must(
        unnamed.status === 400,
        "a request that names no patient should 400",
        `HTTP ${unnamed.status} ${unnamed.body}`,
      );

      // And the viewer that links to it renders the quote it is tracing.
      const viewer = await screen(
        `/letter?patientId=${PATIENT}&flag=flag-worsening-chest-infection`,
      );
      must(
        viewer.includes("breathless, feverish or confused again"),
        "the letter viewer should carry the quote it was opened for",
        viewer.slice(0, 400),
      );
    },
  },

  {
    name: "The language choice survives a reload, and never half-translates",
    run: async () => {
      for (const path of ["/", "/plan", "/family", "/check-in/summary"]) {
        const english = await screen(path, "en");
        must(
          english.includes('<html lang="en"'),
          `${path} with the English cookie should declare lang="en"`,
          english.slice(0, 200),
        );
        const french = await screen(path, "fr");
        must(
          french.includes('<html lang="fr"'),
          `${path} with the French cookie should declare lang="fr"`,
          french.slice(0, 200),
        );
      }

      // Real copy, not just the attribute — and a second request, because the
      // choice is a cookie the server re-reads rather than state it holds.
      const home = await screen("/", "fr");
      must(
        home.includes("Bon après-midi.") && !home.includes("Good afternoon."),
        "the French home should be French, with no English chrome left on it",
        home.slice(home.indexOf("<h1"), home.indexOf("<h1") + 300),
      );
      const again = await screen("/", "fr");
      must(
        again.includes("Bon après-midi."),
        "the choice should still be French on the next request",
        again.slice(0, 200),
      );
      const family = await screen("/family", "fr");
      must(
        !family.includes("A dose that matters was missed twice."),
        "the family escalation should not fall back to English under a French cookie",
        family.slice(
          family.indexOf("family-assessment"),
          family.indexOf("family-assessment") + 300,
        ),
      );

      // A showcase language has no dictionary. It must fall through to English
      // rather than render half a screen in Welsh — the picker's "not yet" panel
      // is where that choice actually lands.
      const welsh = await screen("/", "cy");
      must(
        welsh.includes('<html lang="en"') && welsh.includes("Good afternoon."),
        "a showcase locale in the cookie must not produce a half-translated screen",
        welsh.slice(0, 200),
      );

      // With no cookie at all, Accept-Language picks between the two authored
      // locales and never invents a third.
      const byHeader = await call("GET", "/", {
        headers: { "accept-language": "fr-FR,fr;q=0.9" },
      });
      must(
        byHeader.body.includes('<html lang="fr"'),
        "Accept-Language: fr with no cookie should serve French",
        byHeader.body.slice(0, 200),
      );
      const welshHeader = await call("GET", "/", {
        headers: { "accept-language": "cy,en;q=0.5" },
      });
      must(
        welshHeader.body.includes('<html lang="en"'),
        "Accept-Language: cy should serve English, not a partial Welsh screen",
        welshHeader.body.slice(0, 200),
      );
    },
  },

  {
    name: "The raised check-in is real state with a TTL, and the seed clears it",
    run: async () => {
      await call("DELETE", "/api/demo/check-in");
      must(
        (await client.ttl(CHECK_IN_KEY)) === -2,
        "nothing should be ringing to start with",
        String(await client.ttl(CHECK_IN_KEY)),
      );

      const rung = await jsonCall("POST", "/api/demo/check-in");
      const raisedAt = z
        .object({ raisedAt: z.iso.datetime() })
        .parse(rung.value).raisedAt;
      const ttl = await client.ttl(CHECK_IN_KEY);
      must(
        ttl > 0 && ttl <= RING_TTL_SECONDS,
        `a raised check-in should expire on its own inside ${RING_TTL_SECONDS}s, so a take that ends mid-call does not leave the next one ringing`,
        `ttl ${ttl}`,
      );

      // The phone polls this on a 5s interval; it has to read the same value on
      // every one of them, not only the first.
      for (let poll = 0; poll < 3; poll += 1) {
        const seen = await jsonCall("GET", "/api/demo/check-in");
        must(
          z.object({ raisedAt: z.string() }).parse(seen.value).raisedAt ===
            raisedAt,
          `poll ${poll + 1} should read the same ring the operator raised`,
          seen.body,
        );
      }
      const panel = await screen("/operator");
      must(
        panel.includes(raisedAt),
        "the operator panel should read the ring back out of the store",
        panel.slice(
          panel.indexOf("Check-in raised"),
          panel.indexOf("Check-in raised") + 200,
        ),
      );

      const answered = await jsonCall("DELETE", "/api/demo/check-in");
      must(
        z.object({ raisedAt: z.null() }).safeParse(answered.value).success,
        "answering should clear the ring",
        answered.body,
      );
      must(
        (await client.ttl(CHECK_IN_KEY)) === -2,
        "answering should delete the key, not blank it",
        String(await client.ttl(CHECK_IN_KEY)),
      );

      await jsonCall("POST", "/api/demo/check-in");
      await seed();
      const afterSeed = await jsonCall("GET", "/api/demo/check-in");
      must(
        z.object({ raisedAt: z.null() }).safeParse(afterSeed.value).success,
        "the seed should clear a check-in the previous take left ringing",
        afterSeed.body,
      );
    },
  },

  {
    name: "Care-step reminders use the same schedule_reminder path",
    run: async () => {
      await seed();

      const scheduled = await tool("/api/remind", {
        patient_id: PATIENT,
        check_in_id: "state-harness",
        item_id: "inst-wound-dressing",
        time: "15:00",
      });
      must(
        scheduled.status === 200,
        `POST /api/remind for a wound care step → HTTP ${scheduled.status}`,
        scheduled.body,
      );
      must(
        z.object({ tell_the_patient: z.string() }).parse(scheduled.value)
          .tell_the_patient === "A nudge is set for 3 pm.",
        "a care-step reminder should hand the agent the same nudge sentence shape",
        scheduled.body,
      );

      const listed = await jsonCall("GET", "/api/demo/reminder");
      const reminder = z
        .object({
          reminders: z
            .array(
              z.object({
                itemId: z.string(),
                timeLocal: z.string(),
                nameAsWritten: z.string(),
              }),
            )
            .min(1),
        })
        .parse(listed.value).reminders[0];
      must(
        reminder?.itemId === "inst-wound-dressing" &&
          reminder.timeLocal === "15:00" &&
          reminder.nameAsWritten.includes("wound"),
        "the phone should store the care-step reminder under its instruction id",
        listed.body,
      );
    },
  },

  {
    name: "The dose nudge is a scheduled reminder, rung and cleared",
    run: async () => {
      const seeded = await seed();
      const t = seeded.today;

      const nothingSet = await jsonCall("POST", "/api/demo/reminder");
      must(
        nothingSet.status === 409 &&
          nothingSet.body.includes("no_reminder_scheduled"),
        "firing the nudge with nothing scheduled should refuse and say so, not ring an empty banner",
        `HTTP ${nothingSet.status} ${nothingSet.body}`,
      );

      // The agent's `schedule_reminder` tool. It stores a reminder; it does not
      // fire a notification — the operator rings that later.
      const scheduled = await tool("/api/remind", {
        patient_id: PATIENT,
        check_in_id: "state-harness",
        item_id: HIGH_STAKES.id,
        time: "22:00",
      });
      must(
        scheduled.status === 200,
        `POST /api/remind → HTTP ${scheduled.status}`,
        scheduled.body,
      );
      must(
        z.object({ tell_the_patient: z.string() }).parse(scheduled.value)
          .tell_the_patient === "A nudge is set for 10 pm.",
        "the agent should be handed a sentence that promises a nudge and nothing more",
        scheduled.body,
      );

      const listed = await jsonCall("GET", "/api/demo/reminder");
      const list = z
        .object({
          reminders: z.array(
            z.object({
              itemId: z.string(),
              timeLocal: z.string(),
              nameAsWritten: z.string(),
            }),
          ),
          raised: z.null(),
        })
        .parse(listed.value);
      must(
        list.reminders.length === 1 && list.reminders[0]?.timeLocal === "22:00",
        "the phone should see exactly the reminder the tool wrote",
        listed.body,
      );

      const summary = await screen("/check-in/summary");
      must(
        summary.includes("A nudge is set for 10pm"),
        "the check-in summary should name the nudge the agent promised",
        summary.slice(summary.indexOf("nudge"), summary.indexOf("nudge") + 200),
      );

      const rung = await jsonCall("POST", "/api/demo/reminder");
      const raised = z
        .object({
          raised: z.object({ raisedAt: z.iso.datetime(), itemId: z.string() }),
        })
        .parse(rung.value).raised;
      must(
        raised.itemId === HIGH_STAKES.id,
        "the ring should name the medicine the reminder was written about",
        rung.body,
      );
      const ttl = await client.ttl(NUDGE_KEY);
      must(
        ttl > 0 && ttl <= RING_TTL_SECONDS,
        `a raised nudge should expire on its own inside ${RING_TTL_SECONDS}s`,
        `ttl ${ttl}`,
      );

      // The banner polls this; it has to survive the poll after the one that
      // first saw it.
      const polled = await jsonCall("GET", "/api/demo/reminder");
      must(
        z
          .object({ raised: z.object({ raisedAt: z.string() }) })
          .parse(polled.value).raised.raisedAt === raised.raisedAt,
        "the raised nudge should still be there on the next poll",
        polled.body,
      );
      const panel = await screen("/operator");
      must(
        panel.includes(`${HIGH_STAKES.name} · 10pm`),
        "the operator panel should read the raised nudge back out of the store",
        panel.slice(
          panel.indexOf("Dose nudge"),
          panel.indexOf("Dose nudge") + 200,
        ),
      );

      const dismissed = await jsonCall("DELETE", "/api/demo/reminder");
      must(
        z.object({ raised: z.null() }).safeParse(dismissed.value).success,
        "dismissing should clear the ring",
        dismissed.body,
      );
      must(
        (await client.ttl(NUDGE_KEY)) === -2,
        "dismissing should delete the key, not blank it",
        String(await client.ttl(NUDGE_KEY)),
      );

      // The reminder itself outlives the ring — the nudge can be fired again.
      const stillScheduled = await jsonCall("GET", "/api/demo/reminder");
      must(
        z
          .object({ reminders: z.array(z.unknown()).min(1) })
          .safeParse(stillScheduled.value).success,
        "dismissing the banner should not delete the reminder behind it",
        stillScheduled.body,
      );

      // And the seed wipes both, so the next take does not open with yesterday's
      // evening dose already ringing.
      await jsonCall("POST", "/api/demo/reminder");
      await seed();
      const afterSeed = await jsonCall("GET", "/api/demo/reminder");
      must(
        JSON.stringify(afterSeed.value) ===
          JSON.stringify({ reminders: [], raised: null }),
        "the seed should clear every scheduled reminder and any raised nudge",
        afterSeed.body,
      );
      must(
        (await client.exists(reminderKey(t))) === 0,
        "the seed should remove the reminder key itself, not empty it",
        String(await client.exists(reminderKey(t))),
      );
    },
  },

  {
    name: "clear-letter keeps the history, and a fresh extraction lands back on it",
    run: async () => {
      const seeded = await seed();
      const t = seeded.today;

      const cleared = await jsonCall("DELETE", "/api/demo/plan");
      const kept = z
        .object({
          plan: z.null(),
          today: z.iso.date(),
          keptLogDays: z.array(z.iso.date()),
        })
        .parse(cleared.value);
      must(
        kept.today === t,
        "clearing the letter must not move the clock",
        cleared.body,
      );
      must(
        JSON.stringify(kept.keptLogDays.sort()) ===
          JSON.stringify([addDays(t, -2), addDays(t, -1)].sort()),
        "clearing the letter must keep the primed misses, by name",
        cleared.body,
      );
      must(
        (await client.get<unknown>(PLAN_KEY)) === null,
        "clear-letter should delete the key, so nothing can tell this account from one that never had a letter",
        String(await client.get<unknown>(PLAN_KEY)),
      );

      // Every screen has to name the state rather than break in it.
      const home = await screen("/");
      must(
        home.includes("Take a photo or upload a PDF") &&
          !home.includes("Start today's check-in"),
        "the empty home should lead with the letter and offer no door into an empty room",
        home.slice(0, 400),
      );
      must(
        (await screen("/plan")).includes("No plan yet"),
        "/plan should name the empty state",
        "",
      );
      must(
        (await screen("/family")).includes(
          "No recovery plan has been loaded yet.",
        ),
        "/family should name the empty state",
        "",
      );
      // The check-in still renders — the agent falls back to the invariant
      // persona rather than a prompt whose plan section would be invented.
      await screen("/check-in");

      // Now the letter arrives, through the same route the browser posts to
      // after a real upload.
      const extracted = await jsonCall("POST", "/api/extract", {
        patientId: PATIENT,
        documents: [
          {
            pathname: "letters/demo/02_Whitfield_Harold_Pneumonia.pdf",
            url: `${BASE_URL}/api/blob/source/letters/demo/02_Whitfield_Harold_Pneumonia.pdf?patientId=${PATIENT}`,
            contentType: "application/pdf",
            displayName: "Discharge summary",
          },
        ],
      });
      const result = z
        .object({
          mode: z.literal("demo"),
          modelId: z.string(),
          medications: z.number(),
        })
        .parse(extracted.value);
      must(
        result.modelId.startsWith("seed/"),
        "in demo mode the stored bundle must name what produced it, so nothing on screen claims a live read",
        extracted.body,
      );
      must(
        result.medications === 7,
        "the extraction should restore the seven-medicine plan",
        extracted.body,
      );

      const back = await screen("/");
      must(
        back.includes("Start today's check-in"),
        "home should offer the check-in again once a plan exists",
        back.slice(0, 400),
      );
      // The whole point of `clear-letter`: the escalation computes off history
      // the cleared plan never touched.
      await assertAssessment(
        "alert-kin",
        "a plan re-extracted on camera, against the surviving history",
      );
    },
  },
];

// ── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  if (MODE !== "demo") {
    console.error(
      `This harness asserts demo-mode state (the clock, the seed, the operator routes).\nThe app under test is in ${MODE} mode, where every one of those correctly refuses.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Driving ${BASE_URL} in ${MODE} mode\n`);

  const results: Array<{ name: string; failure: string | null }> = [];
  for (const step of STEPS) {
    process.stdout.write(`  ${step.name} … `);
    try {
      await step.run();
      results.push({ name: step.name, failure: null });
      console.log("pass");
    } catch (error) {
      results.push({
        name: step.name,
        failure: error instanceof Error ? error.message : String(error),
      });
      console.log("FAIL");
    }
  }

  // Leave the app the way `make arc` does, so this can be run before a take.
  await seed();

  console.log();
  const width = Math.max(...STEPS.map((step) => step.name.length));
  console.log(`    ${"Step".padEnd(width)}  Result`);
  results.forEach((result, index) => {
    const ordinal = String(index + 1).padStart(2);
    console.log(
      `${ordinal}  ${result.name.padEnd(width)}  ${result.failure === null ? "pass" : "FAIL"}`,
    );
  });

  const failed = results.filter((result) => result.failure !== null);
  if (failed.length > 0) console.log();
  for (const result of failed) {
    console.log(`FAILED  ${result.name}\n      ${result.failure}`);
  }

  if (failed.length === 0) {
    console.log(
      `\nAll ${results.length} steps passed. The app is left seeded.`,
    );
    return;
  }
  console.log(`\n${failed.length} of ${results.length} steps failed.`);
  process.exitCode = 1;
}

await main();
