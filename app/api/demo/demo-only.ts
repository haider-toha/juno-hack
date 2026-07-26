import { env } from "@/lib/env";

// The operator panel writes real state through real code paths, but every one
// of those writes is a thing no product screen offers — moving the clock,
// answering for someone, ringing a check-in. In live mode they would be
// unexplained changes to a real patient's record with no badge on screen saying
// where they came from. So the whole surface is refused outside demo mode, and
// says so [Locked D9].
//
// Returns null when the request may proceed.
export function refuseOutsideDemo(): Response | null {
  if (env.NEXT_PUBLIC_PORTICO_MODE === "demo") return null;
  return Response.json(
    {
      message: `The operator controls only exist in demo mode, and this app is running in ${env.NEXT_PUBLIC_PORTICO_MODE} mode.`,
    },
    { status: 403 },
  );
}
