import { z } from "zod";

import { extractBundle, UploadedDocument } from "@/lib/extraction/extract";
import { writePlan } from "@/lib/store/plan";

const Body = z.object({
  patientId: z.string().min(1),
  documents: z.array(UploadedDocument).min(1),
});

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json());
  if (!body.success) {
    return Response.json(
      { message: "That request did not name any uploaded pages." },
      { status: 400 },
    );
  }

  const result = await extractBundle(body.data.documents);

  // Both 422s, both named. A failed extraction never falls through to a stored
  // plan, a partial plan, or the demo seed — the patient is told the letter was
  // not read rather than shown a plan that might be wrong.
  switch (result.kind) {
    case "unreadable":
      return Response.json(
        {
          message: `We could not find a discharge letter in those pages. ${result.detail}`,
          surface: "no-object-generated",
        },
        { status: 422 },
      );
    case "invalid":
      return Response.json(
        {
          message: `We read those pages but what came back does not hold together, so we have not saved it. ${result.detail}`,
          surface: "bundle-validation",
        },
        { status: 422 },
      );
    case "extracted":
      await writePlan(body.data.patientId, result.bundle);
      return Response.json({
        patientId: body.data.patientId,
        modelId: result.bundle.extraction.modelId,
        medications: result.bundle.medications.length,
        redFlags: result.bundle.redFlags.length,
        unresolved: result.bundle.extraction.unresolved.length,
      });
  }
}
