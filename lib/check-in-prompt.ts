import { getDictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import type { ExtractedBundle } from "@/lib/plan/schema";
import type { LogEntry } from "@/lib/store/log";
import {
  daysBetween,
  dueToday,
  standingItems,
  type TimelineItem,
} from "@/lib/timeline/schedule";

// The whole of what the agent knows during a check-in. The session override
// REPLACES the agent's dashboard prompt, so anything absent from this string
// does not exist at runtime — the persona, today's plan, the red flags and the
// tool rules all have to travel together or none of them apply.
//
// Pure: `today` and the log come in as arguments, so the demo clock moves this
// the same way it moves the timeline, and nothing here reads Redis or the
// clock for itself.

type Inputs = {
  bundle: ExtractedBundle;
  today: string;
  // The days `assess()` looks at, so the agent can mention a recent miss
  // without being told what a run of them means.
  logs: readonly LogEntry[];
  locale: Locale;
};

export function buildCheckInPrompt({
  bundle,
  today,
  logs,
  locale,
}: Inputs): string {
  const t = getDictionary(locale).checkInPrompt;
  const persona = getDictionary(locale).persona.systemPrompt;

  const due = dueToday(bundle, today);
  const standing = standingItems(bundle);
  const answeredToday = logs.filter((entry) => entry.day === today);
  const answeredIds = new Set(answeredToday.map((entry) => entry.itemId));
  const recentMisses = logs.filter(
    (entry) => entry.status === "missed" && entry.day !== today,
  );

  const dayNumber =
    bundle.episode.dischargeDate === null
      ? null
      : daysBetween(bundle.episode.dischargeDate, today);

  return [
    persona,
    "",
    `## ${t.whoHeading}`,
    bundle.patient.givenName === null
      ? t.whoUnnamed
      : `${bundle.patient.givenName}.`,
    "",
    `## ${t.whenHeading}`,
    today,
    dayNumber === null ? null : `${t.dayNumber} ${dayNumber}`,
    "",
    `## ${t.planHeading}`,
    t.idNote,
    due.length === 0
      ? t.planNothing
      : due.map((item) => describe(item, answeredIds)).join("\n"),
    "",
    standing.length === 0 ? null : `## ${t.standingHeading}`,
    standing.length === 0
      ? null
      : standing.map((item) => describe(item, answeredIds)).join("\n"),
    standing.length === 0 ? null : "",
    `## ${t.answeredHeading}`,
    answeredToday.length === 0
      ? t.answeredNone
      : answeredToday
          .map((entry) => `- [${entry.itemId}] ${entry.status}`)
          .join("\n"),
    "",
    `## ${t.recentHeading}`,
    recentMisses.length === 0
      ? t.recentNone
      : recentMisses
          .map((entry) => `- [${entry.itemId}] ${entry.day}`)
          .join("\n"),
    "",
    `## ${t.redFlagHeading}`,
    t.redFlagRule,
    bundle.redFlags.length === 0
      ? t.redFlagNone
      : bundle.redFlags
          // The letter is an English document, so a French session would
          // otherwise hear its one piece of safety-critical text in English.
          // The authored French exists on the bundle for exactly this. The
          // language tag travels with the line because the rule above tells the
          // agent to quote rather than paraphrase, and that instruction only
          // makes sense if it knows which of the two it is holding.
          .map((flag) =>
            locale === "fr" && flag.triggerFr !== null && flag.actionFr !== null
              ? `- [${flag.id}] (fr) ${flag.triggerFr} → ${flag.actionFr}`
              : `- [${flag.id}] (en) ${flag.triggerVerbatim} → ${flag.actionVerbatim}`,
          )
          .join("\n"),
    "",
    `## ${t.toolsHeading}`,
    t.toolsBody,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

// Plan-aware, so the opening line is about this person's day rather than a
// greeting that could have been recorded a year ago.
export function buildFirstMessage({
  bundle,
  today,
  locale,
}: Omit<Inputs, "logs">): string {
  const t = getDictionary(locale).persona;
  const count = dueToday(bundle, today).length;
  const name = bundle.patient.givenName;

  const greeting =
    name === null
      ? t.firstMessage
      : t.firstMessageNamed.replace("{name}", name);

  const plan =
    count === 0
      ? t.firstMessageNothingDue
      : count === 1
        ? t.firstMessageOneDue
        : t.firstMessageDue.replace("{count}", String(count));

  // The unnamed greeting already ends in a question, so appending another one
  // would have the agent open with two.
  return name === null
    ? `${greeting} ${plan}`
    : `${greeting} ${plan} ${t.firstMessageAsk}`;
}

function describe(
  item: TimelineItem,
  answeredIds: ReadonlySet<string>,
): string {
  const answered = answeredIds.has(item.id) ? " ✓" : "";
  switch (item.kind) {
    case "medication": {
      const m = item.medication;
      const importance =
        m.escalationClass === "high_stakes" ? " (important)" : "";
      const purpose = m.purposePlain === null ? "" : ` — ${m.purposePlain}`;
      return `- [${m.id}] ${m.nameAsWritten}: ${m.doseDirectionsVerbatim}${importance}${purpose}${answered}`;
    }
    case "instruction":
      return `- [${item.instruction.id}] ${item.instruction.detailVerbatim}${answered}`;
    case "appointment": {
      const a = item.appointment;
      const where =
        a.locationVerbatim === null ? "" : ` — ${a.locationVerbatim}`;
      return `- [${a.id}] ${a.withVerbatim}: ${a.when.verbatim}${where}${answered}`;
    }
  }
}
