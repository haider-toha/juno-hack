import { VoiceSession } from "@/components/voice/voice-session";
import { buildCheckInPrompt, buildFirstMessage } from "@/lib/check-in-prompt";
import { assessmentWindow } from "@/lib/escalation/rules";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";
import { readIncomingCheckIn } from "@/lib/store/check-in";
import { getDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { readLog } from "@/lib/store/log";
import { readPlan } from "@/lib/store/plan";

export async function generateMetadata() {
  const t = getDictionary(await getLocale());
  return { title: t.checkIn.metaTitle };
}

// Redis-backed and time-dependent: prerendering it would bake one day's plan
// into the build and freeze the raised-check-in flag at build time.
export const dynamic = "force-dynamic";

// A thin Server Component: it reads the locale, the plan and the recent log,
// then composes the whole system prompt and hands it to the client leaf, which
// owns the idle → conversation flow. `locale` travels with them, so the language
// the screen is written in and the language the agent speaks are the same value.
//
// The page root fills the bounded phone-shell column and never uses dvh/vh —
// the frame owns the height.
export default async function CheckInPage() {
  const [locale, today, bundle, incomingAt] = await Promise.all([
    getLocale(),
    getDemoToday(),
    readPlan(DEMO_PATIENT_ID),
    readIncomingCheckIn(DEMO_PATIENT_ID),
  ]);
  const t = getDictionary(locale);

  // The agent's whole world is the plan. With none stored there is nothing to
  // ground it in, so it gets the invariant persona alone rather than a prompt
  // whose plan section would be a fabrication.
  const logs =
    bundle === null
      ? []
      : await readLog(DEMO_PATIENT_ID, assessmentWindow(today));

  return (
    <VoiceSession
      locale={locale}
      strings={{
        voice: t.voice,
        composer: t.composer,
        transcript: t.transcript,
        suggestions: t.suggestions,
        languagePicker: t.languagePicker,
        redFlag: t.redFlag,
        common: t.common,
      }}
      title={t.checkIn.title}
      blurb={t.checkIn.blurb}
      systemPrompt={
        bundle === null
          ? t.persona.systemPrompt
          : buildCheckInPrompt({ bundle, today, logs, locale })
      }
      firstMessage={
        bundle === null
          ? t.persona.firstMessage
          : buildFirstMessage({ bundle, today, logs, locale })
      }
      suggestedQuestions={t.persona.suggestedQuestions}
      patientId={DEMO_PATIENT_ID}
      incomingAt={incomingAt}
      // Only the five fields the card renders — every prop crossing into a
      // client component is serialised into the page payload.
      redFlags={
        bundle?.redFlags.map((flag) => ({
          id: flag.id,
          triggerVerbatim: flag.triggerVerbatim,
          actionVerbatim: flag.actionVerbatim,
          triggerFr: flag.triggerFr,
          actionFr: flag.actionFr,
        })) ?? []
      }
    />
  );
}
