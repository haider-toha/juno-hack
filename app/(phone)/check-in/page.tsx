import { VoiceSession } from "@/components/voice/voice-session";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";

export async function generateMetadata() {
  const t = getDictionary(await getLocale());
  return { title: t.checkIn.metaTitle };
}

// A thin Server Component: it reads the locale once and hands the prompt, the
// opening copy and the screen's chrome strings into the client leaf, which owns
// the idle → conversation flow. `locale` travels with them, so the language the
// screen is written in and the language the agent speaks are the same value.
//
// The page root fills the bounded phone-shell column and never uses dvh/vh —
// the frame owns the height.
export default async function CheckInPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <VoiceSession
      locale={locale}
      strings={{
        voice: t.voice,
        composer: t.composer,
        transcript: t.transcript,
        suggestions: t.suggestions,
        languagePicker: t.languagePicker,
      }}
      title={t.checkIn.title}
      blurb={t.checkIn.blurb}
      systemPrompt={t.persona.systemPrompt}
      firstMessage={t.persona.firstMessage}
      suggestedQuestions={t.persona.suggestedQuestions}
    />
  );
}
