import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { BackButton } from "@/components/back-button";
import { primaryButton } from "@/components/button-styles";
import { RefreshPoller } from "@/components/family/refresh-poller";
import { IconUpload } from "@/components/icons";
import { PlanCalendarView } from "@/components/plan/plan-calendar-view";
import { DaySection, formatDay } from "@/components/plan/day-section";
import { PlanCard } from "@/components/plan/plan-card";
import { RedFlagCard } from "@/components/plan/red-flag-card";
import { Timeline } from "@/components/plan/timeline";
import { PlanViewToggle } from "@/components/plan/plan-view-toggle";
import { lookupDrug } from "@/lib/drugs/lookup";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";
import type { Dictionary } from "@/lib/i18n/en";
import { getDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { readLog } from "@/lib/store/log";
import { readPlan } from "@/lib/store/plan";
import { addDays, buildTimeline, standingItems } from "@/lib/timeline/schedule";

export async function generateMetadata() {
  const t = getDictionary(await getLocale());
  return { title: t.plan.metaTitle };
}

// Redis-backed and patient-specific: prerendering it would bake one moment of
// one patient's plan into the build.
export const dynamic = "force-dynamic";

// The days the list view can show an answer for — two back, four forward,
// matching the window `<Timeline>` renders.
const LOG_WINDOW = [-2, -1, 0, 1, 2, 3, 4];

const PlanView = z.enum(["list", "calendar"]);
const PlanDate = z.iso.date();

type View = z.infer<typeof PlanView>;

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const rawView = singular(raw.view);
  const parsedView = PlanView.safeParse(rawView);
  const view: View = parsedView.success ? parsedView.data : "list";

  const [locale, today, bundle] = await Promise.all([
    getLocale(),
    getDemoToday(),
    readPlan(DEMO_PATIENT_ID),
  ]);
  const t = getDictionary(locale);

  const rawDate = singular(raw.date);
  const parsedDate = PlanDate.safeParse(rawDate);
  const selectedDate =
    view === "calendar" && parsedDate.success ? parsedDate.data : today;

  if (view === "calendar") {
    if (
      rawView !== "calendar" ||
      rawDate !== selectedDate ||
      Array.isArray(raw.view) ||
      Array.isArray(raw.date)
    ) {
      redirect(`/plan?view=calendar&date=${selectedDate}`);
    }
  } else if (raw.view !== undefined || raw.date !== undefined) {
    redirect("/plan");
  }

  if (bundle === null) return <NoPlanYet t={t} />;

  const days = buildTimeline(bundle, today);

  const logDays =
    view === "calendar"
      ? [selectedDate]
      : LOG_WINDOW.map((offset) => addDays(today, offset));

  const log = await readLog(DEMO_PATIENT_ID, logDays);
  const statuses = new Map(
    log.map((entry) => [`${entry.day}:${entry.itemId}`, entry.status]),
  );

  // `flatMap` rather than `filter` so `status` narrows to the two the list can
  // hold — the row's fallback copy is then exhaustive on those two alone.
  const changed = bundle.medications.flatMap((medication) =>
    medication.changeStatus === "stopped" ||
    medication.changeStatus === "amended"
      ? [
          {
            id: medication.id,
            name: medication.nameAsWritten,
            note: medication.changeNoteVerbatim,
            status: medication.changeStatus,
          },
        ]
      : [],
  );

  // Every red flag's related medicines, looked up at once. Keyed by medication
  // id in a Map rather than collected in a Set: a Set of tuples holds array
  // references and dedupes nothing, so two flags naming the same medicine cost
  // two lookups. The lookup is cache-first, so each one is usually a Redis read
  // rather than a round trip to NHS.uk, and in demo mode it never leaves the
  // process.
  const related = new Map(
    bundle.redFlags.flatMap((flag) =>
      flag.relatedMedicationIds.flatMap((id) => {
        const medication = bundle.medications.find(
          (candidate) => candidate.id === id,
        );
        return medication?.lookupKey === null ||
          medication?.lookupKey === undefined
          ? []
          : [
              [
                id,
                {
                  name: medication.nameAsWritten,
                  normalised: medication.lookupKey.normalisedName,
                },
              ] as const,
            ];
      }),
    ),
  );
  const guidance = new Map(
    await Promise.all(
      [...related].map(
        async ([id, medicine]) =>
          [
            id,
            {
              name: medicine.name,
              guidance: await lookupDrug(medicine.normalised),
            },
          ] as const,
      ),
    ),
  );

  const redFlags = (
    <div className="flex flex-col gap-3">
      {bundle.redFlags.map((flag) => (
        <RedFlagCard
          key={flag.id}
          flag={flag}
          contacts={bundle.contacts}
          document={bundle.documents.find(
            (candidate) => candidate.id === flag.source.documentId,
          )}
          patientId={DEMO_PATIENT_ID}
          medicines={flag.relatedMedicationIds.flatMap((id) => {
            const medicine = guidance.get(id);
            return medicine === undefined ? [] : [medicine];
          })}
          // The read locale, so a French session gets the dual EN+FR
          // render the D7 decision requires.
          locale={locale}
          t={t.redFlag}
          nhs={t.nhs}
        />
      ))}
    </div>
  );

  const selectedDay = days.find((day) => day.date === selectedDate);

  // Canvas colour also lives on the phone scrollport (`layout.tsx`): this
  // <main> alone cannot paint past its flex height when the timeline is tall.
  return (
    <main className="flex min-h-0 flex-1 flex-col bg-mist px-6">
      {/* Same beat as /family: a voice check-in on another tab writes ticks
          the open plan must notice without a manual reload. */}
      <RefreshPoller />
      <div className="-ml-2.5 shrink-0 pt-2">
        <BackButton href="/" label={t.common.back} />
      </div>

      {/* Title + one orientation line. The episode blurb used to sit here too —
          a second paragraph before the first thing to do — and it pushed the
          red flag and today's ticks down for a sentence most people skip. */}
      <header className="shrink-0 pt-2 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              {t.plan.title}
            </h1>
            {bundle.episode.dischargeDate === null ? null : (
              <p className="mt-2 text-base text-ink-muted">
                {t.plan.homeSince.replace(
                  "{date}",
                  formatDay(bundle.episode.dischargeDate, locale),
                )}
              </p>
            )}
          </div>
          <PlanViewToggle
            view={view}
            selectedDate={selectedDate}
            viewLabel={t.plan.viewLabel}
            listLabel={t.plan.viewList}
            calendarLabel={t.plan.viewCalendar}
          />
        </div>
      </header>

      {view === "list" ? (
        <Timeline
          days={days}
          standing={standingItems(bundle)}
          changed={changed}
          today={today}
          patientId={DEMO_PATIENT_ID}
          statuses={statuses}
          locale={locale}
          t={t.plan}
          redFlags={redFlags}
        />
      ) : (
        <div className="flex flex-col gap-8 pb-10">
          {redFlags}

          <PlanCalendarView
            datesWithItems={days.flatMap((day) =>
              day.items.length > 0 ? [day.date] : [],
            )}
            today={today}
            selectedDate={selectedDate}
            locale={locale}
            selectDayLabel={t.plan.selectDay}
            todayLabel={t.plan.today}
          />

          {selectedDay !== undefined && selectedDay.items.length > 0 ? (
            <DaySection
              day={selectedDay}
              isToday={selectedDate === today}
              patientId={DEMO_PATIENT_ID}
              answerable={selectedDate <= today}
              statuses={statuses}
              locale={locale}
              t={t.plan}
            />
          ) : (
            <PlanCard>
              <p className="text-base leading-relaxed text-ink-muted">
                {t.plan.noItemsOnDay}
              </p>
            </PlanCard>
          )}
        </div>
      )}
    </main>
  );
}

function singular(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function NoPlanYet({ t }: { t: Dictionary }) {
  return (
    // `mist`, like the skeleton and the loaded plan: the empty state is the
    // third thing this route can render, and it must not flash the page from
    // grey to white on its way to being one of the other two.
    <main className="flex min-h-0 flex-1 flex-col bg-mist px-6">
      <div className="-ml-2.5 shrink-0 pt-2">
        <BackButton href="/" label={t.common.back} />
      </div>
      <div className="flex flex-1 flex-col justify-center pb-16">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {t.plan.emptyTitle}
        </h1>
        <p className="mt-3 leading-relaxed text-ink-muted">
          {t.plan.emptyBody}
        </p>
        {/* Same words as the home upload control — the letter lives on `/`. */}
        <Link href="/" className={`${primaryButton} mt-6 w-fit`}>
          <IconUpload className="size-5" />
          {t.home.letterTitle}
        </Link>
      </div>
    </main>
  );
}
