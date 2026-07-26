# Portico

A post-discharge companion that turns a hospital discharge letter into a living,
day-by-day recovery plan — with a voice agent that checks in to see you're on
track. See [`plan/initial-idea.md`](plan/initial-idea.md) for the concept.

**Portico** is the product. **Juno** is the hackathon host (repo/Vercel may still
use the `juno-hack` slug). Locked decision: `audit/…/00-locked-decisions.md` D10.

## Running it

```bash
make setup     # pnpm install + copy .env.example to .env
# fill in .env (see .env.example — ElevenLabs, Redis, Blob, etc.)
make dev       # http://localhost:3000
```

`make help` lists the rest.

## Demo night (handoff)

Two windows: the **phone** (`/` — product) and the **operator desk**
(`/operator` — laptop only, not linked from the app). State lives in Redis +
Blob and **persists** after every run. You never wipe a Vercel database; you
reset from `/operator`.

Requires `NEXT_PUBLIC_PORTICO_MODE=demo` on that deployment. Outside demo mode
seed and `/api/demo/*` refuse with 403.

### The letter

Use **Harold Whitfield** — pneumonia discharge:

`fixtures/discharge-summaries/02_Whitfield_Harold_Pneumonia.pdf`

Print it or open it on a second device for the camera / file-upload shot. In
demo mode **any** uploaded letter yields Whitfield’s baked plan (the model is
not called). The other PDFs in that folder are corpus fixtures, not the demo
patient.

### What `/operator` is

A control surface that writes the **same** Redis state the product reads. It
does not paint fake UI results. Bookmark it:

| Where | URL |
| --- | --- |
| Local | [http://localhost:3000/operator](http://localhost:3000/operator) (`make operator`) |
| Vercel | `https://<your-deploy>/operator` |

Rough map of the buttons:

1. **Reset to the seeded state** — between-takes button. Whitfield plan, daughter
   as next of kin, clock = discharge + 2 days, two missed apixaban doses already
   logged, check-in / dose-nudge cleared.
2. **Clear the letter** — deletes the stored plan only (misses + clock + kin
   stay). Use after Reset when the take should open on “photograph your letter”.
3. **Clock** — move demo “today” forward/back without waiting real days.
4. **Mark apixaban missed / taken** — write real adherence log rows (what
   `assess()` and `/family` read).
5. **Ring / cancel the check-in** — raises the incoming call on the phone
   (parked on `/check-in`, polls every few seconds).
6. **Fire / cancel the dose nudge** — raises the scheduled reminder banner.

CLI equivalents (local, with `make dev` running): `make seed`, `make ring`,
`make unring`, `make clear-letter`, `make clock`, `make arc` (full HTTP smoke of
the beats). On Vercel: `curl -X POST https://<your-deploy>/api/seed`.

### Typical take

1. Open phone on `/`, laptop on `/operator`.
2. **Reset to the seeded state**.
3. If you need the empty-account opening: **Clear the letter**, then on the phone
   upload / photograph `02_Whitfield_Harold_Pneumonia.pdf`.
4. Walk the product: plan → check-in (operator can **Ring the check-in**) →
   voice → family (`/family` shows the daughter view; seeded double miss should
   already escalate).
5. When the take ends, **Reset** again before the next one.

Product routes worth knowing: `/` home · `/upload` · `/plan` · `/check-in` ·
`/family` (next of kin) · `/operator` (desk).

## Making changes

`main` is protected: it takes no direct pushes, from anyone. Branch off it and
open a pull request back.

```bash
git switch -c my-change main
# ...work...
make format          # do this before pushing — CI checks it
git push -u origin my-change
gh pr create
```

CI runs `prettier --check` on every pull request into `main`, and the `format`
check must pass before the PR can merge. No review approval is required. Nothing
deploys from CI.

Type-checking (`make typecheck`) and linting (`make lint`) are not in CI yet —
run them locally.

## What's here

```
app/
  layout.tsx              fonts (next/font) + metadata
  globals.css             the whole design system — @theme tokens, base layer
  (phone)/
    layout.tsx            the app shell AND the desktop iPhone frame
    page.tsx              home
    check-in/page.tsx     the voice screen
    plan/page.tsx         recovery plan
    family/page.tsx       next-of-kin view
  operator/page.tsx       demo control desk (not part of the product)
  api/                    seed, demo/*, extract, eleven, log, escalate, …
components/
  voice/                  the ElevenLabs session, orb, transcript, composer
  phone/                  push / dose-nudge banners
  upload/                 letter upload
lib/
  env.ts                  the config trust boundary (zod)
  store/                  Redis: plan, log, clock, check-in, reminders
  plan/samples/           Whitfield demo bundle
```

## ElevenLabs

The browser never sees `XI_API_KEY`. `/api/eleven/signed-url` reads it
server-side and returns a short-lived signed WebSocket URL; the client starts the
session with that.

Two things to know:

- **The agent must allow every override the session sends.** `VoiceSession` sends
  `overrides.agent.prompt`, `.language`, `.firstMessage` and `overrides.tts` on
  every `startSession`, and the prompt override _replaces_ the agent's dashboard
  prompt for that session. Each field has to be enabled in the agent's Security
  settings. A disallowed field does **not** get quietly dropped and it does
  **not** throw: the server **refuses the session** — the WebSocket closes with
  code `1008` and a reason naming the offending field, _after_
  `conversation_initiation_metadata`. That is asynchronous, so the `try/catch`
  around `connect()` never sees it; it arrives through the SDK's `onError`
  callback and renders in the screen's `role="alert"` banner. Keep it there —
  never downgrade that path to a `console.error` or a silent no-op.
- **The streaming text is paced by the audio, not by the LLM.** Deltas from
  `onAgentChatResponsePart` accumulate the target text, but `onAudioAlignment`
  builds a per-character timeline of when each char is actually voiced, and a
  30ms interval reveals up to that point (with a 120ms lead). That's why the text
  appears in step with the voice rather than in jumpy chunks.

## Deploying

Vercel, Next.js preset, app at the repo root — `vercel.json` covers it. Set the
keys from `.env.example` in the project env. For a demo deployment set
`NEXT_PUBLIC_PORTICO_MODE=demo`, then use `/operator` → **Reset to the seeded
state** between takes (see [Demo night](#demo-night-handoff)).
