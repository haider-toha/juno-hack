import Link from "next/link";

import { BackButton } from "@/components/back-button";
import { primaryButton, secondaryButton } from "@/components/button-styles";
import { IconAlert, IconCheck } from "@/components/icons";
import { assess, assessmentWindow } from "@/lib/escalation/rules";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";
import { getDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { readLog, type LogEntry } from "@/lib/store/log";
import { readPlan } from "@/lib/store/plan";
import {
  dueToday,
  standingItems,
  type TimelineItem,
} from "@/lib/timeline/schedule";

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

  // Windowed read so assess() and today's notes share one Redis round-trip.
  const logs =
    bundle === null
      ? []
      : await readLog(DEMO_PATIENT_ID, assessmentWindow(today));
  const todayLogs = logs.filter((entry) => entry.day === today);
  const statusById = new Map(
    todayLogs.map((entry) => [entry.itemId, entry.status] as const),
  );

  const due = bundle === null ? [] : dueToday(bundle, today);
  const standing = bundle === null ? [] : standingItems(bundle);
  const byId = new Map(
    [...due, ...standing].map((item) => [item.id, item] as const),
  );

  // Notes first (whatever the tools wrote today), then today's due steps that
  // were never covered — not the whole standing catalogue.
  const noted = todayLogs.flatMap((entry) => {
    const item = byId.get(entry.itemId);
    return item === undefined ? [] : [{ item, status: entry.status }];
  });
  const open = due
    .filter((item) => !statusById.has(item.id))
    .map((item) => ({ item, status: null as LogEntry["status"] | null }));
  const rows = [...noted, ...open];

  const assessment =
    bundle === null ? { kind: "none" as const } : assess(bundle, logs, today);
  const showFamily = assessment.kind !== "none";

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
              {rows.map(({ item, status }) => (
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
                  <StatusChip status={status} t={t.checkInSummary} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-6 flex flex-col gap-2">
          <Link href="/plan" className={`${primaryButton} w-full`}>
            {t.checkInSummary.seePlan}
          </Link>
          {showFamily ? (
            <Link
              href="/family"
              className={`${secondaryButton} w-full justify-center`}
            >
              {t.checkInSummary.seeFamily}
            </Link>
          ) : null}
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
  status: LogEntry["status"] | null;
  t: { markedTaken: string; markedMissed: string; unanswered: string };
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
  t,
}: {
  status: LogEntry["status"] | null;
  t: { taken: string; missed: string; unanswered: string };
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
