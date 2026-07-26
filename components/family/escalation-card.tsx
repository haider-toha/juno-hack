import type { Assessment } from "@/lib/escalation/rules";
import type { Dictionary } from "@/lib/i18n/en";
import type { Locale } from "@/lib/i18n/locales";

// The rest of the app says "Saturday 25 July", not "2026-07-25", and a relative
// reading a phone at speed should not have to parse an ISO date.
//
// Not `formatDay` from `components/plan/day-section.tsx`: that one is pinned to
// `en-GB`, which is right for a screen Track A owns and wrong here — it would
// print an English weekday on the French dashboard, which is the silent English
// fallthrough D9 bans. Both formatters are three lines; sharing one would mean
// giving it a locale parameter it has no other caller for.
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
      return (
        <Card
          tone="calm"
          title={t.noneTitle}
          body={t.noneBody}
          locale={locale}
          t={t}
        />
      );
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

// Three tones, one shape. The alert earns a solid accent rule; the others stay
// quiet, because a family dashboard that shouts at every dose stops being read.
const TONES = {
  calm: "border-rule",
  watch: "border-rule border-l-2 border-l-warning",
  alert: "border-rule border-l-2 border-l-error",
} satisfies Record<string, string>;

function Card({
  tone,
  title,
  body,
  medication,
  missedDays,
  locale,
  t,
}: {
  tone: keyof typeof TONES;
  title: string;
  body: string;
  medication?: string;
  missedDays?: readonly string[];
  locale: Locale;
  t: Dictionary["family"];
}) {
  return (
    <section
      className={`rounded-card border bg-surface p-5 shadow-card ${TONES[tone]}`}
    >
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {medication === undefined ? null : (
        <p className="mt-2 font-display text-lg font-medium text-ink">
          {medication}
        </p>
      )}
      <p className="mt-3 max-w-[42ch] text-base leading-relaxed text-ink-muted">
        {body}
      </p>
      {missedDays === undefined ? null : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {missedDays.map((day) => (
            <li
              key={day}
              className="rounded-pill bg-mist px-3 py-1 text-sm text-ink-muted"
            >
              {t.missedOn} {formatDay(day, locale)}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 border-t border-rule pt-3 text-sm leading-snug text-ink-faint">
        {t.computed}
      </p>
    </section>
  );
}
