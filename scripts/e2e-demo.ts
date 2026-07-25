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
//   make e2e
//   PORTICO_URL=https://… make e2e

// Trailing slash stripped: it survives into the `page.route` matcher that holds
// the server action open, where `//plan` would silently match nothing.
const BASE_URL = (process.env.PORTICO_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const SHOTS = ".e2e";

// Mirrors `lib/env.ts`: unset means live. The badge is asserted in BOTH
// directions off this — present in demo, absent in live — because a demo build
// that forgets to say so is the failure the badge exists to prevent.
const MODE = z
  .enum(["live", "demo"])
  .default("live")
  .parse(process.env.NEXT_PUBLIC_PORTICO_MODE);

// The empty-state step clears the stored plan and puts it back, so the harness
// needs the same Redis the app reads. Parsed here rather than at the call site
// so a misconfiguration fails by name before a browser is launched.
const REDIS = z
  .object({
    UPSTASH_REDIS_REST_URL: z.url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  })
  .parse(process.env);

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

// Established by the seed step; every later assertion is written against it.
let today = "";
let patientId = "";

// Console errors, uncaught page errors and failing requests, attributed to the
// step that was running when they happened.
type Problem = { step: string; detail: string };
const problems: Problem[] = [];
const typographyOffenders: Problem[] = [];
let currentStep = "startup";

// ── Assertions ──────────────────────────────────────────────────────────────

// Every failure carries the screen it failed against. A red row that does not
// say what was on the page costs a second run to diagnose, which is the whole
// reason to have a harness.
function must(ok: boolean, expectation: string, screen: string): void {
  if (ok) return;
  const flat = screen.replace(/\s+/g, " ").trim();
  throw new Error(
    `${expectation}\n      screen: ${flat.length > 600 ? `${flat.slice(0, 600)}…` : flat}`,
  );
}

// The plan screen's own grouping: "Coming up", "Any time", "Changed in
// hospital" are each a <section> named by their heading.
function group(page: Page, title: string): Locator {
  return page.locator(`section:has(h2:text-is("${title}"))`);
}

const TICK_STATES = {
  unanswered: "tap to record as taken.",
  taken: "recorded as taken. Tap to change to missed.",
  missed: "recorded as missed. Tap to change to taken.",
} as const;

// The tick's accessible name is its state — there is no other text on it — so
// polling the label is both the user-visible check and the screen-reader one.
async function waitForTick(
  tick: Locator,
  state: keyof typeof TICK_STATES,
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

const Seeded = z.object({
  patientId: z.string().min(1),
  today: z.iso.date(),
  plan: z.string().min(1),
});

async function seed(): Promise<z.infer<typeof Seeded>> {
  const response = await fetch(`${BASE_URL}/api/seed`, { method: "POST" });
  const raw = await response.text();
  if (!response.ok) {
    // An infrastructure failure is left to throw inside the route, so the body
    // is Next's HTML error page — thousands of lines whose useful part is the
    // first one.
    const detail = raw.trim().split("\n")[0]?.slice(0, 200) ?? "(empty body)";
    throw new Error(`POST /api/seed → HTTP ${response.status}: ${detail}`);
  }
  return Seeded.parse(JSON.parse(raw));
}

// ── Steps ───────────────────────────────────────────────────────────────────

type Step = { name: string; run: (page: Page) => Promise<void> };

const STEPS: Step[] = [
  {
    name: "Seed the demo",
    run: async () => {
      const seeded = await seed();
      today = seeded.today;
      patientId = seeded.patientId;
      // Every later assertion names a fact off this exact bundle, so a
      // different plan behind the same endpoint has to fail here and say so
      // rather than surface as a missing drug five steps later.
      must(
        seeded.plan === "seed/02-whitfield",
        `the demo arc is written against the Whitfield seed; /api/seed served "${seeded.plan}"`,
        JSON.stringify(seeded),
      );
    },
  },

  {
    name: "Home offers the two ways in",
    run: async (page) => {
      await page.goto(`${BASE_URL}/`);
      const text = await page.locator("body").innerText();
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
      await page.goto(`${BASE_URL}/plan`);
      const text = await page.locator("body").innerText();
      must(
        text.includes("Your recovery plan"),
        "/plan should be headed with the plan title",
        text,
      );
      await shot(page, "plan-top");

      const todayCard = page.locator(`section[aria-labelledby="day-${today}"]`);
      must(
        (await todayCard.count()) === 1,
        `the timeline should carry one card for today (${today}), found ${await todayCard.count()}`,
        text,
      );
      const todayText = await todayCard.innerText();
      must(
        todayText.startsWith("Today"),
        `today's card should be headed "Today"`,
        todayText,
      );

      for (const [drug, directions] of [
        ["Apixaban 5mg", "1 tab, BD, Oral, Ongoing"],
        ["Metformin 500mg", "1 tab, BD, Oral, Ongoing (reduced)"],
        ["Atorvastatin 20mg", "1 tab, Nocte, Oral, Ongoing"],
        ["Tiotropium 18mcg", "1 puff, OD, Inhaled, Ongoing"],
      ] as const) {
        must(
          todayText.includes(drug),
          `today's card should list ${drug}`,
          todayText,
        );
        must(
          todayText.includes(directions),
          `${drug} should carry its dose directions "${directions}"`,
          todayText,
        );
      }

      // The two-day antibiotic course: on the discharge-day cards, and expired
      // by today. A plan that still asks for it today is the failure worth
      // catching.
      must(
        text.includes("Doxycycline 100mg") &&
          text.includes("1 tab, OD, Oral, 2 days (complete)"),
        "the doxycycline course should be on the timeline with its directions",
        text,
      );
      must(
        !todayText.includes("Doxycycline"),
        "the doxycycline course ended before today, so it should be off today's card",
        todayText,
      );

      const comingUp = await group(page, "Coming up").innerText();
      must(
        comingUp.includes("Respiratory OP follow-up"),
        `"Coming up" should carry the respiratory follow-up`,
        comingUp,
      );
      must(
        comingUp.includes("Saturday 5 September") &&
          comingUp.includes("~05/09/2026"),
        `the respiratory follow-up should be dated 5 September, in the clinician's own approximate words`,
        comingUp,
      );

      const anyTime = await group(page, "Any time").innerText();
      must(
        anyTime.includes("Salbutamol 100mcg inh"),
        `"Any time" should hold the as-required reliever`,
        anyTime,
      );
      must(
        anyTime.includes("Finish the whole antibiotic course"),
        `"Any time" should hold the standing advice`,
        anyTime,
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
      await page.goto(`${BASE_URL}/plan`);
      const card = page.locator('section[aria-labelledby^="flag-"]');
      must(
        (await card.count()) === 1,
        `/plan should carry the letter's one red flag, found ${await card.count()} cards`,
        await page.locator("body").innerText(),
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
      // that the doctor never wrote would be the app speaking.
      must(
        cardText.includes("Your letter does not say who to contact for this."),
        "the card should say the letter names no recipient rather than invent one",
        cardText,
      );
      await shot(page, "red-flag-card");

      const link = card.getByRole("link", {
        name: /See where it says that/,
      });
      const href = await link.getAttribute("href");
      if (href === null) {
        throw new Error(`the "see where it says that" link carries no href`);
      }
      const source = new URL(href, BASE_URL);
      source.hash = "";

      const letter = await page.request.get(source.href);
      const body = await letter.body();
      const preview = body.subarray(0, 300).toString("utf8");
      must(
        letter.status() === 200,
        `${source.pathname} should serve the letter, got HTTP ${letter.status()}`,
        preview,
      );
      must(
        (letter.headers()["content-type"] ?? "").startsWith("application/pdf"),
        `the letter should be served as a PDF, got content-type "${letter.headers()["content-type"] ?? "(none)"}"`,
        preview,
      );
      // A 200 with the right header can still be an HTML error page. The magic
      // bytes are the only proof the patient gets their letter.
      must(
        body.subarray(0, 5).toString("utf8") === "%PDF-",
        "the bytes behind the link should be a PDF, not an error page wearing its content-type",
        preview,
      );
    },
  },

  {
    name: "A tick is optimistic and survives a reload",
    run: async (page) => {
      await page.goto(`${BASE_URL}/plan`);
      const todayCard = page.locator(`section[aria-labelledby="day-${today}"]`);
      const tick = todayCard.getByRole("button", {
        name: /^Metformin 500mg, today/,
      });
      await tick.scrollIntoViewIfNeeded();
      await waitForTick(tick, "unanswered", 5_000);

      // Hold the server action open: the mark must flip anyway. If it only
      // flips once the write lands then it is not optimistic, and the tap feels
      // dead on the connection an elderly patient actually has.
      await page.route(`${BASE_URL}/plan`, async (route) => {
        if (route.request().headers()["next-action"] !== undefined) {
          await new Promise((done) => setTimeout(done, 2_000));
        }
        await route.continue();
      });
      await tick.click();
      await waitForTick(tick, "taken", 750);
      await page.unrouteAll({ behavior: "wait" });

      await waitForTick(tick, "taken", 15_000);
      await shot(page, "tick-taken");

      await page.reload();
      await tick.scrollIntoViewIfNeeded();
      await waitForTick(tick, "taken", 15_000);
      await shot(page, "tick-taken-after-reload");

      await tick.click();
      await waitForTick(tick, "missed", 15_000);
      await shot(page, "tick-missed");

      await page.reload();
      await tick.scrollIntoViewIfNeeded();
      await waitForTick(tick, "missed", 15_000);
      await shot(page, "tick-missed-after-reload");
    },
  },

  {
    name: "/upload takes a photo or a file",
    run: async (page) => {
      await page.goto(`${BASE_URL}/upload`);
      const text = await page.locator("body").innerText();
      must(
        text.includes("Add your discharge letter"),
        "/upload should be headed with its purpose",
        text,
      );
      must(
        text.includes("Take a photo or choose a file"),
        "/upload should offer one control covering both paths",
        text,
      );

      const input = page.locator('input[type="file"]');
      must(
        (await input.count()) === 1,
        `/upload should have exactly one file control, found ${await input.count()}`,
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

      const badges = await page.getByText("Demo mode.").count();
      must(
        badges === (MODE === "demo" ? 1 : 0),
        MODE === "demo"
          ? `the app is in demo mode, so /upload must say so; found ${badges} badges`
          : `the app is in live mode, so /upload must not claim to be a demo; found ${badges} badges`,
        text,
      );

      await checkTypography(page, "/upload");
      await shot(page, "upload");
    },
  },

  {
    name: "/plan with no plan shows the named empty state",
    run: async (page) => {
      const redis = new Redis({
        url: REDIS.UPSTASH_REDIS_REST_URL,
        token: REDIS.UPSTASH_REDIS_REST_TOKEN,
      });
      await redis.del(`portico:plan:${patientId}`);

      await page.goto(`${BASE_URL}/plan`);
      const text = await page.locator("body").innerText();
      must(
        text.includes("No plan yet"),
        "/plan without a stored plan should name the empty state",
        text,
      );
      must(
        text.includes("Your recovery plan is built from your discharge letter"),
        "the empty state should explain where a plan comes from",
        text,
      );
      must(
        (await page.locator('section[aria-labelledby^="day-"]').count()) === 0,
        "the empty state should replace the timeline, not sit above an empty column",
        text,
      );
      const cta = page.getByRole("link", { name: /Add your discharge letter/ });
      must(
        (await cta.getAttribute("href")) === "/upload",
        `the empty state should route to /upload, not ${await cta.getAttribute("href")}`,
        text,
      );
      await shot(page, "plan-empty");

      // Leave the demo primed: the next person to open this URL is presenting.
      await seed();
      await page.goto(`${BASE_URL}/plan`);
      const primed = await page.locator("body").innerText();
      must(
        primed.includes("Your recovery plan") && primed.includes("Apixaban"),
        "reseeding should put the timeline back",
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
        await page.goto(`${BASE_URL}/plan`);
        const text = await page.locator("body").innerText();

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
