"use client";

import Link from "next/link";

// The boundary for every screen inside the phone shell. A plan that fails to
// parse, a store that will not answer — these have to say so. Rendering an
// empty timeline instead would look like "you have nothing to do today", which
// is the one thing this screen must never say by accident.
export default function PhoneError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-0 flex-1 flex-col justify-center px-5 pb-16">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
        We could not load this
      </h1>
      {/* The alert is on the sentence a patient needs, not on the technical
          detail below it: when the boundary mounts, a screen reader should
          interrupt with the explanation, not with the raw error. */}
      <p
        role="alert"
        className="mt-3 max-w-[42ch] text-base leading-relaxed text-ink-muted"
      >
        Something went wrong while we were reading your plan. We have not shown
        one, because a plan that might be wrong is worse than no plan at all.
        Nothing you have recorded has been lost.
      </p>
      <p className="mt-4 max-w-[46ch] rounded-card bg-mist px-4 py-3 text-sm leading-relaxed text-ink-muted">
        {error.message}
        {error.digest === undefined ? null : (
          <span className="tnum block pt-1">Reference {error.digest}</span>
        )}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-tactile bg-accent px-5 py-3 text-base font-semibold text-white transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
        >
          Try again
        </button>
        {/* A way out. If retrying keeps failing, the only other control on the
            screen must not be the one that just failed. */}
        <Link
          href="/"
          className="flex min-h-11 items-center rounded-tactile px-4 text-base font-semibold text-accent transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
