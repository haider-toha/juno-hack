// The app's two button shapes, as class strings rather than components: the
// same look has to land on a <button>, a <Link> and a file <label>, and a
// polymorphic component covering three elements would be more machinery than
// the two strings it wraps. Both match the pair on the check-in idle screen in
// `components/voice/voice-session.tsx`, which is where the look was set — each
// screen retyping it by hand is how the copies drifted apart. Call sites add
// width and margin; everything visual lives here.

export const primaryButton =
  "flex min-h-[3.25rem] items-center justify-center gap-2 rounded-tactile bg-accent px-5 font-display text-lg font-medium text-ink-invert transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80";

export const secondaryButton =
  "flex min-h-11 items-center gap-2 rounded-tactile px-4 font-display text-base font-medium text-accent transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80";
