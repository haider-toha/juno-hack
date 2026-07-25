import type { ReactNode } from "react";

export type Turn = { role: "user" | "agent"; text: string };

// The transcript as chat bubbles. The audio-paced reveal contract: only the
// slice of `live` that has been (or is about to be) voiced is shown, with the
// live caret. User turns get a pale lavender treatment, the agent a mist bubble.
export function Transcript({
  items,
  live,
  revealedCount,
  thinking,
}: {
  items: Turn[];
  live: string;
  revealedCount: number;
  thinking: boolean;
}) {
  const visible = live.slice(0, Math.min(revealedCount, live.length));
  // Show the typing indicator only while the agent is thinking AND no audio-
  // aligned text has appeared yet — once the first character is revealed, the
  // live bubble takes over and the dots disappear.
  const showTyping = thinking && visible === "";
  return (
    <div className="flex flex-col gap-3">
      {items.map((turn, i) => (
        <Bubble key={i} role={turn.role}>
          {turn.text}
        </Bubble>
      ))}
      {showTyping ? <TypingBubble /> : null}
      {visible !== "" ? (
        <Bubble role="agent">
          {visible}
          <span
            aria-hidden
            className="ml-0.5 inline-block w-[0.4ch] animate-pulse bg-accent align-baseline"
            style={{ height: "1em" }}
          />
        </Bubble>
      ) : null}
    </div>
  );
}

// The pre-dictation placeholder: three pulsing dots in a mist bubble, shown
// between the agent receiving the question and the first audio-aligned word.
function TypingBubble() {
  return (
    <p
      aria-label="Thinking"
      className="max-w-[85%] self-start rounded-bubble bg-mist px-4 py-3.5 text-base leading-relaxed"
    >
      <span className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            style={{ animationDelay: `${i * 160}ms` }}
            className="size-2 animate-pulse rounded-pill bg-ink-faint"
          />
        ))}
      </span>
    </p>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "agent";
  children: ReactNode;
}) {
  const base = "max-w-[85%] rounded-bubble px-4 py-3 text-base leading-relaxed";
  return role === "user" ? (
    <p className={`${base} self-end bg-lavender text-ink`}>{children}</p>
  ) : (
    <p className={`${base} self-start bg-mist text-ink`}>{children}</p>
  );
}
