import { chromium } from "playwright";
import type { Page } from "playwright";
import { z } from "zod";

// The four demo behaviours that only exist in a browser, and that
// `scripts/e2e-demo.ts` walks past: what a tick does when the write FAILS, what
// the phone does when a push lands while it is sitting on another screen, and
// what happens to a screen mid-flow when the reader changes language.
//
// Node 26 strips types natively, so this is a plain `.ts` file run by `node` —
// no test runner, matching `scripts/e2e-demo.ts`. It imports no app code:
// everything it knows it learns over HTTP or off the rendered DOM.
//
//   pnpm exec playwright install chromium   # once
//   make ui-edges
//   PORTICO_URL=https://… make ui-edges

const BASE_URL = (process.env.PORTICO_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

const MODE = z
  .enum(["live", "demo"])
  .default("live")
  .parse(process.env.NEXT_PUBLIC_PORTICO_MODE);

// The nudge beat needs a reminder on the record, and only the agent's server
// tool can write one.
const TOOL_SECRET = z.string().min(1).parse(process.env.PORTICO_TOOL_SECRET);

const PHONE = { width: 390, height: 844 };

// The banners poll every 5s (`components/phone/*-banner.tsx`), so anything
// waiting on one has to allow a full cycle plus a render.
const POLL_WINDOW_MS = 12_000;

// ── Assertions ──────────────────────────────────────────────────────────────

function must(ok: boolean, expectation: string, observed: string): void {
  if (ok) return;
  const flat = observed.replace(/\s+/g, " ").trim();
  throw new Error(
    `${expectation}\n      observed: ${flat.length > 500 ? `${flat.slice(0, 500)}…` : flat}`,
  );
}

// `/plan` streams: `goto` resolves on the skeleton, whose <main> is `aria-busy`.
async function open(page: Page, path: string): Promise<string> {
  await page.goto(`${BASE_URL}${path}`);
  const main = page.locator("main:not([aria-busy])");
  await main.waitFor();
  return main.innerText();
}

async function post(path: string, body?: unknown): Promise<string> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-portico-tool-secret": TOOL_SECRET,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response.text();
}

// The tick's accessible name is its state — there is no other text on it — so
// reading the label is both the sighted check and the screen-reader one.
const TICK_STATES = {
  unanswered: "tap to record as taken.",
  taken: "recorded as taken. Tap to change to missed.",
  missed: "recorded as missed. Tap to change to taken.",
} as const;

type TickState = keyof typeof TICK_STATES;

async function tickState(page: Page, name: RegExp): Promise<TickState> {
  const label =
    (await page.getByRole("button", { name }).getAttribute("aria-label")) ?? "";
  const found = (Object.keys(TICK_STATES) as TickState[]).find((state) =>
    label.endsWith(TICK_STATES[state]),
  );
  must(
    found !== undefined,
    `the tick's name should say which state it is in`,
    label,
  );
  return found ?? "unanswered";
}

// ── Steps ───────────────────────────────────────────────────────────────────

type Step = { name: string; run: (page: Page) => Promise<void> };

const STEPS: Step[] = [
  {
    name: "A tick whose write fails says so, and leaves nothing behind",
    run: async (page) => {
      await post("/api/seed");
      await open(page, "/plan");

      // Metformin rather than apixaban: the seed primes apixaban with two
      // misses, and a step that also moved it would change what the next step
      // is looking at.
      const name = /^Metformin 500mg, today/;
      const before = await tickState(page, name);
      const tick = page.getByRole("button", { name });
      await tick.scrollIntoViewIfNeeded();

      // Kill the Server Action. `logStep` rejects, the component's `catch` runs,
      // and the claim under test is the one in its own comment: "A failed write
      // unwinds the same way: the tick goes back to what was last recorded
      // rather than showing a tick for something that was never saved."
      let killedTheAction = false;
      await page.route(`${BASE_URL}/plan`, async (route) => {
        if (route.request().headers()["next-action"] !== undefined) {
          killedTheAction = true;
          await route.abort("failed");
          return;
        }
        await route.continue();
      });

      await tick.click();
      const notSaved = page
        .getByRole("alert")
        .filter({ hasText: "Not saved. Tap again." });
      await notSaved.first().waitFor({ timeout: 10_000 });
      must(
        killedTheAction,
        "no server action was intercepted, so the failure path was never actually exercised",
        `killedTheAction=${killedTheAction}`,
      );

      const after = await tickState(page, name);
      must(
        after === before,
        `a failed write must unwind the tick to what was last recorded (${before}), not leave the optimistic mark standing`,
        after,
      );

      await page.unrouteAll({ behavior: "wait" });

      // And nothing reached Redis. A reload is the honest check: the optimistic
      // value is gone by construction, so only a stored answer could survive.
      await page.reload();
      const main = page.locator("main:not([aria-busy])");
      await main.waitFor();
      must(
        (await tickState(page, name)) === before,
        `nothing should have been written, so a reload should still read ${before}`,
        await tickState(page, name),
      );
      must(
        (await page.getByText("Not saved. Tap again.").count()) === 0,
        "the failure message belongs to the tap that failed, not to the screen",
        String(await page.getByText("Not saved. Tap again.").count()),
      );

      // The message says "Tap again", so tapping again has to work.
      await page.getByRole("button", { name }).scrollIntoViewIfNeeded();
      await page.getByRole("button", { name }).click();
      const expected: TickState = before === "taken" ? "missed" : "taken";
      await page
        .getByRole("button", { name: new RegExp(`${TICK_STATES[expected]}$`) })
        .first()
        .waitFor({ timeout: 15_000 });
      // The discriminator: without this the step would still pass if the chip
      // were rendered unconditionally on every tap.
      must(
        (await page.getByText("Not saved. Tap again.").count()) === 0,
        "a write that succeeds must not show the failure message",
        await page.locator("main").innerText(),
      );
      await page.reload();
      await page.locator("main:not([aria-busy])").waitFor();
      must(
        (await tickState(page, name)) === expected,
        `the retry should be the one that persists, reading ${expected} after a reload`,
        await tickState(page, name),
      );
    },
  },

  {
    name: "The dose nudge rings the phone from another screen, and clears when dismissed",
    run: async (page) => {
      await post("/api/seed");
      // Written by the agent's `schedule_reminder`, not by the banner: the point
      // of this beat is that the phone shows something that genuinely exists.
      const scheduled = await post("/api/remind", {
        patient_id: "demo",
        check_in_id: "ui-edges",
        item_id: "med-apixaban",
        time: "22:00",
      });
      must(
        scheduled.includes('"ok":true'),
        "the reminder the banner is about should have been written by the tool route",
        scheduled,
      );

      // Sitting on home, not on /plan — the banner deliberately renders nothing
      // on the screen it would send you to.
      await open(page, "/");
      must(
        (await page.getByText("Apixaban 5mg", { exact: false }).count()) === 0,
        "nothing should be ringing before the operator fires it",
        await page.locator("body").innerText(),
      );

      await post("/api/demo/reminder");
      const banner = page.getByRole("link", { name: /Apixaban 5mg/ });
      await banner.waitFor({ timeout: POLL_WINDOW_MS });
      must(
        (await banner.getAttribute("href")) === "/plan#dose-med-apixaban",
        "the nudge names one medicine, so it should open on that medicine's row",
        String(await banner.getAttribute("href")),
      );

      await page
        .getByRole("button", { name: /Dismiss/i })
        .first()
        .click();
      await banner.waitFor({ state: "detached", timeout: POLL_WINDOW_MS });

      // Dismissing clears the ring in the store, not only on this device — the
      // banner is a view of Redis, so a second phone must stop showing it too.
      const raised = await fetch(`${BASE_URL}/api/demo/reminder`).then((r) =>
        r.text(),
      );
      must(
        raised.includes('"raised":null'),
        "dismissing the banner should clear the raised nudge in the store",
        raised,
      );
      must(
        raised.includes('"itemId":"med-apixaban"'),
        "dismissing the banner should NOT delete the reminder behind it",
        raised,
      );
    },
  },

  {
    name: "Changing language on the check-in screen re-renders all of it, and what the agent will say",
    run: async (page) => {
      await post("/api/seed");
      await page.context().clearCookies();
      await page.goto(`${BASE_URL}/check-in`);
      await page.locator("[aria-expanded]").first().waitFor();

      const englishOpening = await englishFirstMessage();

      const before = await page.locator("body").innerText();
      must(
        before.includes("Let's check in."),
        "the check-in should open in English before the switch",
        before,
      );

      // The picker is a client leaf calling a Server Action that writes the
      // cookie and revalidates the whole layout — so this is a real mid-flow
      // switch, not a navigation to a French URL.
      await page
        .getByRole("button", { name: /Change language|Changer de langue/ })
        .click();
      await page.getByRole("button", { name: "Français" }).click();

      await page.getByText("Faisons le point.").waitFor({ timeout: 15_000 });
      const after = await page.locator("body").innerText();
      must(
        !after.includes("Let's check in."),
        "no English chrome should survive the switch — a screen carrying two languages at once is the failure the picker exists to prevent",
        after,
      );
      must(
        (await page.locator("html").getAttribute("lang")) === "fr",
        "the document language should change with the interface language",
        String(await page.locator("html").getAttribute("lang")),
      );

      // The screen and the agent have to move together. The opening line is
      // composed on the server from the same locale the screen was rendered in,
      // so if it did not change, the French reader gets an English greeting.
      const frenchOpening = await frenchFirstMessage();
      must(
        frenchOpening !== englishOpening && frenchOpening.length > 0,
        "the agent's opening line should be composed in the reader's language, not left in English",
        `en: ${englishOpening}\n      fr: ${frenchOpening}`,
      );

      // And the choice outlives the page it was made on.
      await page.goto(`${BASE_URL}/plan`);
      await page.locator("main:not([aria-busy])").waitFor();
      must(
        (await page.locator("html").getAttribute("lang")) === "fr",
        "the language choice should survive a navigation, because it is a cookie the server re-reads",
        String(await page.locator("html").getAttribute("lang")),
      );
    },
  },

  {
    name: "A language Portico cannot speak never quietly becomes the interface language",
    run: async (page) => {
      await page.context().clearCookies();
      await page.goto(`${BASE_URL}/language?locale=cy`);
      const welsh = await page.locator("main").innerText();
      must(
        welsh.length > 0 && !/Portico is not yet|available soon/i.test(welsh),
        "the not-yet panel must be written wholly in the language it is about",
        welsh,
      );

      const cookies = await page.context().cookies();
      must(
        cookies.find((c) => c.name === "portico_locale") === undefined,
        "opening the not-yet panel must not set the locale cookie — there is no dictionary to render",
        JSON.stringify(cookies.map((c) => `${c.name}=${c.value}`)),
      );

      // The two endonym buttons are the only way off it, and they have to land
      // somewhere real.
      await page.getByRole("button", { name: "English" }).click();
      await page.waitForURL(`${BASE_URL}/`);
      must(
        (await page.locator("html").getAttribute("lang")) === "en",
        "choosing English from the not-yet panel should land on an English home",
        String(await page.locator("html").getAttribute("lang")),
      );
      const chosen = await page.context().cookies();
      must(
        chosen.find((c) => c.name === "portico_locale")?.value === "en",
        "the choice made on the not-yet panel is the one that gets stored",
        JSON.stringify(chosen.map((c) => `${c.name}=${c.value}`)),
      );
    },
  },
];

// The agent's opening line is a server-composed prop, so it is read off the
// rendered page rather than out of `lib/check-in-prompt.ts` — the assertion is
// that it CHANGES with the locale, never what it says, which is another track's
// copy to write.
async function firstMessageFor(locale: string): Promise<string> {
  const html = await fetch(`${BASE_URL}/check-in`, {
    headers: { cookie: `portico_locale=${locale}` },
  }).then((response) => response.text());
  // Read out of the React Flight payload, where the prop is JSON inside a
  // string literal — so the quotes around it arrive escaped.
  return /\\"firstMessage\\":\\"(.*?)\\"/.exec(html)?.[1] ?? "";
}

const englishFirstMessage = () => firstMessageFor("en");
const frenchFirstMessage = () => firstMessageFor("fr");

// ── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  if (MODE !== "demo") {
    console.error(
      `These edges are demo-mode state (the seed, the nudge ring).\nThe app under test is in ${MODE} mode, where those correctly refuse.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Driving ${BASE_URL} in ${MODE} mode\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(60_000);

  const results: Array<{ name: string; failure: string | null }> = [];
  for (const step of STEPS) {
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
    }
  }

  await browser.close();
  await post("/api/seed");

  console.log();
  const width = Math.max(...STEPS.map((step) => step.name.length));
  console.log(`    ${"Step".padEnd(width)}  Result`);
  results.forEach((result, index) => {
    console.log(
      `${String(index + 1).padStart(2)}  ${result.name.padEnd(width)}  ${result.failure === null ? "pass" : "FAIL"}`,
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
