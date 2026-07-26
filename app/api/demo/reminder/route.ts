import { z } from "zod";

import { getDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import {
  clearNudge,
  raiseNudge,
  readIncomingNudge,
  readReminders,
} from "@/lib/store/reminder";

import { refuseOutsideDemo } from "../demo-only";

// Scheduled dose nudges as three verbs: the phone GETs to see what is set and
// whether one is ringing, the operator POSTs to fire the push, and dismissing
// or opening the plan DELETEs the ring — same shape as /api/demo/check-in.

const RaiseBody = z.object({
  itemId: z.string().min(1).optional(),
});

export async function GET() {
  const refusal = refuseOutsideDemo();
  if (refusal !== null) return refusal;

  const today = await getDemoToday();
  const [reminders, raised] = await Promise.all([
    readReminders(DEMO_PATIENT_ID, today),
    readIncomingNudge(DEMO_PATIENT_ID),
  ]);
  return Response.json({ reminders, raised });
}

export async function POST(request: Request) {
  const refusal = refuseOutsideDemo();
  if (refusal !== null) return refusal;

  const body = RaiseBody.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return Response.json(
      { error: "invalid_arguments", detail: body.error.message },
      { status: 400 },
    );
  }

  const today = await getDemoToday();
  const reminders = await readReminders(DEMO_PATIENT_ID, today);
  const reminder =
    body.data.itemId === undefined
      ? reminders[0]
      : reminders.find((entry) => entry.itemId === body.data.itemId);

  if (reminder === undefined) {
    return Response.json({ error: "no_reminder_scheduled" }, { status: 409 });
  }

  const raised = await raiseNudge(reminder);
  return Response.json({ raised, reminders });
}

export async function DELETE() {
  const refusal = refuseOutsideDemo();
  if (refusal !== null) return refusal;

  await clearNudge(DEMO_PATIENT_ID);
  return Response.json({ raised: null });
}
