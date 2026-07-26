import "server-only";

// Every Redis key the app touches, in one module so nobody types the prefix
// twice. The `portico:` namespace is product-wide [Locked D10] — including the
// NHS medicine cache, which the drug-lookup research sketched as `nhs:med:v1:`.

// There is one patient in this build. Naming it here rather than inlining
// "demo" at each call site keeps the day a second patient exists to one edit.
export const DEMO_PATIENT_ID = "demo";

export function planKey(patientId: string) {
  return `portico:plan:${patientId}`;
}

export function patientKey(patientId: string) {
  return `portico:patient:${patientId}`;
}

// A hash per patient-day, field = itemId, so a repeat write for the same
// (patientId, itemId, day) replaces instead of appending.
export function logKey(patientId: string, day: string) {
  return `portico:log:${patientId}:${day}`;
}

export function nhsMedicineKey(slug: string) {
  return `portico:nhs:med:v1:${slug}`;
}

export function nhsIndexKey() {
  return "portico:nhs:index:v1";
}

export function demoTodayKey() {
  return "portico:demo:today";
}

// The raised check-in. Real state the phone polls for, so the incoming card is
// produced by something rather than painted on a timer [Locked D9].
export function incomingCheckInKey(patientId: string) {
  return `portico:incoming:${patientId}`;
}

// Dose nudges the agent scheduled during a check-in. Hash per patient-day,
// field = itemId — same idempotency shape as the adherence log.
export function reminderKey(patientId: string, day: string) {
  return `portico:reminders:${patientId}:${day}`;
}

// A dose nudge currently ringing on the phone — the evening follow-up that
// schedule_reminder promised. Same three-verb pattern as the check-in ring.
export function incomingNudgeKey(patientId: string) {
  return `portico:nudge:${patientId}`;
}

// Explicit next-of-kin escalations from the voice tool. Hash per patient-day,
// field = itemId — same idempotency shape as the adherence log.
export function escalationKey(patientId: string, day: string) {
  return `portico:escalation:${patientId}:${day}`;
}
