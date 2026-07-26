// One strip of tappable sentences above the composer, and never two. Before the
// first user turn it holds the openings; from then on it holds the two answers a
// check-in actually turns on, so a dose can still be recorded by tapping when
// speech is not understood — the mitigation B12 asks for, and the only path on
// this screen that does not go through ASR.
//
// Pills rather than the full-width rows with an icon square and a chevron this
// replaced: three of those cost ~200px of a 844px phone and put the same two
// pieces of chrome on every line. A capsule with a hairline and a mist fill
// reads as tappable on its own, and the strip keeps its 44px floor.
//
// The heading is the list's accessible name, not visible text: a row of
// tappable sentences does not need a label saying it is one.
export function ChipRow({
  items,
  onAsk,
  disabled,
  label,
}: {
  items: readonly string[];
  onAsk: (text: string) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="flex shrink-0 flex-wrap gap-2 border-t border-rule px-4 py-3"
    >
      {items.map((text) => (
        <li key={text}>
          <button
            type="button"
            onClick={() => onAsk(text)}
            disabled={disabled}
            className="flex min-h-11 items-center rounded-pill border border-rule bg-mist px-4 text-left text-base text-ink transition-colors duration-150 ease-out hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-lavender disabled:opacity-40"
          >
            {text}
          </button>
        </li>
      ))}
    </ul>
  );
}
