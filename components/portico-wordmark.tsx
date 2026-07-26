// The brand lockup: lowercase "portico" with a single indigo period. No icon —
// the name is the mark. The visible string stays lowercase so the lockup never
// renders as "Portico.", and the proper noun is carried by a real text node
// rather than by `aria-label`: a plain <span> maps to role `generic`, which the
// accname spec does not name from `aria-label`, so that version was one browser
// away from a lockup with no accessible name at all.
export function PorticoWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display font-medium tracking-[0.08em] text-ink ${className}`}
    >
      <span aria-hidden="true">
        portico<span className="text-accent">.</span>
      </span>
      <span className="sr-only">Portico</span>
    </span>
  );
}
