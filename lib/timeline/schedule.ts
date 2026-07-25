import type {
  Appointment,
  DateAnchor,
  ExtractedBundle,
  Instruction,
  Medication,
} from "@/lib/plan/schema";

// Turning dated facts into a day-by-day view. Pure: no I/O, no React, and
// `today` is always a parameter — these functions run when rendering `/plan`
// and again inside a voice tool handler, and the demo clock moves the whole
// app's sense of now by supplying a different argument. Nothing here calls
// `new Date()`.

export type TimelineItem =
  | { kind: "medication"; id: string; medication: Medication }
  | { kind: "instruction"; id: string; instruction: Instruction }
  | { kind: "appointment"; id: string; appointment: Appointment };

export type TimelineDay = {
  date: string;
  // Days since discharge. 0 is the day he came home, which is how the letter
  // itself counts ("2 days", "in 1 week"). Null when the letter carries no
  // discharge date: there is nothing to count from, and labelling every day
  // "Discharge day" is a claim about the letter that the letter did not make.
  dayNumber: number | null;
  items: TimelineItem[];
};

// The episode's two anchor dates. Both are extracted; an offset counts from
// whichever one it names.
type Episode = ExtractedBundle["episode"];

// An anchor that cannot be placed on a calendar. A `conditional` anchor
// ("until your mobility returns to normal") has no day by definition, and an
// offset has none either when the letter carries no discharge date to count
// from. Both must stay visible rather than be dropped or guessed onto today.
type Placement =
  | { kind: "day"; date: string }
  | { kind: "window"; from: string; to: string }
  | { kind: "undated" };

export function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const ms =
    new Date(`${to}T00:00:00Z`).getTime() -
    new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

// With no base date there is nothing honest to count from, so the anchor stays
// undated rather than being counted from a guess.
function offsetBase(
  anchor: Extract<DateAnchor, { kind: "offset" }>,
  episode: Episode,
): string | null {
  switch (anchor.from) {
    case "discharge":
      return episode.dischargeDate;
    // "6 weeks after your operation" — surgical letters count from the
    // procedure, and its date is extracted and sitting right here.
    case "procedure":
      return episode.procedureDate;
    // Nothing in the bundle records when the letter was photographed.
    case "upload":
      return null;
  }
}

function place(anchor: DateAnchor, episode: Episode): Placement {
  switch (anchor.kind) {
    case "date":
      return { kind: "day", date: anchor.date };
    case "offset": {
      const base = offsetBase(anchor, episode);
      if (base === null) return { kind: "undated" };
      const from = addDays(base, anchor.days);
      return anchor.daysUntil === null
        ? { kind: "day", date: from }
        : { kind: "window", from, to: addDays(base, anchor.daysUntil) };
    }
    case "conditional":
      return { kind: "undated" };
  }
}

// The last day a placement covers. A window closes on its `to` — "for 2 to 3
// weeks" ends at three weeks, not never — and only `undated` ("until your
// mobility returns to normal") genuinely has no calendar end.
function lastDay(placement: Placement): string | null {
  switch (placement.kind) {
    case "day":
      return placement.date;
    case "window":
      return placement.to;
    case "undated":
      return null;
  }
}

// A drug is scheduled only if the letter gave it a rhythm. "PRN" and a blank
// frequency both leave `timesPerDay` and `everyDays` null, and neither can be
// missed on a given day, so neither becomes a daily row to tick.
function isScheduled(medication: Medication): boolean {
  return (
    medication.schedule.timesPerDay !== null ||
    medication.schedule.everyDays !== null
  );
}

function medicationRuns(
  medication: Medication,
  episode: Episode,
): { from: string; to: string | null } | null {
  if (!isScheduled(medication)) return null;
  // Withheld or stopped drugs have no start, so there is no day they belong on.
  if (medication.duration.start === null) return null;

  const start = place(medication.duration.start, episode);
  if (start.kind === "undated") return null;
  const from = start.kind === "day" ? start.date : start.from;

  if (medication.duration.end === null) return { from, to: null };
  return { from, to: lastDay(place(medication.duration.end, episode)) };
}

function medicationsOn(
  bundle: ExtractedBundle,
  date: string,
  episode: Episode,
): TimelineItem[] {
  return bundle.medications.flatMap((medication) => {
    const run = medicationRuns(medication, episode);
    if (run === null) return [];
    if (date < run.from) return [];
    if (run.to !== null && date > run.to) return [];

    // Weekly dosing lands on every seventh day from the start, not daily.
    const everyDays = medication.schedule.everyDays;
    if (everyDays !== null && daysBetween(run.from, date) % everyDays !== 0) {
      return [];
    }
    return [{ kind: "medication" as const, id: medication.id, medication }];
  });
}

function occursOn(placement: Placement, date: string): boolean {
  switch (placement.kind) {
    case "day":
      return placement.date === date;
    // A window lands once, on its opening day. "Within 2 weeks" is one action
    // with a deadline, not fifteen daily ones — the anchor's verbatim text
    // carries the deadline, so repeating the row would only bury the rest of
    // the day under it.
    case "window":
      return placement.from === date;
    case "undated":
      return false;
  }
}

function instructionsOn(
  bundle: ExtractedBundle,
  date: string,
  episode: Episode,
): TimelineItem[] {
  return bundle.instructions.flatMap((instruction) => {
    if (instruction.anchor === null) return [];
    const anchored = place(instruction.anchor, episode);
    if (anchored.kind === "undated") return [];

    const item = {
      kind: "instruction" as const,
      id: instruction.id,
      instruction,
    };
    if (occursOn(anchored, date)) return [item];

    const recurrence = instruction.recurrence;
    if (recurrence === null) return [];
    const first = anchored.kind === "day" ? anchored.date : anchored.from;
    if (date < first) return [];
    if (daysBetween(first, date) % recurrence.everyDays !== 0) return [];

    if (recurrence.until !== null) {
      const last = lastDay(place(recurrence.until, episode));
      if (last !== null && date > last) return [];
    }
    return [item];
  });
}

function appointmentsOn(
  bundle: ExtractedBundle,
  date: string,
  episode: Episode,
): TimelineItem[] {
  return bundle.appointments.flatMap((appointment) =>
    occursOn(place(appointment.when, episode), date)
      ? [{ kind: "appointment" as const, id: appointment.id, appointment }]
      : [],
  );
}

function itemsOn(bundle: ExtractedBundle, date: string): TimelineItem[] {
  const episode = bundle.episode;
  return [
    ...medicationsOn(bundle, date, episode),
    ...instructionsOn(bundle, date, episode),
    ...appointmentsOn(bundle, date, episode),
  ];
}

// Every dated day the plan covers, from discharge to its last dated item, plus
// `today` if the plan has already run out — a patient still on an ongoing
// anticoagulant has a today even after the last appointment.
export function buildTimeline(
  bundle: ExtractedBundle,
  today: string,
): TimelineDay[] {
  const episode = bundle.episode;
  const dischargeDate = episode.dischargeDate;
  const dates = datedBounds(bundle, episode);
  const first = dischargeDate ?? dates.earliest ?? today;
  const latest = dates.latest ?? today;
  const wanted = latest > today ? latest : today;
  const horizon = addDays(first, MAX_DAYS - 1);
  const last = wanted < horizon ? wanted : horizon;

  const days: TimelineDay[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    days.push({
      date,
      dayNumber:
        dischargeDate === null ? null : daysBetween(dischargeDate, date),
      items: itemsOn(bundle, date),
    });
  }
  return days;
}

// A discharge letter that projects further than a year is a data error, not a
// recovery plan. The range is clamped to this many days up front rather than
// cut off mid-loop, so every day the caller receives is a real day and the
// count is the one this name promises.
const MAX_DAYS = 400;

function datedBounds(
  bundle: ExtractedBundle,
  episode: Episode,
): { earliest: string | null; latest: string | null } {
  const anchors: DateAnchor[] = [
    ...bundle.appointments.map((appointment) => appointment.when),
    ...bundle.instructions.flatMap((instruction) =>
      instruction.anchor === null ? [] : [instruction.anchor],
    ),
    ...bundle.medications.flatMap((medication) =>
      [medication.duration.start, medication.duration.end].flatMap((anchor) =>
        anchor === null ? [] : [anchor],
      ),
    ),
  ];

  const dates = anchors
    .map((anchor) => place(anchor, episode))
    .flatMap((placement) => {
      switch (placement.kind) {
        case "day":
          return [placement.date];
        case "window":
          return [placement.from, placement.to];
        case "undated":
          return [];
      }
    })
    .sort();

  return { earliest: dates.at(0) ?? null, latest: dates.at(-1) ?? null };
}

export function dueToday(
  bundle: ExtractedBundle,
  today: string,
): TimelineItem[] {
  return itemsOn(bundle, today);
}

// Everything real that has no day: standing advice, drugs taken as needed, and
// anything anchored to a condition rather than a date. These belong on the plan
// screen — dropping them would quietly lose "finish the antibiotics" and the
// reliever inhaler.
export function standingItems(bundle: ExtractedBundle): TimelineItem[] {
  const episode = bundle.episode;
  return [
    ...bundle.medications.flatMap((medication) =>
      medicationRuns(medication, episode) === null &&
      medication.changeStatus !== "stopped"
        ? [{ kind: "medication" as const, id: medication.id, medication }]
        : [],
    ),
    ...bundle.instructions.flatMap((instruction) =>
      instruction.anchor === null ||
      place(instruction.anchor, episode).kind === "undated"
        ? [{ kind: "instruction" as const, id: instruction.id, instruction }]
        : [],
    ),
    ...bundle.appointments.flatMap((appointment) =>
      place(appointment.when, episode).kind === "undated"
        ? [{ kind: "appointment" as const, id: appointment.id, appointment }]
        : [],
    ),
  ];
}
