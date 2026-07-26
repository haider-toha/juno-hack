import { DemoModeBadge } from "@/components/demo-mode-badge";
import { IconKeyboard, IconMic } from "@/components/icons";
import { LanguagePicker } from "@/components/language-picker";
import { OrbSphere } from "@/components/voice/orb";
import type { VoiceStrings } from "@/components/voice/voice-session";
import type { Locale } from "@/lib/i18n/locales";

// The pre-session screen: the orb at rest, the screen's own copy, and the ways
// in. A presentational leaf — props in, markup out, no SDK calls and no state.
// It carries no "use client" of its own: `voice-session.tsx` is the client
// boundary and this file is only reached through it.
//
// `incoming` is the raised-check-in variant. Portico is calling: the screen
// leads with the call, and the primary action reads as answering it rather than
// starting something. It is driven by real state the operator raised in Redis,
// never by a timer.
export function IdleView({
  locale,
  strings,
  title,
  blurb,
  error,
  incoming,
  onStart,
  onType,
}: {
  locale: Locale;
  strings: VoiceStrings;
  title: string;
  blurb: string;
  error: string | null;
  incoming: boolean;
  onStart: () => void;
  onType: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface px-5">
      {/* The language control keeps the same top-right position it holds on
          every other screen, so it is never hunted for. */}
      <div className="flex shrink-0 justify-end pt-3">
        <LanguagePicker locale={locale} t={strings.languagePicker} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <OrbSphere connected speaking={false} />
        <div>
          {incoming ? (
            <p className="mb-2 text-sm font-medium tracking-wide text-ink-muted">
              {strings.voice.incomingLabel}
            </p>
          ) : null}
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            {incoming ? strings.voice.incomingTitle : title}
          </h1>
          {/* text-lg, not text-base: this is the sentence that tells someone
              who has never met the product what tapping the button will do,
              and it was set smaller than the body copy on every other screen. */}
          <p className="mx-auto mt-3 max-w-[30ch] text-lg leading-relaxed text-ink-muted">
            {incoming ? strings.voice.incomingBlurb : blurb}
          </p>
        </div>
        {error !== null ? (
          <p
            role="alert"
            className="rounded-tactile border-l-2 border-accent bg-accent/10 py-2 pl-3 pr-2 text-left text-base text-ink"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-center py-6">
        {/* py-4 on top of the shared 52px floor, so the one action on the
            calmest screen in the app is also the largest target in it. */}
        <button
          type="button"
          onClick={onStart}
          className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-tactile bg-accent px-5 py-4 font-display text-lg font-medium text-ink-invert transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
        >
          <IconMic className="size-6 text-ink-invert" />
          {incoming ? strings.voice.answer : strings.voice.start}
        </button>
        <button
          type="button"
          onClick={onType}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-tactile px-5 font-display text-base font-medium text-ink-muted transition-opacity duration-150 ease-out hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
        >
          <IconKeyboard className="size-4 text-ink-muted" />
          {strings.voice.typeInstead}
        </button>
        {/* The check-in screen was the one on-camera surface that never said it
            was a demo. It says so under the fold of the action, where it is
            legible without competing with the thing to tap. */}
        <div className="mt-4 empty:mt-0">
          <DemoModeBadge text={strings.common.demoMode} />
        </div>
      </div>
    </div>
  );
}
