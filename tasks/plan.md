# Implementation Plan: Portico (Recovery Companion)

Reference: `plan/spec.md` for the full spec; `audit/juno-recovery-companion/`
for every cited finding. This plan turns the spec into an ordered, two-person
task list.

**Product name: Portico** [Locked D10]. Juno = hackathon host only.

## Overview

Two coders build one app in parallel after a short shared-foundation phase.
**Track A** owns ingestion: upload → extraction → the plan schema's
persistence → the day-by-day timeline → drug lookup. **Track B** owns the
voice experience end to end: the check-in call, tool calling, escalation, the
family dashboard, and i18n. Both tracks touch UI, because UI/UX is a graded
axis and neither person should be UI-blind.

The critical shared artifact is `lib/plan/schema.ts` — both tracks read and
write it starting in Phase 1. It is fixed in Phase 0, before either track
branches, precisely so nobody reseeds Redis at hour 18.

## Architecture Decisions

Each of these is already made (see `plan/spec.md` and the audit files); listed
here so the dependency graph below makes sense without re-deriving them.

1. **Persistence is Upstash Redis + Vercel Blob**, provisioned via the Vercel
   Marketplace. No Supabase, no Postgres. [Locked D1]
2. **Extraction runs through the Vercel AI SDK via the AI Gateway**, using
   `generateText` + `Output.object` (`generateObject` is deprecated). [Locked
   D2; 05 §Rationale]
3. **No `timeline[]` in the schema.** The model emits dated facts; a pure
   function computes the day-by-day view. [01 §I3]
4. **Grounding the voice agent is prompt injection, not RAG.** The browser
   SDK cannot send a knowledge-base override at all. [02 §(a)]
5. **Tool calling is server tools (webhooks) for `log_step` and
   `escalate_to_next_of_kin`**, writing to Redis; the browser observes via
   `onAgentToolRequest`/`onAgentToolResponse`. One client tool,
   `show_red_flag`, purely visual. [02 §(b)]
6. **Call initiation is notification → tap → the existing in-app orb
   session.** No phone call, no Twilio. [Locked D3; 02 §(c)]
7. **Real locales are English + French.** Showcase locales show an explicit
   "not yet" panel — never a silent English fallthrough. [Locked D4, D9]
8. **The ElevenLabs agent is created in Phase 0**, pinned to
   `eleven_flash_v2_5`, with Security overrides enabled. Additional Languages
   may add French only after the pin is re-verified — never trust a silent
   model rewrite. No English-voice-under-French-UI downgrade. [Locked D8, D9]
9. **Drug red-flag data comes from NHS.uk's medicines A-Z**, fetched at
   ingestion time, cached in Redis with a 24-hour TTL derived from the NHS
   licence terms. Not the BNF (geo-blocked, licence-excluded). [Locked D6; 03]
10. **i18n is a typed dictionary module, no library.** Cookie-based locale, no
    `[locale]` route segment. `fr.ts satisfies Dictionary`. [04 §i18n]
11. **Red flags render dual in French mode** — translation plus the verbatim
    English side by side; everything else translates cleanly. Clinical proper
    nouns are never translated. [Locked D7]
12. **The family dashboard polls** via `router.refresh()` every 5s — Upstash
    REST has no pub/sub. [05 §The family dashboard]
13. **No silent fallbacks anywhere.** Missing deps throw; bad parse → 422;
    wrong agent config fails the spike out loud. [Locked D9]
14. **Product name is Portico.** Juno is the hackathon host only. UI, voice
    persona, and new Redis keys use Portico / `portico:` — not Juno.
    [Locked D10]

## Dependency Graph

```
Phase 0 — Shared foundation (BOTH, paired, ~45–60 min) + agent setup
    │
    ├── lib/plan/schema.ts          (the shared contract — see spec.md)
    ├── lib/store/redis.ts          (lazy client, both tracks need it immediately)
    ├── lib/env.ts extended         (llmEnv, blobEnv, redisEnv)
    ├── provisioning verified       (Upstash, Blob, AI_GATEWAY_API_KEY)
    ├── ElevenLabs agent created    (Flash v2.5 pin, fr+en, Security overrides,
    │                                NEXT_PUBLIC_AGENT_ID in .env — Locked D8)
    ├── CI fix                      (make format; add typecheck+lint steps)
    └── app/layout.tsx              (dynamic <html lang>)
    │
    ├──────────────────────┬──────────────────────────────────┐
    ▼                      ▼                                  ▼
Phase 1 — Track A          Phase 1 — Track B                  (parallel)
foundations                foundations
    │                          │
    ├── seed fixture           ├── lib/i18n/* (dictionary, en.ts, fr.ts)
    ├── lib/store/plan.ts      ├── language-picker.tsx wiring
    ├── lib/timeline/schedule  ├── check-in/page.tsx (locale + plan → prompt)
    └── /plan page rebuild     └── voice-session.tsx gains locale prop
    │                          │
    ▼                          ▼
Checkpoint 1: both read/write the same Plan object; /plan renders a seeded
timeline; a check-in session starts in en, then a second ear-test in fr.
    │                          │
    ├──────────────────────┐   ├──────────────────────────────┐
    ▼                      ▼   ▼                                ▼
Phase 2 — Track A          Phase 2 — Track B
    │                          │
    ├── Blob client upload     ├── server tools: log_step,
    ├── extract route              escalate_to_next_of_kin
    │   (AI SDK call)          ├── client tool: show_red_flag
    ├── upload-panel.tsx       ├── lib/escalation/rules.ts
    └── lib/drugs/lookup.ts    ├── /family page + escalation-card
                               └── incoming check-in notification card
    │                          │
    ▼                          ▼
Checkpoint 2: upload → extraction → timeline works end to end on real data;
a voice call logs adherence, and a missed high-stakes med shows on /family
from a second device within one poll cycle.
    │                          │
    ├──────────────────────┐   ├──────────────────────────────┐
    ▼                      ▼   ▼                                ▼
Phase 3 — Track A          Phase 3 — Track B
    │                          │
    ├── red-flag card +        ├── French confirm-before-log +
    │   source-trace UI            answer chips (ASR safety, not a fallback)
    ├── accessibility fixes    ├── accessibility fixes on
    │   on plan/upload              voice/family/check-in
    └── polish, loud errors    └── demo rehearsal, seed script

Checkpoint 3 (final): full demo runs twice without intervention.
```

## Task List

### Phase 0: Shared Foundation (both coders, together — do not split this)

> **Status 2026-07-25:** provisioning for Redis, Blob, AI Gateway, and
> `XI_API_KEY` is **done** (local + Vercel). Claude Vercel MCP is
> authenticated. Env layout: `.env` = `NEXT_PUBLIC_*` only; `.env.local` =
> quoted secrets. See `tasks/todo.md §Setup status` for the full table.
> **Task 0.1 remaining work is only the ElevenLabs agent** (id still
> placeholder). Do not re-run Marketplace install or mint new gateway keys
> unless a probe fails.

- [ ] **Task 0.1: Create the ElevenLabs agent** (infra already provisioned).
  Per Locked D8 / D10: create the **Portico** Conversational AI agent (not
  named Juno); pin `tts.model_id = "eleven_flash_v2_5"`; add French; enable
  Security overrides (`prompt.prompt`, `first_message`, `language`,
  `tts.voice_id`, `asr.keywords`); put the real agent id in
  `NEXT_PUBLIC_AGENT_ID` (`.env` + Vercel all envs). Re-verify the model pin
  after adding French — if it drifted, fix it before continuing (do not ship
  a silent mismatch).
  - Already verified (do not redo unless broken): Upstash + Blob +
    `AI_GATEWAY_API_KEY` + `XI_API_KEY` on Vercel; AI Gateway `/v1/models`
    200; ElevenLabs `/v1/user` 200.
  - Files: `.env`, `.env.local`, `.env.example` (layout already cleaned)
  - Verify: signed-URL request for the **new** agent id succeeds; one English
    + one French ear-test (or defer French ear-test to Checkpoint 1, but
    agent + pin + overrides must exist before Track B voice work).

- [ ] **Task 0.2: `lib/plan/schema.ts` — the shared contract.** Port the Zod
  schema from `01-track-1-clinical-schema.md §Zod-4 sketch` verbatim, plus the
  French translation slot on `RedFlag` per Locked D7. Both coders read this
  file before writing anything else.
  - Files: `lib/plan/schema.ts`
  - Acceptance: exports `ExtractedBundle`, `type ExtractedBundle`, and every
    sub-schema is composable for the model-facing variant (documents minus
    `blobUrl`/`blobPathname`).
  - Verify: `pnpm typecheck` passes; a hand-written JSONC example from the
    audit file parses successfully in a scratch script.

- [ ] **Task 0.3: `lib/store/redis.ts` + `lib/env.ts` extension.** Lazy client
  factory (never module-scope construction — verified crash otherwise). Add
  `llmEnv()`, `blobEnv()`, `redisEnv()` beside the existing `serverEnv()`.
  - Files: `lib/store/redis.ts`, `lib/env.ts`
  - Acceptance: four separate functions, not one fat schema — a missing AI
    Gateway key must not break the Redis-only parts of the app.
  - Verify: `next build` succeeds with real env; fails loudly (not silently)
    if a var used by an imported function is missing.

- [ ] **Task 0.4: Fix CI.** Run `make format` (repo is currently red on
  `plan/raw-transcript.md`). Add `pnpm typecheck` and `pnpm lint` as new CI
  steps in `.github/workflows/ci.yml`.
  - Files: `.github/workflows/ci.yml`, whatever `make format` touches
  - Verify: a fresh PR shows three green checks, not one.

- [ ] **Task 0.5: Fix `<html lang>` in `app/layout.tsx`.** Make it dynamic
  (`await getLocale()`) instead of hardcoded `"en"` — root layout becomes
  async, which is expected and fine. French uses the existing `latin` subset;
  no Welsh `latin-ext` work.
  - Files: `app/layout.tsx`
  - Verify: with locale `fr`, view-source / a11y tree shows `lang="fr"`.

- [ ] **Task 0.6: Correct the override-failure documentation — loud is
  correct.** `README.md` and the comment in `components/voice/voice-session.tsx`
  both claim a disallowed override is silently ignored. The docs say it
  **throws**. Fix both. Do not add catch-and-continue around that throw
  [Locked D9].
  - Files: `README.md`, `components/voice/voice-session.tsx` (comment only)
  - Verify: text now says overrides throw when disabled, matching
    `[02 §Correction 1]`.

**Checkpoint 0:** `pnpm typecheck && pnpm lint && pnpm format:check` all pass.
Both coders can import `ExtractedBundle` and `redis()`. Branch into tracks.

---

### Track A: Ingestion, Timeline, Drug Data

**Owns:** everything from a photographed letter to a rendered day-by-day plan
with drug context attached. Vertical slice, touches both `lib/` and UI.

#### Phase 1 (Track A)

- [ ] **Task A1: Seed fixture.** `lib/plan/samples/demo-plan.ts` — one
  condition-agnostic sample `satisfies ExtractedBundle`, built from the
  verbatim strings already gathered in `01-track-1-clinical-schema.md`'s
  JSONC example (they are lifted from real NHS leaflets, so they're
  realistic). `POST /api/seed` writes it to Redis.
  - Files: `lib/plan/samples/demo-plan.ts`, `app/api/seed/route.ts`
  - Acceptance: `curl -X POST localhost:3000/api/seed` populates
    `portico:plan:demo` and `portico:patient:demo`.
  - Dependencies: Task 0.2, 0.3.

- [ ] **Task A2: `lib/store/plan.ts`, `lib/store/patient.ts`.** Read/write with
  `ExtractedBundle.parse()` on every read (Redis reads are a trust boundary).
  - Files: `lib/store/plan.ts`, `lib/store/patient.ts`
  - Verify: a manually corrupted Redis value throws a clear parse error
    instead of `undefined` three components deep.

- [ ] **Task A3: `lib/timeline/schedule.ts` — pure functions.** `buildTimeline
  (bundle, today) => Day[]`, `dueToday(bundle, today) => Item[]`. No I/O, no
  React import — this runs both server-side (rendering `/plan`) and inside a
  voice tool handler later.
  - Files: `lib/timeline/schedule.ts`
  - Acceptance: handles all three `DateAnchor` variants (`offset`, `date`,
    `conditional`); a `conditional` anchor never produces a day number.
  - Verify (if time allows a test): a handful of vitest cases per anchor
    variant.

- [ ] **Task A4: Rebuild `/plan`.** Replace the placeholder. Async Server
  Component: `Promise.all([readPlan(), readLog(today)])`, call
  `buildTimeline`, render `<Timeline/>`.
  - Files: `app/(phone)/plan/page.tsx`, `components/plan/timeline.tsx`,
    `day-section.tsx`, `task-row.tsx`
  - Acceptance: renders the seeded demo plan as a day-by-day list inside the
    phone frame (no `dvh`/`vh`, fills with `flex min-h-0 flex-1 flex-col`).
  - Dependencies: A1, A2, A3.

**Checkpoint 1 (joint with Track B):** `/plan` shows a real timeline from
Redis. `/check-in` (Track B) starts a session with the same plan's data in
its system prompt. Both are reading `portico:plan:demo`.

#### Phase 2 (Track A)

- [ ] **Task A5: Blob client upload.** `app/api/blob/upload/route.ts` mints a
  token via `handleUpload`; `components/upload/upload-panel.tsx` calls
  `upload()` from `@vercel/blob/client` directly from the browser (not a
  server `put()` — phone-camera bundles exceed the serverless body limit).
  - Files: `app/api/blob/upload/route.ts`, `components/upload/upload-panel.tsx`
  - Decide first: `public` vs `private` access — Open Question in the spec.
    Ask the human; do not quietly pick one mid-PR [Locked D9].
  - Verify: a multi-page photo bundle uploads without hitting a body-size
    error.

- [ ] **Task A6: `lib/extraction/extract.ts` + `/api/extract`.** AI SDK call:
  `generateText` + `Output.object({ schema: ExtractedBundleFromModel })`.
  **Verify the exact API shape against `node_modules/ai/docs/` after
  installing** — the audit's description is from a bundled skill reference,
  not the live package. Merge `blobUrl`/`blobPathname` back in after parse
  (never ask the model for a URL). Re-validate the merged object with the
  full `ExtractedBundle` schema before writing to Redis.
  - Files: `lib/extraction/extract.ts`, `app/api/extract/route.ts`
  - Fetch the live model ID rather than hardcoding:
    `curl -s https://ai-gateway.vercel.sh/v1/models | jq ...`
  - Acceptance: a real photographed letter produces a plausible
    `ExtractedBundle`; a `safeParse` failure returns a 422 with a plain
    sentence, not a 500.
  - Dependencies: A5, 0.2.

- [ ] **Task A7: `lib/drugs/lookup.ts` — NHS.uk fetch + Redis cache.** Resolve
  slugs against the cached A-Z index; extract every `identifier: "urgent"`
  block across **all** `hasPart` aspects (not just side-effects — the
  overdose warning lives elsewhere). 24-hour TTL. On miss, return typed
  `null` meaning "not on NHS.uk A–Z" — a named empty result, **not** a
  substitute side-effect blurb and not a fake cache hit [Locked D9].
  - Files: `lib/drugs/lookup.ts`, `app/api/drug-info/route.ts`
  - **Guard:** `/api/drug-info` must validate the requested drug against the
    names already in the patient's stored plan and 404 anything else — this
    is what keeps the feature inside the scope line (no open drug lookup).
  - Verify against real drugs: apixaban and rivaroxaban both return rich
    urgent blocks; enoxaparin/dalteparin return `null` (confirms why the demo
    must use the oral agent).
  - Dependencies: A6 (needs a real medication list to look up).

- [ ] **Task A8 (stretch only if NHS.uk is flaky in rehearsal):** commit
  `data/nhs-medicines-seed.json` for the demo letter's specific drugs.
  Resolution order must be explicit and logged (Redis → seed → network) —
  never a silent substitute that looks like a live NHS hit.

**Checkpoint 2 (joint):** A real photographed letter → extraction → timeline
→ drug context, all working live. Track B's voice tools can log against this
real plan instead of the seed.

#### Phase 3 (Track A)

- [ ] **Task A9: Red-flag card + source-trace UI.**
  `components/plan/red-flag-card.tsx` renders `triggerVerbatim` +
  `actionVerbatim` with visual precedence (doctor's words primary, any
  NHS-derived content visibly secondary, per `[03 §Safety framing]`). A "tap
  to see where it says that" affordance opens the source Blob image.
  - Files: `components/plan/red-flag-card.tsx`
  - Acceptance: NHS-derived text always carries its attribution line inline,
    per the licence bucket (English-unmodified vs any-translation) —
    structural, not optional.

- [ ] **Task A10: `components/plan/task-check.tsx`.** The one client leaf in
  the otherwise-server-rendered timeline. Optimistic tick, `POST /api/log`,
  `router.refresh()`.
  - Files: `components/plan/task-check.tsx`
  - Dependencies: Track B's `/api/log` route (Task B4) — coordinate here,
    it's the seam between tracks.

- [ ] **Task A11: Accessibility pass on plan/upload screens.** Fix contrast
  (`ink-faint` is 2.74:1, do not use for text), ≥44px targets, empty/error
  states in plain language, `prefers-reduced-motion` if any motion was added.
  - Files: touched components from A4, A5, A9

**Checkpoint 3 (Track A complete):** Upload a real letter on stage, watch the
timeline build, tap a red flag, see the source photo.

---

### Track B: Voice, Escalation, Family Dashboard, i18n

**Owns:** everything from "the patient taps the check-in card" through "the
family sees an escalation", plus making all of it work in English and French.

#### Phase 1 (Track B)

- [ ] **Task B1: `lib/i18n/` — the dictionary module.** `locales.ts`
  (`REAL_LOCALES = ["en","fr"]`, `SHOWCASE_LOCALES = ["cy","pl","ro","tr",
  "pt","es"]`, `LOCALE_COOKIE`), `dictionary.ts` (`getLocale()` reads cookie,
  then `Accept-Language` only to pick an initial real locale — never to
  invent a half-translated screen; `getDictionary(locale)`), `en.ts`,
  `fr.ts` (`satisfies Dictionary` — a missing French key is a **compile
  error**, not a runtime English fallthrough [Locked D9]).
  - Files: `lib/i18n/locales.ts`, `dictionary.ts`, `en.ts`, `fr.ts`
  - Acceptance: covers all ~55 strings enumerated in `[04 §Why the
    zero-dependency option wins]` plus the persona content below.
  - No Zod needed here — a cookie value narrowed by a two-branch comparison
    is already typed.

- [ ] **Task B2: `app/actions/set-locale.ts` + wire the picker.** Server
  action sets the cookie, `revalidatePath`. `components/language-picker.tsx`
  row handler calls it instead of just closing the menu. Also: delete the
  `FlagIcon` set (flags-for-languages is explicitly banned), filter out the
  currently-active locale from the list, remove the hardcoded "Default"
  badge, raise every row to ≥44px, put the same top-right control on every
  screen.
  - Files: `app/actions/set-locale.ts`, `components/language-picker.tsx`
  - Acceptance: picking Français reloads the page in French; picking a
    showcase language shows an in-language "not yet" panel — never a silent
    English fallthrough, never two languages on one screen.

- [ ] **Task B3: `lib/check-in-prompt.ts` → `buildCheckInPrompt(bundle, today,
  locale)`.** Split the persona into authored `en` / `fr` content inside the
  dictionary (**no** machine translate). Compose today's plan slice + the
  persona + the "I'm not a clinician" line + the red-flag verbatim block into
  one system prompt string (the override *replaces* the dashboard prompt —
  nothing outside this string exists at runtime). Rewrite `firstMessage` per
  `[02 §firstMessage — rewrite it]`. Fix `SUGGESTED_QUESTIONS` — "Is this
  normal after surgery?" is generic clinical Q&A and must be replaced or
  the prompt must force a plan-grounded/route-to-human answer.
  - Files: `lib/check-in-prompt.ts`
  - `check-in/page.tsx` becomes async: `await getLocale()`, read the plan,
    call `buildCheckInPrompt`, pass props into `<VoiceSession>`.
  - Dependencies: B1, A2 (needs `readPlan`), Task 0.1 (agent must exist).

- [ ] **Task B3.5: `voice-session.tsx` gains a `locale` prop.** Replace the
  hardcoded `overrides.agent.language: "en"` at line ~225 with the prop
  (`"en" | "fr"`).
  - Files: `components/voice/voice-session.tsx`
  - Verify: English session first (regression), then French ear-test on the
    pinned Flash v2.5 agent. If French audio is wrong, **stop** — do not
    downgrade to English voice under French UI [Locked D9].

**Checkpoint 1 (joint with Track A):** see Track A's Checkpoint 1. A
check-in session starts, reads the seeded plan, speaks English; a second
session speaks French on the same pinned agent.

#### Phase 2 (Track B)

- [ ] **Task B4: Server tools — `log_step`, `escalate_to_next_of_kin`.**
  `app/api/log/route.ts`, `app/api/escalate/route.ts`. Bind `patient_id` and
  `check_in_id` as **dynamic variables** (never model-filled), authenticate
  with a `secret__`-prefixed header variable. Register the tools on the
  ElevenLabs agent (dashboard/API, outside this repo) with `method: "POST"`
  explicitly (default is GET).
  - Files: `app/api/log/route.ts`, `app/api/escalate/route.ts`
  - **The localhost trap:** ElevenLabs' backend calls this URL — it cannot
    reach a dev machine. Decide a stable deployed alias early and point the
    agent's tool config at it once, rather than re-editing on every push.
  - The escalation *threshold* (twice-in-three-days) lives in
    `lib/escalation/rules.ts` (Task B5), not in the tool or the prompt — the
    agent only reports an event.

- [ ] **Task B5: `lib/escalation/rules.ts` — pure function.**
  `assess(bundle, logs, today) => { kind: "none" } | { kind: "nudge"; ... } |
  { kind: "alert-kin"; ... }`. Exhaustive `switch` at every call site.
  - Files: `lib/escalation/rules.ts`
  - Dependencies: A2/A3 patterns (same purity argument — must import nothing
    server-only, since a future tool handler could call it too).

- [ ] **Task B6: `show_red_flag` client tool.** `useConversationClientTool`
  inside `Session` in `voice-session.tsx`. Never throws internally (catch and
  return a plain string) — an uncaught error paints a red connection-error
  banner over the transcript on the projector.
  - Files: `components/voice/voice-session.tsx`
  - Verify: register the tool name exactly matching the agent config
    (case-sensitive); do **not** supply `onUnhandledClientToolCall` unless
    sending a result manually — it hangs the agent otherwise.

- [ ] **Task B7: Enable the live-tick UI without a second tool.** Wire
  `onAgentToolRequest` / `onAgentToolResponse` callbacks in `useConversation`
  to optimistically tick a step in the transcript UI as the server tool
  fires. **Prerequisite, must be set on the agent (not per-session):**
  `agent_tool_request` / `agent_tool_response` in
  `conversation_config.conversation.client_events`.
  - Files: `components/voice/voice-session.tsx`

- [ ] **Task B8: `/family` dashboard.** Async Server Component:
  `Promise.all([readPatient(), readPlan(), readLog(recentDays)])`, call
  `assess()`, render `<EscalationCard/>`. `export const dynamic =
  "force-dynamic"`.
  - Files: `app/(phone)/family/page.tsx`, `components/family/escalation-card.tsx`
  - Dependencies: A2, B5.

- [ ] **Task B9: `components/family/refresh-poller.tsx`.** The one client
  leaf on `/family`: `setInterval(() => router.refresh(), 5000)`, cleanup,
  returns `null`.
  - Files: `components/family/refresh-poller.tsx`
  - Verify with a real two-window test: log a miss on one device, watch it
    appear on another within 5s. Confirm `force-dynamic` is actually
    preventing a cached render (do not assume).

- [ ] **Task B10: Incoming check-in notification card (Tier A only — do NOT
  build Web Push).** A variant of `IdleView` that reads as an incoming
  check-in: orb, "Portico — your check-in", one large **Answer** button. Trigger
  from a due-time check or a discreet operator control for the demo.
  - Files: `components/voice/voice-session.tsx` (or a new sibling component),
    home page wiring
  - Explicitly excluded: any Notifications API permission request, any
    service worker, any manifest. `[02 §Tier C — do not build]`.

**Checkpoint 2 (joint):** A voice call logs adherence via a server tool; the
UI ticks live via the callback path; a second miss on a high-stakes med
produces a visible escalation on `/family` from a different device.

#### Phase 3 (Track B)

- [ ] **Task B11: French voice confirmation (early, not a soft fallback
  plan).** Agent + pin + overrides come from Task 0.1. Before polishing UI:
  1. Confirm `tts.model_id` is still `eleven_flash_v2_5` after any dashboard
     edits.
  2. One real session with `overrides.agent.language: "fr"` and authored
     French `firstMessage` / prompt.
  3. Ear-test TTS and ASR **separately**. Bad audio with HTTP 200 is a
     **failed** spike — escalate to the human; do **not** ship French UI +
     English voice [Locked D9].
  - Dependencies: 0.1, B3, B3.5.

- [ ] **Task B12: High-stakes ASR safety (not a language fallback).**
  `overrides.asr.keywords` seeded from the plan's actual drug names plus
  French/English yes-no tokens (needs Security toggle
  `ASRConversationalConfigOverrideConfig.keywords`). Tappable French answer
  chips via `SuggestedQuestions`. Confirm-before-logging on high-stakes
  steps. Composer stays available as an **explicit** typed path the user
  chooses — not a silent substitute for broken ASR.
  - Files: `components/voice/voice-session.tsx`,
    `components/voice/suggested-questions.tsx`

- [ ] **Task B13: Accessibility pass on voice/family/check-in screens.**
  `prefers-reduced-motion` block in `globals.css` stopping the orb's pulse
  and the listening/thinking dots (state stays legible via the existing
  `aria-live` text label). Standardise `focus-visible` treatment across every
  interactive element — several currently have none.
  - Files: `app/globals.css`, various

- [ ] **Task B14: Demo rehearsal + seed script.** A `make seed` target
  (`curl -X POST localhost:3000/api/seed`) resets to a known state — two
  prior misses on the clot-preventer, so the escalation is already primed.
  Write the operator runbook steps from `[02 §What the demo operator does]`
  onto a physical card or a pinned note.
  - Files: `Makefile` (add `seed` target)

**Checkpoint 3 (Track B complete):** the full demo arc runs twice
back-to-back without manual Redis surgery between runs.

---

## Checkpoints Summary

- **Checkpoint 0** (both, ~1h in): shared contract compiles, CI green,
  provisioning confirmed.
- **Checkpoint 1** (~4–5h in): a seeded plan renders on `/plan` and drives a
  real voice session in the chosen language.
- **Checkpoint 2** (~10–12h in): the full loop is real — upload, extract,
  check in, log, escalate, see it on a second screen.
- **Checkpoint 3** (final, before sleep/demo): polish, accessibility,
  rehearsal. Run the demo twice.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Medic's scenario/bundle lands late or doesn't match the schema | High — blocks real extraction testing | Seed fixture (A1) is condition-agnostic and usable standing alone; extraction (A6) is additive |
| Agent model pin drifts after adding French (silent bad TTS) | High — classic Welsh/v2.5 class of failure | Task 0.1 + B11 re-verify `eleven_flash_v2_5`; ear-test; **stop** on bad audio — no English-voice downgrade [D8, D9] |
| Two coders both editing `voice-session.tsx` | Medium — merge conflicts in the highest-traffic file | Sequence B3.5 → B6 → B7 → B12 as commits, not parallel edits; Track A never touches this file |
| ElevenLabs server tool can't reach localhost during dev | Medium — "the tool never fires" debugging session | Decide a stable deployed alias in Task B4 before writing tool code, not after |
| AI SDK call shape differs from the audit's description (marked `[verify after install]`) | Medium — A6 blocked | Install `ai` first, read `node_modules/ai/docs/` before writing the call, budget 30 min for this |
| `next build` crashes on a module-scope client construction | Low, verified fix exists | Every store module follows the lazy-factory pattern in Task 0.3; code review checks for `Redis.fromEnv()` at module scope |
| Someone "helps" by catching override/env errors and continuing | High — recreates silent fallbacks | Locked D9; code review rejects catch-and-ignore around `xxxEnv()` and override failures |

## Open Questions

See `plan/spec.md §Open Questions` — unchanged, not duplicated here.
