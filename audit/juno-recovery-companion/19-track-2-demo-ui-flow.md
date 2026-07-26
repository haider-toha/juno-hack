# 19 · Track 2 — the demo-mode flow, end to end

Reading this as: **the same task app for a frightened 78-year-old**, two passes
after `13-…md` built it — so the job was not to redesign anything but to walk
every screen demo mode can reach, count what it costs a patient to get anywhere,
and take out whatever was charging them twice.

The product owner's brief was one sentence long: **use whitespace, hierarchy and
typography to carry meaning instead of extra sentences. Do not add new
explanatory text blocks.** Nothing below adds a sentence. Six were removed or
shortened, one was moved, and two screens were re-ranked so the layout says what
the deleted sentence used to.

`13-…md` and `16-…md` are the prior art and none of their decisions were
re-opened. Two of the residual risks they filed are closed here, and both are
named as such.

---

## Scope

Owned: `app/(phone)/**`, `components/plan/**`, `components/upload/**`,
`components/family/**`, `components/phone/**`, `components/voice/**`,
`components/letter/**`, `components/language-picker.tsx`,
`components/portico-wordmark.tsx`, `components/back-button.tsx`,
`components/icons.tsx`, `components/button-styles.ts`, `app/globals.css`, and
the **UI copy keys** of `lib/i18n/en.ts` / `fr.ts` (the `persona` and
`checkInPrompt` objects are Track 3's and were not touched).

Not touched, by instruction: `lib/plan/schema.ts`, `lib/plan/samples/`,
`lib/extraction/**`, `lib/env.ts`, `app/api/**`, `scripts/**`, `Makefile`,
`package.json`, `lib/check-in-prompt.ts`. No dependency was added; nothing was
committed.

`app/globals.css` was read and left alone — no new token was needed, which is
the point.

---

## The flow map

Everything demo mode can reach, what each screen offers, and what it costs.
"Taps" counts from a cold app open on `/` with a seeded plan, and counts the tap
that opens the app as zero.

| Screen                        | What it offers                                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (no plan)                 | Language picker · **one** 112px upload control (camera or file picker, in place) · privacy note                                                      |
| `/` (plan stored)             | Language picker · **one** filled button "Start today's check-in" · quiet rows: recovery plan, family view, add another letter · privacy              |
| `/` with a push up            | Either banner overlays the shell: incoming check-in → `/check-in`, dose nudge → `/plan#dose-…`. Each has its own dismiss                             |
| `/plan`                       | Back · red-flag card (quote, provenance strip, NHS disclosure) · **Today** card with per-row ticks · days ahead · "More on your plan" · earlier days |
| `/plan` → More on your plan   | Follow-ups · As needed · Changed in hospital                                                                                                         |
| `/plan` (no plan)             | Back · "No plan yet" · one sentence · the same upload CTA, routed to `/`                                                                             |
| `/plan` (clock outside range) | "Today is not on this plan" card, then the plan's opening days, nothing tickable                                                                     |
| `/letter?patientId&flag`      | Back · the letter page the quote lives on, at readable size, opened centred on a highlighted sentence                                                |
| `/check-in` (idle)            | Back · language · orb · title + one line · **Start talking** · Type instead                                                                          |
| `/check-in` (ringing)         | Same shell; "Incoming check-in" label, "Portico — your check-in", **Answer**                                                                         |
| `/check-in` (live)            | Back · language · transcript · red-flag card when the agent shows one · **chip strip** · orb / status line · composer with end button                |
| `/check-in/summary`           | Back · what the tools noted today, one row per step · nudge line if one is set · See my plan · Done                                                  |
| `/family`                     | Back · next of kin off the letter · today's date · the `assess()` card (`none` / `nudge` / `alert-kin`) · push stand-in on alert                     |
| `/language?locale=…`          | Wholly in-language "not yet" panel, two endonym buttons out. 404 on anything that is not a showcase locale                                           |
| `/operator`                   | Laptop desk, outside the phone group, never linked from the product                                                                                  |

### Tap counts, before and after

| Outcome                                          | Before                                                     | After                             | What changed                                                                |
| ------------------------------------------------ | ---------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| See today's plan                                 | 1                                                          | 1                                 | Unchanged; **41px more of today's card is on the first screen** (see below) |
| Log a dose from home                             | 2                                                          | 2                                 | Unchanged                                                                   |
| **Log a dose from the dose nudge**               | 2 taps **+ scroll and hunt** among 7 rows                  | **2 taps, row already on screen** | Banner deep-links `/plan#dose-<itemId>`; today's rows are addressable       |
| **Answer "have you taken it?" without speaking** | tap Type instead / composer, **type a sentence**, tap Send | **1 tap**                         | Answer chips (B12's UI half)                                                |
| Open a red flag's source                         | 2 — **and the quoted line rendered under 5px tall**        | 2, **and it is legible**          | Letter viewer renders at a readable width and opens centred on the quote    |
| Reach `/family`                                  | 1                                                          | 1                                 | Unchanged                                                                   |
| Switch language                                  | 2                                                          | 2                                 | Deliberately unchanged (see "What was not changed")                         |
| Start a check-in                                 | 2                                                          | 2                                 | Deliberately unchanged — the mic gesture rule forbids collapsing it         |
| Read what the NHS says                           | 2                                                          | 2                                 | Unchanged                                                                   |
| Reach follow-ups / as-needed / ward changes      | 2                                                          | 2                                 | Unchanged                                                                   |

**The honest headline:** the arc's navigation was already close to minimal, and
inflating a "before" number to claim a saving would be dishonest. Exactly one
path collapsed on taps — and it is the one that matters most, because it is the
only path on the check-in screen that does not go through speech recognition
that **has never been exercised end to end in this build** (`16-…md` residual
risk 2). The other two wins are not tap counts: a destination that took two taps
and delivered nothing now delivers, and a nudge that used to drop the patient at
the top of a plan now drops them next to the medicine it named.

### What moved above the fold

Measured off the rendered DOM (`.e2e/measure.ts`) and off the baseline PNGs by
sampling the `error-soft` and `lavender` fills down the middle column
(`.e2e/pixels.ts`), not by eye.

| Measure, `/plan` at 390×844               | Before | After     |
| ----------------------------------------- | ------ | --------- |
| Red **tint** (the alarming block itself)  | 273px  | **153px** |
| Red-flag card overall (tint + grey strip) | 339px  | 301px     |
| Top of today's card                       | 518px  | **477px** |
| Top of the first tickable dose row        | ~604px | 563px     |

In the desktop iPhone frame (the one that gets filmed) the card is 324px and
today's first dose row sits at 671px against an 882px fold.

**In French** — where `16-…md` residual risk 6 recorded that the D7 dual render
pushes today below the fold at both viewports — today's heading is now at 724px
on the phone (fold 844) and 857px in the frame (fold 882). It is above the fold
on both, though in the frame only just. That risk is closed at the phone
viewport and marginal in the frame.

---

## Grounding notes

**The two design skills, and what each actually contributed.**

- `/web-design-guidelines` was fetched live from
  `vercel-labs/web-interface-guidelines`. Four of its rules drove real changes:
  _"Handle empty states — do not render broken UI for empty data"_ and
  _"Icon-only buttons require aria-label"_ against the check-in summary's rows;
  _"Deep-link all stateful UI"_ and _"Add scroll-margin-top to heading anchors"_
  against the dose nudge; _"Prefer semantic HTML before ARIA"_ against the
  wordmark's `aria-label` on a bare `<span>`; and its `overscroll-behavior:
contain` rule against the letter viewer's new pan box. Its
  `prefers-reduced-motion` and focus-visible rules were used as the regression
  floor, not as new work — both were already satisfied.
- `/design-taste-frontend` is written for landing pages, so most of it does not
  apply and was not forced to. Three parts did: **§4.9** _"Long lists need a
  different UI component, not a longer list"_ and its explicit
  "scroll-snap/pill" alternative, which is what turned the four full-width
  suggestion rows into a wrapping pill strip; **§4.4** _"use cards only when
  elevation communicates real hierarchy"_, which is the argument for the
  red-flag card's tint/strip split; and **§9.G**, which bans the em-dash in
  visible copy — two of the strings I rewrote carried one, and both lost it as a
  side effect of being shortened. Its dials were **not** applied: `13-…md`
  already set this product at variance 2 / motion 2 / density 2, which is the
  inverse of that skill's baseline, and it says itself that every rule in it is
  contextual.
- `/nextjs-app-router-patterns` confirmed the shape already in the repo rather
  than changing anything: Server Components by default, the one client boundary
  at `voice-session.tsx`, `force-dynamic` on the Redis-backed routes. The new
  `ChipRow` is a plain function imported by that boundary and carries no
  directive of its own, matching the rule `CLAUDE.md` states for
  `components/voice/`.

**No web search was run beyond fetching the guidelines**, because the questions
this pass raised were all answerable against the running app.

**Three things were established empirically rather than assumed.**

1. **A fragment link into `/plan` scrolls on a fresh load and not on a soft
   navigation.** `page.goto("/plan#dose-med-apixaban")` parks the row 16px from
   the top of the scroll region; the same link tapped from the banner on `/`
   leaves the scroll position at 0. `/plan` has a `loading.tsx`, so the
   navigation commits on the skeleton and Next has no element to scroll to. The
   link is still worth having (it is exact on a reload, and it costs one optional
   prop) but the reason the beat works is the shorter red-flag card, not the
   fragment. This is stated here rather than quietly claimed.
2. **The letter's quote was rendering at about 5 CSS pixels.** Fit-to-column on
   a 390px phone puts an A4 page at scale 0.58, and the letter's body type is
   ~8pt. Measured after the fix: the highlight box is 22px tall and 339px wide.
3. **`make arc`'s three family assertions have been failing since before this
   pass**, and not because of anything here — see "Handed off".

---

## What changed, file by file

Every entry ends with the banned-pattern check that was run against it. The
sweep behind those verdicts is `.e2e/sweep.ts`: it walks `/`, `/plan`,
`/check-in`, `/check-in/summary`, `/family`, `/letter` and `/language` at 390 and
1440, **in both locales**, and reports monospace, `text-transform: uppercase`,
five-letter block capitals, `backdrop-filter`, background gradients, any
`<a>`/`<button>`/`<summary>` under 44px, any keyboard stop that resolves to no
outline, and horizontal overflow. Final run: **16 findings, all 16 the orb's
radial gradients on `/check-in`**, which `CLAUDE.md` names as the one sanctioned
exception. Nothing else.

### `components/plan/red-flag-card.tsx` — the tint says one thing now

The card claimed a safety property in its own header comment — the doctor's
words primary, everything Portico added visibly secondary — and then printed
four of Portico's own sentences on the same red tint. The tint now carries the
clinician's trigger, the clinician's action and a phone number worth ringing,
**and nothing else**. The grey strip underneath carries the provenance: that the
letter names nobody to call, the trail back to the page, and the NHS disclosure.
`Recipients` renders nothing at all when there is no one to ring, because "we do
not have a number" is not an action.

Nothing was deleted. The e2e harness asserts the exact sentence _"Your letter
does not say who to contact for this."_ inside the flag section, and it is still
there, at `text-sm` on the strip, where it is provenance instead of instruction.

Why it matters more than 38px: the **red area halved**, 273px → 153px. On a
screen where colour is the only thing that works before reading, the red block
now means one thing.

_Banned check:_ no new colour (existing `error-soft` / `mist` tokens), radii
`rounded-card` / `rounded-b-card` only, structure from the existing 1px `rule`
hairlines, no shadow added, no gradient, no `backdrop-blur`, no icon added. Both
new rows clear 44px.

### `components/letter/letter-viewer.tsx` — "see where it says that" now shows it

Fit-to-column rendered the whole page at 0.58 scale, so the sentence the whole
screen exists to prove was three or four pixels of grey. The page now renders at
`READABLE_WIDTH` (900px, or the column if wider) inside a pan box that fills what
the phone shell gave the page — `min-h-0 flex-1 overflow-auto overscroll-contain`
— and the first highlight is scrolled to the centre of the box on both axes, so
the pan starts on the words and not on the letterhead.

Two side effects worth naming: `behavior: "smooth"` was dropped from
`scrollIntoView`, so the reveal is instant and needs no reduced-motion
exemption; and the status lines (loading / failed / not-found) moved outside the
pan box so a failure is not something you have to scroll to find.

_Banned check:_ no `dvh`/`vh` anywhere in the new markup — the box is
`min-h-0 flex-1`, and the frame still owns the height. `rounded-tactile` only. No
gradient, no blur. The highlight keeps the existing `bg-accent/40` token wash.

### `components/voice/chip-row.tsx` (new) + `voice-session.tsx` — B12's UI half

`components/voice/suggested-questions.tsx` is deleted. It rendered up to four
full-width 52px rows, each with an icon square and a chevron, under a visible
"Suggested questions" heading — about 200px of an 844px phone to say four
things — and it vanished the moment the patient said anything, taking the only
non-speech affordance with it.

`ChipRow` is one wrapping strip of pill buttons above the composer, and it
changes job rather than disappearing: **openings until the first user turn, then
the two answers a check-in actually turns on** — "I have taken it" / "I have not
taken it yet", and in French "Je l'ai pris" / "Je ne l'ai pas encore pris". That
is the tappable bilingual answer chip half of B12, and it is the only path on
that screen that does not depend on speech recognition this build has never
exercised.

The heading strings survive as the list's `aria-label` rather than as visible
text: a row of tappable sentences does not need a label saying it is one. One
surface, one purpose at a time — two chip strips stacked over the input would be
the clutter this replaced.

Honest about what it does: tapping a chip sends the sentence as a user turn, the
same as saying it. It does not write to the log itself. The agent's `log_step`
tool still decides that, so no new claim is made anywhere.

_Banned check:_ `rounded-pill` for a capsule, exactly as `CLAUDE.md` prescribes;
1px `rule` hairline border, `bg-mist` fill; `min-h-11`; `transition-colors
duration-150 ease-out`; the two icons the old rows carried are gone, and
`IconChat` was deleted from `components/icons.tsx` with them because nothing else
used it.

### `app/(phone)/check-in/summary/page.tsx` — one fact, once

Every unanswered row carried an `aria-hidden` empty ring **and** a "Not covered"
chip: the same fact twice, once in a shape that looks like a control that does
not work. The ring is gone for the `null` case, which is the rule
`components/plan/task-row.tsx` already states in its own comment ("a mark only
where there is something to mark"). The chip stays, because it is the one a
screen reader gets. `StatusMark`'s prop type lost the `unanswered` string it
never read.

_Banned check:_ no colour, radius, shadow or motion change; `divide-y` between
rows only, never the `border-t`-plus-`border-b`-on-every-row pattern.

### `app/(phone)/page.tsx` — the empty home stops asking

"How are you doing today?" leads into the check-in and is right on the seeded
home. On the empty home it asks a question the screen cannot take an answer to,
and puts two lines between the greeting and the only control. It is not rendered
there. The string is untouched and still used on the seeded home.

_Banned check:_ nothing added; one conditional around an existing paragraph.

### `components/phone/dose-nudge-banner.tsx` + `plan/task-row.tsx` + `plan/day-section.tsx`

The nudge names one medicine and used to open the top of the plan. It now opens
`/plan#dose-<itemId>`, and today's rows carry that id (`anchorId`, set only when
`isToday` — two cards claiming the same id would send the reader to whichever the
browser found first) with `scroll-mt-4`. Exact on a fresh load; a no-op on the
soft navigation from the banner, where the row is on the first screen anyway.

_Banned check:_ no visual change to the row at all.

### `components/phone/push-banner.tsx` — the one target under the floor

The dismiss button was 36px. It is the only control on a card that lands
unannounced over whatever the reader was doing, and it was the single ≥44px
violation the sweep found anywhere in the app. Now `size-11` at `top-1 right-1`,
inside the `pr-12` the banner already reserved. A11 is ticked in `tasks/todo.md`;
this is the last thing that made that tick untrue.

_Banned check:_ same `rounded-pill`, same tokens, same 150ms transition.

### `components/portico-wordmark.tsx` — the name is a text node now

`aria-label` sat on a plain `<span>`, which maps to role `generic`; the accname
spec does not name that role from `aria-label`, so the lockup was one browser
away from having no accessible name. The proper noun is now a real `sr-only`
text node beside the `aria-hidden` lowercase lockup. The visible mark is
byte-identical.

This also fixed a **pre-existing** `make e2e` failure — step 2 asserts
`innerText` contains "Portico", and the visible mark is lowercase. That step went
from FAIL to pass without touching the harness.

_Banned check:_ visible rendering unchanged.

### `lib/i18n/en.ts` + `fr.ts` — six strings out, three in

Surgical `Edit` calls only, never `Write`, with a fresh read before each one,
because Track 3 is editing the `persona` / `checkInPrompt` objects in the same
files. Nothing inside those two objects was read from or written to.

| Key                 | Before                                                                                                                    | After                                                     | Why                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `home.letterHint`   | "Your hospital discharge letter. Photograph every page, or upload the PDF."                                               | "Every page of your discharge letter."                    | The 112px button above it already says "Take a photo or upload a PDF". Only "every page" was new information.    |
| `plan.emptyBody`    | "Your recovery plan is built from your discharge letter. Take a photo of it, or upload the PDF, and it will appear here." | "Your recovery plan is built from your discharge letter." | Same button, directly underneath. "It will appear here" is what a plan screen promises by existing.              |
| `plan.anyTimeBlurb` | "When you need them — not on a set day."                                                                                  | **deleted**                                               | The heading is "As needed". Also carried an em-dash.                                                             |
| `plan.changedBlurb` | "What the ward altered about your usual medicines, in their words."                                                       | "In the ward's own words."                                | The heading is "Changed in hospital"; only the verbatim part was not already said.                               |
| `plan.earlierDays`  | "Earlier days. You can still tick anything you took."                                                                     | "Earlier days"                                            | A section label, not an instruction. Today's card already says what a ring is for, and these cards are the same. |
| `home.checkInBlurb` | "A short voice chat about today."                                                                                         | **deleted**                                               | Unused since home was rebuilt.                                                                                   |
| `redFlag.nhsSource` | "From the NHS website"                                                                                                    | **deleted**                                               | Unused.                                                                                                          |
| `suggestions.*`     | —                                                                                                                         | `answersHeading`, `taken`, `notYet` added, en + fr        | The answer chips. French authored, not machine-translated.                                                       |

Net: **five visible sentences removed or halved, two dead keys deleted, three
short strings added for a control that replaces typing.** No new explanatory
block anywhere, per the brief.

_Banned check:_ the sentences that remain hold the house copy rules — no
negative contractions, no block capitals, numerals for numbers. The two em-dashes
that were in visible copy are gone.

### What was **not** changed, and why

- **`/check-in` is still two taps from home, and stays that way.** Collapsing it
  would mean starting the session from home, and `CLAUDE.md` is explicit: the
  `getUserMedia → fetchSignedUrl → startSession` chain must stay inside the
  direct tap and must never cross a router transition. Home is a Server
  Component. The second tap is the price of Safari granting the microphone.
- **The language picker is still two taps.** One-tap toggling would only work
  because there are two real locales today; the picker deliberately lists eight,
  filters out the active one and marks no default (B2's Bilingual Technology
  Toolkit reasoning). A toggle would undo a settled decision to save one tap on a
  beat that is not on the critical path.
- **The family push banner still overlays `/family`'s title.** It covers the back
  button and the `<h1>` until dismissed. That is what an iOS notification does,
  the escalation card underneath is fully visible, and the banner is a demo
  **beat** — removing or re-flowing it would change what the demo shows, which is
  outside this brief. Filed as residual risk instead.
- **The empty home still centres its control in the column**, leaving space above
  and below. `13-…md` weighed exactly this and chose centring over a
  top-anchored CTA; removing the subtitle does not change that argument.
- **Earlier plan days are still demoted by position, not by a `<details>`.**
  `13-…md` established that a closed disclosure empties `innerText` and would
  fail the doxycycline assertion in `scripts/e2e-demo.ts`, which is not mine to
  edit. Still true.
- **`app/globals.css` was not touched.** No change here needed a new token.

---

## Verdicts and evidence

### Screenshots

Both sets were produced by `.e2e/track2-shots.ts` (written for this pass; it
lives under `.e2e/` because that directory is gitignored and because
`scripts/**` is off-limits to this track). It drives the demo state between
shots through the product's own routes — seed, clear-letter, ring, unring,
`/api/remind`, raise nudge, log, clock — so every reachable state is
photographed in one run, at **390×844 and 1440×900**, and it re-seeds at the end
whatever the run did.

```
OUT=.e2e/ui-before-track2 node .e2e/track2-shots.ts          # baseline, en
OUT=.e2e/ui-after-track2 FR=1 node .e2e/track2-shots.ts      # after, en + fr
```

| Set                                                         | Contents                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `.e2e/ui-before-track2/` — 50 PNGs, English                 | The baseline, before any edit. 25 states × 2 viewports                 |
| `.e2e/ui-after-track2/` — 100 PNGs, English **and** French  | After. The same 25 states × 2 viewports × 2 locales (`fr-` prefixed)   |
| `.e2e/probe-letter.png`, `probe-chips-openings/answers.png` | The three behaviours that needed a live session or a live PDF to prove |

The prior tracks' sets — `.e2e/ui/` (18) and `.e2e/i18n/` (22) — were backed up
and restored around `make e2e` too, and are intact.

Named states in each set: `home`, `home-empty`, `home-incoming`,
`home-dose-nudge`, `plan-top`, `plan-today`, `plan-grouped`, `plan-scrolled`,
`plan-empty`, `plan-shifted` (after `clock`), `red-flag`, `red-flag-nhs`,
`letter-source`, `check-in-idle`, `check-in-incoming`, `check-in-empty`,
`check-in-summary`, `check-in-summary-nudge`, `check-in-summary-empty`,
`family-alert`, `family-nudge` (after answering one miss), `family-shifted`,
`family-empty`, `language-showcase`, `operator` — each prefixed `phone-` /
`desktop-`, and in the after set additionally `fr-phone-` / `fr-desktop-`.

Every screenshot named in the "before/after" claims above was opened and looked
at as an image, not listed.

### Harnesses

`make e2e` — **10 of 10 pass.** Step 2 was failing before this pass (see the
wordmark entry) and now passes.

```
 1  The seed primes the demo, and refuses in live mode      pass
 2  Home offers the two ways in                             pass
 3  /plan renders the seeded timeline                       pass
 4  The red-flag card traces back to the letter             pass
 5  A tick is optimistic and survives a reload              pass
 6  home upload takes a photo or a PDF                      pass
 7  /plan with no plan shows the named empty state          pass
 8  /plan holds up on a phone and inside the desktop frame  pass
 9  Nothing renders in mono or in block capitals            pass
10  The console and the network stayed clean                pass

All 10 steps passed.
```

> `make e2e` **wipes `.e2e/` entirely**, including both screenshot sets. They
> were backed up and restored around this run. Re-run `.e2e/track2-shots.ts`
> after any future `make e2e`.

`make arc` — **18 passed, 3 failed, and all three failures are pre-existing and
not in this track's files.** See "Handed off" below.

### Accessibility and banned-pattern sweep

`node .e2e/sweep.ts`, seven routes × two viewports × two locales:

```
16 findings — all 16 are the orb's radial gradients on /check-in
```

No monospace, no CSS uppercase, no block capitals, no `backdrop-filter`, no
under-44px target, no keyboard stop without a focus ring, no horizontal
overflow, in either language at either width. `prefers-reduced-motion` is
untouched and still a wildcard sweep in `app/globals.css`; the only motion added
is a 150ms `transition-colors` on the chips, which that sweep already covers, and
the letter viewer's scroll lost its `smooth` behaviour. `grep` for `dvh` / `vh` /
`h-screen` under `app/(phone)` and `components` returns only the four comments
that say not to use them.

### Tree checks

```
$ pnpm typecheck
$ tsc --noEmit

$ pnpm lint
$ eslint .

$ pnpm exec prettier --check <the 15 files this track touched>
Checking formatting...
All matched files use Prettier code style!
```

All three clean, no output. Repo-wide `make format` was **not** run — other
agents are mid-edit, so only this track's own files were formatted.

---

## Handed off

**To Track 3 (or whoever owns `lib/check-in-prompt.ts`).** One suggestion, not a
change — that file was not touched:

> The prompt now has a UI counterpart it does not know about. Two answer chips
> sit above the composer for the whole conversation and send the literal strings
> **"I have taken it" / "I have not taken it yet"** in English and **"Je l'ai
> pris" / "Je ne l'ai pas encore pris"** in French. If the prompt told the model
> that a bare answer of that shape refers to **the dose it last asked about**,
> the tap would be unambiguous even when the transcript has drifted. Today the
> model has to infer the referent. This matters more than it looks: these chips
> are the only path on that screen that does not go through speech recognition,
> which `16-…md` records as never having been exercised end to end.

**To the human — a real bug found on the way, in a file this track may not
edit.** `make arc` reports three failures in sections 3 and 4:

```
3 · escalation, from the seeded misses
  FAIL  family escalates to next of kin        expected: missed twice      got:
4 · escalation clears when the misses are answered
  FAIL  one answered miss drops it to a nudge  expected: A dose was missed  got:
  FAIL  both answered clears it                expected: Nothing needs …    got:
```

They are **not** a regression from this pass. `scripts/demo-arc.sh`'s
`family_says()` greps for `<h2 class="…"`, but `components/family/escalation-card.tsx`
puts `id` before `className`, so React renders `<h2 id="family-assessment"
class="…">` and the pattern can never match — for any of the three assessment
branches. Verified against the running app:

```
$ curl -sS localhost:3000/family | grep -oE '<h2[^>]*class="[^"]*"[^>]*>[^<]*'
<h2 id="family-assessment" class="text-xl font-semibold leading-snug text-ink">A dose that matters was missed twice.
```

`escalation-card.tsx`, `app/(phone)/family/page.tsx` and `scripts/demo-arc.sh`
are all unmodified since `HEAD`, so this predates tonight. The fix is one
character class in `scripts/demo-arc.sh` — `<h2[^>]*class="` — plus dropping the
`font-display …` half of the pattern, which only ever matched the calm branch.
`scripts/**` is outside this track's ownership, so it is reported rather than
patched. **`tasks/todo.md` and `16-…md` both claim `make arc` is 21/21; it is
not, and has not been for some time.**

**Also for the human, smaller:** `home.greeting` is still the hardcoded string
"Good afternoon." at every hour, as `tasks/todo.md` already notes. Left alone
because making it time-derived is a behaviour change, not a UI one.

---

## Residual risk

1. **The family push banner covers `/family`'s back button and `<h1>` until it
   is dismissed.** Judged a beat, not a defect, and left alone — but on a 390px
   phone the daughter's first view of that screen has no title on it. If someone
   decides the title matters more than the notification landing in place, the
   cheap fix is to render that one banner in normal flow rather than absolutely,
   which costs a variant on `PushBanner`.
2. **The `#dose-…` fragment does not scroll on the in-app soft navigation** from
   the nudge banner, because `/plan` commits its `loading.tsx` first. The row is
   on the first screen anyway, so the beat works — but if that card ever grows
   again, the deep link will not save it.
3. **`/letter` now pans.** The page is drawn at 900px inside a ~342px column, so
   a reader has to drag sideways to finish a long line. The highlighted sentence
   opens centred, which is the case that matters, but this has only been seen
   under Playwright's synthetic scrolling and a mouse — **not with a real
   thumb**. Momentum scrolling inside a nested `overflow-auto` on iOS Safari is
   the specific thing worth checking before filming.
4. **Nothing here has been seen on a real phone.** Every measurement is Chromium
   at 390×844 with `deviceScaleFactor: 2`. The `lg:` bezel, status bar and home
   indicator are demo chrome and are absent below 1024px, so the real device is
   the 390px column plus whatever the OS draws — which is the viewport that was
   measured, but not the renderer.
5. **The answer chips have never been tapped in a connected session.** Headless
   Chromium cannot open the ElevenLabs socket, so the strip was photographed in
   the `Not connected` state, where the chips render disabled at 40% opacity. The
   render, the state switch at the first user turn and the `ask()` path are all
   proven; a real call sending the chip text to a live agent is not.
6. **French `/plan` in the desktop frame is 25px from losing today's heading
   again.** 857px against an 882px fold. Any growth in the red-flag card, the
   D7 dual render or the header puts it back below the bezel.
7. **`.e2e/ui-before-track2` and `.e2e/ui-after-track2` are destroyed by
   `make e2e`.** Same caveat `13-…md` filed for `.e2e/ui/`.
8. **The demo state was left seeded** (`POST /api/seed`, ringing cleared, nudge
   cleared) by the shot harness's own teardown and again by hand at the end of
   this pass, so the shared `demo` key space is clean for the next track.
