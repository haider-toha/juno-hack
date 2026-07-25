"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { logStep } from "@/app/(phone)/plan/actions";
import { IconAlert, IconCheck } from "@/components/icons";
import type { LogEntry } from "@/lib/store/log";

type Status = LogEntry["status"];

type Props = {
  patientId: string;
  itemId: string;
  day: string;
  label: string;
  status: Status | null;
};

// The one client leaf in an otherwise server-rendered timeline. Tick
// optimistically so the tap feels instant, persist, then refresh so the server
// is the thing that decides what is on screen.
export function TaskCheck({ patientId, itemId, day, label, status }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);

  const shown = optimistic ?? status;
  const next: Status = shown === "taken" ? "missed" : "taken";

  function answer() {
    setOptimistic(next);
    setFailed(false);
    startTransition(async () => {
      try {
        await logStep({ patientId, itemId, day, status: next });
        router.refresh();
      } catch {
        // Roll the tick back rather than leave a tick on screen for something
        // that was never recorded — a false tick is worse than no tick.
        setOptimistic(null);
        setFailed(true);
      }
    });
  }

  return (
    <span className="flex flex-col items-center">
      <button
        type="button"
        onClick={answer}
        aria-label={describe(shown, label)}
        className="-m-2.5 flex size-11 items-center justify-center rounded-pill transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-60"
      >
        <Mark status={shown} />
      </button>
      {failed ? (
        <span role="alert" className="mt-1 w-max text-xs text-error">
          Not saved
        </span>
      ) : null}
    </span>
  );
}

function Mark({ status }: { status: Status | null }) {
  switch (status) {
    case "taken":
      return (
        <span className="flex size-6 items-center justify-center rounded-pill bg-success text-white">
          <IconCheck className="size-3.5" />
        </span>
      );
    case "missed":
      return (
        <span className="flex size-6 items-center justify-center rounded-pill text-error">
          <IconAlert className="size-4.5" />
        </span>
      );
    case null:
      return <span className="size-6 rounded-pill border border-rule" />;
  }
}

function describe(status: Status | null, label: string): string {
  switch (status) {
    case "taken":
      return `${label}: recorded as taken. Tap to change to missed.`;
    case "missed":
      return `${label}: recorded as missed. Tap to change to taken.`;
    case null:
      return `${label}: tap to record as taken.`;
  }
}
