"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { IconKeyboard, IconMenu, IconMic } from "@/components/icons";
import { LanguagePicker } from "@/components/language-picker";
import { Composer } from "@/components/voice/composer";
import { OrbDock, OrbSphere, VoiceStatusLine } from "@/components/voice/orb";
import { SuggestedQuestions } from "@/components/voice/suggested-questions";
import { Transcript, type Turn } from "@/components/voice/transcript";
import { env } from "@/lib/env";
import type { Dictionary } from "@/lib/i18n/en";
import type { Locale } from "@/lib/i18n/locales";

// The two internal view-states of a voice screen. The provider + session live
// across both, mounted once; entering the conversation never unmounts the
// session. These are NOT sub-routes and read no URL state.
type Phase = "idle" | "conversation";

// Only the slices this tree renders, never the whole dictionary — every prop
// handed to a client component is serialised into the page payload.
export type VoiceStrings = Pick<
  Dictionary,
  "voice" | "composer" | "transcript" | "suggestions" | "languagePicker"
>;

type VoiceSessionProps = {
  // Drives the UI language AND the agent's spoken language from one value, so a
  // French screen cannot end up answered by an English voice [Locked D9].
  locale: Locale;
  strings: VoiceStrings;
  // Idle-screen copy — what the user sees before they tap to start.
  title: string;
  blurb: string;
  // Sent as a per-session override, so it replaces the agent's dashboard prompt
  // for this call. Every overridden field must be enabled in the agent's
  // ElevenLabs Security settings. A disallowed field is NOT ignored and does NOT
  // throw: the server refuses the session — the socket closes 1008, naming the
  // field, after conversation_initiation_metadata. The try/catch in connect()
  // cannot see that; it arrives via onError and must stay visible in the
  // role="alert" banner below.
  systemPrompt: string;
  firstMessage: string;
  suggestedQuestions: readonly string[];
};

// A growing per-character timeline: for each char of the agent's current
// response, the absolute wall-clock time (performance.now() ms) at which it
// should be voiced. Each `audio_alignment` event appends one chunk's chars,
// converting its relative `char_start_times_ms` into absolute timestamps by
// anchoring to the moment that chunk arrived.
type RevealTimeline = {
  spokenAtMs: number[];
};

// Small lead so a word appears just before the voice hits it, instead of
// trailing behind. Keeps the reveal feeling "live" without spoiling phrases.
const REVEAL_LEAD_MS = 120;

// The SDK is provider-based: the provider holds the session machinery and the
// inner component drives it through the conversation hooks. The provider must
// wrap every component that calls `useConversation*`, so this is the boundary.
export function VoiceSession(props: VoiceSessionProps) {
  return (
    <ConversationProvider>
      <Session {...props} />
    </ConversationProvider>
  );
}

function Session({
  locale,
  strings,
  title,
  blurb,
  systemPrompt,
  firstMessage,
  suggestedQuestions,
}: VoiceSessionProps) {
  const t = strings.voice;
  const [phase, setPhase] = useState<Phase>("idle");
  // How the conversation was entered: "voice" via the primary CTA, "text" via
  // "Type instead". Voice entry keeps the prominent orb; the typed path drops it
  // for a slim status line so the thread reads clean to the input bar. Voice
  // stays live either way.
  const [entryMode, setEntryMode] = useState<"voice" | "text">("voice");
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [agentLive, setAgentLive] = useState("");
  const [revealedCount, setRevealedCount] = useState(0);
  const [agentThinking, setAgentThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Absolute spoken-at timestamps per char of the *current* agent response.
  // A ref (not state) because the reveal interval mutates it on every audio
  // chunk and reads it every ~30ms without needing to re-render the tree.
  const timeline = useRef<RevealTimeline>({ spokenAtMs: [] });
  const scrollRef = useRef<HTMLDivElement>(null);
  // Autoscroll state, in refs so updating it never re-renders. `stickToBottom`
  // is whether we should keep pinning to the foot as content grows; the onScroll
  // handler flips it off the moment the reader scrolls up to re-read, and back on
  // when they return to the bottom. `prevTurnCount` lets the scroll effect tell a
  // brand-new turn (always re-pin) from mere streaming growth (pin only if stuck).
  const stickToBottom = useRef(true);
  const prevTurnCount = useRef(0);
  // Questions submitted (typed or tapped) before the socket is open can't be sent
  // yet — sendUserMessage throws until status is "connected". Hold them here and
  // flush on connect so a question entered during the ~1-2s start handshake still
  // reaches the agent instead of being silently dropped.
  const pendingMessages = useRef<string[]>([]);

  // The SDK's convenience hook: it both reads status / exposes the session
  // controls AND registers these callbacks with the provider via a latest-
  // closure ref, so the handlers always see the current state setters. `mode`
  // is the SDK's speaking/listening axis, which drives the orb.
  const { status, mode, startSession, endSession, sendUserMessage } =
    useConversation({
      onMessage: (m) => {
        if (m.source === "user") {
          setTranscript((t) => [...t, { role: "user", text: m.message }]);
        }
        if (m.source === "ai") {
          // Dedup guard: drop an agent turn identical to the one immediately
          // before it. The opening line arrives via the firstMessage override;
          // an echoed/repeated emission of the same text must not stack a second
          // bubble on top of it.
          setTranscript((t) => {
            const last = t[t.length - 1];
            if (last?.role === "agent" && last.text === m.message) return t;
            return [...t, { role: "agent", text: m.message }];
          });
        }
      },
      onAgentChatResponsePart: (part) => {
        // part: { text, type: "start" | "delta" | "stop", event_id }.
        // We accumulate the *target* text from deltas but gate visibility on the
        // audio timeline below — so the user sees text appear in step with the
        // voice, not in jumpy LLM chunks.
        if (part.type === "start") {
          setAgentLive("");
          setRevealedCount(0);
          timeline.current = { spokenAtMs: [] };
          setAgentThinking(true);
        } else if (part.type === "delta") {
          setAgentLive((s) => s + part.text);
        } else if (part.type === "stop") {
          setAgentLive("");
          setRevealedCount(0);
          timeline.current = { spokenAtMs: [] };
          setAgentThinking(false);
        }
      },
      onAudioAlignment: (a) => {
        // Field names are snake_case on the wire (AudioEventAlignment). Convert
        // each char's chunk-relative start into an absolute performance.now() ms
        // and append to the cumulative timeline. The reveal interval below
        // walks this timeline to drive `revealedCount`.
        const anchor = performance.now();
        const next = timeline.current.spokenAtMs.slice();
        for (let i = 0; i < a.chars.length; i++) {
          next.push(anchor + (a.char_start_times_ms[i] ?? 0));
        }
        timeline.current = { spokenAtMs: next };
      },
      // onError(message, context) — the first arg is the message string, not an
      // Error object. Surface it inline rather than logging to a console nobody
      // watches during a demo.
      onError: (message) => setError(message),
      onStatusChange: ({ status }) => {
        if (status === "disconnected") {
          setAgentLive("");
          setRevealedCount(0);
          setAgentThinking(false);
          timeline.current = { spokenAtMs: [] };
        }
      },
    });
  const sessionLive = status === "connected" || status === "connecting";

  // Audio-paced reveal: ~30ms tick (≈animation frame cadence) walks the
  // cumulative spoken-at timeline and advances `revealedCount` to the last
  // char whose voiced moment has passed (+ a small lead so words appear just
  // before the audio hits them rather than chasing it).
  useEffect(() => {
    if (status !== "connected") return;
    const tick = window.setInterval(() => {
      const now = performance.now() + REVEAL_LEAD_MS;
      const timestamps = timeline.current.spokenAtMs;
      let i = 0;
      while (i < timestamps.length && timestamps[i]! <= now) i++;
      setRevealedCount((prev) => (i > prev ? i : prev));
    }, 30);
    return () => window.clearInterval(tick);
  }, [status]);

  // Flush any questions queued before the socket opened. Runs the moment the
  // session reaches "connected", so a too-early submit is delivered rather than
  // dropped. sendUserMessage is a stable SDK ref, so this only re-runs on an
  // actual status change.
  useEffect(() => {
    if (status !== "connected" || pendingMessages.current.length === 0) return;
    const queued = pendingMessages.current;
    pendingMessages.current = [];
    for (const text of queued) sendUserMessage(text);
  }, [status, sendUserMessage]);

  // Keep the foot of the thread in view as turns arrive AND as the agent's reply
  // streams in (revealedCount grows on every reveal tick) — a brand-new turn
  // always re-pins, ongoing growth pins only while the reader hasn't scrolled up.
  // This is what stops a long reply from "getting stuck" once it passes the fold.
  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    const newTurn = transcript.length > prevTurnCount.current;
    prevTurnCount.current = transcript.length;
    if (newTurn) stickToBottom.current = true;
    if (newTurn || stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [transcript, revealedCount, agentThinking, phase]);

  // Track whether the reader is parked at the bottom. Scrolling up to re-read
  // turns auto-stick off; returning to the foot turns it back on. Mutates a ref
  // only, so it never triggers a render on a hot scroll event.
  function onTranscriptScroll() {
    const el = scrollRef.current;
    if (el === null) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function connect() {
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const signedUrl = await fetchSignedUrl(t.errorStart);
      startSession({
        signedUrl,
        overrides: {
          agent: {
            // The override REPLACES the agent's base prompt for this session, so
            // the persona + concision rules must travel with whatever data they
            // operate on or they never apply at runtime.
            prompt: { prompt: systemPrompt },
            // Selects the agent's language preset, and with it the TTS model
            // pinned for that locale: `en` uses the base eleven_flash_v2,
            // `fr` uses language_presets.fr's eleven_flash_v2_5. The model is
            // not client-overridable, so this prop cannot drift it.
            language: locale,
            firstMessage,
          },
          tts: { voiceId: env.NEXT_PUBLIC_XI_VOICE_ID },
        },
      });
    } catch (e) {
      setError(messageOf(e, t));
    }
  }

  // The start chain: getUserMedia → fetchSignedUrl → startSession stays inside
  // this direct user tap. connect() is invoked synchronously so getUserMedia is
  // reached within the gesture; never move it into an effect, timeout or router
  // transition — Safari will refuse the mic outside the gesture.
  function begin(focusInput: boolean) {
    setEntryMode(focusInput ? "text" : "voice");
    void connect();
    setPhase("conversation");
  }

  // The docked X. Hiding the live view without unmounting the provider would
  // leave the mic / WebSocket alive, so ending here is REQUIRED, not redundant
  // unmount teardown — the provider stays mounted.
  function end() {
    endSession();
    setTranscript([]);
    setPhase("idle");
  }

  // Send a question through the shared session, or queue it when the socket isn't
  // open yet — the flush effect above delivers it on connect. The optimistic
  // user turn shows immediately so the question registers on submit.
  // sendUserMessage injects text (not transcribed speech), so the server does not
  // echo it back as a user_transcript onMessage event.
  function ask(text: string) {
    setTranscript((t) => [...t, { role: "user", text }]);
    if (status === "connected") {
      sendUserMessage(text);
    } else {
      pendingMessages.current.push(text);
    }
  }

  const showSuggestions =
    sessionLive && !transcript.some((t) => t.role === "user");

  if (phase === "idle") {
    return (
      <IdleView
        locale={locale}
        strings={strings}
        title={title}
        blurb={blurb}
        error={error}
        onStart={() => begin(false)}
        onType={() => begin(true)}
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface">
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
        <Link
          href="/"
          aria-label={t.menu}
          className="grid size-11 place-items-center rounded-tactile text-ink-muted transition-colors duration-150 ease-out hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-60"
        >
          <IconMenu className="size-5" />
        </Link>
        <LanguagePicker locale={locale} t={strings.languagePicker} />
      </div>

      <div
        ref={scrollRef}
        onScroll={onTranscriptScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {error !== null ? (
          <p
            role="alert"
            className="mb-3 rounded-tactile border-l-2 border-accent bg-accent/10 py-2 pl-3 pr-2 text-base text-ink"
          >
            {error}
          </p>
        ) : null}

        {transcript.length === 0 && agentLive === "" && error === null ? (
          <p className="mt-8 text-center text-base text-ink-muted">
            {status === "connecting"
              ? t.connecting
              : status === "connected"
                ? t.gettingReady
                : t.starting}
          </p>
        ) : null}

        <Transcript
          items={transcript}
          live={agentLive}
          revealedCount={revealedCount}
          thinking={agentThinking}
          thinkingLabel={strings.transcript.thinking}
        />
      </div>

      {showSuggestions ? (
        <SuggestedQuestions
          questions={suggestedQuestions}
          onAsk={ask}
          disabled={!sessionLive}
          heading={strings.suggestions.heading}
        />
      ) : null}

      {entryMode === "voice" ? (
        <OrbDock status={status} mode={mode} t={t} />
      ) : (
        <VoiceStatusLine status={status} mode={mode} t={t} />
      )}

      <Composer
        onSubmit={ask}
        onEnd={end}
        autoFocus={entryMode === "text"}
        t={strings.composer}
      />
    </div>
  );
}

// The pre-session screen: the orb at rest, the screen's own copy, and the two
// ways in. Both CTAs call `begin` directly so the mic request stays inside the
// user's tap.
function IdleView({
  locale,
  strings,
  title,
  blurb,
  error,
  onStart,
  onType,
}: {
  locale: Locale;
  strings: VoiceStrings;
  title: string;
  blurb: string;
  error: string | null;
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
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-[32ch] text-base leading-relaxed text-ink-muted">
            {blurb}
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

      <div className="shrink-0 py-6">
        <button
          type="button"
          onClick={onStart}
          className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-tactile bg-accent px-5 font-display text-lg font-medium text-ink-invert transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
        >
          <IconMic className="size-5 text-ink-invert" />
          {strings.voice.start}
        </button>
        <button
          type="button"
          onClick={onType}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-tactile px-5 font-display text-base font-medium text-ink-muted transition-opacity duration-150 ease-out hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
        >
          <IconKeyboard className="size-4 text-ink-muted" />
          {strings.voice.typeInstead}
        </button>
      </div>
    </div>
  );
}

// Our own route's response is still a network boundary, so parse it rather than
// asserting the shape.
const signedUrlSchema = z.object({ signedUrl: z.string().min(1) });

async function fetchSignedUrl(failureMessage: string): Promise<string> {
  const res = await fetch("/api/eleven/signed-url");
  if (!res.ok) throw new Error(failureMessage);
  return signedUrlSchema.parse(await res.json()).signedUrl;
}

function messageOf(e: unknown, t: Dictionary["voice"]): string {
  if (e instanceof DOMException && e.name === "NotAllowedError") {
    return t.errorMic;
  }
  // An Error raised inside the SDK carries its own English text. Showing it is
  // still right: a real fault reported in the wrong language beats a translated
  // sentence that hides which fault it was.
  if (e instanceof Error) return e.message;
  return t.errorUnknown;
}
