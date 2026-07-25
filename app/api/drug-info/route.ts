import { z } from "zod";

import { lookupDrug } from "@/lib/drugs/lookup";
import { readPlan } from "@/lib/store/plan";

const Query = z.object({
  patientId: z.string().min(1),
  name: z.string().min(1),
});

// Medicine guidance for a drug the patient is actually on. The guard is the
// scope line: this is not an open drug lookup, so a name that is not in this
// patient's own stored plan 404s rather than being resolved.
export async function GET(request: Request) {
  const query = Query.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return Response.json(
      { message: "Ask for a patient and a medicine name." },
      { status: 400 },
    );
  }
  const { patientId, name } = query.data;

  // Kept apart from the drug-not-found 404 below. The voice agent speaks these
  // messages, and "we hold no plan for you" and "that drug is not on your plan"
  // are different sentences — collapsing them tells a patient with no plan at
  // all that a drug they are holding was left off it.
  const bundle = await readPlan(patientId);
  if (bundle === null) {
    return Response.json(
      { message: "We have no plan stored for this patient yet." },
      { status: 404 },
    );
  }

  const medication = bundle.medications.find(
    (candidate) =>
      candidate.nameAsWritten.toLowerCase() === name.toLowerCase() ||
      candidate.lookupKey?.normalisedName.toLowerCase() === name.toLowerCase(),
  );
  if (medication === undefined) {
    return Response.json(
      { message: `"${name}" is not on this plan.` },
      { status: 404 },
    );
  }

  // A device with no drug behind it — TED stockings, a dressing — is not a
  // medicine that the A-Z is missing, so it gets its own kind. `absent` would
  // render as "not in the NHS medicines A to Z", which is a claim about the
  // A-Z rather than about the thing on the plan.
  if (medication.lookupKey === null) {
    return Response.json({
      kind: "device",
      nameAsWritten: medication.nameAsWritten,
    });
  }

  return Response.json(await lookupDrug(medication.lookupKey.normalisedName));
}
