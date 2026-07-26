import Link from "next/link";

import { BackButton } from "@/components/back-button";
import { primaryButton } from "@/components/button-styles";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { IconUpload } from "@/components/icons";
import { formatDay } from "@/components/plan/day-section";
import { RedFlagCard } from "@/components/plan/red-flag-card";
import { Timeline } from "@/components/plan/timeline";
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

// The days the screen can show an answer for — two back, four forward, matching
// the window `<Timeline>` renders.
const LOG_WINDOW = [-2, -1, 0, 1, 2, 3, 4];

export default async function PlanPage() {
  const [locale, today, bundle] = await Promise.all([
    getLocale(),
    getDemoToday(),
    readPlan(DEMO_PATIENT_ID),
  ]);
  const t = getDictionary(locale);

  if (bundle === null) return <NoPlanYet t={t} />;

  const log = await readLog(
    DEMO_PATIENT_ID,
    LOG_WINDOW.map((offset) => addDays(today, offset)),
  );
  const statuses = new Map(
    log.map((entry) => [`${entry.day}:${entry.itemId}`, entry.status]),
  );

  const days = buildTimeline(bundle, today);
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

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-mist px-6">
      <div className="-ml-2.5 shrink-0 pt-2">
        <BackButton href="/" label={t.common.back} />
      </div>

      {/* Four lines of preamble used to stand between the title and the first
          thing a patient has to do. The episode and the discharge date are
          orientation and they stay, at body size and tight together; everything
          else about this screen is now below the fold on purpose. */}
      <header className="shrink-0 pt-2 pb-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {t.plan.title}
        </h1>
        {bundle.episode.titlePlain === null ? null : (
          // The letter's own account of the admission, and the bundle carries
          // no French for it — so it is marked English rather than left to be
          // read out with French phonemes under <html lang="fr">.
          <p
            lang="en"
            className="mt-2 text-base leading-relaxed text-ink-muted"
          >
            {bundle.episode.titlePlain}
          </p>
        )}
        {bundle.episode.dischargeDate === null ? null : (
          <p className="mt-1 text-base text-ink-muted">
            {t.plan.homeSince.replace(
              "{date}",
              formatDay(bundle.episode.dischargeDate, locale),
            )}
          </p>
        )}
        <div className="mt-3 empty:mt-0">
          <DemoModeBadge text={t.common.demoMode} />
        </div>
      </header>

      <Timeline
        days={days}
        standing={standingItems(bundle)}
        changed={changed}
        today={today}
        patientId={DEMO_PATIENT_ID}
        statuses={statuses}
        locale={locale}
        t={t.plan}
        redFlags={
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
        }
      />
    </main>
  );
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
        {/* The same words as the screen it leads to, from the same key — a
            button whose label and its destination's title disagree is two
            translations of one idea drifting apart. */}
        <Link href="/upload" className={`${primaryButton} mt-6 w-fit`}>
          <IconUpload className="size-5" />
          {t.upload.title}
        </Link>
      </div>
    </main>
  );
}
