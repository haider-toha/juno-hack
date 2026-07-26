# Portico — demo guide for QA

Hand this to a human or to Claude. It is an entry map of **what exists today**,
not a full product spec. Once you can click through the arc, explore the code
and the deeper notes linked at the bottom.

**Product name:** Portico (post-discharge recovery companion).  
**Repo / Vercel slug may still say `juno-hack`.** Same app.

---

## What it is (30 seconds)

A hospital discharge letter becomes a day-by-day recovery plan on a phone.
A voice agent checks in. If high-stakes meds are missed, the family view
escalates. For the hackathon demo, extraction is **baked** (no live LLM read of
the PDF) but voice, logging, and escalation are **real** — they write/read the
same Redis state.

There are two windows you care about:

| Window                  | URL         | Who                                               |
| ----------------------- | ----------- | ------------------------------------------------- |
| **Phone (the product)** | `/`         | Patient (and family view inside the same shell)   |
| **Operator desk**       | `/operator` | You / QA — laptop only, never linked from the app |

State persists between runs. You do **not** wipe a database on Vercel — you
**Reset** from `/operator`.

---

## Before you start

1. App running (`make setup` → fill `.env` → `make dev`), or a Vercel deploy.
2. Env must have `NEXT_PUBLIC_PORTICO_MODE=demo`. Outside demo mode, seed and
   `/api/demo/*` return **403** and the operator buttons are useless.
3. Open two tabs/windows:
   - Phone: `http://localhost:3000/` (or your deploy root)
   - Operator: `http://localhost:3000/operator` (`make operator` opens it)

**Demo patient / letter:** Harold Whitfield, pneumonia discharge.

```
fixtures/discharge-summaries/02_Whitfield_Harold_Pneumonia.pdf
```

In demo mode **any** upload yields Whitfield’s baked plan. Other PDFs in that
folder are corpus fixtures, not the demo patient.

---

## Rough demo flow (happy path)

Use this as the default QA script. Operator actions are in **bold**.

### 1. Reset between takes

On `/operator` → **Reset to the seeded state**.

What that plants:

- Whitfield plan in Redis
- Daughter as next of kin
- Demo clock = discharge + 2 days (“today” is fake and controllable)
- Two missed **apixaban** doses already logged (so family escalation is ready)
- Check-in / dose-nudge flags cleared

### 2. Optional opening: empty home → upload

If the take should start with “photograph your letter”:

1. **Reset to the seeded state**
2. **Clear the letter** (deletes the plan only; misses + clock + kin stay)
3. On the phone home (`/`): upload or photograph the Whitfield PDF

Home with no plan = big upload control. After a plan exists = big “Start today’s
check-in” plus quieter rows for plan / family / add another letter.

### 3. Walk the patient product

| Step     | Where       | What to look at                                                     |
| -------- | ----------- | ------------------------------------------------------------------- |
| Home     | `/`         | One primary action; language picker top-right; demo badge if shown  |
| Plan     | `/plan`     | Day-by-day meds, today first, red flags, tickable steps             |
| Check-in | `/check-in` | Idle → Start → real ElevenLabs voice session (mic needed)           |
| Family   | `/family`   | Next-of-kin view; with seeded double miss should show **alert-kin** |

### 3b. Voice check-in cue card (what to say)

Seeded “today” has **four** due steps. Keep answers short — drug **name** +
taken/not. One medicine per turn. ASR is biased toward these names:

`Apixaban` · `Metformin` · `Atorvastatin` · `Tiotropium`

**Fastest happy path** (or tap the chips: “I have taken it” / “I have not…”):

| When it asks about…  | You say (shortest reliable)                            |
| -------------------- | ------------------------------------------------------ |
| Apixaban             | “I’ve taken my Apixaban.”                              |
| Metformin            | “Taken the Metformin.”                                 |
| Tiotropium           | “I’ve taken the Tiotropium.”                           |
| Atorvastatin (night) | “Not yet — around ten tonight.” → it schedules a nudge |

After the four steps, Portico asks once more whether anything about how you feel
is worrying you. Say “nothing else” for the short close, or use the red-flag
line below before ending the check-in.

**Optional wow beats** (pick one; don’t stack all three):

| Beat           | You say                                                | What you should see                              |
| -------------- | ------------------------------------------------------ | ------------------------------------------------ |
| Red flag       | “I’m getting more breathless.”                         | Red-flag card + letter’s action read aloud       |
| Important miss | “I haven’t taken my Apixaban.” → then “Yes.”           | Confirm turn, then `missed` logged (high-stakes) |
| Family note    | After a miss: “I can’t get it — can you leave a note?” | Note language; `/family` already alert from seed |

**Avoid:** dose advice questions (“should I double?”), two meds in one breath,
claiming you’re Harold if you’re testing injection. Don’t wait after “Goodbye” —
the app should leave for the notes screen on its own.

### 4. Operator tricks mid-take

| Button                            | Effect on the phone                                        |
| --------------------------------- | ---------------------------------------------------------- |
| **Ring the check-in**             | Incoming call card on `/check-in` (phone polls ~every 5s)  |
| **Cancel the ringing check-in**   | Clears that flag                                           |
| **Fire the scheduled dose nudge** | Reminder banner → opens `/plan` when tapped                |
| **Clock** ±                       | Move demo “today” without waiting real days                |
| **Mark apixaban MISSED / TAKEN**  | Real adherence log rows → changes `assess()` and `/family` |

Rule of honesty: operator only does what a real user could do, faster. It
writes the **same** store the product reads. It does not paint fake UI.

### 5. End of take

**Reset to the seeded state** again before the next run.

---

## Surfaces cheat sheet

### Phone shell (`app/(phone)/`)

Desktop shows an iPhone frame; below ~1024px it is full-bleed mobile. Pages
must fill the column (`flex min-h-0 flex-1`) — they must **not** use `dvh`/`vh`
or they overflow the bezel.

| Route               | Role                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `/`                 | Home — upload if no plan, else lead with check-in                  |
| `/plan`             | Recovery timeline                                                  |
| `/check-in`         | Voice check-in (client leaf: `components/voice/voice-session.tsx`) |
| `/check-in/summary` | Post-check-in summary (if present in your build)                   |
| `/family`           | Daughter / next-of-kin dashboard                                   |
| `/language`         | Locale                                                             |

`/upload` may still exist as a route in older notes; current home hosts upload
inline when there is no plan.

### Operator (`/operator`)

Laptop control desk. Sections: State readout → Set the stage → Clock → Answer
for a step → Check-in → Dose nudge. Read the hints on each button; they say
exactly which API they hit.

### Family

Same phone shell, different reader. Seeded state should already escalate on
apixaban (two misses in the window). Mark one miss as taken on the operator and
escalation should drop (e.g. toward nudge / none) — that is a good QA beat.

---

## What is real vs demo-shortcut

| Piece                                 | In `demo` mode                                |
| ------------------------------------- | --------------------------------------------- |
| Letter → plan                         | **Baked** Whitfield bundle (model not called) |
| Voice check-in                        | **Real** ElevenLabs session                   |
| Dose ticks / voice tools writing logs | **Real** Redis log                            |
| Escalation (`assess()` → family)      | **Real** rules on real logs                   |
| Demo clock / ring / nudge             | **Demo-only** APIs (`/api/demo/*`)            |

Live extraction (`PORTICO_MODE=live`) is a separate path, rewired to OpenAI on
2026-07-26 and scored green against all five gold letters (`make eval`). It
needs `OPENAI_API_KEY` in `.env.local`. Two caveats before QAing it: a letter
takes ~28s and has been seen to exceed the harness's 300s ceiling, and Vercel
Blob cold-handshakes on the first request of a run. Warm the path before
filming.

---

## Local make targets (optional)

With `make dev` running:

```bash
make seed          # same as Reset
make clear-letter  # same as Clear the letter
make ring / unring # check-in flag
make clock         # DAY=YYYY-MM-DD or SHIFT=1
make arc           # HTTP smoke of the beats
make e2e           # browser arc (needs running app)
```

---

## For Claude: where to dig next

Start here, then follow imports — do not invent a second architecture.

| Topic                                   | Start                                                   |
| --------------------------------------- | ------------------------------------------------------- |
| Product concept                         | `plan/initial-idea.md`, `tasks/spec.md`                 |
| Locked product decisions                | `audit/juno-recovery-companion/00-locked-decisions.md`  |
| Demo plumbing (operator, family, tools) | `audit/juno-recovery-companion/12-track-1-demo-flow.md` |
| Patient UI hierarchy / screenshots      | `audit/juno-recovery-companion/13-track-2-demo-ui.md`   |
| Seed + Whitfield plan                   | `lib/plan/samples/`, `app/api/seed/route.ts`            |
| Store (Redis)                           | `lib/store/`                                            |
| Escalation rules                        | `lib/escalation/rules.ts`                               |
| Voice session / mic gesture rules       | `CLAUDE.md` § Voice, `components/voice/`                |
| Env trust boundary                      | `lib/env.ts`, `.env.example`                            |
| Shorter operator notes                  | `README.md` § Demo night                                |

**QA mindset:** pick one host per take (local **or** one Vercel deploy). Re-seed
between takes. If phone and operator disagree, you are probably hitting two
different deployments or forgot Reset.
