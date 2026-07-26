import { PlanCard } from "@/components/plan/plan-card";
import { TaskCheck } from "@/components/plan/task-check";
import { TaskRow } from "@/components/plan/task-row";
import type { Dictionary } from "@/lib/i18n/en";
import type { Locale } from "@/lib/i18n/locales";
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
  locale: Locale;
  t: Dictionary["plan"];
};

export function DaySection({
  day,
  isToday,
  patientId,
  answerable,
  statuses,
  locale,
  t,
}: Props) {
  const counted = dayLabel(day.dayNumber, t);
  const meta = isToday
    ? counted === null
      ? formatDay(day.date, locale)
      : `${formatDay(day.date, locale)} · ${counted}`
    : counted;

  return (
    <PlanCard today={isToday} labelledBy={`day-${day.date}`}>
      {/* h2, not h3: a day is a top-level section of the timeline, level with
          "Follow-ups" and "Changed in hospital". As an h3 it read as a
          subsection of the red-flag card above it, and skipped a level entirely
          on a plan with no red flags. */}
      <h2
        id={`day-${day.date}`}
        className="flex flex-wrap items-baseline gap-x-2"
      >
        {/* Today is a size larger than every other day heading on the screen.
            It is the one card a patient has to act on, and lavender alone was
            carrying that whole distinction. */}
        <span
          className={`font-display font-semibold tracking-tight text-ink ${isToday ? "text-2xl" : "text-lg"}`}
        >
          {isToday ? t.today : formatDay(day.date, locale)}
        </span>
        {meta === null ? null : (
          <span className="tnum text-base text-ink-muted">{meta}</span>
        )}
      </h2>

      {/* The circles were the only thing on the screen saying a row could be
          answered, and an empty ring is not self-explanatory to someone who has
          never used the app. Said once, on the card it applies to. */}
      {isToday && answerable ? (
        <p className="mt-1 text-base leading-relaxed text-ink-muted">
          {t.tapHint}
        </p>
      ) : null}

      {/* Gap, not hairline rules — dividers made a short checklist read like a
          dense settings table. Spacing alone is enough between tappable rows. */}
      <ul className="mt-2 flex flex-col gap-1">
        {day.items.map((item) => {
          // A day that cannot be answered for cannot show an answer. The log
          // outlives the clock — the operator panel can move `today` backwards,
          // and an entry written while a date was the present stays on the
          // record after it becomes the future. Rendering it put a red "Missed"
          // on tomorrow's apixaban, which is not a fact about tomorrow.
          const status = answerable
            ? (statuses.get(`${day.date}:${item.id}`) ?? null)
            : null;
          return (
            <TaskRow
              key={item.id}
              item={item}
              status={status}
              t={t}
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
                    label={`${answerLabel(item)}, ${isToday ? t.todayLower : formatDay(day.date, locale)}`}
                    status={status}
                    t={t.tick}
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

// The letter's own words, so this half of the tick's name stays English
// whatever the screen is written in.
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
function dayLabel(
  dayNumber: number | null,
  t: Dictionary["plan"],
): string | null {
  if (dayNumber === null) return null;
  return dayNumber === 0
    ? t.dischargeDay
    : t.dayNumber.replace("{n}", String(dayNumber));
}

// One formatter per locale, built once. `en-GB` gives "Saturday 25 July" and
// `fr-FR` "samedi 25 juillet" — the weekday and the month are the reader's,
// even though everything the letter itself says stays English.
const DAY_FORMATS = {
  en: new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }),
  fr: new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }),
} satisfies Record<Locale, Intl.DateTimeFormat>;

export function formatDay(date: string, locale: Locale): string {
  return DAY_FORMATS[locale].format(new Date(`${date}T00:00:00Z`));
}
