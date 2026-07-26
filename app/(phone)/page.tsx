import Link from "next/link";

import { primaryButton } from "@/components/button-styles";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import {
  IconChevron,
  IconDoc,
  IconLock,
  IconMic,
  IconUpload,
} from "@/components/icons";
import { LanguagePicker } from "@/components/language-picker";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { readPlan } from "@/lib/store/plan";

// Reads the stored plan to decide which step of the arc the patient is on, so
// it cannot be prerendered.
export const dynamic = "force-dynamic";

// The arc is letter → plan → check-in, and this screen is shaped like it. There
// is exactly one loud thing on it — the step the patient is actually on — and
// the rest of the arc sits under it as quiet rows, so nothing is hidden but
// nothing competes either. Which step is loud is read off the store rather than
// guessed: a check-in against a plan that does not exist is a dead end, and a
// screen that leads with it teaches the wrong thing about the product.
export default async function HomePage() {
  const [locale, bundle] = await Promise.all([
    getLocale(),
    readPlan(DEMO_PATIENT_ID),
  ]);
  const t = getDictionary(locale);

  const primary =
    bundle === null
      ? {
          href: "/upload",
          title: t.home.letterTitle,
          blurb: t.home.letterBlurb,
        }
      : {
          href: "/check-in",
          title: t.home.checkInTitle,
          blurb: t.home.checkInBlurb,
        };

  // Empty before a letter exists: "see my plan" and "check in" both land on
  // nothing, and offering a patient two doors into an empty room is worse than
  // offering none. The sentence under the button says what happens instead.
  const rest =
    bundle === null
      ? []
      : [
          { href: "/plan", title: t.home.planTitle, blurb: t.home.planBlurb },
          {
            href: "/upload",
            title: t.home.letterAgainTitle,
            blurb: t.home.letterAgainBlurb,
          },
        ];

  return (
    <main className="flex min-h-0 flex-1 flex-col px-6">
      {/* The language control sits top-right here and on every other screen, so
          it is always in the same place. -mr-2.5 pulls its padding back to the
          page gutter so the glyph optically aligns with the content below. */}
      <header className="flex shrink-0 items-center justify-between pt-6 pb-2">
        <span className="font-display text-xl font-semibold tracking-tight text-ink">
          {t.meta.title}
        </span>
        <div className="-mr-2.5">
          <LanguagePicker locale={locale} t={t.languagePicker} />
        </div>
      </header>

      <div className="shrink-0 pt-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t.home.greeting}
        </h1>
        <p className="mt-2 text-lg text-ink-muted">{t.home.subtitle}</p>
      </div>

      {/* The one thing to do next. Full width and the only filled element on the
          screen — from across a room this IS the screen. `py-4` rather than a
          taller `min-h`: the shared button style already sets `min-h`, and two
          utilities for one property resolve by stylesheet order, not by which
          was typed last. */}
      <div className="shrink-0 pt-7">
        <Link href={primary.href} className={`${primaryButton} w-full py-4`}>
          {bundle === null ? (
            <IconUpload className="size-6" />
          ) : (
            <IconMic className="size-6" />
          )}
          {primary.title}
        </Link>
        <p className="mt-2.5 max-w-[42ch] text-base leading-relaxed text-ink-muted">
          {primary.blurb}
        </p>
      </div>

      {rest.length === 0 ? (
        <p className="mt-7 max-w-[42ch] text-base leading-relaxed text-ink-muted">
          {t.home.nextUp}
        </p>
      ) : (
        // Rows on the page rather than cards: two more shadowed cards under the
        // button would read as three offers of equal weight, which is the thing
        // this screen previously got wrong. A hairline is enough to separate
        // them, and the chevron says where they go.
        <nav className="mt-7 flex flex-col divide-y divide-rule border-y border-rule">
          {rest.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className="group flex min-h-16 items-center justify-between gap-4 py-3.5 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-tactile bg-mist text-ink-muted"
                >
                  {step.href === "/plan" ? (
                    <IconDoc className="size-5" />
                  ) : (
                    <IconUpload className="size-5" />
                  )}
                </span>
                <span className="flex flex-col">
                  <span className="font-display text-lg font-semibold tracking-tight text-ink">
                    {step.title}
                  </span>
                  <span className="mt-0.5 text-base text-ink-muted">
                    {step.blurb}
                  </span>
                </span>
              </span>
              <span
                aria-hidden
                className="shrink-0 text-ink-muted transition-transform duration-150 ease-out group-hover:translate-x-0.5"
              >
                <IconChevron className="size-5" />
              </span>
            </Link>
          ))}
        </nav>
      )}

      {/* Both admissions sit together at the foot: what is recorded rather than
          live, and who the data does not go to. mt-auto pins them to the bottom
          so the screen reads top-and-bottom instead of leaving a dead half. */}
      <footer className="mt-auto flex shrink-0 flex-col items-start gap-3 pt-10 pb-6">
        <DemoModeBadge text={t.common.demoMode} />
        <div className="flex items-start gap-3 rounded-card bg-mist p-4">
          {/* ink-faint is the faintest tier and stays on the decorative glyph;
              the sentence takes ink-muted. */}
          <span aria-hidden className="mt-1 shrink-0 text-ink-faint">
            <IconLock className="size-4" />
          </span>
          <p className="max-w-[42ch] text-sm leading-relaxed text-ink-muted">
            {t.home.privacy}
          </p>
        </div>
      </footer>
    </main>
  );
}
