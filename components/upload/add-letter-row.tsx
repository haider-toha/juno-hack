"use client";

import { useId } from "react";

import { IconUpload } from "@/components/icons";

import { StateMessage, UploadBusy } from "./upload-status";
import { useLetterUpload, type UploadStrings } from "./use-letter-upload";

const ACCEPT = "image/*,application/pdf";

type Props = {
  patientId: string;
  title: string;
  blurb: string;
  t: UploadStrings;
};

// Same soft secondary row as plan / family on home — but the tap opens the
// camera or file picker in place. No `/?letter=1` detour that swaps the whole
// home for a second "upload" screen.
export function AddLetterRow({ patientId, title, blurb, t }: Props) {
  const inputId = useId();
  const strings = { ...t, cta: title, idleNote: blurb };
  const { state, busy, onFiles } = useLetterUpload(patientId, strings);

  if (busy) {
    return <UploadBusy state={state} t={strings} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="flex min-h-14 cursor-pointer items-center gap-3 rounded-tactile bg-mist px-4 py-3.5 transition-opacity duration-150 ease-out has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent active:opacity-70"
      >
        <span aria-hidden className="shrink-0 text-ink-muted">
          <IconUpload className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col text-left">
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            {title}
          </span>
          <span className="mt-0.5 text-base text-ink-muted">{blurb}</span>
        </span>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          capture="environment"
          multiple
          onChange={(event) => {
            const input = event.currentTarget;
            const picked = Array.from(input.files ?? []);
            input.value = "";
            void onFiles(picked);
          }}
          className="sr-only"
        />
      </label>
      {state.phase === "failed" ? (
        <p aria-live="polite" className="px-1 text-base leading-relaxed">
          <StateMessage state={state} t={strings} />
        </p>
      ) : null}
    </div>
  );
}
