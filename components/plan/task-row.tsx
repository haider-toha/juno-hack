import type { ReactNode } from "react";

import { IconAlert, IconCheck } from "@/components/icons";
import type { Medication } from "@/lib/plan/schema";
import type { LogEntry } from "@/lib/store/log";
import type { TimelineItem } from "@/lib/timeline/schedule";

type Props = {
  item: TimelineItem;
  status: LogEntry["status"] | null;
  // Set when the row appears outside a day section and has to carry its own
  // date — the "coming up" list, weeks after the day-by-day view ends.
  dateLabel?: string;
  // The interactive tick, passed in rather than built here so the client
  // boundary stays at the leaf and this row stays a server component. Absent on
  // rows there is nothing to answer about yet: a future day, an appointment.
  check?: ReactNode;
};

// One line of the plan. Everything on it is either the letter's own words or a
// rendering of a structured field — nothing here is inferred. Where the letter
// did not say (no indication, no time of day), the row simply stays quiet
// rather than filling the gap.
export function TaskRow({ item, status, dateLabel, check }: Props) {
  const detail = describe(item);

  return (
    <li className="flex min-h-11 items-start gap-3 py-3">
      {check ?? <StatusMark status={status} />}
      <div className="min-w-0 flex-1">
        {dateLabel === undefined ? null : (
          <p className="tnum text-sm text-ink-muted">{dateLabel}</p>
        )}
        <p className="text-base font-semibold leading-snug text-ink">
          {detail.title}
        </p>
        <p className="mt-0.5 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
          {detail.line}
        </p>
        {detail.purpose === null ? null : (
          <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
            {detail.purpose}
          </p>
        )}
      </div>
      {detail.tag === null ? null : (
        <span className="mt-0.5 shrink-0 rounded-tactile bg-mist px-2 py-1 text-xs font-medium text-ink-muted">
          {detail.tag}
        </span>
      )}
    </li>
  );
}

function StatusMark({ status }: { status: LogEntry["status"] | null }) {
  switch (status) {
    case "taken":
      return (
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-pill bg-success text-white">
          <IconCheck className="size-3.5" />
          <span className="sr-only">Marked as taken</span>
        </span>
      );
    case "missed":
      return (
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-pill text-error">
          <IconAlert className="size-4.5" />
          <span className="sr-only">Marked as missed</span>
        </span>
      );
    case null:
      return (
        <span
          aria-hidden
          className="mt-0.5 size-6 shrink-0 rounded-pill border border-rule"
        />
      );
  }
}

type Described = {
  title: string;
  line: string;
  purpose: string | null;
  tag: string | null;
};

function describe(item: TimelineItem): Described {
  switch (item.kind) {
    case "medication": {
      const { medication } = item;
      return {
        title: medication.nameAsWritten,
        line: medication.doseDirectionsVerbatim,
        purpose: medication.purposePlain,
        tag: frequency(medication.schedule),
      };
    }
    case "instruction": {
      const { instruction } = item;
      return {
        title: instruction.titlePlain ?? instruction.detailVerbatim,
        line: instruction.detailVerbatim,
        purpose: null,
        // Whose job it is changes the question the check-in asks, so it is
        // worth saying on the row too.
        tag: instruction.actor === "patient" ? null : "For your GP",
      };
    }
    case "appointment": {
      const { appointment } = item;
      return {
        title: appointment.withVerbatim,
        line: appointment.when.verbatim,
        purpose: null,
        tag: appointment.isBooked ? "Booked" : "Not booked yet",
      };
    }
  }
}

const PER_DAY = ["", "Once a day", "Twice a day", "Three times a day"];

// Derived from the structured schedule, never from re-reading the frequency
// shorthand. A drug with neither a daily count nor an interval was written
// "PRN" or left blank, and gets no tag at all.
function frequency(schedule: Medication["schedule"]): string | null {
  if (schedule.everyDays === 7) return "Once a week";
  if (schedule.everyDays !== null) return `Every ${schedule.everyDays} days`;
  if (schedule.timesPerDay === null) return null;
  return PER_DAY[schedule.timesPerDay] ?? `${schedule.timesPerDay} times a day`;
}
