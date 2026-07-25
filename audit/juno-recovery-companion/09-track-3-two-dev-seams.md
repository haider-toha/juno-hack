# 09 — Track 3: the two-dev operating model and its seams

**Date:** 2026-07-25 · **Status:** planning/audit only. No feature code written.
No edits to `tasks/plan.md` or `tasks/todo.md` — every change is proposed as
quoted text in §Proposed patches for a later phase to apply.

**No secret value appears in this file.**

---

## Scope

Two developers, one repo, ~24 hours. Phase 1 (infra + the Portico ElevenLabs
agent) is complete and is not re-planned here — see
`06-phase-1-readiness.md`. What follows designs the operating model for
everything after it: a short shared **Phase 0**, then **Track A**
(ingestion → timeline → drug data) and **Track B** (voice → escalation →
family → i18n) in parallel, rejoining at three checkpoints.

**What this file produces, and what it does not.**

| In scope                                                     | Out of scope                                          |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| Phase 0 exit criteria, verifiable and assigned               | Re-planning Phase 1, or re-provisioning anything      |
| Per-file ownership for every path named in the plan and spec | Writing the schema, the routes, or any component      |
| Forbidden-file lists per track                               | Choosing the clinical scenario (blocked on the medic) |
| The `lib/plan/schema.ts` change protocol                     | Resolving the FR ear-test (needs human ears)          |
| The `/api/log` contract and its two trust models             | Deciding Blob `public` vs `private` (human call)      |
| Checkpoint gates, pass/fail semantics, branch discipline     | Applying patches to `tasks/*`                         |
| Every D9 "helpful fallback" temptation, with its alternative |                                                       |
| Design/taste ownership and a grep-checkable rule set         |                                                       |

**Sources read in full or in the cited part:** `CLAUDE.md`, `tasks/plan.md`,
`tasks/todo.md`, `plan/spec.md`, `00-locked-decisions.md`,
`05-track-5-codebase-audit.md` §§Proposed structure / Server-Client boundary /
Risks, `06-phase-1-readiness.md`, `01-track-1-clinical-schema.md` §Zod-4 sketch,
`02-track-2-elevenlabs-feasibility.md` §tool definitions,
`04-track-4-i18n-and-accessibility.md` §§design vocabulary / contrast / merged
anti-slop checklist, plus the live repo tree, `README.md`,
`.github/workflows/ci.yml`, `Makefile`, `package.json`, `.prettierrc`,
`lib/env.ts`, `app/globals.css`, `app/(phone)/layout.tsx`,
`components/voice/voice-session.tsx`, `components/icons.tsx`,
`components/language-picker.tsx`, `app/not-found.tsx`.

---

## Two-dev operating model

### 0. The three rules the whole model rests on

1. **One file, one hand.** Every path in the build has exactly one owner. A
   file with two owners is a merge conflict with a schedule.
2. **Contracts are frozen before the fork, not negotiated after it.** Anything
   both tracks import is written in Phase 0, on `main`, by both people at one
   screen. There are exactly three such things: `lib/plan/schema.ts`,
   `lib/store/log.ts`, `lib/store/redis.ts` + `lib/env.ts`.
3. **A checkpoint that cannot fail is not a checkpoint.** Each of the four has
   a named verifier, a runnable command or a physical action, and a written
   consequence for "fail".

---

### 1. Phase 0 — exit checklist and who types what

Phase 0 as written in `tasks/plan.md` mixes one already-done infra item
(Task 0.1) with five code items, and does not say how two people share it.
Task 0.1 is **done** — `06-phase-1-readiness.md` §2 records
`agent_0201kyd61dnjey7bkz56hpyhs3f1` created, all five D8 overrides enabled,
`client_events` corrected, and live EN + FR sessions proven over signed URLs.
Three residual items from that pass are human decisions, not Phase 0 work
(§Checkpoint 1 below picks them up).

Two additional items belong in Phase 0 and are in `tasks/todo.md` as bullets
with no numbered task behind them: **installing the three packages**, and
**creating `lib/store/log.ts`**. Both are proposed as patches (P1, P2).

#### The split

Phase 0 has one genuinely shared artefact and five independent ones. Pair on
the first; run the rest in parallel on disjoint files, on `main`, in one
sitting.

| Order | Item                                                           | Who                    | Files                                                            | Why this assignment                                                                                            |
| ----- | -------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1     | `make format` — repo-wide prettier write, **alone, first**     | Either, one commit     | whatever is currently unformatted                                | It rewrites the whole repo. Run before anyone opens an editor or it conflicts with everything.                 |
| 2     | **Task 0.0 (new)** — `pnpm add @upstash/redis @vercel/blob ai` | Either, one commit     | `package.json`, `pnpm-lock.yaml`                                 | Lockfile conflicts are the worst class. One install, on `main`, before the fork.                               |
| 3     | **Task 0.2** — `lib/plan/schema.ts`                            | **Both, one keyboard** | `lib/plan/schema.ts`                                             | The contract. Dev A types; Dev B reads the JSONC example from `01 §The commented JSON example` field by field. |
| 4     | **Task 0.7 (new)** — `lib/store/log.ts` + `LogEntry`           | **Both, one keyboard** | `lib/store/log.ts`                                               | The second contract; it is the `/api/log` seam. See §4.                                                        |
| 5     | **Task 0.3** — lazy Redis client + three `xxxEnv()` functions  | Dev A                  | `lib/store/redis.ts`, `lib/env.ts`                               | A owns the store layer thereafter.                                                                             |
| 6     | **Task 0.8 (new)** — settle the `ink-faint` contrast failure   | Dev A                  | `app/globals.css` `@theme`                                       | Currently scheduled twice (A11 **and** B13). Decide once, in the frozen block, before the fork.                |
| 7     | **Task 0.4** — CI: add `typecheck` + `lint` jobs               | Dev B                  | `.github/workflows/ci.yml`                                       | Disjoint from A's files.                                                                                       |
| 8     | **Task 0.5** — dynamic `<html lang>`                           | Dev B                  | `app/layout.tsx`                                                 | Root layout goes async; B owns i18n.                                                                           |
| 9     | **Task 0.6** — correct the override-failure docs               | Dev B                  | `README.md`, `components/voice/voice-session.tsx` (comment only) | Touches a Track B file. A must not touch it even in Phase 0.                                                   |

Items 5–9 run concurrently; 1–4 are strictly serial.

#### Exit checklist — every line verifiable

Run on `main`, by both, before either branch exists.

**Toolchain**

- [ ] `pnpm install --frozen-lockfile` exits 0; `@upstash/redis`, `@vercel/blob`
      and `ai` appear in `package.json` **and** `pnpm-lock.yaml`, both committed.
- [ ] `pnpm typecheck && pnpm lint && pnpm format:check` — all three exit 0.
- [ ] A pull request into `main` shows **three** green checks, not one.

**Contracts**

- [ ] `lib/plan/schema.ts` exports the value `ExtractedBundle`, the type
      `ExtractedBundle`, and `ExtractedBundleFromModel` (documents minus
      `blobUrl` / `blobPathname`).
- [ ] The JSONC example from `01 §The commented JSON example`, typed into a
      scratch file, parses with `ExtractedBundle.parse()`.
- [ ] `lib/store/log.ts` exports `LogEntry` (value + type), `readLog`,
      `appendLog`, and the two request-body schemas in §4.
- [ ] Both devs can state, without looking, the ten top-level keys of
      `ExtractedBundle` and the seven fields of `LogEntry`. This is the actual
      exit criterion; the rest is bookkeeping.

**Fail-loud boundaries (D9)**

- [ ] `rg -n "new Redis|Redis\.fromEnv" lib/` → matches only inside a function
      body, never at module scope.
- [ ] `rg -n "process\.env" app lib components --glob '!lib/env.ts'` → no hits.
- [ ] `lib/env.ts` exports `serverEnv`, `llmEnv`, `blobEnv`, `redisEnv` as four
      separate functions, and the module-scope `env` object gained **no**
      non-`NEXT_PUBLIC_` key.
- [ ] `make dev` + `curl -s -o /dev/null -w '%{http_code}' localhost:3000/`
      → `200`, on both machines, with real env pulled.

**Docs and locale**

- [ ] `<html lang>` follows the locale cookie; with `fr` set, view-source shows
      `lang="fr"`.
- [ ] `README.md` and the comment at `voice-session.tsx:25-27` now say the
      session is **refused** and surfaces via `onError` — not "silently
      ignored", and not "throws from `startSession()`". See §Grounding note G1.

**Process**

- [ ] Redis key prefix is `portico:` everywhere; `rg -n "juno:" lib app` → no
      hits (D10).
- [ ] Branch names agreed: `track-a/<task>-<slug>`, `track-b/<task>-<slug>`.
- [ ] Both machines report the same `git log --oneline -1` SHA on `main`.

**Fail = nobody branches.** Not "branch and fix on the way". The entire value
of Phase 0 is a common base.

---

### 2. File ownership map

`A` = Track A only · `B` = Track B only · `S-F` = shared, **frozen** after
Checkpoint 0 (protocol required to change) · `S-A` = shared, **append-only**
(add at the end, never edit or reorder another track's lines).

#### `lib/`

| Path                                                     | Owner   | Note                                                                   |
| -------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `lib/plan/schema.ts`                                     | **S-F** | Pen: Dev A. Veto: Dev B. Protocol in §3.                               |
| `lib/store/log.ts`                                       | **S-F** | Pen: Dev A. Veto: Dev B. The `/api/log` contract lives here (§4).      |
| `lib/store/redis.ts`                                     | **S-F** | Written once in Phase 0. No reason to change; if it must, announce.    |
| `lib/env.ts`                                             | **S-A** | Append a new `xxxEnv()`; never edit `env` or another track's function. |
| `lib/plan/samples/demo-plan.ts`                          | A       | A1. Throwaway; replaced by the medic's bundle.                         |
| `lib/store/plan.ts`, `lib/store/patient.ts`              | A       | A2.                                                                    |
| `lib/timeline/schedule.ts`                               | A       | A3. Pure — must import nothing server-only (runs in both runtimes).    |
| `lib/extraction/extract.ts`                              | A       | A6. `server-only`.                                                     |
| `lib/drugs/lookup.ts`                                    | A       | A7. `server-only`.                                                     |
| `lib/i18n/locales.ts`, `dictionary.ts`, `en.ts`, `fr.ts` | B       | B1.                                                                    |
| `lib/check-in-prompt.ts`                                 | B       | B3.                                                                    |
| `lib/escalation/rules.ts`                                | B       | B5. Pure, same import rule as `schedule.ts`.                           |

#### `app/`

| Path                                                           | Owner    | Note                                                                                       |
| -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `app/layout.tsx`                                               | **S-F**  | Phase 0 (0.5) only. Frozen after.                                                          |
| `app/globals.css` — `@theme` block                             | **S-F**  | Frozen after Phase 0 Task 0.8. `05` is explicit: no new tokens needed.                     |
| `app/globals.css` — `@layer` blocks                            | B        | B13 adds the `prefers-reduced-motion` block. Only addition anyone makes.                   |
| `app/(phone)/layout.tsx`                                       | **NONE** | `05 §Proposed structure`: "UNCHANGED — no provider needed". Do not touch.                  |
| `app/(phone)/page.tsx` (home)                                  | B        | **Contested today.** See Hole H4 and patch P4 — B owns the file, A supplies a component.   |
| `app/(phone)/error.tsx`                                        | B        | New; currently unowned (Hole H8). B, because it is `"use client"` chrome around the frame. |
| `app/(phone)/plan/page.tsx`, `app/(phone)/upload/page.tsx`     | A        | A4, A5.                                                                                    |
| `app/(phone)/check-in/page.tsx`, `app/(phone)/family/page.tsx` | B        | B3, B8.                                                                                    |
| `app/api/seed/route.ts`                                        | A        | A1.                                                                                        |
| `app/api/blob/upload/route.ts`                                 | A        | A5.                                                                                        |
| `app/api/extract/route.ts`                                     | A        | A6.                                                                                        |
| `app/api/drug-info/route.ts`                                   | A        | A7. Keeps the plan-scope 404 guard.                                                        |
| `app/api/log/route.ts`                                         | B        | B4a — browser caller. See §4.                                                              |
| `app/api/agent/log-step/route.ts`                              | B        | B4b — ElevenLabs caller. See §4.                                                           |
| `app/api/agent/escalate/route.ts`                              | B        | B4b.                                                                                       |
| `app/api/locale/route.ts`                                      | B        | B2. See Hole H6 — route handler, not a server action.                                      |
| `app/api/eleven/signed-url/route.ts`                           | B        | Marked "untouched" in the spec, but Option 2 of `06 §4` needs a `locale` param. B owns it. |
| `app/not-found.tsx`                                            | B        | Outside `(phone)`; carries the S17 `uppercase tracking-[0.18em]` violation nobody owns.    |

#### `components/`

| Path                                                                                                     | Owner   | Note                                                                                |
| -------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `components/icons.tsx`                                                                                   | **S-A** | Append new glyphs at EOF, one per commit hunk. Never reorder, never edit another's. |
| `components/back-button.tsx`                                                                             | **S-F** | Reused as-is on new screens.                                                        |
| `components/voice/**` (all five files)                                                                   | B       | **The contention point.** Sub-protocol below.                                       |
| `components/language-picker.tsx`                                                                         | B       | B2.                                                                                 |
| `components/family/escalation-card.tsx`, `refresh-poller.tsx`                                            | B       | B8, B9.                                                                             |
| `components/plan/timeline.tsx`, `day-section.tsx`, `task-row.tsx`, `red-flag-card.tsx`, `task-check.tsx` | A       | A4, A9, A10.                                                                        |
| `components/upload/upload-panel.tsx`, `extracted-preview.tsx`                                            | A       | A5.                                                                                 |
| `components/plan/due-today.tsx` (new, patch P4)                                                          | A       | A's contribution to the home screen; B imports it.                                  |

#### Repo-level

| Path                                 | Owner    | Note                                                                                            |
| ------------------------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `package.json`, `pnpm-lock.yaml`     | **S-F**  | All installs in Phase 0. A post-fork dependency requires an announcement, both stop, both pull. |
| `pnpm-workspace.yaml`                | **NONE** | `minimumReleaseAgeExclude` entries — installs fail without them (CLAUDE.md).                    |
| `.github/workflows/ci.yml`           | **S-F**  | Phase 0 (0.4) only.                                                                             |
| `Makefile`                           | **S-A**  | B14 appends `seed`. Append at EOF plus the `.PHONY` line.                                       |
| `README.md`                          | **S-F**  | Phase 0 (0.6), then frozen until after Checkpoint 3.                                            |
| `.env`, `.env.local`, `.env.example` | **S-A**  | Adding a var = announce in the shared channel. Never print a value.                             |
| `tasks/plan.md`, `tasks/todo.md`     | **S-A**  | Tick only your own boxes. One commit per checkpoint. Never reflow another's lines.              |
| `audit/**`, `plan/**`                | **S-F**  | Historical record. Append a new numbered file; do not rewrite an existing one.                  |

#### Not a file, but the highest-risk shared resource

| Resource                                                 | Owner                                               | Note                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ElevenLabs agent `agent_0201kyd61dnjey7bkz56hpyhs3f1`    | **B, single hand**                                  | No version control, no merge, no diff. Two people editing it silently overwrite each other. |
| Upstash Redis instance (single, shared, `portico:` keys) | **Both, but `make seed` is destructive**            | Announce before reseeding. See §3.                                                          |
| Vercel project env + deployment aliases                  | B for the tool-webhook alias; A for Blob/AI Gateway | B4's stable alias must be decided once and never re-pointed.                                |
| Vercel Blob store, AI Gateway credits                    | A                                                   | A5, A6.                                                                                     |

#### Forbidden files

**Track A must never touch:**

```
components/voice/**              (voice-session, orb, transcript, composer, suggested-questions)
components/language-picker.tsx
components/family/**
lib/check-in-prompt.ts
lib/i18n/**
lib/escalation/rules.ts
app/(phone)/check-in/page.tsx
app/(phone)/family/page.tsx
app/(phone)/page.tsx             (home — supply a component, do not edit the page)
app/(phone)/error.tsx
app/api/log/route.ts
app/api/agent/**
app/api/locale/route.ts
app/api/eleven/signed-url/route.ts
app/not-found.tsx
app/globals.css @layer blocks
the ElevenLabs dashboard / agent config
```

**Track B must never touch:**

```
components/plan/**
components/upload/**
lib/plan/samples/**
lib/timeline/schedule.ts
lib/extraction/**
lib/drugs/**
lib/store/plan.ts
lib/store/patient.ts
app/(phone)/plan/page.tsx
app/(phone)/upload/page.tsx
app/api/seed/route.ts
app/api/extract/route.ts
app/api/blob/upload/route.ts
app/api/drug-info/route.ts
data/nhs-medicines-seed.json
Vercel Blob store / AI Gateway configuration
```

**Neither may touch, at all:**

```
app/(phone)/layout.tsx           (the frame; 05 says UNCHANGED)
app/globals.css @theme block     (frozen after Phase 0 Task 0.8)
pnpm-workspace.yaml
lib/env.ts's module-scope `env` object   (append a function beside it instead)
```

#### `components/voice/voice-session.tsx` — the sub-protocol

`tasks/plan.md §Risks` already names this as the highest-traffic file: B3.5,
B6, B7, B10 and B12 all land in it, plus Phase 0's Task 0.6 comment fix. It is
**427 lines today**. Track A is forbidden from it entirely, so the residual
risk is Track B colliding with itself across parallel branches.

Three rules keep it manageable:

1. **Strictly serial commits on one branch: 0.6 → B3.5 → B6 → B7 → B12.**
   Never two branches off the same base both touching it. If a task stalls,
   the next one waits — do not "start the other one meanwhile".
2. **B10 does not go in this file.** `tasks/plan.md` leaves it as
   "`voice-session.tsx` (or a new sibling component)". Resolve it now:
   `components/voice/incoming-card.tsx`, a sibling rendered by the home page,
   **not** a third `Phase` variant inside `Session`. Two reasons: it is
   home-screen chrome, not session state; and folding it in couples Track A's
   home-page needs to a file Track A may not open.
3. **B12's answer chips go in `components/voice/suggested-questions.tsx`**,
   which already exists. Only the `overrides.asr.keywords` line and the
   confirm-before-log gate land in `voice-session.tsx`.

With those three, the file's total growth across all of Track B is roughly
+60 lines (one prop, one `useConversationClientTool`, two callbacks, one
overrides field) rather than +250. That keeps it inside the size band the
`code-review-and-quality` skill treats as reviewable, and keeps every PR
touching it under ~100 changed lines.

---

### 3. `lib/plan/schema.ts` — the Schema Freeze Protocol

`plan/spec.md` calls this "the single most important artifact in this build".
It is also the one file that can force a Redis reseed. The protocol has a name
so it can be invoked in one word.

#### The technical fact that shapes the whole protocol

In Zod, `.nullable()` does **not** make a key optional. `z.object({ a:
z.string().nullable() })` rejects `{}` — it permits the _value_ `null`, not the
_absence_ of the key. The schema in `01 §Zod-4 sketch` is `.nullable()`
throughout and deliberately carries **no `.default()` and no `.optional()`**.

Therefore: **every change to `lib/plan/schema.ts` after data exists in Redis is
a reseed.** There is no such thing as a "safe additive field" here. This is
correct behaviour under D9 — a stale bundle fails `ExtractedBundle.parse()`
loudly on the next read rather than surfacing as `undefined` three components
deep — but it means the protocol cannot have a "minor change" tier. It has one
tier, and it is expensive.

#### The protocol

**Frozen at Checkpoint 0.**

1. **Who may change it.** Only **Dev A** types the change, regardless of who
   asked for it. Dev B requests; Dev A edits. One hand on the contract means
   the contract never merge-conflicts. Dev B holds a veto: if B says no, the
   change does not happen and the requester finds another way.
2. **How it is announced.** Before the first keystroke, in the shared channel,
   four facts:
   - the exact field path (`redFlags[].translations.fr`, not "the red flags");
   - the reason, in one sentence, naming the task it unblocks;
   - the new `schemaVersion` literal;
   - "reseed required" — which it always is.
     Both devs acknowledge before the edit begins. No acknowledgement, no edit.
3. **What the other dev does, in order.**
   - Stop. Commit or stash whatever is in flight — do not keep typing against
     the old shape.
   - Wait for the schema PR to land on `main`.
   - `git fetch && git rebase origin/main` onto it.
   - `pnpm typecheck` — this is where fixture and consumer drift surfaces.
   - `curl -X POST localhost:3000/api/seed` — reseed.
   - Load `/plan` and `/check-in` once. Confirm both still render.
   - **Timebox: 10 minutes.** If the far side is not green in 10 minutes, the
     schema commit is reverted, not debugged. The change goes back into the
     queue for the next natural pause.
4. **`schemaVersion` is the version handle.** The audit sketch has
   `z.literal("juno-extract/1")`, which collides with D10. Phase 0 lands it as
   `"portico-extract/1"`; each subsequent change bumps `/2`, `/3`. Because it
   is a `z.literal`, a stale Redis value fails with a legible message naming
   the version — a D9-compliant failure, not a mystery.
5. **After Checkpoint 1: sealed.** `plan/spec.md §Boundaries` already lists a
   post-fork schema change under "Ask first"; this tightens it. After CP1 a
   change additionally requires the human's explicit go-ahead **and** a re-run
   of any real extraction already sitting in Redis (the seed is cheap; a real
   photographed-letter extraction is not).
   **The standing instruction after CP1 is: prefer the non-schema workaround.**
   Concretely — anything derived, presentational, or single-track goes in its
   own Redis key (`portico:drug-info:{id}`, `portico:escalation:{id}`), never
   inside the bundle. The bundle holds only what the model extracted plus the
   storage identity merged in after parse.
6. **The same protocol governs `lib/store/log.ts`.** It is the second contract
   (§4) and it has the same two-consumer shape. It is cheaper to change — the
   log is regenerated by the demo itself, not reseeded — but the announcement
   and the acknowledgement are identical.

#### What is explicitly _not_ a schema change

So nobody invokes the protocol needlessly: adding a **post-parse invariant**
(the three plain `if` statements in `01 §Zod-4 sketch`), adding a comment,
renaming a local variable, or adding a **derived helper** in
`lib/timeline/schedule.ts`. None of those alter the persisted shape.

---

### 4. The `/api/log` seam

Task A10 (`components/plan/task-check.tsx`, Track A, Phase 3) depends on Task
B4's route (Track B, Phase 2). `tasks/plan.md` marks this "coordinate here,
it's the seam between tracks" and stops. That is the gap this section closes.

#### The finding that changes the design

`/api/log` has **two callers with two different trust models**, and the plan
specifies one route:

| Caller                     | Origin                                        | Auth                                                                                         | Trust                                          |
| -------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `task-check.tsx` (A10)     | The user's own browser, same-origin `fetch`   | None — it is the app calling itself                                                          | The `stepId` comes from a server-rendered plan |
| ElevenLabs `log_step` (B4) | ElevenLabs' backend, over the public internet | `secret__`-prefixed header variable; `patient_id` / `check_in_id` bound as dynamic variables | Everything else in the body is model-generated |

A single route resolves this one of two bad ways: require the secret header
always (A10 breaks, and Track A "helpfully" hardcodes the secret into a client
component — a catastrophe), or accept anything (an unauthenticated public write
endpoint). The sources also disagree on the path:
`02 §log_step` says `POST /api/agent/log-step`; `tasks/plan.md` B4 and
`plan/spec.md §Project Structure` say `/api/log`.

**Resolution: two routes, one store function.** This is not duplication — the
`code-review-and-quality` rule against near-duplicate helpers is about the
_logic_, and the logic is shared in `appendLog()`. What differs is the trust
boundary, and two trust boundaries want two routes.

#### The contract — defined in Phase 0, by both, in `lib/store/log.ts`

```ts
// lib/store/log.ts — the second shared contract. Written in Phase 0 alongside
// the schema, by both devs, before either track forks. Frozen thereafter.

export const LogSource = z.enum(["voice", "tap"]);

export const LogEntry = z.object({
  stepId: z.string().min(1), // Medication.id | Instruction.id | Appointment.id
  stepKind: z.enum(["medication", "instruction", "appointment"]),
  done: z.boolean(),
  at: z.iso.datetime(), // server-set, never client-supplied
  source: LogSource, // server-set from which route received it
  patientWords: z.string().nullable(), // voice only; verbatim, never paraphrased
  checkInId: z.string().nullable(), // voice only; the ElevenLabs dynamic variable
});
export type LogEntry = z.infer<typeof LogEntry>;

// What crosses each wire. `at` and `source` are omitted deliberately: a caller
// must not be able to backdate an entry or claim it came from the voice agent.
export const TapLogRequest = LogEntry.pick({
  stepId: true,
  stepKind: true,
  done: true,
});
export const AgentLogRequest = LogEntry.pick({
  stepId: true,
  stepKind: true,
  done: true,
  patientWords: true,
}).extend({ patientId: z.string().min(1), checkInId: z.string().min(1) });

export const LogResponse = z.object({
  day: z.iso.date(), // "YYYY-MM-DD" — the key the entry landed in
  entries: z.array(LogEntry), // the whole day, after the write
});
```

#### The two routes

| Route                             | Owner | Method | Body              | Auth                                | Sets                                            | Errors                                                                        |
| --------------------------------- | ----- | ------ | ----------------- | ----------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `app/api/log/route.ts`            | B4a   | POST   | `TapLogRequest`   | Same-origin only, no header         | `source: "tap"`, `at: now`, `patientId: "demo"` | 422 bad body · 404 `stepId` not in the stored plan                            |
| `app/api/agent/log-step/route.ts` | B4b   | POST   | `AgentLogRequest` | `secret__` header variable required | `source: "voice"`, `at: now`                    | 401 missing/wrong secret · 422 bad body · 404 `stepId` not in the stored plan |

Both return `200 { day, entries }` on success. Both call the same
`appendLog(patientId, entry)`.

**Three properties that matter and are easy to lose:**

- **`source` and `at` are server-set on both routes.** A caller that can claim
  `source: "voice"` can fake the demo's hero beat.
- **The 404 scope guard is the same guard `/api/drug-info` has** (A7): the
  `stepId` must resolve to an id in the patient's stored `ExtractedBundle`.
  Without it, a hallucinated id from the model writes a phantom entry that then
  renders on `/plan` as a tick against nothing.
- **The response returns the whole day.** That is what lets `task-check.tsx`
  reconcile its optimistic tick without a second read, and lets the voice
  tool's handler return a short confirmation string to the agent.

#### Who defines it, and when — so A10 is never blocked

1. **Phase 0, both devs:** `lib/store/log.ts` lands with `LogEntry`,
   `TapLogRequest`, `AgentLogRequest`, `LogResponse`, `readLog`, `appendLog`.
   From this moment neither dev can invent a conflicting shape — the types
   would not compile.
2. **Phase 2, Track B, first task of the phase:** split B4 into **B4a**
   (`app/api/log/route.ts` — browser caller; needs no deployed URL and no agent
   config, so it is ~20 minutes) and **B4b** (`/api/agent/log-step`,
   `/api/agent/escalate`, plus the ElevenLabs tool registration against the
   stable deployed alias). B4a first.
3. **Phase 3, Track A:** A10 builds against a route that has existed since
   early Phase 2. If for any reason B4a has not landed, **A10 waits** — it does
   not stub, mock, or invent. A10 is a Phase 3 task and B4a is early Phase 2;
   the ordering has ~6 hours of slack.

`lib/store/log.ts` is also what unblocks **A4** (`/plan` is specified as
`Promise.all([readPlan(), readLog(today)])`, and `readLog` currently exists in
no task at all — see Hole H2), **B5** (`assess(bundle, logs, today)`) and **B8**
(`/family`).

---

### 5. Join checkpoints

Each checkpoint runs on `main`, after both tracks have merged. Verification is
**cross-track**: Dev A verifies Track B's criteria and vice versa. Self-review
at 3am is not review.

#### Checkpoint 0 — before the fork

- **When:** end of Phase 0, ~1h in.
- **Verified by:** both, together, at one machine.
- **Gate:** the full checklist in §1.
- **Fail means:** nobody branches. Fix on `main`. There is no version of this
  where the two devs fork off different bases and reconcile later.

#### Checkpoint 1 — the contract is live, and the FR gate

- **When:** ~4–5h in.
- **Verified by:** cross-track, plus **the human, with headphones**.

| #   | Criterion                                                                                                                                                                  | Verifier                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | `/plan` renders the seeded timeline from `portico:plan:demo`; day headings are computed, and `rg -n "timeline" lib/plan/schema.ts` finds nothing stored                    | Dev B checks Dev A           |
| 2   | `/check-in` starts a session whose system prompt contains a string that exists **only** in `demo-plan.ts` — proves the plan reached the agent, not just that a call opened | Dev A checks Dev B           |
| 3   | One English session, ear-tested                                                                                                                                            | Human                        |
| 4   | **One French session, ear-tested against the `06 §8` clip pack.** This settles residual risk R1                                                                            | **Human — this is the gate** |
| 5   | Agent config readback: `tts.model_id` still `eleven_flash_v2`, `language_presets.fr.overrides.tts.model_id` still `eleven_flash_v2_5`                                      | Dev B, one `curl`            |
| 6   | Human confirms LLM `gemini-2.5-flash` (`06` R3) and voice `EXAVITQu4vr4xnSDxMaL` (`06` R4)                                                                                 | Human                        |
| 7   | `pnpm typecheck && pnpm lint && pnpm format:check` green on `main`                                                                                                         | Either                       |

- **Fail on #4 means:** take **Option 2 from `06 §4` immediately** — two agents,
  `Portico EN` and `Portico FR`, each with its model pinned at its own base
  config, and a `locale` param on `/api/eleven/signed-url`. Budget ~40 minutes.
  It is pre-authorised: Dev B does not wait for a discussion, because `06 §8`
  already wrote the decision rule. What is **not** authorised, under D9, is
  shipping French UI with an English-model voice, or "trying another model".
- **Fail on anything else means:** the schema seals regardless (so neither dev
  is blocked), and the failing track fixes forward before starting Phase 2.

#### Checkpoint 2 — the loop is real

- **When:** ~10–12h in.
- **Verified by:** cross-track, on **two physical devices**.

| #   | Criterion                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | A real photographed letter → `ExtractedBundle` in Redis → `/plan` timeline → NHS drug context on the anticoagulant |
| 2   | A bad extraction returns **422 with a plain sentence**, not a 500 and not a partial write                          |
| 3   | A voice call logs adherence via `/api/agent/log-step` against the **deployed alias**, not localhost                |
| 4   | The tick appears in the browser via `onAgentToolRequest` / `onAgentToolResponse` — no second client tool           |
| 5   | A second miss on an `escalationClass: "high_stakes"` med shows on `/family` **on a different device**, within 5s   |
| 6   | `force-dynamic` proven, not assumed: change a value with a `curl` to Upstash, refresh, see it                      |
| 7   | `/api/drug-info` 404s a drug not in the stored plan                                                                |

- **Fail means: cut, do not extend.** The cut list, in the order things get
  dropped, so nobody negotiates it at hour 14:
  1. A8 (committed NHS seed JSON) — stretch already, drop first.
  2. Tier 3 email escalation (Resend) — already Tier 3 in D5.
  3. `vitest` for the two pure modules — Open Question 4.
  4. B10 incoming-check-in card — the demo can start from the home screen.
  5. A9's source-trace ("tap to see where it says that") — the red-flag card
     survives without it.
     Everything above line 5 is spine and is not cut; if spine is failing at
     CP2, that is a human escalation, not a scope decision.

#### Checkpoint 3 — final

- **When:** before sleep / before the demo.
- **Verified by:** the full 12 numbered criteria in `plan/spec.md §Success
Criteria`, read aloud from the list, each ticked by **the other dev**.
- **Gate:** the demo arc runs **twice, back to back**, with only `make seed`
  between runs. No manual Redis surgery, no dev-tools intervention, no "just
  refresh that one".
- **Fail means:** the second run is the real signal. A demo that works once is
  a demo that will not work on stage.

#### Merge and branch discipline

Grounded in what the repo already documents (`README.md §Making changes`,
`.github/workflows/ci.yml`): `main` is protected, takes no direct pushes, PRs
are required, CI runs `format:check` on PRs into `main` and on `main` itself,
and **no review approval is required to merge**.

| Rule                                                                                                                   | Why                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Branch names `track-a/<task>-<slug>`, `track-b/<task>-<slug>` — e.g. `track-b/b4a-log-route`                           | The task id is the unit of work; the prefix makes a stray cross-track file obvious in the PR title alone           |
| **One PR per task**, not per phase                                                                                     | `code-review-and-quality`: ~100 changed lines is reviewable, ~1000 is not. Task-sized PRs land at 100–300          |
| **Rebase onto `main` before opening the PR.** Never merge `main` into a branch                                         | A 24-hour repo with two people and a lattice of merge commits is unreadable at 4am                                 |
| **Merge at every checkpoint, minimum** — plus immediately after any task another track imports                         | `schema.ts`, `log.ts`, `/api/log`, `lib/store/*`. A finished contract sitting on a branch is a blocked teammate    |
| **Cross-track review is required for any PR touching an `S-F` or `S-A` file.** Everything else: self-merge on green CI | No approval is required by the repo, so this is the one review gate worth imposing. It is also the taste gate (§7) |
| `make format` before every push                                                                                        | CI enforces it and the repo has been red on it before                                                              |
| Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`) — matches the existing log                            | `haider-commit-conventions`; also makes the demo-morning `git log` legible                                         |
| **Never force-push a branch the other dev has pulled. Nobody force-pushes `main`**                                     | Recovering a stomped branch costs more than the rebase it saved                                                    |
| If CI is red on `main`, that is a **stop-the-line**: both devs fix it before continuing                                | `main` is the base both tracks rebase onto                                                                         |

---

### 6. Every "helpful fallback" risk, and its D9-compliant alternative

This is the single most likely way the plan gets violated in practice: not
malice, not laziness — a well-meaning developer at hour 16 making the screen
stop being broken. Each row below is a place where the natural instinct is a
`try/catch`, a default, a stub, or an English fallthrough.

`00-locked-decisions.md` D9 also names what is **allowed**: typed `null` for
absence, discriminated unions, showcase "not yet" panels, and HTTP errors with
plain-language messages. Each is a named state in the flow map, not a quiet
substitute for the happy path. Every "alternative" below is one of those four.

#### Track B — voice, i18n, escalation

| #   | The temptation                                                                                       | Where                          | D9-compliant alternative                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Catch the override refusal and retry `startSession` without overrides, "so the demo still talks"     | `voice-session.tsx:212-234`    | Leave it. The refusal is a WS `1008` close **after** `conversation_initiation_metadata`, so the existing `try/catch` does not see it; it arrives via `onError`, which already paints the inline `role="alert"` banner. Add nothing. A silent retry means the agent answers with **no plan data at all** — `05 §Risks 2` calls this the worst possible demo failure.  |
| F2  | `getDictionary(locale)` returns `en` for the six showcase locales                                    | `lib/i18n/dictionary.ts` (B1)  | **`05 §lib/i18n` recommends exactly this and it directly violates D9.2.** Type it `getDictionary(locale: RealLocale): Dictionary` where `RealLocale = "en" \| "fr"`. Showcase locales never reach the dictionary — they are handled one level up by rendering the in-language "not yet" panel from a separate `SHOWCASE_NOTICE` map. Illegal state, unrepresentable. |
| F3  | `fr.ts` typed `Partial<Dictionary>`, or `as Dictionary`, because one French string is missing at 3am | `lib/i18n/fr.ts` (B1)          | `satisfies Dictionary`, always. A missing key is a compile error. Either write the French string or do not ship the screen — never ship it half-translated (D9.2, D7).                                                                                                                                                                                               |
| F4  | `overrides.agent.language: locale ?? "en"`                                                           | `voice-session.tsx` (B3.5)     | `locale` is a **required** prop typed `"en" \| "fr"`. No default, no `??`, no optional prop. The page always knows the locale before `startSession` (D8: fixed for the call).                                                                                                                                                                                        |
| F5  | French voice sounds wrong, so ship French UI with the English voice "for now"                        | B11                            | Stop. Escalate to the human. Take Option 2 (two agents) from `06 §4`. D9.3 rejects this exact downgrade by name.                                                                                                                                                                                                                                                     |
| F6  | Machine-translate the French persona / `firstMessage` because the authored copy is not ready         | `lib/check-in-prompt.ts` (B3)  | Banned by D7 and `spec §Never do`. Author it, or run the demo in English only — never a machine-translated clinical prompt.                                                                                                                                                                                                                                          |
| F7  | `assess()` gains a `default:` case returning `{ kind: "none" }`                                      | `lib/escalation/rules.ts` (B5) | Exhaustive `switch`, no `default`, plus `const _exhaustive: never = kind` so a new variant is a compile error. A swallowed escalation is a swallowed hero beat.                                                                                                                                                                                                      |
| F8  | The agent decides the escalation threshold because the rule is "basically the same"                  | agent prompt / B4              | The rule lives in `lib/escalation/rules.ts`, deterministic and auditable. The agent reports an event. `02 §log_step` and `spec §Never do` both say so.                                                                                                                                                                                                               |
| F9  | `show_red_flag` catches its own error and returns silently                                           | `voice-session.tsx` (B6)       | **This one is the sanctioned catch, and it is easy to over-apply.** Catch, return a plain string **to the agent**, _and_ set the visible error state. Catch-and-return is fine; catch-and-_ignore_ is not. Without the catch, an uncaught client-tool error paints a red connection banner over the transcript on the projector.                                     |
| F10 | Add `onUnhandledClientToolCall` "to be safe"                                                         | `voice-session.tsx` (B6)       | Do not, unless a result is sent manually — it hangs the agent. Already in the plan; repeated because it looks like defensive hygiene.                                                                                                                                                                                                                                |
| F11 | The composer quietly substitutes for broken ASR                                                      | B12                            | The composer stays an **explicit** typed path the user chooses. It is never auto-focused or auto-shown because ASR failed. Named branch, not a fallback.                                                                                                                                                                                                             |
| F12 | Point the ElevenLabs tool webhook at a preview URL "just for this test", then forget                 | B4b                            | One stable deployed alias, decided before writing tool code, never re-pointed. `tasks/plan.md` already names the localhost trap; the re-point is the second half of it.                                                                                                                                                                                              |

#### Track A — ingestion, timeline, drugs

| #   | The temptation                                                                                               | Where                                    | D9-compliant alternative                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F13 | `readPlan()` returns the demo fixture when Redis is empty, "so `/plan` is never blank"                       | `lib/store/plan.ts` (A2)                 | Returns `ExtractedBundle \| null`. `null` renders a named empty state — "No plan yet. Upload your letter." — linking to `/upload`. The seed is written **only** by an explicit `POST /api/seed`.                                                                                                  |
| F14 | `ExtractedBundle.parse()` → `safeParse()` with `?? DEFAULT_BUNDLE`                                           | `lib/store/plan.ts` (A2)                 | `.parse()` on every Redis read; it throws. `.safeParse()` appears in exactly one place: `/api/extract`, where a 422 is the named outcome.                                                                                                                                                         |
| F15 | `redisEnv()` / `blobEnv()` / `llmEnv()` wrapped in `try/catch` returning a stub client or an in-memory `Map` | `lib/env.ts`, `lib/store/redis.ts` (0.3) | They throw. D9.4. The fix for a missing key is `vercel env pull .env.local --yes`, not code. Document that in the Phase 0 checklist so nobody "fixes" it in the module.                                                                                                                           |
| F16 | `env` object gains `.default("")` so `pnpm build` stops failing in CI                                        | `lib/env.ts` (0.3, 0.4)                  | Keep `.min(1)`. Do **not** add `pnpm build` to CI — `spec §Commands` says so explicitly, with the verified `lib/env.ts:12` failure behind it. Three CI jobs, none of which is `build`.                                                                                                            |
| F17 | Drug lookup misses on NHS.uk, so return a generic side-effect blurb                                          | `lib/drugs/lookup.ts` (A7)               | Typed `null`, meaning "not on the NHS.uk A–Z". The UI renders that as a named state with no invented content. Named in D9.5 by hand.                                                                                                                                                              |
| F18 | The A8 committed seed JSON silently stands in for a live NHS hit                                             | `lib/drugs/lookup.ts` (A8)               | The result carries its provenance: `{ source: "redis" \| "seed" \| "network", ... }`, and the attribution line in the UI reflects it. Already half-stated in the plan; make it a field, not a comment.                                                                                            |
| F19 | `/api/extract` catches a parse failure and writes a partially-filled bundle                                  | `app/api/extract/route.ts` (A6)          | 422 with a plain sentence; **no partial write**. The upload panel shows the sentence. A half-written bundle in Redis is worse than none — it renders as a plausible wrong plan.                                                                                                                   |
| F20 | Skip the three post-parse invariants because "Zod passed"                                                    | `lib/extraction/extract.ts` (A6)         | Keep all three (`01 §Zod-4 sketch`). Note the deliberate asymmetry: invariants 1 and 2 throw; invariant 3 (quote-is-a-substring) produces an `unresolved` entry with `reason: "ambiguous"` — a **named** branch, so one bad quote never discards a whole bundle. Do not "harden" it into a throw. |
| F21 | Hardcode the AI Gateway model id from memory                                                                 | `lib/extraction/extract.ts` (A6)         | Fetch `https://ai-gateway.vercel.sh/v1/models`, then pin the chosen string in one named constant with the date it was checked beside it.                                                                                                                                                          |
| F22 | `task-check.tsx` swallows a failed `POST /api/log` and leaves the optimistic tick on screen                  | `components/plan/task-check.tsx` (A10)   | On non-2xx: revert the tick and show the route's plain sentence inline. An optimistic UI that never reconciles is a silent fallback wearing a nice coat.                                                                                                                                          |
| F23 | Stub or mock `/api/log` because B4a has not landed                                                           | A10                                      | A10 waits. The contract exists from Phase 0 and B4a lands in early Phase 2, six hours before A10 starts. If it genuinely is not there, that is a checkpoint conversation, not a mock.                                                                                                             |
| F24 | Drop `/api/drug-info`'s plan-scope guard to make a demo lookup work                                          | `app/api/drug-info/route.ts` (A7)        | Keep the guard; add the drug to the seed plan instead. The guard is what keeps the feature inside the scope line (`spec §Never do`: no open drug Q&A).                                                                                                                                            |
| F25 | Choose Blob `public` quietly because `private` is more work                                                  | A5                                       | `spec §Ask first`. Ask the human, record the answer in `tasks/todo.md`. The home screen already promises "we don't share your health information" — the promise is on the same device as the choice.                                                                                              |

#### Both tracks

| #   | The temptation                                                                   | D9-compliant alternative                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F26 | Import `lib/store/*` from a client component "just to read the plan"             | Mark every `lib/store/*`, `lib/extraction/*`, `lib/drugs/*` module `server-only` in Phase 0. Without it, nothing stops the import and the Redis token ships to the browser.      |
| F27 | Add a server secret to the `env` object because "it's only used on the server"   | The parse at `lib/env.ts:12` is module-scope and `voice-session.tsx:14` imports it. Verified: the value must exist in the browser. New secret → new `xxxEnv()` function.         |
| F28 | Re-run the ElevenLabs "Additional Languages" flow, moving the TTS pin            | One hand (Dev B) on the agent config. A `curl` readback of both model pins is part of **every** checkpoint. `06 §4` shows the pin surviving one PATCH — that is not a guarantee. |
| F29 | Loosen a lint rule, a `tsconfig` flag, or `prettier` config to make a check pass | CLAUDE.md: "Don't loosen a check to make it pass. Fix the code, or change the rule deliberately with a reason." A config change is an `S-F` file change: announce it.            |

---

### 7. Design and taste ownership

Both devs build UI, so both can invent conflicting UI. The resolution is not a
design czar — it is a frozen token block, a merged rule set, and a named
tiebreaker.

#### Ownership

| Concern                          | Owner                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/globals.css` `@theme` block | **Frozen** after Phase 0 Task 0.8. `05 §Proposed structure` is explicit: no new tokens are needed; `success`/`warning`/`error` already exist unused.                                                    |
| The one sanctioned token change  | The `ink-faint` contrast failure (2.74:1, fails AA everywhere). Settled in **Phase 0**, by Dev A, once — currently scheduled twice (A11 and B13).                                                       |
| `components/icons.tsx`           | Append-only, both tracks. New glyphs at EOF, in the existing register: 16px grid, `strokeWidth` 1.4–1.75, `currentColor`, `aria-hidden`, round caps and joins.                                          |
| Motion + reduced-motion          | Dev B (B13) — the one `@layer` addition to `globals.css`.                                                                                                                                               |
| Design-fidelity review           | **The cross-track reviewer**, on every PR touching UI. Output is the table format below, one row per violated rule, most severe first.                                                                  |
| Tiebreaker                       | `CLAUDE.md` wins over every skill. Where CLAUDE.md is silent, `04 §Merged anti-slop checklist` (S1–S30) decides. Where both are silent, follow the existing repo code. A genuine tie goes to the human. |

**Two register decisions to state out loud, so nobody "corrects" them later:**

- **This is not the Linear/Attio compact register.** `haider-design-taste`'s
  non-negotiables (13px UI, 36px rows, 32px controls, radii 4–8px, Inter/Geist,
  borders-never-shadows on in-flow cards, light **and** dark from day one) are
  **overridden** by CLAUDE.md and by the audience. The applicable row of that
  skill's own density table is "focused moment": generous whitespace, ≥44px
  controls, 16px+ body. The skill licenses this override; `04 §S25` records it.
- **Light theme only, as a deliberate cut.** No dark tokens exist in `@theme`.
  Do not attempt dark mode inside 24 hours. Do say it is a decision (`04 §S27`).

#### Shared taste rules — checkable in review, not vibes

Every row is a rule from `CLAUDE.md` or `04 §Merged anti-slop checklist` paired
with something a reviewer can actually run or measure. Run the `rg` set before
opening any UI PR.

| #   | Rule                                                                                                                                                                          | Check                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | **No `dvh`/`vh` inside the phone shell.** Fill with `flex min-h-0 flex-1 flex-col`                                                                                            | `rg -n 'dvh\|[^a-z]vh\b' 'app/(phone)' components` → hits only in `app/(phone)/layout.tsx`. The single most dangerous skill conflict (S10)                                                                                                                                                                                                   |
| T2  | **No raw hex in components.** Semantic tokens only                                                                                                                            | `rg -n '#[0-9a-fA-F]{3,8}' app components --glob '!globals.css'` → today it also hits `language-picker.tsx`'s eight national-flag SVGs; **B2 deletes those**, after which the only permitted hit is `orb.tsx`'s gradient (sanctioned)                                                                                                        |
| T3  | **No icon library.** Extend `components/icons.tsx`                                                                                                                            | `rg -n 'lucide\|heroicons\|phosphor\|react-icons\|@radix-ui/react-icons' package.json` → no hits                                                                                                                                                                                                                                             |
| T4  | **No monospace anywhere.** Tabular figures come from `.tnum`                                                                                                                  | `rg -n 'font-mono\|monospace' app components` → no hits                                                                                                                                                                                                                                                                                      |
| T5  | **Three radii only:** `rounded-tactile` 12, `rounded-card`/`rounded-bubble` 16, `rounded-pill`                                                                                | `rg -n 'rounded-(xl\|2xl\|3xl\|sm\|md\|lg\|\[)' app components` → one permitted hit, `lg:rounded-[2.5rem]` on the iPhone bezel in `app/(phone)/layout.tsx` (sanctioned device chrome). Anything else is a violation                                                                                                                          |
| T6  | **Motion 120–200ms, ease-out, opacity and small translate only**                                                                                                              | `rg -n 'duration-\d{3,}' app components` → nothing above 200. `rg -n 'transition-all\|ease-in\b' app components` → no hits. Also `rg -n 'transition[" ]' app components` → bare `transition` is a broad property list; narrow it to what actually changes (S14 — `page.tsx:41` and `language-picker.tsx:265` are the two existing offenders) |
| T7  | **Tap targets ≥44px**                                                                                                                                                         | Every `<button>` / link-as-button carries `min-h-11` or `size-11`+. Visual check at 390px width                                                                                                                                                                                                                                              |
| T8  | **Body measure ≤66ch**                                                                                                                                                        | `rg -n 'max-w-\[\d+ch\]' app components` → every value ≤66                                                                                                                                                                                                                                                                                   |
| T9  | **1px hairline `rule` borders do the structural work**                                                                                                                        | `rg -n 'border-[2-9]' app components` → no hits. Borders use the default `rule` colour set in `@layer base`                                                                                                                                                                                                                                  |
| T10 | **One shadow token**                                                                                                                                                          | `rg -n 'shadow-' app components` → only `shadow-card` (and Tailwind's `shadow-none`)                                                                                                                                                                                                                                                         |
| T11 | **Fonts: Hanken Grotesk; Newsreader italic held for editorial accents**                                                                                                       | `rg -n 'Inter\|Geist\|Roboto\|Open Sans\|Satoshi\|General Sans\|Clash Display\|Bricolage\|Fraunces' app components` → no hits                                                                                                                                                                                                                |
| T12 | **No glassmorphism, no decorative gradient**                                                                                                                                  | `rg -n 'backdrop-blur\|bg-gradient' app components` → only `orb.tsx`                                                                                                                                                                                                                                                                         |
| T13 | **Sentence case; no uppercase, no letter-spacing utilities on text**                                                                                                          | `rg -n 'uppercase\|tracking-\[' app components` → today one hit, `app/not-found.tsx:15` (`uppercase tracking-[0.18em]` on "404"). Target after Dev B's fix: no hits                                                                                                                                                                          |
| T14 | **Copy:** no em-dash (U+2014), no exclamation mark, no "please"/"sorry"/"oops"/"simply"/"just", no ampersand in prose, **no negative contractions** ("do not", never "don't") | `rg -n '—\|!\|\bplease\b\|\bsorry\b\|\boops\b\|don.t\|can.t\|won.t\| & ' app components lib` on user-facing strings. The contraction rule is a safety rule (GDS: negatives are misread as their opposite)                                                                                                                                    |
| T15 | **No emoji anywhere**                                                                                                                                                         | `rg -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' app components lib` → no hits                                                                                                                                                                                                                                                               |
| T16 | **`text-ink-faint` never carries text** (2.74:1, fails AA and fails 3:1)                                                                                                      | `rg -n 'text-ink-faint' app components` → decorative glyphs only. Resolved centrally by Phase 0 Task 0.8                                                                                                                                                                                                                                     |
| T17 | **State is never carried by colour alone**                                                                                                                                    | Every `success`/`warning`/`error` tint is accompanied by a word. WCAG 1.4.1. `success` 3.31 and `warning` 3.23 are icon-tint only, and `warning` fails even 3:1 on `mist`                                                                                                                                                                    |
| T18 | **`"use client"` only at leaves**                                                                                                                                             | `rg -ln '"use client"' app components` → matches only the enumerated leaf list (`voice-session`, `language-picker`, `task-check`, `refresh-poller`, `upload-panel`, `incoming-card`, `error.tsx`). **Never** a `page.tsx` or `layout.tsx`                                                                                                    |
| T19 | **Long content handles itself** — `min-w-0` on flex children, no `truncate` on button or nav labels                                                                           | Visual check with French strings at 320px. French expands; never size a control to its English string                                                                                                                                                                                                                                        |
| T20 | **`Intl.*` for every date, time, number and list.** 12-hour times only (`5pm`), numerals for all numbers, natural frequencies over percentages                                | `rg -n 'toLocale\|Intl\.' app components lib` present; no hand-built date strings; no `17:00`                                                                                                                                                                                                                                                |
| T21 | **Reading age 9.** Sentences ≤20 words (EN) / ≤25 (FR); paragraphs ≤3 sentences; active voice; plain word before medical term                                                 | Read every new string aloud. Expand TTO/BD/OD/PRN into words                                                                                                                                                                                                                                                                                 |
| T22 | **Error messages name the problem and the fix**                                                                                                                               | No "Something went wrong". Two existing strings in `voice-session.tsx` are already flagged for rewrite (`04 §A.16`)                                                                                                                                                                                                                          |
| T23 | **Person split:** UI chrome is second person, Portico's own speech is first person                                                                                            | "Your recovery plan" (chrome) vs "I'll talk you through it" (Portico). Keep it consistent; do not let it blur                                                                                                                                                                                                                                |
| T24 | **No three-feature-cards-with-icons grid; no fake screenshots; no decorative SVG illustration**                                                                               | Visual review. Does not extend to `icons.tsx` or the `lg`-only iPhone bezel, both sanctioned                                                                                                                                                                                                                                                 |

**Review output format** (from `haider-design-taste`, and it is the only format
a taste review produces — a table, never a list):

| Violation | Fix | Rule |
| --------- | --- | ---- |

Ordered most severe first: structural (tokens, depth, density, boundaries)
before motion before copy. The Rule column cites `T1`–`T24` or `S1`–`S30` so
the fix is traceable, and so the argument is with the checklist rather than
with the other developer at 4am.

---

## Holes found

Severity: 🔴 blocker (causes a collision, blocks a task, or violates a locked
decision) · 🟡 should-fix (duplicated effort or an avoidable conflict) ·
🟢 nice-to-have.

### 🔴 Blockers

**H1 — `/api/log` has two callers with two trust models, and one route.**
`task-check.tsx` (A10) calls it same-origin from the browser with no secret;
the ElevenLabs `log_step` server tool (B4) calls it from ElevenLabs' backend
with a `secret__` header and dynamic variables. The sources also disagree on
the path — `02 §log_step` says `/api/agent/log-step`, `tasks/plan.md` B4 and
`spec §Project Structure` say `/api/log`. A single route resolves this either
by requiring the header always (A10 breaks, and the natural "fix" is to put the
secret in a client component) or by accepting anything (an open write
endpoint). → Patch **P3**.

**H2 — `lib/store/log.ts` has no task and no owner, and three tasks depend on
it.** `spec §Project Structure` lists `store/log.ts`; **no task in
`tasks/plan.md` creates it**. Task A4 (Phase 1) is specified as
`Promise.all([readPlan(), readLog(today)])` — `readLog` does not exist. A10,
B5 and B8 all need it too, and its `LogEntry` type _is_ the `/api/log`
contract. → Patch **P2** (create it in Phase 0, both devs).

**H3 — `05 §lib/i18n` instructs the exact English fallthrough D9 forbids.**
Verbatim: "`dictionary.ts` exports `getDictionary(locale)`, a `switch`
returning `en` for the six showcase locales." D9.2 and `spec §Never do` ban
"dictionary keys that fall through to English". Task B1 cites both documents.
Whoever writes B1 will follow one of them, and the audit is the more concrete
instruction. → Patch **P5** (type it `RealLocale`; showcase handled before the
dictionary).

**H4 — the home screen is contested and unassigned.** `app/(phone)/page.tsx`
is wanted by Track A (a "due today" summary and a link to `/upload`, per
`05 §Proposed structure`) and by Track B (the B10 incoming-check-in card, and
`04 §Six required fixes` requires the language control top-right on **every**
screen). `tasks/plan.md §Risks` names `voice-session.tsx` as the contention
point and does not mention the home page at all. This is the second-highest
traffic file in the build. → Patch **P4**.

**H5 — the FR ear-test is the project's top residual risk and is not a gate.**
`06 §7` R1: whether `overrides.agent.language: "fr"` actually activates the
`fr` language preset (and therefore `eleven_flash_v2_5`) is **not
machine-verifiable** — `realtime_config_snapshots` comes back empty.
`tasks/plan.md` Checkpoint 1 says "a second ear-test in fr" without saying what
fail means, without naming Option 2 (two agents) as the pre-authorised remedy,
and without budgeting the work Option 2 implies: a second agent plus a `locale`
param on `/api/eleven/signed-url` — a file both the spec and `05` currently
mark "= untouched", so its ownership is unrecorded. → Patch **P6**.

### 🟡 Should-fix

**H6 — server action vs route handler for the locale write, unresolved.**
`tasks/plan.md` B2 says `app/actions/set-locale.ts` (a server action);
`spec §Project Structure` and `05` say `app/api/locale/route.ts`. `05` argues
explicitly for "zero new Next primitives in the whole plan" and adds: if the
team wants server actions, "adopt them wholesale for all four writes, not one
at a time." The plan picks a server action for exactly one write. → Pick the
route handler, for consistency with the existing `fetchSignedUrl` idiom.

**H7 — `schemaVersion` is `"juno-extract/1"` and has no bump protocol.**
Collides with D10 (`portico:`-everything) and wastes the best available
mechanism for making a stale Redis value fail legibly. → Patch **P7**.

**H8 — `app/(phone)/error.tsx` is in the spec's structure and `05`'s
recommendation, and no task owns it.** Without it, a schema mismatch or a Redis
failure renders Next's default error page **outside** the phone frame — on
stage. It is a ~15-line file.

**H9 — the `ink-faint` contrast fix is scheduled twice, in a frozen file.**
A11 ("fix contrast, `ink-faint` is 2.74:1") and B13 both land in Phase 3, and
both would edit `app/globals.css`. Two devs, two different fixes, one `@theme`
block, at hour 20. → Patch **P8** (settle it in Phase 0).

**H10 — Phase 0 Task 0.4 runs `make format` mid-phase.** It is a repo-wide
prettier write. If one dev runs it while the other has edits in flight, every
touched file conflicts. → Run it first, alone, on `main`, as its own commit,
before anyone opens an editor (§1, order item 1).

**H11 — B10's location is left as an open choice in the highest-contention
file.** "`components/voice/voice-session.tsx` (or a new sibling component)".
An unresolved choice in that file is a coin-flip on a merge conflict, and it
couples home-screen work to a file Track A may not open. → Force the sibling
(§2, voice sub-protocol rule 2).

**H12 — the three packages are not installed and no numbered task installs
them.** `tasks/todo.md` has the bullet; `tasks/plan.md` has no task.
`pnpm-lock.yaml` conflicts are the worst kind to resolve, and
`pnpm-workspace.yaml` carries `minimumReleaseAgeExclude` entries that make a
naive re-install fail. → Patch **P1**.

**H13 — `components/icons.tsx` is edited by both tracks with no rule.** The
spec assigns `IconUpload, IconPill, IconAlert, IconCheck` (and `05` adds
`IconCamera, IconCalendar`) without saying who adds which; Track B needs a
check and an alert glyph for `/family` too. → Append-only at EOF, one glyph per
commit hunk, never reorder.

**H14 — `export const dynamic = "force-dynamic"` is specified for `/family`
but not `/plan`.** `05` says both. `tasks/plan.md` A4 does not mention it, and
`/plan` is the page most likely to serve a cached render after a `router.refresh()`
from `task-check.tsx`.

**H15 — "fail" has no defined consequence at Checkpoint 2.** With ~12 hours
left and two tired people, an undefined cut list becomes a negotiation. → The
ordered cut list in §5.

**H16 — two devs, one ElevenLabs agent, no single-hand rule.** The agent config
is the one shared artefact with no version control, no diff and no merge.
A concurrent edit silently wins. → Track B, single hand; readback at every
checkpoint.

**H17 — `lib/env.ts` is touched in Phase 0 and then owned by nobody.** Each
`xxxEnv()` belongs to a different track's feature (`llmEnv`/`blobEnv` → A,
`serverEnv` → B, `redisEnv` → both). → All four land in Phase 0; the file is
append-only afterwards.

### 🟢 Nice-to-have

**H18 — `app/not-found.tsx` violates S17** (`uppercase tracking-[0.18em]` on
"404") and sits outside `(phone)`, so neither A11 nor B13's accessibility pass
covers it. Two-line fix, unowned. Assigned to Dev B in §2.

**H19 — `SUGGESTED_QUESTIONS` presumes surgery.** "Is this normal after
surgery?" is flagged in B3 as generic clinical Q&A, but it is _also_ a
condition-agnostic violation: the medic has not chosen surgical vs medical and
has pushed back on assuming surgery. Fixing it for one reason should fix it for
both.

**H20 — no `vitest` decision, and it is a Phase 0 decision if it is anything.**
The two pure modules are split across tracks (`schedule.ts` → A,
`rules.ts` → B), and adding a runner touches `package.json` plus a config file —
shared, frozen files. Add it in Phase 0 or not at all. Open Question 4.

**H21 — no `.github/CODEOWNERS`.** A ~20-line file would make the §2 ownership
map visible in every PR and auto-request the cross-track reviewer. It does not
enforce anything without branch-protection review rules, but it makes an
accidental cross-track edit obvious in the PR UI rather than in a conflict.

**H22 — the medic's scenario is still pending and lands in two tracks at
once.** `plan/medic-brief.md` is sent; the reply changes `demo-plan.ts`
(Track A) and the authored FR persona copy (Track B) simultaneously. Not a
seam defect, but it is the one late input that hits both tracks in the same
hour. Keep the seed fixture condition-agnostic so the change is additive.

---

## Proposed patches (not yet applied)

Quoted text for a later phase to apply to `tasks/plan.md` and `tasks/todo.md`.
Nothing below has been written to those files.

### P1 — new Task 0.0, before everything (fixes H12)

Insert as the first item under `### Phase 0`, before Task 0.1:

> - [ ] **Task 0.0: Install the three packages, on `main`, before anyone
>       branches.** `pnpm add @upstash/redis @vercel/blob ai`. One commit,
>       `package.json` + `pnpm-lock.yaml` together. Do not delete
>       `pnpm-workspace.yaml`'s `minimumReleaseAgeExclude` entries — installs fail
>       without them.
>   - Files: `package.json`, `pnpm-lock.yaml`
>   - Verify: `pnpm install --frozen-lockfile` exits 0 on both machines.
>   - **Any dependency added after Checkpoint 0 requires an announcement, and
>     both devs stop and pull.** Lockfile conflicts are the most expensive kind.

### P2 — new Task 0.7, the second contract (fixes H2, and half of H1)

Insert after Task 0.2:

> - [ ] **Task 0.7: `lib/store/log.ts` — the second shared contract.** Both
>       coders, one keyboard, immediately after the schema. Exports `LogEntry`
>       (Zod + type), `TapLogRequest`, `AgentLogRequest`, `LogResponse`,
>       `readLog(patientId, day)` and `appendLog(patientId, entry)`. `at` and
>       `source` are **server-set** on write and omitted from both request schemas —
>       a caller must not be able to backdate an entry or claim it came from the
>       voice agent. Day-scoped key: `portico:log:{id}:{yyyy-mm-dd}`.
>   - Files: `lib/store/log.ts`
>   - Why Phase 0: A4 reads it in Phase 1, A10 writes through it in Phase 3,
>     B4/B5/B8 all depend on it, and its shape **is** the `/api/log` contract.
>     Written after the fork, two people invent two shapes.
>   - Verify: `pnpm typecheck`; `readLog` on an empty key returns `[]`, not
>     `null` — an empty day is a real state, not an absent one.

### P3 — split B4 into B4a and B4b (fixes H1)

Replace Task B4 with:

> - [ ] **Task B4a: `app/api/log/route.ts` — the browser caller.** POST,
>       same-origin, no auth header. Body is `TapLogRequest` (Task 0.7). The route
>       sets `source: "tap"`, `at: now`, `patientId: "demo"`. Returns
>       `200 { day, entries }`. 422 on a bad body; **404 if `stepId` is not an id in
>       the patient's stored plan** — the same scope guard as `/api/drug-info`.
>   - Files: `app/api/log/route.ts`
>   - **Do this first in Phase 2.** It needs no deployed URL and no agent
>     config, and it is the seam Track A's Task A10 depends on.
> - [ ] **Task B4b: `app/api/agent/log-step/route.ts` +
>       `app/api/agent/escalate/route.ts` — the ElevenLabs callers.** Separate
>       routes from B4a because the trust model is different, not because the logic
>       is: both call the same `appendLog()`. Authenticate with the `secret__`-prefixed
>       header variable — **401 if absent or wrong**. `patient_id` and `check_in_id`
>       arrive as **dynamic variables**, never model-filled. Body is
>       `AgentLogRequest`; the route sets `source: "voice"` and `at`. Register both
>       tools on the agent with `method: "POST"` explicitly (the default is GET).
>   - Files: `app/api/agent/log-step/route.ts`, `app/api/agent/escalate/route.ts`
>   - **The localhost trap:** ElevenLabs' backend calls these URLs and cannot
>     reach a dev machine. Decide one stable deployed alias before writing tool
>     code and never re-point it.
>   - The escalation _threshold_ lives in `lib/escalation/rules.ts` (B5), never
>     in the tool or the prompt. The agent reports an event.

And amend Task A10's dependency line:

> - Dependencies: Task 0.7 (the `LogEntry` contract — exists from Phase 0) and
>   Task **B4a** (the route — lands early in Phase 2). If B4a has not landed,
>   **A10 waits**. Do not stub, mock, or invent a shape [Locked D9].

### P4 — assign the home screen (fixes H4)

Add to `### Track A → Phase 3` (or wherever the "due today" work is scheduled),
and add a corresponding note to B10:

> **Home-screen ownership.** `app/(phone)/page.tsx` is **Track B's file** — it
> hosts the incoming check-in card (B10) and the top-right language control
> (B2). Track A contributes to it **only** as a component:
> `components/plan/due-today.tsx`, a Server Component taking
> `{ bundle, log, today }` and rendering the day's summary. Track B imports it
> in one line. Neither dev edits the other's side.

And amend B10:

> - Files: `components/voice/incoming-card.tsx` (**new sibling — not
>   `voice-session.tsx`**), imported by `app/(phone)/page.tsx`. Putting it
>   inside `Session` would add a third `Phase` variant to the
>   highest-contention file and couple home-screen work to a file Track A may
>   not open.

### P5 — close the i18n fallthrough (fixes H3)

Amend Task B1:

> - `dictionary.ts` exports `getDictionary(locale: RealLocale): Dictionary`
>   where `type RealLocale = "en" | "fr"`. **A showcase locale never reaches
>   this function** — it is handled one level up by rendering the in-language
>   "not yet" panel from a separate `SHOWCASE_NOTICE` map. Note that
>   `05 §lib/i18n` recommends "a `switch` returning `en` for the six showcase
>   locales"; that is superseded by Locked D9.2 — no English fallthrough, ever.
>   Typing the parameter as `RealLocale` makes the illegal state unrepresentable
>   rather than merely discouraged.

### P6 — make the FR ear-test a gate with a pre-authorised remedy (fixes H5)

Replace the French clause of Checkpoint 1:

> **Checkpoint 1 — the French gate.** Owner: Dev B, verified by the human with
> headphones, against the four-clip pack in `06 §8`.
>
> - **Pass:** the live FR session sounds like `FR-on-eleven_flash_v2_5.mp3`.
> - **Fail:** it sounds like `FR-on-eleven_flash_v2.mp3`. Then, **without
>   waiting for a discussion**, take Option 2 from `06 §4`: two agents —
>   `Portico EN` (`en` + `eleven_flash_v2`) and `Portico FR`
>   (`fr` + `eleven_flash_v2_5`), each pinned at its own base config — plus a
>   `locale` param on `/api/eleven/signed-url` to pick the id. Budget ~40 min.
>   `/api/eleven/signed-url/route.ts` becomes a **Track B** file at that point;
>   it is marked "untouched" elsewhere in the plan.
> - **Never:** ship French UI with an English-model voice, or "try another
>   model" [Locked D9.3].
> - Also at this checkpoint: readback `tts.model_id` and
>   `language_presets.fr.overrides.tts.model_id` by `curl`; confirm the LLM
>   (`06` R3) and the voice (`06` R4) with the human.

### P7 — `schemaVersion` (fixes H7)

Amend Task 0.2:

> - `schemaVersion` is `z.literal("portico-extract/1")` — **not**
>   `"juno-extract/1"` as written in `01 §Zod-4 sketch` [Locked D10]. Every
>   post-Checkpoint-0 schema change bumps it (`/2`, `/3`). Because it is a
>   literal, a stale Redis value then fails with a message naming the version,
>   which is the loud failure D9 wants — not an `undefined` three components
>   deep.

### P8 — settle the contrast fix in Phase 0 (fixes H9)

Insert as Task 0.8:

> - [ ] **Task 0.8: Settle `ink-faint`, once, in the frozen `@theme` block.**
>       `#909db2` measures **2.74:1** on `surface` — it fails WCAG AA and fails even
>       3:1, everywhere it is currently used (composer placeholder,
>       `VoiceStatusLine`, the `Connecting…` line, the picker's "Default" label and
>       empty-search line, chevrons, the home privacy footer). Either demote it to
>       decorative-glyph duty and move every text use to `ink-muted` (8.83:1), or
>       add one darker third ink tier. **Decide here, not in Phase 3** — A11 and B13
>       currently both schedule this fix, in the same file, at the same hour.
>   - Files: `app/globals.css` (`@theme`), plus the call sites
>   - After this task the `@theme` block is **frozen**. No new tokens.
>   - Then amend A11 and B13 to "apply the Task 0.8 decision", not "fix
>     contrast".

### P9 — the operating-model block for `tasks/todo.md`

Append to `## Cross-cutting — do not forget`:

> - [ ] **One file, one hand.** Ownership map:
>       `audit/juno-recovery-companion/09-track-3-two-dev-seams.md §2`. Before
>       editing a file, check whose it is. A cross-track edit is a conflict with
>       a schedule.
> - [ ] **The Schema Freeze Protocol** governs `lib/plan/schema.ts` **and**
>       `lib/store/log.ts` after Checkpoint 0: announce the field path, the
>       reason, the new `schemaVersion` and "reseed required"; both acknowledge;
>       **Dev A types it regardless of who asked**; the other dev rebases,
>       typechecks, reseeds, and confirms `/plan` + `/check-in` render — 10-minute
>       timebox, or the change is reverted. In Zod, `.nullable()` does **not**
>       make a key optional, so **every** schema change is a reseed.
> - [ ] **The ElevenLabs agent has one hand on it (Track B).** No version
>       control, no merge. Readback both model pins at every checkpoint.
> - [ ] **Branch `track-a/*` and `track-b/*`; one PR per task; rebase, never
>       merge, onto `main`; cross-track review required for any shared
>       (`S-F`/`S-A`) file.**
> - [ ] **Taste checklist T1–T24** (§7) runs before any UI PR. Findings go in a
>       table, most severe first, citing the rule.

### P10 — `.github/CODEOWNERS` (fixes H21, optional)

> Create `.github/CODEOWNERS` mirroring §2. It does not enforce anything
> without branch-protection review rules, but it auto-requests the cross-track
> reviewer and makes an accidental cross-track edit visible in the PR UI rather
> than in a merge conflict.

---

## Grounding notes

Where this file corrects or sharpens a source, and why.

**G1 — "throws" is wrong; the session is refused, asynchronously.**
`tasks/plan.md` Task 0.6 says to change the docs to say a disallowed override
"throws". `06 §6` proved otherwise by live test: the WebSocket closes with
`1008` **after** `conversation_initiation_metadata`, so the `try/catch` around
`connect()` at `voice-session.tsx:212-234` never sees it — it surfaces through
`onError` (already wired at `:150`). The Phase 0 exit checklist in §1 uses the
`06` wording. This matters for F1: a dev who is told "it throws" will look in
the wrong place and may add a catch that makes it worse.

**G2 — `.nullable()` is not `.optional()`.** The entire Schema Freeze Protocol
(§3) turns on this. `01 §Zod-4 sketch` is `.nullable()` throughout, with no
`.default()` and no `.optional()`, both deliberately. So every post-fork schema
change invalidates every stored bundle. That is the correct D9 behaviour and it
is why the protocol has one expensive tier rather than a cheap one and a costly
one.

**G3 — `05` and D9 conflict on the i18n dictionary, and D9 wins.** `05
§lib/i18n` item 2 recommends returning `en` for the six showcase locales.
`00-locked-decisions.md` D9.2 and `spec §Never do` ban exactly that. Locked
decisions are supreme by the header of `00-locked-decisions.md` ("Where a
Phase 1 findings file was written under an older assumption, this file wins").
Hole H3 and patch P5.

**G4 — the tool path disagreement is a real fork, not a typo.**
`02 §log_step` specifies `POST /api/agent/log-step`; `tasks/plan.md` B4 and
`spec §Project Structure` specify `/api/log`. §4 keeps both, because there are
genuinely two callers with two trust models. Choosing one path arbitrarily is
how the seam breaks.

**G5 — `haider-design-taste` is overridden here, deliberately and by name.**
Its non-negotiables (13px UI / 36px rows / 32px controls, radii 4–8px,
Inter or Geist, hairline-border-never-shadow on in-flow cards, light **and**
dark from day one, Base UI primitives) conflict with `CLAUDE.md` on six counts.
`CLAUDE.md` is project law and says so; `04 §Merged anti-slop checklist`
S1/S2/S5/S6/S12/S25/S27 records each conflict. §7 restates the overrides
explicitly so that a future agent loading the skill does not "correct" the
design back toward the compact register.

**G6 — `05`'s key-naming table still says `juno:`.** D10 supersedes it:
`portico:plan:{id}`, `portico:patient:{id}`, `portico:log:{id}:{yyyy-mm-dd}`,
`portico:upload:{id}`. The Phase 0 checklist greps for `juno:` to catch it.

**G7 — `.prettierignore` does not exclude `audit/`.** This file is checked by
CI's `format:check`, so it is prettier-formatted. Any later edit must be
followed by `make format`.

**G8 — no test runner exists, so "verification" is commands and eyes.** Every
gate in §5 is either a shell command with an expected exit code, a `curl` with
an expected status, or a physical action on a second device. There is no
"tests pass" line anywhere in this document because there are no tests, and
writing one would be a false gate.

---

## Residual risk

| #   | Risk                                                                                                                                                                                                                     | Severity | Why it survives this design                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RR1 | **The FR preset question (`06` R1) is still unsettled and is not machine-verifiable.** No ownership map fixes it. If it fails, Track B loses ~40 minutes at Checkpoint 1 — and more if it is discovered later than that. | 🔴       | Only human ears settle it. The design's contribution is making it a **named gate with a pre-authorised remedy** (P6) so the loss is bounded and does not compound.                     |
| RR2 | **The medic's scenario lands late and hits both tracks in the same hour** — `demo-plan.ts` (A) and the authored FR persona copy (B).                                                                                     | 🟡       | Mitigated by keeping the seed condition-agnostic so the change is additive. Not eliminated: if it lands after Checkpoint 2, both devs context-switch at the worst time.                |
| RR3 | **`voice-session.tsx` still takes five task-touches from one dev.** The sub-protocol serialises them and moves two out of the file, but a stalled B6 still blocks B7 and B12 by construction.                            | 🟡       | Serial-by-design is the correct trade against merge conflicts in a 427-line file, but it removes Track B's internal parallelism. Accepted deliberately.                                |
| RR4 | **Ownership is enforced by discipline, not by tooling.** `CODEOWNERS` (P10) auto-requests a reviewer; nothing blocks a cross-track commit, because `main` requires no approval.                                          | 🟡       | Adding branch-protection review rules mid-hackathon would slow every merge. The chosen gate — cross-track review only on `S-F`/`S-A` files — is the smallest one that works.           |
| RR5 | **The taste checklist has no CI job.** T1–T24 are `rg` commands a reviewer must actually run.                                                                                                                            | 🟡       | A lint rule per row is half a day's work. The commands are written out so running them is ~60 seconds; that is the realistic ceiling inside the timebox.                               |
| RR6 | **Phase 0 grows from 6 tasks to 9** (P1 Task 0.0, P2 Task 0.7, P8 Task 0.8). Estimated +35–45 min before the fork.                                                                                                       | 🟡       | Deliberate. Each added task is a contract or a frozen decision that otherwise becomes a Phase 3 collision (H2, H9, H12). Paying it at hour 1 is strictly cheaper.                      |
| RR7 | **`/api/log`'s browser route has no auth by design** — it relies on same-origin plus the `stepId`-in-plan 404 guard. With a single hardcoded `patientId: "demo"`, anyone with the deployed URL can write the demo's log. | 🟢       | Correct for a hackathon with one synthetic patient and no auth in scope. Recorded so it is a **known** trade, not an oversight. Do not extend the app past the demo without fixing it. |
| RR8 | **`env.NEXT_PUBLIC_AGENT_ID` is public and the agent's origin allowlist is unset** (`06` R5, `platform_settings.auth.enable_auth` at platform default).                                                                  | 🟢       | Already recorded in `06` as a deliberate human decision. Not a two-dev seam. Do not enable it blind the night before the demo — the empty-allowlist semantics are unverified.          |
| RR9 | **Both devs share one Upstash instance, and `make seed` is destructive.** A reseed during the other dev's manual test silently resets their state.                                                                       | 🟢       | Announce before reseeding. Two Upstash databases would remove it, but they would also remove the cross-device escalation beat's realism, which is the point of the shared store.       |

---

## Skills applied

| Skill                          | Where it was actually used                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/planning-and-task-breakdown` | The dependency-graph reading that surfaced H2 (`readLog` has no task but A4 depends on it) and H12 (packages have no task); the parallelisation rules ("needs coordination: features that share an API contract — define the contract first, then parallelise") that produced the Phase 0 split in §1 and patches P2/P3; task sizing for the B4 → B4a/B4b split.                                                             |
| `/writing-plans`               | The "Interfaces — consumes / produces" discipline behind §4's exact type names and route table; the no-placeholders rule, which is why §4 contains real Zod rather than "define a log shape"; the self-review pass that caught the `/api/log` vs `/api/agent/log-step` path fork (G4) and the `schemaVersion` D10 collision (H7).                                                                                            |
| `/code-review-and-quality`     | The change-sizing table behind "one PR per task" and the `voice-session.tsx` growth budget in §2; the severity-label vocabulary adapted into 🔴/🟡/🟢; the "silent fallback that hides an unclear invariant" presumptive blocker, which is the shape of all 29 rows in §6; "two routes is not duplication when the trust models differ" in §4; the honesty rule behind stating RR7 as a known trade rather than omitting it. |
| `/haider-design-taste`         | The review-output table format in §7 (a table, never a list; most severe first; a Rule column that cites); the emphasis ladder and the "when ambiguous, choose the quieter option" default. **Overridden by `CLAUDE.md` on six counts** — density register, fonts, radii, in-flow shadows, component library, light-and-dark — each named in §7 and G5 so the override is deliberate rather than accidental.                 |
| `/haider-engineering-defaults` | "Validate at the edge, trust nothing crossing a process boundary" → the two-route split and the server-set `at`/`source` fields in §4; "fail closed if a required secret is missing — name which one" → F15, F16, F27; server-components-by-default and `server-only` on secret-holding modules → F26 and the T18 check; "announce deviations" → G1–G8.                                                                      |

Also consulted, not invoked: `00-locked-decisions.md` D1–D10 (supreme over all
of the above where they conflict), and `04 §Merged anti-slop checklist` S1–S30,
which is the pre-existing reconciliation of `CLAUDE.md` against the design
skills and is cited rather than re-derived.
