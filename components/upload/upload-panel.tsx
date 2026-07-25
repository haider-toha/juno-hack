"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

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

  async function onFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    setState({ phase: "uploading", done: 0, total: files.length });
    try {
      const documents = [];
      for (const [index, file] of files.entries()) {
        const blob = await upload(`letters/${patientId}/${file.name}`, file, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          contentType: file.type || undefined,
        });
        documents.push({
          pathname: blob.pathname,
          url: blob.url,
          contentType: blob.contentType,
          displayName: file.name,
        });
        setState({ phase: "uploading", done: index + 1, total: files.length });
      }

      setState({ phase: "reading" });
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId, documents }),
      });
      if (!response.ok) {
        setState({ phase: "failed", message: await describeProblem(response) });
        return;
      }
      router.push("/plan");
    } catch (error) {
      // Surfaced, never swallowed: a failed upload must not leave an empty
      // screen that reads as "your letter had nothing in it".
      setState({
        phase: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const busy = state.phase === "uploading" || state.phase === "reading";

  return (
    <div className="flex flex-col gap-4">
      {/* No `aria-disabled` here — a label has no role to be disabled, and the
          input it points at already carries the real `disabled`. */}
      <label
        htmlFor={inputId}
        className={`flex min-h-11 items-center justify-center gap-2.5 rounded-tactile bg-accent px-5 py-3.5 text-base font-semibold text-white transition-opacity duration-150 ease-out focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
          busy ? "opacity-60" : "cursor-pointer active:opacity-70"
        }`}
      >
        <IconUpload className="size-4.5" />
        Take a photo or choose a file
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          capture="environment"
          multiple
          disabled={busy}
          onChange={(event) => void onFiles(event.currentTarget.files)}
          className="sr-only"
        />
      </label>

      <p aria-live="polite" className="min-h-6 text-sm leading-relaxed">
        <StateMessage state={state} />
      </p>
    </div>
  );
}

function StateMessage({ state }: { state: State }) {
  switch (state.phase) {
    case "idle":
      return (
        <span className="text-ink-muted">
          Photograph every page. Nothing is shared with anyone.
        </span>
      );
    case "uploading":
      return (
        <span className="tnum text-ink-muted">
          Sent {state.done} of {state.total}{" "}
          {state.total === 1 ? "page" : "pages"}…
        </span>
      );
    case "reading":
      return (
        <span className="text-ink-muted">
          Reading your letter. This takes a few seconds.
        </span>
      );
    // No `role="alert"` — this already sits inside the polite live region
    // above, and an assertive region nested in a polite one gets announced
    // twice, or not at all, depending on the screen reader.
    case "failed":
      return (
        <span className="text-error">
          We could not read that letter, so nothing has been saved.{" "}
          {state.message}
        </span>
      );
  }
}

// The two 422s answer in JSON with a sentence. An infrastructure failure is
// left to throw inside the route, so its body is Next's error page — say that
// plainly rather than showing a JSON parse error about the error.
async function describeProblem(response: Response): Promise<string> {
  const raw = await response.text();
  if (!raw.startsWith("{")) {
    return `The server failed with a ${response.status}. Please try again in a moment.`;
  }
  const problem: unknown = JSON.parse(raw);
  return typeof problem === "object" &&
    problem !== null &&
    "message" in problem &&
    typeof problem.message === "string"
    ? problem.message
    : "The server did not say why.";
}
