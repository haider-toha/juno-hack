import "server-only";

import { z } from "zod";

import { logKey } from "./keys";
import { redis } from "./redis";

// The adherence log — the SECOND shared contract, and the `/api/log` wire
// format. Two tracks write it (a voice tool call, and a manual tick on the
// timeline) and two read it (`/plan` and the family dashboard's `assess()`).
// Frozen with `lib/plan/schema.ts`: changing it invalidates stored entries and
// forces a reseed on both tracks.
//
// The two writers differ in exactly one way, so `source` is a discriminated
// union rather than a nullable `checkInId` hanging off the root: a voice write
// can always name the call it came from, and a manual tick never can.
export const LogEntry = z.object({
  id: z.string(),
  patientId: z.string(),
  itemId: z.string(), // a medication or instruction id from ExtractedBundle
  day: z.iso.date(), // the plan day this entry answers, not the write time
  status: z.enum(["taken", "missed"]),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("voice"), checkInId: z.string() }),
    z.object({ kind: z.literal("manual") }),
  ]),
  at: z.iso.datetime({ offset: true }),
});

export type LogEntry = z.infer<typeof LogEntry>;

// `(patientId, itemId, day)` is the idempotency key: a second answer about the
// same item on the same day REPLACES the first. Asking twice in one check-in,
// or ticking a row the agent already logged, must not double-count into an
// escalation. Both write paths — the voice tool and the manual tick — come
// through here, so there is one place that rule lives.
export async function appendLogEntry(entry: LogEntry): Promise<void> {
  const valid = LogEntry.parse(entry);
  await redis().hset(logKey(valid.patientId, valid.day), {
    [valid.itemId]: valid,
  });
}

// Reads whichever days the caller asks for: `/plan` passes one, the family
// dashboard passes a recent window. Every value is parsed — a corrupt entry
// throws here rather than surfacing as `undefined` inside an escalation rule.
export async function readLog(
  patientId: string,
  days: readonly string[],
): Promise<LogEntry[]> {
  const perDay = await Promise.all(
    days.map((day) =>
      redis().hgetall<Record<string, unknown>>(logKey(patientId, day)),
    ),
  );

  return perDay.flatMap((entries) =>
    entries === null
      ? []
      : Object.values(entries).map((v) => LogEntry.parse(v)),
  );
}
