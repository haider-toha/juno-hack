"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The one client leaf on `/family`. The escalation beat is a relative watching
// a second device change on its own, so the page has to notice a write it did
// not make. `router.refresh()` re-runs the Server Component and reconciles —
// no client fetch, no duplicate rendering path, no state to keep in sync.
//
// The page is `force-dynamic`, so each refresh is a real read rather than a
// cached render being handed back.
const INTERVAL_MS = 5000;

export function RefreshPoller() {
  const router = useRouter();

  useEffect(() => {
    const tick = window.setInterval(() => router.refresh(), INTERVAL_MS);
    return () => window.clearInterval(tick);
  }, [router]);

  return null;
}
