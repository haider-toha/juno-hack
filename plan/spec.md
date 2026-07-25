# Spec: Portico — Post-Discharge Recovery Companion

Status: validated for build. Grounded in `audit/juno-recovery-companion/00-locked-decisions.md`
(human decisions, supreme) and Phase 1 research tracks 01–05. Citations like
`[01 §Verdict]` point at `audit/juno-recovery-companion/0N-*.md`.

**Product name: Portico** [Locked D10]. Juno is the hackathon host, not the brand.
Repo/Vercel may still use `juno-hack` as a project slug.

## Objective

A patient photographs their NHS discharge bundle. Portico extracts it into a
structured plan, renders it as a day-by-day recovery timeline in plain
language, and an ElevenLabs voice agent checks in daily — reads today's steps,
logs adherence, matches reported symptoms only against the red-flag lines the
doctor actually wrote, and escalates a pattern of missed high-stakes
medication to a family member via an in-app dashboard.

**Guiding principle, unchanged, decides every feature:** the app only ever
reformats, schedules and reads back the clinician's own words, and routes to
humans. It never generates new clinical judgement. Any feature that fails this
test is cut, no matter how good the demo beat.

**User:** initially framed around an elderly patient with family support: the
demo persona is a patient recovering at home, with a family member who gets a
dashboard. The scenario (surgical vs. medical, which drug, which condition) is
**not yet fixed** — the medic collaborator is generating the real discharge
bundle and has explicitly pushed back on hip replacement as too narrow. Build
the product **condition-agnostic**; do not hard-code around one procedure.

**Success looks like:** a live demo where (1) a photographed letter becomes a
timeline in front of judges, (2) a voice check-in happens in English or French
inside a single tap, with no phone call, (3) a missed high-stakes medication
appears on a second-screen family dashboard within seconds, and (4) a mentioned
symptom triggers a verbatim read-back of the surgeon's own red-flag line, never
a diagnosis.

## Tech Stack

- **Framework:** Next.js 16.2.9, App Router, TypeScript 6.0.3, React 19.2.7.
- **Styling:** Tailwind v4.3.1, CSS-first — tokens in `app/globals.css`
  `@theme`, no `tailwind.config.js`.
- **Validation:** Zod 4.4.3, at trust boundaries only.
- **Voice:** `@elevenlabs/react` ^1.8.0 (resolves to 1.10.2), existing wiring in
  `components/voice/`.
- **LLM:** Vercel AI SDK (`ai`) through the **Vercel AI Gateway** — a
  `"provider/model"` string, no direct provider package. `generateText` +
  `Output.object`; `generateObject` is deprecated [05 §Rationale, `lib/extraction/extract.ts`].
- **Persistence:** **Upstash Redis** (`@upstash/redis`) for all application
  state; **Vercel Blob** (`@vercel/blob`) for uploaded letter images/PDFs. No
  Supabase, no Postgres, no ORM [Locked D1].
- **Deploy:** Vercel. Project linked: `haider-projects/juno-hack`.

## Commands

```bash
make setup      # pnpm install + .env from example
make dev        # :3000
make format     # prettier — the only thing CI enforces today
make lint       # eslint — passes today, not yet in CI
make typecheck  # tsc --noEmit — passes today, not yet in CI
vercel env pull .env.local --yes   # after provisioning Upstash/Blob/AI Gateway
```

Both `pnpm typecheck` and `pnpm lint` pass today with no env vars and should be
added to CI immediately — free wins [05 §Toolchain]. Do **not** add `pnpm
build` to CI without dummy `NEXT_PUBLIC_*` values; verified it fails at
`lib/env.ts:12` otherwise [05 §Toolchain].

## Project Structure

```
app/
  layout.tsx                    ~ <html lang> tracks locale
  (phone)/
    layout.tsx                  = UNCHANGED — no provider needed, state is in Redis
    error.tsx                   + one route-group error boundary
    page.tsx                    ~ home gains a "due today" summary
    upload/page.tsx             + server shell -> <UploadPanel/>
    plan/page.tsx               ~ replaces the placeholder
    family/page.tsx             + async server component + <RefreshPoller/>
    check-in/page.tsx           ~ reads locale + plan, builds the prompt
  api/
    eleven/signed-url/route.ts  = untouched
    blob/upload/route.ts        + mints the Blob client-upload token
    extract/route.ts            + { blobUrls } -> AI SDK -> ExtractedBundle -> Redis
    log/route.ts                + records an adherence entry
    escalate/route.ts           + records an escalation decision
    locale/route.ts             + sets the locale cookie
    drug-info/route.ts          + scoped to THIS plan's drugs only
    seed/route.ts               + writes a sample patient + plan into Redis
components/
  icons.tsx                     ~ add IconUpload, IconPill, IconAlert, IconCheck
  language-picker.tsx           ~ rows call setLocale + router.refresh()
  upload/upload-panel.tsx       + "use client" — file input, Blob upload, extract call
  upload/extracted-preview.tsx    no directive
  plan/timeline.tsx, day-section.tsx, task-row.tsx, red-flag-card.tsx   no directive
  plan/task-check.tsx           + "use client" — the ONE interactive leaf in the timeline
  family/escalation-card.tsx      no directive
  family/refresh-poller.tsx     + "use client" — router.refresh() on an interval
  voice/voice-session.tsx       ~ locale prop, client tool, plan-aware copy
  voice/* (orb, transcript, composer, suggested-questions)   = unchanged shape
lib/
  env.ts                        ~ add llmEnv(), blobEnv(), redisEnv()
  check-in-prompt.ts            ~ becomes buildCheckInPrompt(plan, today, locale)
  plan/schema.ts                + THE SHARED CONTRACT — see below
  plan/samples/*.ts             + throwaway seed fixtures, `satisfies ExtractedBundle`
  store/redis.ts                + the only Redis client construction
  store/plan.ts, log.ts, patient.ts   + read/write with schema.parse on read
  timeline/schedule.ts          + pure: buildTimeline(plan, today), dueToday(...)
  escalation/rules.ts           + pure: assess(plan, logs, today) -> discriminated union
  extraction/extract.ts         + server-only AI SDK call
  drugs/lookup.ts               + server-only NHS.uk fetch + cache
  i18n/locales.ts, dictionary.ts, en.ts, fr.ts   + typed dictionary, no library
```

### End-to-end flow (one path, no surprises)

This is the whole product. Every step is explicit. There is no alternate
"degraded" path that pretends to be the happy path [Locked D9].

```
1. Locale chosen (en | fr)          → cookie. Fixed for the session.
2. Upload letter photos/PDFs        → Vercel Blob (client upload token)
3. Extract                          → AI Gateway + AI SDK → ExtractedBundle
                                      → Zod parse → Redis  (422 on bad parse)
4. Drug context (ingestion-time)    → NHS.uk A–Z for THIS plan's drugs only
                                      → cache in Redis; typed null if absent
5. /plan                            → pure buildTimeline(bundle, today)
6. Check-in tap                     → getUserMedia → signed URL → startSession
                                      (all inside the same gesture)
7. Voice session                    → overrides: authored prompt + firstMessage
                                      + language "en"|"fr" on pinned Flash v2.5
8. log_step / escalate (server)     → Redis; UI ticks via client_events
9. show_red_flag (client tool)      → verbatim doctor line on screen
10. /family                         → assess() + 5s router.refresh() poll
```

**If any step cannot run with its real dependency, it fails loudly** (throw,
422, red banner). It does not fall back to mock data, English voice, another
TTS model, or a half-translated UI.

Full rationale and file:line citations for every item: `[05 §Proposed structure]`.

### The shared contract

`lib/plan/schema.ts` — the `ExtractedBundle` Zod schema — is **the single most
important artifact in this build.** Both tracks read and write it from hour
one. It must be agreed and committed **before** either track writes feature
code. Full schema, JSONC example and field-by-field rationale:
`[01 §Draft extraction schema]`. Key properties, non-negotiable:

- **No `timeline[]`.** The model emits dated facts (`DateAnchor` variants:
  `offset | date | conditional`); a pure function `(bundle, today) => Day[]`
  computes the schedule. This is the highest-leverage decision in the schema
  — it removes hallucinated day arithmetic entirely [01 §V5, §I3].
- **Every clinical string that reaches the patient is `*Verbatim`**, paired
  with a non-nullable `SourceRef { documentId, page, quote, readConfidence }`
  pointing at a durable Vercel Blob URL. If you cannot produce the quote, you
  do not get to say the thing [01 §I1, §I2, §I10].
- **Red flags are a pair**, never a single string:
  `{ triggerVerbatim, actionVerbatim, contactIds, escalationChannel,
  matchHints }`. `escalationChannel` is derived **only** from the recipient
  named in `actionVerbatim`, never from the symptom [01 §V6, §V7, §I7].
  `matchHints` is model-generated but structurally quarantined — used only to
  **route** speech to a verbatim line, never rendered or spoken [01 §I6].
- **Absence is representable.** Every clinical field is `.nullable()` (never
  `.optional()` — forced by OpenAI strict mode and by Redis round-tripping
  alike); `extraction.unresolved[]` and `extraction.conflicts[]` are required
  arrays, may be empty [01 §I4, §I5].
- **`episode.kind: "surgical" | "medical" | "other"`**, no surgery-shaped
  top-level fields. The medic has not picked a scenario and pushed back on
  hip replacement [Locked, standing constraints; 01 §V13].
- **JSON round-trippable, always.** No `Date`, `Map`, `Set`, `undefined`. Dates
  are ISO-8601 strings; timeline arithmetic parses to a `Date` inside the pure
  function and discards it on return, never stores one [01 §I9].
- **Translation field for red flags (Locked D7).** Every `RedFlag` needs a
  slot for a French translation stored alongside — never replacing — the
  verbatim English. See UI/UX section below for the render rule.

## Code Style

One real example beats a paragraph. This is the shape every new module
follows — lazy secret access, Zod at the boundary, narrow error surface:

```ts
// lib/store/redis.ts — the ONE place a Redis client is constructed.
// Mirrors lib/env.ts:21-27's lazy serverEnv() pattern exactly.
import { Redis } from "@upstash/redis";
import { redisEnv } from "@/lib/env";

let client: Redis | null = null;

export function redis(): Redis {
  if (client === null) {
    const { url, token } = redisEnv();
    client = new Redis({ url, token }); // NOT Redis.fromEnv() — env.ts stays
  } // the single config boundary (CLAUDE.md: import env, never process.env).
  return client;
}
```

```ts
// lib/store/plan.ts — every Redis read is a trust boundary (a network call),
// so it is parsed, per CLAUDE.md's carve-out for genuinely uncertain input.
import { ExtractedBundle } from "@/lib/plan/schema";
import { redis } from "@/lib/store/redis";

export async function readPlan(
  patientId: string,
): Promise<ExtractedBundle | null> {
  const raw = await redis().get(`portico:plan:${patientId}`);
  if (raw === null) return null;
  return ExtractedBundle.parse(raw); // loud failure > silent wrong data
}
```

- Discriminated unions over booleans, everywhere (`type Phase = "idle" |
  "conversation"` is the existing house style — `voice-session.tsx:19`).
- `satisfies`, never `as`, for config-shaped literals (seed fixtures,
  dictionaries).
- `kebab-case.tsx` files exporting one `PascalCase` component. `use-*.ts` for
  hooks. No barrel `index.ts` files.
- Server Components by default. `"use client"` only at the leaf that needs
  it — never a page or layout. The two client boundaries today are
  `components/voice/voice-session.tsx` and `components/language-picker.tsx`;
  new client leaves are `task-check.tsx`, `refresh-poller.tsx`,
  `upload-panel.tsx` [05 §Established patterns 1].

## Testing Strategy

No test runner exists today. Given the timebox, add one only for the two pure
modules where a silent bug is invisible until the demo:

- `lib/timeline/schedule.ts` — date arithmetic across `offset | date |
  conditional` anchors. Wrong math here is the kind of bug nobody notices
  until day 7 on stage.
- `lib/escalation/rules.ts` — the "missed twice in three days on a high-stakes
  med" rule. This is the exact claim spoken on the family dashboard; it must
  be correct.

If `vitest` is added, keep it to these two files. Everything else — the
upload flow, the voice session, the family dashboard — is verified by running
the app and watching it, not by a test suite; there is no time budget for
more, and CLAUDE.md's "every line justifies itself" cuts against test
scaffolding nobody asked for.

**Minimum CI addition, do this first:** `pnpm typecheck` and `pnpm lint` as
new CI steps. Both pass today, need no env vars, and CI is currently red on
`prettier --check` alone [05 §Toolchain — CI is red right now].

## Boundaries

**Always do:**
- Run `make format` before every push (CI enforces it and is currently red).
- Treat `lib/plan/schema.ts` as the shared contract — any change is
  communicated to both tracks before merging, not discovered in review.
- Zod-parse at every trust boundary: LLM output, Redis reads, request bodies,
  external API responses (NHS.uk). Nowhere else.
- Keep the `getUserMedia → fetchSignedUrl → startSession` chain inside the
  direct user tap. Never move it into an effect, timeout or router transition.
- Every new secret goes into its own `xxxEnv()` function in `lib/env.ts`,
  never into the browser-safe `env` object.

**Ask first (surface to the human before proceeding):**
- Any change to `lib/plan/schema.ts` after both tracks have started building
  against it.
- Whether to build the Tier 3 email escalation stretch (Resend) — verify
  the free-tier sending restriction first [Locked D5 caveat].
- Blob access mode (`public` vs `private`) — the home screen already promises
  "we don't share your health information"; decide deliberately [05 §Blob
  access mode is undecided].
- Any change to the pinned TTS model or real locales (`en` / `fr`) — that is
  a Locked D4/D8 change, not a local tweak.

**Never do:**
- Add Supabase, Postgres, Neon, Prisma, Drizzle, or any ORM.
- Build a standing drug side-effect database, computer-vision pill ID, label
  OCR, open-web Q&A, an AI symptom-checker/triage feature, or
  discharge-conversation dictation — all explicitly cut; reintroducing any of
  these requires a named, flagged decision, not a quiet addition.
- Let the voice agent decide an escalation threshold — the rule lives in
  `lib/escalation/rules.ts`, deterministic and auditable; the agent only
  reports events.
- **Any silent fallback** [Locked D9]: English voice under a French UI;
  another TTS model when the pin drifts; mock Redis/Blob when env is missing;
  dictionary keys that fall through to English; catching override errors and
  continuing. The Welsh/v2.5 mismatch is the cautionary tale — do not recreate
  it for French.
- Leave the TTS model unpinned or trust the Additional Languages dropdown to
  keep `eleven_flash_v2_5` without re-verifying [Locked D8].
- Construct `Redis` or a Blob client at module scope — verified crash on
  `next build` when env is unset [05 §Toolchain — verified build behaviour].
- Ship a machine-translated French first message or system prompt.

## Success Criteria

Each is specific and independently checkable on demo night.

1. A photographed/uploaded discharge bundle produces a structured
   `ExtractedBundle` in Redis, with every red flag carrying a verbatim quote
   and a working link back to the source image.
2. `/plan` renders a day-by-day timeline computed by
   `lib/timeline/schedule.ts` from that bundle — no timeline field is stored.
3. A tap on the incoming check-in card opens a live ElevenLabs voice session
   inside that same tap, in the language chosen beforehand, with no phone
   call anywhere in the flow.
4. Saying "I took it" / "I haven't" on a plan item logs to Redis via a
   server tool and the tick appears in the browser via `onAgentToolRequest` /
   `onAgentToolResponse`, without a duplicate client tool.
5. Missing a high-stakes medication twice within the configured window
   produces an escalation record visible on `/family` within one poll cycle
   (≤5s), on a **different device/browser** than the one that logged it.
6. Mentioning a symptom that matches a red-flag line surfaces that exact
   line on screen, verbatim, via the one client tool, while Portico reads it
   aloud and never invents a diagnosis.
7. English and French both render every UI string with **no fallthrough to
   English**; French copy does not truncate at 320px width.
8. A French voice session runs on the pinned `eleven_flash_v2_5` agent with
   `overrides.agent.language: "fr"` — ear-tested TTS and ASR, no silent
   model/language mismatch [Locked D8, D9].
9. Selecting any showcase-only language (`cy pl ro tr pt es`) never mixes
   two languages on one screen — an in-language "not yet" panel, per
   `[04 §How the six showcase-only languages degrade]`.
10. `pnpm typecheck`, `pnpm lint` and `pnpm format:check` all pass on `main`.
11. Every button/tap target measures ≥44px; the six identified violations in
    `[04 §Target size]` are fixed.
12. `prefers-reduced-motion` stops the orb's pulse and the listening/thinking
    dots; state stays legible via the existing text label.

## Open Questions

Requiring a human decision; nothing else belongs here.

1. **Scenario and drug names are not yet fixed.** The medic has not chosen
   the clinical case. Action pending: `plan/medic-brief.md` has been sent;
   his reply picks the scenario and confirms apixaban/rivaroxaban as the
   clot-preventer [Locked D6 action item].
2. **Blob access: `public` vs `private`.** Affects extraction (URL vs bytes)
   and the "we don't share your data" promise already on screen. A product
   call, not a technical one — the hackathon data is synthetic either way.
3. **Whether to attempt the Tier 3 email escalation stretch at all**, pending
   verification of Resend's free-tier sending restriction [Locked D5].
4. **Whether time permits the `vitest` addition** for the two pure modules,
   given everything else in the timebox.

Settled (was open): second language is **French**, not Welsh [Locked D4].
Welsh Additional-Languages / V3 questions are obsolete.

## UI/UX & Accessibility

**Reading level.** Design to a reading age of 9; accept 11 only where a
medication or red-flag instruction cannot be simplified without losing
accuracy — matches the existing `CHECK_IN_PROMPT` and the NHS's own service
manual standard `[04 §A.1]`. Concrete, checkable rules, all cited in
`[04 §Plain-language & accessibility checklist]`:

- Sentences ≤20 words in English; keep French equally short and plain
  (aim ≤25 words — same spirit as Cymraeg Clir / plain-language rules).
- Paragraphs ≤3 sentences. Active voice. Plain word before medical term,
  never the reverse — expand TTO/BD/OD/PRN into words.
- **No negative contractions** ("do not", never "don't") — a safety rule:
  GDS research shows negative contractions are sometimes misread as their
  opposite `[04 §A.7]`.
- No block capitals anywhere (kills `app/not-found.tsx`'s current
  `uppercase tracking-[0.18em]` "404").
- Numerals for all numbers including 1 and 2. 12-hour times only (`5pm`, not
  `1700` or `17:00`) — the NHS Health Literacy Toolkit places 24-hour-clock
  comprehension above the numeracy level this product targets `[04 §A.10]`.
- Natural frequencies over percentages ("1 in 2", not "50%") — NICE NG197.
- Teach-back after every plan instruction, phrased as checking Portico's own
  explanation, never the patient: *"Just so I know I explained that
  clearly, when are you taking the next one?"* `[04 §A.18]`.
- Error messages name the problem and the fix, never "please"/"sorry"/
  "oops". Two existing strings in `voice-session.tsx` need rewriting
  `[04 §A.16]`.

**EN/FR parity.** `lib/i18n/` is a typed dictionary module, **not a library**
— justified by the actual surface size (~55 strings + one system prompt)
`[04 §i18n RECOMMENDATION]`. Locale in a cookie, no `[locale]` URL segment.
`fr.ts satisfies Dictionary` makes a missing French key a compile error —
**no runtime fallthrough to English** [Locked D9]. The voice persona
(`lib/check-in-prompt.ts`) is content, authored in both languages, never
machine-translated at runtime. Six required fixes to
`components/language-picker.tsx` (delete flag icons, filter out active
locale, remove the hardcoded "Default" badge, wire the row handler to a
server action, top-right placement on every screen, ≥44px rows) — full list
`[04 §Six required fixes]`.

**Red-flag translation rule (Locked D7).** In French mode, a red-flag card
shows the French translation **and** the doctor's exact English words
together, English labelled as the original. Everything else translates
cleanly, French only. Clinical proper nouns (drug names, condition names) are
never translated.

**Anti-slop checklist.** `CLAUDE.md` is law and overrides every design skill
where they conflict — enumerated in full, with every conflict named, in
`[04 §Merged anti-slop checklist]`. The three sharpest conflicts, because they
are the easiest to get wrong by following a skill's default instinct: **no
`dvh`/`vh` inside the phone shell** (a skill default that would break the
frame), **no icon library** (the skill default is Phosphor; this repo hand-
rolls `components/icons.tsx` and must keep doing so), **no monospace, ever**
(a skill default for numerals; this repo uses `.tnum` instead).

**Contrast fix required before shipping any new screen.** `text-ink-faint`
measures 2.74:1 against white — fails WCAG AA everywhere it's currently used
(placeholder text, status labels, chevrons) `[04 §Measured contrast]`. Demote
it to decorative-glyph duty only, or introduce a darker third ink tier.

## Grading Criteria Coverage

**Idea/concept.** The product's entire defence is one sentence, checkable by
a judge: *everything Portico says is either the patient's own discharge letter
or the NHS's own medicines page, read back verbatim with a link* — never
generated clinical content. This is structurally enforced by the schema
(§Shared contract above), not asserted in the pitch. The scope-creep test
from the original planning doc still applies to every future feature idea:
does it move the doctor's words around, or does it generate judgement?

**UI/UX & design.** Checkable against: the 12 numbered success criteria
above covering reading level, target size, contrast, motion and bilingual
parity; the merged anti-slop checklist `[04 §Merged anti-slop checklist]`;
and the existing design system (`app/globals.css` `@theme`, `rounded-tactile`/
`rounded-card`/`rounded-pill`, `shadow-card`, ≤66ch measure) extended, never
reinvented, on every new screen.

**End-to-end scope.** Checkable as: upload → extraction → timeline → voice
check-in → adherence log → escalation → family dashboard, all working against
real (Vercel-native) persistence, not a mock. The five architectural deltas
this required — prompt injection not RAG, NHS.uk not BNF, in-app tap not a
phone call, French on a pinned Flash v2.5 agent (not a silent model drift),
real storage not "we mocked it" — are each a demonstrable, defensible
engineering decision with cited evidence behind it, not an accident of
running out of time.

**Code quality and structure.** Checkable as: the shared `ExtractedBundle`
schema is the single source of truth for both the LLM call and every Redis
read; every new pattern extends a pattern already in the repo with a
file:line citation `[05 §Established patterns]`; Server/Client boundaries are
enumerated per-component with a stated reason `[05 §Server/Client boundary
plan]`; `pnpm typecheck` and `pnpm lint` pass and are in CI; no barrel files,
no `any`, no premature abstraction (rule of three held throughout).
