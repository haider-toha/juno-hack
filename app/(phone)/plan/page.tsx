import Link from "next/link";

import { BackButton } from "@/components/back-button";
import { IconUpload } from "@/components/icons";
import { formatDay } from "@/components/plan/day-section";
import { Timeline } from "@/components/plan/timeline";
import { getDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { readLog } from "@/lib/store/log";
import { readPlan } from "@/lib/store/plan";
import { addDays, buildTimeline, standingItems } from "@/lib/timeline/schedule";

export const metadata = { title: "Recovery plan" };

// Redis-backed and patient-specific: prerendering it would bake one moment of
// one patient's plan into the build.
export const dynamic = "force-dynamic";

// The days the screen can show an answer for — two back, four forward, matching
// the window `<Timeline>` renders.
const LOG_WINDOW = [-2, -1, 0, 1, 2, 3, 4];

export default async function PlanPage() {
  const [today, bundle] = await Promise.all([
    getDemoToday(),
    readPlan(DEMO_PATIENT_ID),
  ]);

  if (bundle === null) return <NoPlanYet />;

  const log = await readLog(
    DEMO_PATIENT_ID,
    LOG_WINDOW.map((offset) => addDays(today, offset)),
  );
  const statuses = new Map(
    log.map((entry) => [`${entry.day}:${entry.itemId}`, entry.status]),
  );

  const days = buildTimeline(bundle, today);
  const changed = bundle.medications.filter(
    (medication) =>
      medication.changeStatus === "stopped" ||
      medication.changeStatus === "amended",
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-mist px-5">
      <div className="-ml-2.5 shrink-0 pt-2">
        <BackButton href="/" />
      </div>

      <header className="shrink-0 pt-2 pb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Your recovery plan
        </h1>
        {bundle.episode.titlePlain === null ? null : (
          <p className="mt-2 max-w-[46ch] text-base leading-relaxed text-ink-muted">
            {bundle.episode.titlePlain}
          </p>
        )}
        {bundle.episode.dischargeDate === null ? null : (
          <p className="mt-1 text-sm text-ink-muted">
            Home since {formatDay(bundle.episode.dischargeDate)}
          </p>
        )}
      </header>

      <Timeline
        days={days}
        standing={standingItems(bundle)}
        changed={changed}
        today={today}
        statuses={statuses}
      />
    </main>
  );
}

function NoPlanYet() {
  return (
    <main className="flex min-h-0 flex-1 flex-col px-5">
      <div className="-ml-2.5 shrink-0 pt-2">
        <BackButton href="/" />
      </div>
      <div className="flex flex-1 flex-col justify-center pb-16">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          No plan yet
        </h1>
        <p className="mt-3 max-w-[42ch] text-base leading-relaxed text-ink-muted">
          Your recovery plan is built from your discharge letter. Take a photo
          of it, or choose the file, and it will appear here.
        </p>
        <Link
          href="/upload"
          className="mt-6 flex min-h-11 w-fit items-center gap-2.5 rounded-tactile bg-accent px-5 py-3 text-base font-semibold text-white transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
        >
          <IconUpload className="size-4.5" />
          Add your discharge letter
        </Link>
      </div>
    </main>
  );
}
