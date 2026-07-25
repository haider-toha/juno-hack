import Link from "next/link";

import { IconChevron } from "@/components/icons";

// The shared back affordance, so every screen's is identical. A plain Link —
// server-compatible, no client hooks.
export function BackButton({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-11 place-items-center rounded-pill text-ink-muted transition duration-150 ease-out hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
    >
      <IconChevron className="size-5 rotate-180" />
    </Link>
  );
}
