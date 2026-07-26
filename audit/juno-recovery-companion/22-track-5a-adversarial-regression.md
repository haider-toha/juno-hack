# 22 — Track 5a: adversarial re-verification of the Phase-1 tracks

Date: 2026-07-26. Branch `main`, working tree (uncommitted), holding the merged
output of Tracks 1–4. Verifier had **write access to this file only**, plus a
standing permission to make a small targeted fix to anything proved broken.
**Nothing was proved broken, so no source file was edited.** Nothing was
committed, pushed, checked out, stashed or restored.

Skill invoked before starting: `/code-review-and-quality`. `CLAUDE.md` read in
full and held against the diff.

**Verdict in one line:** the product's load-bearing guarantees are real and I
could not break any of them — the escalation is genuinely computed, the demo /
live boundary genuinely holds in a live-mode process, and `lib/plan/schema.ts` is
genuinely frozen. Two claims do not survive: **`make eval` is not reliably
green — it failed on my first independent run** (exit 2, one letter lost to a
five-minute extraction), and **Track 1's "15–35s per letter" understates the
tail by an order of magnitude**. One older claim is refuted outright: `14-…md`'s
French red-flag finding was **already false when it was written**.

---

## Scope and posture

I was sent to disbelieve. Every Phase-1 findings file is a set of claims written
by the agent that did the work. So nothing below is quoted from those files as
evidence: every number was re-measured, every guarantee re-attacked, and where a
claim is true but narrower than stated, that is said.

What I ran:

| Tool                                             | Purpose                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck` / `lint` / `format:check`       | Fresh, twice — once at the start and once at the end                                                                                       |
| `make arc` ×3, timed                             | The true count and the true wall clock                                                                                                     |
| A **mutated copy** of `scripts/demo-arc.sh`      | Negative control: can the harness go red at all                                                                                            |
| `make state`, `make ui-edges`                    | Track 4's two new harnesses, run rather than read                                                                                          |
| **A live-mode server on `:3001`**                | The worktree at `/Users/haidertoha/Code/juno-hack-t1`, `NEXT_PUBLIC_PORTICO_MODE=live`. Torn down afterwards; `:3000` never left demo mode |
| `PORTICO_URL=http://localhost:3001 make eval` ×2 | Two independent scoring runs against a real model                                                                                          |
| `curl` against `:3000` and `:3001`               | Every demo route, every method, every malformed body                                                                                       |
| A 30-probe attack battery of my own (scratchpad) | Trying to make `/family` lie, nine independent ways                                                                                        |
| Three throwaway Node scripts (deleted after)     | Schema validation, JSON-Schema measurement, `oneOf` losslessness proof                                                                     |
| Playwright, 390×844 and 1440×900, EN + FR        | Track 2's pixel claims, measured off the live DOM                                                                                          |
| `git log`, `git diff --stat`, `shasum`           | Provenance of the files I was asked to attribute results to                                                                                |

**Deliberately not attempted**, and why:

- **`make e2e`** — it wipes `.e2e/` entirely, which today holds four screenshot
  sets (`ui/`, `i18n/`, `ui-before-track2/`, `ui-after-track2/`, ~190 PNGs). The
  evidence other tracks left behind is worth more than a tenth re-run of a
  harness two other agents already ran. **Track 2's "`make e2e` 10/10" is
  therefore unverified by me.**
- **Track 3's 34 × 3 ElevenLabs battery** — costs credits, and the remote agent
  config is **Track 5b's surface tonight** (see below).
- **Track 3's three remote mutations** (`asr.keywords`, the `end_check_in`
  description, the `prompt_injection` guardrail) — reading them back means
  authenticating to the ElevenLabs API. That is 5b's surface. **Unverified by
  me; 5b should read all three back.**
- **Any real voice call.** No microphone, no session. The audio is still
  unverified by anybody.
- **Track 2's before/after _deltas_.** I can measure the tree as it stands; I
  cannot measure the tree as it was without reverting it, which I was told not to
  do. So "273px → 153px" is verified only at the "153px" end.
- **The camera / photograph extraction path.** Untouched, and still untested by
  anyone.

**Left to Track 5b, spotted but not pursued:** `.gitignore` acquired an
uncommitted change during my run (`.env` / `.env.local` / `.env*.local` → `.env*`
plus `!.env.example`). That is 5b's env-hygiene surface and I did not touch it.
No secret value appears anywhere in this file, and none was printed to a
terminal — every inspection of an env file went through `sed -E 's/=.*/=<redacted>/'`.

---

## Per-track verdict

### Track 1 — `18-track-1-openai-extraction.md`

| Claim                                                                     | Verdict                                                                                                                          |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| The 5 files landed in the primary checkout byte-identically               | **Reproduced** — all five `diff`-clean, `extract.ts` sha matches the one Track 1 published                                       |
| `lib/plan/schema.ts` was not changed                                      | **Reproduced** — identical to `HEAD`, identical to the worktree                                                                  |
| The schema fits OpenAI's strict ceilings (193 props / depth 4 / 98 enums) | **Reproduced exactly**, independently generated                                                                                  |
| `oneOf → anyOf` is 5 sites, all `DateAnchor`, and lossless                | **Reproduced, and proved rather than argued** — see [Attack 5](#attack-5--the-oneofanyof-rewrite)                                |
| `make eval` is green, every scored family 100% on all 5 letters           | **DOES NOT RELIABLY REPRODUCE.** Run 1 **exit 2**, 4/5 letters. Run 2 exit 0. See [§make eval](#make-eval--two-independent-runs) |
| Quality: every family that scores, scores 100%                            | **Reproduced on both runs** — 23/23 scored cells run 1, 29/29 run 2                                                              |
| "Latency 15–35s per letter"                                               | **Overstated as a range.** 10 measured: median 28.1s, but 41s, 49s and one **>300s**                                             |
| The demo short-circuit is unreachable from any `catch`                    | **Reproduced by re-deriving the whole catch inventory** — see [Attack 3](#attack-3--d9-rule-1)                                   |
| "104 real extractions, D9 rule 3 closed"                                  | **Reproduced in kind** — 10 more live extractions tonight, all HTTP 200 at the server                                            |
| `.env.example` / `lib/env.ts` / `package.json` provenance                 | **Not attempted** — Track 5b's surface                                                                                           |

### Track 2 — `19-track-2-demo-ui-flow.md`

| Claim                                                           | Verdict                                                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `suggested-questions.tsx` deleted, `chip-row.tsx` added         | **Reproduced** — `D` and `??` in `git status`; strings ship in EN and FR                            |
| `ChipRow` carries no `"use client"` of its own                  | **Reproduced** — 0 occurrences; it is imported by the `voice-session.tsx` boundary, per `CLAUDE.md` |
| Red tint 273px → **153px**, card 339px → **301px** (390×844 EN) | **Reproduced exactly at the "after" end.** tint 153px, strip 149px, card 301px                      |
| Desktop frame: card 324px, first dose row ~671px                | **Reproduced** — 324px, first tickable row at 673px                                                 |
| `/letter` renders at 900px; highlight 22px × 339px              | **Reproduced exactly** — canvas 900×1165, highlight 339×22                                          |
| `/letter` opens centred on the quote                            | **Reproduced, and it is precise** — highlight centre lands on the pan box centre to the pixel       |
| `overscroll-behavior: contain` on the pan box                   | **Reproduced**                                                                                      |
| French `/plan` keeps today above the fold                       | **Reproduced, but tighter than reported** — 740px not 724px (phone); 873px not 857px (frame)        |
| `make e2e` 10/10                                                | **Not attempted** — it destroys four screenshot sets                                                |
| The accessibility sweep (16 findings, all the orb)              | **Not attempted** — no independent sweep run; horizontal overflow spot-checked clean at 4 viewports |
| `make arc` was 18/3 and not this track's fault                  | **Reproduced via `git`** — `escalation-card.tsx` shipped `id` before `class` in `c6986ef`           |

### Track 3 — `20-track-3-elevenlabs-stress-test.md`

| Claim                                                              | Verdict                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Six prompt defects fixed in `lib/i18n/en.ts` + `fr.ts`             | **Reproduced, all six, in both locales** — see [§Track 3's six fixes](#track-3s-six-prompt-fixes) |
| The confirm gate is the **first** bullet of `toolsBody`            | **Reproduced** — it is literally the opening characters of the template string                    |
| "offer to flag it for their nurse or GP" is gone                   | **Reproduced** — 0 occurrences in either file                                                     |
| The escalation threshold is untouched and lives only in `rules.ts` | **Reproduced three independent ways** — see [Attack 1](#attack-1--the-escalation-threshold)       |
| `lib/check-in-prompt.ts` needed no change                          | **Reproduced** — identical to `HEAD`                                                              |
| `voice-session.tsx` override wiring untouched by this track        | **Not separately attributable** — Track 2 also edits that file; the diff is joint                 |
| 34 scenarios × 3, 99/102 runs passed                               | **Not attempted** — costs credits                                                                 |
| Three remote ElevenLabs mutations read back                        | **Not attempted — Track 5b's surface.** Nobody in this pass has re-read them                      |
| The `FAREWELL_RE` fallback covers a missed `end_check_in`          | **Reproduced statically** — the regex is present and matches `au revoir` / `à bientôt`            |

### Track 4 — `21-track-4-functional-edge-cases.md`

| Claim                                                               | Verdict                                                                                                                                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make arc` is **21 passed, 0 failed**                               | **Reproduced, three consecutive runs**                                                                                                                                           |
| ~4.3s median                                                        | **Reproduced** — 5.89s / 3.84s / 4.54s, median **4.54s**                                                                                                                         |
| The `family_says()` fix is not merely looser                        | **Reproduced, and I went further** — a 12-cell discrimination matrix plus a live negative control on the harness. See [Attack 2](#attack-2--does-the-arc-assertion-discriminate) |
| Malformed body → named 400 on `/api/demo/clock` and `/api/demo/log` | **Reproduced**, across three malformed shapes each plus the operator's own `{"day":""}`                                                                                          |
| All 8 POST routes answer with a non-empty parseable body            | **Reproduced** (see the correction to my own first reading, below)                                                                                                               |
| `make state` 15/15                                                  | **Reproduced** — 15/15, 25.91s (claimed 24.21s)                                                                                                                                  |
| `make ui-edges` 4/4                                                 | **Reproduced** — 4/4, 13.68s (claimed 14.51s)                                                                                                                                    |
| **The demo-mode badge does not exist**                              | **Reproduced, and it is worse than stated** — 0 hits on 7 screens in **both** locales                                                                                            |
| 10 demo handlers + `/api/seed` all carry the guard                  | **Reproduced statically and then observed live** — 11/11 refuse. See [Attack 4](#attack-4--the-portico_mode-guard)                                                               |
| `purposePlain` has no French — "a data gap in the bundle"           | **Reproduced, and it is a schema gap, not a data gap** — `lib/plan/schema.ts` has no `purposePlainFr` field at all                                                               |
| `14-…md`'s L8 (hardcoded greeting), L9 (kin with no plan)           | **Not attempted** — already reproduced twice; low leverage                                                                                                                       |

---

## Fresh check-suite output

Run twice — once before I touched anything, once after everything below. Both
identical, both green. (Track 5b was editing `.gitignore` between the two.)

```
$ pnpm typecheck
$ tsc --noEmit
(no output, exit 0)

$ pnpm lint
$ eslint .
(no output, exit 0)

$ pnpm format:check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
(exit 0)
```

The orchestrator's repo-wide `pnpm format` and the `public/pdf.worker.min.mjs`
`.prettierignore` entry both took. The 25-file `format:check` failure Track 1
reported (and correctly attributed to a pre-existing condition, not to any
Phase-1 track) is gone.

---

## `make arc` — the true figure

Three consecutive runs against the warm `:3000` demo server, `date`-bracketed
around the whole `make arc` invocation.

```
=== run 1: 5.89s ===   21 passed, 0 failed
=== run 2: 3.84s ===   21 passed, 0 failed
=== run 3: 4.54s ===   21 passed, 0 failed

min 3.84s   median 4.54s   max 5.89s
```

Full output of run 3, verbatim:

```
1 · reset
  PASS  seed returns the Whitfield plan
2 · clock
  PASS  clock reads the seeded day
  PASS  clock moves a day
  PASS  clock moves back
3 · escalation, from the seeded misses
  PASS  family escalates to next of kin
4 · escalation clears when the misses are answered
  PASS  one answered miss drops it to a nudge
  PASS  both answered clears it
5 · the ElevenLabs server tools
  PASS  log_step refuses an unauthenticated call
  PASS  log_step writes with the shared secret
  PASS  log_step rejects an id that is not in the plan
  PASS  escalate refuses an unauthenticated call
  PASS  escalate records a miss and names the next of kin
6 · the raised check-in
  PASS  nothing is ringing to start with
  PASS  the operator can ring it
  PASS  the phone can see it ringing
  PASS  answering clears it
7 · the screens
  PASS  the check-in prompt carries a real plan item
  PASS  the opening line is plan-aware
  PASS  the operator panel renders
8 · the empty opening shot
  PASS  clearing the letter keeps the primed misses and the clock
  PASS  the panel sees no plan stored

9 · leaving the app seeded and ready to film
  today is now 2026-07-27, apixaban missed twice

21 passed, 0 failed
```

**Track 4's count and its stopwatch both reproduce.** `14-…md`'s L7 — that one
assertion (`clock moves a day`) could not fail — is also closed: line 61 now
asserts the exact date the route must land on, computed from the date the route
just reported, and line 62 asserts the exact date it must come back to.

---

## `make eval` — two independent runs

**File attribution first**, because an eval number that cannot be attributed to
the tree under review is worthless. All five extraction-path files are
**byte-identical** between `/Users/haidertoha/Code/juno-hack` and the worktree
`/Users/haidertoha/Code/juno-hack-t1`:

```
lib/extraction/extract.ts        IDENTICAL   sha=4bd907a7433c74c0
lib/env.ts                       IDENTICAL   sha=b2ffd2f5d66d31ec
package.json                     IDENTICAL   sha=2e3b2f623d13db13
pnpm-lock.yaml                   IDENTICAL   sha=a0ede3026da022b4
.env.example                     IDENTICAL   sha=265d636b599014c9

4bd907a7433c74c043deb415463f7249982d52c1  /Users/haidertoha/Code/juno-hack/lib/extraction/extract.ts
4bd907a7433c74c043deb415463f7249982d52c1  /Users/haidertoha/Code/juno-hack-t1/lib/extraction/extract.ts
```

The full sha matches the one Track 1 published. The worktree is on `2185ca6`,
its `.env` carries `NEXT_PUBLIC_PORTICO_MODE=live`, and `POST /api/seed` against
`:3001` returned **403** before either run, so both were genuinely live mode.

### Run 1 — complete stdout, verbatim

```
$ cd /Users/haidertoha/Code/juno-hack-t1 && PORTICO_URL=http://localhost:3001 make eval
node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/eval-extraction.ts
Scoring 5 letters against http://localhost:3001

  [1] 01_Clarke_Emma_Cholecystitis … done
  [2] 02_Whitfield_Harold_Pneumonia … done
  [3] 03_Okafor_David_NSTEMI … extraction failed
  [4] 04_Sinclair_Margaret_NOF_Fracture … done
  [5] 05_Bradley_Susan_COPD … done

Removed 5 eval plan key(s) from Redis.

Family                                [1]         [2]         [3]         [4]         [5]
Patient identity                100% pass   100% pass           —   100% pass   100% pass
Medication names (recall)       100% pass   100% pass           —   100% pass   100% pass
Dose, frequency, route          100% pass   100% pass           —   100% pass   100% pass
Appointments (recall)                none   100% pass           —   100% pass   100% pass
Red-flag safety-netting         100% pass   100% pass           —   100% pass   100% pass
Source refs resolve and quote   100% pass   100% pass           —   100% pass   100% pass

01_Clarke_Emma_Cholecystitis — Appointments (recall)
    nothing to check — no gold action records a follow-up — hospital: the letter records no follow-up (date "N/A", responsible "N/A"); community_and_specialist_services: the letter records no follow-up (date "N/A", responsible "N/A")
EXTRACTION FAILED  03_Okafor_David_NSTEMI: fetch failed

Measured 4/5 letters and 23/30 family scores (1 had nothing in the gold letter to check, 0 individual check(s) skipped).
Note: 02_Whitfield's gold labels were used to author the seed, so its column is not independent.

0 threshold(s) missed, 1 letter(s) failed to extract.
make: *** [eval] Error 1

$ echo $?
2
```

### Run 2 — complete stdout, verbatim

```
$ cd /Users/haidertoha/Code/juno-hack-t1 && PORTICO_URL=http://localhost:3001 make eval
node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/eval-extraction.ts
Scoring 5 letters against http://localhost:3001

  [1] 01_Clarke_Emma_Cholecystitis … done
  [2] 02_Whitfield_Harold_Pneumonia … done
  [3] 03_Okafor_David_NSTEMI … done
  [4] 04_Sinclair_Margaret_NOF_Fracture … done
  [5] 05_Bradley_Susan_COPD … done

Removed 5 eval plan key(s) from Redis.

Family                                [1]         [2]         [3]         [4]         [5]
Patient identity                100% pass   100% pass   100% pass   100% pass   100% pass
Medication names (recall)       100% pass   100% pass   100% pass   100% pass   100% pass
Dose, frequency, route          100% pass   100% pass   100% pass   100% pass   100% pass
Appointments (recall)                none   100% pass   100% pass   100% pass   100% pass
Red-flag safety-netting         100% pass   100% pass   100% pass   100% pass   100% pass
Source refs resolve and quote   100% pass   100% pass   100% pass   100% pass   100% pass

01_Clarke_Emma_Cholecystitis — Appointments (recall)
    nothing to check — no gold action records a follow-up — hospital: the letter records no follow-up (date "N/A", responsible "N/A"); community_and_specialist_services: the letter records no follow-up (date "N/A", responsible "N/A")

Measured 5/5 letters and 29/30 family scores (1 had nothing in the gold letter to check, 0 individual check(s) skipped).
Note: 02_Whitfield's gold labels were used to author the seed, so its column is not independent.

All thresholds met.

$ echo $?
0
```

### Reading these two honestly

**The quality claim reproduces. The reliability claim does not.**

Every family that scored, scored 100% — 23 cells in run 1, 29 in run 2, 52 of 52
across both. `gpt-5.6-luna` reading these five letters is as good as Track 1 says
it is, and the two runs together are a sixth and seventh consecutive
zero-threshold-miss result. That is a genuinely strong measurement and Track 1
earned it.

**But `make eval` is not a reliably green gate.** One run in two exited non-zero
on this machine tonight, on a letter Track 1 never had trouble with. The cause is
visible in the `:3001` access log — the route itself never failed:

```
POST /api/extract 200 in 22.9s
POST /api/extract 200 in 26.0s
POST /api/extract 200 in 5.0min      ← run 1, letter [3] Okafor
POST /api/extract 200 in 49s
POST /api/extract 200 in 25.9s
POST /api/extract 200 in 24.1s
POST /api/extract 200 in 41s
POST /api/extract 200 in 30.5s
POST /api/extract 200 in 24.4s
POST /api/extract 200 in 30.2s
```

Ten extractions, **ten HTTP 200s at the server**. The one the harness scored as
`extraction failed` is the one that took **five minutes** — and `extract()` in
`scripts/eval-extraction.ts` uses a bare `fetch` with **no explicit timeout**, so
it inherits undici's 300-second default `headersTimeout` and throws
`fetch failed`. That is exactly the 5.0min mark.

Two consequences worth stating plainly:

1. **The harness cannot tell "the model could not read this letter" from "we
   stopped waiting."** Both print `extraction failed`, and the second is
   indistinguishable from the first in the report. I did **not** fix this: the
   harness's _behaviour_ is right (it fails loudly, exits non-zero, and names the
   letter), only its _diagnosis_ is imprecise, and changing an eval harness's
   timeout semantics the night before a demo is not a change worth making on my
   own judgement. It is written up instead.
2. **The latency figure needs correcting.** Track 1 reports "15–35s per letter".
   Sorted, my ten samples are 22.9, 24.1, 24.4, 25.9, 26.0, 30.2, 30.5, 41, 49,
   300+ — **median 28.1s, and three of ten outside the stated band**. Nobody
   should plan a live-extraction beat on 35 seconds.

**And Whitfield's column [2] still is not independent** — the harness prints that
itself on every run. Four letters, not five, are independent evidence. Track 1
says so; I am repeating it because it is the sentence most likely to be dropped
when the number is quoted.

---

## Attack log

Each guarantee, each independent method, and whether it held. **The attacks that
failed to break anything are the point** — they are the evidence the guarantee is
real.

### Attack 1 — the escalation threshold

**The guarantee:** `none → nudge → alert-kin` is computed by
`lib/escalation/rules.ts` and nowhere else. The threshold must never live in the
agent prompt or in a tool handler, or the claim "the app worked this out" is a
model output wearing a card.

| Method                                                         | Result                                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grep for the constants across the whole repo                   | `WINDOW_DAYS` / `ALERT_MISSES` appear in **one file**, `lib/escalation/rules.ts`. **HELD**                                                              |
| Grep the composed agent prompt for any count or threshold word | Four hits, none of them a rule: reply length, tool cadence, the confirm gate. **HELD**                                                                  |
| Does `buildCheckInPrompt` import `lib/escalation/rules`?       | No. It takes `logs` as an argument and never sees the rule. **HELD**                                                                                    |
| Does the prompt say so itself?                                 | `en.ts:404` — _"You do not decide what counts as serious enough to escalate a pattern. You report what happened; the app works out the rest."_ **HELD** |
| Does `/api/log` hint at it?                                    | `route.ts:85` comments that the threshold deliberately lives elsewhere. **HELD**                                                                        |
| `high_stakes` elsewhere?                                       | Two consumers, both cosmetic: `check-in-prompt.ts:153` appends `" (important)"`, `operator/page.tsx:48` filters a list. **HELD**                        |

### Attack 2 — can `/family` be made to lie?

Nine independent probes. **None moved the card.**

```
--- A1 · search params (the only thing a viewer controls) ---
  GET /family?kind=alert-kin                                -> A dose that matters was missed twice.
  GET /family?assessment=alert-kin                          -> A dose that matters was missed twice.
  GET /family?assessment=alert-kin&kind=alert-kin&missed=9  -> A dose that matters was missed twice.
  GET /family?escalation=alert-kin                          -> A dose that matters was missed twice.

--- A2 · headers a proxy or a curl could set ---
  x-portico-tool-secret on GET /family                      -> A dose that matters was missed twice.
  Cookie: portico_assessment=alert-kin                      -> A dose that matters was missed twice.
```

(The seeded state _is_ `alert-kin`, so "unchanged" is the correct reading here —
Attack 2's B-series below drives the screen into every other state and shows the
same params still do nothing.)

```
--- A3 · does calling /api/escalate paint the alert? ---
  both seeded misses answered taken       -> Nothing needs your attention.
  after ONE escalate call                 -> A dose was missed.          (nudge, not alert)
  after a SECOND escalate call, same day  -> A dose was missed.          (still nudge — day dedup)
```

`/api/escalate` writes one `LogEntry` and returns
`"tell_the_patient":"A note has been left on the family view. Nobody has been
called or messaged."` It sets no flag. Two calls on one day still produce a
nudge, because `assess()` de-duplicates by day.

**Then I attacked the rule itself, five ways.**

```
--- B1 · a standard-class medicine, two misses INSIDE the window ---
  metformin (standard) x2 in window       -> A dose was missed.          HELD (nudge, not alert)

--- B2 · the high_stakes drug, driven ONLY through the ElevenLabs tool route ---
  cleared                                 -> Nothing needs your attention.
  1 tool miss (today)                     -> A dose was missed.
  2 tool misses (today, today-1)          -> A dose that matters was missed twice.

--- B3 · window boundary: is WINDOW_DAYS=3 really 3? ---
  misses on today and today-2 (both IN)   -> A dose that matters was missed twice.
  misses on today and today-3 (one OUT)   -> A dose was missed.
  misses on today-3 and today-4 (both OUT)-> Nothing needs your attention.

--- B4 · same day written twice by two different writers ---
  one day, two writers, both "missed"     -> A dose was missed.          HELD (no double count)

--- B5 · a non-medication id missed twice ---
  inst-falls missed twice                 -> Nothing needs your attention. HELD
```

B2 is the one that matters: `alert-kin` was reached using **only** `POST /api/log`
with the shared tool secret — the route ElevenLabs calls — so nothing on the path
was an operator affordance. B3 pins the window to exactly three days in both
directions. B4 proves one day cannot be counted twice even when two different
writers report it. B5 proves a missed instruction cannot masquerade as a missed
dose.

**The escalation guarantee is real. I could not break it.**

### Attack 2b — does the arc assertion discriminate?

Track 4 claims its `family_says()` fix "is not merely looser than the original".
An assertion that cannot fail is worse than one that always fails, so I tested it
two ways.

**First, a discrimination matrix.** I drove `/family` through all four real
states and ran the arc's three _exact_ expected substrings against each. A
vacuous assertion would show PASS across its whole row.

```
screen state -> family_says()                          | 'missed twice' | 'A dose was missed' | 'Nothing needs your attention'
-------------------------------------------------------|----------------|---------------------|------------------------------
alert-kin  -> A dose that matters was missed twice.     | PASS           | FAIL                | FAIL
nudge      -> A dose was missed.                        | FAIL           | PASS                | FAIL
none       -> Nothing needs your attention.             | FAIL           | FAIL                | PASS
no plan    -> (no escalation heading on /family)        | FAIL           | FAIL                | FAIL
```

Twelve cells, exactly three PASSes, all on the diagonal, and the fourth state —
the one the old class-keyed pattern could not tell from the other three — fails
all three by name.

**Second, a live negative control on the harness itself.** I ran a scratchpad
copy of `scripts/demo-arc.sh` with section 1's seed replaced by an echo, against
a deliberately broken state (`DELETE /api/demo/plan`):

```
1 · reset
  (seed deliberately skipped for this negative control)
2 · clock
  PASS  clock reads the seeded day
  PASS  clock moves a day
  PASS  clock moves back
3 · escalation, from the seeded misses
  FAIL  family escalates to next of kin
        expected: missed twice
        got:      (no escalation heading on /family)
4 · escalation clears when the misses are answered
  FAIL  one answered miss drops it to a nudge
        expected: A dose was missed
        got:      (no escalation heading on /family)
  FAIL  both answered clears it
        expected: Nothing needs your attention
        got:      (no escalation heading on /family)
5 · the ElevenLabs server tools
  PASS  log_step refuses an unauthenticated call
  FAIL  log_step writes with the shared secret
        expected: "ok":true
        got:      {"error":"no_plan_stored"}
```

**`make arc` goes red, and it names the absence rather than printing a blank
`got:`** — which is the exact failure mode that let three silent failures read as
a green arc in two earlier documents. Track 4's claim is not only true, it is
better than it claimed: the harness is now wired to a hook (`id="family-assessment"`)
that the card's own `aria-labelledby` depends on, so breaking the assertion and
breaking the section's accessible name are the same act.

One residual fragility worth naming: the fixed pattern is
`<h2 id="family-assessment"[^>]*>` and therefore still depends on `id` appearing
**first** in JSX source order in `escalation-card.tsx` (lines 95–97 and 112–114).
It is a more stable key than a Tailwind class list — an `id` is semantic and a
class list is not — but it is the same _class_ of fragility, not an escape from
it. Restored state after the control: `A dose that matters was missed twice.`

### Attack 3 — D9 rule 1

**The guarantee:** no `catch` anywhere may reach `DEMO_PLAN`. A live failure must
fail loudly and never fall through to demo data. Track 1 rewrote `extractBundle`,
so this needed re-deriving from scratch, not re-reading.

`DEMO_PLAN` has exactly **two** consumers in the whole repo:

```
app/api/seed/route.ts      (itself mode-guarded — see Attack 4)
lib/extraction/extract.ts:96
```

`extract.ts:96` sits inside the **first statement** of `extractBundle`:

```ts
if (env.NEXT_PUBLIC_PORTICO_MODE === "demo") {
  return { kind: "extracted", bundle: DEMO_PLAN };
}
```

The `try` opens at line 110 and the `catch` at 132 — lexically after and
structurally outside. There is no control path from the catch back to line 96.

Every `catch` in `app/`, `lib/` and `components/`, read individually:

| Site                                                           | Catches                                              | Lands on                                                                                        | Reaches `DEMO_PLAN`? |
| -------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------- |
| `lib/extraction/extract.ts:132`                                | the model call                                       | rethrows unless `NoObjectGeneratedError` / `NoOutputGeneratedError`; else `{kind:"unreadable"}` | **No**               |
| `lib/drugs/lookup.ts:331`                                      | the NHS A-Z index fetch                              | `{kind:"failed"}`                                                                               | No                   |
| `lib/drugs/lookup.ts:380`                                      | the NHS drug page fetch                              | `{kind:"failed"}`                                                                               | No                   |
| `lib/drugs/lookup.ts:432`                                      | one malformed JSON-LD block among several            | `continue`                                                                                      | No                   |
| `components/plan/task-check.tsx:47`                            | the `logStep` Server Action                          | `setFailed(true)`, tick unwinds                                                                 | No                   |
| `components/letter/letter-viewer.tsx:129`                      | pdfjs render                                         | `{kind:"error"}`, ignores `AbortError`                                                          | No                   |
| `components/voice/voice-session.tsx:430`                       | the `getUserMedia → signed-url → startSession` chain | `setError(...)`                                                                                 | No                   |
| `components/upload/use-letter-upload.ts:86`                    | the upload/extract round trip                        | `{phase:"failed"}`                                                                              | No                   |
| 8 × `.catch(() => null)` on `request.json()` in route handlers | a body that is not JSON                              | a named 400                                                                                     | No                   |
| 1 × `.catch(() => ({}))` in `/api/demo/reminder`               | ditto                                                | treated as "no arguments"                                                                       | No                   |

**D9 rule 1 holds. HELD.** Two things worth stating that Track 1 stated correctly
and that survive independent reading:

- `readBytes` (line 107) is **outside** the try, so a Vercel Blob failure throws
  out of `extractBundle` entirely and surfaces as a 500. That is Track 1's R1,
  and it is the right shape — loud, and never demo data.
- The catch is deliberately narrow. A 401, a rate limit or a dropped socket is
  **rethrown**, so an expired key can never be reported to a patient as "we could
  not find a discharge letter in those pages".

**One thing D9 rule 1 does not cover, found while re-deriving it.** `resolveSlug`
in `lib/drugs/lookup.ts` short-circuits to the committed fixture **in live mode
as well as demo**, and one entry (`enoxaparin`) carries `state: "absent"`. So on
a live server, a patient prescribed enoxaparin is told _"This medicine is not in
the NHS medicines A to Z"_ from a baked verdict, without the live A-Z ever being
consulted. This is **not** a catch reaching baked data and **not** reachable
tonight (demo mode always serves the Whitfield bundle, whose seven medicines are
all in the fixture). It is the live-mode twin of Track 4's residual risk 3, and
it should be recorded alongside it.

### Attack 4 — the `PORTICO_MODE` guard

**The open item Track 4 could not close**, because it had no live-mode server. I
had one. Every `/api/demo/*` handler and `/api/seed`, curled against `:3001` in
live mode:

```
GET     /api/demo/check-in         -> 403  {"message":"The operator controls only exist in demo mode, and this app is running in live mode."}
POST    /api/demo/check-in         -> 403  (same)
DELETE  /api/demo/check-in         -> 403  (same)
GET     /api/demo/clock            -> 403  (same)
POST    /api/demo/clock            -> 403  (same)
POST    /api/demo/log              -> 403  (same)
DELETE  /api/demo/plan             -> 403  (same)
GET     /api/demo/reminder         -> 403  (same)
POST    /api/demo/reminder         -> 403  (same)
DELETE  /api/demo/reminder         -> 403  (same)
POST    /api/seed                  -> 403  {"message":"The seed overwrites the stored plan with the demo bundle, and this app is running in live mode, so it has not run."}
```

**11 of 11. HELD.** This is four more handlers than `14-…md` tested (it covered
seven; `DELETE /api/demo/plan` and the three `/api/demo/reminder` verbs were
never observed until now). Beat 11 is no longer an inference.

Two controls, so this is not a vacuous result:

- **The same eleven all work on `:3000`** — `make arc` exercises `POST /api/seed`,
  `POST/GET /api/demo/clock`, `POST /api/demo/log`, `POST/GET/DELETE
/api/demo/check-in` and `DELETE /api/demo/plan`, and `make state` exercises the
  three `/api/demo/reminder` verbs. All green. So the 403 is the mode refusing,
  not the route being broken.
- **The shared demo state was untouched by the sweep.** Both servers point at the
  same Upstash instance, so a guard failure would have been visible. Read back
  from `:3000` immediately afterwards: `{"today":"2026-07-27"}`,
  `{"raisedAt":null}`, `{"reminders":[],"raised":null}`, `/family` =
  `A dose that matters was missed twice.` Unchanged.

### Attack 5 — the `oneOf`/`anyOf` rewrite

**The guarantee:** `lib/plan/schema.ts` is frozen, and the only change is a
mechanical, meaning-preserving keyword rename on the _generated_ JSON Schema.

**Is it frozen?**

```
$ git diff --stat -- lib/plan/schema.ts        (empty)
$ git status --short -- lib/plan/schema.ts lib/plan/samples/    (empty)
schema.ts     IDENTICAL TO HEAD
demo-plan.ts  IDENTICAL TO HEAD
worktree schema.ts IDENTICAL
```

**Does the demo bundle still validate against it?** Proved by running it, not by
asserting it — a throwaway script, since deleted:

```
=== 1 · does DEMO_PLAN validate against the frozen schema? ===
ExtractedBundle.safeParse(DEMO_PLAN).success          true
ExtractedBundleFromModel.safeParse(DEMO_PLAN)         true
DEMO_PLAN.extraction.modelId                          seed/02-whitfield
DEMO_PLAN.medications.length                          7
DEMO_PLAN.redFlags.length                             1

=== 2 · negative control: does the schema actually reject? ===
safeParse(bundle with a gutted medication)            false
safeParse(bundle with a non-ISO dischargeDate)        false
```

The negative control matters: a schema that accepts everything would also
"validate" the demo bundle.

**Are Track 1's measurements real?** Regenerated independently:

```
raw JSON bytes                                       17345
objects                                              38
  of which additionalProperties:false                38
  of which every property in `required`              38
total properties                                     193
total enum values                                    98
$ref count                                           0
nesting depth (properties levels)                    4
oneOf sites                                          5
anyOf sites                                          50
nodes carrying BOTH oneOf and anyOf (clobber risk)   0
```

Every figure matches Track 1's to the byte. The last row is mine, not theirs, and
it matters: `oneOfToAnyOf` does `node.anyOf = node.oneOf`, which would silently
destroy a sibling `anyOf`. There are no such nodes, so it cannot.

**Is the rename lossless?** Track 1 argues it is, from the general property that a
discriminated union's branches are mutually exclusive. I checked the actual
generated schema instead of the argument:

```
OK   properties.medications.items.properties.duration.properties.start.anyOf[0]
       kind consts = [offset, date, conditional]  distinct=true  kind required=true  closed=true
OK   properties.medications.items.properties.duration.properties.end.anyOf[0]
       kind consts = [offset, date, conditional]  distinct=true  kind required=true  closed=true
OK   properties.instructions.items.properties.anchor.anyOf[0]
       kind consts = [offset, date, conditional]  distinct=true  kind required=true  closed=true
OK   properties.instructions.items.properties.recurrence.anyOf[0].properties.until.anyOf[0]
       kind consts = [offset, date, conditional]  distinct=true  kind required=true  closed=true
OK   properties.appointments.items.properties.when
       kind consts = [offset, date, conditional]  distinct=true  kind required=true  closed=true

VERDICT: all 5 sites are provably mutually exclusive -> oneOf->anyOf is lossless
```

All five sites are the `DateAnchor` union, exactly as claimed. Each branch carries
`kind: {const: …}` with `kind` in `required` and `additionalProperties: false`,
so a document can satisfy at most one branch. "Exactly one matches" and "at least
one matches" are therefore the same predicate here. **HELD, and now proved rather
than reasoned.**

### Attack 6 — red flags and their source trace

**The guarantee:** the alarming words on `/plan` are the clinician's, quoted, and
"where does it say that" reaches the real page of the real letter — for this
patient and no other.

What `/plan` renders for the one seeded flag:

```
Get help if
breathless, feverish or confused again
Advised to seek urgent help
Your letter does not say who to contact for this.
```

The bundle's own record:

```
id: "flag-worsening-chest-infection"
triggerVerbatim: "breathless, feverish or confused again"
actionVerbatim:  "Advised to seek urgent help"
triggerFr:       "essoufflé, fiévreux, ou de nouveau confus"
actionFr:        "Il vous a été conseillé de demander de l'aide en urgence"
escalationChannel: "other"
```

The screen prints the two `*Verbatim` fields and nothing else on the tint.
`escalationChannel: "other"` is correct — the action names nobody, so no number
is invented, and the card says so rather than filling the gap.

The bytes behind it:

```
bundle blobPathname: letters/demo/02_Whitfield_Harold_Pneumonia.pdf
HTTP/1.1 200 OK
cache-control: private, no-store
content-type: application/pdf
first 4 bytes: 25504446 (%PDF)     size: 194289 bytes
```

**The scope guard, attacked three ways — all refused:**

```
same path, WRONG patientId          -> 404
same path, NO patientId             -> 400
a path NOT in this patient's bundle -> 404   (Clarke's letter, requested as demo)
```

`/letter` with a bogus `patientId` renders "We could not … not found" rather than
anything about Whitfield. **HELD.**

And the reader is legible, which was the whole point of Track 2's change:

```
rendered page canvas       900 x 1165 px
highlight boxes            [{"w":339,"h":22},{"w":104,"h":22}]
pan box                    342 x 688,  scrollable area 900 x 1165
opened at scroll           x=457  y=462
highlight centre in box    (171, 344)      box centre (171, 344)
overscroll-behavior        contain
```

It opens with the quote **exactly** at the centre of the pan box, on both axes.
Track 2's numbers reproduce to the pixel.

---

## Track 3's six prompt fixes

All six landed, in both locales. Verified by reading the shipped strings, not the
findings file.

| Defect | Evidence in the tree                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | `en.ts:397` — _"Only record a step as taken when they say they have already taken it. Meaning to take it later is not taken."_ · `fr.ts:319` authored, not translated                          |
| **D2** | `en.ts:346` — _"…not even to say a dose should not be doubled."_ · `fr.ts:279` — _"…pas même pour dire qu'il ne faut pas doubler."_                                                            |
| **D3** | `grep -c "offer to flag it for their nurse"` → **0** in both files. Replaced by `en.ts:342` _"worth asking their nurse or GP"_ plus a new rule at `en.ts:343`: _"You cannot contact anybody."_ |
| **D4** | `toolsBody` — one step at a time, read back in the past tense                                                                                                                                  |
| **D5** | `en.ts:405` — _"…call end_check_in in the same turn. This step is important…"_                                                                                                                 |
| **D6** | record only what the person on this call says about their own day                                                                                                                              |

**B12(b), the confirm gate, is the first bullet of `toolsBody`** — Track 3 says
instruction order was load-bearing and had to be hoisted. It is literally the
opening characters of the template string:

```
toolsBody: `- Three things need the person's word before you do them, and this
step is important. One: a step marked (important) recorded as missed. Two: any
call to escalate_to_next_of_kin. Three: anything at all when you cannot tell
which step they mean. …
```

`lib/check-in-prompt.ts` is **identical to `HEAD`**, so Track 3's "needed no
change" is true.

---

## What did not reproduce, and what is overstated

**N1 — `make eval` is not a reliably green gate.** One run in two exited 2 here.
The quality is real; the reliability is not established. §`make eval`.

**N2 — "Latency 15–35s per letter" understates the tail.** Ten samples, three
outside the band, one at 300+ seconds. §`make eval`.

**N3 — `14-…md` §6 and R6 were already false when written.** That document says
the French prompt hands the red flag to the agent in English, and cites
`grep -n "Fr" lib/check-in-prompt.ts → no matches`. That grep has four matches
today, and the file has been **unmodified since `1df20a3` (2026-07-26 01:57)** —
27 minutes _before_ `14-…md` was written at 02:24:

```
lib/check-in-prompt.ts:101   locale === "fr" && flag.triggerFr !== null && flag.actionFr !== null
lib/check-in-prompt.ts:102     ? `- [${flag.id}] (fr) ${flag.triggerFr} → ${flag.actionFr}`
```

Read off the wire tonight:

```
locale=en :  2 "breathless, feverish or confused again"   1 "essoufflé"
locale=fr :  1 "breathless, feverish or confused again"   2 "essoufflé"  2 "de nouveau confus"
```

Track 4 recorded R4 as "reproduced" and was right to; what neither document says
is that **nobody broke this and nobody fixed it — it was never broken.**

**N4 — the remaining French gap is a _schema_ gap, not a data gap.** Track 4
calls `purposePlain` having no French "a data gap in the bundle". It is not
fixable in the bundle: `lib/plan/schema.ts` carries **only** `triggerFr` and
`actionFr`, on red flags. There is no `purposePlainFr` field to fill. A French
patient will hear and read English for every medication purpose, and that cannot
change without unfreezing the schema.

**N5 — Track 2's red-flag halving is an English-only result.** The 273 → 153px
claim reproduces exactly at 390×844 in English. In French the same tint measures
**365px** — 2.4× the English, because of the D7 dual render — and the first
tickable dose row sits at **812px against an 844px fold**, 32px of margin.
Track 2's table reports only the English number. `14-…md`'s R5 ("`/plan` opens on
an alarm") is closed in English and **open in French**.

| `/plan`, measured tonight | tint  | grey strip | card total | first tickable row | fold  |
| ------------------------- | ----- | ---------- | ---------- | ------------------ | ----- |
| phone 390×844 **EN**      | 153px | 149px      | 301px      | 565px              | 844px |
| phone 390×844 **FR**      | 365px | 148px      | 512px      | **812px**          | 844px |
| desktop frame 1440 **EN** | 153px | 172px      | 324px      | 673px              | 882px |
| desktop frame 1440 **FR** | 365px | 172px      | 536px      | **971px**          | 882px |

The last row is below the fold. Today's _heading_ is at 873px in the French frame
— above the 882px fold by **9px**, not the 25px Track 2 reports — but the first
row you can actually tap is not.

**N6 — a correction to my own first reading.** My initial malformed-body sweep
printed empty bodies for `/api/log`, `/api/escalate` and `/api/remind`. That was
my shell quoting, not the app. Re-run with `curl -i`, all three return
`{"error":"invalid_arguments","detail":"…"}` correctly. **Track 4's Bug 2 claim
is fully reproduced**; the drift was mine.

**Where the tracks were straight, and should be credited:** the schema really is
frozen and I proved the bundle still validates against it; the `oneOf` rewrite
really is lossless and I proved it from the generated schema rather than from the
argument; the arc's family assertion really does discriminate and I could not
make it pass on a state it should fail; every one of Track 3's six prompt fixes is
in the tree in both languages; and Track 4's demo-badge finding — the one that
retires a PASS in two earlier documents — is exactly as bad as reported.

---

## Anything I fixed

**Nothing.** I found no defect I could prove broken that was inside my remit to
change, and I am not going to manufacture one.

The two candidates I considered and deliberately left alone:

1. **`scripts/eval-extraction.ts` has no explicit fetch timeout**, so a slow
   extraction is reported as `extraction failed` with undici's opaque
   `fetch failed`. The harness's _behaviour_ is correct — loud, non-zero, names
   the letter. Only the diagnosis is imprecise. Changing an eval harness's
   timeout semantics hours before a demo, on my own judgement, is a worse trade
   than writing it down.
2. **`lib/env.ts:10` still says of `NEXT_PUBLIC_PORTICO_MODE`: _"the UI has to
   render it, because a demo mode you cannot see is indistinguishable from a
   lie."_** The UI does not render it. That comment is now false. But the two
   ways to make it true are (a) restore the badge — a product decision in another
   track's tree, explicitly out of bounds, or (b) edit the comment — which would
   delete the strongest piece of evidence a human has when making decision (a).
   **Left in place on purpose.** It is the loudest surviving argument for putting
   the badge back.

---

## Residual risk — what remains unproven

Ordered by what a presenter could say tonight that the build cannot back up.

**🔴 R1 · Nothing on screen says this is demo mode, in either language.**
Independently reproduced and worse than Track 4 measured — 0 hits across `/`,
`/plan`, `/upload`, `/check-in`, `/check-in/summary`, `/family` and `/operator`,
in **English and French**. `components/demo-mode-badge.tsx` was deleted in
`5cbaca9`. In demo mode **any** uploaded letter yields Harold Whitfield's plan.
The remaining disclosures are `extraction.modelId: "seed/02-whitfield"` inside the
stored bundle and `"mode":"demo"` in the `/api/extract` response — neither is on
screen. **A presenter must not say "the app tells you it is in demo mode."**
Restoring it or briefing around it is a two-minute human decision and it is still
open.

**🔴 R2 · The live voice call has still never been run, by anyone.** Track 3
tested the agent over text through the `agent-testing` API — real, valuable, and
explicitly not a substitute. Nobody has started a session, heard the TTS, or
confirmed the agent's Security tab permits the four session overrides in use. A
disallowed override closes the socket 1008 and paints a banner where Portico
should be talking, on the hero beat.

**🔴 R3 · `make eval` is not a green gate you can lean on.** One run in two failed
here. If a judge asks to see it run, budget for it failing, and know the honest
answer: the model's quality is measured and excellent; its _latency_ is not
bounded, and the harness gives up at five minutes.

**🟠 R4 · The three remote ElevenLabs mutations are unverified by anyone but the
track that made them.** `asr.keywords`, the `end_check_in` description and the
`prompt_injection` guardrail were read back by Track 3 and by nobody since. That
is 5b's surface; somebody should do it before filming.

**🟠 R5 · The French `/plan` still opens on an alarm.** The tint is 365px of an
844px phone (43%) and the first tappable dose row is at 812px — 32px above the
fold on the phone, and **below** the fold in the desktop frame. If the French take
exists, scroll before rolling.

**🟠 R6 · The French voice will still say English clinical words** — but not the
red flag, which is now French. `purposePlain` and the instruction text have no
French and **cannot**, because the frozen schema has no field for them.

**🟡 R7 · `make e2e` remains unverified tonight** and still destroys `.e2e/`,
which now holds four screenshot sets. Nobody should run it before filming without
backing that directory up.

**🟡 R8 · Live-mode drug lookup serves one baked verdict.** `resolveSlug`
short-circuits to the committed fixture in live mode, and `enoxaparin` is marked
`absent` there, so a live patient on enoxaparin is told the NHS A-Z does not list
it without the A-Z being consulted. Unreachable tonight; live the moment the demo
bundle changes.

**🟡 R9 · The arc's family assertion still depends on JSX attribute order.**
`id` must stay the first attribute on both `<h2>`s in `escalation-card.tsx`. More
stable than a class list, but the same class of coupling.

**🟡 R10 · The camera path has never been extracted, by anyone.** Five text-layer
PDFs is the whole corpus.

**🟢 R11 · Track 2's before/after deltas are verified only at the "after" end.**
Reverting to measure the "before" was out of bounds.

### What a presenter must not claim on camera

1. "The app tells you it's in demo mode." **It does not.** R1.
2. "It read your letter." In demo mode it did not read _any_ letter. The code is
   honest three ways; the narration is where this becomes a lie.
3. "`make eval` is green." It is green on ~half the runs measured tonight. Say
   "every family we scored, scored 100% across 52 cells, on four independent
   letters" — that is both stronger and true.
4. "It takes about 20 seconds a letter." Median 28s, worst observed 5 minutes.
5. "The voice agent has been tested end to end." It has been tested over **text**,
   thoroughly. No audio has ever been produced or heard.
6. "5 letters, 100%." Whitfield's gold labels authored the seed. **Four** letters
   are independent evidence, and the harness prints that sentence itself.

---

## Environment left behind

`:3001` — the live-mode worktree server — **killed**, confirmed down. The
worktree at `/Users/haidertoha/Code/juno-hack-t1` is untouched: `git status`
there shows the same five modified files it had when I arrived.

`:3000` is **up, in demo mode, and seeded**:

```
GET /                     -> 200
GET /api/demo/clock       -> {"today":"2026-07-27"}
GET /api/demo/check-in    -> {"raisedAt":null}
GET /api/demo/reminder    -> {"reminders":[],"raised":null}
/family heading           -> "A dose that matters was missed twice."

POST /api/seed →
{"patientId":"demo","today":"2026-07-27",
 "letters":["letters/demo/02_Whitfield_Harold_Pneumonia.pdf"],
 "plan":"seed/02-whitfield","medications":7,"redFlags":1,
 "missed":{"itemId":"med-apixaban","days":["2026-07-26","2026-07-25"]},
 "clearedLogDays":["portico:log:demo:2026-07-25","portico:log:demo:2026-07-26"]}
```

Exactly the state Tracks 3 and 4 recorded leaving behind.

`.e2e/` is intact — all four screenshot sets survive; the five throwaway scripts I
ran from there were deleted. No source file was edited. `.env` and `.env.local`
were not modified. Nothing was committed, pushed, checked out, stashed or
restored. The only file this track wrote is this one.
