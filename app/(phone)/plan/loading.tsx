import { BackButton } from "@/components/back-button";
import { PlanCard } from "@/components/plan/plan-card";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";

// A skeleton of the real layout — the same gutter, the same header offset, a
// red-flag block and three day cards — rather than a spinner, so nothing jumps
// when the plan arrives. The back button is the real component, not a
// placeholder: it is known at request time, and a grey bar where a working
// control belongs is a worse trade than a moment's honesty.
//
// Async only for the locale. Both reads it makes are request-scoped and do no
// I/O, so the fallback still flushes with the shell rather than suspending it —
// and the strings on it are announced, which makes them exactly the
// "conditional or rarely used text" that must not leak English.
export default async function PlanLoading() {
  const t = getDictionary(await getLocale());

  return (
    <main aria-busy className="flex min-h-0 flex-1 flex-col bg-mist px-6">
      {/* A live region rather than a name on the landmark: "Loading your
          recovery plan" is a state, not what this part of the page is called,
          and as a status it is actually announced when the skeleton appears. */}
      <p role="status" className="sr-only">
        {t.plan.loading}
      </p>

      <div className="-ml-2.5 shrink-0 pt-2">
        <BackButton href="/" label={t.common.back} />
      </div>

      <header className="shrink-0 pt-2 pb-5">
        <Bar className="h-8 w-2/3" />
        <Bar className="mt-3 h-4 w-4/5" />
        <Bar className="mt-2 h-4 w-2/5" />
      </header>

      <div className="flex flex-col gap-8 pb-10">
        <PlanCard>
          <Bar className="h-4 w-2/5" />
          <Bar className="mt-3 h-5 w-4/5" />
          <Bar className="mt-2 h-4 w-3/5" />
          <Bar className="mt-4 h-11 w-full" />
        </PlanCard>

        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((card) => (
            <PlanCard key={card}>
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
            </PlanCard>
          ))}
        </div>
      </div>
    </main>
  );
}

// `rule` rather than `mist`: the skeleton has to read on the white cards and on
// the mist page behind them.
function Bar({ className }: { className: string }) {
  return <div aria-hidden className={`rounded-tactile bg-rule ${className}`} />;
}
