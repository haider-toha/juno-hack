"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { setLocale } from "@/app/actions/set-locale";
import type { Dictionary } from "@/lib/i18n/en";
import {
  isRealLocale,
  LOCALE_FLAGS,
  LOCALE_NAMES,
  PICKER_LOCALES,
  type Locale,
  type PickerLocale,
} from "@/lib/i18n/locales";

const rowClass =
  "flex min-h-11 w-full items-center gap-3 rounded-tactile px-3 text-left font-display text-base text-ink transition-colors duration-150 ease-out hover:bg-mist focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent active:bg-mist";

// The language control, top-right on every screen so it sits in the same place
// each time [Bilingual Technology Toolkit 4.3, 4.4].
//
// The list omits the language already in use (4.9) and marks nothing as the
// default (4.1). The six showcase languages look exactly like the real one on
// purpose: an "available soon" note beside a foreign endonym would be written
// in the current interface language, which is the mixed-language state 5.1
// forbids. They open a wholly in-language panel instead.
//
// Each row carries a simplified national-flag glyph next to the endonym so the
// list scans faster. The flag is aria-hidden; the endonym is the accessible
// name.
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
        <FlagIcon code={LOCALE_FLAGS[locale]} />
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
                  <FlagIcon code={LOCALE_FLAGS[code]} />
                  {LOCALE_NAMES[code]}
                </button>
              ) : (
                <Link
                  href={`/language?locale=${code}`}
                  onClick={() => setOpen(false)}
                  className={rowClass}
                >
                  <FlagIcon code={LOCALE_FLAGS[code]} />
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

// Inline SVG flag glyphs — no external assets. Simplified national flags at
// 60×40 so they read at ~20px. Decorative only; the endonym carries meaning.
function FlagIcon({ code }: { code: (typeof LOCALE_FLAGS)[PickerLocale] }) {
  const cls = "size-5 shrink-0 overflow-hidden rounded-[3px]";
  switch (code) {
    case "gb":
      return (
        <svg viewBox="0 0 60 40" aria-hidden className={cls}>
          <rect width="60" height="40" fill="#012169" />
          <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
          <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="3" />
          <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="13" />
          <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="7" />
        </svg>
      );
    case "cy":
      return (
        <svg viewBox="0 0 60 40" aria-hidden className={cls}>
          <rect width="60" height="20" fill="#fff" />
          <rect y="20" width="60" height="20" fill="#00734C" />
          <path
            d="M30 8c-3 0-5 2-5 5 0 2 2 4 5 4s5-2 5-4c0-3-2-5-5-5z"
            fill="#A5333A"
          />
          <path d="M28 17v3M32 17v3" stroke="#A5333A" strokeWidth="1.5" />
        </svg>
      );
    case "pl":
      return (
        <svg viewBox="0 0 60 40" aria-hidden className={cls}>
          <rect width="60" height="20" fill="#fff" />
          <rect y="20" width="60" height="20" fill="#DC143C" />
        </svg>
      );
    case "ro":
      return (
        <svg viewBox="0 0 60 40" aria-hidden className={cls}>
          <rect width="20" height="40" fill="#002B7F" />
          <rect x="20" width="20" height="40" fill="#FCD116" />
          <rect x="40" width="20" height="40" fill="#C8102E" />
        </svg>
      );
    case "tr":
      return (
        <svg viewBox="0 0 60 40" aria-hidden className={cls}>
          <rect width="60" height="40" fill="#E30A17" />
          <circle cx="22" cy="20" r="8" fill="#fff" />
          <circle cx="25" cy="20" r="6.5" fill="#E30A17" />
          <path d="M33 20l5-1.6-3.1 4.3V17.3l3.1 4.3z" fill="#fff" />
        </svg>
      );
    case "pt":
      return (
        <svg viewBox="0 0 60 40" aria-hidden className={cls}>
          <rect width="24" height="40" fill="#006600" />
          <rect x="24" width="36" height="40" fill="#FF0000" />
          <circle
            cx="24"
            cy="20"
            r="7"
            fill="none"
            stroke="#FFD700"
            strokeWidth="2"
          />
        </svg>
      );
    case "es":
      return (
        <svg viewBox="0 0 60 40" aria-hidden className={cls}>
          <rect width="60" height="40" fill="#AA151B" />
          <rect y="10" width="60" height="20" fill="#F1BF00" />
        </svg>
      );
    case "fr":
      return (
        <svg viewBox="0 0 60 40" aria-hidden className={cls}>
          <rect width="20" height="40" fill="#0055A4" />
          <rect x="20" width="20" height="40" fill="#fff" />
          <rect x="40" width="20" height="40" fill="#EF4135" />
        </svg>
      );
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}
