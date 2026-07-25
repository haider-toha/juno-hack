# Portico — Build Checklist

Full detail, acceptance criteria and citations: `tasks/plan.md` and
`plan/spec.md`. Locked decisions (incl. French + no silent fallbacks + name):
`audit/juno-recovery-companion/00-locked-decisions.md` (D4, D8, D9, **D10**).

**Product name: Portico.** Juno is the hackathon host only — never the app
brand [Locked D10].

This file is the fast-scan version for the build itself.

## Setup status (as of 2026-07-25 evening) — read this first

Infra and keys are largely done. **Do not re-provision Redis/Blob/AI Gateway.**
The remaining Phase 0 gap is the **ElevenLabs agent** (+ code tasks below).

### Done

| Item | Where |
| --- | --- |
| Product name locked | **Portico** (D10) — not Juno |
| Vercel project linked | `haider-projects/juno-hack` (slug legacy; product is Portico) |
| Claude Vercel MCP authenticated | `claude mcp list` → ✔ Connected |
| Upstash Redis (free) provisioned | URL + token on Vercel Prod/Preview/**Development** |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` on all envs |
| `AI_GATEWAY_API_KEY` | local + Vercel Prod/Preview/Development; `/v1/models` → 200 |
| `XI_API_KEY` | `.env.local` + Vercel; `GET /v1/user` → 200 |
| `NEXT_PUBLIC_XI_VOICE_ID` | `.env` + Vercel all envs |
| Local env layout cleaned | **`.env`** = public `NEXT_PUBLIC_*` only; **`.env.local`** = quoted secrets (`XI_API_KEY`, AI Gateway, Blob, Upstash, OIDC); `.env.example` updated |
| Real locales locked | **English + French** on pinned `eleven_flash_v2_5` (not Welsh) — D4/D8/D9 |
| Free-tier confirmed | Hobby Blob + Upstash free + AI Gateway $5 credits — fine for demo |

### Still to do (before / as Phase 0)

| Item | Notes |
| --- | --- |
| **Create ElevenLabs Conversational AI agent** | `NEXT_PUBLIC_AGENT_ID` is still a placeholder. Pin `eleven_flash_v2_5`, add French, enable Security overrides (D8), write real id into `.env` **and** Vercel |
| Packages | `pnpm add @upstash/redis @vercel/blob ai` (not installed yet) |
| Code Phase 0 | schema, redis client, `llmEnv`/`blobEnv`/`redisEnv`, CI/format, `<html lang>`, override docs |
| Server tools webhooks | Need a **deployed** URL later (B4) — not localhost |

### Env file contract (do not undo)

- Secrets → `.env.local` (quoted). Public → `.env`.
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
- [ ] **Create Portico ElevenLabs agent** (Locked D8) — **only open infra item**:
      pin `tts.model_id = "eleven_flash_v2_5"`; add French; enable Security
      overrides (`prompt`, `first_message`, `language`, `voice_id`,
      `asr.keywords`); set real `NEXT_PUBLIC_AGENT_ID` in `.env` + Vercel;
      persona/name = **Portico** (not Juno); **re-check the model pin after
      adding French** — if it drifted, fix it
- [ ] `pnpm add @upstash/redis @vercel/blob ai`
- [ ] `lib/plan/schema.ts` — port the `ExtractedBundle` Zod schema (incl. the
      French translation slot on `RedFlag`)
- [ ] `lib/store/redis.ts` — lazy Redis client factory
- [ ] `lib/env.ts` — add `llmEnv()`, `blobEnv()`, `redisEnv()`
- [ ] `make format` (fixes red CI); add `pnpm typecheck` + `pnpm lint` to
      `.github/workflows/ci.yml`
- [ ] `app/layout.tsx` — make `<html lang>` dynamic (no Welsh `latin-ext`)
- [ ] Fix `README.md` + `voice-session.tsx` comment — overrides **throw**,
      not silently ignored (loud failure is correct — Locked D9)

**Checkpoint 0:** `pnpm typecheck && pnpm lint && pnpm format:check` all
green; agent id set; Flash v2.5 pin verified. Branch into tracks below.

---

## Track A — Ingestion, Timeline, Drug Data

### Phase 1
- [ ] A1 — `lib/plan/samples/demo-plan.ts` seed fixture + `POST /api/seed`
- [ ] A2 — `lib/store/plan.ts`, `lib/store/patient.ts` (parse on every read;
      throw on corrupt data — no soft defaults)
- [ ] A3 — `lib/timeline/schedule.ts` — `buildTimeline`, `dueToday` (pure)
- [ ] A4 — Rebuild `/plan` (replace placeholder): timeline + day-section +
      task-row components

**Checkpoint 1 (joint):** `/plan` renders a real Redis-backed timeline.

### Phase 2
- [ ] A5 — Blob client upload: `/api/blob/upload` token route +
      `upload-panel.tsx` (**ask human** `public` vs `private` first — do not
      quietly choose)
- [ ] A6 — `lib/extraction/extract.ts` + `/api/extract` (AI SDK,
      `generateText` + `Output.object` — verify shape after installing `ai`;
      bad parse → 422, not a fake plan)
- [ ] A7 — `lib/drugs/lookup.ts` + `/api/drug-info` (NHS.uk fetch, 24h Redis
      cache, scan ALL `hasPart` aspects for `identifier: "urgent"`, typed
      `null` if absent — never invent side effects; 404 guard against drugs
      not in the patient's own plan)
- [ ] A8 (stretch only if NHS.uk flaky) — commit
      `data/nhs-medicines-seed.json` with an **explicit** resolution order

**Checkpoint 2 (joint):** real letter → extraction → timeline → drug context,
live.

### Phase 3
- [ ] A9 — `red-flag-card.tsx` + source-trace ("tap to see where it says
      that") UI, with attribution line per licence bucket; dual EN+FR on red
      flags (Locked D7)
- [ ] A10 — `task-check.tsx` client leaf (coordinate with B4 on `/api/log`
      shape)
- [ ] A11 — Accessibility pass: contrast, ≥44px targets, error/empty states

**Checkpoint 3:** upload a real letter live, tap a red flag, see the source
photo.

---

## Track B — Voice, Escalation, Family Dashboard, i18n

### Phase 1
- [ ] B1 — `lib/i18n/` dictionary module: `locales.ts`
      (`REAL_LOCALES = ["en","fr"]`), `dictionary.ts`, `en.ts`,
      `fr.ts satisfies Dictionary` (missing key = compile error)
- [ ] B2 — `app/actions/set-locale.ts` + fix `language-picker.tsx` (delete
      flag icons, filter active locale, remove "Default" badge, ≥44px rows,
      top-right on every screen, in-language "not yet" panel for showcase
      locales — never English leak)
- [ ] B3 — `buildCheckInPrompt(bundle, today, locale)` — authored persona in
      en/fr (no machine translate), rewritten `firstMessage`, fix the
      "Is this normal after surgery?" generic-Q&A question
- [ ] B3.5 — `voice-session.tsx` — replace hardcoded `language: "en"` with a
      `locale` prop; English regression then French ear-test. Bad French
      audio → **stop**, do not downgrade to English voice (Locked D9)

**Checkpoint 1 (joint):** check-in session starts, reads the seeded plan,
speaks English then French on the pinned Flash v2.5 agent.

### Phase 2
- [ ] B4 — Server tools: `/api/log`, `/api/escalate` (bind `patient_id`/
      `check_in_id` as dynamic variables, `secret__` header auth, decide a
      stable deployed alias — ElevenLabs cannot call `localhost`)
- [ ] B5 — `lib/escalation/rules.ts` — pure `assess()` discriminated union
- [ ] B6 — `show_red_flag` client tool (never throws internally; do not add
      `onUnhandledClientToolCall`)
- [ ] B7 — Wire `onAgentToolRequest`/`onAgentToolResponse` for live UI ticks
      (requires `client_events` set on the agent, not per-session)
- [ ] B8 — `/family` dashboard (`force-dynamic`, `Promise.all` reads)
- [ ] B9 — `refresh-poller.tsx` (5s `router.refresh()`) — verify with a real
      two-device test
- [ ] B10 — Incoming check-in card (Tier A only — **no** Web Push, no
      manifest, no service worker)

**Checkpoint 2 (joint):** voice call logs adherence, UI ticks live, a second
miss escalates visibly on `/family` from another device.

### Phase 3
- [ ] B11 — **French voice confirmation:** re-verify Flash v2.5 pin; one
      real `fr` session; ear-test TTS and ASR separately. Fail = escalate to
      human, **no** French-UI + English-voice downgrade
- [ ] B12 — High-stakes ASR safety: bilingual `asr.keywords`, tappable
      French answer chips, confirm-before-logging (composer = explicit typed
      path the user chooses, not a silent ASR substitute)
- [ ] B13 — `prefers-reduced-motion` block; standardise `focus-visible`
      everywhere
- [ ] B14 — `make seed` target + operator runbook card for the demo

**Checkpoint 3:** full demo arc runs twice back-to-back, no manual Redis
surgery between runs.

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
- [ ] **No silent fallbacks** [Locked D9]: no model drift, no English
      fallthrough in UI/voice, no catch-and-ignore on overrides/env, no mock
      data pretending to be live. One explicit path; fail loudly

## End-to-end flow (cheat sheet)

```
locale (en|fr) → upload → Blob → extract (AI Gateway) → Redis
  → drug lookup (NHS.uk, typed null if absent)
  → /plan (buildTimeline)
  → check-in tap → signed URL → Flash v2.5 voice (overrides)
  → log / escalate (server tools) → /family (poll)
```

## Open decisions still needed from the human

See `plan/spec.md §Open Questions` for full detail:
1. Medic's clinical scenario (blocks nothing — seed fixture is
   condition-agnostic — but confirm apixaban/rivaroxaban)
2. Blob access: `public` vs `private`
3. Whether to build the Tier 3 email escalation stretch at all
4. Whether time permits adding `vitest` for the two pure modules

Settled: second language is **French** on pinned **`eleven_flash_v2_5`**
(not Welsh / not unpinned Multilingual drift).
