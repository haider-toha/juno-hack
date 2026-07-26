import { IconAlert } from "@/components/icons";
import { formatDay } from "@/components/plan/day-section";
import type { Assessment } from "@/lib/escalation/rules";
import type { Dictionary } from "@/lib/i18n/en";
import type { Locale } from "@/lib/i18n/locales";

// What `assess()` decided, said plainly. Every branch is rendered from the
// discriminated union, so a new assessment kind is a compile error here rather
// than a card that silently renders nothing.
//
// The card never diagnoses and never claims anyone was contacted. It says what
// was missed, on which days, and where the conclusion came from.
// The bundle's `purposePlain` is deliberately NOT rendered here. It is written
// to the patient — "because your heartbeat is irregular" — and this screen is
// read by their daughter. Rewriting it into the third person would be us
// paraphrasing a clinical explanation, so it stays on the patient's own screen.
export function EscalationCard({
  assessment,
  locale,
  t,
}: {
  assessment: Assessment;
  locale: Locale;
  t: Dictionary["family"];
}) {
  switch (assessment.kind) {
    case "none":
      return <Card tone="calm" title={t.noneTitle} body={t.noneBody} t={t} />;
    case "nudge":
      return (
        <Card
          tone="watch"
          title={t.nudgeTitle}
          body={t.nudgeBody}
          medication={assessment.name}
          missedDays={assessment.missedDays}
          locale={locale}
          t={t}
        />
      );
    case "alert-kin":
      return (
        <Card
          tone="alert"
          title={t.alertTitle}
          body={t.alertBody}
          medication={assessment.name}
          missedDays={assessment.missedDays}
          locale={locale}
          t={t}
        />
      );
  }
}

// Same two shells the rest of the phone already uses:
//   alert → red-flag card (`bg-error-soft` + triangle)
//   calm / watch → check-in summary card (hairline border + shadow)
// Missed days are just dates — the title already said they were missed, so a
// chip on every row was noise.
function Card({
  tone,
  title,
  body,
  medication,
  missedDays,
  locale,
  t,
}: {
  tone: "calm" | "watch" | "alert";
  title: string;
  body: string;
  medication?: string;
  missedDays?: readonly string[];
  locale?: Locale;
  t: Dictionary["family"];
}) {
  const alert = tone === "alert";

  return (
    <section
      aria-labelledby="family-assessment"
      className={
        alert
          ? "rounded-card bg-error-soft p-5 shadow-card"
          : "rounded-card border border-rule bg-surface p-5 shadow-card"
      }
    >
      {alert ? (
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-1 shrink-0 text-error">
            <IconAlert className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="family-assessment"
              className="text-xl font-semibold leading-snug text-ink"
            >
              {title}
            </h2>
            <Details
              medication={medication}
              body={body}
              missedDays={missedDays}
              locale={locale}
              t={t}
            />
          </div>
        </div>
      ) : (
        <>
          <h2
            id="family-assessment"
            className="font-display text-xl font-semibold tracking-tight text-ink"
          >
            {title}
          </h2>
          <Details
            medication={medication}
            body={body}
            missedDays={missedDays}
            locale={locale}
            t={t}
          />
        </>
      )}
    </section>
  );
}

function Details({
  medication,
  body,
  missedDays,
  locale,
  t,
}: {
  medication?: string;
  body: string;
  missedDays?: readonly string[];
  locale?: Locale;
  t: Dictionary["family"];
}) {
  return (
    <>
      {medication === undefined ? null : (
        <p lang="en" className="mt-4 font-semibold leading-snug text-ink">
          {medication}
        </p>
      )}

      <p
        className={`max-w-[42ch] text-base leading-relaxed text-ink-muted ${medication === undefined ? "mt-3" : "mt-2"}`}
      >
        {body}
      </p>

      {missedDays === undefined || locale === undefined ? null : (
        <ul className="mt-4 flex flex-col gap-1.5">
          {missedDays.map((day) => (
            <li key={day} className="text-base text-ink">
              {formatDay(day, locale)}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-sm leading-snug text-ink-faint">{t.computed}</p>
    </>
  );
}
