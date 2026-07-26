import type { ReactNode } from "react";

// The day-checklist shell only. Follow-ups / as-needed / ward changes live
// under "More on your plan" and do not use this — a raised white card next to
// Today made every block look like another tickable day. `today` is lavender;
// other days are white with the same elevation.
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
