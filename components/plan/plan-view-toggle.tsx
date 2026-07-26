import Link from "next/link";

type View = "list" | "calendar";

type Props = {
  view: View;
  selectedDate: string;
  viewLabel: string;
  listLabel: string;
  calendarLabel: string;
};

export function PlanViewToggle({
  view,
  selectedDate,
  viewLabel,
  listLabel,
  calendarLabel,
}: Props) {
  return (
    <div
      role="group"
      aria-label={viewLabel}
      className="inline-flex rounded-tactile border border-rule bg-surface p-0.5"
    >
      <Segment current={view === "list"} href="/plan" label={listLabel} />
      <Segment
        current={view === "calendar"}
        href={`/plan?view=calendar&date=${selectedDate}`}
        label={calendarLabel}
      />
    </div>
  );
}

function Segment({
  current,
  href,
  label,
}: {
  current: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={current ? "page" : undefined}
      className={`flex min-h-11 items-center rounded-tactile px-4 font-display text-base font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        current
          ? "bg-lavender text-ink"
          : "text-ink-muted hover:text-ink active:opacity-80"
      }`}
    >
      {label}
    </Link>
  );
}
