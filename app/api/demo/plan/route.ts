import { getDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { logDays } from "@/lib/store/log";
import { clearPlan } from "@/lib/store/plan";

import { refuseOutsideDemo } from "../demo-only";

// Clearing the stored plan without clearing anything else.
//
// The seed is a total reset — plan, clock and log together — which is right
// between takes and wrong for the opening shot. The film opens on an account
// with no letter read yet, so home leads with "take a photo of your letter" and
// the plan appears on camera through the real upload → extract → writePlan
// path. But the escalation beat later in the same take needs the two primed
// misses to already be on the record, and the timeline needs the clock parked
// two days after discharge. Priming the history without the plan is the one
// state neither the seed nor a product screen can reach.
//
// It is a delete of one key, not a mode: `readPlan` returns null for an account
// that never had a letter and for one cleared here, and every screen already
// names that state. Nothing downstream can tell the two apart, which is what
// makes it a real state rather than a painted one [Locked D9].
export async function DELETE() {
  const refusal = refuseOutsideDemo();
  if (refusal !== null) return refusal;

  await clearPlan(DEMO_PATIENT_ID);

  // Read back after the delete rather than reporting what was intended. The
  // whole claim of this control is that the history and the clock survive it,
  // and the panel prints this body verbatim — so it says which days are still
  // there, by name, the way the seed names the days it removed.
  const [today, keptLogDays] = await Promise.all([
    getDemoToday(),
    logDays(DEMO_PATIENT_ID),
  ]);

  return Response.json({ plan: null, today, keptLogDays });
}
