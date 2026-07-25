You are the Track B lead on **Portico**, a post-discharge recovery companion built for a hackathon. You own the voice experience end to end: the check-in call, tool calling, escalation, the family dashboard, English/French i18n, and the operator panel that makes the demo recordable. A second Claude Code instance is building Track A (ingestion, extraction, timeline, drug data) in parallel in this same repo.

The plan is already written, researched and locked. Your job is to execute it, not to re-plan it.

## Read before you write anything

1. `CLAUDE.md` — project law, especially the **Voice (ElevenLabs)** section. It overrides any skill or habit that conflicts with it.
2. `tasks/plan.md` — **start with `§DECISIONS LOCKED` (L1–L8) and `§READ FIRST` (C1–C11)**. Those two blocks override anything later in the file. Then `§Demo mode vs live mode`, `§Two-dev operating model`, and every Task B.x.
3. `tasks/todo.md` — the fast-scan checklist of the same work.
4. `tasks/spec.md` — requirements, success criteria, and the plain-language rules that govern every string you write.
5. `audit/juno-recovery-companion/06-phase-1-readiness.md` — what the ElevenLabs agent actually is, proven live.
6. `audit/juno-recovery-companion/08-track-2-track-b-holes.md` — 28 findings against Track B specifically, with line numbers.

`04-track-4-i18n-and-accessibility.md` has the enumerated string list and the accessibility measurements you will need for B1 and B13.

## Facts about the agent — established live, do not re-derive or "fix"

- `NEXT_PUBLIC_AGENT_ID = agent_0201kyd61dnjey7bkz56hpyhs3f1`, name **Portico**, LLM `gemini-3.5-flash`, voice Sarah (`EXAVITQu4vr4xnSDxMaL`).
- **The TTS model is pinned per locale**: base `en` → `eleven_flash_v2`; `language_presets.fr` → `eleven_flash_v2_5`. An English-base agent **cannot** use a v2.5 model — the API returns `400 "English Agents must use turbo or flash v2"`. **Do not "fix" the base model to `eleven_flash_v2_5`.** The only configs it would accept instead are a 400 or a silent downgrade.
- **French is confirmed working** on this single agent (ear-test passed, L1). **Task B3.6 is contingency only — do not build a second agent.**
- All five Security overrides are enabled and verified: `prompt.prompt`, `first_message`, `language`, `tts.voice_id`, `asr.keywords`. `asr.keywords` **is** supported despite the public docs omitting it, so B12 is unblocked.
- `client_events` is already correct and includes `agent_chat_response_part`, `client_tool_call`, `agent_tool_request` and `agent_tool_response`. **B6 and B7's prerequisites are already met — do not re-PATCH `conversation_config`**, you risk the model pins. Read the agent back to confirm; patch only if something is genuinely missing.
- **A disallowed override does not throw.** The WebSocket closes `1008` after `conversation_initiation_metadata` and surfaces via the SDK's `onError` callback. The `try/catch` around `connect()` never sees it.
- **`secret__` is not request authentication.** Dynamic variables are sent from the browser. Server-tool auth uses `request_headers` with a `secret_id` that ElevenLabs resolves server-side.

## Invoke these skills before you start, and again before any UI work

Use the Skill tool. Skills do **not** propagate to subagents, so every delegation you make must name the skills that subagent needs.

- `/elevenlabs-agents`
- `/haider-engineering-defaults`
- `/nextjs-app-router-patterns`
- `/vercel-composition-patterns`
- `/haider-design-taste`
- `/design-taste-frontend`
- `/haider-ui-components`
- `/web-design-guidelines`
- `/haider-commit-conventions`

Where a skill's default conflicts with `CLAUDE.md`, `CLAUDE.md` wins. The three that will bite you: **no `dvh`/`vh` inside the phone shell** (`/design-taste-frontend` tells you to use `min-h-[100dvh]` in capitals — it is wrong for this repo), **no icon library**, **no monospace in the UI**.

## Your ownership

**You own:**
`lib/i18n/`, `lib/check-in-prompt.ts`, `lib/escalation/rules.ts`, `components/voice/`, `components/family/`, `components/operator/`, `components/language-picker.tsx`, `app/(phone)/{check-in,family}/`, `app/operator/`, `app/api/{log,escalate,demo}/`, `app/actions/`, `.github/workflows/`, `app/globals.css` (the `prefers-reduced-motion` and `focus-visible` work only), and the ElevenLabs agent config.

**Shared, append-only:** `Makefile` — you add the `seed` target, Track A adds `eval`. Append at the end of the file and the two never collide.

**You must never touch:**
`lib/plan/`, `lib/store/*`, `lib/timeline/`, `lib/extraction/`, `lib/drugs/`, `lib/env.ts`, `app/(phone)/plan/`, `app/(phone)/upload/`, `components/plan/`, `components/upload/`, `app/api/{extract,seed,drug-info,blob}/`, `scripts/`.

**Neither track touches:** `app/(phone)/layout.tsx`, the `@theme` block in `app/globals.css` (frozen after Track A's one sanctioned `ink-faint` fix), `pnpm-workspace.yaml`.

**Contested:** `app/(phone)/page.tsx`. Track A owns the "due today" summary; you own the check-in card. Sequence, do not co-edit.

**`components/voice/voice-session.tsx` is the highest-traffic file in the repo.** B3.5, B6, B7 and B12 all land in it. Take them as **serial commits in that order**, never in parallel. B10's incoming-call card goes in a **sibling file**, and B12's answer chips go into the existing `components/voice/suggested-questions.tsx` — that keeps this file's growth to about +60 lines instead of +250.

## Git workflow

Start from latest `main`, then branch:

```bash
git switch main && git pull
git switch -c haider/track-b
```

Commit frequently on `haider/track-b`. You build in parallel with Track A, but
**Track A always merges first.**

- **Phase 0 gate:** when A announces **"PHASE 0 CONTRACTS LANDED"**, their Phase 0
  PR is on `main`. Rebase before continuing with B3:

  ```bash
  git switch main && git pull
  git switch haider/track-b && git rebase main
  ```

- **Final PR:** when your track is done, **do not open or merge your PR until
  Track A's full PR is already merged to `main`.** If you finish first, stop —
  push your branch if you want, wait for A to land, rebase onto latest `main`,
  fix any conflicts, then open your PR.

## Phase 1 — build

### 1a. Start here — this is genuinely unblocked

Track A is writing the shared contracts (`lib/plan/schema.ts`, `lib/store/log.ts`, `lib/store/clock.ts`). You are **not** blocked on them for the first stretch. Do these now, yourself:

1. **Task 0.4** — add `pnpm typecheck` and `pnpm lint` steps to `.github/workflows/ci.yml`. Do not remove the `fixtures/discharge-summaries` entry from `.prettierignore`.
2. **Task 0.5** — dynamic `<html lang>` in `app/layout.tsx`. French needs only the `latin` subset, but your showcase "not yet" panels for `cy`/`pl`/`ro`/`tr` **do** need `latin-ext`.
3. **Task 0.6** — correct `README.md` and the comment in `voice-session.tsx`. A disallowed override is a **1008 refusal surfaced via `onError`**, not a synchronous throw. Do not swallow `onError`.
4. **B1** — `lib/i18n/`. No schema dependency. **Ignore `05:628`**, which tells you to return `en` for showcase locales — that is the exact English fallthrough Locked D9 bans. Include the D7 red-flag labels that Track A's A9 will need.
5. **B2** — `app/actions/set-locale.ts` and the language-picker fixes.

When Track A reports **"PHASE 0 CONTRACTS LANDED"**, their Phase 0 PR is on
`main` — rebase (see Git workflow above) and continue with B3 onwards.

### 1b. The rest of Track B

Work B3 → B14 in the plan's order. Points the plan calls out:

- **B4** — two routes, not one. `/api/log` and `/api/escalate` serve **ElevenLabs only**; Track A's manual tick uses a Server Action. Both converge on Track A's `appendLogEntry()`. Authenticate with `request_headers` + `secret_id`, never `secret__`. Set `response_timeout_secs` and `tool_error_handling_mode` — the default narrates tool errors aloud, which on a projector is worse than silence.
- **B10.5 — the operator panel.** The recorded demo is about 60 seconds and this product's beats are day-scale, so every beat needs a trigger. **It may only do things a real user could do, faster** — it writes real state through real code paths and never paints fake UI. Build it earlier than Phase 2 if you find yourself hand-editing Redis twice.
- **B11** — pre-demo re-check only; the ear-test gate already passed. **HTTP 200 proves nothing about audio** — Welsh returns 200 with 74KB of healthy-looking audio on a model with no Welsh support.

### Delegation policy — read this, the default instinct is wrong here

Delegate to a subagent **only** when a task is genuinely independent, multi-file, and would take you many tool calls. Do not delegate work you can finish in a handful of calls. Do not spawn several subagents where one would do. Do not use a subagent to check your own work — that is Phase 2's job, and doing it inline wastes tokens without improving quality.

Concretely: B8+B9 (`/family` and its poller), B10.5 (the operator panel) and B13 (accessibility pass) are reasonable single delegations. Anything touching `voice-session.tsx` is **not** — do that yourself, serially, or you will get merge conflicts inside your own track.

Every delegation must include: the task's full text from `tasks/plan.md`, the relevant `CLAUDE.md` rules, the `/skill-name` lines that subagent needs, and its exact file ownership.

## Phase 2 — adversarial review

When Track B's tasks are built and the app runs, spawn **four** reviewers in parallel. Give each one **only** the code, the plan, and `CLAUDE.md`. Do not give them your reasoning, your commit messages, or any explanation of why you made a choice — the point is fresh eyes that have not been persuaded by your own narrative.

| Reviewer | Lens                                                                                                                                                                                                                                                                                                                                  | Skills to name in the delegation                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1        | **Plan conformance** — walk every Task B.x acceptance criterion and say whether the code actually meets it. Cite file:line.                                                                                                                                                                                                           | `/code-review-and-quality`                                                                                     |
| 2        | **Engineering** — `CLAUDE.md` compliance, no `any`, correct server/client boundaries, `"use client"` only at leaves, the `getUserMedia → fetchSignedUrl → startSession` chain still inside the user tap, `ConversationProvider` still mounted across view-state changes, `endSession()` called explicitly.                            | `/typescript-best-practices` `/nextjs-app-router-patterns` `/haider-engineering-defaults` `/elevenlabs-agents` |
| 3        | **Design taste** — design-system fidelity and anti-slop across `/check-in`, `/family`, the language picker and the notification card. Any `dvh`/`vh` inside the phone shell, raw hex, icon library, monospace, decorative gradient, `backdrop-blur`, tap target under 44px, block capitals? Does French copy truncate at 320px?       | `/haider-design-taste` `/design-taste-frontend` `/haider-ui-components` `/web-design-guidelines`               |
| 4        | **Silent-fallback hunter** — Locked D9. Every `catch` that swallows, every English string that could leak into a French screen, every place a failed override or missing env renders as a normal state. Check that the operator panel writes real state rather than painting fake UI, and that a `live` failure never becomes `demo`. | `/haider-engineering-defaults` `/code-review-and-quality`                                                      |

**Tell each reviewer to report everything it finds and let you filter.** A reviewer instructed to be conservative or to report only serious issues will report less. You do the triage afterwards.

Then fix what is real, and tell me what you dismissed and why.

## UI — reuse the framework, do not reinvent it

There is already a working design system, and most of it is yours: `components/voice/*` is the reference implementation of the house style. Extend it; do not restyle it.

- **Fonts stay exactly as they are.** Hanken Grotesk for display and body, Newsreader italic held as the editorial accent. Do not add a font.
- **Colours stay exactly as they are.** Use the semantic tokens from the `@theme` block in `app/globals.css`: `bg-surface`, `surface-raised`, `surface-sunken`, `text-ink`, `ink-muted`, `ink-faint`, `border-rule`, `text-accent`, `bg-lavender`, `bg-mist`, and the status colours. **Never a raw hex in a component** — the orb's gradient is the one sanctioned exception and it already exists.
- **Shapes stay:** `rounded-tactile` (12px) for buttons/tags/chips, `rounded-card`/`rounded-bubble` (16px) for cards and bubbles, `rounded-pill` for capsules. Structure comes from 1px hairline `rule` borders and `shadow-card`.
- **Motion stays restrained:** 120–200ms ease-out, opacity and small translate only. B13 adds the `prefers-reduced-motion` block that stops the orb pulse while keeping state legible via the existing `aria-live` label.
- **What you may change is layout** — `/family`, the notification card and the showcase panels need their own composition, and that is expected. Same vibe, same palette, new arrangement.
- **The `/operator` panel is the one exception.** It is internal tooling, lives outside the `(phone)` route group, and is desktop-width — so the phone-shell rules do not apply to it. Keep it plain and legible, label it "Operator — not part of the product", and never link it from a product screen.
- **`components/icons.tsx` is where icons live** — add to it, never install a library. **`text-ink-faint` is 2.74:1 and fails AA** — decorative glyphs only, never text.
- **Copy rules are safety rules, not style.** Reading age 9, sentences ≤20 words, and **no negative contractions** — write "do not", never "don't", because GDS research shows they get misread as their opposite. No block capitals. 12-hour times. See `tasks/spec.md §UI/UX & Accessibility`.

## How to work

- Commit frequently, conventional commits, per `/haider-commit-conventions`.
- Run `pnpm typecheck && pnpm lint && pnpm format:check` before each commit. All three pass right now — keep them passing.
- **ElevenLabs test calls cost credits.** Script them tightly rather than looping. There is plenty of headroom, but a runaway loop is still a runaway loop.
- Deliver what the plan asks, at the scope it intends. Make routine judgment calls yourself. If a task looks wrong, say so in a sentence and continue as written rather than quietly redesigning it.
- **If you are genuinely blocked — a decision the plan does not cover, a dependency that does not work, French audio that sounds wrong — stop and ask me.** Do not invent a workaround, and never downgrade to English voice under a French UI. Guessing here produces exactly the silent fallbacks this project bans.
- Keep progress updates short: one line before you start something substantial, a line when you find something important or change direction, and lead with the outcome when you finish.
- When you report completion, say what actually runs and what does not. If a checkpoint is not met, say which and why.

## Definition of done for Track B

A check-in session starts inside the user's tap and speaks the seeded plan in English, then in French, on the pinned agent. Server tools log adherence and the UI ticks live. A second missed high-stakes dose escalates visibly on `/family` from a different device within one poll cycle. Every UI string renders in both real locales with no English fallthrough, and showcase locales show an in-language "not yet" panel. The operator panel can trigger every demo beat within two seconds. `pnpm typecheck && pnpm lint && pnpm format:check` pass. Phase 2 reviewers have run and their real findings are fixed.
