import Link from "next/link";

import { primaryButton } from "@/components/button-styles";
import { IconAlert, IconDoc, IconLock, IconMic } from "@/components/icons";
import { LanguagePicker } from "@/components/language-picker";
import { PorticoWordmark } from "@/components/portico-wordmark";
import { AddLetterRow } from "@/components/upload/add-letter-row";
import { UploadPanel } from "@/components/upload/upload-panel";
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
//
// Upload lives here. Before a letter: the file control is the home. After a
// letter: "Add another letter" opens the picker on this same screen — there is
// no second route, and no `?letter=1` that swaps the check-in for a bigger
// button.
export default async function HomePage() {
  const [locale, bundle] = await Promise.all([
    getLocale(),
    readPlan(DEMO_PATIENT_ID),
  ]);
  const t = getDictionary(locale);
  const showUpload = bundle === null;

  // Empty before a letter exists: "see my plan" and "check in" both land on
  // nothing, and offering a patient two doors into an empty room is worse than
  // offering none.
  const links =
    bundle === null
      ? []
      : [
          {
            href: "/plan",
            title: t.home.planTitle,
            blurb: t.home.planBlurb,
            kind: "plan" as const,
          },
          {
            href: "/family",
            title: t.home.familyTitle,
            blurb: t.home.familyBlurb,
            kind: "family" as const,
          },
        ];

  // Surface over the shell's mist scrollport — home is white; secondary
  // controls are mist and would disappear on a mist page. lg:-mb-5 / lg:pb-5
  // pulls the white canvas over the shell's home-indicator pad so mist does
  // not peek under the bar (other screens keep mist there on purpose).
  return (
    <main className="flex min-h-0 flex-1 flex-col bg-surface px-6 lg:-mb-5 lg:pb-5">
      {/* The language control sits top-right here and on every other screen, so
          it is always in the same place. -mr-2.5 pulls its padding back to the
          page gutter so the glyph optically aligns with the content below. */}
      <header className="flex shrink-0 items-center justify-between pt-6 pb-2">
        <PorticoWordmark className="text-xl" />
        <div className="-mr-2.5">
          <LanguagePicker locale={locale} t={t.languagePicker} />
        </div>
      </header>

      <div className="shrink-0 pt-12">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t.home.greeting}
        </h1>
        <p className="mt-2 text-lg text-ink-muted">{t.home.subtitle}</p>
      </div>

      {showUpload ? (
        // flex-1 + justify-center drops the control into the empty middle of
        // the column — higher than the privacy foot, lower than a header CTA
        // that left half the phone blank. The panel owns the large tap target.
        <div className="flex min-h-0 flex-1 flex-col justify-center py-6">
          <UploadPanel
            patientId={DEMO_PATIENT_ID}
            t={{
              ...t.upload.panel,
              cta: t.home.letterTitle,
              idleNote: t.home.letterHint,
            }}
          />
        </div>
      ) : (
        // The one thing to do next. Full width and the only filled element on
        // the screen — from across a room this IS the screen. `py-4` rather
        // than a taller `min-h`: the shared button style already sets `min-h`,
        // and two utilities for one property resolve by stylesheet order, not
        // by which was typed last.
        <div className="shrink-0 pt-12">
          <Link href="/check-in" className={`${primaryButton} w-full py-4`}>
            <IconMic className="size-6" />
            {t.home.checkInTitle}
          </Link>
        </div>
      )}

      {bundle !== null ? (
        // Soft secondary buttons, not a bordered list. Mist fill + gap keeps
        // them quieter than the blue check-in without the hairline table vibe.
        // "Add another letter" is a file label, not a link — the picker opens
        // here so home never navigates into a second upload screen.
        <nav className="mt-12 flex flex-col gap-4">
          {links.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className="flex min-h-14 items-center gap-3 rounded-tactile bg-mist px-4 py-3.5 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
            >
              <span aria-hidden className="shrink-0 text-ink-muted">
                {step.kind === "plan" ? (
                  <IconDoc className="size-5" />
                ) : (
                  <IconAlert className="size-5" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col text-left">
                <span className="font-display text-lg font-semibold tracking-tight text-ink">
                  {step.title}
                </span>
                <span className="mt-0.5 text-base text-ink-muted">
                  {step.blurb}
                </span>
              </span>
            </Link>
          ))}
          <AddLetterRow
            patientId={DEMO_PATIENT_ID}
            title={t.home.letterAgainTitle}
            blurb={t.home.letterAgainBlurb}
            t={t.upload.panel}
          />
        </nav>
      ) : null}

      {/* Privacy sits at the foot: health apps earn the upload by saying who
          the data does not go to. mt-auto pins it so the screen reads
          top-and-bottom instead of leaving a dead half. */}
      <footer className="mt-auto flex shrink-0 flex-col items-start gap-3 pt-10 pb-6">
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
