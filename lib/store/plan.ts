import "server-only";

import { ExtractedBundle } from "@/lib/plan/schema";

import { planKey } from "./keys";
import { redis } from "./redis";

// A Redis read is a trust boundary — the value may have been written by an
// older schema, by the seed, or by hand. Parse on every read: a corrupt bundle
// throws here, naming the field, instead of surfacing as `undefined` three
// components deep on the plan screen.
//
// The read is annotated `<unknown>` deliberately. The command's default generic
// is `string`, but the client deserialises automatically, so typing it as
// `<ExtractedBundle>` would be a lie that makes skipping the parse look safe.
export async function readPlan(
  patientId: string,
): Promise<ExtractedBundle | null> {
  const stored = await redis().get<unknown>(planKey(patientId));
  return stored === null ? null : ExtractedBundle.parse(stored);
}

export async function writePlan(
  patientId: string,
  bundle: ExtractedBundle,
): Promise<void> {
  await redis().set(planKey(patientId), bundle);
}

// No plan stored is the state every real account is in before its first letter
// is read — `readPlan` already returns null for it and home, `/plan`, `/family`
// and `/check-in` all name it. So this deletes a key rather than setting an
// "empty" flag: the app cannot tell an account cleared here from one that never
// had a letter, which is what makes it a legitimate thing to reach for on
// camera [Locked D9].
//
// Only the plan. The adherence log, the patient record and the demo clock are
// keyed separately and survive, so a plan re-extracted from the letter on
// camera lands back on the history `assess()` was already computing over.
export async function clearPlan(patientId: string): Promise<void> {
  await redis().del(planKey(patientId));
}
