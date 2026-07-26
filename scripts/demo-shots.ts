import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { chromium } from "playwright";
import type { Page } from "playwright";

// Photographs the demo arc so the hierarchy can be judged from the rendered
// pixels rather than from the JSX. `scripts/e2e-demo.ts` asserts that the arc
// is CORRECT; this one only asks whether it READS — which is a question you
// cannot answer without looking.
//
// Same shape as that harness deliberately: plain `.ts` run by node (Node 26
// strips types), no test runner, no app imports, both the real-phone viewport
// and the desktop iPhone frame that gets filmed.
//
//   pnpm exec playwright install chromium   # once
//   node scripts/demo-shots.ts
//   PORTICO_URL=https://… node scripts/demo-shots.ts
//
// Writes under `.e2e/ui/` rather than `.e2e/` itself because `make e2e` wipes
// `.e2e` on every run; a sibling folder still gets caught by that, so re-run
// this script after the harness rather than expecting the two sets to coexist.

const BASE_URL = (process.env.PORTICO_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const SHOTS = ".e2e/ui";

// A real phone (the lg: bezel is hidden below 1024px) and the desktop frame the
// demo is recorded in. A screen that reads on one and not the other is not done.
const VIEWPORTS = [
  { label: "phone", size: { width: 390, height: 844 } },
  { label: "desktop", size: { width: 1440, height: 900 } },
] as const;

// `/plan` streams, so `goto` resolves on the skeleton whose <main> is
// aria-busy. `/check-in` renders no <main> at all — it is the voice client leaf
// — so the wait falls back to the phone shell's scroll region.
async function open(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
  const settled = page.locator("main:not([aria-busy])");
  if ((await settled.count()) > 0) {
    await settled.first().waitFor();
  }
  // Let the reveal transitions and font swap finish before the shutter.
  await page.waitForTimeout(350);
}

type Screen = {
  name: string;
  path: string;
  // Clicked before the shot — the disclosures are half the plan screen's
  // progressive-disclosure story and a closed one photographs as nothing.
  open?: string;
  // Scrolls something into view before the shot. `scrollTo` only scrolls if the
  // target is off screen, which is the honest "what does a patient see" test;
  // `scrollToTop` parks the target at the top of the frame so a card taller than
  // the viewport can be photographed whole.
  scrollTo?: string;
  scrollToTop?: string;
};

const SCREENS: Screen[] = [
  { name: "home", path: "/" },
  { name: "upload", path: "/upload" },
  { name: "plan-top", path: "/plan" },
  {
    name: "plan-today",
    path: "/plan",
    scrollToTop: 'section[aria-labelledby^="day-"]:has(span:text-is("Today"))',
  },
  {
    name: "plan-scrolled",
    path: "/plan",
    scrollTo: 'section:has(h2:text-is("Changed in hospital"))',
  },
  {
    name: "red-flag",
    path: "/plan",
    open: 'summary:has-text("What the NHS says")',
    scrollToTop: 'section[aria-labelledby^="flag-"]',
  },
  { name: "check-in-idle", path: "/check-in" },
];

// Track 1's screens. Shot only once they exist, so a run before they land is a
// shorter set rather than a failure.
const PENDING: Screen[] = [
  { name: "family", path: "/family" },
  { name: "operator", path: "/operator" },
];

async function exists(path: string): Promise<boolean> {
  const response = await fetch(`${BASE_URL}${path}`, { method: "GET" });
  return response.ok;
}

async function main() {
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  const landed: Screen[] = [];
  for (const screen of PENDING) {
    if (await exists(screen.path)) landed.push(screen);
    else console.log(`  skipping ${screen.path} — not built yet`);
  }
  const screens = [...SCREENS, ...landed];

  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(60_000);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport.size);
    for (const screen of screens) {
      await open(page, screen.path);
      if (screen.open !== undefined) {
        await page.locator(screen.open).first().click();
        await page.waitForTimeout(250);
      }
      if (screen.scrollTo !== undefined) {
        const target = page.locator(screen.scrollTo).first();
        if ((await target.count()) > 0) {
          await target.scrollIntoViewIfNeeded();
          await page.waitForTimeout(250);
        }
      }
      if (screen.scrollToTop !== undefined) {
        await page
          .locator(screen.scrollToTop)
          .first()
          .evaluate((el) => {
            el.scrollIntoView({ block: "start" });
          });
        await page.waitForTimeout(250);
      }
      const file = `${SHOTS}/${viewport.label}-${screen.name}.png`;
      await page.screenshot({ path: file });
      console.log(`  ${file}`);
    }
  }

  await browser.close();
  console.log(`\nScreenshots: ${resolve(SHOTS)}`);
}

await main();
