"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// The demo clock, as the two moves a rehearsal actually makes: step a day, or
// jump to one. A shift is computed on the server from the CURRENT demo day, so
// tapping "+1 day" twice quickly cannot land on the browser's idea of today.
export function ClockControl({ today }: { today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [day, setDay] = useState(today);

  async function post(payload: { day: string } | { shiftDays: number }) {
    await fetch("/api/demo/clock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="border-b border-rule py-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void post({ shiftDays: -1 })}
          className={STEP}
        >
          −1 day
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void post({ shiftDays: 1 })}
          className={STEP}
        >
          +1 day
        </button>
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="tnum min-h-11 rounded-tactile border border-rule bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void post({ day })}
          className={STEP}
        >
          Set
        </button>
      </div>
      <p className="mt-2 max-w-[60ch] text-sm text-ink-muted">
        Moves the whole app&apos;s sense of today. Every screen reads it from
        the same place, so the plan, the check-in and the family view all move
        together.
      </p>
    </div>
  );
}

const STEP =
  "min-h-11 rounded-tactile border border-rule bg-surface px-4 font-display text-base font-medium text-ink transition-colors duration-150 ease-out hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";
