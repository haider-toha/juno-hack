"use client";

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
      <p className="mt-3 max-w-[42ch] text-base leading-relaxed text-ink-muted">
        Something went wrong reading your plan, so we have not shown one rather
        than show you a plan that might be wrong. Nothing you have recorded has
        been lost.
      </p>
      <p
        role="alert"
        className="mt-4 max-w-[46ch] rounded-card bg-mist px-4 py-3 text-sm leading-relaxed text-ink-muted"
      >
        {error.message}
        {error.digest === undefined ? null : (
          <span className="tnum block pt-1">Reference {error.digest}</span>
        )}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 min-h-11 w-fit rounded-tactile bg-accent px-5 py-3 text-base font-semibold text-white transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
      >
        Try again
      </button>
    </main>
  );
}
