"use server";

import { z } from "zod";

import { appendLogEntry } from "@/lib/store/log";

// A manual tick on the timeline. It deliberately does NOT go through the voice
// tool's `/api/log`: that route authenticates with a header only ElevenLabs
// holds, and a browser leaf cannot send it without shipping the secret in the
// client bundle. Both write paths converge on `appendLogEntry` instead — one
// shared function, two callers, two trust models.
//
// Colocated here rather than in `app/actions/`, which the voice track owns.

const Input = z.object({
  patientId: z.string().min(1),
  itemId: z.string().min(1),
  day: z.iso.date(),
  status: z.enum(["taken", "missed"]),
});

export async function logStep(input: unknown): Promise<void> {
  const entry = Input.parse(input);
  await appendLogEntry({
    // Deterministic, matching the (patientId, itemId, day) idempotency key, so
    // answering twice about the same dose replaces rather than double-counts.
    id: `manual:${entry.patientId}:${entry.itemId}:${entry.day}`,
    ...entry,
    source: { kind: "manual" },
    at: new Date().toISOString(),
  });
}
