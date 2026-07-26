import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { put } from "@vercel/blob";

import { blobEnv, env } from "@/lib/env";
import {
  DEMO_MISSED_ITEM_ID,
  DEMO_PATIENT,
  DEMO_PLAN,
} from "@/lib/plan/samples/demo-plan";
import { clearCheckIn } from "@/lib/store/check-in";
import { setDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { appendLogEntry, clearLog } from "@/lib/store/log";
import { writePatient } from "@/lib/store/patient";
import { writePlan } from "@/lib/store/plan";
import { addDays } from "@/lib/timeline/schedule";

// Two days after discharge. The primed misses have to fall on days the patient
// was actually at home, and the letter's two-day antibiotic course has to have
// run its course — on the real calendar the demo clock would otherwise put both
// before he left the ward.
const DEMO_DAYS_SINCE_DISCHARGE = 2;

// The letters the demo plan quotes. `DEMO_PLAN` already names where each one
// lives in the store and each store pathname ends in the filename of the
// fixture it was transcribed from, so both are read off the bundle rather than
// repeated here — a seed that drifts from the plan it seeds is the bug.
const DEMO_LETTERS = DEMO_PLAN.documents.map(
  (document) => document.blobPathname,
);
const FIXTURES = join(process.cwd(), "fixtures/discharge-summaries");

// Resets the demo to a known state: the Whitfield plan, his daughter as next of
// kin, the clock parked on a day where the plan has history, and two missed
// doses of a high-stakes anticoagulant already on the record. The escalation is
// armed by real log entries that `assess()` computes over — it is not scripted,
// and it would otherwise take three real days to accrue.
export async function POST() {
  // The seed overwrites `portico:plan:demo`, which is the key a real uploaded
  // letter writes to. In live mode that would replace a patient's own extracted
  // plan with Harold Whitfield's, with nothing on screen saying so.
  if (env.NEXT_PUBLIC_PORTICO_MODE !== "demo") {
    return Response.json(
      {
        message: `The seed overwrites the stored plan with the demo bundle, and this app is running in ${env.NEXT_PUBLIC_PORTICO_MODE} mode, so it has not run.`,
      },
      { status: 403 },
    );
  }

  const today = addDays(
    DEMO_PLAN.episode.dischargeDate,
    DEMO_DAYS_SINCE_DISCHARGE,
  );
  await setDemoToday(today);

  // Clear before priming, so re-seeding is a reset rather than a merge with
  // whatever the last rehearsal left behind. `clearLog` scans instead of
  // clearing a window counted from today: the demo clock moves, so an answer
  // written while it was parked further forward is on a day no backwards window
  // reaches, and it would survive a "reset" and reach `assess()`.
  //
  // A raised check-in is cleared for the same reason — a take that ended
  // mid-call must not leave the next one already ringing.
  const [cleared] = await Promise.all([
    clearLog(DEMO_PATIENT_ID),
    clearCheckIn(DEMO_PATIENT_ID),
  ]);

  await Promise.all([
    writePlan(DEMO_PATIENT_ID, DEMO_PLAN),
    writePatient(DEMO_PATIENT),
    // The plan's source refs point at blobs. Without this the demo is only
    // half-seeded: on a fresh or rotated store, "tap to see where it says that"
    // 404s with nothing explaining why.
    ...DEMO_LETTERS.map(async (pathname) =>
      put(pathname, await readFile(join(FIXTURES, basename(pathname))), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/pdf",
        token: blobEnv().BLOB_READ_WRITE_TOKEN,
      }),
    ),
  ]);

  const missedDays = [addDays(today, -1), addDays(today, -2)];
  await Promise.all(
    missedDays.map((day) =>
      appendLogEntry({
        id: `seed-missed-${day}`,
        patientId: DEMO_PATIENT_ID,
        itemId: DEMO_MISSED_ITEM_ID,
        day,
        status: "missed",
        source: { kind: "manual" },
        at: `${day}T20:00:00+01:00`,
      }),
    ),
  );

  return Response.json({
    patientId: DEMO_PATIENT_ID,
    today,
    letters: DEMO_LETTERS,
    plan: DEMO_PLAN.extraction.modelId,
    medications: DEMO_PLAN.medications.length,
    redFlags: DEMO_PLAN.redFlags.length,
    missed: { itemId: DEMO_MISSED_ITEM_ID, days: missedDays },
    // Named, not counted: between takes the operator needs to see that the day
    // a previous rehearsal wrote to actually went.
    clearedLogDays: cleared,
  });
}
