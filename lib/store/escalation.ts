import "server-only";

import { z } from "zod";

import { escalationKey } from "./keys";
import { redis } from "./redis";

// A note left for the next of kin during a check-in. Written by
// `/api/escalate` and read by `assess()` — an explicit escalation in the
// window triggers alert-kin immediately, without waiting for a second miss.
export const EscalationRecord = z.object({
  id: z.string(),
  patientId: z.string(),
  itemId: z.string(),
  day: z.iso.date(),
  reason: z.string(),
  checkInId: z.string(),
  at: z.iso.datetime({ offset: true }),
});

export type EscalationRecord = z.infer<typeof EscalationRecord>;

export async function recordEscalation(
  record: EscalationRecord,
): Promise<void> {
  await redis().hset(escalationKey(record.patientId, record.day), {
    [record.itemId]: record,
  });
}

export async function escalationDays(patientId: string): Promise<string[]> {
  const prefix = escalationKey(patientId, "");
  const days: string[] = [];
  let cursor = "0";

  do {
    const [next, keys] = await redis().scan(cursor, {
      match: `${prefix}*`,
      count: 200,
    });
    days.push(...keys.map((key) => key.slice(prefix.length)));
    cursor = String(next);
  } while (cursor !== "0");

  return days.sort();
}

export async function clearEscalations(patientId: string): Promise<string[]> {
  const keys = (await escalationDays(patientId)).map((day) =>
    escalationKey(patientId, day),
  );
  if (keys.length > 0) await redis().del(...keys);
  return keys;
}

export async function readEscalations(
  patientId: string,
  days: readonly string[],
): Promise<EscalationRecord[]> {
  const perDay = await Promise.all(
    days.map((day) =>
      redis().hgetall<Record<string, unknown>>(escalationKey(patientId, day)),
    ),
  );

  return perDay.flatMap((entries) =>
    entries === null
      ? []
      : Object.values(entries).map((v) => EscalationRecord.parse(v)),
  );
}
