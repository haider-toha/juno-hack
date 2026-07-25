import { notFound } from "next/navigation";

import { setLocaleAndReturnHome } from "@/app/actions/set-locale";
import {
  isShowcaseLocale,
  LOCALE_NAMES,
  REAL_LOCALES,
} from "@/lib/i18n/locales";
import { SHOWCASE_NOTICES } from "@/lib/i18n/showcase";

// The "not yet" panel for a language Portico can name but cannot speak.
//
// Everything on it is written in that language and nothing else — no heading,
// no back link, no badge in the current interface language — because a screen
// carrying two languages at once is the one outcome the Bilingual Technology
// Toolkit 5.1 forbids, and the pattern the Welsh Language Commissioner names as
// likely non-compliance. The two endonym buttons are the only way off it, and
// they are language-neutral by construction.
//
// This is a page, not an overlay, so it fills the phone-shell column with
// `flex min-h-0 flex-1 flex-col` and never reaches for dvh/vh — the frame owns
// the height.
export default async function LanguageNoticePage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string | string[] }>;
}) {
  const { locale } = await searchParams;
  // searchParams is a trust boundary. This narrow is the validation: anything
  // that is not one of the six showcase locales is a 404, so a real locale
  // cannot reach a "not yet" screen and an invented one cannot render at all.
  const showcase = Array.isArray(locale) ? undefined : locale;
  if (!isShowcaseLocale(showcase)) notFound();

  const notice = SHOWCASE_NOTICES[showcase];

  return (
    <main lang={showcase} className="flex min-h-0 flex-1 flex-col px-6">
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {notice.title}
        </h1>
        <p className="mt-4 max-w-[34ch] text-lg leading-relaxed text-ink-muted">
          {notice.body}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-3 py-8">
        {REAL_LOCALES.map((code) => (
          <form key={code} action={setLocaleAndReturnHome.bind(null, code)}>
            <button
              type="submit"
              lang={code}
              className="flex min-h-[3.25rem] w-full items-center justify-center rounded-tactile bg-mist px-5 font-display text-lg font-medium text-ink transition-colors duration-150 ease-out hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
            >
              {LOCALE_NAMES[code]}
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
