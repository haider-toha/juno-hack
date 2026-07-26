import Link from "next/link";

import { BackButton } from "@/components/back-button";
import { primaryButton, secondaryButton } from "@/components/button-styles";
import { IconAlert, IconCheck } from "@/components/icons";
import { formatLocalTime } from "@/lib/format-time";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";
import { getDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { readLog, type LogEntry } from "@/lib/store/log";
import { readPlan } from "@/lib/store/plan";
import { readReminders, type Reminder } from "@/lib/store/reminder";
import {
  dueToday,
  standingItems,
  type TimelineItem,
} from "@/lib/timeline/schedule";

type RowStatus = LogEntry["status"] | "scheduled" | null;

type SummaryRow = {
  item: TimelineItem;
  status: RowStatus;
  reminder: Reminder | null;
};

export async function generateMetadata() {
  const t = getDictionary(await getLocale());
  return { title: t.checkInSummary.metaTitle };
}

export const dynamic = "force-dynamic";

// Post-check-in recap: what was noted for today, from the same Redis log the
// voice tools write. Force-dynamic so a just-finished call never shows a
// stale empty card.
export default async function CheckInSummaryPage() {
  const [locale, today, bundle] = await Promise.all([
    getLocale(),
    getDemoToday(),
    readPlan(DEMO_PATIENT_ID),
  ]);
  const t = getDictionary(locale);

  const [todayLogs, reminders] = await Promise.all([
    bundle === null ? Promise.resolve([]) : readLog(DEMO_PATIENT_ID, [today]),
    readReminders(DEMO_PATIENT_ID, today),
  ]);
  const statusById = new Map(
    todayLogs.map((entry) => [entry.itemId, entry.status] as const),
  );
  const reminderById = new Map(
    reminders.map((entry) => [entry.itemId, entry] as const),
  );

  const due = bundle === null ? [] : dueToday(bundle, today);
  const standing = bundle === null ? [] : standingItems(bundle);
  const byId = new Map(
    [...due, ...standing].map((item) => [item.id, item] as const),
  );

  // Notes first (whatever the tools wrote today), then today's due steps that
  // were never covered — not the whole standing catalogue. A scheduled nudge
  // counts as covered for the row (chip changes), but stays in the list.
  const noted: SummaryRow[] = todayLogs.flatMap((entry) => {
    const item = byId.get(entry.itemId);
    if (item === undefined) return [];
    return [
      {
        item,
        status: entry.status,
        reminder: reminderById.get(entry.itemId) ?? null,
      },
    ];
  });
  const open: SummaryRow[] = due
    .filter((item) => !statusById.has(item.id))
    .map((item) => {
      const reminder = reminderById.get(item.id) ?? null;
      return {
        item,
        status: reminder !== null ? ("scheduled" as const) : null,
        reminder,
      };
    });
  const rows = [...noted, ...open];

  const firstNudge = reminders[0] ?? null;

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="shrink-0 px-5 pt-3">
        <BackButton href="/" label={t.common.back} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
          {t.checkInSummary.title}
        </h1>
        <p className="mt-2 max-w-[36ch] text-base leading-relaxed text-ink-muted">
          {t.checkInSummary.blurb}
        </p>

        <section className="mt-5 rounded-card border border-rule bg-surface p-5 shadow-card">
          {bundle === null || rows.length === 0 ? (
            <p className="text-base text-ink-muted">{t.checkInSummary.empty}</p>
          ) : (
            <ul className="divide-y divide-rule">
              {rows.map(({ item, status, reminder }) => (
                <li
                  key={item.id}
                  className="flex min-h-11 items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <StatusMark status={status} t={t.checkInSummary} />
                  <div className="min-w-0 flex-1">
                    <p
                      lang="en"
                      className="font-semibold leading-snug text-ink"
                    >
                      {itemTitle(item)}
                    </p>
                    <p
                      lang="en"
                      translate="no"
                      className="mt-0.5 text-base leading-relaxed text-ink-muted"
                    >
                      {itemLine(item)}
                    </p>
                  </div>
                  <StatusChip
                    status={status}
                    timeLabel={
                      reminder === null
                        ? null
                        : formatLocalTime(reminder.timeLocal, locale)
                    }
                    t={t.checkInSummary}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {firstNudge !== null ? (
          <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-ink">
            {t.checkInSummary.nudgeBlurb
              .replace(
                "{time}",
                formatLocalTime(firstNudge.timeLocal, locale),
              )
              .replace("{name}", firstNudge.nameAsWritten)}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          <Link href="/plan" className={`${primaryButton} w-full`}>
            {t.checkInSummary.seePlan}
          </Link>
          <Link
            href="/"
            className={`${secondaryButton} w-full justify-center text-ink-muted`}
          >
            {t.checkInSummary.done}
          </Link>
        </div>
      </div>
    </main>
  );
}

function itemTitle(item: TimelineItem): string {
  switch (item.kind) {
    case "medication":
      return item.medication.nameAsWritten;
    case "instruction":
      return item.instruction.titlePlain ?? item.instruction.detailVerbatim;
    case "appointment":
      return item.appointment.withVerbatim;
    default: {
      const _exhaustive: never = item;
      return _exhaustive;
    }
  }
}

function itemLine(item: TimelineItem): string {
  switch (item.kind) {
    case "medication":
      return item.medication.doseDirectionsVerbatim;
    case "instruction":
      return item.instruction.detailVerbatim;
    case "appointment":
      return item.appointment.when.verbatim;
    default: {
      const _exhaustive: never = item;
      return _exhaustive;
    }
  }
}

function StatusMark({
  status,
  t,
}: {
  status: RowStatus;
  t: {
    markedTaken: string;
    markedMissed: string;
    unanswered: string;
    markedScheduled: string;
  };
}) {
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
    case "scheduled":
      return (
        <span className="mt-0.5 size-7 shrink-0 rounded-pill border-2 border-accent bg-lavender">
          <span className="sr-only">{t.markedScheduled}</span>
        </span>
      );
    case null:
      return (
        <span
          aria-hidden
          className="mt-0.5 size-7 shrink-0 rounded-pill border border-rule"
        />
      );
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function StatusChip({
  status,
  timeLabel,
  t,
}: {
  status: RowStatus;
  timeLabel: string | null;
  t: {
    taken: string;
    missed: string;
    unanswered: string;
    scheduled: string;
  };
}) {
  switch (status) {
    case "taken":
      return (
        <span className="mt-0.5 shrink-0 rounded-tactile bg-mist px-2 py-1 text-sm font-medium text-ink">
          {t.taken}
        </span>
      );
    case "missed":
      return (
        <span className="mt-0.5 shrink-0 rounded-tactile border border-error bg-surface px-2 py-1 text-sm font-medium text-ink">
          {t.missed}
        </span>
      );
    case "scheduled":
      return (
        <span className="mt-0.5 shrink-0 rounded-tactile bg-lavender px-2 py-1 text-sm font-medium text-ink">
          {t.scheduled.replace("{time}", timeLabel ?? "")}
        </span>
      );
    case null:
      return (
        <span className="mt-0.5 shrink-0 rounded-tactile bg-mist px-2 py-1 text-sm font-medium text-ink-muted">
          {t.unanswered}
        </span>
      );
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
