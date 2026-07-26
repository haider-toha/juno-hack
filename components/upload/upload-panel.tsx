"use client";

import { useId } from "react";

import { IconUpload } from "@/components/icons";

import { LabelText, StateMessage, UploadBusy } from "./upload-status";
import { useLetterUpload, type UploadStrings } from "./use-letter-upload";

// One control for both paths. `capture` is a hint: on a phone it opens the
// camera, on a desktop it is ignored and the file picker appears, so the same
// input covers photographing a letter and choosing a PDF. A discharge bundle is
// several pages, hence `multiple`.
const ACCEPT = "image/*,application/pdf";

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

export function UploadPanel({
  patientId,
  t,
}: {
  patientId: string;
  t: UploadStrings;
}) {
  const inputId = useId();
  const { state, busy, onFiles } = useLetterUpload(patientId, t);

  if (busy) {
    // The button is gone for this stretch — a dimmed CTA that still looks
    // tappable is the wrong story for "stay on this screen".
    return <UploadBusy state={state} t={t} />;
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
