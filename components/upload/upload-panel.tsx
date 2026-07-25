"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { primaryButton } from "@/components/button-styles";
import { IconUpload } from "@/components/icons";

// One control for both paths. `capture` is a hint: on a phone it opens the
// camera, on a desktop it is ignored and the file picker appears, so the same
// input covers photographing a letter and choosing a PDF. A discharge bundle is
// several pages, hence `multiple`.
const ACCEPT = "image/*,application/pdf";

type State =
  | { phase: "idle" }
  | { phase: "uploading"; done: number; total: number }
  | { phase: "reading" }
  | { phase: "failed"; message: string };

export function UploadPanel({ patientId }: { patientId: string }) {
  const router = useRouter();
  const inputId = useId();
  const [state, setState] = useState<State>({ phase: "idle" });

  async function onFiles(files: File[]) {
    if (files.length === 0) return;

    setState({ phase: "uploading", done: 0, total: files.length });
    try {
      // In parallel, which is the whole reason the input takes several files:
      // five phone photos over a weak mobile connection one at a time is five
      // round trips of waiting. `done` counts completions, so the progress
      // stays honest while they land out of order.
      let done = 0;
      const documents = await Promise.all(
        files.map(async (file) => {
          const blob = await upload(`letters/${patientId}/${file.name}`, file, {
            access: "private",
            handleUploadUrl: "/api/blob/upload",
            contentType: file.type || undefined,
          });
          done += 1;
          setState({ phase: "uploading", done, total: files.length });
          return {
            pathname: blob.pathname,
            url: blob.url,
            contentType: blob.contentType,
            displayName: file.name,
          };
        }),
      );

      setState({ phase: "reading" });
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId, documents }),
      });
      if (!response.ok) {
        setState({ phase: "failed", message: problemFor(response.status) });
        return;
      }
      router.push("/plan");
    } catch {
      // Surfaced, never swallowed: a failed upload must not leave an empty
      // screen that reads as "your letter had nothing in it". The thrown
      // message itself is developer English and stays out of the patient's way.
      setState({
        phase: "failed",
        message:
          "We could not finish sending that, so nothing has been saved. Check your connection and try again.",
      });
    }
  }

  const busy = state.phase === "uploading" || state.phase === "reading";

  return (
    <div className="flex flex-col gap-4">
      {/* No `aria-disabled` here — a label has no role to be disabled, and the
          input it points at already carries the real `disabled`. The focus ring
          is `has-[:focus-visible]` rather than `focus-within` so it tracks the
          hidden input's own focus-visible state: `focus-within` lit up on a
          mouse click and stayed lit after the file dialog closed. */}
      <label
        htmlFor={inputId}
        className={`${primaryButton} w-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
          busy ? "pointer-events-none opacity-60" : "cursor-pointer"
        }`}
      >
        <IconUpload className="size-5" />
        <LabelText state={state} />
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          capture="environment"
          multiple
          disabled={busy}
          onChange={(event) => {
            const input = event.currentTarget;
            // Read the list before clearing: setting `value` empties `files`.
            // Without the clear, picking the same photo again after a failure
            // fires no change event at all and the screen has no way forward.
            const picked = Array.from(input.files ?? []);
            input.value = "";
            void onFiles(picked);
          }}
          className="sr-only"
        />
      </label>

      <p aria-live="polite" className="min-h-6 text-base leading-relaxed">
        <StateMessage state={state} />
      </p>
    </div>
  );
}

// The label is the busy affordance: it already knows how many pages have
// landed, and dimming alone through a multi-second multi-page upload says only
// that something is disabled.
function LabelText({ state }: { state: State }) {
  switch (state.phase) {
    case "idle":
    case "failed":
      return "Take a photo or choose a file";
    case "uploading":
      return (
        <span className="tnum">
          Sent {state.done} of {state.total}{" "}
          {state.total === 1 ? "page" : "pages"}
        </span>
      );
    case "reading":
      return "Reading your letter";
  }
}

function StateMessage({ state }: { state: State }) {
  switch (state.phase) {
    // The privacy promise, worded as the home screen words it. The instruction
    // to photograph every page is on the page above and does not need saying
    // twice, differently, 100px apart.
    case "idle":
      return (
        <span className="text-ink-muted">
          Nothing is shared with anyone you haven&rsquo;t chosen.
        </span>
      );
    case "uploading":
      return (
        <span className="text-ink-muted">
          Keep this screen open until the pages have gone.
        </span>
      );
    case "reading":
      return <span className="text-ink-muted">This takes a few seconds.</span>;
    // No `role="alert"` — this already sits inside the polite live region
    // above, and an assertive region nested in a polite one gets announced
    // twice, or not at all, depending on the screen reader.
    case "failed":
      return <span className="text-error">{state.message}</span>;
  }
}

// Both 422s mean the same thing to a patient and ask for the same next step, so
// they collapse into one sentence. The route's own message carries the model's
// account of what went wrong, which is developer English and not for this
// screen; the status code is not for it either.
function problemFor(status: number): string {
  return status === 422
    ? "We could not read that letter, so nothing has been saved. Try photographing each page again, laid flat and in good light."
    : "We could not finish reading that, so nothing has been saved. Please try again in a moment.";
}
