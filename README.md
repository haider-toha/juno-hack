# Portico

Leaving hospital with a discharge letter is not the same as knowing what to do
at home. Portico turns that letter into a living recovery plan you can actually
follow day by day. Medicines, follow-ups, and warning signs sit in one place. A
voice companion checks in, walks through what is left today, and logs what was
taken. If important doses are missed, the next of kin can see that something
needs attention. The app stays in plain language, in English or French, and
never pretends to be a clinician.

Built for the Juno hackathon. Product name is Portico. Repo and Vercel slug may
still say `juno-hack`.

## Live app

**[https://juno-hack.vercel.app/](https://juno-hack.vercel.app/)**

Open that on a phone, or in a desktop browser (it renders inside an iPhone
frame).

## Try it

1. Grab the Harold Whitfield discharge letter from the repo:
   [`fixtures/discharge-summaries/02_Whitfield_Harold_Pneumonia.pdf`](fixtures/discharge-summaries/02_Whitfield_Harold_Pneumonia.pdf).
2. Open [https://juno-hack.vercel.app/](https://juno-hack.vercel.app/).
   If a plan is already loaded from a previous visitor, reset first at
   [https://juno-hack.vercel.app/operator](https://juno-hack.vercel.app/operator).
3. On the phone home screen, upload that PDF (or photograph it).
4. Once the plan is in, walk through:
   - **See my recovery plan** for the day-by-day schedule.
   - **Start today's check-in** for the voice companion (mic needed).
   - **Family view** for what the next of kin sees.

## What it does

| Surface | Route | What you get |
| ------- | ----- | ------------ |
| Home | `/` | Upload a letter, or jump into check-in / plan / family |
| Recovery plan | `/plan` | Day-by-day meds, list or calendar, red flags |
| Check-in | `/check-in` | ElevenLabs voice session grounded in today’s plan |
| Family | `/family` | Next-of-kin view; escalates when high-stakes doses are missed |
| Letter | `/letter` | Source lines from the discharge letter |

The voice agent can log doses (`/api/log`) and leave a note for next of kin
(`/api/escalate`). Those write the same store the plan and family screens read.

## Tech stack

- **App** — Next.js App Router, React 19, TypeScript, Tailwind v4
- **Voice** — ElevenLabs Conversational AI (`@elevenlabs/react`); API key stays
  server-side behind `/api/eleven/signed-url`
- **Extraction** — OpenAI into a typed recovery plan
- **Storage** — Upstash Redis for plan / log / clock / escalations; Vercel Blob
  for letter files
- **Deploy** — Vercel

## Where the code lives

```
app/
  (phone)/                 product UI inside the phone shell
    page.tsx               home
    plan/page.tsx          recovery plan
    check-in/page.tsx      voice check-in
    family/page.tsx        next-of-kin view
  operator/page.tsx        reset / clock / ring controls
  api/
    eleven/signed-url/     mints the WebSocket URL (key never hits the browser)
    extract/               letter → typed plan
    log/                   voice tool: record a dose
    escalate/              voice tool: note for next of kin
components/
  voice/                   session, orb, transcript
  upload/                  camera / PDF upload
  plan/                    plan list, calendar, task rows
lib/
  plan/schema.ts           extraction contract
  store/                   Redis reads/writes
  escalation/rules.ts      when family view escalates
  check-in-prompt.ts       builds the plan-aware voice prompt
  i18n/                    English + French copy
fixtures/
  discharge-summaries/     sample letter PDFs
```

## Run locally

Pinned toolchain: Node 26, pnpm 11.

```bash
make setup          # pnpm install + copy .env.example → .env
# fill .env / .env.local from .env.example
make dev            # http://localhost:3000
```

`make help` lists the rest. Keys you need are in
[`.env.example`](.env.example).

## Notes for reviewers

- The ElevenLabs key never enters the browser. Only a short-lived signed URL
  does.
- Deeper design notes live under
  [`audit/juno-recovery-companion/`](audit/juno-recovery-companion/).
