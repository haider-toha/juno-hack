import type { ReactNode } from "react";

// The plan's card shell. Every block on the timeline is this shape — a day, a
// group, a notice, and the placeholders the loading skeleton stands in for them
// — so the padding and the elevation live here instead of being retyped on each
// screen and drifting. `today` is the only thing a card varies, and lavender is
// the only meaning it carries on this screen.
export function PlanCard({
  today = false,
  labelledBy,
  children,
}: {
  today?: boolean;
  labelledBy?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`rounded-card px-5 py-4 shadow-card ${today ? "bg-lavender" : "bg-surface"}`}
    >
      {children}
    </section>
  );
}
