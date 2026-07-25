import { PlanCard } from "@/components/plan/plan-card";
import { TaskCheck } from "@/components/plan/task-check";
import { TaskRow } from "@/components/plan/task-row";
import type { LogEntry } from "@/lib/store/log";
import type { TimelineDay, TimelineItem } from "@/lib/timeline/schedule";

type Props = {
  day: TimelineDay;
  isToday: boolean;
  patientId: string;
  // A day in the future has nothing to answer about yet, so its rows are not
  // tickable.
  answerable: boolean;
  // Keyed `${date}:${itemId}` so a day only ever picks up its own answers.
  statuses: ReadonlyMap<string, LogEntry["status"]>;
};

export function DaySection({
  day,
  isToday,
  patientId,
  answerable,
  statuses,
}: Props) {
  const counted = dayLabel(day.dayNumber);
  const meta = isToday
    ? counted === null
      ? formatDay(day.date)
      : `${formatDay(day.date)} · ${counted}`
    : counted;

  return (
    <PlanCard today={isToday} labelledBy={`day-${day.date}`}>
      {/* h2, not h3: a day is a top-level section of the timeline, level with
          "Coming up" and "Changed in hospital". As an h3 it read as a subsection
          of the red-flag card above it, and skipped a level entirely on a plan
          with no red flags. */}
      <h2
        id={`day-${day.date}`}
        className="flex flex-wrap items-baseline gap-x-2"
      >
        <span className="font-display text-lg font-semibold tracking-tight text-ink">
          {isToday ? "Today" : formatDay(day.date)}
        </span>
        {meta === null ? null : (
          <span className="tnum text-base text-ink-muted">{meta}</span>
        )}
      </h2>

      <ul className="mt-1 divide-y divide-rule">
        {day.items.map((item) => {
          const status = statuses.get(`${day.date}:${item.id}`) ?? null;
          return (
            <TaskRow
              key={item.id}
              item={item}
              status={status}
              check={
                answerable && isAnswerable(item) ? (
                  <TaskCheck
                    patientId={patientId}
                    itemId={item.id}
                    day={day.date}
                    // The day belongs in the tick's name: the same medicine
                    // repeats on every card, so without it three days of ticks
                    // announce identically and a screen reader user cannot tell
                    // which day they are answering for.
                    label={`${answerLabel(item)}, ${isToday ? "today" : formatDay(day.date)}`}
                    status={status}
                  />
                ) : undefined
              }
            />
          );
        })}
      </ul>
    </PlanCard>
  );
}

// Only things the patient does. An appointment is not a dose, and an
// instruction addressed to the GP is not his to tick.
function isAnswerable(item: TimelineItem): boolean {
  switch (item.kind) {
    case "medication":
      return true;
    case "instruction":
      return item.instruction.actor === "patient";
    case "appointment":
      return false;
  }
}

function answerLabel(item: TimelineItem): string {
  switch (item.kind) {
    case "medication":
      return item.medication.nameAsWritten;
    case "instruction":
      return item.instruction.titlePlain ?? item.instruction.detailVerbatim;
    case "appointment":
      return item.appointment.withVerbatim;
  }
}

// The letter counts from the day he came home ("2 days", "in 1 week"), so the
// plan counts the same way — and says nothing at all where the letter gave no
// discharge date to count from.
function dayLabel(dayNumber: number | null): string | null {
  if (dayNumber === null) return null;
  return dayNumber === 0 ? "Discharge day" : `Day ${dayNumber}`;
}

const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function formatDay(date: string): string {
  return DAY_FORMAT.format(new Date(`${date}T00:00:00Z`));
}
