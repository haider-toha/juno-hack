"use client";

import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";

import { logStep } from "@/app/(phone)/plan/actions";
import { IconAlert, IconCheck } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n/en";
import type { LogEntry } from "@/lib/store/log";

type Status = LogEntry["status"];

// Its own slice of the dictionary rather than the whole `plan` section: this is
// the only thing on the timeline that crosses into the client bundle, and it
// repeats on every answerable row.
type Strings = Dictionary["plan"]["tick"];

type Props = {
  patientId: string;
  itemId: string;
  day: string;
  label: string;
  status: Status | null;
  t: Strings;
};

// The one client leaf in an otherwise server-rendered timeline. `useOptimistic`
// holds the tick for the life of the transition — the write and the refresh it
// triggers — and then drops it, so what stays on screen afterwards is the
// server's answer and never this component's memory of the tap. A failed write
// unwinds the same way: the tick goes back to what was last recorded rather
// than showing a tick for something that was never saved.
export function TaskCheck({ patientId, itemId, day, label, status, t }: Props) {
  const router = useRouter();
  const [shown, showOptimistically] = useOptimistic(status);
  const [failed, setFailed] = useState(false);

  const next: Status = shown === "taken" ? "missed" : "taken";

  function answer() {
    startTransition(async () => {
      showOptimistically(next);
      setFailed(false);
      try {
        await logStep({ patientId, itemId, day, status: next });
        router.refresh();
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <span className="flex flex-col items-center">
      <button
        type="button"
        onClick={answer}
        aria-label={describe(shown, label, t)}
        className="-m-2.5 flex size-11 items-center justify-center rounded-pill transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
      >
        <Mark status={shown} />
      </button>
      {/* On its own white chip because `error` is 4.29:1 on lavender and fails
          AA there — and lavender is today's card, where nearly every tick
          happens. On the white cards the chip is invisible. */}
      {failed ? (
        <span
          role="alert"
          className="mt-1 max-w-24 rounded-tactile bg-surface px-1.5 py-0.5 text-center text-sm font-medium leading-snug text-error"
        >
          {t.notSaved}
        </span>
      ) : null}
    </span>
  );
}

function Mark({ status }: { status: Status | null }) {
  switch (status) {
    case "taken":
      return (
        <span className="flex size-7 items-center justify-center rounded-pill bg-success text-ink-invert">
          <IconCheck className="size-4" />
        </span>
      );
    case "missed":
      return (
        <span className="flex size-7 items-center justify-center rounded-pill text-error">
          <IconAlert className="size-5" />
        </span>
      );
    // A 28px ring with a 2px edge in `ink-muted` (7.7:1 on today's lavender),
    // filled white so it reads as an empty box to be filled rather than as a
    // dot. It was 24px and 1px in `ink-faint`, which cleared the 3:1 a boundary
    // needs and nothing more — and this ring is the only thing on the row
    // saying there is a control here at all.
    case null:
      return (
        <span className="size-7 rounded-pill border-2 border-ink-muted bg-surface" />
      );
  }
}

// The label the caller passes is the medicine's own name off the letter, so the
// sentence around it is the only part that translates.
function describe(status: Status | null, label: string, t: Strings): string {
  switch (status) {
    case "taken":
      return t.taken.replace("{label}", label);
    case "missed":
      return t.missed.replace("{label}", label);
    case null:
      return t.unanswered.replace("{label}", label);
  }
}
