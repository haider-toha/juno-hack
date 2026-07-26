# 16 — Demo airtight: consolidated report

**Date:** 2026-07-26 (overnight session)
**Orchestrator:** consolidation of tracks 1–4 plus three follow-up tracks
**Sources:** `12-track-1-demo-flow.md`, `13-track-2-demo-ui.md`,
`14-track-3-adversarial-verify.md`, `15-track-4-todo-reconcile.md`,
`17-deploy-and-tool-wiring.md`

---

## Scope

Make the demo-mode Portico arc airtight enough to film, and prove it with
screenshots and an adversarial pass rather than with claims. Two parallel build
tracks behind a hard file-ownership wall, then two parallel adversarial tracks,
then three follow-up tracks closing what the adversarial pass exposed.

Explicitly **out of scope**, by instruction and still true at the end: the A6
extraction rewire (OpenAI structured outputs / `Output.object`), a green
`make eval`, and B3.6 (two ElevenLabs agents — contingency only, the French
ear-test passed [L1]).

---

## Headline verdict

**The arc is filmable.** Every beat in the video runs end to end in
`PORTICO_MODE=demo` without Redis surgery, and the two claims that carry the
product — that the escalation is computed rather than staged, and that the
agent itself reports the dose — are both now proven rather than asserted.

**No FAKEs were found.** Track 3 attacked the escalation four ways and could not
make it lie. The remaining gaps are named below and none of them is a lie about
what the product does.

**Checkpoint 2 passes for the first time** — all three clauses: a voice call logs
adherence through a server tool, the UI ticks live off the callback path, and a
second miss produces a real, computed escalation on `/family`.

`tasks/todo.md` finished the night at **42/51 ticked**, from 6/51, with zero
over-ticks across three reconciliation passes.

**Two items remain that only a human can close: the French ear-test, and the fact
that no speech has ever been recognised by this build** (see residual risk 2).

---

## Beat table

Consolidated from Track 3's adversarial run, updated where a follow-up track
closed a FAIL. "Verified by" names who produced the evidence, because self-
verification by the agent that wrote the code is corroboration, not proof.

| #   | Beat                                               | Verdict                         | Evidence / verified by                                                                                                                                                               |
| --- | -------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Seed from cold; `clearLog()` total reset           | **PASS**                        | Track 3, from cold. Forward-dated key written, re-seeded, log read back as exactly the two seeded days                                                                               |
| 2   | Home tells the ingest story                        | **PASS** (was FAIL)             | Closed by the clear-letter control — see §Shoot order                                                                                                                                |
| 3   | Upload / scan affordance reaches Blob              | **PASS**                        | Track 3; one control, `image/*,application/pdf` + `capture`                                                                                                                          |
| 4   | Plan: real Redis timeline, tick persists           | **PASS**                        | Track 3, tick + reload                                                                                                                                                               |
| 5   | Incoming check-in flips phone, no reload           | **PASS**                        | Track 3 measured it independently (~4.6s)                                                                                                                                            |
| 6   | Voice prompt carries this patient's plan           | **PASS**                        | Track 3 read the payload off the wire — real ids, doses, red flag, both languages                                                                                                    |
| 6b  | French red flag reaches the agent in French        | **PASS** (was FAIL)             | Found by Track 4, fixed in `check-in-prompt.ts`, verified over the wire in both locales                                                                                              |
| 7   | `/api/log`, `/api/escalate`: 401 / 200 / 422 / 400 | **PASS** (was PASS-with-defect) | Track 3 found non-JSON bodies returned a bare 500; now `400 invalid_arguments`                                                                                                       |
| 7b  | A **real agent** invokes the deployed tools        | **PASS** (was UNTESTED)         | ElevenLabs execution ledger + Vercel runtime logs + app state, three independent confirmations                                                                                       |
| 8   | Family escalation is computed, not painted         | **PASS**                        | Track 3 could not fake it four ways; `alert-kin` exists only in `rules.ts` (produced) and `escalation-card.tsx` (consumed)                                                           |
| 9   | Operator controls write real state only            | **PASS**                        | Track 3; no mode-toggle lie — the panel refuses and explains why on screen                                                                                                           |
| 10  | Demo badge on every on-camera screen               | **PASS**                        | 5/5 patient screens; now localised, so French screens no longer show English chrome                                                                                                  |
| 11  | D9 boundary: live mode refuses demo routes         | **PASS** (7/7)                  | Track 3 on a separate live-mode server. One route (`DELETE /api/demo/plan`) is inferred, not observed — shared guard, first statement, byte-identical to its three proven neighbours |
| 12  | Repo hygiene                                       | **PASS**                        | `typecheck`, `lint`, `format:check` all clean; no `dvh`/`vh` in `(phone)`, no `any`, no `backdrop-blur`, no mono in UI                                                               |
| 13  | **French audio**                                   | **UNTESTED**                    | No French session has been heard. Human-only. See §Only a human can close this                                                                                                       |

### Deliberately not closed

| Item                                                     | Why                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A6 / A6.5 — live extraction, `make eval`                 | Out of scope by instruction. **Also currently unrunnable**: `POST /api/extract` → 500, `ZodError: ANTHROPIC_API_KEY … received undefined` at `lib/env.ts:47`, since commit `fe657f6` moved the provider to Anthropic and no local env file carries that key |
| B12 — ASR keywords, answer chips, confirm-before-logging | Only the typed composer exists                                                                                                                                                                                                                              |
| B14 — stopwatch rehearsal against 60s                    | Harness and runbook exist; nobody has timed a take                                                                                                                                                                                                          |

**This is the one honesty debt worth stating plainly.** D9 rule 3 says every demo
shortcut must have a live counterpart proven to work at least once. Extraction is
the biggest shortcut in the build, and its live counterpart cannot currently be
run at all. Rule 1 is intact — it fails loudly with a 422/500 and never serves
baked data — but the demo bundle is, tonight, licensed by a green eval that was
run against a _previous_ provider wiring. Say so if asked; do not claim the
extraction is proven.

---

## What changed

### Phase 1 — build (parallel, behind a file-ownership wall)

**Track 1 — flow.** `lib/check-in-prompt.ts` (plan-aware system prompt +
`firstMessage`, en/fr); `lib/escalation/rules.ts` (`assess()` as a discriminated
union, threshold in one place); `/api/log` + `/api/escalate` (`request_headers` +
`secret_id`, not `secret__`); `/family` + 5s poller; state-driven incoming
check-in; `/operator` with five controls; `clearLog()`. Extracted
`components/voice/idle-view.tsx` as a declared handshake so Track 2 could restyle
the check-in screen without touching `voice-session.tsx`.

**Track 2 — UI.** Home rebuilt around one primary action conditional on whether a
letter has been read; upload reduced to a 112px accent panel; `/plan` reordered so
**Today** leads instead of sitting 2.5 screens down behind past days; ticks grown
to a 28px ring at 7.7:1; missed doses labelled rather than left as an unlabelled
triangle; red-flag card given its own `--color-error-soft` surface. Three
screenshot iterations, every PNG read. Round 3 caught a data bug from the pixels
alone (a stale forward-dated log entry) that no code review had found.

### Phase 2 — adversarial (parallel)

**Track 3** reproduced the arc from cold and produced the beat table above.
**Track 4** rebuilt `tasks/todo.md` from repo reality: 6/51 ticked → 37/51, with
zero over-ticks, and corrected three stale "Done" claims including
"Human calls outstanding: None", which had been false since the server tools
landed.

### Phase 3 — closing what Phase 2 exposed

| Fix                                                                                           | Was                                                                           |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `make clear-letter` / `DELETE /api/demo/plan` — deletes the plan, keeps log + patient + clock | Home could not be filmed in its empty state without losing the primed history |
| Non-JSON body → `400 invalid_arguments`                                                       | Bare 500, empty body, on both tool routes                                     |
| `clock moves a day` assertion now asserts the date                                            | Asserted only that `"today":"` appeared — could not fail                      |
| French red flag reaches the agent in French                                                   | English clinical text in a French session                                     |
| `/plan` + `/upload` read the dictionary (~45 keys, both languages)                            | Hardcoded English under `<html lang="fr">`                                    |
| `DemoModeBadge` takes its text as a prop                                                      | Last hardcoded English on French screens                                      |
| Deployed + all three tools attached and fired                                                 | `prompt.tool_ids = []` — tools existed but were unreachable                   |

---

## Grounding notes

- **ElevenLabs server tools.** Verified against the live `openapi.json`. The tool
  JSON validated with zero errors. Two corrections to the plan's own text: the
  default `tool_error_handling_mode` does **not** narrate errors aloud (`auto`
  resolves to `hide` for non-native webhook tools), and `check_in_id` binds to the
  built-in `system__conversation_id`, so only `patient_id` is sent from the browser.
- **The `tool_ids` trap.** The runbook said "never re-PATCH `conversation_config`"
  — which is impossible to obey and still have working tools, because `tool_ids`
  lives inside it. Corrected in `12` to narrow-PATCH-then-diff. The PATCH
  deep-merges; this was established empirically, not assumed, because the spec
  types `conversation_config` as a free-form object and does not say.
- **Model pins survived.** 118 `conversation_config` leaf keys before, 118 after,
  2 changed (`tool_ids` and its read-only `tools` expansion). Base
  `eleven_flash_v2` and the `fr` override `eleven_flash_v2_5` both intact,
  `client_events` byte-identical at 12 values.
- **Playwright.** Reused the in-repo patterns from `scripts/e2e-demo.ts` — waiting
  on a settled `<main>` because `/plan` streams, and the 390×844 / 1440×900 pair.
  A closed `<details>` returns `""` from `innerText()` while still matching
  `:has-text()`, which is why earlier plan days are demoted by position rather
  than by a disclosure element.

---

## Evidence on disk

| What                                            | Where                                         |
| ----------------------------------------------- | --------------------------------------------- |
| UI screenshots, 18 PNGs, both viewports         | `.e2e/ui/`                                    |
| Localisation screenshots, 22 PNGs, both locales | `.e2e/i18n/`                                  |
| Arc harness                                     | `make arc` → 21 passed, 0 failed              |
| Per-track findings                              | `audit/juno-recovery-companion/12`–`15`, `17` |

Screenshots were read as images, not listed — by Track 2 (three iterations),
Track 3 (independent set), the localisation track, and the orchestrator (home,
plan, family, operator).

---

## Shoot order

The human chose to **open on an empty plan**, which is the real arc and makes
home's conditional design a feature rather than the FAIL Track 3 filed.

```
make seed            # plan + patient + clock + two prior missed apixaban doses
make clear-letter    # removes ONLY the plan; log, patient and clock survive
```

Home then shows "Take a photo of your letter" as its single action. Photograph
the letter on camera → the plan appears → check-in → the escalation lands on
`/family` from history that predates the take. Verified end to end: after
`clear-letter`, Redis still held both log keys, and after the on-camera upload
`/family` computed `alert-kin` from them.

---

## Only a human can close this

**The French ear-test (B11).** All three tool-proving sessions ran
`language: "en"`. Both model pins are structurally verified and
`language_presets.fr` is untouched, but no French audio has been heard, and C2 is
explicit that **HTTP 200 proves nothing here** — Phase 1 already reproduced a case
where an unsupported language returned 200 and 74KB of healthy-looking audio. Ten
minutes, one English session and one French session, before the camera rolls. A
bad French result means B3.6, never a French-UI-plus-English-voice downgrade [D9].

---

## Residual risk

1. **The live voice call is the highest-variance moment.** Every beat funnels
   through tapping _Answer_, and nobody has made a real call since the prompt
   became plan-aware. The session sends four overrides; if any is not allow-listed
   on the agent's Security tab the socket closes `1008` **after**
   `conversation_initiation_metadata`, `try/catch` in `connect()` cannot see it,
   and `onError` paints a red banner exactly where Portico should be speaking.
   The payload is verified byte for byte; the audio is not.
1. **ASR has never been exercised end to end, in any language.** The live tool
   proof injected the user's turns as `user_message` text frames rather than
   through a microphone. Everything downstream of that — the agent, the LLM, tool
   dispatch, the webhooks — is genuine, but **no speech has ever been recognised
   by this build**. This is the single largest untested surface in the arc, it
   makes B11 more than a TTS ear-test, and it is precisely the risk B12 (bilingual
   `asr.keywords`, tappable answer chips, confirm-before-logging) was written to
   mitigate — none of which is built. On camera the mitigation is the typed
   composer, which is an explicit path the user chooses, not a silent substitute.
1. **Local and production share one Redis.** `make seed` on the laptop, the
   deployed operator panel and the agent's tool calls all mutate the same state.
   **Pick one host for the take and stay on it.**
1. **Production ships the working tree, not `HEAD`.** Most of this work is
   uncommitted. Any further edit requires a redeploy before filming, and
   `vercel deploy --prod` needs `--scope haider-projects` or it fails
   `Not authorized`.
1. **`/operator`, `/api/seed` and `/api/demo/*` are live and unauthenticated on
   the public internet** in demo mode. Acceptable for one night; take the
   deployment down afterwards.
1. **French `/plan` loses "Today above the fold."** The D7 dual render adds
   ~250px. This is correct D7 behaviour arriving, not a regression, but it is
   visible. Cheapest fix is folding `SourceTrace` into the footer strip.
1. **The letter's own clinical text has no French** on the bundle — admission
   summary, dose lines, plain-language purposes all stay English on the French
   screen, marked `lang="en"` so the document is at least honest. Closing it needs
   schema fields plus an extraction pass. Nobody invented French clinical copy,
   which was the right call.
1. **Extraction's live counterpart cannot be run** — see §Deliberately not closed.
   This is the one place where the demo-mode argument is currently weaker than
   `plan.md` claims.
1. **`DELETE /api/demo/plan`'s live-mode 403 is inferred, not observed.** Shared
   guard, first statement, identical to three proven neighbours. If anyone stands
   live mode up again, add it to the sweep.
