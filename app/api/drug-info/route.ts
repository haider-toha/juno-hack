import { lookupDrug } from "@/lib/drugs/lookup";
import { readPlan } from "@/lib/store/plan";

// Medicine guidance for a drug the patient is actually on. The guard is the
// scope line: this is not an open drug lookup, so a name that is not in this
// patient's own stored plan 404s rather than being resolved.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const patientId = url.searchParams.get("patientId");
  const name = url.searchParams.get("name");
  if (patientId === null || name === null) {
    return Response.json(
      { message: "Ask for a patient and a medicine name." },
      { status: 400 },
    );
  }

  const bundle = await readPlan(patientId);
  const medication = bundle?.medications.find(
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

  // A device with no drug behind it — TED stockings, a dressing — has nothing
  // on the medicines A-Z, and saying so is different from failing to look.
  if (medication.lookupKey === null) {
    return Response.json({ kind: "absent" });
  }

  return Response.json(await lookupDrug(medication.lookupKey.normalisedName));
}
