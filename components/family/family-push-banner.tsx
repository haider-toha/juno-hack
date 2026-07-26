"use client";

import { useState } from "react";

import { PushBanner } from "@/components/phone/push-banner";
import type { Dictionary } from "@/lib/i18n/en";

type Strings = Pick<
  Dictionary["family"],
  "pushApp" | "pushNow" | "pushTitle" | "pushBody"
> & {
  dismiss: string;
};

// Slide-in when the family screen lands on an alert. Demo stand-in for the
// push the daughter would have received — same card content lives below.
export function FamilyPushBanner({ t }: { t: Strings }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <PushBanner
      app={t.pushApp}
      now={t.pushNow}
      title={t.pushTitle}
      body={t.pushBody}
      dismissLabel={t.dismiss}
      onDismiss={() => setVisible(false)}
    />
  );
}
