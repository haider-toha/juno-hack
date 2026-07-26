import { ClockControl } from "@/components/operator/clock-control";
import { Control } from "@/components/operator/control";
import { env } from "@/lib/env";
import { assess, assessmentWindow } from "@/lib/escalation/rules";
import { formatLocalTime } from "@/lib/format-time";
import { readIncomingCheckIn } from "@/lib/store/check-in";
import { getDemoToday } from "@/lib/store/clock";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";
import { readLog } from "@/lib/store/log";
import { readPlan } from "@/lib/store/plan";
import { readIncomingNudge, readReminders } from "@/lib/store/reminder";
import { addDays } from "@/lib/timeline/schedule";

export const metadata = { title: "Operator", robots: { index: false } };

// Reads live state on every request, which is the only way a control surface is
// worth anything between takes.
export const dynamic = "force-dynamic";

// The demo control panel. It lives OUTSIDE the `(phone)` route group, so it
// gets the root layout and none of the phone shell's constraints — it is a
// laptop screen the operator drives while the phone shows Portico. It is never
// linked from a product screen.
//
// The rule that keeps it honest [Locked D9]: it may only do things a real user
// could do, faster. Every button writes real state through the same functions
// the product uses — `appendLogEntry()`, `setDemoToday()`, the seed route — and
// then this page re-reads that state. Nothing here paints a result.
export default async function OperatorPage() {
  const [today, bundle, incomingAt, nudgeAt] = await Promise.all([
    getDemoToday(),
    readPlan(DEMO_PATIENT_ID),
    readIncomingCheckIn(DEMO_PATIENT_ID),
    readIncomingNudge(DEMO_PATIENT_ID),
  ]);
  const [logs, reminders] = await Promise.all([
    bundle === null
      ? Promise.resolve([])
      : readLog(DEMO_PATIENT_ID, assessmentWindow(today)),
    readReminders(DEMO_PATIENT_ID, today),
  ]);
  const assessment = bundle === null ? null : assess(bundle, logs, today);

  // The one the escalation rule is written about. Naming it here rather than
  // hardcoding an id keeps the panel correct if the demo letter changes.
  const highStakes =
    bundle?.medications.filter(
      (medication) => medication.escalationClass === "high_stakes",
    ) ?? [];

  return (
    <main className="mx-auto max-w-3xl px-8 py-10">
      <header className="border-b border-rule pb-6">
        <p className="text-sm font-medium tracking-wide text-ink-faint">
          Operator — not part of the product
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
          Portico demo controls
        </h1>
        <p className="mt-2 max-w-[70ch] text-base leading-relaxed text-ink-muted">
          Every button writes real state through the same code the app uses. It
          does what a real user could do, faster. Nothing here renders a result
          that something else did not produce.
        </p>
      </header>

      <Section title="State">
        <Row label="Mode">
          {env.NEXT_PUBLIC_PORTICO_MODE}
          {env.NEXT_PUBLIC_PORTICO_MODE === "demo" ? null : (
            <span className="ml-2 text-ink-muted">
              — these controls are refused outside demo mode
            </span>
          )}
        </Row>
        <Row label="Today">{today}</Row>
        <Row label="Patient">{DEMO_PATIENT_ID}</Row>
        <Row label="Plan">
          {bundle === null
            ? "none stored — home falls back to its empty state"
            : `${bundle.medications.length} medicines, ${bundle.redFlags.length} red flag(s)`}
        </Row>
        <Row label="Check-in raised">{incomingAt ?? "no"}</Row>
        <Row label="Dose nudge raised">
          {nudgeAt === null
            ? "no"
            : `${nudgeAt.nameAsWritten} · ${formatLocalTime(nudgeAt.timeLocal, "en")}`}
        </Row>
        <Row label="Reminders today">
          {reminders.length === 0
            ? "none"
            : reminders
                .map(
                  (reminder) =>
                    `${reminder.nameAsWritten} @ ${formatLocalTime(reminder.timeLocal, "en")}`,
                )
                .join(" · ")}
        </Row>
        <Row label="assess()">
          {assessment === null
            ? "n/a"
            : assessment.kind === "none"
              ? "none"
              : `${assessment.kind} — ${assessment.name} (${assessment.missedDays.join(", ")})`}
        </Row>
        {/* No <code> here on purpose: the browser's default monospace is the
            one typeface this project bans outright, and this page is in shot if
            the camera ever widens. The variable name carries itself. */}
        <p className="pt-3 max-w-[70ch] text-sm leading-snug text-ink-muted">
          NEXT_PUBLIC_PORTICO_MODE is baked into the client bundle at build
          time, so there is no honest way to flip it from this page — a switch
          here would change a label and nothing else. Change it in the .env file
          and restart the server.
        </p>
      </Section>

      <Section title="1 · Set the stage">
        <Control
          label="Reset to the seeded state"
          hint="Re-runs POST /api/seed: the Whitfield plan, his daughter as next of kin, the clock parked 2 days after discharge, and two missed apixaban doses already on the record. Use this between takes."
          path="/api/seed"
          tone="primary"
        />
        {/* The opening shot. Seed first, then this: the take starts on an
            account with no letter read, and the plan arrives on camera through
            the real upload. Destructive and irreversible from here — only the
            seed or a real extraction puts a plan back. */}
        <Control
          label="Clear the letter — delete the stored plan"
          hint="DELETEs /api/demo/plan. The plan goes and does not come back from this page: home falls back to 'take a photo of your letter', /plan and /family say no plan is loaded. KEPT: the two missed apixaban doses, every other answer, the demo clock, the next of kin. So the letter can be photographed on camera and the escalation still lands later in the same take. Reset, then this, then roll."
          method="DELETE"
          path="/api/demo/plan"
          tone="destructive"
        />
      </Section>

      <Section title="2 · Clock">
        <ClockControl today={today} />
      </Section>

      <Section title="3 · Answer for a step">
        {bundle === null ? (
          <p className="py-4 text-base text-ink-muted">
            No plan stored. Run the seed first.
          </p>
        ) : (
          highStakes.map((medication) => (
            <div key={medication.id}>
              <Control
                label={`Mark ${medication.nameAsWritten} MISSED yesterday`}
                hint={`Writes a real LogEntry for ${addDays(today, -1)} through appendLogEntry(), the same function the voice tool and the timeline tick use. Two of these inside 3 days is what assess() turns into alert-kin.`}
                path="/api/demo/log"
                body={{
                  itemId: medication.id,
                  day: addDays(today, -1),
                  status: "missed",
                }}
              />
              <Control
                label={`Mark ${medication.nameAsWritten} TAKEN yesterday`}
                hint={`Replaces yesterday's answer rather than deleting it — (patient, item, day) is the idempotency key. With one of the two seeded misses answered, assess() drops from alert-kin to nudge. Reset is the only way back to a clean slate.`}
                path="/api/demo/log"
                body={{
                  itemId: medication.id,
                  day: addDays(today, -1),
                  status: "taken",
                }}
              />
              <Control
                label={`Mark ${medication.nameAsWritten} TAKEN today`}
                hint="What the patient answering the check-in honestly would write."
                path="/api/demo/log"
                body={{ itemId: medication.id, day: null, status: "taken" }}
              />
            </div>
          ))
        )}
      </Section>

      <Section title="4 · Check-in">
        <Control
          label="Ring the check-in on the phone"
          hint="Sets real state in Redis. The phone parked on /check-in polls every 5 seconds and flips to the incoming card. Answering it clears the flag."
          path="/api/demo/check-in"
          tone="primary"
        />
        <Control
          label="Cancel the ringing check-in"
          method="DELETE"
          path="/api/demo/check-in"
        />
      </Section>

      <Section title="5 · Dose nudge">
        <Control
          label="Fire the scheduled dose nudge"
          hint="Rings the phone with the first reminder schedule_reminder wrote today — usually the nocte dose the person said they would take later. Opens /plan when tapped."
          path="/api/demo/reminder"
          tone="primary"
        />
        <Control
          label="Cancel the ringing dose nudge"
          method="DELETE"
          path="/api/demo/reminder"
        />
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 border-b border-rule py-2 last:border-b-0">
      <span className="w-40 shrink-0 text-base text-ink-muted">{label}</span>
      <span className="tnum text-base text-ink">{children}</span>
    </div>
  );
}
