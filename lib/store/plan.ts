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
