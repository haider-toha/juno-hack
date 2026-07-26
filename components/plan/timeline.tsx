import type { ReactNode } from "react";

import { DaySection, formatDay } from "@/components/plan/day-section";
import { PlanCard } from "@/components/plan/plan-card";
import { TaskRow } from "@/components/plan/task-row";
import type { Dictionary } from "@/lib/i18n/en";
import type { Locale } from "@/lib/i18n/locales";
import type { LogEntry } from "@/lib/store/log";
import type { TimelineDay, TimelineItem } from "@/lib/timeline/schedule";

// Only the three fields the list renders, with `status` already narrowed to the
// two the page filters for — so the fallback below is exhaustive without a
// switch over five enum members, three of which cannot reach this screen.
export type ChangedMedicine = {
  id: string;
  name: string;
  note: string | null;
  status: "stopped" | "amended";
};

type Props = {
  days: TimelineDay[];
  standing: TimelineItem[];
  changed: ChangedMedicine[];
  today: string;
  patientId: string;
  statuses: ReadonlyMap<string, LogEntry["status"]>;
  redFlags: ReactNode;
  locale: Locale;
  t: Dictionary["plan"];
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
  locale,
  t,
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
  // Split rather than rendered in date order. In date order the screen opened
  // on the day he came home and today was two full cards down — a plan whose
  // first answer to "what do I do now" is a day that has already happened. Now
  // today is the first card, the days ahead follow it, and the days behind it
  // go to the foot of the screen where they are still tickable but no longer in
  // the way.
  const todayCard = nearTerm.find((day) => day.date === today);
  const ahead = nearTerm.filter((day) => day.date > today);
  const behind = nearTerm.filter((day) => day.date < today);
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
              {t.outsideRangeTitle}
            </h2>
            <p className="mt-1 text-base leading-relaxed text-ink-muted">
              {today < first.date
                ? t.outsideRangeBefore.replace(
                    "{date}",
                    formatDay(first.date, locale),
                  )
                : t.outsideRangeAfter}
            </p>
          </PlanCard>
        ) : null}

        {todayCard === undefined ? null : (
          <DaySection
            day={todayCard}
            isToday
            patientId={patientId}
            answerable
            statuses={statuses}
            locale={locale}
            t={t}
          />
        )}

        {ahead.map((day) => (
          <DaySection
            key={day.date}
            day={day}
            isToday={false}
            patientId={patientId}
            answerable={false}
            statuses={statuses}
            locale={locale}
            t={t}
          />
        ))}
      </div>

      {later.length === 0 ? null : (
        <Group title={t.comingUp}>
          <ul className="divide-y divide-rule">
            {later.flatMap((day) =>
              day.items.map((item) => (
                <TaskRow
                  key={`${day.date}:${item.id}`}
                  item={item}
                  status={null}
                  dateLabel={formatDay(day.date, locale)}
                  t={t}
                />
              )),
            )}
          </ul>
        </Group>
      )}

      {standing.length === 0 ? null : (
        <Group title={t.anyTime} blurb={t.anyTimeBlurb}>
          <ul className="divide-y divide-rule">
            {standing.map((item) => (
              <TaskRow key={item.id} item={item} status={null} t={t} />
            ))}
          </ul>
        </Group>
      )}

      {changed.length === 0 ? null : (
        <Group title={t.changed} blurb={t.changedBlurb}>
          <ul className="divide-y divide-rule">
            {changed.map((medication) => (
              <li key={medication.id} className="py-3">
                {/* The ward's own words, so both lines are marked English —
                    and the note itself is quoted, so it also refuses machine
                    translation [Locked D7]. Where the letter gave no note the
                    second line is ours, and it translates. */}
                <p lang="en" className="font-semibold leading-snug text-ink">
                  {medication.name}
                </p>
                {medication.note === null ? (
                  <p className="mt-0.5 text-base leading-relaxed text-ink-muted">
                    {medication.status === "stopped"
                      ? t.changeStoppedNote
                      : t.changeAmendedNote}
                  </p>
                ) : (
                  <p
                    lang="en"
                    translate="no"
                    className="mt-0.5 text-base leading-relaxed text-ink-muted"
                  >
                    {medication.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Group>
      )}
      {behind.length === 0 ? null : (
        // A paragraph, not a heading. Every day below already carries its own
        // h2 with its own date, so a heading here would either sit at the same
        // level as the days it introduces or push them down one and orphan the
        // structure the day cards were deliberately given. This is a visual
        // label for a sighted reader; a screen reader still walks the days.
        <div>
          <p className="px-1 text-base leading-relaxed text-ink-muted">
            {t.earlierDays}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {behind.map((day) => (
              <DaySection
                key={day.date}
                day={day}
                isToday={false}
                patientId={patientId}
                answerable
                statuses={statuses}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </div>
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
