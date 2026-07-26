"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// The panel's one interactive primitive. Every control is the same shape: POST
// to a route that already exists, show what came back, then refresh the page so
// the state above it is re-read rather than assumed.
//
// It shows the response body verbatim. On a night when a beat does not fire,
// the operator needs the actual reason on screen, not a green tick.
export function Control({
  label,
  hint,
  method = "POST",
  path,
  body,
  tone = "normal",
}: {
  label: string;
  hint?: string;
  method?: "POST" | "DELETE";
  path: string;
  body?: unknown;
  tone?: "normal" | "primary" | "destructive";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setResult(null);
    const res = await fetch(path, {
      method,
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    setResult(`${res.status} ${text}`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="border-b border-rule py-4 last:border-b-0">
      <button
        type="button"
        disabled={pending}
        onClick={() => void run()}
        className={`${BUTTON} ${TONE[tone]}`}
      >
        {label}
      </button>
      {hint === undefined ? null : (
        <p className="mt-2 max-w-[60ch] text-sm text-ink-muted">{hint}</p>
      )}
      {result === null ? null : (
        <p className="mt-2 max-w-[80ch] break-all text-sm text-ink-faint">
          {result}
        </p>
      )}
    </div>
  );
}

const BUTTON =
  "min-h-11 rounded-tactile px-4 font-display text-base font-medium duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";

const TONE = {
  primary: "bg-accent text-ink-invert transition-opacity hover:opacity-90",
  normal:
    "border border-rule bg-surface text-ink transition-colors hover:bg-mist",
  // The red edge carries the warning and the label does not: `error` measures
  // 4.31:1 on white, which clears the 3:1 a UI boundary needs and misses the
  // 4.5:1 a run of words needs, so the words stay `ink` [globals.css @theme].
  destructive:
    "border border-error bg-surface text-ink transition-colors hover:bg-error-soft",
} as const;
