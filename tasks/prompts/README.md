# Execution prompts — two parallel Claude Code instances

Two prompts, one per developer terminal. Copy the whole file contents into a
fresh Claude Code session in this repo.

| File         | Terminal | Owns                                                                                   |
| ------------ | -------- | -------------------------------------------------------------------------------------- |
| `track-a.md` | Dev A    | Phase 0 contracts, then ingestion → extraction → timeline → drug data → `/plan`        |
| `track-b.md` | Dev B    | Phase 0 independents, then voice → tools → escalation → `/family` → i18n → `/operator` |

## Start order matters — read this before pasting

**Start A first, then start B immediately.** They are not blocked on each other
at the beginning:

- **A** opens with the Phase 0 shared contracts (`lib/plan/schema.ts`,
  `lib/store/log.ts`, `lib/store/clock.ts`, `lib/env.ts`, the installs). These
  are the spine everything downstream is typed by, so one hand writes them.
- **B** opens with the Phase 0 items that touch none of that (CI steps,
  `<html lang>`, the override docs) and then B1/B2 — the i18n dictionary and
  language picker, which have no schema dependency. That is roughly an hour of
  genuinely independent work.

When A announces **"PHASE 0 CONTRACTS LANDED"**, B rebases onto `main` and
continues. That handshake is written into both prompts; you just relay the
message.

## Branches and merge order

Each instance starts from a fresh `main`, then works on its own branch:

```bash
git switch main && git pull
git switch -c haider/track-a    # terminal A
git switch -c haider/track-b    # terminal B
```

**Track A merges first — always.** Both tracks build in parallel, but nothing
from B lands on `main` until A is there.

1. **Phase 0 gate.** A opens a PR for the shared contracts (`haider/track-a` →
   `main`) and gets it merged. A announces **"PHASE 0 CONTRACTS LANDED"**. B
   rebases onto the updated `main` and continues with B3 onwards.
2. **Final merge.** When each track is done, it opens a PR to `main` — but **B
   does not open or merge its PR until A's full track PR is already merged.** If
   B finishes first, it stops: push the branch if useful, then wait, rebase onto
   latest `main`, and only then open the PR.

Both prompts tell their instance to commit frequently and never to touch the
other track's files — the ownership table in
`tasks/plan.md §Two-dev operating model` is the authority, and it is restated
inside each prompt.

## What each prompt does

**Phase 1 — build.** The instance reads the plan, works through its tasks, and
delegates to subagents only where a task is genuinely independent and multi-file.
The delegation policy is explicit in the prompt, because the default tendency is
to over-delegate small work.

**Phase 2 — adversarial review.** The instance spawns fresh reviewers with no
knowledge of how the code was written, each with a distinct lens: plan
conformance, engineering principles, design taste, and silent-fallback hunting.
They are told to report everything and let the orchestrator filter — a reviewer
told to "only report serious issues" reports less.

## If something is genuinely blocked

Both prompts grant explicit permission to stop and ask rather than guess. A
blocked task should surface as a question, not as an invented workaround —
that is the whole point of Locked D9.
