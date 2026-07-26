"use client";

import Link from "next/link";

import { IconClose } from "@/components/icons";
import { PorticoAppIcon } from "@/components/phone/portico-app-icon";

type Props = {
  app: string;
  now: string;
  title: string;
  body: string;
  dismissLabel: string;
  onDismiss: () => void;
  // When set, the banner body opens this route; the dismiss control stays a
  // separate button so it never navigates.
  href?: string;
  // Extra top padding when the banner sits under the desktop Dynamic Island.
  underIsland?: boolean;
};

// Shared chrome for the demo push stand-ins — favicon tile, copy, dismiss.
export function PushBanner({
  app,
  now,
  title,
  body,
  dismissLabel,
  onDismiss,
  href,
  underIsland = false,
}: Props) {
  const copy = (
    <>
      <PorticoAppIcon />
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-baseline justify-between gap-2 pr-1">
          <span className="font-display text-sm font-semibold text-ink">
            {app}
          </span>
          <span className="shrink-0 text-sm text-ink-faint">{now}</span>
        </span>
        <span className="mt-0.5 block font-display text-base font-semibold leading-snug text-ink">
          {title}
        </span>
        <span className="mt-0.5 block text-base leading-snug text-ink-muted">
          {body}
        </span>
      </span>
    </>
  );

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 z-40 px-3 ${underIsland ? "pt-3 lg:pt-12" : "pt-3"}`}
    >
      <div className="pointer-events-auto relative flex w-full animate-[push-in_220ms_ease-out] items-start gap-3 rounded-card border border-rule bg-surface p-3 pr-12 shadow-card">
        {href !== undefined ? (
          <Link
            href={href}
            className="flex min-w-0 flex-1 items-start gap-3 transition-opacity duration-150 ease-out hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
          >
            {copy}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">{copy}</div>
        )}
        <DismissButton label={dismissLabel} onDismiss={onDismiss} />
      </div>
    </div>
  );
}

function DismissButton({
  label,
  onDismiss,
}: {
  label: string;
  onDismiss: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
      // 44px, not the 36px this was: it is the only control on a card that
      // lands unannounced over whatever the reader was doing, and it was the
      // one target in the app under the floor.
      className="absolute top-1 right-1 grid size-11 place-items-center rounded-pill text-ink-faint transition-opacity duration-150 ease-out hover:bg-mist hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
    >
      <IconClose className="size-3.5" />
    </button>
  );
}
