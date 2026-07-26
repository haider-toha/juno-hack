"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { PushBanner } from "@/components/phone/push-banner";
import type { Dictionary } from "@/lib/i18n/en";

type Strings = Pick<
  Dictionary["voice"],
  "pushApp" | "pushNow" | "dosePushTitle" | "dosePushBody"
> & {
  dismiss: string;
};

const raisedSchema = z.object({
  raisedAt: z.string(),
  itemId: z.string(),
  timeLocal: z.string(),
  nameAsWritten: z.string(),
});

const responseSchema = z.object({
  raised: raisedSchema.nullable(),
});

const POLL_MS = 5000;

// Stand-in for the evening dose push the agent promised. The operator fires
// it from the demo desk; the phone polls the same Redis ring the check-in uses.
export function DoseNudgeBanner({ t }: { t: Strings }) {
  const pathname = usePathname();
  const [raised, setRaised] = useState<z.infer<typeof raisedSchema> | null>(
    null,
  );
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const res = await fetch("/api/demo/reminder", { cache: "no-store" });
      if (!res.ok) return;
      const next = responseSchema.parse(await res.json()).raised;
      setRaised(next);
      if (next === null) setDismissedAt(null);
    };
    void check();
    const tick = window.setInterval(() => void check(), POLL_MS);
    return () => window.clearInterval(tick);
  }, []);

  // On /plan the person is already where the nudge sends them.
  if (
    raised === null ||
    dismissedAt === raised.raisedAt ||
    pathname === "/plan"
  ) {
    return null;
  }

  return (
    <PushBanner
      underIsland
      // The nudge names one medicine, so it opens on that medicine's row rather
      // than at the top of a plan the patient then has to read down. Today's
      // rows carry the id; a plan still streaming in falls back to the top,
      // which is where the link used to land anyway.
      href={`/plan#dose-${raised.itemId}`}
      app={t.pushApp}
      now={t.pushNow}
      title={t.dosePushTitle.replace("{name}", raised.nameAsWritten)}
      body={t.dosePushBody}
      dismissLabel={t.dismiss}
      onDismiss={() => {
        setDismissedAt(raised.raisedAt);
        void fetch("/api/demo/reminder", { method: "DELETE" });
      }}
    />
  );
}
