import type { ReactNode } from "react";

import { DaySection, formatDay } from "@/components/plan/day-section";
import { PlanCard } from "@/components/plan/plan-card";
import { TaskRow } from "@/components/plan/task-row";
import type { Medication } from "@/lib/plan/schema";
import type { LogEntry } from "@/lib/store/log";
import type { TimelineDay, TimelineItem } from "@/lib/timeline/schedule";

type Props = {
  days: TimelineDay[];
  standing: TimelineItem[];
  changed: Medication[];
  today: string;
  patientId: string;
  statuses: ReadonlyMap<string, LogEntry["status"]>;
  redFlags: ReactNode;
};

// Two days back, so a dose logged as missed is still on screen next to the day
// it was missed on, and four forward. Beyond that the only thing worth showing
// is what actually changes — an appointment, a check, a course ending — not
// another copy of the same repeat prescription.
const LOOKBACK_DAYS = 2;
const FORWARD_DAYS = 4;

export function Timeline({
  days,
  standing,
  changed,
  today,
  patientId,
  statuses,
  redFlags,
}: Props) {
  const todayIndex = days.findIndex((day) => day.date === today);
  // `today` is not one of the plan's days: the letter's first day has not
  // arrived yet, or its last one is behind us. Nothing can be marked "Today"
  // and no row can be ticked, so the screen says which of the two it is rather
  // than showing the opening days as if they were the near term.
  const outsideRange = todayIndex === -1;
  const first = days[0];
  const start = outsideRange ? 0 : Math.max(todayIndex - LOOKBACK_DAYS, 0);
  const end = (outsideRange ? 0 : todayIndex) + FORWARD_DAYS + 1;
  const nearTerm = days.slice(start, end);
  const later = days
    .slice(end)
    .map((day) => ({
      ...day,
      items: day.items.filter((item) => item.kind !== "medication"),
    }))
    .filter((day) => day.items.length > 0);

  return (
    <div className="flex flex-col gap-8 pb-10">
      {redFlags}

      <div className="flex flex-col gap-3">
        {outsideRange && first !== undefined ? (
          <PlanCard>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
              Today is not on this plan
            </h2>
            <p className="mt-1 text-base leading-relaxed text-ink-muted">
              {today < first.date
                ? `It begins on ${formatDay(first.date)}, so nothing on it can be ticked yet. Below is how it starts.`
                : "Its last day has passed, so nothing on it can be ticked. Below is how it started."}
            </p>
          </PlanCard>
        ) : null}

        {nearTerm.map((day) => (
          <DaySection
            key={day.date}
            day={day}
            isToday={day.date === today}
            patientId={patientId}
            answerable={day.date <= today}
            statuses={statuses}
          />
        ))}
      </div>

      {later.length === 0 ? null : (
        <Group title="Coming up">
          <ul className="divide-y divide-rule">
            {later.flatMap((day) =>
              day.items.map((item) => (
                <TaskRow
                  key={`${day.date}:${item.id}`}
                  item={item}
                  status={null}
                  dateLabel={formatDay(day.date)}
                />
              )),
            )}
          </ul>
        </Group>
      )}

      {standing.length === 0 ? null : (
        <Group
          title="Any time"
          blurb="These run alongside the rest of the plan."
        >
          <ul className="divide-y divide-rule">
            {standing.map((item) => (
              <TaskRow key={item.id} item={item} status={null} />
            ))}
          </ul>
        </Group>
      )}

      {changed.length === 0 ? null : (
        <Group
          title="Changed in hospital"
          blurb="What the ward altered about your usual medicines, in their words."
        >
          <ul className="divide-y divide-rule">
            {changed.map((medication) => (
              <li key={medication.id} className="py-3">
                <p className="font-semibold leading-snug text-ink">
                  {medication.nameAsWritten}
                </p>
                <p className="mt-0.5 text-base leading-relaxed text-ink-muted">
                  {medication.changeNoteVerbatim ?? medication.changeStatus}
                </p>
              </li>
            ))}
          </ul>
        </Group>
      )}
    </div>
  );
}

function Group({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: ReactNode;
}) {
  return (
    <PlanCard>
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {blurb === undefined ? null : (
        <p className="mt-1 text-base leading-relaxed text-ink-muted">{blurb}</p>
      )}
      <div className="mt-1">{children}</div>
    </PlanCard>
  );
}
