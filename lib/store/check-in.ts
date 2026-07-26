import "server-only";

import { z } from "zod";

import { incomingCheckInKey } from "./keys";
import { redis } from "./redis";

// Whether a check-in is currently ringing on the patient's phone. The operator
// raises it, the phone polls for it, and answering clears it — the same three
// moves a due-time scheduler would make, which is why the card is driven by
// this state and not by a timer [Locked D9]: the phone is showing something
// that genuinely exists in the store.
//
// It expires on its own so a rehearsal that ends mid-call does not leave the
// next take ringing.
const TTL_SECONDS = 15 * 60;

const RaisedAt = z.iso.datetime();

export async function raiseCheckIn(patientId: string): Promise<string> {
  const at = new Date().toISOString();
  await redis().set(incomingCheckInKey(patientId), at, { ex: TTL_SECONDS });
  return at;
}

export async function clearCheckIn(patientId: string): Promise<void> {
  await redis().del(incomingCheckInKey(patientId));
}

// Null means nothing is ringing. A stored value that is not a timestamp is
// corruption and throws here rather than rendering as a card with no cause.
export async function readIncomingCheckIn(
  patientId: string,
): Promise<string | null> {
  const stored = await redis().get<unknown>(incomingCheckInKey(patientId));
  return stored === null ? null : RaisedAt.parse(stored);
}
