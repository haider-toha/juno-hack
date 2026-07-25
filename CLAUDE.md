# Project Rules

A single Next.js App Router app at the repo root. TypeScript, Tailwind v4, pnpm.
There is no backend service and no database yet — everything runs in Next
(Server Components + route handlers). Read this before writing code.

Pinned toolchain: Node 26, pnpm 11.

---

## General Principles

- **Explore before acting.** Resolve unknowns by reading the code, not guessing.
  Follow the patterns already here instead of inventing new ones.
- **Every line justifies itself.** No dead code, no backwards-compat shims, no
  config flags or props added "just in case". Delete rather than keep.
- **No defensive programming.** Trust validated upstreams and fail loudly at the
  source. Don't paper over uncertainty downstream with guards and fallbacks.
  (This is about _redundant_ checks on already-proven data — not about handling
  genuinely uncertain inputs like a network call, which you must model.)
- **Obvious over clever.** If a line needs a comment to explain _what_ it does,
  rewrite the line. Comments explain _why_, never _what_.
- **Rule of three.** Don't extract a helper until the third real use. Inline
  duplication beats the wrong abstraction. Equally: don't leave a one-call-site
  "util" — inline it.

---

## Frontend

**Server vs client components.** Server Components are the default. Add
`"use client"` only for `useState`/`useReducer`, event handlers, effects, or
browser APIs — and push it to the **leaf**, never a page or layout (everything a
client file imports joins the client bundle). `components/voice/voice-session.tsx`
is the one client boundary; the rest of `components/voice/` is imported by it and
needs no directive of its own.

**Types.** `any` is banned (lint errors on it). For genuinely-unknown input use
`unknown` and narrow. Use `satisfies` for config-shaped literals, not `as` —
reserve `as` for assertions you can prove the compiler can't. Model variants as
discriminated unions so illegal states are unrepresentable and `switch` is
exhaustive. Don't annotate what's inferred; annotate at boundaries.

**Zod lives only at trust boundaries** — route handlers, `searchParams`, external
API responses, env parsing. Internal function-to-function calls are already typed
by TS; validating them is slop. Env is validated once in `lib/env.ts` (import
`env`, never `process.env`).

**Data fetching.** Fetch in async Server Components; parallelize independent
reads with `Promise.all` (sequential awaits that don't depend on each other are a
waterfall bug). Stream slow reads with `<Suspense>`. No `useEffect` data
fetching — that's a server job.

**State.** Default to none: derive from server data + URL `searchParams`. Local
UI state → `useState` in a leaf. Cross-tree → Context. A store only after Context
demonstrably hurts — never preemptively.

**Conventions.** Route files use Next's reserved names (`page.tsx`, `layout.tsx`,
`loading.tsx`, `error.tsx`). Component files `kebab-case.tsx` exporting a
`PascalCase` component, one per file. Hooks `use-*.ts`. No barrel `index.ts`
re-export files — import from the real path.

**Avoid:** `"use client"` at the top of a page/layout; `as` to silence type
errors; `useEffect` fetching; barrel files; premature abstraction.

---

## The phone shell

`app/(phone)/layout.tsx` is both the mobile app shell and the desktop iPhone
frame. **The frame owns the height** — pages inside it must never use `dvh`/`vh`
(a child `min-h-dvh` resolves to the whole browser window and overflows the
bezel). Fill the column with `flex min-h-0 flex-1 flex-col` instead. Safe-area
insets are applied once in the layout; no page needs `env()` or fixed
positioning. The bezel, status bar, Dynamic Island and home indicator are `lg`-only
demo chrome — on a real phone the OS draws them and the frame goes full-bleed.

---

## Voice (ElevenLabs)

- `XI_API_KEY` is server-only and never leaves `/api/eleven/signed-url`. The
  browser only ever receives a signed WebSocket URL.
- **The start chain — `getUserMedia` → `fetchSignedUrl` → `startSession` — must
  stay inside the direct user tap.** Never move it into an effect, a timeout or a
  router transition; Safari refuses the mic outside the gesture.
- `ConversationProvider` must wrap anything calling `useConversation*`, and it
  stays mounted across view-state changes. Hiding the live view without calling
  `endSession()` leaves the mic and socket alive — end explicitly.
- The orb animates off the SDK's `mode` axis (`speaking` / `listening`), **not**
  `status`, which is `connected` for both.
- The transcript reveal is paced by `onAudioAlignment`, not by LLM deltas. Don't
  "simplify" it into rendering deltas directly — that's the whole effect.

---

## UI & Design

**Fonts** (both via `next/font/google`, self-hosted, zero layout shift — see
`app/layout.tsx`): **Hanken Grotesk** for display and body. **Newsreader** italic
is the editorial accent, held for pull-quotes and asides — no screen uses it yet,
so reach for it deliberately or drop it. **No monospaced font anywhere
in the UI** — code blocks are the only exception. Tabular figures come from
`.tnum`, not a mono face.

**Colour is semantic tokens, never raw hex in components.** Defined once in
`app/globals.css` `@theme`; reference as Tailwind utilities (`bg-surface`,
`text-ink-muted`, `border-rule`, `text-accent`, `bg-mist`, `bg-lavender`). The
one sanctioned exception is the orb's gradient, which is inline hex by necessity.

**Shape & structure.** `rounded-tactile` (12px) for buttons/tags,
`rounded-card`/`rounded-bubble` (16px) for cards and bubbles, `rounded-pill` for
capsules. Structure comes from 1px hairline `rule` borders and the soft
`shadow-card`. Generous whitespace, body measure ≤ 66ch. Motion is restrained:
120–200ms ease-out, opacity and small translate only. Tap targets ≥ 44px.

**Banned (these are the AI tells):** Inter / Geist / Roboto / Open Sans — _and_
Satoshi / General Sans / Clash Display / Bricolage Grotesque / Fraunces; any
monospace in the UI; gradients as decoration; `rounded-xl` everything;
glassmorphism / `backdrop-blur`; drop-shadow soup; three-feature-cards-with-icons
grids; Heroicons; emoji bullets.

---

## Tooling

`make help` lists every target. The essentials:

```bash
make setup      # pnpm install + .env from the example
make dev        # :3000
make format     # prettier
make lint       # eslint
make typecheck  # tsc --noEmit
```

- Flat ESLint config (`eslint.config.mjs`) with `eslint-config-next` + Prettier
  interop; `next lint` no longer exists in Next 16, so lint runs the ESLint CLI
  directly.
- **Tailwind v4 is CSS-first**: there is **no `tailwind.config.js`**. Tokens live
  in the `@theme` block of `app/globals.css`; content is auto-detected; the
  PostCSS plugin is `@tailwindcss/postcss`.
- `pnpm-workspace.yaml` carries `minimumReleaseAgeExclude` entries for the
  ElevenLabs packages. Don't delete them — installs fail without them.
- Don't loosen a check to make it pass. Fix the code, or change the rule
  deliberately with a reason.
