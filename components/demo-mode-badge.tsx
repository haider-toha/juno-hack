import { env } from "@/lib/env";

// Demo mode is legitimate, but only while it is visible: a mode you cannot see
// on screen is indistinguishable from a lie. Rendered wherever the two things
// demo mode changes — extraction and drug context — are on display.
// The sentence arrives as a prop rather than being read from the dictionary
// here: this renders inside the check-in client leaf too, and `dictionary.ts`
// imports next/headers, so it cannot be reached from the browser bundle.
export function DemoModeBadge({ text }: { text: string }) {
  if (env.NEXT_PUBLIC_PORTICO_MODE !== "demo") return null;

  // A ruled white chip rather than a mist block: the plan screen's page colour
  // IS mist, so the old fill dissolved into it and the one line on screen that
  // admits what is recorded read as loose grey text. `inline-block` keeps it the
  // width of its own sentence, so it reads as a label and not as a banner.
  return (
    <p className="inline-block rounded-tactile border border-rule bg-surface px-3 py-1.5 text-sm leading-snug text-ink-muted">
      {text}
    </p>
  );
}
