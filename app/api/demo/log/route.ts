import { z } from "zod";

import { getDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { appendLogEntry } from "@/lib/store/log";

import { refuseOutsideDemo } from "../demo-only";

// Answering for a step without waiting for the day it falls on. This is the
// panel's one genuinely load-bearing control: the escalation rule needs two
// misses in three days, which would otherwise take three real days to accrue.
//
// It writes a real `LogEntry` through the same `appendLogEntry()` the voice
// tool and the manual tick use, so `assess()` genuinely returns `alert-kin` and
// `/family` genuinely escalates. Nothing downstream can tell which of the three
// callers wrote it, which is the point [Locked D9].
const Input = z.object({
  itemId: z.string().min(1),
  // Omitted means today on the demo clock. The panel's common case is "mark
  // yesterday's dose missed", so the day is explicit there.
  day: z.iso.date().nullable(),
  status: z.enum(["taken", "missed"]),
});

export async function POST(request: Request) {
  const refusal = refuseOutsideDemo();
  if (refusal !== null) return refusal;

  const input = Input.parse(await request.json());
  const day = input.day ?? (await getDemoToday());

  await appendLogEntry({
    // Deterministic and matching the (patientId, itemId, day) idempotency key,
    // so tapping the same button twice replaces rather than double-counts.
    id: `operator:${DEMO_PATIENT_ID}:${input.itemId}:${day}`,
    patientId: DEMO_PATIENT_ID,
    itemId: input.itemId,
    day,
    status: input.status,
    source: { kind: "manual" },
    at: new Date().toISOString(),
  });

  return Response.json({ itemId: input.itemId, day, status: input.status });
}
