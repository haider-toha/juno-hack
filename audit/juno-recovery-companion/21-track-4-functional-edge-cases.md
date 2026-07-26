# 21 — Track 4: functional edge cases and state persistence

Date: 2026-07-26. Branch `docs/demo-qa-guide`, working tree (uncommitted, and
carrying Track 2's UI pass). This track had write access to `scripts/**`, the
`Makefile`, and to `lib/**` / `app/api/**` only where a bug was first proved
with a failing test.

Skills invoked before starting: `/typescript-best-practices`,
`/nextjs-app-router-patterns`.

**Verdict in one line:** the state layer is real. The escalation is computed
from a log two different writers agree on, and the clock, the log, the ring, the
nudge and the language all survive a reload and a second reader — I could not
find a computation that lies. Three prior claims do not survive re-verification:
**`make arc` has had three assertions that could not pass since 02:51 tonight**
(fixed here; the "21 passed, 0 failed" in `todo.md` and `16-…md` is stale),
**two POST routes still answered a malformed body with a bare 500** (fixed
here), and **the demo-mode badge no longer exists anywhere in the app**, which
retires beat 10 of both `14-…md` and `16-…md` and removes one of the three
disclosures R2 rests on.

---

## Scope

What this track owned, and what it did with it.

| Owned                                         | What happened                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `scripts/demo-arc.sh`                         | One function fixed — `family_says()`. See §Bug 1                                         |
| `scripts/demo-state.ts` **(new, 15 steps)**   | HTTP + Redis harness: does the state survive a second request. `make state`              |
| `scripts/demo-ui-edges.ts` **(new, 4 steps)** | Playwright harness for the four behaviours that only exist in a browser. `make ui-edges` |
| `Makefile`                                    | Two additive targets, `state` and `ui-edges`. Nothing existing was changed               |
| `app/api/demo/clock/route.ts`                 | Malformed body → named 400 instead of a bare 500. See §Bug 2                             |
| `app/api/demo/log/route.ts`                   | Same fix, same reason                                                                    |

Nothing else was edited. `lib/plan/schema.ts`, `lib/check-in-prompt.ts`,
`lib/extraction/**`, `lib/env.ts`, the `persona` / `checkInPrompt` dictionary
keys and everything Track 2 touched under `app/(phone)/**` and `components/**`
were read but never written. No dependency was installed, `package.json` was not
opened, `make format` was not run repo-wide, and nothing was committed.

Everything below was reproduced against the dev server on `:3000` in
`NEXT_PUBLIC_PORTICO_MODE=demo`, re-seeding immediately before any run whose
result is reported.

---

## Re-verification · the beat tables

Every row of `14-…md`'s beat table and `16-…md`'s beat table, re-run rather than
re-read. "Reproduced" means I got the same answer tonight, from the same kind of
evidence.

| #   | Beat (as written in `14`/`16`)               | Tonight                                                            | How                                                                |
| --- | -------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | Seed from cold; `clearLog()` total reset     | **Reproduced**, and made harder                                    | `make state` step 1 — [§R1](#reproduction-notes)                   |
| 2   | Home story, both plan states                 | **Reproduced (mechanism)**                                         | `make state` step 15; `make e2e` steps 2, 7                        |
| 3   | Upload / scan affordance reaches Blob        | **Reproduced**, with a real PDF                                    | `make e2e` step 6; opening-shot probe — [§R2](#reproduction-notes) |
| 4   | Plan: real Redis timeline, tick persists     | **Reproduced**                                                     | `make e2e` step 5; `make state` step 6                             |
| 5   | Incoming check-in flips phone, no reload     | **Reproduced**, and measured properly — [§R3](#reproduction-notes) | 8 phase-randomised browser samples                                 |
| 6   | Voice prompt carries this patient's plan     | **Reproduced (payload only)** · audio still **untestable**         | `make arc` beats 7·1–2; `make ui-edges` step 3                     |
| 6b  | French red flag reaches the agent in French  | **Reproduced**                                                     | `essoufflé` ×2 in the `fr` payload — [§R4](#reproduction-notes)    |
| 7   | `/api/log`, `/api/escalate`: 401/200/422/400 | **Reproduced**, all 12 of Track 3's rows                           | `make state` step 7                                                |
| 7b  | A real agent invokes the deployed tools      | **Not testable here** — needs the ElevenLabs workspace             | —                                                                  |
| 8   | Family escalation is computed, not painted   | **Reproduced**, and I could not fake it either                     | `make state` steps 4, 5 — [§R5](#reproduction-notes)               |
| 9   | Operator controls write real state only      | **Reproduced**                                                     | `make state` asserts `/operator` re-reads the store in 5 places    |
| 10  | Demo badge on every on-camera screen         | **DOES NOT REPRODUCE** — the badge no longer exists                | [§R6](#reproduction-notes). This is the headline finding           |
| 11  | D9 boundary: live mode refuses demo routes   | **Not testable** — a second dev server was out of bounds           | Static check only — [§R7](#reproduction-notes)                     |
| 12  | Repo hygiene                                 | **Reproduced with one drift**                                      | [§R8](#reproduction-notes)                                         |
| 13  | French audio                                 | **Not testable** — human ear, human mic                            | —                                                                  |
| —   | `make arc` → **21 passed, 0 failed**         | **DOES NOT REPRODUCE** — it was 18 passed, 3 failed                | [§Bug 1](#bug-1--three-arc-assertions-could-not-pass)              |

### Reproduction notes

<a id="reproduction-notes"></a>

**R1 · the seed is a total reset.** `make state` step 1 parks the clock on
`2026-08-10`, writes a miss on `2026-08-09` — a day no backwards window from the
seeded `today` could reach — and then seeds. The seed names the key it removed
and the store is left holding exactly the two primed days:

```
POST /api/demo/clock {"day":"2026-08-10"}   → {"today":"2026-08-10"}
POST /api/demo/log   med-apixaban 2026-08-09 missed
POST /api/seed       → clearedLogDays includes portico:log:demo:2026-08-09
SCAN portico:log:demo:*                     → 2026-07-25, 2026-07-26   ← exactly the seed
GET  /api/demo/clock                        → {"today":"2026-07-27"}   ← clock reset too
```

**R2 · the opening shot, end to end.** The literal on-camera procedure, driven
in a browser with the real file control and the real fixture PDF:

```
DELETE /api/demo/plan  → {"plan":null,"today":"2026-07-27","keptLogDays":["2026-07-25","2026-07-26"]}
empty home leads with  : ["portico.","Portico","English"]  → "Take a photo or upload a PDF"
setInputFiles 02_Whitfield_Harold_Pneumonia.pdf
  → navigated to /plan in 4.08s
/plan opens with       : ["Your recovery plan","Home since Saturday 25 July","Get help if"]
/family after upload   : the alert push banner is rendered, so assess() is alert-kin
```

**R3 · the check-in flip is 0–5s, not 3.1s.** `14-…md` impeached its own three
samples as phase-correlated (L5) and was right to. Eight samples with a
randomised 0–5s offset before the ring, so the phase is decorrelated:

```
  sample 1: offset 1.15s → flip 4.36s        sample 5: offset 3.73s → flip 1.34s
  sample 2: offset 4.98s → flip 0.27s        sample 6: offset 3.31s → flip 1.92s
  sample 3: offset 3.32s → flip 1.83s        sample 7: offset 1.04s → flip 4.35s
  sample 4: offset 4.31s → flip 0.94s        sample 8: offset 2.09s → flip 3.35s

  n=8  min 0.27s  median 1.92s  max 4.36s
```

Consistent with a uniform 0–5s poll window plus a render. **The runbook's
"budget 5 seconds, not 3" is the right instruction and this is the measurement
behind it.**

**R4 · the French red flag.** Read off the wire under `Cookie: portico_locale=fr`:

```
$ curl -sS -H 'Cookie: portico_locale=fr' localhost:3000/check-in \
    | grep -oE 'essoufflé|breathless' | sort | uniq -c
   1 breathless
   2 essoufflé
```

The French is there. `lib/check-in-prompt.ts` is another track's file and was
being edited while this ran, so treat this as a spot check, not a guarantee.

**R5 · the family screen still cannot be made to lie.** Re-ran Track 3's four
probes plus a fifth:

```
GET /family?kind=alert-kin&assessment=alert-kin
  → "A dose that matters was missed twice."    (unchanged: FamilyPage() takes no arguments)
grep '"alert-kin"' over app/ lib/ components/
  → lib/escalation/rules.ts                    PRODUCED
    components/family/escalation-card.tsx      consumed
    app/(phone)/family/page.tsx                consumed (chooses whether to show the push banner)
```

Three files now, not two — but still exactly one producer. The new consumer at
`app/(phone)/family/page.tsx:47` reads `assessment?.kind === "alert-kin"` to
decide whether the push banner renders; it writes nothing. The fifth probe is
new: **two missed doses of a `standard`-class medicine must nudge, never
alert.** `make state` step 4 drives metformin to two misses inside the window and
asserts `/family` reads "A dose was missed." A rule that had degraded to "two
misses of anything" would pass every assertion in `make arc` and fail this one.

**R6 · the demo badge is gone.** This does not reproduce, and it is the finding
that matters most to whoever narrates the film.

```
$ for p in / /plan /check-in /family /check-in/summary /operator; do
    printf '%-20s %s\n' "$p" "$(curl -sS localhost:3000$p | grep -c 'Demo mode')"; done
/                    0
/plan                0
/check-in            0
/family              0
/check-in/summary    0
/operator            0

$ grep -rn 'DemoModeBadge\|Demo mode' app components   # excluding source comments
(nothing)
```

`components/demo-mode-badge.tsx` was deleted in `5cbaca9 "feat(ui): streamline
upload and thin the recovery plan"` (2026-07-26 02:24), whose own message says
"remove demo-mode badges". `14-…md` measured 5/5 at 02:24 — it was true when
measured and has been false since the same minute. The component it deleted
carried this comment:

> Demo mode is legitimate, but only while it is visible: a mode you cannot see
> on screen is indistinguishable from a lie.

And `lib/env.ts:10` still says of `NEXT_PUBLIC_PORTICO_MODE`:

> Public by design: **the UI has to render it**, because a demo mode you cannot
> see is indistinguishable from a lie.

Nothing in the patient-facing UI renders it. The only surface that names the
mode is `/operator`, which is not part of the product and is not on camera.
**I did not restore it** — `lib/env.ts` and Track 2's component tree were both
out of bounds, the removal was a deliberate product decision in a commit, and
putting a badge back would change what the demo shows, which this track was told
not to do. It is written up as a human decision in §Residual risk.

**R7 · the D9 live-mode boundary.** Not testable: Next 16 refuses a second
`next dev` from the same directory, and the sibling worktree belongs to another
track. What is checkable statically is that every handler on every demo route
opens with the shared guard, which is the thing `16-…md` had to infer for one
route:

```
app/api/demo/check-in/route.ts     3 refuseOutsideDemo() calls,  3 handlers
app/api/demo/clock/route.ts        2 calls,  2 handlers
app/api/demo/log/route.ts          1 call,   1 handler
app/api/demo/plan/route.ts         1 call,   1 handler
app/api/demo/reminder/route.ts     3 calls,  3 handlers
app/api/seed/route.ts              its own mode check, first statement
```

10 of 10 demo handlers call the shared guard as their first statement, and
`/api/seed` carries its own equivalent — 11 in all, none unguarded. That is a
stronger static basis than `16-…md` had, and still not an observation.
**Somebody must run `NEXT_PUBLIC_PORTICO_MODE=live` once against these routes
before anyone calls beat 11 proven.**

**R8 · repo hygiene, with one drift.** `pnpm typecheck` and `pnpm lint` are both
clean (§Checks). The grep sweep reproduces except for raw hex:

```
dvh / vh inside app/(phone)   3 hits, all three inside comments        clean
: any / as any / <any>        1 hit, the word "any" inside a dictionary sentence   clean
backdrop-blur                 0                                        clean
font-mono / <code / <pre      1 hit, the comment in operator/page.tsx explaining its absence   clean
raw hex in app/ + components/ 35 hits across 5 files                   DRIFT
```

`14-…md` recorded raw hex as clean bar `themeColor` and the orb. The 35 hits now
are: `components/language-picker.tsx` (26 — the inline national-flag SVGs),
`app/icon.tsx` and `app/apple-icon.tsx` (6 — generated favicons),
`components/voice/orb.tsx` (2 — the sanctioned gradient) and `app/layout.tsx`
(1 — `themeColor`). Flags and favicons are arguably outside "colour is semantic
tokens", but CLAUDE.md names exactly one sanctioned exception and this is now
three. Cosmetic; recorded so the next sweep is not surprised.

---

## Re-verification · lies and overstatements (L1–L9)

| ID     | The claim in `14-…md`                                        | Tonight                                                                                                                                      |
| ------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1** | Track 2's residual risk #1 is stale — the seed does clear it | **Reproduced.** §R1 above, with a forward-dated key 14 days out                                                                              |
| **L2** | `/api/log` non-JSON body is a bare 500                       | **Does not reproduce** — fixed since; now `400 invalid_arguments`. But the same defect survived on two other routes. See §Bug 2              |
| **L3** | The runbook cannot wire `tool_ids`                           | **Not testable** here                                                                                                                        |
| **L4** | G8's HTTPS claim cites the wrong docs                        | **Not testable** here                                                                                                                        |
| **L5** | The 4.56s flip figure is one sample, not a measurement       | **Reproduced and closed.** §R3 gives the distribution: min 0.27s, median 1.92s, max 4.36s over 8 phase-randomised samples                    |
| **L6** | "extraction … OpenAI" is a false sentence in the docs        | **Still true of `tasks/plan.md`** — 6 hits, and `lib/extraction/extract.ts:16` reads `const MODEL_ID = "claude-haiku-4-5"`                   |
| **L7** | One arc assertion cannot fail (`clock moves a day`)          | **Fixed since** — `demo-arc.sh:52` now asserts the date it should land on. I then found **three** assertions that could not PASS. See §Bug 1 |
| **L8** | "Good afternoon." is hardcoded, not time-derived             | **Reproduced.** `lib/i18n/en.ts:32`, `lib/i18n/fr.ts:21`; no `getHours` anywhere in `app/`, `components/` or `lib/`                          |
| **L9** | `/family` names the next of kin on a screen with no plan     | **Reproduced.** With the plan cleared: "Next of kin on the letter: Daughter" above "No recovery plan has been loaded yet."                   |

---

## Re-verification · residual risks (R1–R12)

| ID      | Risk                                                     | Tonight                                                                                                                                           |
| ------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1**  | The live voice call has never been run                   | **Not testable** here. Another track owns the ElevenLabs surface tonight                                                                          |
| **R2**  | The narration, not the code, is where this becomes a lie | **Worse than reported.** The code disclosed it three ways; one of the three — the on-screen badge — is gone. §R6                                  |
| **R3**  | Server tools cannot fire from localhost                  | **Not testable** here                                                                                                                             |
| **R4**  | Live extraction is dead (no `ANTHROPIC_API_KEY`)         | Out of scope; another track owns extraction tonight                                                                                               |
| **R5**  | `/plan` opens on an alarm                                | Track 2 halved the red tint (273px → 153px) in this same tree; not re-measured here                                                               |
| **R6**  | The French take will hear English clinical words         | Red flag now French (§R4); `purposePlain` and the instruction text still carry no French — a data gap in the bundle                               |
| **R7**  | The incoming card can take a full 5 seconds              | **Reproduced and quantified.** §R3                                                                                                                |
| **R8**  | The clock and the assessment window interact             | **Reproduced, and now a test.** `make state` step 5 walks it: seed → alert-kin, +1 day → nudge, +2 days → none, back → alert-kin                  |
| **R9**  | A non-JSON body returns a bare 500                       | **Reproduced on two routes that were never fixed**, and fixed here. §Bug 2                                                                        |
| **R10** | NHS scrape artifacts in the open disclosure              | **Reproduced.** `doxycycline`: `"…prescribed dose of doxycycline You can call 111 or get help from 111 online ."` — missing break, floating space |
| **R11** | `/family` and `/operator` are unauthenticated            | **Reproduced.** No auth exists anywhere in the build                                                                                              |
| **R12** | Secret compare is not timing-safe; greeting hardcoded    | **Both reproduced.** `!==` at `app/api/log/route.ts:38`, `escalate/route.ts:33`, `remind/route.ts:24`. Greeting per L8                            |

---

## New tests

Two harnesses, both in the established shape: a plain `.ts` file run by `node`
(Node 26 strips types natively), no test runner, no app imports — everything
either learned over HTTP or read straight out of Redis, so a harness that
imported `assess()` could not end up asserting the function against itself.

### `make state` — `scripts/demo-state.ts`, 15 steps

What each step proves. The recurring shape is **write through one route, read
back through a different one, on a later request** — which is the only thing
that separates stored state from an optimistic render.

| #   | Step                                                                         | What only this catches                                                                                                       |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | The seed leaves exactly the state it names, and nothing else                 | A reset that clears a window instead of scanning; a check-in left ringing between takes                                      |
| 2   | The demo clock persists, and moves backward as well as forward               | A **negative** `shiftDays` — the panel's "−1 day" button, a path `make arc` never exercises                                  |
| 3   | A clock moved before the discharge date is named, not faked                  | `/plan` rendering the opening days as the near term when today is off the plan                                               |
| 4   | `assess()` escalates on two misses inside the window and nowhere else        | Two misses **outside** the window; one in / one out; a `standard`-class medicine escalating to the next of kin               |
| 5   | Moving the clock past the window drops the escalation, and back restores it  | R8, as a test rather than a warning                                                                                          |
| 6   | An answer written by any of the three writers survives to the next request   | Idempotency — three answers about one dose leave one field, not three; a voice write invisible on `/plan`                    |
| 7   | The tool routes refuse what they should, by name                             | All 12 of Track 3's `/api/log` + `/api/escalate` rows, plus `/api/remind`'s clock-format refusal                             |
| 8   | Every POST route answers a malformed body with a named error, not a bare 500 | §Bug 2. This step went red first, then green                                                                                 |
| 9   | Drug guidance keeps its four states, and its scope line, apart               | "no urgent advice" collapsing into "not listed"; the two 404s collapsing into one sentence                                   |
| 10  | A device on the plan is not a medicine the A-Z is missing                    | The `device` and `absent` branches, which the seeded bundle cannot reach — the harness writes a plan that does, then reseeds |
| 11  | The letter behind a red flag is a real PDF, and only this patient's          | The scope guard; the `private, no-store` header; that the bytes really start `%PDF`                                          |
| 12  | The language choice survives a reload, and never half-translates             | A showcase locale in the cookie producing half a Welsh screen; `Accept-Language: cy` doing the same                          |
| 13  | The raised check-in is real state with a TTL, and the seed clears it         | The 15-minute expiry, which no route exposes and no screen shows                                                             |
| 14  | The dose nudge is a scheduled reminder, rung and cleared                     | Dismissing the banner deleting the reminder behind it; the seed leaving an evening nudge armed                               |
| 15  | `clear-letter` keeps the history, and a fresh extraction lands back on it    | The whole opening shot, including that `/family` escalates off history the cleared plan never touched                        |

```
$ make state
Driving http://localhost:3000 in demo mode

    Step                                                                          Result
 1  The seed leaves exactly the state it names, and nothing else                  pass
 2  The demo clock persists, and moves backward as well as forward                pass
 3  A clock moved before the discharge date is named, not faked                   pass
 4  assess() escalates on two misses inside the window and nowhere else           pass
 5  Moving the clock past the window drops the escalation, and back restores it   pass
 6  An answer written by any of the three writers survives to the next request    pass
 7  The tool routes refuse what they should, by name                              pass
 8  Every POST route answers a malformed body with a named error, not a bare 500  pass
 9  Drug guidance keeps its four states, and its scope line, apart                pass
10  A device on the plan is not a medicine the A-Z is missing                     pass
11  The letter behind a red flag is a real PDF, and only this patient's           pass
12  The language choice survives a reload, and never half-translates              pass
13  The raised check-in is real state with a TTL, and the seed clears it          pass
14  The dose nudge is a scheduled reminder, rung and cleared                      pass
15  clear-letter keeps the history, and a fresh extraction lands back on it       pass

All 15 steps passed. The app is left seeded.

wall clock: 24.21s
```

It leaves the app seeded, so it is safe to run immediately before a take.

### `make ui-edges` — `scripts/demo-ui-edges.ts`, 4 steps

The behaviours that only exist in a browser and that `make e2e` walks past.

1. **A tick whose write fails says so, and leaves nothing behind.** The Server
   Action is intercepted and aborted, so `logStep` rejects for real. Asserts the
   "Not saved. Tap again." chip appears, that the tick **unwinds to what was
   last recorded** (`task-check.tsx`'s own comment, now tested), that a reload
   shows nothing was written, that the retry persists, and — the discriminator —
   that a **successful** write shows no chip.
2. **The dose nudge rings the phone from another screen, and clears when
   dismissed.** The reminder is written by the agent's `schedule_reminder` tool,
   not by the harness. Asserts the banner appears on `/` without a reload, links
   to `/plan#dose-med-apixaban` rather than the top of the plan, and that
   dismissing clears the ring in the store while **keeping the reminder behind
   it**.
3. **Changing language on the check-in screen re-renders all of it, and what the
   agent will say.** A real mid-flow switch through the picker's Server Action.
   Asserts no English chrome survives, `<html lang>` follows, the choice
   outlives a navigation, and — the part that would otherwise be missed — that
   the agent's server-composed opening line changes too, so a French reader does
   not get an English greeting.
4. **A language Portico cannot speak never quietly becomes the interface
   language.** The showcase panel must be wholly in-language, must **not** set
   the cookie, and its two endonym buttons must land somewhere real.

```
$ make ui-edges
    Step                                                                                        Result
 1  A tick whose write fails says so, and leaves nothing behind                                 pass
 2  The dose nudge rings the phone from another screen, and clears when dismissed               pass
 3  Changing language on the check-in screen re-renders all of it, and what the agent will say  pass
 4  A language Portico cannot speak never quietly becomes the interface language                pass

All 4 steps passed. The app is left seeded.

wall clock: 14.51s
```

**Negative control.** A green harness proves nothing until you have seen it go
red. Step 1 was re-run with `route.abort("failed")` swapped for
`route.continue()`, so the write succeeds and the failure path is never taken:

```
  A tick whose write fails says so, and leaves nothing behind … FAIL

FAILED  A tick whose write fails says so, and leaves nothing behind
      locator.waitFor: Timeout 10000ms exceeded.
      - waiting for getByRole('alert').filter({ hasText: 'Not saved. Tap again.' }).first() to be visible
```

The scratch copy was deleted afterwards.

---

## Bugs found and fixed

### Bug 1 — three arc assertions could not pass

<a id="bug-1--three-arc-assertions-could-not-pass"></a>

Track 2 handed this over in `19-…md` and asked for it to be reproduced rather
than believed. It reproduces exactly.

**Failing, from a clean re-seed:**

```
$ make arc
3 · escalation, from the seeded misses
  FAIL  family escalates to next of kin
        expected: missed twice
        got:
4 · escalation clears when the misses are answered
  FAIL  one answered miss drops it to a nudge
        expected: A dose was missed
        got:
  FAIL  both answered clears it
        expected: Nothing needs your attention
        got:

18 passed, 3 failed
```

**Cause, confirmed at the source rather than inferred.** `family_says()` grepped
for `<h2 class="font-display text-xl font-semibold tracking-tight text-ink">`.
`c6986ef "feat(ui): ship Portico brand, letter view, and demo shell polish"`
(2026-07-26 **02:51**) added `aria-labelledby` to the card and an `id` to its
heading, and React emits props in source order:

```
$ git show c6986ef -- components/family/escalation-card.tsx | grep -E '^[-+].*(h2|aria-labelledby|id=)'
+      aria-labelledby="family-assessment"
-      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
+            <h2
+              id="family-assessment"
+          <h2
+            id="family-assessment"

$ curl -sS localhost:3000/family | grep -oE '<h2[^>]*>[^<]*'
<h2 id="family-assessment" class="text-xl font-semibold leading-snug text-ink">A dose that matters was missed twice.
```

Two things were wrong, not one. The `id` now sits before the `class`, so the
pattern cannot match; and the alert branch never carried `font-display` or
`tracking-tight` at all, so the pattern could only ever have matched the calm
branch even before the `id` arrived.

**Judgement about intended behaviour.** The function's own comment says "the
escalation card's heading is the whole claim of the family screen, so the arc
asserts on that". That is the right intent and it is kept. The wrong part was
keying it on a Tailwind class list that differs per branch and changes with any
visual pass. The load-bearing, per-branch-identical hook is the `id` that the
card's own `aria-labelledby` points at — if that changes, the accessible name of
the whole section breaks and it should break the arc too. The fix reads the
heading text out of that element, and names the absence instead of returning an
empty string, because a blank `got:` is precisely what let three silent failures
read as a green arc in two documents:

```bash
family_says() {
  local heading
  heading="$(curl -sS "$BASE/family" \
    | grep -oE '<h2 id="family-assessment"[^>]*>[^<]*' \
    | sed 's/.*>//' | head -1)"
  echo "${heading:-(no escalation heading on /family)}"
}
```

**Proof it is not merely looser.** An assertion that matches anything is worse
than one that fails, so the fixed reader was driven through all four states of
the screen, including one where the card does not exist at all:

```
alert-kin  -> A dose that matters was missed twice.
nudge      -> A dose was missed.
none       -> Nothing needs your attention.
no plan    -> (no escalation heading on /family)          ← negative control
```

Four inputs, four distinct outputs, and the fourth is the one the old pattern
could not tell from the other three.

**Passing:**

```
3 · escalation, from the seeded misses
  PASS  family escalates to next of kin
4 · escalation clears when the misses are answered
  PASS  one answered miss drops it to a nudge
  PASS  both answered clears it

21 passed, 0 failed
```

### Bug 2 — two POST routes answered a malformed body with a bare 500

**Failing.** `make state` step 8 went red on its first run, before anything was
changed:

```
FAILED  Every POST route answers a malformed body with a named error, not a bare 500
      POST /api/demo/clock with a body that is not JSON should be a client error, not a server one
      observed: HTTP 500 (empty body)
```

The full sweep across every POST route in the app:

```
── before the fix ──
/api/demo/clock          not-json  -> HTTP 500  body=
/api/demo/log            not-json  -> HTTP 500  body=
/api/demo/reminder       not-json  -> HTTP 409  body={"error":"no_reminder_scheduled"}
/api/log                 not-json  -> HTTP 400  body={"error":"invalid_arguments", …}
/api/escalate            not-json  -> HTTP 400  body={"error":"invalid_arguments", …}
/api/remind              not-json  -> HTTP 400  body={"error":"invalid_arguments", …}
/api/extract             not-json  -> HTTP 400  body={"message":"That request did not name a patient …"}
/api/blob/upload         not-json  -> HTTP 400  body={"message":"That is not a Vercel Blob upload request."}
/api/demo/clock          {day:""}  -> HTTP 500  body=
```

This is R9 / L2. `16-…md` beat 7 records it as **PASS (was PASS-with-defect)**
— and that is true of the two routes Track 3 measured. The identical defect was
never fixed on `app/api/demo/clock/route.ts:25` and
`app/api/demo/log/route.ts:29`, both of which read
`Input.parse(await request.json())` with no `.catch`.

**Judgement about intended behaviour.** Three sibling routes carry an explicit
statement of the intent, at `app/api/log/route.ts:42`:

> The read is inside the boundary it is validated at. A body that is not JSON at
> all is the same client mistake as JSON of the wrong shape, and has to reach
> the same named 400 — an unhandled throw here is a bare 500 with an empty body,
> which tells whoever is debugging the tool call nothing.

That is five routes doing it one way and two doing it another, so the two are
the drift. It is not defensive programming either: a request body is a genuinely
uncertain input at a trust boundary, which is the case CLAUDE.md explicitly
carves out. And both paths are reachable on the night, not theoretically:

- `components/operator/clock-control.tsx:42` binds an `<input type="date">`. A
  browser hands back `""` for a cleared or half-typed date, and pressing **Set**
  posts `{"day":""}` — the bare 500 above.
- `make miss ITEM=… DAY=…` and `make clock DAY=…` build their bodies by shell
  interpolation, so a typo arrives as JSON the schema refuses.

And the surface it fails onto is `components/operator/control.tsx:11`, whose own
comment is: "It shows the response body verbatim. On a night when a beat does
not fire, the operator needs the actual reason on screen, not a green tick." An
empty body is the one thing that defeats it.

**The fix**, the established four lines, in both routes:

```ts
const parsed = Input.safeParse(await request.json().catch(() => null));
if (!parsed.success) {
  return Response.json(
    { error: "invalid_arguments", detail: parsed.error.message },
    { status: 400 },
  );
}
const input = parsed.data;
```

**Passing:**

```
── after the fix ──
/api/demo/clock          not-json   -> HTTP 400  body={"error":"invalid_arguments","detail":"[…invalid_union…]"}
/api/demo/log            not-json   -> HTTP 400  body={"error":"invalid_arguments","detail":"[…expected object…]"}
/api/demo/clock          {day:""}   -> HTTP 400  body={"error":"invalid_arguments","detail":"[…invalid_format…]"}
/api/demo/log            {itemId:1} -> HTTP 400  body={"error":"invalid_arguments","detail":"[…expected string…]"}
-- the clock is unmoved by the refusals --
{"today":"2026-07-27"}
-- a good write still works --
{"today":"2026-07-28"}
{"today":"2026-07-27"}
```

`make state` step 8 now sweeps all eight POST routes against three malformed
bodies each (`not json at all`, empty, `{"unclosed": `) plus two wrong-shaped
ones, and asserts a 4xx **with a non-empty parseable body** every time — so the
drift cannot come back quietly.

---

## `make arc` — the true figure and the stopwatch

**The true pass/fail count is 21 passed, 0 failed, after the fix in §Bug 1.
Before it, on the tree as I received it, it was 18 passed, 3 failed.**

`tasks/todo.md:55`, `todo.md:619` and `16-…md`'s "Evidence on disk" table all
say **21 passed, 0 failed**. That was true when written — `demo-arc.sh` reached
21 checks in `1df20a3` (01:57) and both documents were written at 02:24 — and
became false at **02:51**, when `c6986ef` landed. `19-…md` is right that it "has
not been for some time"; the window is 27 minutes after the claim was made.
**The orchestrator should correct both documents.**

**The stopwatch (B14).** Five consecutive runs, `date +%s.%N` bracketing the
whole `make arc` invocation, against a warm dev server:

```
  run 1:   4.29s   21 passed, 0 failed
  run 2:   3.90s   21 passed, 0 failed
  run 3:   5.75s   21 passed, 0 failed
  run 4:   3.89s   21 passed, 0 failed
  run 5:   4.88s   21 passed, 0 failed

  min 3.89s   median 4.29s   max 5.75s
```

The runbook's "~5s" is right. Note what it is and is not: it is the arc's own
wall clock, **not** the 60-second film budget, and **not** the "budget 5 seconds"
in `todo.md`'s Before-filming item 7 — that one is the check-in ring latency,
which is a different number and is measured in §R3 (0.27–4.36s over 8 samples,
uniform 0–5s plus a render).

B14's other half — **a stopwatched rehearsal of the take itself against the 60s
limit** — is still not done. Nothing in this track times a human. It remains
open.

The two new harnesses, for planning purposes: `make state` 24.2s, `make ui-edges`
14.5s (it launches a browser). Neither belongs in the pre-take ritual; `make arc`
does.

---

## Checks

All run after the last edit, on the working tree as left.

```
$ pnpm typecheck
$ tsc --noEmit
(no output, exit 0)

$ pnpm lint
$ eslint .
(no output, exit 0)

$ pnpm exec prettier --check scripts/demo-state.ts scripts/demo-ui-edges.ts \
    app/api/demo/clock/route.ts app/api/demo/log/route.ts
Checking formatting...
All matched files use Prettier code style!
```

`scripts/demo-arc.sh` and `Makefile` are not formats Prettier has a parser for;
it errors on them rather than passing them, so they are excluded by necessity
rather than by choice. Repo-wide `make format` was **not** run.

```
$ make arc
21 passed, 0 failed
wall clock: 5.47s
```

---

## Grounding notes

One external lookup, to settle whether a finding was "unestablished" or actually
false.

**Is rivaroxaban on the NHS medicines A-Z?** Fetched
`https://www.nhs.uk/medicines/rivaroxaban/`. It returned a live page titled
_"Rivaroxaban: a medicine to help prevent blood clots - NHS"_, first heading
_"Rivaroxaban"_. So the drug **is** on the A-Z. That turns the demo-mode lookup
finding below from "a claim we have not established" into "a sentence that is
false", which is why it is written up rather than shrugged at.

No other web search was run. Everything else in this document came from the
running app, from Redis, or from `git`.

---

## Residual risk

Ordered by what a presenter could say that the build cannot back up.

**🔴 1 · Nothing on screen says this is demo mode.** §R6. The badge was deleted
in `5cbaca9`; `14-…md` beat 10 and `16-…md` beat 10 both claim 5/5 patient
screens and both are now wrong. `lib/env.ts:10`'s own comment — "the UI has to
render it, because a demo mode you cannot see is indistinguishable from a lie" —
describes a thing the app no longer does. In demo mode **any** uploaded letter
yields Harold Whitfield's plan; the remaining disclosures are
`extraction.modelId: "seed/02-whitfield"` on the stored bundle and
`mode: "demo"` in the `/api/extract` response, neither of which is on screen.
**A presenter must not say "the app tells you it is in demo mode."** This is a
human decision, not something this track could fix inside its bounds: either put
the badge back deliberately (a UI change in another track's tree, plus two
dictionary keys), or accept it and narrate the shortcut aloud. **Deciding is a
two-minute job and only a human can do it.**

**🟠 2 · Beat 11 (the live-mode boundary) is still inferred, not observed.**
§R7. All 10 demo handlers open with the shared guard and `/api/seed` carries its
own, which is a stronger static basis than `16-…md` had for the one route it
inferred — but no live-mode server was run tonight. Somebody should start one
once and curl all eleven, `DELETE /api/demo/plan` and the three
`/api/demo/reminder` verbs included.

**🟠 3 · Demo mode tells a patient a drug is "not in the NHS medicines A to Z"
whenever the committed fixture has not heard of it.** `lib/drugs/lookup.ts:114`
returns `{ kind: "absent" }` for any drug not in `fixtures/nhs-drug-map.json`,
and `absent` renders as _"This medicine is not in the NHS medicines A to Z."_
That conflates "we never read this drug" with "the A-Z does not list it" — the
exact distinction the rest of that file is architected around, and the thing its
own `MIN_INDEX_SLUGS` comment calls "the one thing a drug lookup must never
invent." Demonstrated by putting a plan drug outside the fixture:

```
map carries 22 drugs; rivaroxaban in the map? false
GET /api/drug-info?patientId=demo&name=…  → {"kind":"absent"}
/plan renders "This medicine is not in the NHS medicines A to Z": true
```

and rivaroxaban **is** on the A-Z (§Grounding notes). **It is unreachable
tonight** — demo mode always serves the Whitfield bundle and all seven of its
medicines are in the fixture, which `make state` step 9 pins. I did not change
it: fixing it properly needs new copy for a fourth reading, which is a change to
what demo mode serves and outside this track's brief. It becomes live the moment
anyone edits the demo plan or adds a second bundle.

**🟡 4 · `/api/demo/reminder` treats an unreadable body as no arguments.** Its
`.catch(() => ({}))` at `route.ts:38` is load-bearing — the operator's button
posts no body at all — but it cannot tell "no body" from "a body I could not
read", and answers both by firing the first scheduled reminder. Never a 500,
never wrong on the panel's own path. Left alone: distinguishing them means
reading the raw text, and it is not a proven defect.

**🟡 5 · `make e2e` still wipes `.e2e/` entirely**, including both screenshot
sets. It was backed up and restored around the run in this document
(211 files, verified by count and size before and after), but the next person
will lose them unless they do the same.

**🟡 6 · A live mid-call language switch is untested.** `make ui-edges` step 3
switches language on `/check-in` while the page is mounted and proves the screen
and the agent's opening line move together — but not during an open ElevenLabs
session. Whether the socket survives the layout revalidation, and whether
`endSession()` is reached, needs a real call and a microphone.

**🟡 7 · Nobody has stopwatched a take.** §`make arc`. B14's harness half is
done and measured; its rehearsal half is not.

**🟢 8 · Raw hex has drifted to three sites** where the audit set records one
sanctioned exception. §R8. Flags and favicons; cosmetic.

**🟢 9 · Stale sentences remain.** `tasks/plan.md` still says extraction is
OpenAI in 6 places (L6), and `tasks/todo.md` + `16-…md` still claim 21/21
(§`make arc`). Both are documents a judge might read.

---

## What a human or the orchestrator must still do

1. **Decide the demo badge.** §Residual risk 1. Restore it, or brief the
   presenter never to claim the app discloses demo mode. Nobody else can make
   this call.
2. **Correct `tasks/todo.md`** — line 55 and Before-filming item 6 both say
   `make arc` is 21/21. It is 21/21 **again**, as of this track, but it was 18/3
   for the whole window in between, and the claim should carry the fix rather
   than the coincidence.
3. **Run one live-mode server once** and curl the six demo routes, so beat 11
   stops being an inference.
4. **Run `make state` and `make ui-edges` after any further UI pass.** They are
   the two harnesses that would have caught tonight's arc breakage, because they
   key on ids and accessible names rather than on class lists.

---

## Environment left behind

`:3000` is up, in demo mode, and **seeded** — `make arc`, `make state` and
`make ui-edges` all re-seed on the way out and the last thing run was
`make arc`:

```
GET /api/demo/clock       → {"today":"2026-07-27"}
GET /api/demo/check-in    → {"raisedAt":null}
GET /api/demo/reminder    → {"reminders":[],"raised":null}
/family heading           → "A dose that matters was missed twice."

SCAN portico:*  (excluding the NHS cache)
  portico:demo:today
  portico:log:demo:2026-07-25
  portico:log:demo:2026-07-26
  portico:patient:demo
  portico:plan:demo
  (+ 20 nhs cache keys)
```

Exactly the seeded state, and exactly what `14-…md` recorded leaving behind.

Files changed by this track, all uncommitted:

```
 M Makefile                       two additive targets, state and ui-edges
 M app/api/demo/clock/route.ts    §Bug 2
 M app/api/demo/log/route.ts      §Bug 2
 M scripts/demo-arc.sh            §Bug 1, family_says() only
?? scripts/demo-state.ts          new
?? scripts/demo-ui-edges.ts       new
```

`.env` and `.env.local` were not modified. `.e2e/` was backed up before
`make e2e` and restored byte-for-byte afterwards. No dependency was installed,
`package.json` and `pnpm-lock.yaml` were not opened, `make format` was not run
repo-wide, no other track's worktree was entered, and nothing was committed or
pushed.
