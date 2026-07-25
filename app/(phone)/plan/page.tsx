import { BackButton } from "@/components/back-button";

export const metadata = { title: "Recovery plan" };

// Placeholder. The day-by-day timeline and its six tracks land here.
export default function PlanPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col px-5">
      <div className="-ml-2.5 shrink-0 pt-2">
        <BackButton href="/" />
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Your recovery plan
        </h1>
        <p className="mt-3 max-w-[40ch] text-base leading-relaxed text-ink-muted">
          Nothing here yet — this is where the day-by-day timeline goes.
        </p>
      </div>
    </main>
  );
}
