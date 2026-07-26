// The brand lockup: lowercase "portico" with a single indigo period. No icon —
// the name is the mark. `aria-label` keeps the proper noun for assistive tech;
// the visible string stays lowercase so the lockup never renders as "Portico.".
export function PorticoWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="Portico"
      className={`font-display font-medium tracking-[0.08em] text-ink ${className}`}
    >
      <span aria-hidden="true">
        portico<span className="text-accent">.</span>
      </span>
    </span>
  );
}
