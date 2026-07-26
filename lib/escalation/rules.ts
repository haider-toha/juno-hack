import type { ExtractedBundle, Medication } from "@/lib/plan/schema";
import type { LogEntry } from "@/lib/store/log";
import { addDays } from "@/lib/timeline/schedule";

// The escalation threshold, and the only place it exists. Not in the system
// prompt, not in a tool handler, not on the family screen: the agent reports
// events, the tools record them, and this function alone decides what a run of
// events means. That is what makes the claim on the family dashboard something
// the app computed rather than something a model said.
//
// Pure, and importing nothing `server-only`, so a future tool handler can call
// it on the same terms `/family` does. `today` is a parameter — the demo clock
// moves the whole app's sense of now by supplying a different argument.

// Missed twice inside this many days, counting today, raises the alert.
const WINDOW_DAYS = 3;
const ALERT_MISSES = 2;

export type Assessment =
  | { kind: "none" }
  | { kind: "nudge"; medicationId: string; name: string; missedDays: string[] }
  | {
      kind: "alert-kin";
      medicationId: string;
      name: string;
      missedDays: string[];
    };

export function assess(
  bundle: ExtractedBundle,
  logs: readonly LogEntry[],
  today: string,
): Assessment {
  const window = new Set(
    Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(today, -i)),
  );

  // Only an explicit "missed" answer counts. A day with no entry is a day
  // nobody has answered for yet, and treating silence as a missed dose would
  // manufacture the escalation this function exists to detect honestly.
  const missedByMedication = new Map<string, string[]>();
  for (const entry of logs) {
    if (entry.status !== "missed") continue;
    if (!window.has(entry.day)) continue;
    const days = missedByMedication.get(entry.itemId) ?? [];
    if (!days.includes(entry.day)) days.push(entry.day);
    missedByMedication.set(entry.itemId, days);
  }

  const byId = new Map(bundle.medications.map((m) => [m.id, m]));

  let worstNudge: { medication: Medication; missedDays: string[] } | null =
    null;

  for (const [itemId, missedDays] of missedByMedication) {
    const medication = byId.get(itemId);
    // Instructions and appointments can be missed too, but the threshold is
    // written about medicines and the card names a dose. A missed dressing
    // change is real and belongs on the plan screen, not in the alert.
    if (medication === undefined) continue;

    missedDays.sort();

    if (
      medication.escalationClass === "high_stakes" &&
      missedDays.length >= ALERT_MISSES
    ) {
      return {
        kind: "alert-kin",
        medicationId: medication.id,
        name: medication.nameAsWritten,
        missedDays,
      };
    }

    if (worstNudge === null || missedDays.length > worstNudge.missedDays.length)
      worstNudge = { medication, missedDays };
  }

  if (worstNudge === null) return { kind: "none" };
  return {
    kind: "nudge",
    medicationId: worstNudge.medication.id,
    name: worstNudge.medication.nameAsWritten,
    missedDays: worstNudge.missedDays,
  };
}

// The days `assess` reads, so every caller asks Redis for exactly the window
// the rule uses instead of guessing at it.
export function assessmentWindow(today: string): string[] {
  return Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(today, -i));
}
