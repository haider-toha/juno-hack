import "server-only";

import { z } from "zod";

import { incomingNudgeKey, reminderKey } from "./keys";
import { redis } from "./redis";

// A dose nudge the agent promised during a check-in. Real state the summary
// and the phone banner read — not a timer painted on screen [Locked D9].
//
// `timeLocal` is 24-hour `HH:mm` in the patient's spoken local sense ("ten
// tonight" → "22:00"). The demo clock is day-grained, so the hour lives here
// as a label and as the copy the push uses when the operator fires it.
export const Reminder = z.object({
  id: z.string(),
  patientId: z.string(),
  itemId: z.string(),
  day: z.iso.date(),
  timeLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  nameAsWritten: z.string().min(1),
  source: z.object({
    kind: z.literal("voice"),
    checkInId: z.string(),
  }),
  at: z.iso.datetime({ offset: true }),
});

export type Reminder = z.infer<typeof Reminder>;

export const RaisedNudge = z.object({
  raisedAt: z.iso.datetime(),
  itemId: z.string(),
  timeLocal: z.string(),
  nameAsWritten: z.string(),
});

export type RaisedNudge = z.infer<typeof RaisedNudge>;

const TTL_SECONDS = 15 * 60;

// `(patientId, itemId, day)` replaces — asking twice for the same evening dose
// updates the time rather than stacking two nudges.
export async function writeReminder(reminder: Reminder): Promise<void> {
  await redis().hset(reminderKey(reminder.patientId, reminder.day), {
    [reminder.itemId]: reminder,
  });
}

export async function readReminders(
  patientId: string,
  day: string,
): Promise<Reminder[]> {
  const entries = await redis().hgetall<Record<string, unknown>>(
    reminderKey(patientId, day),
  );
  if (entries === null) return [];
  return Object.values(entries).map((value) => Reminder.parse(value));
}

export async function clearReminders(
  patientId: string,
  day: string,
): Promise<void> {
  await redis().del(reminderKey(patientId, day));
}

// Wipe every day this patient has a reminder on — same scan shape as clearLog,
// so a clock that moved forward cannot leave a stale evening nudge behind a
// seed.
export async function clearAllReminders(patientId: string): Promise<string[]> {
  const prefix = `portico:reminders:${patientId}:`;
  const keys: string[] = [];
  let cursor = "0";

  do {
    const [next, found] = await redis().scan(cursor, {
      match: `${prefix}*`,
      count: 200,
    });
    keys.push(...found);
    cursor = String(next);
  } while (cursor !== "0");

  if (keys.length > 0) await redis().del(...keys);
  await clearNudge(patientId);
  return keys;
}

export async function raiseNudge(reminder: Reminder): Promise<RaisedNudge> {
  const raised: RaisedNudge = {
    raisedAt: new Date().toISOString(),
    itemId: reminder.itemId,
    timeLocal: reminder.timeLocal,
    nameAsWritten: reminder.nameAsWritten,
  };
  await redis().set(incomingNudgeKey(reminder.patientId), raised, {
    ex: TTL_SECONDS,
  });
  return raised;
}

export async function clearNudge(patientId: string): Promise<void> {
  await redis().del(incomingNudgeKey(patientId));
}

export async function readIncomingNudge(
  patientId: string,
): Promise<RaisedNudge | null> {
  const stored = await redis().get<unknown>(incomingNudgeKey(patientId));
  return stored === null ? null : RaisedNudge.parse(stored);
}
