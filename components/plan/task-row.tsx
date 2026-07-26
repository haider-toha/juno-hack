import type { ReactNode } from "react";

import { IconAlert, IconCheck } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n/en";
import type { LogEntry } from "@/lib/store/log";
import type { TimelineItem } from "@/lib/timeline/schedule";

type Strings = Dictionary["plan"];

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
  t: Strings;
};

// One line of the plan. Everything on it is either the letter's own words or a
// rendering of a structured field — nothing here is inferred. Where the letter
// did not say (no indication, no time of day), the row simply stays quiet
// rather than filling the gap.
//
// The letter is an English document and the bundle carries no French for
// anything but the red flags, so the three lines that come off it are marked
// `lang="en"` — under `<html lang="fr">` an unmarked English sentence is read
// out with French phonemes, which is the WCAG 3.1.2 half of the same defect the
// dictionary fixes. The dose directions additionally take `translate="no"`:
// they are the clinician's exact instruction, and a browser rewriting one
// behind the patient's back is a safety defect, not a feature [Locked D7].
export function TaskRow({ item, status, dateLabel, check, t }: Props) {
  const detail = describe(item, t);

  return (
    <li className="flex min-h-11 items-start gap-3 py-3">
      {/* A mark only where there is something to mark. A row with no tick and
          no answer gets nothing: an empty ring on an appointment or on
          "Coming up" looks like a control that does not work. */}
      {check ?? (status === null ? null : <StatusMark status={status} t={t} />)}
      <div className="min-w-0 flex-1">
        {dateLabel === undefined ? null : (
          <p className="tnum text-base text-ink-muted">{dateLabel}</p>
        )}
        {/* No size class: this is the app's 17px body baseline, and the
            medicine name is the string on this screen most often read at
            arm's length. */}
        <p lang="en" className="font-semibold leading-snug text-ink">
          {detail.title}
        </p>
        <p
          lang="en"
          translate="no"
          className="mt-0.5 text-base leading-relaxed text-ink-muted"
        >
          {detail.line}
        </p>
        {detail.purpose === null ? null : (
          <p
            lang="en"
            className="mt-1 text-base leading-relaxed text-ink-muted"
          >
            {detail.purpose}
          </p>
        )}
      </div>
      {/* A red triangle and nothing else asks the reader to know what red means
          here. The word is on a white chip with a red edge rather than in red
          text: `error` measures 4.31:1 on lavender and 4.46:1 on mist, both
          under AA, and today's card is lavender. */}
      {status === "missed" ? (
        <span className="mt-0.5 shrink-0 rounded-tactile border border-error bg-surface px-2 py-1 text-sm font-medium text-ink">
          {t.missed}
        </span>
      ) : detail.tag === null ? null : (
        // Capped and shrinkable, unlike the status chip beside it. "For your
        // GP" is 11 characters and "Pour votre médecin traitant" is 27: with
        // `shrink-0` the French chip took 60% of the row and wrapped the
        // instruction's title into seven two-word lines. The cap costs the
        // English render nothing — it is nowhere near 45% — and keeps the title
        // the widest thing on the row in both languages.
        <span className="mt-0.5 max-w-[45%] rounded-tactile bg-mist px-2 py-1 text-sm font-medium text-ink-muted">
          {detail.tag}
        </span>
      )}
    </li>
  );
}

function StatusMark({ status, t }: { status: LogEntry["status"]; t: Strings }) {
  switch (status) {
    case "taken":
      return (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-pill bg-success text-ink-invert">
          <IconCheck className="size-4" />
          <span className="sr-only">{t.markedTaken}</span>
        </span>
      );
    case "missed":
      return (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-pill text-error">
          <IconAlert className="size-5" />
          <span className="sr-only">{t.markedMissed}</span>
        </span>
      );
  }
}

type Described = {
  title: string;
  line: string;
  purpose: string | null;
  tag: string | null;
};

function describe(item: TimelineItem, t: Strings): Described {
  switch (item.kind) {
    case "medication": {
      const { medication } = item;
      return {
        title: medication.nameAsWritten,
        line: medication.doseDirectionsVerbatim,
        purpose: medication.purposePlain,
        // No frequency chip: the directions beside it already say "BD", and
        // the same fact twice, once as chrome, is not hierarchy.
        tag: null,
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
        tag: instruction.actor === "patient" ? null : t.forGp,
      };
    }
    case "appointment": {
      const { appointment } = item;
      return {
        title: appointment.withVerbatim,
        line: appointment.when.verbatim,
        purpose: null,
        tag: appointment.isBooked ? t.booked : t.notBooked,
      };
    }
  }
}
