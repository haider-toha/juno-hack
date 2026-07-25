// A skeleton of the real layout — a header block and three day cards — rather
// than a spinner, so nothing jumps when the plan arrives.
export default function PlanLoading() {
  return (
    <main aria-busy className="flex min-h-0 flex-1 flex-col bg-mist px-5 pt-12">
      {/* A live region rather than a name on the landmark: "Loading your
          recovery plan" is a state, not what this part of the page is called,
          and as a status it is actually announced when the skeleton appears. */}
      <p role="status" className="sr-only">
        Loading your recovery plan
      </p>
      <div className="shrink-0 pb-5">
        <Bar className="h-8 w-2/3" />
        <Bar className="mt-3 h-4 w-4/5" />
        <Bar className="mt-2 h-4 w-2/5" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((card) => (
          <div key={card} className="rounded-card bg-surface px-5 py-4">
            <Bar className="h-5 w-1/2" />
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-start gap-3 py-3">
                <Bar className="size-6 shrink-0 rounded-pill" />
                <div className="flex-1">
                  <Bar className="h-4 w-2/5" />
                  <Bar className="mt-2 h-3.5 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

// `rule` rather than `mist`: the skeleton has to read on the white cards and on
// the mist page behind them.
function Bar({ className }: { className: string }) {
  return <div aria-hidden className={`rounded-tactile bg-rule ${className}`} />;
}
