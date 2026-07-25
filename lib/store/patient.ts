import "server-only";

import { z } from "zod";

import { patientKey } from "./keys";
import { redis } from "./redis";

// Who the app is talking to, and who it escalates to — separate from the
// extracted bundle because it outlives any single letter. Deliberately tiny:
// the letter's surname, date of birth, NHS number and address are read during
// extraction and never stored.
export const PatientRecord = z.object({
  id: z.string(),
  givenName: z.string().nullable(),
  nextOfKin: z
    .object({
      // The letter says "Daughter" and never names her. Storing the
      // relationship as written, with a null name, keeps that honest.
      relationshipVerbatim: z.string().min(1),
      name: z.string().nullable(),
      phone: z.string().nullable(),
    })
    .nullable(),
});

export type PatientRecord = z.infer<typeof PatientRecord>;

export async function readPatient(
  patientId: string,
): Promise<PatientRecord | null> {
  const stored = await redis().get<unknown>(patientKey(patientId));
  return stored === null ? null : PatientRecord.parse(stored);
}

export async function writePatient(record: PatientRecord): Promise<void> {
  await redis().set(patientKey(record.id), record);
}
