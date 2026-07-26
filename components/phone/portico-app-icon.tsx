import Image from "next/image";

// Raster app icon from `app/apple-icon.tsx` (navy tile, white "p" + indigo
// period). Using the image route — not re-typeset text — so the period cannot
// drop under the letter the way a CSS "p." span did.
export function PorticoAppIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/apple-icon"
      alt=""
      width={40}
      height={40}
      unoptimized
      className={`size-10 shrink-0 rounded-tactile ${className}`}
    />
  );
}
