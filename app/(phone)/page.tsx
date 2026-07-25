import Link from "next/link";

import { IconChevron, IconDoc, IconLock, IconMic } from "@/components/icons";
import { LanguagePicker } from "@/components/language-picker";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";

export default async function HomePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const actions = [
    {
      href: "/check-in",
      title: t.home.checkInTitle,
      blurb: t.home.checkInBlurb,
    },
    {
      href: "/plan",
      title: t.home.planTitle,
      blurb: t.home.planBlurb,
    },
  ];

  return (
    <main className="flex min-h-0 flex-1 flex-col px-6">
      {/* The language control sits top-right here and on every other screen, so
          it is always in the same place. -mr-2.5 pulls its padding back to the
          page gutter so the glyph optically aligns with the content below. */}
      <header className="flex shrink-0 items-center justify-between pt-6 pb-3">
        <span className="font-display text-xl font-semibold tracking-tight text-ink">
          {t.meta.title}
        </span>
        <div className="-mr-2.5">
          <LanguagePicker locale={locale} t={t.languagePicker} />
        </div>
      </header>

      <div className="flex flex-1 flex-col pt-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t.home.greeting}
        </h1>
        <p className="mt-3 text-lg text-ink-muted">{t.home.subtitle}</p>

        <nav className="mt-10 flex flex-col gap-3">
          {actions.map((action, i) => {
            const primary = i === 0;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`group flex items-center justify-between gap-4 rounded-card px-5 py-4 shadow-card transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70 ${
                  primary ? "bg-lavender" : "bg-white hover:bg-mist"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`flex size-10 shrink-0 items-center justify-center rounded-tactile ${
                      primary ? "bg-white text-navy" : "bg-mist text-ink-muted"
                    }`}
                  >
                    {primary ? (
                      <IconMic className="size-5" />
                    ) : (
                      <IconDoc className="size-5" />
                    )}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-display text-xl font-semibold tracking-tight text-ink">
                      {action.title}
                    </span>
                    <span className="mt-0.5 text-base text-ink-muted">
                      {action.blurb}
                    </span>
                  </span>
                </span>
                {primary ? null : (
                  <span
                    aria-hidden
                    className="shrink-0 text-ink-faint transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                  >
                    <IconChevron className="size-5" />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <footer className="shrink-0 py-6">
        {/* ink-faint measures 2.74:1 and fails AA, so it stays on the decorative
            glyph and the sentence takes ink-muted. */}
        <div className="flex items-start gap-3 rounded-card bg-mist p-4">
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
