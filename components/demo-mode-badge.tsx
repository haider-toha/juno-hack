import { env } from "@/lib/env";

// Demo mode is legitimate, but only while it is visible: a mode you cannot see
// on screen is indistinguishable from a lie. Rendered wherever the two things
// demo mode changes — extraction and drug context — are on display.
export function DemoModeBadge() {
  if (env.NEXT_PUBLIC_PORTICO_MODE !== "demo") return null;

  return (
    <p className="rounded-tactile bg-lavender px-3 py-2 text-sm leading-snug text-accent">
      Demo mode. The letter and the medicine guidance are recorded, not fetched
      live.
    </p>
  );
}
