import Link from "next/link";

import { getDictionary, getLocale } from "@/lib/i18n/dictionary";

// Root-level, so this renders in the root layout rather than the phone shell —
// `dvh` is legal here and only here.
export default async function NotFound() {
  const t = getDictionary(await getLocale());
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 sm:px-10">
      <header className="border-b border-rule-strong py-6">
        <Link
          href="/"
          className="font-display text-base font-semibold tracking-tight text-ink transition-opacity duration-150 ease-out hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t.meta.title}
        </Link>
      </header>
      <div className="flex flex-1 flex-col justify-center py-24">
        {/* Tracked-out capitals were the previous treatment here; block capitals
            are banned, and on a numeral they bought nothing anyway. */}
        <p className="font-display text-sm font-medium text-accent">
          {t.notFound.code}
        </p>
        <h1 className="mt-3 text-5xl tracking-tight sm:text-6xl">
          {t.notFound.title}
        </h1>
        <p className="mt-6 max-w-[50ch] text-xl text-ink-muted">
          {t.notFound.body}{" "}
          <Link
            href="/"
            className="text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t.notFound.backHome}
          </Link>
        </p>
      </div>
    </main>
  );
}
