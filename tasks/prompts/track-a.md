You are the Track A lead on **Portico**, a post-discharge recovery companion built for a hackathon. You own the path from a photographed discharge letter to a rendered day-by-day recovery plan with drug context attached. A second Claude Code instance is building Track B (voice, escalation, family dashboard, i18n) in parallel in this same repo.

The plan is already written, researched and locked. Your job is to execute it, not to re-plan it.

## Read before you write anything

1. `CLAUDE.md` — project law. It overrides any skill or habit that conflicts with it.
2. `tasks/plan.md` — **start with `§DECISIONS LOCKED` (L1–L8) and `§READ FIRST` (C1–C11)**. Those two blocks override anything later in the file. Then `§Demo mode vs live mode`, `§Two-dev operating model`, and every Task 0.x and Task A.x.
3. `tasks/todo.md` — the fast-scan checklist of the same work.
4. `tasks/spec.md` — requirements, success criteria, and the plain-language rules.
5. `fixtures/discharge-summaries/` — the medic's corpus. **`02_Whitfield_Harold_Pneumonia`** is the demo gold letter.
6. `fixtures/nhs-drug-map.json` — every corpus drug already resolved against NHS.uk. This is your test oracle for A7; do not re-derive it.

The `audit/juno-recovery-companion/` files are the research trail behind the plan. Read `07-track-1-track-a-holes.md` and `11-fixture-corpus-readiness.md` — they contain quoted source strings and field-by-field analysis you will otherwise spend an hour rediscovering. The rest are background; consult them when the plan cites them.

## Invoke these skills before you start, and again before any UI work

Use the Skill tool. Skills do **not** propagate to subagents, so every delegation you make must name the skills that subagent needs.

- `/haider-engineering-defaults`
- `/typescript-best-practices`
- `/nextjs-app-router-patterns`
- `/vercel-react-best-practices`
- `/haider-design-taste`
- `/design-taste-frontend`
- `/haider-ui-components`
- `/web-design-guidelines`
- `/haider-icon-geometry` (only when adding icons)
- `/haider-commit-conventions`

Where a skill's default conflicts with `CLAUDE.md`, `CLAUDE.md` wins. The three that will bite you: **no `dvh`/`vh` inside the phone shell**, **no icon library**, **no monospace in the UI**.

## Your ownership

**You own:**
`lib/plan/`, `lib/store/{redis,plan,patient,log,clock}.ts`, `lib/timeline/`, `lib/extraction/`, `lib/drugs/`, `lib/env.ts`, `app/(phone)/plan/`, `app/(phone)/upload/`, `app/(phone)/error.tsx`, `components/plan/`, `components/upload/`, `app/api/{extract,seed,drug-info,blob}/`, `scripts/`.

**Shared, append-only:** `Makefile` — you add the `eval` target, Track B adds `seed`. Append at the end of the file and the two never collide.

**You must never touch:**
`components/voice/*`, `components/family/*`, `components/language-picker.tsx`, `lib/i18n/*`, `lib/check-in-prompt.ts`, `lib/escalation/rules.ts`, `app/(phone)/{check-in,family}/`, `app/api/{log,escalate}/`, `app/actions/`, `app/operator/`, `.github/workflows/` (Track B does Task 0.4), the ElevenLabs agent config.

**Neither track touches:** `app/(phone)/layout.tsx`, the `@theme` block in `app/globals.css` (one sanctioned change — the `ink-faint` contrast fix — then it is frozen), `pnpm-workspace.yaml`.

**Contested:** `app/(phone)/page.tsx`. You own the "due today" summary; Track B owns the check-in card. Sequence, do not co-edit — if you need it, take it, commit, and say so.

## Git workflow

Start from latest `main`, then branch:

```bash
git switch main && git pull
git switch -c haider/track-a
```

Commit frequently on `haider/track-a`. **Track A merges to `main` before Track B
ever does** — B is building in parallel but must not land until you are on
`main`.

When Phase 0 contracts are done (below), push, **open a PR to `main`**, and get
it merged. Tell me in one line: **"PHASE 0 CONTRACTS LANDED"** plus the shape of
`LogEntry` and `ExtractedBundle`'s top-level keys.

When the full track is done, push and **open a PR to `main`**. B waits on this
before merging.

## Phase 1 — build

### 1a. Phase 0 contracts — you own these, and Track B is waiting on them

Do these first, in this order, **yourself, without subagents**. They are the spine everything downstream is typed by, and they are small.

1. `pnpm add @upstash/redis @vercel/blob ai server-only` (Task 0.8)
2. `lib/plan/schema.ts` (Task 0.2) — including the `portico-extract/1` rename, the D7 French slots on `RedFlag`, the weekly-dosing variant, the `approximate` date flag, and the `SourceRef.documentId` referential check
3. `lib/store/log.ts` (Task 0.7) — `LogEntry`, `appendLogEntry()`, `readLog()`
4. `lib/store/redis.ts`, `lib/store/clock.ts`, `lib/env.ts` extensions (Task 0.3)

Then commit, push, open a PR to `main`, and get it merged. Announce **"PHASE 0 CONTRACTS LANDED"** as above — Track B is blocked on B3 onwards until that PR is on `main`.

After that, `lib/plan/schema.ts` and `lib/store/log.ts` are **frozen**. Changing either invalidates every stored bundle and forces a reseed on both tracks. If you genuinely need a change: announce it, make it, and state the reseed command — do not change it quietly.

### 1b. Track A tasks

Then work A1 → A11 in the plan's order, respecting the stated dependencies. A few the plan calls out specifically:

- **A1 is mis-sized and is split into A1a/A1b.** Roughly 40% of the clinically-loaded fields must be composed rather than copied, because the NHS form has no directions sentence and no indication column. A1a unblocks A2/A3/A7 — get it out fast.
- **A7 has a committed oracle.** `fixtures/nhs-drug-map.json`. Expect 18 `found`, 6 `no-urgent-guidance`, 1 `absent`. If your implementation disagrees with that file, your implementation is wrong.
- **A6.5 is the eval harness** — `make eval`, plain `.ts` run by `node` (Node 26 strips types natively; no vitest). This is what lets us claim the AI works with a number.

### Delegation policy — read this, the default instinct is wrong here

Delegate to a subagent **only** when a task is genuinely independent, multi-file, and would take you many tool calls. Do not delegate work you can finish in a handful of calls. Do not spawn several subagents where one would do. Do not use a subagent to check your own work — that is Phase 2's job, and doing it inline wastes tokens without improving quality.

Concretely: A9 (red-flag card + source-trace route) and A11 (accessibility pass) are reasonable single delegations. The Phase 0 contracts, A2, A3 and A6.6 are not — do those yourself.

Every delegation must include: the task's full text from `tasks/plan.md`, the relevant `CLAUDE.md` rules, the `/skill-name` lines that subagent needs, and its exact file ownership.

## Phase 2 — adversarial review

When Track A's tasks are built and the app runs, spawn **four** reviewers in parallel. Give each one **only** the code, the plan, and `CLAUDE.md`. Do not give them your reasoning, your commit messages, or any explanation of why you made a choice — the point is fresh eyes that have not been persuaded by your own narrative.

| Reviewer | Lens                                                                                                                                                                                                                                                                                                                    | Skills to name in the delegation                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1        | **Plan conformance** — walk every Task A.x acceptance criterion and say whether the code actually meets it. Cite file:line.                                                                                                                                                                                             | `/code-review-and-quality`                                                                                               |
| 2        | **Engineering** — `CLAUDE.md` compliance, no `any`, Zod only at trust boundaries, server/client boundaries correct, no module-scope client construction, no premature abstraction, no dead code.                                                                                                                        | `/typescript-best-practices` `/nextjs-app-router-patterns` `/haider-engineering-defaults` `/vercel-react-best-practices` |
| 3        | **Design taste** — design-system fidelity and anti-slop. Does every new screen reuse the existing framework? Any `dvh`/`vh` inside the phone shell, raw hex, icon library, monospace, decorative gradient, `backdrop-blur`, tap target under 44px, body measure over 66ch, block capitals?                              | `/haider-design-taste` `/design-taste-frontend` `/haider-ui-components` `/web-design-guidelines`                         |
| 4        | **Silent-fallback hunter** — Locked D9. Find every `catch` that swallows, every default that masks a missing value, every place a failure renders as an empty state instead of an error, every bit of mock data that could pass for live. Pay special attention to the drug lookup's four states and to `PORTICO_MODE`. | `/haider-engineering-defaults` `/code-review-and-quality`                                                                |

**Tell each reviewer to report everything it finds and let you filter.** A reviewer instructed to be conservative or to report only serious issues will report less. You do the triage afterwards.

Then fix what is real, and tell me what you dismissed and why.

## UI — reuse the framework, do not reinvent it

There is already a working design system. Extend it; do not restyle it.

- **Fonts stay exactly as they are.** Hanken Grotesk for display and body, Newsreader italic held as the editorial accent. Do not add a font.
- **Colours stay exactly as they are.** Use the semantic tokens from the `@theme` block in `app/globals.css`: `bg-surface`, `surface-raised`, `surface-sunken`, `text-ink`, `ink-muted`, `ink-faint`, `border-rule`, `text-accent`, `bg-lavender`, `bg-mist`, and the status colours. **Never a raw hex in a component** — the orb gradient is the one sanctioned exception and it is Track B's.
- **Shapes stay:** `rounded-tactile` (12px) for buttons/tags/chips, `rounded-card`/`rounded-bubble` (16px) for cards and bubbles, `rounded-pill` for capsules. Structure comes from 1px hairline `rule` borders and `shadow-card`.
- **Motion stays restrained:** 120–200ms ease-out, opacity and small translate only.
- **What you may change is layout** — the new screens (`/plan`, `/upload`) need their own composition, and that is expected. Same vibe, same palette, new arrangement.
- **Read the existing components before writing new ones.** `components/voice/*` and `components/language-picker.tsx` show the house style. `components/icons.tsx` is where icons live — add to it, never install a library.
- **`text-ink-faint` is 2.74:1 and fails AA.** Decorative glyphs only, never text.

## How to work

- Commit frequently, conventional commits, per `/haider-commit-conventions`.
- Run `pnpm typecheck && pnpm lint && pnpm format:check` before each commit. All three pass right now — keep them passing.
- Deliver what the plan asks, at the scope it intends. Make routine judgment calls yourself. If a task looks wrong, say so in a sentence and continue as written rather than quietly redesigning it.
- **If you are genuinely blocked — a decision the plan does not cover, a dependency that does not work — stop and ask me.** Do not invent a workaround. Guessing here produces exactly the silent fallbacks this project bans.
- Keep progress updates short: one line before you start something substantial, a line when you find something important or change direction, and lead with the outcome when you finish.
- When you report completion, say what actually runs and what does not. If a checkpoint is not met, say which and why.

## Definition of done for Track A

`/plan` renders a real Redis-backed timeline from the Whitfield seed. A letter uploads (camera or file) and extracts into a valid `ExtractedBundle`. `make eval` is green across all five corpus letters. Drug context resolves with all four states handled visibly. Red flags render with their source trace. `pnpm typecheck && pnpm lint && pnpm format:check` pass. Phase 2 reviewers have run and their real findings are fixed.
