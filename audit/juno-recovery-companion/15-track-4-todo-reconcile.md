# 15 — Track 4: reconciling `tasks/todo.md` to the repo

**Date:** 2026-07-26 · **Branch:** `haider/track-a` · **Working tree:** uncommitted
(every track's work is in the tree, not committed — and it is the tree that was
deployed to production).

**Three reconciliation passes:** an independent inventory, then a pass against
Track 3's adversarial verification, then a pass against the deploy and tool
wiring. Final state: **42 of 51 boxes ticked.**

**Files this pass may edit:** `tasks/todo.md`, the §CURRENT REALITY table in
`tasks/plan.md`, and this file. **No product code was touched in any pass** —
other agents were building and verifying the same tree concurrently.

---

## Scope and method

`tasks/todo.md` carried its own warning that the boxes were not kept in sync
with the code. This pass establishes, per task, what the repository actually
contains, and rewrites the checklist so it can be read cold at 2am.

Three passes, deliberately in this order:

1. **Independent inventory (below).** Every Phase 0 / Track A / Track B /
   cross-cutting item was checked against the code itself — does the named file
   exist, does it export what the task says, is it wired to a caller, does it do
   the thing. The two build agents' own reports
   (`12-track-1-demo-flow.md`, `13-track-2-demo-ui.md`) were read as **claims to
   check**, never as evidence. Where they are cited below it is because their
   claim was independently confirmed in the code, or because they admit a gap
   that the code confirms.
2. **Reconciliation against Track 3** (`14-track-3-adversarial-verify.md`),
   done as a **second pass** once that file landed. Half 1 was already complete
   and the two task files already rewritten, so nothing in the inventory was
   shaped by Track 3's conclusions — which makes the agreement between them
   worth something. Track 3's four FAILs and eight overstatements were then
   folded in, one box was flipped back open, and the two rows Track 3's beat
   table did not cover (A7, A9) were verified by me directly rather than left
   resting on the builder's own harness.
3. **A third pass** against `17-deploy-and-tool-wiring.md`, which deployed the
   app and proved a real ElevenLabs agent invoking its routes, plus the fixes
   that landed alongside it. Five boxes earned a tick. **Each was verified here
   before being ticked** — the author of the B3 fix explicitly disclosed their
   authorship and asked not to be taken on trust, and B1, B3, the malformed-body
   fix, the arc assertion and `make clear-letter` were all re-checked directly
   against the running app rather than read off a report.

**Tree health, measured, not assumed.** At the start of the first pass:

```
pnpm typecheck    → exit 0
pnpm lint         → exit 0
pnpm format:check → FAIL on tasks/plan.md, tasks/todo.md only (no source file)
```

Those two files were the two this pass rewrites, so they were formatted as part
of it. No source file was ever unformatted, and nothing was loosened to make a
check pass.

**At the end of the third pass:**

```
pnpm typecheck    → exit 0
pnpm lint         → exit 0
pnpm format:check → All matched files use Prettier code style
make arc          → 21 passed, 0 failed
```

Nothing was loosened to make a check pass, and no source file was touched by
this pass.

**The tree moved underneath all three passes, and that is worth recording.** At
01:18 `pnpm typecheck` was briefly **red** from an edit nobody in this pass made
— another track was writing `lib/i18n/en.ts` and `lib/i18n/fr.ts` at that moment
and `fr.ts` had not yet caught up with a new `nhs` section and seven new
`redFlag` keys:

```
lib/i18n/dictionary.ts(26,28): TS2741 Property 'nhs' is missing …
lib/i18n/fr.ts(162,3):        TS2740 … missing getHelpIf, noRecipient,
                              sourcePage, newTab, and 3 more
```

It went green within two minutes, and by the third pass that work had landed in
full. **That red was B1's design working, not a defect:** `fr satisfies
Dictionary` is precisely the compile error a half-translated dictionary is
supposed to produce, and it produced it within seconds of the two files
diverging. `14-track-3-adversarial-verify.md` was also unformatted for a while,
which made `format:check` red repo-wide; that has since been fixed by its owner.

**Any reader should re-run the checks rather than trust this block.** It
describes a repository that had several agents writing to it all night.

The app was not started by this pass — Track 3 left `:3000` up in demo mode, and
the A7/A9 probes below were read-only requests against it.

**Deliberate exclusions, confirmed still excluded and left unticked:**

- **A6 / A6.5** — OpenAI structured outputs and a green `make eval`. Out of scope
  tonight by instruction. `lib/extraction/extract.ts:3,73-74` still imports
  `@ai-sdk/anthropic` and calls `generateText({ model: anthropic(MODEL_ID) })`,
  so the note in the checklist remains accurate as written.
- **B3.6** — the second ElevenLabs agent. Not built, correctly: the French
  ear-test passed [L1] and it is contingency only.
- **Tier 3 Resend email** and **`vitest`** — deferred by decision [L7/L8].

---

## Independent inventory — repo reality, from the first pass

This table is preserved as it was written, **before** Track 3 or the deploy
report existed, so the agreement between it and them is worth something. Where a
later pass changed a verdict, the change is recorded in the reconciliation
sections below rather than by editing this table.

### Phase 0 — shared foundation

| Item                                   | What the repo actually contains                                                                                                                                                                           | Verdict  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `make format` alone, then CI gates     | `.github/workflows/ci.yml` has three jobs: `format` (`pnpm format:check`), `lint`, `typecheck`. All three run on PR and on push to `main`. Source tree is prettier-clean.                                 | **DONE** |
| Packages (Task 0.8)                    | `package.json` carries `@upstash/redis`, `@vercel/blob`, `ai`, `server-only` — plus `@ai-sdk/anthropic` (A6's current, wrong-provider dependency).                                                        | **DONE** |
| `lib/plan/schema.ts`                   | `schemaVersion: z.literal("portico-extract/1")` (`:270`). `triggerFr` / `actionFr` on `RedFlag` (`:227-228`). `superRefine` referential check over `documents` / `contacts` / `medications` (`:370-400`). | **DONE** |
| `lib/store/log.ts` (Task 0.7)          | `LogEntry` (discriminated `source`), `appendLogEntry()`, `readLog()` — plus `clearLog()`, which scans rather than deleting a computed window.                                                             | **DONE** |
| `lib/store/redis.ts`                   | Lazy `redis()` factory behind a module-level `let client`, `import "server-only"`, never constructed at module scope.                                                                                     | **DONE** |
| `lib/store/clock.ts`                   | `getDemoToday()` / `setDemoToday()`. Gated on `NEXT_PUBLIC_PORTICO_MODE === "demo"` — live mode always returns the real day.                                                                              | **DONE** |
| `lib/env.ts` helpers                   | `llmEnv()`, `blobEnv()`, `redisEnv()` all present, plus `toolEnv()` for the server-tool shared secret. `llmEnv()` still names `ANTHROPIC_API_KEY` — that rewire belongs to A6, which is out of scope.     | **DONE** |
| `<html lang>` dynamic                  | `app/layout.tsx` awaits `getLocale()` and sets `lang={locale}`. Fonts load `["latin", "latin-ext"]`, which the showcase panels need.                                                                      | **DONE** |
| README + `voice-session` override note | `README.md:73-81` and `components/voice/voice-session.tsx:60-66` both state the disallowed override closes the socket `1008` asynchronously and surfaces via `onError`, not as a throw.                   | **DONE** |

### Track A

| Id       | What the repo actually contains                                                                                                                                                                                                                                                                                                              | Verdict                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **A1**   | `lib/plan/samples/demo-plan.ts` (624 lines) exports `DEMO_PLAN`, `DEMO_PATIENT`, `DEMO_MISSED_ITEM_ID`. `POST /api/seed` writes plan + patient, uploads the source PDFs to Blob, primes two missed apixaban days, and **refuses with 403 outside demo mode**. Gold letter is Whitfield [L6].                                                 | **DONE**                                                                                         |
| **A2**   | `lib/store/plan.ts` and `lib/store/patient.ts`. Both read as `<unknown>` and `.parse()` on every read; corrupt data throws at the store, not three components deep.                                                                                                                                                                          | **DONE**                                                                                         |
| **A3**   | `lib/timeline/schedule.ts` — `buildTimeline`, `dueToday`, plus `standingItems`, `addDays`, `daysBetween`. Pure: no I/O, no `new Date()` for "today", `MAX_DAYS` clamp at 400.                                                                                                                                                                | **DONE**                                                                                         |
| **A4**   | `app/(phone)/plan/page.tsx` (179 lines) renders `<Timeline>` → `<DaySection>` → `<TaskRow>` off `buildTimeline`, with a `loading.tsx` and a real empty state.                                                                                                                                                                                | **DONE**                                                                                         |
| **A5**   | `app/api/blob/upload/route.ts` token route + `components/upload/upload-panel.tsx` client upload. One control: `accept="image/*,application/pdf"`, `capture="environment"`, `multiple`, parallel `Promise.all` upload with honest progress.                                                                                                   | **DONE**                                                                                         |
| **A6**   | `lib/extraction/extract.ts` still uses `@ai-sdk/anthropic` + `generateText` with prompt-injected JSON. Demo short-circuit at `:57` is correct and checked **before** the model call. Both 422 surfaces exist in `app/api/extract/route.ts`.                                                                                                  | **NOT DONE** (excluded tonight)                                                                  |
| **A6.5** | `scripts/eval-extraction.ts` (753 lines) + `make eval` exist. No green run against all five letters is on record, and it cannot be green while A6 is on the wrong provider.                                                                                                                                                                  | **NOT DONE** (excluded tonight)                                                                  |
| **A6.6** | `NEXT_PUBLIC_PORTICO_MODE` parsed in `lib/env.ts` as a `z.enum` with no silent fallback. `DemoModeBadge` now renders on **home, /plan, /plan loading, /upload, /family and the check-in idle view** — the visibility gap is closed. `/api/seed` and every `/api/demo/*` route 403 outside demo.                                              | **PARTIAL** — mechanism and visibility done; the licence A6.5 was meant to grant is still absent |
| **A7**   | `lib/drugs/lookup.ts` (489 lines): four-state union `found \| no-urgent-guidance \| absent \| unavailable`, alias layer driven by the committed map, 24h Redis cache, provenance carrying `origin: "nhs" \| "cache" \| "seed"` and a `stale` flag. `/api/drug-info` 404s a drug not on the plan, and distinguishes it from "no plan stored". | **DONE**                                                                                         |
| **A8**   | `fixtures/nhs-drug-map.json` committed. The resolution order is explicit in `lookupDrug` (seed → cache → network) and a seed hit is labelled as one in `Provenance.origin`.                                                                                                                                                                  | **DONE**                                                                                         |
| **A9**   | `components/plan/red-flag-card.tsx` (361 lines): source trace resolving through the streaming route `app/api/blob/source/[...path]/route.ts` (Blob is Private), `lang="en"` + `translate="no"` on the verbatim block, dual EN/FR per D7, OGL v3.0 attribution with the retrieval date.                                                       | **DONE**                                                                                         |
| **A10**  | `app/(phone)/plan/actions.ts` exports the `logStep` Server Action, which parses its input and calls `appendLogEntry()`. `components/plan/task-check.tsx` calls it — **not** `/api/log`. Both write paths converge on Task 0.7's function.                                                                                                    | **DONE**                                                                                         |
| **A11**  | Base-layer `:focus-visible` floor in `app/globals.css` covering every interactive element; 44px targets (`size-11`, `min-h-11`, `min-h-[3.25rem]`); error and empty states on `/plan`, `/upload`, `/family`, plus `app/(phone)/error.tsx`. Contrast reasoning is recorded inline at each fix.                                                | **DONE**                                                                                         |

### Track B

| Id        | What the repo actually contains                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Verdict                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **B1**    | `lib/i18n/locales.ts` (`REAL_LOCALES = ["en","fr"]`, showcase union kept separate), `dictionary.ts`, `en.ts`, `fr.ts` ending `} satisfies Dictionary`. `getDictionary` accepts only `Locale`, so `05:628`'s English fallthrough is unrepresentable, not merely discouraged.                                                                                                                                                                                                          | **PARTIAL** — see the `/plan` + `/upload` gap below   |
| **B2**    | `app/actions/set-locale.ts` (throws on a non-real locale rather than defaulting). `language-picker.tsx`: endonyms only, no flags, active locale filtered out, no "Default" badge, `min-h-11` rows, top-right on every screen. `app/(phone)/language/page.tsx` is the wholly-in-language "not yet" panel with a `notFound()` guard on `searchParams`.                                                                                                                                 | **DONE**                                              |
| **B3**    | `lib/check-in-prompt.ts` — `buildCheckInPrompt({bundle, today, logs, locale})` and `buildFirstMessage`. Persona authored separately in `en.ts` and `fr.ts`, not machine-translated; the prompt _frame_ is authored per language too. The generic-Q&A suggestion is gone; the four suggested questions are plan-shaped.                                                                                                                                                               | **DONE**                                              |
| **B3.5**  | `voice-session.tsx` takes `locale: Locale` and passes it as `overrides.agent.language`. The hardcoded `"en"` is gone. English regression + French ear-test **since these changes** have not been run.                                                                                                                                                                                                                                                                                | **PARTIAL** — code done, audio unheard                |
| **B3.6**  | Not built. Correct.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **CORRECTLY UNBUILT**                                 |
| **B4**    | `app/api/log/route.ts` and `app/api/escalate/route.ts` exist, authenticate on the `x-portico-tool-secret` **request header** (not `secret__`), bind `patient_id` / `check_in_id` as inputs, take `day` from the demo clock rather than the model, and validate `item_id` against the stored plan. **But:** the ElevenLabs tool config is only written out as paste-ready JSON in `12-…md:641`; no tool exists on the agent, and `localhost` is unreachable from ElevenLabs' backend. | **PARTIAL** — routes real, never called by an agent   |
| **B5**    | `lib/escalation/rules.ts` — pure `assess()` returning `none \| nudge \| alert-kin`, `WINDOW_DAYS`/`ALERT_MISSES` defined only here, plus `assessmentWindow()` so callers read exactly the window the rule uses.                                                                                                                                                                                                                                                                      | **DONE**                                              |
| **B6**    | `useConversationClientTool("show_red_flag", …)` in `voice-session.tsx:245`. Narrows the model's argument, returns a plain string for an unknown id, never throws. No `onUnhandledClientToolCall`. Never fired by a real agent.                                                                                                                                                                                                                                                       | **PARTIAL** — wired, unexercised                      |
| **B7**    | `onAgentToolRequest` / `onAgentToolResponse` set the `toolInFlight` indicator (`:219-223`), rendered as an `aria-live` line. The agent's `client_events` were not re-PATCHed. Never fired by a real agent.                                                                                                                                                                                                                                                                           | **PARTIAL** — wired, unexercised                      |
| **B8**    | `app/(phone)/family/page.tsx` — `force-dynamic`, `Promise.all` over locale/clock/patient/plan, `flex min-h-0 flex-1 flex-col` (no `dvh`), escalation card + human-formatted dates in both locales.                                                                                                                                                                                                                                                                                   | **DONE**                                              |
| **B9**    | `components/family/refresh-poller.tsx` — 5s `router.refresh()`, one client leaf, page is `force-dynamic` so each refresh is a real read.                                                                                                                                                                                                                                                                                                                                             | **DONE**                                              |
| **B10**   | The incoming card is the `incoming` variant of `IdleView`, driven by `readIncomingCheckIn()` on the server and a 5s poll of `/api/demo/check-in` while idle. Real Redis state with a TTL — not a timer painting a card. Answering clears it inside `begin()`.                                                                                                                                                                                                                        | **DONE**                                              |
| **B10.5** | `app/operator/page.tsx` outside the `(phone)` group, `force-dynamic`, `robots: { index: false }`, never linked from the product. Reset / clock / mark step taken-or-missed / ring + cancel the check-in, all writing through the product's own functions. The **mode toggle is deliberately absent** and the page says why: `NEXT_PUBLIC_PORTICO_MODE` is baked into the client bundle at build time, so a switch there would change a label and nothing else.                       | **DONE** (mode toggle correctly refused, not missing) |
| **B11**   | Nothing has re-heard French since the voice changes landed.                                                                                                                                                                                                                                                                                                                                                                                                                          | **NOT DONE**                                          |
| **B12**   | No `asr.keywords` anywhere in the repo or in any recorded agent PATCH. No tappable French answer chips for taken/missed — `SuggestedQuestions` renders opening _questions_, not answers. No confirm-before-logging step. The typed `Composer` path exists and is locale-aware.                                                                                                                                                                                                       | **NOT DONE** (typed path only)                        |
| **B13**   | `@media (prefers-reduced-motion: reduce)` sweep in `app/globals.css:136`, written as a wildcard so a later component cannot reintroduce motion by forgetting the file. `:focus-visible` floor in the base layer.                                                                                                                                                                                                                                                                     | **DONE**                                              |
| **B14**   | `make seed` exists, plus `make arc`, `make ring`, `make unring`, `make clock`, `make miss`, `make operator`, `make e2e`. `scripts/demo-arc.sh` asserts each beat over HTTP. The runbook is `12-…md §"How to run the demo arc locally"`. **No stopwatch rehearsal against the 60s limit is on record.**                                                                                                                                                                               | **PARTIAL**                                           |

### Cross-cutting

| Item                                             | Repo reality                                                                                                                                                                                                                          | Verdict     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Never construct `Redis()` / Blob at module scope | `redis()` is a lazy factory; `put` / `handleUpload` are called inside route handlers with an explicitly asserted `blobEnv()` token.                                                                                                   | **DONE**    |
| Every secret in its own `xxxEnv()`               | `serverEnv`, `llmEnv`, `blobEnv`, `toolEnv`, `redisEnv` — five schemas, five call sites, all throwing on absence. The browser-safe `env` holds only `NEXT_PUBLIC_*`.                                                                  | **DONE**    |
| Start chain inside the tap                       | `begin()` calls `void connect()` synchronously; `connect()` runs `getUserMedia → fetchSignedUrl → startSession` in order. The check-in DELETE is fired after, and not awaited.                                                        | **DONE**    |
| Threshold only in `rules.ts`                     | `WINDOW_DAYS` / `ALERT_MISSES` exist only there. The agent prompt explicitly tells the model it does **not** decide what a run of misses means.                                                                                       | **DONE**    |
| `schema.ts` changes announced to both tracks     | Process commitment; not verifiable from the tree.                                                                                                                                                                                     | n/a         |
| `PORTICO_MODE` set by a human, never a `catch`   | Demo is checked before the model call, never in a catch. A live failure 422s. The badge renders on all six patient-facing surfaces.                                                                                                   | **DONE**    |
| No silent fallbacks [D9]                         | Holds for model pins, env, overrides and mock data. **It does not hold for the UI:** `/plan` and `/upload` are hardcoded English and never call `getDictionary`, so a French session renders `<html lang="fr">` over English screens. | **PARTIAL** |

### The one thing my own inventory found that neither build report leads with

`app/(phone)/plan/page.tsx` and `app/(phone)/upload/page.tsx` import no
dictionary at all. `page.tsx:143` still carries the comment "English until B1's
`getLocale()` lands" — B1 landed, these two screens did not follow. Track 2
records it as residual risk 5 in `13-…md`, framed as pre-existing rather than as
a live D9 breach; it is both. It is also an accessibility defect, because
`<html lang="fr">` is then asserting French over English prose. **It is visible
the moment the language picker is demonstrated**, which is a beat of the arc.

---

## Reconciliation against Track 3

**Sequencing note.** Half 1 was completed and `todo.md` / `plan.md` were
rewritten **before** `14-track-3-adversarial-verify.md` existed. Nothing in the
first pass was guessed from it. This section and the second-pass edits below
were written after reading `14-…md` in full.

### Headline: no FAKEs

Track 3's most important result is a negative one. It attacked the family
escalation — the single claim the product rests on — **four separate ways** and
could not make it lie: search params (`FamilyPage()` takes no arguments), a grep
for a second producer of `alert-kin` (exactly two sites, `rules.ts` produced and
`escalation-card.tsx` consumed), the operator panel driven against an emptied
log (stayed "Nothing needs your attention"), and the escalate route (writes a
`LogEntry`, sets no flag — one call yields `nudge`, not `alert-kin`). Beats 1,
3, 4, 5, 8, 9, 10 and 12 are clean PASSes from a cold start.

That corroborates most of what I ticked, and it does so from a **cold** start —
`.next` removed, the server restarted, state read straight out of Upstash rather
than out of the app's own responses. It is the independent evidence my first
pass said it lacked.

### Where Track 3 covers my exposed rows

I had flagged nine ticked rows as leaning partly on Track 1's own harness.
**Seven are now independently covered:** A4 (beat 4 — tick persists across a
reload, read back from Redis), A5 (beat 3 — a real PDF driven through the real
input to Blob), A10 (beat 4, same), B8 (beat 8), B9 (beat 5), B10 (beat 5 —
three timed flips with no navigation), B10.5 (beat 9 — every button enumerated
off the live DOM, no mode toggle, nothing painted).

**A7 and A9 were not in Track 3's beat table at all.** Rather than leave two
ticks standing on the builder's own harness, I exercised both myself over HTTP
against the running app:

| Probe                                                   | Result                                                                                                                                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/drug-info?patientId=demo&name=Apixaban%205mg` | `{"kind":"found","slug":"apixaban","match":"exact"}`, **2** urgent blocks, `origin:"seed"`                                                                                                                  |
| `…&name=Ramipril%205mg`                                 | `{"kind":"no-urgent-guidance","slug":"ramipril"}` — the second state, distinct                                                                                                                              |
| `…&name=Tiotropium%2018mcg`                             | `found` via slug `tiotropium-inhalers` — **the alias layer doing its job**                                                                                                                                  |
| `…&name=ibuprofen`                                      | `404 {"message":"\"ibuprofen\" is not on this plan."}` — the scope guard                                                                                                                                    |
| `GET /plan`                                             | verbatim trigger inside `<blockquote lang="en" translate="no">`; trace link rendered as `/api/blob/source/letters/demo/02_Whitfield_Harold_Pneumonia.pdf?patientId=demo#page=1`; OGL v3 attribution present |
| That trace link                                         | `200`, `content-type: application/pdf`, **194,289 bytes**, magic `%PDF-`, `cache-control: private, no-store`, `content-disposition: inline`                                                                 |
| Same route, a pathname not in this plan (`01_Clarke…`)  | `404` — cannot be turned into a reader for the whole store                                                                                                                                                  |
| Same route, `patientId=nobody`                          | `404`                                                                                                                                                                                                       |

**A7 and A9 stay ticked, now on my own evidence rather than on `make arc`.**

### The four FAILs, and what each did to the file

| Track 3 FAIL                            | What I changed                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D9 rule 3 — live extraction is dead** | A6's note rewritten from "not runnable" to the specific failure (500, `ZodError` at `lib/env.ts:47`, since `fe657f6`) **and** its consequence: the biggest demo shortcut has no runnable live counterpart, which is the honesty rule the demo-mode argument rests on. Also strengthened in Checkpoint 2, the Still-to-do table, and the cross-cutting D9 line. |
| **The runbook cannot attach the tools** | B4's refusal now names `tool_ids` as the reason, not just localhost: creating a tool is inert until its id reaches `conversation_config.agent.prompt.tool_ids`, and `12-…md` never mentions it while telling you in bold not to PATCH `conversation_config`. B6 points at the same blocker. Promoted to item 1 of "Before filming".                            |
| **Home does not tell the ingest story** | No task id owns this, so it went in as a pre-film decision (item 4): both home states are real, but the one that will be filmed leads with the check-in and puts the letter third.                                                                                                                                                                             |
| **Non-JSON body → bare 500**            | Recorded on B4 as a minor real defect, with the two routes next door that get it right named.                                                                                                                                                                                                                                                                  |

### Overstatements Track 3 caught, and where they landed

- **`13-…md` residual risk #1 is stale** — the seed _does_ clear a stale forward
  log key now, verified two ways. My own inventory already described `clearLog`
  correctly, so no correction was needed here; but it would send an operator
  hunting for a Redis console at 2am, so it is now item 5 of "Before filming".
  `13-…md` is not mine to edit.
- **"extraction … OpenAI"** is false in both `tasks/plan.md §Demo mode` and
  `12-…md`. I own only §CURRENT REALITY in `plan.md`, so I corrected my own
  section and added an explicit pointer that the §Demo mode section below it is
  stale on this point. Fixing the other two is item 5.
- **One of the 19 `make arc` assertions cannot fail** (`clock moves a day`
  checks only for the substring `"today":"`). Recorded on B14. The other 18
  assert real substrings; the harness is substantially honest, the count is one
  better than it should be.
- **The 4.56s flip figure is one sample**, not a slow-path measurement. Both
  Track 1's and Track 3's numbers sit inside a uniform 0–5s poll window. Folded
  into "Before filming" item 7 as _budget 5 seconds, not 3_.

### One finding that forced a box back open

Track 3 found a D9 leak neither build report reported and my own inventory
missed: **`lib/check-in-prompt.ts` never reads a `*Fr` field**, so in a French
session the red flag is handed to the agent in English even though the bundle
carries authored French for that exact string and the on-screen card renders it.
The screen is French; the words the agent is told to read verbatim are not.

B3's stated acceptance criteria — authored persona in en/fr, plan-aware
`firstMessage`, generic question removed — are all met, so a lenient reading
keeps the tick. **I took the pessimistic reading and unticked B3**, because the
defect is in B3's own module and because a ticked B3 tells a 2am reader "the
French prompt is done" when the hero beat will be audibly bilingual.

**Where my inventory disagreed with a build report, and which reading went in:**

| Point                            | Build report's framing                                     | My reading                                                                                                         | Taken into `todo.md`                          |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `/plan` + `/upload` English-only | `13-…md` residual risk 5: "pre-existing, not a regression" | Pre-existing **and** a live D9 breach **and** a WCAG 3.1.1 defect, on a screen the arc visits                      | Mine — **B1 unticked**                        |
| B4 server tools                  | `12-…md` beat table: 6–11 PASS on the routes               | The routes pass; the **task** is the tool path, and no agent has ever called it                                    | Mine — **B4 unticked**                        |
| B6 / B7 live tick                | `12-…md` R2: "wired but never exercised" (agrees)          | Same                                                                                                               | Agreed — unticked                             |
| B14 rehearsal                    | `12-…md` supplies a runbook, treats B14 as served          | The runbook is half of B14; the stopwatch rehearsal against 60s is the half that decides the demo                  | Mine — **B14 unticked**                       |
| A6.6 demo mode                   | Both reports treat demo mode as done                       | The mechanism and visibility are done; the **licence** A6.5 was meant to grant is not, and demo is used regardless | Ticked, with the caveat written into the line |

**And where Track 3 disagreed with me, on the second pass:**

| Point   | My first reading                               | Track 3                                                                                    | Taken into `todo.md`                                        |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| A6      | "not runnable — throws at the config boundary" | Reproduced it: **500**, `ZodError` at `lib/env.ts:47`, and named it a **D9 rule 3 breach** | Track 3's — strictly stronger, and it is the honesty rule   |
| B4      | "no agent has ever called them" (localhost)    | That, **plus** the runbook cannot attach them at all — `tool_ids` is never mentioned       | Track 3's — mine was the smaller half of the problem        |
| B3      | Ticked; acceptance criteria met                | The French prompt hands the red flag to the agent in **English**                           | Track 3's — **B3 unticked**, the only reversal on this pass |
| A7 / A9 | Ticked on code reading + `make arc`            | Not in its beat table at all                                                               | Neither — I verified both myself over HTTP; ticks stand     |

---

## What changed in `todo.md` and `plan.md`

**Boxes flipped `[ ] → [x]`: 32.** The file holds 51 boxes; it went from 6
ticked to 38.

- Phase 0 — 9 (`make format` + CI, packages, `schema.ts`, `log.ts`, `redis.ts`,
  `clock.ts`, `env.ts` helpers, `<html lang>`, the README/override note). All 14
  Phase 0 lines are now ticked.
- Track A — 10 (A1, A2, A3, A4, A5, A6.6, A7, A9, A10, A11). A8 was already
  ticked and stays; A6 and A6.5 stay open by decision.
- Track B — 8 (B2, B3, B5, B8, B9, B10, B10.5, B13).
- Cross-cutting — 5 (module-scope clients, per-integration env, the start chain,
  the threshold's single home, `PORTICO_MODE` never set by a `catch`).

**Third pass, after `17-deploy-and-tool-wiring.md`: 5 boxes flipped
`[ ] → [x]` — B1, B3, B4, B6, B7. 0 flipped back.** Final state **42 ticked /
9 unticked** of 51.

**Second pass, after Track 3: 1 box flipped `[x] → [ ]` (B3), 0 newly ticked.**
37 ticked / 14 unticked at that point. A7 and A9 were re-verified over HTTP
rather than downgraded, and stayed ticked. Everything else Track 3 reported
landed as prose on rows that were already open, which is the outcome the
pessimistic first pass was designed to produce.

**First pass, claims corrected without a box flip: 3.**

Nothing was over-ticked, but three "Done"-table claims had gone stale and were
rewritten rather than deleted:

1. **`AI_GATEWAY_API_KEY` — "local + Vercel all envs"** is no longer true
   locally. It is in neither `.env` nor `.env.local`. The row now says it was
   created and probed, and that it must be restored with the A6 rewire. The
   Phase 0 box stays `[x]` because the task ("create it, probe it") genuinely
   happened; the drift is recorded on the line.
2. **"Local env layout cleaned — `.env` = public `NEXT_PUBLIC_*` only"** is no
   longer true: `.env` now also carries an `OPENAI_API_KEY` that nothing in the
   codebase reads, in the file whose own header forbids secrets. Recorded as
   drift, in the Done table and in the env-file contract section.
3. **"Human calls outstanding: None."** — false since B4 landed. There is
   exactly one, and it is now named at the top of the Still-to-do table and
   again under Open decisions: a deployed HTTPS origin plus five minutes pasting
   two tool configs.

**Other substantive edits to `todo.md`:**

- The `⚠️ STALE CHECKLIST` banner is replaced by a dated **RECONCILED
  2026-07-26** header that names the evidence files and explains how to read a
  box — specifically, how to tell "nothing written" from "written but never
  exercised", which is the distinction that matters at 2am.
- Every unticked line that has code behind it now carries a one-line
  parenthetical saying what exists and what is missing. B4, B6, B7 and B3.5 read
  as "built, never proven", not as "not started".
- All four checkpoints carry an explicit outcome instead of standing as untested
  assertions. Checkpoint 2 and Checkpoint 3 say plainly which half passed and
  which did not, and Checkpoint 3 keeps its "passing 3 without 2 means the app
  does not actually work" warning, now with the specifics attached.
- `PORTICO_TOOL_SECRET` added to the Done table and to the env-file contract —
  it is a new server-only secret that neither section knew about.
- The "Still to do (before / as Phase 0)" table's first two rows now say
  **Done**, and two genuinely-open rows replaced them: the webhook origin, and
  the missing extraction key.
- A6 and A6.5 keep their unticked boxes and are explicitly labelled **out of
  scope for the 2026-07-26 build night**, so nobody reads them as neglected work
  and starts on them at 2am. B3.6 keeps its **DO NOT BUILD**. The L7/L8
  deferrals are untouched.

**Second-pass edits to `todo.md`, after Track 3:**

- The status header now names `14`, `15`, `12` and `13` in the order they should
  be trusted, leads with **no FAKEs**, and names the two things that did not
  survive adversarial contact so a skimmer meets them before the boxes.
- **B3 unticked** with the French red-flag leak as its reason.
- A6 rewritten around the actual failure (500, `ZodError` at `lib/env.ts:47`,
  since `fe657f6`) and the D9-rule-3 consequence. Checkpoint 2 changed from "NOT
  PASSED, by decision" to "NOT PASSED, and worse than by decision".
- B4 rewritten around `tool_ids`, not just localhost, plus the non-JSON-body
  defect. B6 points at the same blocker.
- A7 and A9 carry their HTTP evidence inline, so the ticks do not rest on the
  builder's harness.
- The cross-cutting D9 line now enumerates three breaches — the two English
  screens, the English red flag in the French prompt, and rule 3 — instead of
  one, and says what would tick it.
- The `PORTICO_MODE` line keeps its tick but corrects "a live failure 422s": the
  422 surfaces exist, but today it dies earlier as a bare 500.
- The end-to-end cheat sheet is relabelled as the **intended** flow, with the
  code's actual extraction path spelled out beneath it — it was quietly asserting
  OpenAI.
- A6.6 gains the "any letter yields Whitfield's plan in demo mode" caveat, proved
  by uploading Emma Clarke's letter. The code discloses it three ways; the
  narration is where it could become a lie.
- B14 gains the note that one of the 19 arc assertions cannot fail.
- A new **"Before filming"** block replaces the thinner "one thing only a human
  can unblock" paragraph: nine ordered items, the first two being the only ones
  nobody else can do. It points at `14-…md` for detail rather than duplicating
  it.

**Third-pass edits to `todo.md`, after `17-…md`:**

- **B4, B6, B7 ticked.** The task was never "write the routes" — it was the tool
  path working. A real agent invoked the deployed routes, corroborated three
  independent ways (ElevenLabs' execution ledger with `toolexec_…` ids and
  `is_error: false`, Vercel runtime logs on a named deployment, and the app's own
  rendered state changing). The `tool_ids` gap Track 3 predicted was **worse than
  documented**: the agent read back `prompt.tool_ids = []`, so `show_red_flag`
  was **unattached**, not merely unexercised — `12-…md §R2` was understating it.
  All three are attached now, the PATCH deep-merged (118 leaf keys before and
  after, 2 changed), and both TTS pins plus all 12 `client_events` survived.
- **B3 re-ticked, after verifying it myself** — the author disclosed they wrote
  the fix and asked me not to take their word, which was the right instinct.
  `lib/check-in-prompt.ts` now tags each flag with the language it hands over.
  Read off the wire: an English session emits
  `(en) breathless, feverish or confused again → …`; a French session emits
  `(fr) essoufflé, fiévreux, ou de nouveau confus → …`. It is an explicit tag,
  not a silent fallthrough, which is the distinction D9 turns on.
- **B1 ticked.** `/plan` and `/upload` read the dictionary end to end, and so
  does every `components/plan/*` leaf; the hardcoded `locale="en"` and the
  "English until B1's `getLocale()` lands" comment are gone. Verified in French
  over the wire: "Votre plan de rétablissement", "Ajouter votre lettre de
  sortie", "Aujourd'hui", "Ce que le NHS dit de vos médicaments". **One of the
  two gaps I was asked to record had already been closed** — `demo-mode-badge.tsx`
  is no longer hardcoded English; it takes a `text` prop at all six call sites
  and renders "Mode démonstration…" in French. The other gap is real and is
  recorded on the line: the letter's own clinical text has no authored French.
  **That is not a fallthrough** — it is correctly declared inside `lang="en"`
  (plus `translate="no"` where verbatim), which is what WCAG 3.1.2 asks for, so
  it did not block the tick.
- **B3.5, B11 sharpened rather than ticked.** B3.5's English half is now proven
  live — three sessions ran with `agent.language` and `tts.voice_id` sent exactly
  as `voice-session.tsx` sends them, and `platform_settings` confirms
  `tts.model_id` is not client-overridable. Its French half is untouched. B11
  now says plainly that both pins are structurally verified **twice** and that
  what is missing is the only part that counts: a human ear.
- **B14** records `make arc` at 21/21, the hollow assertion fixed, and
  `make clear-letter`. Still unticked: no stopwatch rehearsal.
- **Cross-cutting D9** drops from three breaches to one (rule 3).
- **A6** gains a precision I would otherwise have got wrong: production _does_
  carry `ANTHROPIC_API_KEY` now, but runs in demo mode, so the model is never
  called there either. The key existing is not the path working.
- The header gains **two shoot-losing facts** — production ships the working
  tree and predates most of tonight's fixes, and local/production share one
  Redis — and "Before filming" is rewritten around them, with redeploy as item 1
  and the French ear-test as item 2.
- The Done table gains the deployment and the tool wiring, with the warning that
  they ship an uncommitted snapshot.

**`tasks/plan.md` — §CURRENT REALITY only**, as scoped:

- Heading changed from "⚠️ CURRENT REALITY (2026-07-25 evening) — checklists are
  stale" to "✅ CURRENT REALITY (reconciled 2026-07-26)", and the prose now
  points readers at `todo.md` as trustworthy.
- The eight-row "what the code roughly has today" table is replaced by a
  ten-row verified one. Four rows changed verdict: Phase 0 and Track A from
  "mostly implemented" to complete-with-named-exceptions; Track B Phase 2+ from
  "**mostly missing**" to complete-and-exercised; home entry from "leads with
  voice check-in" to fixed. Two rows were added for the things the old table had
  no cell for: the server tools' unproven state, and the unheard voice.
- A6's row is sharpened from "wrong provider" to wrong-provider-**and-not-
  runnable**, because no local env file carries `ANTHROPIC_API_KEY`.

Both files are prettier-clean; `pnpm format:check` now passes repo-wide, which
it did not before this pass.

---

## Still open — the honest remaining-work list for the demo slice

Ordered by what would cost most on camera. Six items shorter than the second
pass: the deploy, the tool wiring, both D9 leaks and the malformed-body defect
are all closed.

1. **Redeploy.** Production is a snapshot of the working tree at 01:20 and
   predates the French prompt fix, the localised `/plan` and `/upload`, the
   malformed-body fix and `make clear-letter`. The ElevenLabs tools call the
   deployed alias, so the agent is currently talking to older code than anyone
   has been rehearsing against. `pnpm typecheck && pnpm lint && vercel deploy
--prod --yes --scope haider-projects`.
2. **B11 — one real French voice call.** The last genuinely human-only item.
   Both TTS pins are structurally verified twice over and `language_presets.fr`
   is byte-identical throughout, but all three proving sessions were
   `language: "en"` and nobody has heard French. C2 is explicit that HTTP 200
   proves nothing here — Phase 1 reproduced Welsh returning 200 with 74KB of
   healthy-looking audio on a model with no Welsh support. D9 says a bad result
   is a **stop**, not a downgrade.
3. **Pick one host per take.** Local and production share one Redis and one Blob
   store, so a laptop `make seed` moves the deployed site's state. Two people
   rehearsing on different hosts will fight, silently.
4. **B14 — one stopwatch rehearsal.** `make arc` is 21/21 and the one hollow
   assertion is fixed; that proves the beats work, not that they fit in sixty
   seconds in the order a human drives them.
5. **Move `OPENAI_API_KEY` out of `.env`.** A live secret in the file whose own
   header forbids secrets, read by nothing.
6. **B12 — high-stakes ASR safety.** Bilingual `asr.keywords`, tappable
   taken/missed answer chips, confirm-before-logging. Nothing has landed since
   the first pass; the typed composer is still the only part that exists. The
   largest remaining unbuilt surface.
7. **A6 / A6.5** — out of scope tonight by decision, and still the one thing a
   demo could over-claim. Until `make eval` is green, the honest description of
   the baked bundle is "recorded", which is what the badge already says.
8. **Take `/operator` and the demo routes off the public internet afterwards.**
   Production runs in demo mode, so the demo-only guard permits `/operator`,
   `/api/seed` and every `/api/demo/*` route to anyone with the URL.
9. **One stale sentence in a document I do not own:** `13-…md` residual risk #1
   still tells an operator to flush a Redis key by hand that the seed clears.

Not on this list, deliberately: **B3.6** (do not build), **Tier 3 Resend** and
**`vitest`** (deferred, L7/L8).

---

## Residual risk — what in these documents could still mislead

1. **"Done" reads as "proven" to a tired reader**, and the file now shows **42
   of 51 ticked**. That is a much more confident-looking board than it was two
   passes ago, and confidence is exactly what a 2am skim takes from it. Every
   unticked line states its own gap inline and the header names the one
   over-claimable thing; the risk is that someone counts ticks instead of
   reading them.
2. **The boxes describe the working tree; the agent talks to production.** These
   are now different code. `todo.md` says so twice, in the header and in "Before
   filming", because it is the single most likely way a rehearsed demo fails on
   camera: everything works locally, and the deployed agent calls a snapshot that
   predates half of tonight.
3. **The remaining ticks that no third party has exercised.** Track 3's beat
   table covers A1, A2, A4, A5, A10, B5, B8, B9, B10, B10.5 and cross-cutting;
   `17-…md` covers B4, B6, B7; I covered A7, A9, B1 and B3 myself over HTTP.
   What nobody outside the builder has independently driven is **A3**
   (`buildTimeline` / `dueToday` — a pure module verified by reading it and by
   the timeline it renders), **A11** (the accessibility pass — no axe run, no
   contrast measurement, only code reading and screenshot judgement) and **B13**
   (the reduced-motion sweep, which nobody has viewed with the OS setting on).
   None carries a demo beat, which is why they are ticked; none has a
   measurement behind it either.
4. **The live proof used text frames, not a microphone.** The agent, the LLM,
   the tool dispatch and the webhook calls in `17-…md` are all genuine, and the
   ledger and the Vercel logs are independent of the harness. But the user's
   turns were injected as `user_message` text, so **ASR has never been exercised
   end to end** — in any language. B12 is unbuilt for exactly the risk ASR
   carries, and B11 is explicitly an ear-test of TTS _and_ ASR separately.
5. **`make arc` still shares the builder's blind spots.** It is 21/21 and the
   one hollow assertion is fixed, but a harness written by the agent that wrote
   the code will not catch what that agent did not think to check.
6. **The escalation threshold is restated in the dictionaries.** `ALERT_MISSES`
   lives only in `rules.ts`, which is what the cross-cutting rule asks for — but
   `en.ts`/`fr.ts` hardcode "A dose that matters was missed twice." Change the
   constant and that copy silently becomes a lie.
7. **The env drift is documented, not fixed.** `.env` still carries a live
   `OPENAI_API_KEY` that nothing reads; `ANTHROPIC_API_KEY` is still absent
   locally. This pass may not touch env files, so `todo.md` describes both.
   Someone could read the description as the fix.
8. **`plan.md` below §CURRENT REALITY was not reconciled.** Only that section is
   in scope. The task lists further down still read as pre-build intent, which
   is what the heading now says they are — but they are long, and somebody
   scrolling past will find unticked-looking work that is in fact finished.
   `todo.md` is the progress board; `plan.md` is not.
9. **Nothing here is committed.** Every track's work — code, audits and this
   reconciliation — is uncommitted in the working tree, which is also what got
   deployed. A `git checkout` would take all of it.
10. **`:3000` is left up, in demo mode, seeded**, and it shares Redis with
    production. State as left after my `make arc` run: `today 2026-07-27`, log
    keys `2026-07-25` and `2026-07-26`, `/family` reading "A dose that matters
    was missed twice" — the canonical filmable state. Anyone assuming a clean
    machine should still press Reset.
