import { IconChat, IconChevron } from "@/components/icons";

// The opening prompts, as ≥44px full-width list rows. They feed the session
// through `onAsk`, which sends now or queues until connect; the disabled gate
// only reflects whether the session is live.
export function SuggestedQuestions({
  questions,
  onAsk,
  disabled,
  heading,
}: {
  questions: readonly string[];
  onAsk: (text: string) => void;
  disabled: boolean;
  heading: string;
}) {
  return (
    <div className="shrink-0 border-t border-rule px-4 py-3">
      <p className="mb-2.5 px-1 font-display text-sm font-medium text-ink-muted">
        {heading}
      </p>
      <ul className="flex flex-col gap-2">
        {questions.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onAsk(q)}
              disabled={disabled}
              className="flex min-h-[3.25rem] w-full items-center justify-between gap-3 rounded-card border border-transparent bg-mist px-3 py-2.5 text-left text-base text-ink transition-colors duration-150 ease-out active:bg-lavender focus-visible:border-accent disabled:opacity-40"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-tactile bg-lavender text-accent"
                >
                  <IconChat className="size-4" />
                </span>
                <span className="min-w-0">{q}</span>
              </span>
              <IconChevron className="size-4 shrink-0 text-ink-faint" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
