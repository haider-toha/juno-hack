# Portico — Build Checklist

Full detail, acceptance criteria and citations: `tasks/plan.md` and
`tasks/spec.md`. Locked decisions (incl. French + no silent fallbacks + name):
`audit/juno-recovery-companion/00-locked-decisions.md` (D4, D8, D9, **D10**).

**Product name: Portico.** Juno is the hackathon host only — never the app
brand [Locked D10].

This file is the fast-scan version for the build itself.

## Setup status (updated 2026-07-25, post-Phase-1) — read this first

**Infra is green and the ElevenLabs agent now exists.** Do not re-provision
anything. Evidence: `audit/juno-recovery-companion/06-phase-1-readiness.md`.
Hole-finding passes: `07` (Track A), `08` (Track B), `09` (two-dev seams).
Consolidated go/no-go: `10-plan-lock-two-dev.md`.

> ### ✅ DECISIONS LOCKED — no open human gates. Do not re-open.
>
> 1. **French ear-test PASSED.** Stay on the **single** Portico agent. Task
>    B3.6 (two agents) is contingency only — **do not build it**.
> 2. **Demo gold letter is now `02_Whitfield_Harold_Pneumonia`**, not Sinclair —
>    the medic chose apixaban and Whitfield is the only letter carrying it.
>    **05 Bradley** is the red-flag QA letter. Rationale in `plan.md` Track A.
> 3. **Agent LLM is `gemini-3.5-flash`**; voice stays Sarah; `auth.enable_auth`
>    stays **OFF**. All PATCHed and read back.
> 4. **Skip** the Tier 3 Resend email stretch and `vitest` unless spare time
>    remains at the end. Neither blocks anything.
>
> ### ⚠️ Five technical corrections that override older wording
>
> 1. **`eleven_flash_v2_5` cannot be pinned on an English agent.** The API
>    returns `400 "English Agents must use turbo or flash v2"`. The model is
>    pinned **per locale**: `en` → `eleven_flash_v2` (base), `fr` →
>    `eleven_flash_v2_5` (language preset). **Do not "fix" this.**
> 2. **Blob is Private** — closed by infrastructure. Source images need a
>    streaming route handler, not `<img>`.
> 3. **`secret__` is not request auth** — it hides a value from the LLM, not
>    from the browser. Use `request_headers` with a `secret_id`.
> 4. **A disallowed override does not throw** — the socket closes `1008` and it
>    surfaces via `onError`, so `try/catch` never sees it.
> 5. **NHS urgent blocks are in the NESTED `hasPart`** — scanning the top level
>    returns zero. Four states, not two. See `fixtures/nhs-drug-map.json`.
>
> Full detail and line numbers: `tasks/plan.md §DECISIONS LOCKED` and
> `§READ FIRST`.

### Done

| Item                             | Where                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product name locked              | **Portico** (D10) — not Juno                                                                                                                                                            |
| Vercel project linked            | `haider-projects/juno-hack` (slug legacy; product is Portico)                                                                                                                           |
| Claude Vercel MCP authenticated  | `claude mcp list` → ✔ Connected                                                                                                                                                         |
| Upstash Redis (free) provisioned | URL + token on Vercel Prod/Preview/**Development**                                                                                                                                      |
| Vercel Blob                      | `BLOB_READ_WRITE_TOKEN` on all envs                                                                                                                                                     |
| `AI_GATEWAY_API_KEY`             | local + Vercel Prod/Preview/Development; `/v1/models` → 200                                                                                                                             |
| `XI_API_KEY`                     | `.env.local` + Vercel; `GET /v1/user` → 200                                                                                                                                             |
| `NEXT_PUBLIC_XI_VOICE_ID`        | **Was pointing at a nonexistent voice** (`voice_not_found`) — fixed to `EXAVITQu4vr4xnSDxMaL` (French-verified) in `.env`, `.env.example` + Vercel all envs                             |
| Local env layout cleaned         | **`.env`** = public `NEXT_PUBLIC_*` only; **`.env.local`** = quoted secrets (`XI_API_KEY`, AI Gateway, Blob, Upstash, OIDC); `.env.example` updated                                     |
| Real locales locked              | **English + French** — D4/D8/D9. Model pinned **per locale**, see correction 1 above                                                                                                    |
| **Portico agent created**        | `agent_0201kyd61dnjey7bkz56hpyhs3f1` — in `.env` + Vercel all envs. All 5 D8 overrides verified; `client_events` corrected; live EN + FR sessions proved the overrides apply            |
| Blob store access                | **Private** (`juno-letters` / `store_D2WuxECBKxmSPVzn`) — decided by infra, not open                                                                                                    |
| Free-tier confirmed              | Hobby Blob + Upstash free + AI Gateway $5 credits — fine for demo                                                                                                                       |
| Medic discharge corpus           | **`fixtures/discharge-summaries/`** — **demo gold = Whitfield pneumonia (02)** [L6]; **Bradley (05) = red-flag QA**; Sinclair / Clarke / Okafor = QA. Not in `public/`                  |
| **NHS drug lookup fully mapped** | **`fixtures/nhs-drug-map.json`** — all 25 corpus drugs resolved against the live A–Z: **18 found, 6 no-urgent-guidance, 1 absent, 0 failures.** A7's test oracle; A8 done early         |
| Demo clot-preventer              | **Apixaban** (medic's call) → gold letter switched to Whitfield, the only letter carrying it. Resolves on NHS.uk with 2 urgent blocks. Enoxaparin/Sinclair stay as the `absent` QA case |

### Still to do (before / as Phase 0)

| Item                    | Notes                                                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packages                | `pnpm add @upstash/redis @vercel/blob ai server-only` (Task 0.8 — 0.3 imports these and no task installed them)                                                                                                                  |
| Code Phase 0            | schema (**`portico-extract/1`**, not `juno-extract/1`), `lib/store/log.ts` (**Task 0.7 — the second shared contract, previously unowned**), redis client, `llmEnv`/`blobEnv`/`redisEnv`, CI/format, `<html lang>`, override docs |
| Server tools webhooks   | Need a **deployed** URL later (B4) — not localhost. Same trap applies to A5's `onUploadCompleted`                                                                                                                                |
| Human calls outstanding | **None.** All closed — see the locked-decisions callout above                                                                                                                                                                    |

### Env file contract (do not undo)

- Secrets → `.env.local` (quoted). Public → `.env`.
- `NEXT_PUBLIC_PORTICO_MODE` (`live` | `demo`, default `live`) is **public** —
  the UI has to render it. See `plan.md §Demo mode vs live mode`.
- Never print secret values into chat, commits, or audit files.
- `vercel env pull .env.local --yes` is safe to re-run; it will not remove the
  layout above if you re-apply the split afterward.

---

## Phase 0 — Shared foundation (BOTH — do together, ~1h)

- [x] Accept Upstash Marketplace terms; Redis provisioned + env on Vercel
      (Prod/Preview/Development)
- [x] Create `AI_GATEWAY_API_KEY` (local + Vercel all envs; probe 200)
- [x] Local `.env` / `.env.local` cleaned; secrets on Vercel for deploy
- [x] Real `XI_API_KEY` in `.env.local` (probe 200)
- [x] **Portico ElevenLabs agent created** — `agent_0201kyd61dnjey7bkz56hpyhs3f1`.
      Per-locale model pin, 5 overrides, `client_events` fixed, live EN+FR
      proof. **Do not redo; do not "fix" the base TTS model**
- [ ] `make format` **first and alone** — it rewrites 6 files (CI is red on
      six, not one). Then add `pnpm typecheck` + `pnpm lint` to
      `.github/workflows/ci.yml`
- [ ] `pnpm add @upstash/redis @vercel/blob ai server-only` (Task 0.8)
- [ ] **Both devs, one keyboard —** `lib/plan/schema.ts`: port
      `ExtractedBundle`, rename to `portico-extract/1`, add `triggerFr` /
      `actionFr` on `RedFlag` (D7), add the `documentId` → `documents[].id`
      referential check
- [ ] **Both devs, one keyboard —** `lib/store/log.ts` (Task 0.7): `LogEntry` + `appendLogEntry()` + `readLog()`. **This is the second shared
      contract** — A4, A10, B5 and B8 all need it and nothing created it
- [ ] `lib/store/redis.ts` — lazy Redis client factory
- [ ] `lib/store/clock.ts` — `getDemoToday()`/`setDemoToday()`. **Shared: A3/A4
      read it, B10.5 writes it.** Nothing else may construct "today"
- [ ] `lib/env.ts` — add `llmEnv()`, `blobEnv()`, `redisEnv()`
- [ ] `app/layout.tsx` — make `<html lang>` dynamic. **French needs only
      `latin`; but B2's showcase "not yet" panels for `cy/pl/ro/tr` do need
      `latin-ext`** — the old "no `latin-ext`" note was wrong
- [ ] Fix `README.md` + `voice-session.tsx` comment — a disallowed override
      **closes the socket `1008` and surfaces via `onError`**, not a
      synchronous throw. Do not swallow it (Locked D9)

**Checkpoint 0:** `pnpm typecheck && pnpm lint && pnpm format:check` all
green; both devs can import `ExtractedBundle`, `redis()` and
`appendLogEntry()`; `POST /api/seed` works; both can state `LogEntry`'s shape
from memory. **Fail = nobody branches.**

---

## Track A — Ingestion, Timeline, Drug Data

### Phase 1

- [ ] A1 — `lib/plan/samples/demo-plan.ts` seed fixture + `POST /api/seed`.
      **Demo letter = Whitfield (02)**
      (`02_Whitfield_Harold_Pneumonia.{pdf,json}`) [L6]. Form JSON →
      `ExtractedBundle`; other four letters are QA only
- [ ] A2 — `lib/store/plan.ts`, `lib/store/patient.ts` (parse on every read;
      throw on corrupt data — no soft defaults)
- [ ] A3 — `lib/timeline/schedule.ts` — `buildTimeline`, `dueToday` (pure)
- [ ] A4 — Rebuild `/plan` (replace placeholder): timeline + day-section +
      task-row components

**Checkpoint 1 (joint):** `/plan` renders a real Redis-backed timeline.

### Phase 2

- [ ] A5 — Blob client upload: `/api/blob/upload` token route +
      `upload-panel.tsx`. **Access is already `Private`** — not an open
      question. **One control accepting BOTH camera and file**:
      `accept="image/*,application/pdf"` + `capture="environment"`, multi-file.
      PDFs are testable today from the corpus; the photo path is the demo story.
      `onUploadCompleted` cannot reach localhost
- [ ] A6 — `lib/extraction/extract.ts` + `/api/extract`. Shape **verified**
      against `ai@7.0.37`: `generateText` + `Output.object`, param is
      `output`. **Two failure surfaces, two 422s** — `NoObjectGeneratedError`
      (SDK throws; there is no `safeParse` there) vs the post-merge Zod parse.
      Private blob → send bytes as `{ type: "file", mediaType, data }`,
      never a URL. Never a fake plan. Demo on Whitfield PDF; QA the other four
      PDFs against sibling `.json`
- [ ] A6.5 — **The checking mechanism.** `scripts/eval-extraction.ts` +
      `make eval`: run A6 over **all five** PDFs, score against the medic's
      JSON gold labels. Node 26 runs `.ts` natively — no vitest, no tsx.
      Five families scored separately: patient identity (100%), medication
      names (100% recall), appointments (100% recall), red-flag quotes (100%),
      source refs (100%). **Compare whitespace/punctuation-insensitively** —
      calibrated at 158/174 (90%); the 16 misses are JSON-side composed
      addresses/practice names, so exempt those and enforce on clinical text.
      Do NOT use `pdftotext -layout` (scores worse)
- [ ] A6.6 — **`NEXT_PUBLIC_PORTICO_MODE=live|demo`.** See
      `plan.md §Demo mode vs live mode` for the full contract. Only 4 things
      differ: extraction (baked bundle, no LLM), drug context
      (`nhs-drug-map.json`, no network), clock (overridable), seed state
      (primed). **Voice, Redis, server tools, `assess()`, Blob and the whole UI
      stay REAL in both** — the voice is the hero feature and is never faked.
      **A `live` failure must 422, NOT become `demo`** [D9]; the mode must be
      **visible on screen**; and every shortcut needs a proven live counterpart.
      Depends on A6.5 — the baked JSON is only licensed by a green `make eval`
- [ ] A7 — `lib/drugs/lookup.ts` + `/api/drug-info` (NHS.uk fetch, 24h Redis
      cache; 404 guard against drugs not in the patient's own plan).
      **Oracle: `fixtures/nhs-drug-map.json`** — every corpus drug already
      resolved; expect **18 found / 6 no-urgent-guidance / 1 absent**.
      `identifier: "urgent"` is in the **nested** `hasPart`
      (`hasPart[].hasPart[]`) — scanning the top level returns zero.
      **Four-state union `found | no-urgent-guidance | absent | unavailable`,
      NOT a bare `null`.** Needs a slug **alias layer** (`paracetamol` →
      `paracetamol-for-adults`, etc — 9 of 25 fail a naive slug).
      **Depends on A1, not A6**
- [x] A8 — **DONE:** `fixtures/nhs-drug-map.json` committed, covering all five
      letters. Implementer still owns the explicit, logged resolution order
      (Redis → network → seed) and must label a seed hit as a seed hit

**Checkpoint 2 (joint):** real letter → extraction → timeline → drug context,
live — **and `make eval` passes on all five letters.** A green eval is what
licenses using `PORTICO_MODE=demo` later; without it, the baked bundle is just
a mock wearing a costume.

### Phase 3

- [ ] A9 — `red-flag-card.tsx` + source-trace ("tap to see where it says
      that") UI, with attribution line per licence bucket; dual EN+FR on red
      flags (Locked D7), `lang="en"` + `translate="no"` on the verbatim block.
      **Source image needs a streaming route handler** — Blob is Private
- [ ] A10 — `task-check.tsx` client leaf → **Server Action**, not B4's
      `/api/log` (that route's auth header cannot ship to a browser). Both
      write paths converge on Task 0.7's `appendLogEntry()`
- [ ] A11 — Accessibility pass: contrast, ≥44px targets, error/empty states

**Checkpoint 3:** upload a real letter live, tap a red flag, see the source
photo.

---

## Track B — Voice, Escalation, Family Dashboard, i18n

### Phase 1

- [ ] B1 — `lib/i18n/` dictionary module: `locales.ts`
      (`REAL_LOCALES = ["en","fr"]`), `dictionary.ts`, `en.ts`,
      `fr.ts satisfies Dictionary` (missing key = compile error).
      **Ignore `05:628`** — it tells you to return `en` for showcase locales,
      which is the fallthrough D9 bans. Include A9's D7 labels
- [ ] B2 — `app/actions/set-locale.ts` + fix `language-picker.tsx` (delete
      flag icons, filter active locale, remove "Default" badge, ≥44px rows,
      top-right on every screen, in-language "not yet" panel for showcase
      locales — never English leak)
- [ ] B3 — `buildCheckInPrompt(bundle, today, locale)` — authored persona in
      en/fr (no machine translate), rewritten `firstMessage`, fix the
      "Is this normal after surgery?" generic-Q&A question
- [ ] B3.6 — **DO NOT BUILD.** The ear-test PASSED [L1]; French works on the
      single agent. This stays on the page only as the pre-authorised remedy if
      French ever regresses later. Two
      agents, one per locale, each pinning its model in its own base config
      (`Portico EN`/`eleven_flash_v2`, `Portico FR`/`eleven_flash_v2_5`).
      Needs `NEXT_PUBLIC_AGENT_ID_FR`, a `locale` param on
      `/api/eleven/signed-url`, `fetchSignedUrl(locale)`. The signed-URL
      endpoint takes only `agent_id`, so locale **must** be an id switch.
      Mirror both agents' overrides + `client_events` + tools or they drift
- [ ] B3.5 — `voice-session.tsx` — replace hardcoded `language: "en"` with a
      `locale` prop; English regression then French ear-test. Bad French
      audio → **stop**, do not downgrade to English voice (Locked D9)

**Checkpoint 1 (joint):** check-in session starts, reads the seeded plan,
speaks English, then French on the per-locale-pinned agent.
**The C2 ear-test PASSED [L1] — French is confirmed on the single agent.**
B11's pre-demo re-check still applies; a later regression means B3.6, never a
downgrade.

### Phase 2

- [ ] B4 — Server tools: `/api/log`, `/api/escalate` (bind `patient_id`/
      `check_in_id` as dynamic variables; decide a stable deployed alias —
      ElevenLabs cannot call `localhost`). **Auth via `request_headers` +
      `secret_id`, NOT `secret__`** (that only hides values from the LLM, not
      the browser). These routes serve ElevenLabs only — A10 uses an action
- [ ] B5 — `lib/escalation/rules.ts` — pure `assess()` discriminated union
- [ ] B6 — `show_red_flag` client tool (never throws internally; do not add
      `onUnhandledClientToolCall`)
- [ ] B7 — Wire `onAgentToolRequest`/`onAgentToolResponse` for live UI ticks.
      **`client_events` already set in Phase 1 — do not re-PATCH the agent**
      (it risks the model pins). Read back to confirm; B6 needs
      `client_tool_call`, which is also already there
- [ ] B8 — `/family` dashboard (`force-dynamic`, `Promise.all` reads).
      **Phone-shell rule applies: no `dvh`/`vh`** — `flex min-h-0 flex-1
flex-col`. Same for B2's showcase panel and B10
- [ ] B9 — `refresh-poller.tsx` (5s `router.refresh()`) — verify with a real
      two-device test
- [ ] B10 — Incoming check-in card (Tier A only — **no** Web Push, no
      manifest, no service worker). Driven by state so B10.5 can raise it on cue
- [ ] B10.5 — **`/operator` demo control panel.** The video is ~60s and the
      product's beats are day-scale, so every beat needs a trigger: reset/seed,
      set demo clock, mark step taken/missed, send the check-in notification,
      toggle `PORTICO_MODE`. **Hard rule [D9]: it may only do what a real
      user could do, faster — it writes real state through real code paths and
      never paints fake UI.** Second screen: lives OUTSIDE the `(phone)` group,
      desktop width, never linked from the product. **Build it early** — both
      devs will otherwise hand-edit Redis all day

**Checkpoint 2 (joint):** voice call logs adherence, UI ticks live, a second
miss escalates visibly on `/family` from another device.

### Phase 3

- [ ] B11 — **Pre-demo French re-check** (the _gate_ was Checkpoint 1):
      confirm BOTH pins — base `eleven_flash_v2` and `fr` preset
      `eleven_flash_v2_5`; one
      real `fr` session; ear-test TTS and ASR separately. Fail = escalate to
      human, **no** French-UI + English-voice downgrade
- [ ] B12 — High-stakes ASR safety: bilingual `asr.keywords`, tappable
      French answer chips, confirm-before-logging (composer = explicit typed
      path the user chooses, not a silent ASR substitute)
- [ ] B13 — `prefers-reduced-motion` block; standardise `focus-visible`
      everywhere
- [ ] B14 — `make seed` target (headless form of B10.5 button 1; primes two
      missed **apixaban** doses) + operator runbook. Rehearse with a stopwatch
      against the 60s limit

**Checkpoint 3:** full demo arc runs twice back-to-back in **`demo`** mode, no
manual Redis surgery between runs. **Checkpoint 2 must already have passed in
`live` mode with `make eval` green** — passing 3 without 2 means the app does
not actually work, and demo polish does not fix that.

---

## Cross-cutting — do not forget

- [ ] Never construct `Redis()` or a Blob client at module scope
- [ ] Every new secret goes in its own `xxxEnv()`, never the browser-safe
      `env` object — missing secrets **throw**, never soft-default
- [ ] `getUserMedia → fetchSignedUrl → startSession` stays inside the direct
      tap — no effects, no timeouts
- [ ] Escalation threshold lives in `lib/escalation/rules.ts`, never in the
      agent prompt or the tool itself
- [ ] `lib/plan/schema.ts` changes are announced to both tracks before
      merging — it's the one file that can force a Redis reseed
- [ ] `PORTICO_MODE` is set by a human, never by a `catch`. A live extraction
      failure 422s; it never quietly serves the baked bundle. The mode is
      rendered on screen whenever it is `demo`
- [ ] **No silent fallbacks** [Locked D9]: no model drift, no English
      fallthrough in UI/voice, no catch-and-ignore on overrides/env, no mock
      data pretending to be live. One explicit path; fail loudly

## End-to-end flow (cheat sheet)

```
locale (en|fr) → upload → Blob → extract (AI Gateway) → Redis
  → drug lookup (NHS.uk, typed null if absent)
  → /plan (buildTimeline)
  → check-in tap → signed URL → voice on the per-locale pin (overrides)
  → log / escalate (server tools) → /family (poll)
```

## Open decisions — none block coding

All human gates are closed. See the locked-decisions callout at the top of this
file, and `tasks/plan.md §DECISIONS LOCKED` (L1–L8) for the full table.

**Optional, whenever convenient — neither blocks anyone:**

1. Photograph one printed letter. All six corpus PDFs are born-digital with a
   perfect text layer, so **the camera path is currently untested** and A6's
   real-world behaviour is unmeasured. Ten minutes closes it.
2. Ask the medic whether a real letter would carry a callable ward or clinic
   number. No letter in the corpus names one, so `contacts[]` in the seed is
   partly composed rather than transcribed.

**Deferred by decision [L7/L8]:** Tier 3 Resend email escalation, and `vitest`
for the two pure modules. Build neither unless there is spare time at the end.

**Closed since this list was written:** Blob access — the store is **Private**,
decided by infrastructure, not pending a call.

Settled: second language is **French**, on an explicitly pinned model per
locale — `en` → `eleven_flash_v2`, `fr` → `eleven_flash_v2_5` (not Welsh, and
not unpinned Multilingual drift). See correction 1 at the top of this file.
