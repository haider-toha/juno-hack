import {
  clearCheckIn,
  raiseCheckIn,
  readIncomingCheckIn,
} from "@/lib/store/check-in";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";

import { refuseOutsideDemo } from "../demo-only";

// The raised check-in, as three verbs on one piece of state. The operator POSTs
// to ring it, the phone GETs to see whether it is ringing, and answering it
// DELETEs it — the same three moves a real due-time scheduler would make.
// Nothing here paints a card; it only records that one is owed.

export async function GET() {
  const refusal = refuseOutsideDemo();
  if (refusal !== null) return refusal;

  const at = await readIncomingCheckIn(DEMO_PATIENT_ID);
  return Response.json({ raisedAt: at });
}

export async function POST() {
  const refusal = refuseOutsideDemo();
  if (refusal !== null) return refusal;

  const at = await raiseCheckIn(DEMO_PATIENT_ID);
  return Response.json({ raisedAt: at });
}

export async function DELETE() {
  const refusal = refuseOutsideDemo();
  if (refusal !== null) return refusal;

  await clearCheckIn(DEMO_PATIENT_ID);
  return Response.json({ raisedAt: null });
}
