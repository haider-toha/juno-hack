import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { Redis } from "@upstash/redis";
import { chromium } from "playwright";
import type { Locator, Page } from "playwright";
import { z } from "zod";

// Drives a RUNNING Portico instance through the demo arc in a real browser and
// screenshots every step in visit order, so what gets reviewed is what a person
// would see rather than what the components claim.
//
// Node 26 strips types natively, so this is a plain `.ts` file run by `node` —
// no test runner, matching `scripts/eval-extraction.ts`. It imports no app code:
// everything it knows it learns over HTTP or off the rendered DOM, which is what
// lets the same script point at a deployment.
//
//   pnpm exec playwright install chromium   # once
//   make e2e
//   PORTICO_URL=https://… make e2e

// Trailing slash stripped: it survives into the `page.route` matcher that holds
// the server action open, where `//plan` would silently match nothing.
const BASE_URL = (process.env.PORTICO_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const SHOTS = ".e2e";

// Mirrors `lib/env.ts`: unset means live. Two assertions read it in BOTH
// directions — the demo badge and the seed's refusal — because a demo build
// that does not say it is one is the failure both exist to prevent.
const MODE = z
  .enum(["live", "demo"])
  .default("live")
  .parse(process.env.NEXT_PUBLIC_PORTICO_MODE);

// The empty-state step takes the stored plan away and puts it back, so the
// harness needs the same Redis the app reads. Parsed here rather than at the
// call site so a misconfiguration fails by name before a browser is launched.
const REDIS = z
  .object({
    UPSTASH_REDIS_REST_URL: z.url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  })
  .parse(process.env);

// There is one patient in this build and `/plan` is hardcoded to it, so the key
// is fixed. Spelled out rather than imported because `lib/store/keys.ts` is
// `server-only` and would throw in a plain Node process.
const PLAN_KEY = "portico:plan:demo";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

// Console errors, uncaught page errors and failing requests, attributed to the
// step that was running when they happened.
type Problem = { step: string; detail: string };
const problems: Problem[] = [];
const typographyOffenders: Problem[] = [];
let currentStep = "startup";

// ── Assertions ──────────────────────────────────────────────────────────────

// Every failure carries the screen it failed against. A red row that does not
// say what was on the page costs a second run to diagnose, which is most of the
// reason to have a harness.
function must(ok: boolean, expectation: string, screen: string): void {
  if (ok) return;
  const flat = screen.replace(/\s+/g, " ").trim();
  throw new Error(
    `${expectation}\n      screen: ${flat.length > 600 ? `${flat.slice(0, 600)}…` : flat}`,
  );
}

// `/plan` streams: `goto` resolves on the skeleton, whose <main> is `aria-busy`.
// Waiting for a settled <main> is the difference between asserting on the plan
// and asserting on its loading state.
async function open(page: Page, path: string): Promise<string> {
  await page.goto(`${BASE_URL}${path}`);
  const main = page.locator("main:not([aria-busy])");
  await main.waitFor();
  return main.innerText();
}

// The plan screen's own grouping: "Follow-ups", "As needed" and "Changed in
// hospital" are each a <section> named by its heading, inside "More on your
// plan" (closed by default — open it before reading).
function group(page: Page, title: string): Locator {
  return page.locator(`section:has(h2:text-is("${title}"))`);
}

async function openMoreOnPlan(page: Page): Promise<void> {
  const more = page.getByText("More on your plan", { exact: true });
  await more.click();
}

// Today's card, found by the word the screen itself uses rather than by a date
// the harness computed. The app's "today" is the real day in live mode and the
// parked demo day in demo mode, and none of these assertions should care which.
function todayCard(page: Page): Locator {
  return page.locator(
    'section[aria-labelledby^="day-"]:has(span:text-is("Today"))',
  );
}

const STATES = ["unanswered", "taken", "missed"] as const;
type TickState = (typeof STATES)[number];

// The tick's accessible name is its state — there is no other text on it — so
// reading the label is both the sighted check and the screen-reader one.
const TICK_STATES: Record<TickState, string> = {
  unanswered: "tap to record as taken.",
  taken: "recorded as taken. Tap to change to missed.",
  missed: "recorded as missed. Tap to change to taken.",
};

async function tickState(tick: Locator): Promise<TickState> {
  const label = (await tick.getAttribute("aria-label")) ?? "";
  const state = STATES.find((candidate) =>
    label.endsWith(TICK_STATES[candidate]),
  );
  if (state === undefined) {
    throw new Error(`the tick announces something unrecognised: "${label}"`);
  }
  return state;
}

async function waitForTick(
  tick: Locator,
  state: TickState,
  timeout: number,
): Promise<void> {
  const expected = TICK_STATES[state];
  const deadline = Date.now() + timeout;
  let seen = "";
  do {
    seen = (await tick.getAttribute("aria-label")) ?? "(no tick on screen)";
    if (seen.endsWith(expected)) return;
    await new Promise((done) => setTimeout(done, 50));
  } while (Date.now() < deadline);
  throw new Error(
    `the tick should announce "…${expected}" within ${timeout}ms; it announces "${seen}"`,
  );
}

// Sideways scroll on a phone-shaped app is always a bug. Checked on the
// document AND on every scrollable box, because the iPhone frame does its own
// scrolling and could overflow inside a document that does not.
async function horizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const offenders: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth) {
      offenders.push(
        `the document scrolls to ${doc.scrollWidth}px in a ${doc.clientWidth}px viewport`,
      );
    }
    for (const el of document.body.querySelectorAll("*")) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX !== "auto" && overflowX !== "scroll") continue;
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      offenders.push(
        `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}"> scrolls to ${el.scrollWidth}px inside ${el.clientWidth}px`,
      );
    }
    return offenders;
  });
}

// The two things a reviewer spots across the room, and the two the project bans
// outright: a monospaced face anywhere in the UI, and text shouted in capitals.
// Five letters is the threshold because the letter's own clinical shorthand —
// OD, BD, PRN, COPD, NHS — is legitimately upper case and is the doctor's words.
async function checkTypography(page: Page, route: string): Promise<void> {
  const offenders = await page.evaluate(() => {
    const found: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      const own = [...el.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(" ")
        .trim();
      if (own === "" || !el.checkVisibility()) continue;

      const style = getComputedStyle(el);
      const where = `<${el.tagName.toLowerCase()}> "${own.slice(0, 48)}"`;
      if (/mono|courier|consolas|menlo|monaco/i.test(style.fontFamily)) {
        found.push(`${where} renders in ${style.fontFamily}`);
      }
      if (style.textTransform === "uppercase") {
        found.push(`${where} is uppercased by CSS`);
      }
      const shouted = own.match(/\b[A-Z]{5,}\b/g);
      if (shouted !== null) {
        found.push(`${where} is in block capitals: ${shouted.join(", ")}`);
      }
    }
    return found;
  });

  for (const detail of offenders) {
    typographyOffenders.push({ step: route, detail });
  }
}

let shotIndex = 0;

async function shot(page: Page, name: string): Promise<void> {
  shotIndex += 1;
  const ordinal = String(shotIndex).padStart(2, "0");
  await page.screenshot({ path: `${SHOTS}/${ordinal}-${name}.png` });
}

function redis(): Redis {
  return new Redis({
    url: REDIS.UPSTASH_REDIS_REST_URL,
    token: REDIS.UPSTASH_REDIS_REST_TOKEN,
  });
}

// ── Steps ───────────────────────────────────────────────────────────────────

type Step = { name: string; run: (page: Page) => Promise<void> };

const STEPS: Step[] = [
  {
    name: "The seed primes the demo, and refuses in live mode",
    run: async () => {
      const response = await fetch(`${BASE_URL}/api/seed`, { method: "POST" });
      const raw = await response.text();

      // The seed overwrites the one key a real uploaded letter writes to, so
      // refusing outside demo mode is the correct answer. The harness asserts
      // the refusal rather than working around it, and reads the plan already
      // in the store instead.
      if (MODE === "live") {
        must(
          response.status === 403,
          `POST /api/seed must refuse to overwrite a live plan; it answered HTTP ${response.status}`,
          raw,
        );
        return;
      }

      must(
        response.ok,
        `POST /api/seed → HTTP ${response.status}`,
        raw.trim().split("\n")[0] ?? "(empty body)",
      );
      // Every later assertion names a fact off this exact bundle, so a
      // different plan behind the same endpoint has to fail here and say so
      // rather than surface as a missing drug four steps later.
      const seeded = z
        .object({ plan: z.string(), today: z.iso.date() })
        .parse(JSON.parse(raw));
      must(
        seeded.plan === "seed/02-whitfield",
        `the demo arc is written against the Whitfield seed; /api/seed served "${seeded.plan}"`,
        raw,
      );
    },
  },

  {
    name: "Home offers the two ways in",
    run: async (page) => {
      const text = await open(page, "/");
      must(text.includes("Portico"), "home should be branded Portico", text);
      must(
        text.includes("How are you doing today?"),
        "home should open with the greeting",
        text,
      );

      for (const [href, title] of [
        ["/check-in", "Start today's check-in"],
        ["/plan", "See my recovery plan"],
      ] as const) {
        const link = page.getByRole("link", { name: new RegExp(title) });
        must(
          (await link.count()) === 1,
          `home should offer exactly one "${title}" link, found ${await link.count()}`,
          text,
        );
        must(
          (await link.getAttribute("href")) === href,
          `"${title}" should be a real link to ${href}, not ${await link.getAttribute("href")}`,
          text,
        );
      }

      await checkTypography(page, "/");
      await shot(page, "home");
    },
  },

  {
    name: "/plan renders the seeded timeline",
    run: async (page) => {
      const text = await open(page, "/plan");
      must(
        text.includes("Your recovery plan"),
        "/plan should be headed with the plan title",
        text,
      );
      await shot(page, "plan-top");

      const card = todayCard(page);
      must(
        (await card.count()) === 1,
        `the timeline should carry exactly one card headed "Today", found ${await card.count()}`,
        text,
      );
      const cardText = await card.innerText();

      for (const [drug, directions] of [
        ["Apixaban 5mg", "1 tab, BD, Oral, Ongoing"],
        ["Metformin 500mg", "1 tab, BD, Oral, Ongoing (reduced)"],
        ["Atorvastatin 20mg", "1 tab, Nocte, Oral, Ongoing"],
        ["Tiotropium 18mcg", "1 puff, OD, Inhaled, Ongoing"],
      ] as const) {
        must(
          cardText.includes(drug),
          `today's card should list ${drug}`,
          cardText,
        );
        must(
          cardText.includes(directions),
          `${drug} should carry its dose directions "${directions}"`,
          cardText,
        );
      }

      // Two tablets, one a day, from the day he came home: the course has to
      // land on exactly two cards. A repeat prescription rendered forever, or a
      // course silently dropped, both fail here.
      must(
        text.includes("1 tab, OD, Oral, 2 days (complete)"),
        "the doxycycline course should carry its directions",
        text,
      );
      const courseDays = await page
        .locator(
          'section[aria-labelledby^="day-"]:has-text("Doxycycline 100mg")',
        )
        .count();
      must(
        courseDays === 2,
        `the two-day doxycycline course should sit on exactly two day cards, it is on ${courseDays}`,
        text,
      );

      await openMoreOnPlan(page);

      const comingUp = await group(page, "Follow-ups").innerText();
      must(
        comingUp.includes("Respiratory OP follow-up"),
        `"Follow-ups" should carry the respiratory follow-up`,
        comingUp,
      );
      must(
        comingUp.includes("Saturday 5 September") &&
          comingUp.includes("~05/09/2026"),
        `the respiratory follow-up should be dated 5 September, in the clinician's own approximate words`,
        comingUp,
      );

      const asNeeded = await group(page, "As needed").innerText();
      must(
        asNeeded.includes("Salbutamol 100mcg inh"),
        `"As needed" should hold the as-required reliever`,
        asNeeded,
      );
      must(
        asNeeded.includes("Finish the whole antibiotic course"),
        `"As needed" should hold the standing advice`,
        asNeeded,
      );

      const changed = group(page, "Changed in hospital");
      await changed.scrollIntoViewIfNeeded();
      const changedText = await changed.innerText();
      must(
        changedText.includes("Ramipril 5mg") &&
          changedText.includes("Ramipril withheld due to AKI"),
        `"Changed in hospital" should show ramipril as withheld`,
        changedText,
      );
      must(
        changedText.includes("Metformin reduced from 1g BD to 500mg BD"),
        `"Changed in hospital" should show the metformin reduction`,
        changedText,
      );

      await checkTypography(page, "/plan");
      await shot(page, "plan-changed-in-hospital");
    },
  },

  {
    name: "The red-flag card traces back to the letter",
    run: async (page) => {
      const text = await open(page, "/plan");
      const card = page.locator('section[aria-labelledby^="flag-"]');
      must(
        (await card.count()) === 1,
        `/plan should carry the letter's one red flag, found ${await card.count()} cards`,
        text,
      );

      await card.scrollIntoViewIfNeeded();
      const cardText = await card.innerText();
      must(
        cardText.includes("Get help if"),
        "the red-flag card should be headed with the safety-netting prompt",
        cardText,
      );
      must(
        cardText.includes("breathless, feverish or confused again"),
        "the card should quote the clinician's trigger verbatim",
        cardText,
      );
      must(
        cardText.includes("Advised to seek urgent help"),
        "the card should quote the clinician's action verbatim",
        cardText,
      );
      // The letter names nobody to call. Saying so is the honest render; a 999
      // the doctor never wrote would be the app speaking over them.
      must(
        cardText.includes("Your letter does not say who to contact for this."),
        "the card should say the letter names no recipient rather than invent one",
        cardText,
      );
      await shot(page, "red-flag-card");

      const link = card.getByRole("link", { name: /See where it says that/ });
      const href = await link.getAttribute("href");
      if (href === null) {
        throw new Error(`the "see where it says that" link carries no href`);
      }
      const source = new URL(href, BASE_URL);
      must(
        source.pathname === "/letter",
        `the link should open the in-app letter viewer, got ${source.pathname}`,
        href,
      );
      must(
        source.searchParams.get("flag") !== null,
        "the letter link should name the red-flag it came from",
        href,
      );

      await link.click();
      await page.getByRole("heading", { name: "Your letter" }).waitFor({
        state: "visible",
        timeout: 15_000,
      });
      // The highlight is aria-hidden paint over the glyphs — its id is the
      // stable proof the quote was found and marked, not just that a canvas
      // painted.
      await page.locator("#letter-highlight-0").waitFor({
        state: "visible",
        timeout: 20_000,
      });
      await shot(page, "letter-highlight");

      // The viewer loads bytes through the private blob proxy. Hit that route
      // the same way the canvas does, so a pretty page over a missing PDF
      // still fails the arc.
      const patientId = source.searchParams.get("patientId") ?? "demo";
      const letter = await page.request.get(
        `${BASE_URL}/api/blob/source/letters/demo/02_Whitfield_Harold_Pneumonia.pdf?patientId=${encodeURIComponent(patientId)}`,
      );
      const body = await letter.body();
      const preview = body.subarray(0, 300).toString("utf8");
      must(
        letter.status() === 200,
        `the blob proxy should serve the letter, got HTTP ${letter.status()}`,
        preview,
      );
      must(
        (letter.headers()["content-type"] ?? "").startsWith("application/pdf"),
        `the letter should be served as a PDF, got content-type "${letter.headers()["content-type"] ?? "(none)"}"`,
        preview,
      );
      must(
        body.subarray(0, 5).toString("utf8") === "%PDF-",
        "the bytes behind the viewer should be a PDF, not an error page wearing its content-type",
        preview,
      );
    },
  },

  {
    name: "A tick is optimistic and survives a reload",
    run: async (page) => {
      await open(page, "/plan");
      const tick = todayCard(page).getByRole("button", {
        name: /^Metformin 500mg, today/,
      });
      await tick.scrollIntoViewIfNeeded();

      // The control toggles taken/missed, so the pair a run exercises depends
      // on where it starts — and where it starts depends on whether the last
      // run's answer is still on the record, which is the whole point. Reading
      // it rather than assuming keeps the harness re-runnable without a reseed,
      // and either order still puts the missed state through a reload.
      const first = (await tickState(tick)) === "taken" ? "missed" : "taken";
      const second = first === "taken" ? "missed" : "taken";

      // Hold the server action open: the mark must flip anyway. If it only
      // flips once the write lands then it is not optimistic, and the tap feels
      // dead on the connection an elderly patient actually has.
      let heldTheAction = false;
      await page.route(`${BASE_URL}/plan`, async (route) => {
        if (route.request().headers()["next-action"] !== undefined) {
          heldTheAction = true;
          await new Promise((done) => setTimeout(done, 2_000));
        }
        await route.continue();
      });
      await tick.click();
      await waitForTick(tick, first, 750);
      await page.unrouteAll({ behavior: "wait" });
      // Without this the 750ms above proves nothing: a write that was never
      // held could simply have been fast.
      if (!heldTheAction) {
        throw new Error(
          `no server action was intercepted on ${BASE_URL}/plan, so the tick flipping inside 750ms is not evidence of optimism`,
        );
      }

      await waitForTick(tick, first, 15_000);
      await shot(page, `tick-${first}`);

      await page.reload();
      await tick.scrollIntoViewIfNeeded();
      await waitForTick(tick, first, 15_000);
      await shot(page, `tick-${first}-after-reload`);

      await tick.click();
      await waitForTick(tick, second, 15_000);
      await shot(page, `tick-${second}`);

      await page.reload();
      await tick.scrollIntoViewIfNeeded();
      await waitForTick(tick, second, 15_000);
      await shot(page, `tick-${second}-after-reload`);
    },
  },

  {
    name: "home upload takes a photo or a PDF",
    run: async (page) => {
      // Seeded demos already have a plan, so the first-visit upload is reached
      // via `?letter=1` — same control, same screen, no separate /upload route.
      const text = await open(page, "/?letter=1");
      must(
        text.includes("Add another letter") ||
          text.includes("Take a photo or upload a PDF"),
        "home should name the letter control",
        text,
      );
      must(
        text.includes("Photograph it, or upload the PDF.") ||
          text.includes("Photograph every page, or upload the PDF."),
        "home should say which document to photograph or upload",
        text,
      );

      const input = page.locator('input[type="file"]');
      must(
        (await input.count()) === 1,
        `home should have exactly one file control, found ${await input.count()}`,
        text,
      );
      const accept = (await input.getAttribute("accept")) ?? "";
      must(
        accept.includes("image/*") && accept.includes("application/pdf"),
        `the control should accept a photograph and a PDF, its accept is "${accept}"`,
        text,
      );
      must(
        (await input.getAttribute("capture")) === "environment",
        `the control should open the rear camera on a phone, its capture is "${await input.getAttribute("capture")}"`,
        text,
      );
      must(
        (await input.getAttribute("multiple")) !== null,
        "a discharge bundle is several pages, so the control should take more than one",
        text,
      );

      await checkTypography(page, "/?letter=1");
      await shot(page, "home-letter");
    },
  },

  {
    name: "/plan with no plan shows the named empty state",
    run: async (page) => {
      // Taken away and put back byte for byte rather than reseeded: `/api/seed`
      // refuses outside demo mode, and a snapshot restores whatever this
      // instance actually had — including ticks — instead of Harold's.
      const store = redis();
      const stored = await store.get<unknown>(PLAN_KEY);
      if (stored === null) {
        throw new Error(
          `nothing is stored at ${PLAN_KEY}, so there is no plan to take away — seed the demo first`,
        );
      }
      await store.del(PLAN_KEY);

      try {
        const text = await open(page, "/plan");
        must(
          text.includes("No plan yet"),
          "/plan without a stored plan should name the empty state",
          text,
        );
        must(
          text.includes(
            "Your recovery plan is built from your discharge letter",
          ),
          "the empty state should explain where a plan comes from",
          text,
        );
        must(
          (await page.locator('section[aria-labelledby^="day-"]').count()) ===
            0,
          "the empty state should replace the timeline, not sit above an empty column",
          text,
        );
        const cta = page.getByRole("link", {
          name: /Take a photo or upload a PDF/,
        });
        must(
          (await cta.getAttribute("href")) === "/",
          `the empty state should route to home, not ${await cta.getAttribute("href")}`,
          text,
        );
        await shot(page, "plan-empty");
      } finally {
        // The next person to open this URL is presenting off it, so the plan
        // goes back whether or not the assertions above held.
        await store.set(PLAN_KEY, stored);
      }

      const primed = await open(page, "/plan");
      must(
        primed.includes("Your recovery plan") && primed.includes("Apixaban"),
        "the timeline should be back once the plan is restored",
        primed,
      );
    },
  },

  {
    name: "/plan holds up on a phone and inside the desktop frame",
    run: async (page) => {
      for (const [label, viewport, framed] of [
        ["phone", PHONE, false],
        ["desktop", DESKTOP, true],
      ] as const) {
        await page.setViewportSize(viewport);
        const text = await open(page, "/plan");

        const offenders = await horizontalOverflow(page);
        must(
          offenders.length === 0,
          `/plan must not scroll sideways at ${viewport.width}×${viewport.height}: ${offenders.join("; ")}`,
          text,
        );

        // The iOS status bar is lg-only demo chrome: on a real phone the OS
        // draws it and the frame goes full-bleed.
        const statusBarClock = page.getByText("15:50", { exact: true });
        must(
          (await statusBarClock.isVisible()) === framed,
          `the iPhone frame should be ${framed ? "drawn" : "absent"} at ${viewport.width}px wide`,
          text,
        );

        await shot(page, `plan-${label}-${viewport.width}x${viewport.height}`);
      }
      await page.setViewportSize(PHONE);
    },
  },

  // The last two steps are verdicts on everything above rather than a screen of
  // their own: both read observations the earlier steps collected as they went.
  {
    name: "Nothing renders in mono or in block capitals",
    run: async () => {
      if (typographyOffenders.length === 0) return;
      const listed = typographyOffenders
        .map((offender) => `${offender.step}  ${offender.detail}`)
        .join("\n      ");
      throw new Error(
        `${typographyOffenders.length} element(s) break the type rules:\n      ${listed}`,
      );
    },
  },

  {
    name: "The console and the network stayed clean",
    run: async () => {
      if (problems.length === 0) return;
      const listed = problems
        .map((problem) => `${problem.step}  —  ${problem.detail}`)
        .join("\n      ");
      throw new Error(
        `${problems.length} page error(s), console error(s) or 4xx/5xx response(s):\n      ${listed}`,
      );
    },
  },
];

// ── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  console.log(`Driving ${BASE_URL} in ${MODE} mode\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(60_000);

  page.on("pageerror", (error) => {
    problems.push({
      step: currentStep,
      detail: `page error: ${error.message}`,
    });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    problems.push({
      step: currentStep,
      detail: `console error: ${message.text()}`,
    });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    problems.push({
      step: currentStep,
      detail: `HTTP ${response.status()} on ${response.request().method()} ${new URL(response.url()).pathname}`,
    });
  });

  const results: Array<{ name: string; failure: string | null }> = [];
  for (const step of STEPS) {
    currentStep = step.name;
    process.stdout.write(`  ${step.name} … `);
    try {
      await step.run(page);
      results.push({ name: step.name, failure: null });
      console.log("pass");
    } catch (error) {
      results.push({
        name: step.name,
        failure: error instanceof Error ? error.message : String(error),
      });
      console.log("FAIL");
      await shot(page, `FAILED-${step.name.replace(/[^a-z0-9]+/gi, "-")}`);
    }
  }

  await browser.close();

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

  console.log(`\nScreenshots: ${resolve(SHOTS)}`);
  if (failed.length === 0) {
    console.log(`\nAll ${results.length} steps passed.`);
    return;
  }
  console.log(`\n${failed.length} of ${results.length} steps failed.`);
  process.exitCode = 1;
}

await main();
