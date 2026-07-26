import { z } from "zod";

import { getDemoToday, setDemoToday } from "@/lib/store/clock";
import { addDays } from "@/lib/timeline/schedule";

import { refuseOutsideDemo } from "../demo-only";

// Moving "today". A day-by-day recovery plan is not demonstrable inside a
// sixty-second video at real speed, and every date read in the app already
// takes `today` as a parameter sourced from `getDemoToday()` — so this moves
// the whole app at once rather than any one screen.
//
// Two shapes because the panel has both a date field and a pair of ±1 day
// buttons, and a shift has to be computed from the CURRENT demo day rather
// than from the browser's idea of it.
const Input = z.union([
  z.object({ day: z.iso.date() }),
  z.object({ shiftDays: z.number().int() }),
]);

export async function POST(request: Request) {
  const refusal = refuseOutsideDemo();
  if (refusal !== null) return refusal;

  const input = Input.parse(await request.json());
  const day =
    "day" in input ? input.day : addDays(await getDemoToday(), input.shiftDays);

  await setDemoToday(day);
  return Response.json({ today: day });
}

export async function GET() {
  const refusal = refuseOutsideDemo();
  if (refusal !== null) return refusal;

  return Response.json({ today: await getDemoToday() });
}
