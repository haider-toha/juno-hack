"use client";

import Link from "next/link";

import { primaryButton, secondaryButton } from "@/components/button-styles";

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
    <main className="flex min-h-0 flex-1 flex-col justify-center px-6 pb-16">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
        We could not load this
      </h1>
      {/* The alert is on the sentence a patient needs. The thrown message is
          not on the screen at all: it is developer English written for whoever
          fixes this, and the reference below is the half of it that is
          actually of any use to the person holding the phone. */}
      <p role="alert" className="mt-3 leading-relaxed text-ink-muted">
        Your plan would not open just now. We have not shown part of one,
        because a plan that might be wrong is worse than no plan at all. Nothing
        you have recorded has been lost.
      </p>
      {error.digest === undefined ? null : (
        <p className="mt-4 rounded-card bg-mist px-4 py-3 text-base leading-relaxed text-ink-muted">
          If you tell someone about this, quote reference{" "}
          <span className="tnum">{error.digest}</span>.
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={reset} className={primaryButton}>
          Try again
        </button>
        {/* A way out. If retrying keeps failing, the only other control on the
            screen must not be the one that just failed. */}
        <Link href="/" className={secondaryButton}>
          Go home
        </Link>
      </div>
    </main>
  );
}
