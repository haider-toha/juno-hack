"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Dictionary } from "@/lib/i18n/en";

// Demo extraction returns instantly. Without a floor the home flashes
// "Reading…" and jumps to /plan — the orb never gets a beat to say work is
// happening. Real model calls usually exceed this; the wait only pads the
// short path.
const MIN_BUSY_MS = 3200;

export type UploadStrings = Dictionary["upload"]["panel"];

export type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; done: number; total: number }
  | { phase: "reading" }
  | { phase: "building" }
  | { phase: "failed"; message: string };

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useLetterUpload(patientId: string, t: UploadStrings) {
  const router = useRouter();
  const [state, setState] = useState<UploadState>({ phase: "idle" });

  async function onFiles(files: File[]) {
    if (files.length === 0) return;

    const startedAt = Date.now();
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
        // Both 422s mean the same thing to a patient and ask for the same next
        // step, so they collapse into one sentence. The route's own message
        // carries the model's account of what went wrong, which is developer
        // English and not for this screen; the status code is not for it either.
        setState({
          phase: "failed",
          message: response.status === 422 ? t.errorUnreadable : t.errorRead,
        });
        return;
      }

      // Hold on "building" long enough for the orb to read as work, then leave.
      setState({ phase: "building" });
      const remaining = MIN_BUSY_MS - (Date.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
      router.push("/plan");
    } catch {
      // Surfaced, never swallowed: a failed upload must not leave an empty
      // screen that reads as "your letter had nothing in it". The thrown
      // message itself is developer English and stays out of the patient's way.
      setState({ phase: "failed", message: t.errorSend });
    }
  }

  const busy =
    state.phase === "uploading" ||
    state.phase === "reading" ||
    state.phase === "building";

  return { state, busy, onFiles };
}
