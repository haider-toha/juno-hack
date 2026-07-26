import { OrbSphere } from "@/components/voice/orb";

import type { UploadState, UploadStrings } from "./use-letter-upload";

// Shared copy for idle / progress / failure across the big home panel and the
// "add another letter" row. Kept here so the two triggers stay word-identical.
export function UploadBusy({
  state,
  t,
}: {
  state: UploadState;
  t: UploadStrings;
}) {
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

export function LabelText({
  state,
  t,
}: {
  state: UploadState;
  t: UploadStrings;
}) {
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

export function StateMessage({
  state,
  t,
}: {
  state: UploadState;
  t: UploadStrings;
}) {
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
