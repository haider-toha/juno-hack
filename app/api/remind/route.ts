import { z } from "zod";

import { toolEnv } from "@/lib/env";
import type { ExtractedBundle } from "@/lib/plan/schema";
import { getDemoToday } from "@/lib/store/clock";
import { readPlan } from "@/lib/store/plan";
import { writeReminder } from "@/lib/store/reminder";

// The `schedule_reminder` server tool. ElevenLabs' backend calls this when the
// person says they will do a still-due plan step later today — a medicine or a
// patient care step. It stores a real reminder the summary and the dose-nudge
// push read — it does not fire a notification itself. The operator rings that
// later, the same way the check-in is rung [Locked D9].
const Input = z.object({
  patient_id: z.string().min(1),
  check_in_id: z.string().min(1),
  item_id: z.string().min(1),
  // 24-hour local time the person named. "ten tonight" → "22:00".
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const HEADER = "x-portico-tool-secret";

export async function POST(request: Request) {
  if (request.headers.get(HEADER) !== toolEnv().PORTICO_TOOL_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_arguments", detail: parsed.error.message },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const [today, bundle] = await Promise.all([
    getDemoToday(),
    readPlan(input.patient_id),
  ]);
  if (bundle === null) {
    return Response.json({ error: "no_plan_stored" }, { status: 409 });
  }

  const step = remindableStep(bundle, input.item_id);
  if (step === null) {
    return Response.json(
      { error: "unknown_item", item_id: input.item_id },
      { status: 422 },
    );
  }

  await writeReminder({
    id: `remind:${input.patient_id}:${input.item_id}:${today}`,
    patientId: input.patient_id,
    itemId: input.item_id,
    day: today,
    timeLocal: input.time,
    nameAsWritten: step.name,
    source: { kind: "voice", checkInId: input.check_in_id },
    at: new Date().toISOString(),
  });

  return Response.json({
    ok: true,
    item_id: step.id,
    day: today,
    time: input.time,
    // The one sentence the agent may promise. It does not claim a push has
    // already landed — only that a nudge is set for that time.
    tell_the_patient: `A nudge is set for ${spokenTime(input.time)}.`,
  });
}

function remindableStep(
  bundle: ExtractedBundle,
  itemId: string,
): { id: string; name: string } | null {
  const medication = bundle.medications.find((item) => item.id === itemId);
  if (medication !== undefined) {
    return { id: medication.id, name: medication.nameAsWritten };
  }

  // Same tickable surface as the plan: patient care steps can be nudged too.
  // GP/carer instructions are not the patient's job, so they stay out.
  const instruction = bundle.instructions.find((item) => item.id === itemId);
  if (instruction !== undefined && instruction.actor === "patient") {
    return {
      id: instruction.id,
      name: instruction.titlePlain ?? instruction.detailVerbatim,
    };
  }

  return null;
}

function spokenTime(timeLocal: string): string {
  const [hourPart, minutePart] = timeLocal.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const period = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  if (minute === 0) return `${twelve} ${period}`;
  return `${twelve}:${minutePart} ${period}`;
}
