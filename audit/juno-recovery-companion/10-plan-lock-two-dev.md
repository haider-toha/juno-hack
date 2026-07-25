# 10 — Plan lock: go / no-go for two-dev parallel coding

**Date:** 2026-07-25 · **Scope:** merge the Phase 1 readiness pass (`06`) and
the three hole-finding tracks (`07` Track A, `08` Track B, `09` two-dev seams)
into a locked, build-ready plan; patch `tasks/plan.md` and `tasks/todo.md`;
state go/no-go.

**Skills applied by this pass:** `/writing-plans` (task structure, no
placeholders, self-review against the spec), `/planning-and-task-breakdown`
(dependency graph, task right-sizing, checkpoints with fail semantics),
`/elevenlabs-agents` (agent create/update, overrides, `client_events`,
`language_presets`), `/haider-design-taste` and `/haider-engineering-defaults`
(the shared taste rules and the fail-loud config boundaries now written into
the plan), `/haider-commit-conventions` (commit shape for the Phase 0 landings).
Track-level skill use is recorded in each of `07`/`08`/`09`.

---

## 1. Verdict

## ✅ GO for two-dev parallel coding — after Phase 0, which is now 8 tasks, not 6.

The plan is buildable. Nothing found is fatal. But **three of the additions are
Phase 0 blockers**, and the reason they matter is that each one would otherwise
be discovered _after_ the fork, when it is expensive:

| Must land before the fork         | Why it cannot wait                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Task 0.7 — `lib/store/log.ts`** | A second shared contract with no owner. A4 needs it in Phase 1; A10, B5 and B8 all need it. Invented twice = guaranteed conflict + a reseed. |
| **Task 0.8 — `pnpm add`**         | Task 0.3 imports `@upstash/redis`. Nothing installed it.                                                                                     |
| **Task 0.2 amendments**           | `schemaVersion` and the D7 French slot are both _inside_ the frozen schema. Adding either later invalidates every stored bundle.             |

**One gate can still change the architecture**, and it is deliberately early:
the **C2 French ear-test at Checkpoint 1**. Task B3.6 is written, costed and
pre-authorised as its remedy, so failing it costs about an hour rather than a
redesign. That is the difference between a risk and a blocker.

**No decision D1–D10 is overturned.** One is amended on evidence — **D8's
specific model id**, because the platform refuses it. D8's _intent_ (explicit
pins, no silent drift, no English-voice-under-French-UI) is preserved and is
now enforced in more places than before.

---

## 2. What the four passes found

66 findings total: **16 🔴 blockers, 34 🟡 should-fix, 16 🟢 nice-to-have.**

| Pass | Focus                  | 🔴  | Headline                                                                                                                    |
| ---- | ---------------------- | --- | --------------------------------------------------------------------------------------------------------------------------- |
| `06` | Infra + agent creation | 4   | D8's pin is rejected by the API; a dead voice id; `client_events` would have silently killed the transcript                 |
| `07` | Track A integrity      | 6   | Blob is Private and its consequences were unmapped; `lib/store/log.ts` unowned; A10↔B4 impossible as specified              |
| `08` | Track B integrity      | 6   | B11 would have _caused_ the drift it prevents; `secret__` is not auth; no landing zone for the two-agent contingency        |
| `09` | Two-dev seams          | 4   | `/api/log` has two trust models; an audit file instructs the exact English fallthrough D9 bans; the ear-test was not a gate |

### The five findings that would most likely have cost the demo

1. **The `eleven_flash_v2_5` pin is rejected.** `400 "English Agents must use
turbo or flash v2"`. Following the old wording literally leads an operator
   either to a 400 or to a silent downgrade to `eleven_multilingual_v2` — the
   exact class of failure D8 exists to prevent. Appeared **18 times** across
   `tasks/plan.md`, `tasks/todo.md` and `plan/spec.md`.
2. **`NEXT_PUBLIC_XI_VOICE_ID` pointed at a nonexistent voice.** Marked done in
   the setup table. Sent on every session, so it fails at the first live call —
   on stage, not at build time.
3. **Default `client_events` omitted `agent_chat_response_part`.** The
   audio-paced transcript reveal — which `CLAUDE.md` calls "the whole effect" —
   would have rendered nothing, with no error anywhere.
4. **`secret__` is not request authentication.** `/api/log` and `/api/escalate`
   would have shipped forgeable from devtools.
5. **`lib/store/log.ts` had no owner**, while two tasks in two different tracks
   called `readLog`.

Note the pattern: **four of these five are silent failures.** That is what D9
was written for, and it is why the "no silent fallbacks" law earned its keep on
this pass rather than just being restated.

---

## 3. What changed in `tasks/`

`tasks/plan.md` — added a **§READ FIRST** block (C1–C10) that overrides
anything below it; marked Task 0.1 done with a do-not-redo warning; added
**Tasks 0.7, 0.8** and **B3.6**; rewrote **0.2, 0.6, A5, A6, A7, A9, A10, B1,
B4, B7, B11**; added a **§Two-dev operating model** (Phase 0 ordering, file
ownership table, forbidden files, Schema Freeze Protocol, checkpoints with fail
semantics, and the shared taste rules); replaced the top risk-register row.

`tasks/todo.md` — rewrote **§Setup status** with the five corrections stated up
front; marked the agent done; corrected every stale checklist line; added B3.6.

**Deliberately not changed:** `audit/juno-recovery-companion/0[0-5]-*.md`. They
are the citation trail behind D4/D6/D8 and are cited by line number throughout.
Where one is _wrong_ — `05:628`'s English fallthrough, `03:426`'s bare `null`,
`01:1361`'s `juno-extract/1` — the correction is recorded in the plan **against
the citation**, so the reasoning stays auditable rather than being quietly
rewritten. The same applies to the `juno-*` filenames and the `juno-letters`
Blob store: legacy scaffolding paths, which D10 explicitly permits.

---

## 4. Grounding

Every non-obvious claim was checked against a first-party source, and the
platform was preferred over the docs wherever they disagreed.

**Docs consulted:** ElevenLabs agent create/update API reference, overrides,
language & models (`elevenlabs.io/docs/…`); Vercel Blob and AI Gateway; the
`ai@7.0.37` type definitions.

**Where the docs were wrong or incomplete:**

- The overrides doc **omits `asr.keywords`**; the API accepts and stores it.
  Task B12 is unblocked because the platform was probed, not the doc trusted.
- The create-agent error message says "must use turbo or flash v2", but
  `eleven_multilingual_v2` is accepted. The real rule is "no v2.5 model on an
  English-base agent" — established by a six-cell probe matrix, not by reading.
- `audio_alignment` is widely assumed to be a `client_events` value. It is not;
  the API enumerates the legal set on rejection.

**Live evidence:** 6 infra probes; a 6-config probe matrix for the model rule
(every throwaway agent deleted); 3 live WebSocket sessions proving overrides
apply in EN and FR and that a disallowed override closes `1008`; a Welsh
negative control returning **HTTP 200 with 74KB of audio** on a model with no
Welsh support; and `vercel blob get-store` returning `Access: Private`.

**A correction to this pass's own working:** an attempt to settle the C2 routing
question by comparing audio durations was **inconclusive** and is recorded as
such in `06 §7 R2`. The conversation endpoint resamples to MPEG-2/16kHz, so its
durations are not comparable to direct-TTS renders, and the control run landed
between both references. No conclusion should be drawn from it — which is
exactly why C2 is a human gate rather than a resolved item.

---

## 5. Residual risk

| #      | Risk                                                                                                                           | Severity | Owner / mitigation                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1** | The `fr` language override may not reach `eleven_flash_v2_5`. **Not machine-verifiable.**                                      | 🔴       | **Human ear-test, gated at Checkpoint 1.** Four clips in `06 §8`. Fail → Task B3.6.                                                                    |
| R2     | The medic's clinical bundle has not landed; the scenario and drug are unfixed.                                                 | 🟡       | A1's seed fixture is condition-agnostic and standalone. Confirm apixaban/rivaroxaban — enoxaparin/dalteparin 404 on NHS.uk A–Z.                        |
| R3     | Server tools need a deployed URL; none exists yet.                                                                             | 🟡       | Settle the stable alias in B4 before writing tool code. Same trap hits A5's `onUploadCompleted`.                                                       |
| R4     | `voice-session.tsx` takes 4 sequential tasks in one file.                                                                      | 🟡       | Serial commits 0.6 → B3.5 → B6 → B7 → B12; B10 to a sibling file; B12's chips into `suggested-questions.tsx`.                                          |
| R5     | Agent LLM and voice were chosen by Phase 1, not by the human.                                                                  | 🟢       | Both are one-line changes; options listed in `06 §7`.                                                                                                  |
| R6     | `platform_settings.auth.enable_auth` left at default.                                                                          | 🟡       | A deliberate, stated non-decision — **not** done silently. Do not enable it blind the night before the demo; empty-allowlist semantics are unverified. |
| R7     | Two 🔴 in `08`/`09` (D7's missing Track B task; contested `app/(phone)/page.tsx`) are fixed in the plan but touch both tracks. | 🟡       | Covered by the ownership table and the B1 acceptance criteria.                                                                                         |

---

## 6. Go/no-go checklist — verify before anyone opens an editor

- [x] Infra: Redis, Blob, AI Gateway, `XI_API_KEY`, MCP all probe PASS
- [x] `.env` has a real `NEXT_PUBLIC_AGENT_ID` (no placeholder), plus a **live**
      voice id
- [x] Agent is named **Portico**; zero "Juno" in `app/`, `components/`, `lib/`
- [x] All five D8 Security overrides enabled and verified by readback
- [x] TTS model explicitly pinned per locale; `tts.model_id` not
      client-overridable
- [x] Signed URL proven against the new agent id, in EN and FR
- [x] `tasks/plan.md` + `tasks/todo.md` are Portico / D9 / D10 consistent, with
      no surviving instruction to pin `eleven_flash_v2_5` on the English agent
- [x] No Welsh spike and no English-voice downgrade anywhere on the happy path
- [x] Two-dev split explicit: Phase 0 ordering + exit checklist, ownership
      table, forbidden files, Schema Freeze Protocol, the `/api/log` seam
      resolved into `appendLogEntry()`, shared taste rules
- [x] `audit/juno-recovery-companion/` holds `06`–`10`
- [ ] **`pnpm typecheck && pnpm lint && pnpm format:check` green** — run
      `make format` first; CI is red on six files (C9)
- [ ] **The C2 French ear-test decided** — the only item that can still change
      the architecture

**The first eleven are done. The last two are the human's, and only the last
one is load-bearing.**

---

## 7. Recommended first hour

1. `make format`, alone, then commit. CI goes green.
2. `pnpm add @upstash/redis @vercel/blob ai server-only` (Task 0.8).
3. **Both devs, one keyboard:** Task 0.2 (schema, with the `portico-extract/1`
   rename and the D7 French slot) and Task 0.7 (`lib/store/log.ts`). Do not
   split these — they are the two contracts everything else is typed by.
4. Split 0.3 / 0.4 / 0.5 / 0.6.
5. Checkpoint 0. **Fail = nobody branches.**
6. Play the four clips in `06 §8` and settle C2. Doing it now, rather than at
   Checkpoint 1, converts the project's largest risk into a known quantity
   before a single voice task is written.
