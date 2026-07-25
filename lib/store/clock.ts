import "server-only";

import { z } from "zod";

import { env } from "../env";

import { demoTodayKey } from "./keys";
import { redis } from "./redis";

const Day = z.iso.date();

// The app's single sense of "today". Nothing else calls `new Date()` to get the
// current day — `buildTimeline(bundle, today)` and every other date read takes
// it as a parameter, sourced from here, so the operator panel can move the whole
// app's clock at once. A day-by-day recovery plan is otherwise not demonstrable
// inside a sixty-second video.
export async function getDemoToday(): Promise<string> {
  // Only the mode that admits it is a demo may move the clock. In live mode
  // there is no badge on screen to explain a shifted "today", so a leftover
  // override would silently put every dose row on the wrong day and tick every
  // answer into the wrong day's key.
  if (env.NEXT_PUBLIC_PORTICO_MODE !== "demo") return realToday();

  const stored = await redis().get<unknown>(demoTodayKey());
  // Unset is the normal case: the demo clock has simply never been moved.
  // A stored value that is not a date is corruption, and throws.
  return stored === null ? realToday() : Day.parse(stored);
}

export async function setDemoToday(day: string): Promise<void> {
  await redis().set(demoTodayKey(), Day.parse(day));
}

function realToday(): string {
  return new Date().toISOString().slice(0, 10);
}
