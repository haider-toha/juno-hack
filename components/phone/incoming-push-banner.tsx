"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { PushBanner } from "@/components/phone/push-banner";
import type { Dictionary } from "@/lib/i18n/en";

type Strings = Pick<
  Dictionary["voice"],
  "pushApp" | "pushNow" | "pushTitle" | "pushBody"
> & {
  dismiss: string;
};

const incomingSchema = z.object({ raisedAt: z.string().nullable() });

const POLL_MS = 5000;

// Stands in for a lock-screen push when the operator rings a check-in. The
// phone shell is the demo device, so the banner lives here rather than in the
// browser Notifications API — which we deliberately do not ask for on stage.
export function IncomingPushBanner({ t }: { t: Strings }) {
  const pathname = usePathname();
  const [raisedAt, setRaisedAt] = useState<string | null>(null);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const res = await fetch("/api/demo/check-in", { cache: "no-store" });
      if (!res.ok) return;
      const next = incomingSchema.parse(await res.json()).raisedAt;
      setRaisedAt(next);
      // A new ring after a dismiss should show again.
      if (next === null) setDismissedAt(null);
    };
    void check();
    const tick = window.setInterval(() => void check(), POLL_MS);
    return () => window.clearInterval(tick);
  }, []);

  // On /check-in the idle screen already owns the Answer UI — a second banner
  // on top of it is noise. Everywhere else, the banner is the notification.
  if (
    raisedAt === null ||
    dismissedAt === raisedAt ||
    pathname === "/check-in"
  ) {
    return null;
  }

  return (
    <PushBanner
      underIsland
      href="/check-in"
      app={t.pushApp}
      now={t.pushNow}
      title={t.pushTitle}
      body={t.pushBody}
      dismissLabel={t.dismiss}
      onDismiss={() => setDismissedAt(raisedAt)}
    />
  );
}
