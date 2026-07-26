"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { IconUpload } from "@/components/icons";
import { OrbSphere } from "@/components/voice/orb";
import type { Dictionary } from "@/lib/i18n/en";

// One control for both paths. `capture` is a hint: on a phone it opens the
// camera, on a desktop it is ignored and the file picker appears, so the same
// input covers photographing a letter and choosing a PDF. A discharge bundle is
// several pages, hence `multiple`.
const ACCEPT = "image/*,application/pdf";

// Demo extraction returns instantly. Without a floor the home flashes
// "Reading…" and jumps to /plan — the orb never gets a beat to say work is
// happening. Real model calls usually exceed this; the wait only pads the
// short path.
const MIN_BUSY_MS = 3200;

// Its own class string rather than `primaryButton` from `components/
// button-styles.ts`: this is the one control on the one screen a patient reaches
// holding a piece of paper, and it is deliberately twice the height of an
// ordinary button. Reusing the shared string and overriding `min-h`, `text-lg`
// and `justify-center` on top would put three pairs of same-property utilities
// in one class attribute, which resolve by stylesheet order rather than by the
// order they are typed in. Same tokens, same motion, same radius — only the
// scale differs.
const letterButton =
  "flex w-full min-h-[7rem] items-center gap-4 rounded-card bg-accent px-5 py-4 text-left text-ink-invert transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80";

type Strings = Dictionary["upload"]["panel"];

type State =
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

export function UploadPanel({
  patientId,
  t,
}: {
  patientId: string;
  t: Strings;
}) {
  const router = useRouter();
  const inputId = useId();
  const [state, setState] = useState<State>({ phase: "idle" });

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

  if (busy) {
    // Same orb as check-in: luminous while pages move, speaking-bright while
    // we read and build. The button is gone for this stretch — a dimmed CTA
    // that still looks tappable is the wrong story for "stay on this screen".
    return (
      <div className="flex flex-col items-center gap-5 py-2 text-center">
        <OrbSphere
          connected
          speaking={state.phase === "reading" || state.phase === "building"}
        />
        <div className="flex flex-col gap-2">
          <p className="font-display text-xl font-medium leading-snug text-ink">
            <LabelText state={state} t={t} />
          </p>
          <p aria-live="polite" className="text-base leading-relaxed text-ink-muted">
            <StateMessage state={state} t={t} />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* No `aria-disabled` here — a label has no role to be disabled, and the
          input it points at already carries the real `disabled`. The focus ring
          is `has-[:focus-visible]` rather than `focus-within` so it tracks the
          hidden input's own focus-visible state: `focus-within` lit up on a
          mouse click and stayed lit after the file dialog closed. */}
      <label
        htmlFor={inputId}
        className={`${letterButton} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent cursor-pointer`}
      >
        <IconUpload className="size-8 shrink-0" />
        {/* `text-balance` because the label does not fit one line at 390px and
            an unbalanced wrap leaves "PDF" alone on the second. No sub-line
            under it: "take a photo OR upload a PDF" already names both paths;
            the host screen names the discharge letter. */}
        <span className="min-w-0 text-balance font-display text-xl font-medium leading-snug">
          <LabelText state={state} t={t} />
        </span>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          capture="environment"
          multiple
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
        <StateMessage state={state} t={t} />
      </p>
    </div>
  );
}

function LabelText({ state, t }: { state: State; t: Strings }) {
  switch (state.phase) {
    case "idle":
    case "failed":
      return t.cta;
    case "uploading":
      return (
        <span className="tnum">
          {(state.total === 1 ? t.sentOne : t.sentMany)
            .replace("{done}", String(state.done))
            .replace("{total}", String(state.total))}
        </span>
      );
    case "reading":
      return t.reading;
    case "building":
      return t.building;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function StateMessage({ state, t }: { state: State; t: Strings }) {
  switch (state.phase) {
    case "idle":
      return <span className="text-ink-muted">{t.idleNote}</span>;
    case "uploading":
      return <span className="text-ink-muted">{t.uploadingNote}</span>;
    case "reading":
      return <span className="text-ink-muted">{t.readingNote}</span>;
    case "building":
      return <span className="text-ink-muted">{t.buildingNote}</span>;
    // No `role="alert"` — this already sits inside the polite live region
    // above, and an assertive region nested in a polite one gets announced
    // twice, or not at all, depending on the screen reader.
    case "failed":
      return <span className="text-error">{state.message}</span>;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
