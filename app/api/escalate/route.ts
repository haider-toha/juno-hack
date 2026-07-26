import { z } from "zod";

import { toolEnv } from "@/lib/env";
import { getDemoToday } from "@/lib/store/clock";
import { appendLogEntry } from "@/lib/store/log";
import { readPatient } from "@/lib/store/patient";
import { readPlan } from "@/lib/store/plan";

// The `escalate_to_next_of_kin` server tool. It records that a step the plan
// marks as important could not be done, as a real `LogEntry` through the same
// `appendLogEntry()` every other write path uses — and then stops.
//
// It does NOT decide that an escalation has happened. `assess()` reads the log
// and works that out on `/family`, which is why the family dashboard can say
// "missed twice in 3 days" and mean it. If this route set an "escalated" flag
// instead, the card would be repeating a model's judgement back to a relative
// [Locked D9].
//
// Nothing here calls, texts or emails anyone. The response says so, so the
// agent has nothing to overstate.
const Input = z.object({
  patient_id: z.string().min(1),
  check_in_id: z.string().min(1),
  item_id: z.string().min(1),
  reason: z.string().min(1),
});

// ElevenLabs resolves this header server-side from a workspace secret
// (`request_headers` + `secret_id`), so the value never reaches the browser.
const HEADER = "x-portico-tool-secret";

export async function POST(request: Request) {
  if (request.headers.get(HEADER) !== toolEnv().PORTICO_TOOL_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Same as `/api/log`: a non-JSON body is a client mistake, not a server
  // fault, so it reaches the named 400 rather than throwing into a bare 500.
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_arguments", detail: parsed.error.message },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const [today, bundle, patient] = await Promise.all([
    getDemoToday(),
    readPlan(input.patient_id),
    readPatient(input.patient_id),
  ]);
  if (bundle === null) {
    return Response.json({ error: "no_plan_stored" }, { status: 409 });
  }

  const medication = bundle.medications.find(
    (item) => item.id === input.item_id,
  );
  if (medication === undefined) {
    return Response.json(
      { error: "unknown_medication", item_id: input.item_id },
      { status: 422 },
    );
  }

  await appendLogEntry({
    id: `voice:${input.patient_id}:${input.item_id}:${today}`,
    patientId: input.patient_id,
    itemId: input.item_id,
    day: today,
    status: "missed",
    source: { kind: "voice", checkInId: input.check_in_id },
    at: new Date().toISOString(),
  });

  // The letter names the relationship and never the daughter, so the agent is
  // handed the relationship word and nothing else to embellish with.
  return Response.json({
    ok: true,
    item_id: medication.id,
    day: today,
    recorded_as: "missed",
    next_of_kin: patient?.nextOfKin?.relationshipVerbatim ?? null,
    // The one sentence the agent may promise. Anything stronger would be a
    // claim about a message nobody sent.
    tell_the_patient:
      "A note has been left on the family view. Nobody has been called or messaged.",
  });
}
