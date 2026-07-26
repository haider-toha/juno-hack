import Link from "next/link";

import { IconChevron } from "@/components/icons";
import type { Locale } from "@/lib/i18n/locales";

type Props = {
  datesWithItems: readonly string[];
  today: string;
  selectedDate: string;
  locale: Locale;
  selectDayLabel: string;
  todayLabel: string;
};

export function PlanCalendarView({
  datesWithItems,
  today,
  selectedDate,
  locale,
  selectDayLabel,
  todayLabel,
}: Props) {
  const daysWithItems = new Set(datesWithItems);
  const selectedParts = parseIsoDate(selectedDate);
  const viewing = new Date(
    Date.UTC(selectedParts.year, selectedParts.month, 1),
  );
  const monthLabel = MONTH_FORMATS[locale].format(viewing);
  const year = viewing.getUTCFullYear();
  const month = viewing.getUTCMonth();
  const cells = buildMonthCells(year, month);
  const previousMonth = shiftIsoMonth(selectedDate, -1);
  const nextMonth = shiftIsoMonth(selectedDate, 1);

  return (
    <section aria-label={selectDayLabel}>
      <div className="flex items-center justify-between gap-3">
        <Link
          href={calendarHref(previousMonth)}
          prefetch={false}
          aria-label={PREV_MONTH[locale]}
          className="flex size-11 items-center justify-center rounded-tactile text-ink-muted transition-opacity duration-150 ease-out hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
        >
          <IconChevron className="size-5 -scale-x-100" />
        </Link>
        <h2
          aria-live="polite"
          className="font-display text-lg font-semibold tracking-tight text-ink"
        >
          {monthLabel}
        </h2>
        <Link
          href={calendarHref(nextMonth)}
          prefetch={false}
          aria-label={NEXT_MONTH[locale]}
          className="flex size-11 items-center justify-center rounded-tactile text-ink-muted transition-opacity duration-150 ease-out hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
        >
          <IconChevron className="size-5" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEKDAY_FORMATS[locale].map((label) => (
          <div
            key={label}
            className="tnum pb-1 text-center text-sm font-medium text-ink-muted"
          >
            {label}
          </div>
        ))}

        {cells.map((cell, index) =>
          cell === null ? (
            <div key={cellKey(year, month, "pad", index)} aria-hidden />
          ) : (
            <DayCell
              key={cell}
              date={cell}
              inPlan={daysWithItems.has(cell)}
              isToday={cell === today}
              isSelected={cell === selectedDate}
              locale={locale}
              todayLabel={todayLabel}
            />
          ),
        )}
      </div>
    </section>
  );
}

function DayCell({
  date,
  inPlan,
  isToday,
  isSelected,
  locale,
  todayLabel,
}: {
  date: string;
  inPlan: boolean;
  isToday: boolean;
  isSelected: boolean;
  locale: Locale;
  todayLabel: string;
}) {
  const dayNumber = parseIsoDate(date).day;
  const formatted = DAY_FORMATS[locale].format(new Date(`${date}T00:00:00Z`));

  return (
    <Link
      href={calendarHref(date)}
      prefetch={false}
      aria-current={isSelected ? "page" : undefined}
      data-selected={isSelected ? "true" : undefined}
      aria-label={isToday ? `${formatted}, ${todayLabel}` : formatted}
      className={`flex min-h-11 flex-col items-center justify-center rounded-tactile transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        isSelected
          ? "bg-lavender text-ink"
          : "bg-surface text-ink hover:bg-mist active:opacity-80"
      }`}
    >
      <span
        className={`tnum text-base ${isToday ? "font-semibold" : "font-medium"}`}
      >
        {dayNumber}
      </span>
      {inPlan ? (
        <span
          aria-hidden
          className={`mt-0.5 size-1.5 rounded-pill ${isSelected ? "bg-ink" : "bg-accent"}`}
        />
      ) : (
        <span aria-hidden className="mt-0.5 size-1.5" />
      )}
    </Link>
  );
}

function calendarHref(date: string): string {
  return `/plan?view=calendar&date=${date}`;
}

function shiftIsoMonth(date: string, delta: number): string {
  const { year, month, day } = parseIsoDate(date);
  const target = new Date(Date.UTC(year, month + delta, 1));
  const daysInTarget = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(day, daysInTarget);

  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

function buildMonthCells(year: number, month: number): (string | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const startPad = (firstWeekday + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (string | null)[] = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(date);
  }
  return cells;
}

function parseIsoDate(date: string): {
  year: number;
  month: number;
  day: number;
} {
  const [yearRaw, monthRaw, dayRaw] = date.split("-");
  return {
    year: Number(yearRaw),
    month: Number(monthRaw) - 1,
    day: Number(dayRaw),
  };
}

function cellKey(
  year: number,
  month: number,
  kind: string,
  index: number,
): string {
  return `${year}-${month}-${kind}-${index}`;
}

const MONTH_FORMATS = {
  en: new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }),
  fr: new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }),
} satisfies Record<Locale, Intl.DateTimeFormat>;

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

const WEEKDAY_FORMATS = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  fr: ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."],
} satisfies Record<Locale, readonly string[]>;

const PREV_MONTH = {
  en: "Previous month",
  fr: "Mois précédent",
} satisfies Record<Locale, string>;

const NEXT_MONTH = {
  en: "Next month",
  fr: "Mois suivant",
} satisfies Record<Locale, string>;
