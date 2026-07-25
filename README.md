# Portico

A post-discharge companion that turns a hospital discharge letter into a living,
day-by-day recovery plan — with a voice agent that checks in to see you're on
track. See [`plan/initial-idea.md`](plan/initial-idea.md) for the concept.

**Portico** is the product. **Juno** is the hackathon host (repo/Vercel may still
use the `juno-hack` slug). Locked decision: `audit/…/00-locked-decisions.md` D10.

This repo is currently the **skeleton**: the phone shell, the design system, and
a working ElevenLabs voice session with an audio-paced streaming transcript.

## Running it

```bash
make setup     # pnpm install + copy .env.example to .env
# fill in .env with your ElevenLabs key, agent id and voice id
make dev       # http://localhost:3000
```

`make help` lists the rest.

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
    plan/page.tsx         placeholder
  api/eleven/signed-url/  server-only route that mints signed WebSocket URLs
components/
  voice/                  the ElevenLabs session, orb, transcript, composer
  icons.tsx               inline SVG set
  language-picker.tsx     presentation-only language menu
  back-button.tsx
lib/
  env.ts                  the config trust boundary (zod)
  check-in-prompt.ts      the agent's persona + suggested questions
```

## ElevenLabs

The browser never sees `XI_API_KEY`. `/api/eleven/signed-url` reads it
server-side and returns a short-lived signed WebSocket URL; the client starts the
session with that.

Two things to know:

- **The agent must allow prompt overrides.** `VoiceSession` sends
  `overrides.agent.prompt` on every `startSession`, which _replaces_ the agent's
  dashboard prompt for that session. If overrides are disabled in the agent's
  security settings, it is silently ignored and you get the dashboard prompt
  instead.
- **The streaming text is paced by the audio, not by the LLM.** Deltas from
  `onAgentChatResponsePart` accumulate the target text, but `onAudioAlignment`
  builds a per-character timeline of when each char is actually voiced, and a
  30ms interval reveals up to that point (with a 120ms lead). That's why the text
  appears in step with the voice rather than in jumpy chunks.

## Deploying

Vercel, Next.js preset, app at the repo root — `vercel.json` covers it. Set
`XI_API_KEY`, `NEXT_PUBLIC_AGENT_ID` and `NEXT_PUBLIC_XI_VOICE_ID` in the project
env.
