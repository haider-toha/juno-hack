"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { setLocale } from "@/app/actions/set-locale";
import { IconGlobe } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n/en";
import {
  isRealLocale,
  LOCALE_NAMES,
  PICKER_LOCALES,
  type Locale,
} from "@/lib/i18n/locales";

const rowClass =
  "flex min-h-11 w-full items-center rounded-tactile px-3 text-left font-display text-base text-ink transition-colors duration-150 ease-out hover:bg-mist focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent active:bg-mist";

// The language control, top-right on every screen so it sits in the same place
// each time [Bilingual Technology Toolkit 4.3, 4.4].
//
// Three rules shape what is NOT here. Flags are banned as a metaphor for
// language (4.8), so an endonym is the only identifier a row carries. The list
// omits the language already in use (4.9) and marks nothing as the default
// (4.1). And the six showcase languages look exactly like the real one on
// purpose: an "available soon" note beside a foreign endonym would be written
// in the current interface language, which is the mixed-language state 5.1
// forbids. They open a wholly in-language panel instead.
export function LanguagePicker({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary["languagePicker"];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const others = PICKER_LOCALES.filter((code) => code !== locale);

  function choose(next: Locale) {
    setOpen(false);
    startTransition(async () => {
      await setLocale(next);
    });
  }

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="language-menu"
        // The visible endonym is part of the accessible name, so what is spoken
        // and what is seen agree (WCAG 2.5.3).
        aria-label={`${t.change}: ${LOCALE_NAMES[locale]}`}
        aria-busy={pending}
        className="flex min-h-11 items-center gap-2 rounded-tactile px-2.5 text-ink-muted transition-colors duration-150 ease-out hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
      >
        <IconGlobe className="size-5 shrink-0" />
        <span lang={locale} className="font-display text-base font-medium">
          {LOCALE_NAMES[locale]}
        </span>
      </button>

      {/* Click-anywhere-else catcher. Invisible, aria-hidden and untabbable, so
          it is a pointer target only. */}
      {open ? (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-0 cursor-default bg-transparent"
        />
      ) : null}

      {open ? (
        <ul
          id="language-menu"
          aria-label={t.label}
          className="absolute right-0 top-full z-10 mt-1 max-h-72 w-56 overflow-y-auto overscroll-contain rounded-card border border-rule bg-surface p-1 shadow-card"
        >
          {others.map((code) => (
            // lang on each row so a screen reader pronounces every endonym in
            // its own language (WCAG 3.1.2).
            <li key={code} lang={code}>
              {isRealLocale(code) ? (
                <button
                  type="button"
                  onClick={() => choose(code)}
                  className={rowClass}
                >
                  {LOCALE_NAMES[code]}
                </button>
              ) : (
                <Link
                  href={`/language?locale=${code}`}
                  onClick={() => setOpen(false)}
                  className={rowClass}
                >
                  {LOCALE_NAMES[code]}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
