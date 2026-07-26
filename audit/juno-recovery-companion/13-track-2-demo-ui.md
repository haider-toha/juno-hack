# 13 · Track 2 — Demo UI hierarchy

Reading this as: **a task app for a frightened 78-year-old two days out of
hospital**, with a **calm, large-type, one-action-per-screen** language, built
entirely on the repo's existing `@theme` tokens. No design system imported, no
new font, no new visual vocabulary.

The dials this brief implies are the inverse of the ones `/haider-design-taste`
defaults to: variance 2 (a confused person needs the same shape every time),
motion 2 (120–200ms, opacity and translate only), density 2 (a "focused moment"
surface, where whitespace is earned). What was taken from that skill is its
restraint and its token discipline — not its 36px-row Linear density.

---

## Scope

Every patient-facing screen had to answer three questions in two seconds: **what
is this screen · what is the ONE thing to do next · what can wait.**

Files changed (all within Track 2's ownership):

| File                                 | Why                                                       |
| ------------------------------------ | --------------------------------------------------------- |
| `app/(phone)/page.tsx`               | Home rebuilt around the demo arc                          |
| `app/(phone)/upload/page.tsx`        | Instruction → action → explanation                        |
| `app/(phone)/plan/page.tsx`          | Header compressed                                         |
| `components/plan/timeline.tsx`       | Today first, past days demoted to the foot                |
| `components/plan/day-section.tsx`    | Today's card enlarged; a future day cannot show an answer |
| `components/plan/task-check.tsx`     | The tick reads as a control                               |
| `components/plan/task-row.tsx`       | Missed doses say "Missed"                                 |
| `components/plan/red-flag-card.tsx`  | Reads as "get help", not as a card                        |
| `components/upload/upload-panel.tsx` | One large, literal control                                |
| `components/demo-mode-badge.tsx`     | Legible on white AND on mist                              |
| `components/voice/idle-view.tsx`     | Bigger action, larger blurb, demo badge (handshake)       |
| `app/globals.css`                    | One additive token: `--color-error-soft`                  |
| `lib/i18n/en.ts` + `fr.ts`           | Six new home keys, both languages                         |
| `scripts/demo-shots.ts`              | New — the screenshot harness this audit is written from   |

Not touched: anything on the forbidden list. `voice-session.tsx` was read but
never edited.

---

## Grounding notes

**In-repo Playwright patterns reused from `scripts/e2e-demo.ts`** (read, not
edited):

- Plain `.ts` run by `node` — Node 26 strips types, no test runner, no app
  imports, so the same script can point at a deployment.
- `open()` waiting on `main:not([aria-busy])` — `/plan` streams, so `goto`
  resolves on the skeleton. Extended here with a fallback, because `/check-in`
  renders no `<main>` at all (it is the voice client leaf).
- The two viewports, verbatim: `390×844` (a real phone; the `lg:` bezel is
  hidden below 1024px) and `1440×900` (the desktop iPhone frame that gets
  filmed).
- `deviceScaleFactor: 2`, `rmSync`/`mkdirSync` of the shot directory, and
  `scrollIntoViewIfNeeded` before a below-the-fold shot.

**Empirical checks run rather than assumed** (three throwaway probes, deleted
after use):

1. Playwright `:has-text()` **does** match text inside a closed `<details>`
   (count = 2 on a fixture), but `innerText()` returns `""` for it. This decided
   the whole progressive-disclosure design — see the constraint below.
2. Every assertion `scripts/e2e-demo.ts` makes about home, `/upload` and `/plan`
   was re-run by hand against the running server after each change round. All
   pass.
3. A sweep across `/`, `/upload`, `/plan`, `/check-in` at both viewports for
   horizontal overflow, monospace, `text-transform: uppercase`, `backdrop-filter`
   and 5+ letter block capitals. Clean at both widths. Console, page errors and
   4xx/5xx: clean on all four routes.

**Constraint that shaped the plan screen.** `e2e-demo.ts` asserts
`main.innerText()` contains `"1 tab, OD, Oral, 2 days (complete)"` — the
doxycycline course, which falls on 25 and 26 July, both in the **past**. Putting
earlier days behind a closed `<details>` would empty them from `innerText` and
fail Track 3's harness. So earlier days are demoted by **position and weight**,
not by a disclosure triangle. Noted rather than worked around, because the
harness is not mine to edit.

**No external docs were fetched.** Everything needed was in `CLAUDE.md`,
`app/globals.css`, `tasks/plan.md` §Demo mode, and the running app.

---

## Screenshot inventory

`node scripts/demo-shots.ts` → `/Users/haidertoha/Code/juno-hack/.e2e/ui/`.
Every one of these was opened with the Read tool and looked at; the verdicts are
what I saw, not what the JSX claims.

> **`make e2e` wipes `.e2e/` entirely**, including this subfolder. Re-run
> `node scripts/demo-shots.ts` (~40s) after Track 3's harness.

| Path                               | Shows                                     | Verdict after reading it                                                                                   |
| ---------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `phone-home.png`                   | Home, 390×844                             | Pass. One filled button, two hairline rows, admissions anchored at the foot.                               |
| `desktop-home.png`                 | Home inside the iPhone frame              | Pass. Best of the set — the arc reads top to bottom in one frame.                                          |
| `phone-upload.png`                 | Upload, idle                              | Pass. Title → 2-line instruction → 112px blue panel. Large dead band mid-screen (see risk).                |
| `desktop-upload.png`               | Upload in the frame                       | Pass. CTA no longer orphans "file" on its own line.                                                        |
| `phone-plan-top.png`               | Plan first paint                          | Pass. Header 3 lines, red strip, then Today — all above the fold.                                          |
| `desktop-plan-top.png`             | Plan first paint, framed                  | Pass with a caveat: "Today", the tap instruction and the first medicine are visible, but only just.        |
| `phone-plan-today.png`             | Today parked at the top of the frame      | Pass. Four 28px rings, one instruction, no marks on tomorrow.                                              |
| `desktop-plan-today.png`           | Same, framed                              | Pass.                                                                                                      |
| `phone-plan-scrolled.png`          | "Changed in hospital" → "Earlier days"    | Pass. The label reads as a section break; the "Missed" chip is legible.                                    |
| `desktop-plan-scrolled.png`        | Same, framed                              | Pass.                                                                                                      |
| `phone-red-flag.png`               | Red flag with the NHS disclosure **open** | Pass. Doctor's words on the red tint, NHS block on mist below — the precedence is visible without reading. |
| `desktop-red-flag.png`             | Same, framed                              | Pass.                                                                                                      |
| `phone-check-in-idle.png`          | Check-in idle                             | Pass. Calmest screen in the app; one huge Start.                                                           |
| `desktop-check-in-idle.png`        | Same, framed                              | Pass.                                                                                                      |
| `phone-family.png` / `desktop-…`   | Track 1's family view (inventory only)    | Not mine. Reads well; one note below.                                                                      |
| `phone-operator.png` / `desktop-…` | Track 1's operator panel (inventory only) | Not mine. One note below.                                                                                  |

---

## Iteration log

### Round 1 — the baseline, before any edit

**What I saw, screen by screen:**

- **Home** led with a voice check-in card and had **no ingest path at all** — the
  letter, which is where the demo arc starts, was not on the screen. The two
  cards were near-identical in weight (a lavender tint was the only difference),
  so there was no primary action; the chevron affordance was on the _secondary_
  card only, pointing at the wrong one. ~800px of dead space, then the privacy
  block. No demo badge.
- **Plan** was the worst. Four lines of preamble, then the red-flag card, then
  **Saturday 25 July — a day that had already happened** filling the rest of the
  viewport. **Today was not visible on first paint at either viewport**; it was
  roughly 2.5 screens down, behind two past-day cards. The demo badge was
  `bg-mist` on a `bg-mist` page and dissolved into it. The red-flag card was
  white with a small red glyph — the same shape and colour as the card listing
  tomorrow's statin. The ticks were 24px rings with a 1px `ink-faint` edge and no
  label anywhere saying what they were for. Missed doses showed a red triangle
  and no word.
- **Upload** was closest to right, but a 5-line paragraph stood between the title
  and the button, and the demo badge was wedged **between the instruction and the
  action**. Back went to `/plan`, which is wrong once home links here.
- **Check-in** returned the error boundary — Track 1 mid-extraction. Retried and
  waited, per the brief.

### Round 2 — after the restructure

Changes: home rebuilt; today moved to the top of the timeline; red flag given
`error-soft`; ticks grown; header compressed; badge made a ruled chip; upload
reordered.

**What the shots showed:**

- Home now reads correctly at both sizes. Verified the primary/secondary split
  survives the harness: exactly one link named "Start today's check-in" → `/check-in`,
  exactly one "See my recovery plan" → `/plan`.
- Plan: **Today is above the fold on both viewports.** On desktop the red strip
  and Today's heading, instruction and first medicine share one frame.
- **Two real defects visible only in the pixels:**
  1. The upload CTA wrapped as `Take a photo or choose a` / `file`, and the
     sub-line wrapped too — a four-line stack with the icon floating against it,
     and "file" and "have." orphaned. The sub-line ("Your camera, or a file you
     already have.") was also **redundant** with a label that already says "take
     a photo OR choose a file".
  2. `plan-today` came back byte-identical to `plan-top`, because
     `scrollIntoViewIfNeeded` is a no-op when the target is already visible. Good
     news about the fix, useless as a screenshot.

### Round 3 — after fixing what round 2 showed

- Upload CTA: sub-line **deleted**, `text-balance` added. It now breaks at the
  clause: `Take a photo` / `or choose a file`.
- `demo-shots.ts` gained `scrollToTop` (parks a card at the top of the frame, so
  a card taller than the viewport can be photographed whole) and `open` (clicks a
  `<summary>`, because a closed disclosure photographs as nothing).
- **Round 3 caught the worst bug of the whole run**, and only because the new
  `plan-today` shot showed the card _below_ today: **`Tuesday 28 July · Day 3`
  displayed Apixaban with a red triangle and a "Missed" chip.** A dose that has
  not come round yet cannot have been missed.

  Traced it: `/api/seed` writes missed on 2026-07-25 and 2026-07-26 only, so this
  was a **stale log entry for 2026-07-28** left in Redis — almost certainly from
  the operator panel's clock being moved forward and back. The log outlives the
  clock. `DaySection` was reading `statuses` for every day regardless of whether
  the day could be answered for, so a date that used to be the present kept its
  answer after it became the future.

  Fixed in presentation, where it belongs: **a day that cannot be answered for
  cannot show an answer.** One guarded line in `day-section.tsx`. This is not
  defensive programming on proven data — the clock is genuinely movable, so the
  log is genuinely uncertain input.

  Re-shot and confirmed: tomorrow's card now carries no marks; the "Missed" chip
  appears only on 25 and 26 July.

- Re-ran all ten harness assertions on `/plan` after the change. All pass.

---

## What changed and why

### `app/(phone)/page.tsx` — home now IS the arc

Reads the stored plan (`readPlan`, `force-dynamic`) and puts **one** step in the
big button:

- **no letter yet** → "Take a photo of your letter", and a single sentence saying
  what happens next. "See my plan" and "check in" are deliberately absent: both
  land on nothing, and two doors into an empty room is worse than none.
- **letter read** → "Start today's check-in", with the plan and a second letter
  as quiet hairline rows.

Reading the store is the only way for "the one thing to do next" to be _correct_
rather than guessed, and it is the same read `/plan` already makes. The two
secondary rows are rows on the page, not cards — two more shadowed cards under
the button would restate exactly the mistake being fixed. Demo badge and privacy
sit together at the foot under `mt-auto`, so the screen reads top-and-bottom
instead of trailing off.

### `app/(phone)/upload/**` — instruction, action, explanation

Nothing now stands between the instruction and the control. The paragraph about
what we do with the pages is true and worth saying, so it moved to the foot with
the demo badge. Back goes to `/` rather than `/plan`, now that home links here.

`upload-panel.tsx` gets a **112px accent panel** — deliberately twice an ordinary
button, because this is the one screen a patient reaches holding a piece of paper.
It carries its own class string rather than reusing `primaryButton`: overriding
`min-h`, `text-lg` and `justify-center` on top of the shared string would put
three pairs of same-property utilities in one class attribute, which resolve by
stylesheet order, not by the order they were typed. Same tokens, same motion,
same radius — only the scale differs, and the reason is in a comment.

The label string `"Take a photo or choose a file"` is unchanged, because
`e2e-demo.ts` asserts it exactly.

### `components/plan/**` — today dominates

- **`timeline.tsx`**: the near-term window is split rather than rendered in date
  order. **Today first**, then the days ahead, then "Coming up" / "Any time" /
  "Changed in hospital", then earlier days at the very foot under a plain
  paragraph: _"Earlier days. You can still tick anything you took."_ A paragraph
  and not a heading — every day below already carries its own `h2` with its own
  date, and a heading here would either sit level with the days it introduces or
  push them down and orphan the structure they were deliberately given.
- **`day-section.tsx`**: today's heading is `text-2xl` against `text-lg`
  everywhere else — lavender alone was carrying that entire distinction. Today's
  card gains the single highest-value sentence on the screen: _"Tap the circle
  beside each one when you have done it."_ The rings were the only thing saying a
  row could be answered, and an empty ring is not self-explanatory to someone who
  has never used the app. Plus the future-day status fix above.
- **`task-check.tsx`**: the resting mark is 28px with a 2px `ink-muted` edge
  (7.7:1 on today's lavender) filled `bg-surface`, so it reads as an empty box to
  fill rather than a dot. The button stays 44px. Aria-label strings are byte-identical
  to what the harness matches on.
- **`task-row.tsx`**: a missed dose now says **"Missed"** on a white chip with a
  red edge. The word is not in red text because `error` measures 4.31:1 on
  lavender and 4.46:1 on mist — both under AA — and today's card is lavender.
- **`red-flag-card.tsx`**: surface `bg-error-soft`, the trigger up to `text-xl`,
  "Get help if" promoted from `ink-muted` to `ink`, the glyph 20px. Colour is the
  only thing that works _before_ reading, and this card had none. The NHS block
  stays a closed `<details>` on mist, so the doctor's words remain visibly primary
  and everything NHS-derived visibly secondary — the property the file's own
  header comment already claimed.

### `app/globals.css` — one additive token

```css
--color-error-soft: #fdecec;
```

Measured before use: `ink` 14.2:1, `accent` 4.96:1 (both AA), `error` 4.31:1 —
so `error` stays on the glyph and never carries a sentence, which is exactly how
it is used. Nothing else in the `@theme` block was touched; the frozen `ink-faint`
remediation was left alone.

### `components/demo-mode-badge.tsx`

Was `bg-mist` — and `/plan`'s page colour **is** mist, so the one line on screen
that admits what is recorded read as loose grey text. Now a ruled white chip,
`inline-block` so it is the width of its own sentence and reads as a label rather
than a banner. Legible on both surfaces. String unchanged (`getByText("Demo mode.")`).

### `components/voice/idle-view.tsx` — the handshake

Track 1's extraction landed mid-run, so this was done in the file rather than
through copy alone. Blurb `text-base` → `text-lg` (it was smaller than body copy
on every other screen, and it is the sentence that explains what tapping does),
primary button `+py-4`, mic glyph 24px, and **the demo badge added** — check-in
was the one on-camera surface that never said it was a demo.

### `lib/i18n/en.ts` + `fr.ts`

Six new `home.*` keys in both languages, authored French, no machine translation.
Surgical `Edit` calls only — Track 1 was writing `voice.*`, `family.*` and
`checkInPrompt.*` into the same two files concurrently; nothing of theirs was
overwritten.

---

## Anti-slop self-check

Against `CLAUDE.md` §Banned, item by item, verified in the rendered DOM at both
viewports and not merely by reading my own diff:

| Banned                                                | Status                                                                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inter / Geist / Roboto / Open Sans                    | **Clean.** Hanken Grotesk only. No font added.                                                                                                       |
| Satoshi / General Sans / Clash / Bricolage / Fraunces | **Clean.** Newsreader remains unused; I did not reach for it, so it stays unused deliberately.                                                       |
| **Any monospace in the UI**                           | **Clean** on `/`, `/upload`, `/plan`, `/check-in` at 390 and 1440 — swept computed `font-family`. (One observation on Track 1's `/operator`, below.) |
| Gradients as decoration                               | **Clean.** The orb's is the only gradient and it is sanctioned + untouched.                                                                          |
| `rounded-xl` everything                               | **Clean.** Only `rounded-tactile` / `rounded-card` / `rounded-pill`. No `rounded-xl` anywhere I wrote.                                               |
| Glassmorphism / `backdrop-blur`                       | **Clean.** Swept `backdrop-filter` in computed style across all four routes: none.                                                                   |
| Drop-shadow soup                                      | **Clean.** Only the existing `shadow-card`. Home's secondary rows use hairlines, not shadows.                                                        |
| Three-feature-cards-with-icons grid                   | **Clean, and actively removed** — home's two equal cards became one button plus two hairline rows.                                                   |
| Heroicons                                             | **Clean.** No icon dependency; the in-repo hand-drawn set only.                                                                                      |
| Emoji bullets                                         | **Clean.** No emoji anywhere.                                                                                                                        |

Also held:

- **No raw hex in any component.** The one new colour is a `@theme` token.
- **Motion**: every transition I wrote is `duration-150 ease-out` on opacity or a
  0.5-unit translate. No `transition: all`, no new keyframes.
- **Tap targets ≥ 44px**: tick 44, home rows 64, upload panel 112, check-in
  primary ~68, back button 44.
- **Body measure ≤ 66ch**: the longest new paragraph is capped at `42ch`.
- **No `dvh`/`vh` inside `(phone)`** — nothing I wrote uses either; every page
  root is `flex min-h-0 flex-1 flex-col`.
- **No `"use client"` on a page or layout**, no `useEffect` fetching, no `any`.
- `text-ink-faint` carries no sentence — home's padlock glyph only. (Note: the
  token was already remediated to `#5f6b80` / 5.38:1 in `globals.css`; the
  brief's 2.74:1 figure is the pre-remediation value. It is still kept off
  sentences.)
- `pnpm typecheck` clean · `pnpm lint` clean · console/network clean on all four
  routes. Repo-wide `format` was **not** run; only my own files were formatted.

---

## Residual risk

1. **Only a human can settle this: `/plan` had a stale `missed` log entry for
   2026-07-28 in Redis.** I fixed the rendering so a future day cannot show an
   answer, but the bad row is still in the store and `POST /api/seed` does not
   clear it (it only writes 25 and 26 July). If the demo clock is advanced past
   28 July on camera, that dose will show as missed again and the family view's
   "two missed doses in 3 days" claim may become three. **Track 1 should flush
   `portico:log:demo:2026-07-28`, or make the seed clear the log window it owns.**
2. **The upload screen has a ~700px dead band** between the status line and the
   footer at 390px. It reads as calm rather than broken because the admissions are
   anchored at the bottom, matching home — but it is the emptiest screen in the
   demo and it is worth not lingering on.
3. **Today is above the fold on `/plan`, but only just, on desktop.** The
   red-flag card is ~40% of the frame. Compacting it further meant either
   shrinking the doctor's own words or dropping the 44px provenance target — I
   judged both worse than the scroll. If the shot on camera needs today higher,
   the cheapest honest move is folding `SourceTrace` into the grey footer strip
   beside the NHS disclosure.
4. **Progressive disclosure on the plan is by position and weight, not by a
   disclosure control** — forced by the doxycycline `innerText` assertion in
   `scripts/e2e-demo.ts` (see Grounding notes). If Track 3 ever relaxes that
   assertion, earlier days should become a real `<details>`.
5. **~~`/plan` and `/upload` are still hardcoded English.~~ Closed** — see
   "Addendum: the B1 gap on `/plan` and `/upload`" below. Left in place rather
   than deleted because `15-…md` adjudicated this line and the ruling matters:
   it was not merely cosmetic, it was a live D9 breach and a WCAG 3.1.1 defect.
6. **`.e2e/ui/` is destroyed by `make e2e`.** Re-run `node scripts/demo-shots.ts`.
7. **`readPlan` on home** means a Redis outage now takes the first screen down,
   not just `/plan`. Judged acceptable — every other screen already depends on it,
   and the alternative is a home screen that confidently offers the wrong action.

### Observations on Track 1's screens (not edited, not mine)

- **`/family`** prints raw ISO dates — `Today · 2026-07-27`, `Missed on 2026-07-25`.
  Everywhere else the app says "Saturday 25 July". For the daughter reading this on
  her phone, `formatDay()` from `components/plan/day-section.tsx` would be a
  one-import improvement.
- **`/operator`** renders `NEXT_PUBLIC_PORTICO_MODE` and `.env` in a monospaced
  face. It is a backstage page and `e2e-demo.ts` never visits it, so nothing
  fails — but `CLAUDE.md` bans mono in the UI with code blocks as the only
  exception, and these are inline env-var names, not a code block.

---

## Addendum: the B1 gap on `/plan` and `/upload`

Residual risk 5 above is closed. `15-…md` was right to reject this round's
"pre-existing, not a regression" framing: `<html lang="fr">` over English prose
is a live D9 breach _and_ a WCAG 3.1.1 defect, on two screens the arc visits.
Both screens now call `getDictionary`, and `page.tsx`'s "English until B1's
`getLocale()` lands" comment is gone with the hardcoded `locale="en"` it
explained.

**What moved into the dictionary.** Two new sections — `upload.*` (with a
`panel.*` slice for the client leaf) and `nhs.*` — plus `plan.*` grown from 3
keys to 27, and 7 additions to `redFlag.*`. Every string on both screens is
covered: headings, blurbs, group titles, chips, empty and error states, the
upload progress line, the skeleton's `role="status"`, and every `aria-label`.
The French is authored, not machine-translated.

**Three things the screenshots showed that the JSX did not.**

0. **One real layout defect, found only in the pixels.** `task-row.tsx`'s tag
   chip carried `shrink-0`. That is free at `For your GP` (11 characters) and
   ruinous at `Pour votre médecin traitant` (27): the chip took 60% of the row
   and wrapped the instruction's title into **seven two-word lines**. Fixed by
   capping it — `shrink-0` → `max-w-[45%]`, so the chip wraps inside its own
   pill and the title stays the widest thing on the row. The English render is
   byte-identical either way, because its chip is nowhere near the cap. This is
   exactly the class of defect that only shows up when French is actually put on
   screen at 390px, which is why the shots are in both languages.

1. **The letter's own text is still English on the French screen**, because the
   bundle carries French for red flags only (`triggerFr`/`actionFr`) and for
   nothing else. `A chest infection, with a flare-up of your COPD`,
   `1 tab, BD, Oral, Ongoing` and `Stops clots forming…` all render in English
   under `<html lang="fr">`. That is a **data** gap, not a UI one, and it is not
   fixable from `components/plan/**` — it needs `titlePlainFr` / `purposePlainFr`
   on the schema and an extraction pass that fills them. Marked `lang="en"`
   everywhere so the document is at least honest about it (WCAG 3.1.2), and the
   letter's verbatim fields additionally carry `translate="no"` so browser
   auto-translate cannot rewrite a dose instruction — the same treatment D7
   already gives the red flag.

2. **The D7 dual render costs `/plan` its "Today above the fold" property in
   French.** The `En français` block adds ~250px to the red-flag card, and with
   it today's card starts below 844px on the phone and below the bezel on the
   desktop frame. In English the card, the tap hint and the first medicine still
   share the frame — `en-phone-plan-top.png` is pixel-identical to
   `phone-plan-top.png` above. This is the correct D7 behaviour arriving rather
   than a regression (French previously got the English card, which is the bug),
   but it is worth knowing before the language picker is demoed on camera. The
   cheapest honest fix is the one risk 3 already names: fold `SourceTrace` into
   the grey footer strip.

**One English string is left on both screens and it is not ours to move**:
`components/demo-mode-badge.tsx` hardcodes _"Demo mode. The letter and the
medicine guidance are recorded, not fetched live."_ and takes no prop. It
renders on `/`, `/plan`, `/upload`, `/check-in` and `/family`, so giving it a
dictionary key touches four other tracks' screens.

**Shots:** `.e2e/i18n/{en,fr}-{phone,desktop}-{upload,plan-top,plan-today,plan-groups,red-flag}.png`
— 20 images, both locales at both viewports, each one opened and looked at. The
harness asserts `<html lang>` matches the cookie before every shutter, so a shot
cannot silently be of the wrong locale. Same caveat as `.e2e/ui/`: **`make e2e`
wipes `.e2e/` entirely.**
