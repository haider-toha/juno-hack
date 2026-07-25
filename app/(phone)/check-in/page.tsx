import { VoiceSession } from "@/components/voice/voice-session";
import { CHECK_IN_PROMPT, SUGGESTED_QUESTIONS } from "@/lib/check-in-prompt";

export const metadata = { title: "Check in" };

// A thin Server Component: it hands the prompt and opening copy into the client
// leaf, which owns the idle → conversation flow. The page root fills the bounded
// phone-shell column; it never uses dvh/vh — the frame owns the height.
export default function CheckInPage() {
  return (
    <VoiceSession
      title="Let's check in."
      blurb="Tell me how today has gone and I'll walk you through what's left."
      systemPrompt={CHECK_IN_PROMPT}
      firstMessage="Hello, it's Juno. How are you feeling today?"
      suggestedQuestions={SUGGESTED_QUESTIONS}
    />
  );
}
