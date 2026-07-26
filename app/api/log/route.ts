import { z } from "zod";

import { toolEnv } from "@/lib/env";
import type { ExtractedBundle } from "@/lib/plan/schema";
import { getDemoToday } from "@/lib/store/clock";
import { appendLogEntry } from "@/lib/store/log";
import { readPlan } from "@/lib/store/plan";

// The `log_step` server tool. ElevenLabs' backend calls this — not the browser.
// The manual tick on the timeline uses the Server Action in
// `app/(phone)/plan/actions.ts` instead, because a browser leaf cannot hold
// this route's shared secret without shipping it in the client bundle. Two
// callers, two trust models, one `appendLogEntry()` [C7].
//
// `patient_id` and `check_in_id` are bound as dynamic variables in the agent's
// tool config, so the model never fills them: it cannot log against a patient
// it invented. `day` is not in the schema at all — the server takes it from the
// demo clock, which removes a whole class of hallucinated dates and keeps the
// entry on the same day every screen is rendering.
//
// snake_case on the wire because that is what the tool config sends; the field
// names here ARE the contract a human pastes into the ElevenLabs dashboard.
const Input = z.object({
  patient_id: z.string().min(1),
  check_in_id: z.string().min(1),
  item_id: z.string().min(1),
  status: z.enum(["taken", "missed"]),
});

// ElevenLabs resolves this header server-side from a workspace secret
// (`request_headers` + `secret_id`), so the value never reaches the browser.
// A `secret__`-prefixed dynamic variable would NOT do: dynamic variables are
// sent FROM the browser inside conversation_initiation_client_data, and the
// prefix only hides the value from the LLM [C7].
const HEADER = "x-portico-tool-secret";

export async function POST(request: Request) {
  if (request.headers.get(HEADER) !== toolEnv().PORTICO_TOOL_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // The read is inside the boundary it is validated at. A body that is not JSON
  // at all is the same client mistake as JSON of the wrong shape, and has to
  // reach the same named 400 — an unhandled throw here is a bare 500 with an
  // empty body, which tells whoever is debugging the tool call nothing.
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

  // The id came out of a language model reading a list in its prompt. Checking
  // it against the stored plan is the boundary, not defensiveness: an id that
  // is not in the bundle would write a log row nothing renders and nothing can
  // ever clear.
  if (!isPlanItem(bundle, input.item_id)) {
    return Response.json(
      { error: "unknown_item", item_id: input.item_id },
      { status: 422 },
    );
  }

  await appendLogEntry({
    id: `voice:${input.patient_id}:${input.item_id}:${today}`,
    patientId: input.patient_id,
    itemId: input.item_id,
    day: today,
    status: input.status,
    source: { kind: "voice", checkInId: input.check_in_id },
    at: new Date().toISOString(),
  });

  // Deliberately thin. The agent gets a confirmation it can speak in its own
  // words, and no hint about what a run of misses means — that threshold lives
  // in `lib/escalation/rules.ts` and nowhere else.
  return Response.json({ ok: true, item_id: input.item_id, day: today });
}

function isPlanItem(bundle: ExtractedBundle, id: string): boolean {
  return (
    bundle.medications.some((item) => item.id === id) ||
    bundle.instructions.some((item) => item.id === id) ||
    bundle.appointments.some((item) => item.id === id)
  );
}
