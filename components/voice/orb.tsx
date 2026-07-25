// The speaking/listening orb. Animated off the SDK `mode` axis (NOT `status`,
// which is `connected` for both, and NOT invented from transcript deltas). It
// must read as a soft, morphing sphere, never a hard pulsing disc.

// The morphing sphere itself — shared by the live conversation (OrbDock) and any
// pre-session/loading screen, so the idle state reads as the same entity that
// answers back. Three offset, blurred layers share a size/opacity treatment; the
// morph comes from their staggered phase + positions, not a concentric throb.
// `connected` decides whether the sphere is dimmed (idle) or luminous;
// `speaking` pushes it larger and brighter.
export function OrbSphere({
  connected,
  speaking,
}: {
  connected: boolean;
  speaking: boolean;
}) {
  // Blue→violet sphere, sanctioned inline hex; the transparent stop sits well
  // inside the box so the rim feathers out instead of cutting to a hard circle.
  const sphere =
    "radial-gradient(circle at 38% 32%, #ffffff 0%, #6e8bf7 24%, #2d51fb 52%, #5b47e0 70%, rgba(235,239,253,0) 92%)";
  const blobState = !connected
    ? "size-12 opacity-40 saturate-50"
    : speaking
      ? "size-[4.5rem] animate-pulse opacity-80 brightness-110"
      : "size-14 animate-pulse opacity-75";
  return (
    <div className="relative grid size-20 place-items-center">
      <span
        aria-hidden
        style={{
          background: "radial-gradient(circle, #2d51fb 0%, transparent 70%)",
        }}
        className={`absolute rounded-pill blur-2xl transition-all duration-500 ease-out ${
          !connected
            ? "size-16 opacity-20"
            : speaking
              ? "size-24 animate-pulse opacity-70"
              : "size-20 animate-pulse opacity-50"
        }`}
      />
      <span
        aria-hidden
        style={{ background: sphere, animationDelay: "0ms" }}
        className={`absolute -translate-y-2.5 rounded-pill blur-[6px] transition-all duration-500 ease-out ${blobState}`}
      />
      <span
        aria-hidden
        style={{ background: sphere, animationDelay: "1400ms" }}
        className={`absolute -translate-x-2.5 translate-y-1.5 scale-110 rounded-pill blur-[6px] transition-all duration-500 ease-out ${blobState}`}
      />
      <span
        aria-hidden
        style={{ background: sphere, animationDelay: "700ms" }}
        className={`absolute translate-x-2.5 translate-y-1.5 scale-90 rounded-pill blur-[6px] transition-all duration-500 ease-out ${blobState}`}
      />
    </div>
  );
}

// The prominent voice dock: sphere + listening dots + a status caption. Shown
// when the user entered by voice.
export function OrbDock({
  status,
  mode,
}: {
  status: string;
  mode: "speaking" | "listening";
}) {
  const connected = status === "connected";
  const speaking = connected && mode === "speaking";
  return (
    <div className="flex shrink-0 flex-col items-center gap-2 px-5 py-4">
      <OrbSphere connected={connected} speaking={speaking} />
      {connected && !speaking ? (
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              aria-hidden
              style={{ animationDelay: `${i * 100}ms` }}
              className="size-1.5 animate-pulse rounded-pill bg-ink-faint"
            />
          ))}
        </div>
      ) : null}
      <p aria-live="polite" className="font-display text-sm text-ink-muted">
        {voiceStatusLabel(status, mode)}
      </p>
    </div>
  );
}

// The typed-chat stand-in for OrbDock: no central sphere or dots, just a slim
// status caption above the input so the thread reads clean. Voice is still live
// in this mode, so it keeps OrbDock's exact aria-live + voiceStatusLabel
// contract — "Speaking" still announces when the agent voices a reply.
export function VoiceStatusLine({
  status,
  mode,
}: {
  status: string;
  mode: "speaking" | "listening";
}) {
  return (
    <p
      aria-live="polite"
      className="shrink-0 px-4 pb-1.5 text-center font-display text-xs text-ink-faint"
    >
      {voiceStatusLabel(status, mode)}
    </p>
  );
}

function voiceStatusLabel(
  status: string,
  mode: "speaking" | "listening",
): string {
  if (status === "connecting") return "Connecting…";
  if (status === "error") return "Connection error";
  if (status !== "connected") return "Not connected";
  return mode === "speaking" ? "Speaking" : "Listening";
}
