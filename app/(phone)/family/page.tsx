import { BackButton } from "@/components/back-button";
import { EscalationCard } from "@/components/family/escalation-card";
import { RefreshPoller } from "@/components/family/refresh-poller";
import { formatDay } from "@/components/plan/day-section";
import { assess, assessmentWindow } from "@/lib/escalation/rules";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";
import type { Dictionary } from "@/lib/i18n/en";
import { getDemoToday } from "@/lib/store/clock";
import { readEscalations } from "@/lib/store/escalation";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { readLog } from "@/lib/store/log";
import { readPatient, type PatientRecord } from "@/lib/store/patient";
import { readPlan } from "@/lib/store/plan";

export async function generateMetadata() {
  const t = getDictionary(await getLocale());
  return { title: t.family.metaTitle };
}

// The whole point of this screen is that it changes when a write it did not
// make lands. A cached render would show a relative yesterday's answer.
export const dynamic = "force-dynamic";

// Inside the phone shell, so the column fills with flex and never uses dvh/vh —
// the frame owns the height.
export default async function FamilyPage() {
  const [locale, today, patient, bundle] = await Promise.all([
    getLocale(),
    getDemoToday(),
    readPatient(DEMO_PATIENT_ID),
    readPlan(DEMO_PATIENT_ID),
  ]);
  const t = getDictionary(locale);

  const window = assessmentWindow(today);
  const [logs, escalations] =
    bundle === null
      ? [[], []]
      : await Promise.all([
          readLog(DEMO_PATIENT_ID, window),
          readEscalations(DEMO_PATIENT_ID, window),
        ]);

  const assessment =
    bundle === null ? null : assess(bundle, logs, escalations, today);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface">
      <RefreshPoller />

      <div className="shrink-0 px-5 pt-3">
        <BackButton href="/" label={t.common.back} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
          {t.family.title}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-ink-muted">
          {kinLine(patient?.nextOfKin ?? null, t.family)}
        </p>
        <p className="mt-1 text-sm text-ink-faint">
          {t.family.todayLabel} · {formatDay(today, locale)}
        </p>

        <div className="mt-6">
          {assessment === null ? (
            <p className="rounded-card border border-rule bg-surface p-5 text-base text-ink-muted shadow-card">
              {t.family.noPlan}
            </p>
          ) : (
            <EscalationCard
              assessment={assessment}
              locale={locale}
              t={t.family}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// The letter often only gives the relationship ("Daughter"). Name is shown
// when the record has one; inventing "Dora" when the letter never said it is
// the silent English fallthrough the schema's null name exists to prevent.
function kinLine(
  kin: PatientRecord["nextOfKin"],
  t: Dictionary["family"],
): string {
  if (kin === null) return t.noKin;
  if (kin.name === null) {
    return `${t.sharedWith} ${kin.relationshipVerbatim}`;
  }
  return `${t.sharedWith} ${kin.name} · ${kin.relationshipVerbatim}`;
}
