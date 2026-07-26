import { BackButton } from "@/components/back-button";
import { EscalationCard, formatDay } from "@/components/family/escalation-card";
import { RefreshPoller } from "@/components/family/refresh-poller";
import { assess, assessmentWindow } from "@/lib/escalation/rules";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";
import { getDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { readLog } from "@/lib/store/log";
import { readPatient } from "@/lib/store/patient";
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

  // The window is asked for by the rule itself, so the read can never be
  // narrower than what `assess()` needs to reach its conclusion.
  const logs =
    bundle === null
      ? []
      : await readLog(DEMO_PATIENT_ID, assessmentWindow(today));

  const assessment = bundle === null ? null : assess(bundle, logs, today);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <RefreshPoller />

      <div className="shrink-0 px-5 pt-3">
        <BackButton href="/" label={t.common.back} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
          {t.family.title}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-ink-muted">
          {patient?.nextOfKin === null || patient?.nextOfKin === undefined
            ? t.family.noKin
            : `${t.family.sharedWith} ${patient.nextOfKin.relationshipVerbatim}`}
        </p>
        <p className="mt-1 text-sm text-ink-faint">
          {t.family.todayLabel} · {formatDay(today, locale)}
        </p>

        <div className="mt-5">
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
