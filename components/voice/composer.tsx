import { type FormEvent, useEffect, useRef, useState } from "react";

import { IconClose, IconMic, IconPlus, IconSend } from "@/components/icons";

// The docked input bar: a pill capsule for typed questions plus the end-session
// X. It owns only its own draft; the submitted text goes straight to `onSubmit`,
// which decides whether to send now or queue until the socket opens.
export function Composer({
  onSubmit,
  onEnd,
  autoFocus,
}: {
  onSubmit: (text: string) => void;
  onEnd: () => void;
  autoFocus: boolean;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function onSubmitDraft(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = draft.trim();
    if (text === "") return;
    onSubmit(text);
    setDraft("");
  }

  const empty = draft.trim() === "";

  return (
    <div className="shrink-0 border-t border-rule bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2">
        <form
          onSubmit={onSubmitDraft}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-pill border border-transparent bg-mist pl-2 pr-1 transition-colors duration-150 ease-out focus-within:border-rule-strong"
        >
          {/* Decorative leading glyph. There is no attachment flow yet, so it
              carries no handler. */}
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center text-ink-faint"
          >
            <IconPlus className="size-5" />
          </span>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything"
            aria-label="Ask anything"
            enterKeyHint="send"
            autoComplete="off"
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            // Disabled only when empty — NOT on !connected. A disabled submit
            // button suppresses the form's implicit Enter submission, which
            // would drop a question typed during the start handshake; the parent
            // queues it instead and flushes on connect. The glyph tracks draft
            // state: a mic at rest (voice is always live) that becomes a send
            // arrow once there is text to send.
            disabled={empty}
            aria-label={empty ? "Voice input" : "Send"}
            className="grid size-9 shrink-0 place-items-center rounded-pill transition-opacity duration-150 ease-out active:opacity-60"
          >
            {empty ? (
              <IconMic className="size-5 text-ink-muted" />
            ) : (
              <IconSend className="size-5 text-accent" />
            )}
          </button>
        </form>
        <button
          type="button"
          onClick={onEnd}
          aria-label="End conversation"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-invert text-ink-invert transition-opacity duration-150 ease-out active:opacity-80"
        >
          <IconClose className="size-4" />
        </button>
      </div>
    </div>
  );
}
