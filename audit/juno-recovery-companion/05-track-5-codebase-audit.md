# Track 5 — Codebase audit, patterns, and proposed structure

## Scope

A read-only pass over every file in `/Users/haidertoha/Code/juno-hack`
(excluding `node_modules`, `.next`, `.git`, `.claude`, `.agents`), plus both
planning transcripts. Deliverables: a factual current-state inventory, the
patterns the new work must extend, a proposed file tree, the server/client
boundary plan, grounded risks, and the dependency delta.

**Stack decisions folded in (these supersede the original "no database"
brief).** There is real persistence, all Vercel-native, provisioned through the
Vercel Marketplace:

- **Upstash Redis** (`@upstash/redis`) for application state — patient, the
  extracted plan, the daily adherence log, the caregiver record. Env:
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. `@vercel/kv` is **sunset**
  and must not be proposed.
- **Vercel Blob** (`@vercel/blob`) for the uploaded discharge-letter images and
  PDFs. Env: `BLOB_READ_WRITE_TOKEN`.
- **Vercel AI SDK through the AI Gateway** (`ai`) for extraction. Env:
  `AI_GATEWAY_API_KEY`; model selected by a `"provider/model"` string.
- Still **no** Supabase, **no** Neon/Postgres, **no** ORM, **no** Prisma/Drizzle.
- The call model is **not** a phone call: a notification lands, the patient taps
  it, and the existing in-app orb session starts inside that tap. No Twilio. The
  existing `components/voice/` wiring is extended, never rebuilt.
- Escalation is an **in-app family dashboard only**. No email, no SMS, no Resend.

Everything below is either quoted from a file I read or verified by running a
command. Verified rather than assumed:

- `pnpm exec tsc --noEmit` — **passes** (exit 0) on a clean checkout with no
  `.next/`.
- `pnpm exec eslint .` — **passes** (exit 0).
- `pnpm exec prettier --check .` — **fails** (exit 1) on `plan/raw-transcript.md`.
  This is the one thing CI enforces, so CI is red on `main` right now.
- `next build` was run twice in an isolated copy under the scratchpad (the repo
  was never touched; `git status` confirmed clean afterwards). Results in
  "Toolchain & CI".
- The ElevenLabs SDK surface (client tools, the language union) was read from the
  installed `.d.ts` files, not from memory.
- `curl -s https://ai-gateway.vercel.sh/v1/models` was called live to confirm the
  gateway model-listing endpoint works and what it returns today.

One thing I could **not** verify: the exact AI SDK call surface, because `ai` is
not installed and installing it would modify the repo. The `vercel:ai-sdk` skill
is explicit that internal knowledge of this SDK is stale, so everything I say
about it below comes from that skill's own bundled reference files, and the
implementing agent must re-verify against `node_modules/ai/docs/` after
installing. Points where that matters are marked **[verify after install]**.

### Precedence and conflicts with the loaded skills

`CLAUDE.md` is law. Where the skills disagree with it, CLAUDE.md wins. The real
conflicts, called out rather than silently resolved:

| Skill says                                                                                        | CLAUDE.md / repo says                                                                                                                                                                      | Resolution                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nextjs-app-router-patterns` quick-start uses the `Inter` font                                    | `CLAUDE.md:117` bans Inter outright                                                                                                                                                        | CLAUDE.md. Fonts are set at `app/layout.tsx:6-21`; do not touch.                                                                                                                                                                                                                                                                                            |
| `nextjs-app-router-patterns` + `haider-engineering-defaults`: prefer Server Actions for mutations | Repo has zero Server Actions; the one network mutation is a route handler (`app/api/eleven/signed-url/route.ts:12`) called from the client at `components/voice/voice-session.tsx:414-419` | Route handlers for **all** writes, extending the existing pattern (`CLAUDE.md:13-14`). Server Actions noted once as a wholesale alternative — not a per-feature coin-flip.                                                                                                                                                                                  |
| `haider-engineering-defaults`: TanStack Query for client server-state                             | `CLAUDE.md:54-56` — none by default; local state in a leaf, Context cross-tree, a store only after Context demonstrably hurts                                                              | CLAUDE.md. With state in Redis, most of it is derived from server data anyway — see the boundary plan.                                                                                                                                                                                                                                                      |
| `haider-engineering-defaults`: Base UI primitives, Radix Icons                                    | `components/icons.tsx:1-3` deliberately hand-rolls the set; `CLAUDE.md:121` bans Heroicons                                                                                                 | CLAUDE.md. Extend `components/icons.tsx`.                                                                                                                                                                                                                                                                                                                   |
| `haider-engineering-defaults`: mark privileged modules `server-only`                              | Not installed; `CLAUDE.md:15-16` "every line justifies itself", `:17-18` "no defensive programming"                                                                                        | **Adopt it.** There are now four server secrets instead of one. It is a compile-time guard, not runtime defence, and it turns "leaked a token into the browser bundle" into a build error.                                                                                                                                                                  |
| `haider-engineering-defaults`: Postgres + migrations + pooling                                    | Explicit product decision: key-value only                                                                                                                                                  | The decision. Upstash REST has no connection pool to manage, which is precisely why it suits serverless.                                                                                                                                                                                                                                                    |
| `typescript-best-practices`: `type-fest`, branded types                                           | `CLAUDE.md:23-25` rule of three                                                                                                                                                            | Skip. Not worth a dependency in 24h.                                                                                                                                                                                                                                                                                                                        |
| `vercel-composition-patterns`: compound components, context interfaces                            | `CLAUDE.md:23-25` don't abstract before the third call site                                                                                                                                | Apply only the negative half — no boolean props, use discriminated unions (already done at `voice-session.tsx:19` and `:69`). Do not build compound-component APIs.                                                                                                                                                                                         |
| `vercel:vercel-storage`: `Redis.fromEnv()`, and `@vercel/blob` reads its token from `process.env` | `CLAUDE.md:46-47` "import `env`, never `process.env`" — env is validated once in `lib/env.ts`                                                                                              | Tension, flagged not buried. Recommend validating the vars in `lib/env.ts` and passing them explicitly (`new Redis({ url, token })`, `put(..., { token })`). `fromEnv()` is acceptable if the team prefers the documented shorthand — but then `lib/env.ts` is no longer the single config boundary and a missing var fails with Upstash's error, not ours. |

One skill point that agrees with the repo and now becomes load-bearing:
`typescript-best-practices` says use `safeParse` where failure is expected and
`parse` at boundaries where invalid data is a bug. That is exactly the split the
repo already has (`lib/env.ts:12` parse for config; `voice-session.tsx:418` parse
for our own route). Extraction output is the first place `safeParse` is correct —
a model returning something unusable is an expected outcome, not a bug.

---

## Current-state inventory

Legend: **REAL** = working and load-bearing. **PARTIAL** = works but knowingly
incomplete for the product. **PLACEHOLDER** = exists so a route or import
resolves; carries no product behaviour.

| File                                       | What it is                                                                   | State           | Notes                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                                | Project law: principles, frontend rules, phone shell, voice, design, tooling | REAL            | 147 lines. Overrides all skills.                                                                               |
| `README.md`                                | Run/branch/deploy instructions + a "What's here" tree                        | REAL            | `:50` correctly calls `plan/page.tsx` a placeholder; `:37-38` correctly says typecheck/lint are not in CI.     |
| `Makefile`                                 | 9 targets: `help setup install dev build format lint typecheck clean`        | REAL            | `:4`. `setup` = `pnpm install` + `cp -n .env.example .env` (`:13-14`).                                         |
| `package.json`                             | Deps and scripts                                                             | REAL            | 5 runtime deps (`:16-22`), 10 dev (`:23-34`). Next 16.2.9, React 19.2.7, zod 4.4.3.                            |
| `pnpm-workspace.yaml`                      | `allowBuilds` (3) + `minimumReleaseAgeExclude` (3)                           | REAL            | `:1-4` / `:5-8`. The pinned versions are already stale vs the lockfile — see "Toolchain".                      |
| `tsconfig.json`                            | Strict TS                                                                    | REAL            | `noUncheckedIndexedAccess` (`:13`), `verbatimModuleSyntax` (`:16`), `@/*` alias (`:29-33`).                    |
| `next.config.ts`                           | Two options                                                                  | REAL            | `reactStrictMode` (`:4`), `devIndicators: false` (`:7`). **No `images.remotePatterns`** — matters for Blob.    |
| `eslint.config.mjs`                        | Flat: next core-web-vitals + next/typescript + prettier                      | REAL            | `:7-10`. `prettier` last; ignores `.next/ out/ build/ next-env.d.ts`.                                          |
| `postcss.config.mjs`                       | `@tailwindcss/postcss` only                                                  | REAL            | Tailwind v4 CSS-first. There is no `tailwind.config.js` and there must not be one.                             |
| `vercel.json`                              | framework/install/build/output                                               | REAL            | `:1-6`. No `functions` block, no `maxDuration`, no `regions`.                                                  |
| `.prettierrc` / `.prettierignore`          | 80 cols, double quotes, semis / ignores `.claude` + `.agents`                | REAL            | `.prettierignore:8-9` — Next rewrites `tsconfig.json` and `next-env.d.ts`, so they are excluded.               |
| `.env.example`                             | 3 vars with placeholders + a comment explaining the public/secret split      | REAL            | `XI_API_KEY` (`:8`), `NEXT_PUBLIC_AGENT_ID` (`:11`), `NEXT_PUBLIC_XI_VOICE_ID` (`:16`).                        |
| `.github/workflows/ci.yml`                 | One job: `format`                                                            | PARTIAL         | Runs only `pnpm run format:check` (`:28`). No typecheck, no lint, no build, no deploy.                         |
| `app/layout.tsx`                           | Root layout: two `next/font/google` faces, viewport, metadata                | REAL            | `<html lang="en">` hardcoded at `:50`.                                                                         |
| `app/globals.css`                          | The entire design system in one `@theme inline` block                        | REAL            | `:3-60` tokens, `:62-94` base layer, `:97-99` `.tnum`.                                                         |
| `app/not-found.tsx`                        | Root 404                                                                     | REAL            | The one sanctioned `min-h-dvh` (`:5`) — renders outside the phone group.                                       |
| `app/(phone)/layout.tsx`                   | Mobile shell + desktop iPhone frame                                          | REAL            | Height contract at `:12`, `:20`, `:104`. Heavily commented; read before touching.                              |
| `app/(phone)/page.tsx`                     | Home: two nav cards + language row + privacy card                            | REAL            | Static copy. "Good afternoon." (`:30`) hardcoded — no time logic, no plan data.                                |
| `app/(phone)/check-in/page.tsx`            | Thin Server Component feeding the voice client leaf                          | REAL            | 19 lines. **The template for every new screen.**                                                               |
| `app/(phone)/plan/page.tsx`                | Back button + heading + "Nothing here yet"                                   | **PLACEHOLDER** | 22 lines. `:5` literally says `// Placeholder.` See prose below.                                               |
| `app/api/eleven/signed-url/route.ts`       | GET → mints an ElevenLabs signed WS URL                                      | REAL            | 22 lines. The only route handler. The reference implementation for new ones.                                   |
| `components/voice/voice-session.tsx`       | The one client boundary: idle → conversation, audio-paced reveal             | REAL            | 428 lines. `"use client"` at `:1`. Everything real about the product lives here.                               |
| `components/voice/orb.tsx`                 | `OrbSphere` / `OrbDock` / `VoiceStatusLine`                                  | REAL            | No directive — imported by the client boundary. Animates off `mode`, not `status`.                             |
| `components/voice/transcript.tsx`          | Chat bubbles + the reveal slice + typing dots                                | REAL            | `:19` `live.slice(0, min(revealedCount, live.length))` is the whole reveal contract.                           |
| `components/voice/composer.tsx`            | Docked input pill + end-session X                                            | REAL            | `:41-48` the `+` glyph is explicitly decorative: "There is no attachment flow yet".                            |
| `components/voice/suggested-questions.tsx` | Opening prompts as ≥44px rows                                                | REAL            | Renders whatever `readonly string[]` it is given.                                                              |
| `components/icons.tsx`                     | 10 hand-drawn inline SVG icons                                               | REAL            | `:1-3` explains the deliberate no-library choice.                                                              |
| `components/language-picker.tsx`           | Globe/row triggers + searchable dropdown + 8 inline flag SVGs                | **PLACEHOLDER** | 343 lines of working UI that changes nothing. See prose below.                                                 |
| `components/back-button.tsx`               | Shared back chevron                                                          | REAL            | `:3-4` "server-compatible, no client hooks" — reusable as-is on every new screen.                              |
| `lib/env.ts`                               | The config trust boundary                                                    | REAL            | Browser-safe `env` parsed at module load (`:12`); server-only `serverEnv()` (`:23`).                           |
| `lib/check-in-prompt.ts`                   | Static persona string + 4 English suggested questions                        | **PARTIAL**     | 23 lines. `:2-3` says plan data "gets appended to this block once there is a plan to append". It has not been. |
| `plan/initial-idea.md`                     | The full hackathon plan                                                      | REAL (doc)      | 141 lines. Superseded in places by meeting 2 and by the stack decisions — see "What changed".                  |
| `plan/raw-transcript.md`                   | Both meeting transcripts                                                     | REAL (doc)      | Meeting 2 (`:11-117`, with the medic) supersedes meeting 1.                                                    |
| `tasks/`, `audit/juno-recovery-companion/` | Empty directories                                                            | —               | Untracked scaffolding for this planning phase.                                                                 |

### The three things to be precise about

**`app/(phone)/plan/page.tsx` is a 22-line stub, not a partial implementation.**
It imports `BackButton`, exports `metadata = { title: "Recovery plan" }` (`:3`),
carries the comment `// Placeholder. The day-by-day timeline and its six tracks
land here.` (`:5`), and renders a heading plus "Nothing here yet — this is where
the day-by-day timeline goes." (`:16-18`). No data, no type, no layout
scaffolding, no scroll handling. Whoever builds the timeline starts from an empty
page inside a working frame — the good version of this situation.

**`components/language-picker.tsx` is presentation-only and says so.** The
comment at `:8-10`: "Hardcoded language list — presentation-only in this build.
English + Cymraeg are real; the rest signal multilingual reach for the demo.
Selecting any row just closes the menu; nothing writes to a settings store." The
row handler is literally `onClick={onClose}` (`:217`). Both exported triggers —
`LanguagePicker` (`:249`, the full-width home row) and `LanguageGlobe` (`:307`,
the compact check-in header trigger) — hold their own `open`/`query` `useState`
and share `LanguageMenuPanel` (`:167`). The label "English" is hardcoded at
`:276`. Good news: the eight `code` values at `:11-20` (`en cy pl ro tr pt es
fr`) are **all valid ElevenLabs language codes** — verified against the SDK union
below — so the picker's data is reusable verbatim.

**`lib/check-in-prompt.ts` is a static persona with no plan data.**
`CHECK_IN_PROMPT` (`:4-16`) is one template literal: warm tone, one-to-two
sentence replies, reading age nine, "never invent a medication, a dose, a date or
an instruction", "you are not a clinician… tell them plainly to call 111 — or 999
if it sounds severe". `SUGGESTED_QUESTIONS` (`:18-23`) is four hardcoded English
strings. No interpolation, no plan, no patient, no date, no locale.

### What does not exist at all

No upload anywhere. No timeline, scheduling or date logic — the string
"discharge date" appears nowhere in code. No persistence of any kind today: no
database client, no file writes, no cookies, no `localStorage`, no module-level
mutable state. No tool calling — `useConversation` at `voice-session.tsx:98-159`
is called with callbacks only, no `clientTools`. No escalation, no next-of-kin, no
caregiver view. No drug data. No i18n mechanism — every user-visible string is an
inline English literal (roughly 55 across 12 files, counted by hand). No
`loading.tsx`, `error.tsx`, `template.tsx` or `default.tsx` anywhere. No test
runner and no test files. No `middleware.ts`. No dynamic route segments, so
nothing in the repo yet has to deal with Next 16's async `params`/`searchParams`.

---

## Toolchain & CI — what is actually enforced

**`make` targets** (`Makefile:4`): `help setup install dev build format lint
typecheck clean`. `help` is the default goal and self-documents from the `##`
comments (`:8-11`). `setup` = `pnpm install` + `cp -n .env.example .env`
(`:13-14`). `clean` = `rm -rf .next *.tsbuildinfo` (`:34-35`). Each target is a
one-line passthrough to a `package.json` script (`package.json:6-15`).

**CI enforces exactly one thing: Prettier.** `.github/workflows/ci.yml` has a
single job named `format`. Triggers on `pull_request` into `main` and `push` to
`main` (`:4-8`), Node 26 with the pnpm cache (`:20-23`), installs with
`--frozen-lockfile --ignore-scripts` (`:26`, commented "Prettier is the only thing
this job needs"), runs `pnpm run format:check` (`:28`). That is the whole file.
**No typecheck. No lint. No build. No deploy.** README `:37-38` states this
honestly.

**CI is currently red.** `pnpm exec prettier --check .` fails on
`plan/raw-transcript.md` — the last commit (`dd3de56 docs(plan): append second
planning transcript`) landed without running `make format`. The next PR into
`main` is red before anyone writes a line. Fix: one `make format` run. Note that
anything written into `audit/` is also checked — that directory is not in
`.prettierignore`.

**`lib/env.ts` validates**: a browser-safe schema of `NEXT_PUBLIC_AGENT_ID` and
`NEXT_PUBLIC_XI_VOICE_ID`, both `z.string().min(1)`, parsed at **module scope**
(`:12`) so it throws on import; and a separate `serverSchema` of `XI_API_KEY`
parsed lazily inside `serverEnv()` (`:23-27`) so the secret never sits in a module
a client file can reach. `voice-session.tsx:14` — a `"use client"` file — imports
`env`, which is why the split has to be structural rather than conventional.

**Verified build behaviour** (isolated copy; repo untouched):

- With the developer's real `.env`, `next build` **succeeds**. Next 16 builds with
  **Turbopack** by default and runs TypeScript as part of the build ("Running
  TypeScript … Finished TypeScript"). Route table: `/` ○ static, `/_not-found` ○,
  `/check-in` ○ static, `/plan` ○ static, `/api/eleven/signed-url` ƒ dynamic.
- With `NEXT_PUBLIC_AGENT_ID` and `NEXT_PUBLIC_XI_VOICE_ID` empty, `next build`
  **fails**: `Too small: expected string to have >=1 characters` thrown at module
  evaluation of `lib/env.ts`, surfacing as `Failed to collect page data for
/api/eleven/signed-url`.

Three consequences. First, `/check-in` and `/plan` **prerender static today**;
the new pages read Redis and cookies, so they become dynamic — a conscious flip,
not a surprise. Second, if anyone adds `pnpm build` to CI it needs dummy
`NEXT_PUBLIC_*` values or it fails at `lib/env.ts:12`; `pnpm typecheck` and `pnpm
lint` need no env at all (both verified passing) and are the correct cheap CI
additions. Third — and this is the one that will bite the storage work — **the
same failure mode applies to any client constructed at module scope.**
`Redis.fromEnv()` or a `put()` token read at the top level of a module will crash
`next build` in any environment where the vars are not yet set. The
`vercel:vercel-storage` skill warns about exactly this and prescribes lazy
initialisation; the repo already demonstrates the fix at `lib/env.ts:23`. Details
in the structure section.

**`pnpm-workspace.yaml`'s `minimumReleaseAgeExclude`** (`:5-8`) lists
`@types/node@26.0.1`, `@elevenlabs/client@1.13.0`, `@elevenlabs/react@1.8.0`.
pnpm 11 quarantines newly-published versions for a minimum age before installing
them; this list is the per-version escape hatch, which is why `CLAUDE.md:143-144`
says installs fail without it. The entries are now **stale relative to the
lockfile**: `package.json:17` asks for `@elevenlabs/react ^1.8.0` and
`pnpm-lock.yaml:13` resolved `1.10.2`, pulling `@elevenlabs/client@1.15.2`. Those
are old enough now that the gate no longer bites. Operational rule: **never
delete the block**; if an install errors on release age, add that exact
`name@version` as a further entry. This is now much more likely — three new
packages land at once and `ai` publishes very frequently, so expect to add an
`ai@<version>` line. `allowBuilds` (`:1-4`) is the separate pnpm 11
postinstall-approval list (`esbuild`, `sharp`, `unrs-resolver`; `sharp` is not
currently installed, the entry is pre-approval for Next's optional image dep).

---

## Established patterns to extend

**1. Server Components by default, one client boundary, pushed to the leaf.**
Exactly two files carry `"use client"`: `components/voice/voice-session.tsx:1`
and `components/language-picker.tsx:1`. Everything under `components/voice/` —
`orb.tsx`, `transcript.tsx`, `composer.tsx`, `suggested-questions.tsx` — has **no
directive of its own**; they are client-rendered purely by being imported at
`voice-session.tsx:10-13`. `CLAUDE.md:34-36` states this explicitly. New
presentational components follow the same rule.

**2. The thin Server Component page that feeds a client leaf.**
`app/(phone)/check-in/page.tsx` is 19 lines: import the client component and the
data (`:1-2`), export `metadata` (`:4`), return `<VoiceSession title=… blurb=…
systemPrompt={CHECK_IN_PROMPT} …/>` (`:10-17`). The comment at `:6-8` names it:
"A thin Server Component: it hands the prompt and opening copy into the client
leaf, which owns the … flow." Every new interactive screen is this shape.

**3. Zod only at trust boundaries, and only three kinds of them.** Config:
`lib/env.ts:7-15` and `:17-27`. An external API response:
`app/api/eleven/signed-url/route.ts:8` (`signedUrlSchema`), parsed at `:20`. Our
own route's response read back over the network: `voice-session.tsx:412`, with
the comment at `:410-411` — "Our own route's response is still a network
boundary, so parse it rather than asserting the shape." Nothing else in the repo
is validated at runtime, and nothing else should be. The new work adds three more
instances of the same three kinds: request bodies, LLM output, and Redis reads.

**4. The route-handler shape.** `app/api/eleven/signed-url/route.ts`: read the
secret through `serverEnv()` **inside** the handler (`:13`), `fetch` upstream with
`cache: "no-store"` (`:16`), check `r.ok` and return a coded
`NextResponse.json({ error: … }, { status: 502 })` (`:18-19`), Zod the upstream
body (`:20`), return only the narrow field the browser needs (`:21`). The comment
at `:10-11` states the security contract: the key is a request header, never a
response body.

**5. The client-side call to our own route.** `fetchSignedUrl()` at
`voice-session.tsx:414-419` — plain `fetch`, throw a **user-facing sentence** on
`!res.ok`, Zod the JSON. Paired with `messageOf(e)` at `:421-427`, which narrows
`unknown` (`DOMException`/`Error`/fallback) into a sentence rendered inline with
`role="alert"` (`:304-311`, `:378-385`). Every new client-triggered write copies
this exactly.

**6. Design tokens in one `@theme` block.** `app/globals.css:3` opens `@theme
inline`; fonts `:6-8`, brand `:10-17`, status `:19-23`, surfaces `:25-29`, ink
`:31-35`, accent `:37-40`, rules `:42-44`, radii `:46-50`, `--shadow-card`
`:52-54`, `--color-bezel` `:56-59`. Components reference these only as Tailwind
utilities. The one sanctioned raw hex in a component is the orb gradient at
`orb.tsx:20-21`, plus `themeColor` at `app/layout.tsx:28` (reason in the comment
at `:23`). There is no `tailwind.config.js`; adding one breaks the setup. The
existing status tokens (`--color-success`, `--color-warning`, `--color-error` at
`globals.css:19-23`) are currently unused and are exactly what the escalation and
red-flag UI needs — no new tokens required.

**7. File naming.** `kebab-case.tsx` exporting `PascalCase`, one concern per
file: `back-button.tsx` → `BackButton`, `language-picker.tsx` → `LanguagePicker` +
`LanguageGlobe`. Route files use Next's reserved names. No `index.ts` barrels
exist; imports go to the real path via the `@/*` alias (`tsconfig.json:29-33`),
e.g. `voice-session.tsx:8-14`. Hooks would be `use-*.ts` (`CLAUDE.md:60`) — there
are none yet.

**8. The phone-shell height contract.** `app/(phone)/layout.tsx:12` — outer
wrapper `min-h-dvh bg-mist lg:grid …`. `:20` — the device is a **fixed** height
(`h-dvh` on a phone, `lg:h-[852px]` on desktop) with `overflow-hidden`. `:104` —
the inner scroll region is `flex min-h-0 flex-1 flex-col overflow-y-auto` with
safe-area insets applied **once**. Every page inside starts `flex min-h-0 flex-1
flex-col` (`page.tsx:21`, `plan/page.tsx:8`, `voice-session.tsx:285`) and never
uses `dvh`/`vh`. The comment at `:96-103` anticipates the timeline:
"overflow-y-auto lets a page taller than the frame scroll (the day-by-day plan)".

**9. Provider-wraps-a-subtree, not a directive on the layout.**
`voice-session.tsx:49-55`: `VoiceSession` renders `<ConversationProvider><Session
{...props}/></ConversationProvider>`, with the comment at `:46-48` explaining the
provider must wrap every component calling `useConversation*`. Keep this in mind
even though — see below — the storage decision removes the need for a _second_
provider.

**10. Discriminated unions over booleans.** `type Phase = "idle" |
"conversation"` (`:19`), `entryMode: "voice" | "text"` (`:69`), `role: "user" |
"agent"` (`transcript.tsx:3`). Config-shaped literals use `as const`
(`app/(phone)/page.tsx:17`, `check-in-prompt.ts:23`). No `forwardRef` anywhere —
`composer.tsx:18` puts a plain `useRef` straight onto the `ref` prop, the React 19
way, matching `vercel-composition-patterns`' `react19-no-forwardref`.

**11. Lazy, per-subsystem secret access.** `lib/env.ts:21-27` — `serverEnv()` is
a _function_, not a module-scope constant, and the comment says why: "Server only.
Never import into a client component. Called only inside /api/eleven/signed-url
so the ElevenLabs key never enters the browser bundle." This is the single most
important pattern for the new work, because it is simultaneously the fix for the
build-time crash verified above and the boundary that keeps four secrets out of
the client bundle.

**12. ElevenLabs session configuration is a per-session override.**
`voice-session.tsx:217-230`: `startSession({ signedUrl, overrides: { agent: {
prompt: { prompt: systemPrompt }, language: "en", firstMessage }, tts: { voiceId }
} })`. The comment at `:221-223` and README `:70-74` both warn the override
**replaces** the agent's dashboard prompt, so "the persona + concision rules must
travel with whatever data they operate on". This is the hook the plan attaches to.

**Verified SDK capabilities the new work depends on** (read from the installed
`@elevenlabs/react@1.10.2` / `@elevenlabs/client@1.15.2` type definitions):

- `useConversationClientTool(name, handler)` is exported
  (`@elevenlabs/react/dist/index.d.ts:12`). It registers a named client tool with
  the nearest `ConversationProvider`, auto-unregisters on unmount, and uses a
  latest-closure ref so the handler reads current component state without
  dependency lists. **Tool calling needs no new architecture** — a hook call
  inside `Session`, which is already inside the provider.
- The handler's parameter type at the React layer is `Parameters extends
Record<string, unknown>` (`@elevenlabs/react/dist/conversation/types.d.ts:3`) —
  `unknown` values, not `any`. Tool arguments come from an LLM, so **this is a
  trust boundary and must be Zod-parsed**. (The lower-level client type at
  `BaseConversation.d.ts:33` is `any`; use the React layer.)
- `overrides.agent.language` is typed `ConversationConfigOverrideAgentLanguage`,
  whose union
  (`@elevenlabs/types/dist/generated/types/asyncapi-types.d.ts:58`) **includes
  `"cy"`** — Welsh is type-supported, as are all eight picker codes.
- `dynamicVariables?: Record<string, string | number | boolean>` exists on the
  session config (`@elevenlabs/client/dist/utils/BaseConnection.d.ts:43`) — a
  cheaper way to inject patient name / day number than rebuilding the prompt.
- `toolMockConfig` (`BaseConnection.d.ts:44-51`) can mock tool calls during a
  demo. Worth knowing exists; not a plan.

---

## Proposed structure for the new work

`=` unchanged · `~` modified · `+` new.

```
app/
  layout.tsx                      ~ <html lang> becomes dynamic (await cookies())
  globals.css                     = no new tokens; success/warning/error already exist unused
  (phone)/
    layout.tsx                    = UNCHANGED — no provider needed; state lives in Redis
    error.tsx                     + one route-group error boundary (Next requires "use client" here)
    page.tsx                      ~ home gains a "due today" summary + links to /upload and /family
    upload/page.tsx               + Server Component shell -> <UploadPanel/> client leaf
    plan/page.tsx                 ~ replace placeholder: async, Promise.all([getPlan(), getLog()])
    family/page.tsx               + async Server Component + <RefreshPoller/> client leaf
    check-in/page.tsx             ~ reads locale + plan, builds the prompt, passes copy down
  api/
    eleven/signed-url/route.ts    = untouched
    blob/upload/route.ts          + POST — mints the Blob client-upload token (handleUpload)
    extract/route.ts              + POST { blobUrls } -> AI SDK -> PlanSchema -> write to Redis
    log/route.ts                  + POST — records an adherence entry (called by tool + checkbox)
    locale/route.ts               + POST — sets the locale cookie
    drug-info/route.ts            + GET ?drug= -> lib/drugs/lookup, scoped to this plan's drugs
    seed/route.ts                 + POST — writes the sample patient + plan into Redis
components/
  icons.tsx                       ~ add IconUpload, IconCamera, IconCalendar, IconPill, IconAlert, IconCheck
  back-button.tsx                 = reused as-is on every new screen
  language-picker.tsx             ~ rows POST /api/locale then router.refresh(); label reflects locale
  upload/
    upload-panel.tsx              + "use client" — file input, Blob client upload, POST /api/extract
    extracted-preview.tsx           no directive — renders the returned Plan (imported by the panel)
  plan/
    timeline.tsx                    no directive — maps days to <DaySection>
    day-section.tsx                 no directive — one day's heading + its items
    task-row.tsx                    no directive — one item; renders <TaskCheck> when tickable
    task-check.tsx                + "use client" — the ONLY interactive leaf in the timeline
    red-flag-card.tsx               no directive — verbatim red-flag lines + call-111 affordance
  family/
    escalation-card.tsx             no directive — renders the escalation decision (server)
    refresh-poller.tsx            + "use client" — router.refresh() on an interval, renders null
  voice/
    voice-session.tsx             ~ language prop, client tools, plan-aware copy
    orb.tsx transcript.tsx composer.tsx suggested-questions.tsx   = shape unchanged, strings via props
lib/
  env.ts                          ~ add llmEnv(), blobEnv(), redisEnv() beside serverEnv(). `env` untouched.
  check-in-prompt.ts              ~ becomes buildCheckInPrompt(plan, todaysItems, locale)
  plan/
    schema.ts                     + Zod PlanSchema + `export type Plan = z.infer<typeof PlanSchema>`
    samples/margaret-hip.ts       + synthetic seed fixture, `satisfies Plan`
  store/
    redis.ts                      + lazy client factory + the key-name helpers. THE only Redis module.
    plan.ts                       + readPlan / writePlan — PlanSchema.parse on read
    log.ts                        + readLog / appendLog — LogSchema.parse on read
    patient.ts                    + readPatient / writePatient
  timeline/schedule.ts            + pure: buildTimeline(plan, today), dueToday(plan, today)
  escalation/rules.ts             + pure: assess(plan, logs, today) -> discriminated union
  extraction/extract.ts           + server-only: blob URLs -> AI SDK -> PlanSchema.safeParse
  drugs/lookup.ts                 + server-only: external source fetch + Zod parse
  i18n/
    locales.ts                    + the Locale union + the 8 code/label entries
    dictionary.ts                 + getDictionary(locale) + the Dictionary type
    en.ts  cy.ts                  + the two real dictionaries
```

### Rationale, per item

**`lib/plan/schema.ts`** — extends the trust-boundary Zod pattern at
`lib/env.ts:7-10` and `app/api/eleven/signed-url/route.ts:8`. One Zod object,
`export type Plan = z.infer<typeof PlanSchema>` as the single source of truth
(`typescript-best-practices`). It does **three** jobs now: the structured-output
schema handed to the model, the parse of the model's output, and the parse of
every read out of Redis. Shape follows `plan/initial-idea.md:66` — meds,
wound/activity guidance, follow-ups, and **red flags as their own list**, every
clinical string carrying its verbatim text plus a source reference. Locking the
exact fields is `plan/initial-idea.md:139`'s job and belongs to the extraction
track; this audit only fixes where it lives. One new field the Blob decision makes
possible and worth having: each source reference can carry the **blob URL and page
index** of the photo it came from, so a red-flag line links back to the image of
the page — the strongest possible expression of `initial-idea.md:26`.

**`lib/store/redis.ts` — the single Redis module, and the only place a client is
constructed.** Three non-negotiables, each grounded:

1. **Lazy construction, never module scope.** `const redis = Redis.fromEnv()` at
   the top of a module crashes `next build` wherever the vars are unset — the
   exact failure I verified for `lib/env.ts:12`, and the failure the
   `vercel:vercel-storage` skill warns about. Wrap it: a `function client()` with
   a module-level `let` cache, mirroring `serverEnv()` at `lib/env.ts:23`.
2. **Do not wrap the client in a `Proxy`.** The storage skill calls this out
   explicitly as a pattern that breaks libraries which introspect the client. A
   plain lazy `let` is the answer.
3. **Construct it explicitly from validated env**, `new Redis({ url, token })`
   with values from `redisEnv()`, rather than `Redis.fromEnv()`. `CLAUDE.md:46-47`
   says import `env`, never `process.env`, and `fromEnv()` reaches into
   `process.env` behind our back. This is a two-line difference and it keeps
   `lib/env.ts` the single config boundary. Flagged above as a deviation from the
   skill's shorthand; the team can take the shorthand if it prefers, knowing the
   trade.

**Key-naming scheme.** One demo patient, so `patientId` is the constant `"demo"`
— do not build auth or multi-tenancy. All keys prefixed so a stray `SCAN` on a
shared Upstash instance is legible:

| Key                          | Value                                   | Written by                  | Read by                         |
| ---------------------------- | --------------------------------------- | --------------------------- | ------------------------------- |
| `juno:patient:{id}`          | name, discharge date, locale, caregiver | `/api/seed`, `/api/locale`  | every screen                    |
| `juno:plan:{id}`             | the extracted `Plan`                    | `/api/extract`, `/api/seed` | `/plan`, `/check-in`, `/family` |
| `juno:log:{id}:{yyyy-mm-dd}` | that day's adherence entries            | `/api/log`                  | `/plan`, `/family`, voice tools |
| `juno:upload:{id}`           | the blob URLs of the source bundle      | `/api/extract`              | source-linking in the plan UI   |

Day-scoped log keys mean "what happened today" is a single `GET`, and the
escalation rule's "last N days" is a small `MGET` over generated key names — no
scan, no index, no schema. `@upstash/redis` serialises and deserialises JSON
automatically, so values are stored as objects.

**Redis reads are a trust boundary.** `redis.get<Plan>(key)` is an _unchecked_
generic — the value crossed a network and TypeScript is simply believing the
annotation. `lib/store/plan.ts` therefore does `PlanSchema.parse(raw)` on read.
This is not the defensive programming `CLAUDE.md:17-18` forbids: that rule
explicitly carves out "genuinely uncertain inputs like a network call, which you
must model", and an Upstash REST `GET` is exactly a network call. It also pays for
itself during a 24-hour build, when the schema will change under data already
sitting in Redis and you want a loud failure rather than an `undefined` three
components deep.

**Blob: client upload, not server `put`.** `components/upload/upload-panel.tsx`
calls `upload(filename, file, { access, handleUploadUrl: "/api/blob/upload" })`
from `@vercel/blob/client`. The browser fetches a short-lived token from our route
and then uploads **directly to Blob storage**, never through the function. This is
the right call for phone camera capture for a concrete reason: a server-side
`put()` requires the file to travel in the request body of a serverless function,
which is capped in the low single-digit megabytes (4.5 MB is the long-standing
figure — verify against current docs). A three-page bundle of phone photos blows
straight through that. Client upload supports up to 5 TB and removes the limit
from the design entirely. `BLOB_READ_WRITE_TOKEN` stays server-side in both cases;
with client upload it is used only to mint the token inside
`app/api/blob/upload/route.ts`. That route is a real trust boundary — it decides
in `onBeforeGenerateToken` which content types and sizes are allowed, and it is
the only thing standing between an open internet endpoint and your Blob store.
**[verify after install]** the exact `handleUpload` import and signature from the
package's own docs.

**Do not put the extraction inside Blob's `onUploadCompleted` callback.** That
callback is delivered by Vercel as a webhook and cannot reach `localhost`, so
anything required for the flow would work in production and silently not work in
dev — the worst failure mode 12 hours before a demo. Instead the panel collects
the returned URLs and makes a second, explicit call: `POST /api/extract` with
`{ blobUrls: string[] }`. That request body is small, so `/api/extract` never
touches the body-size limit either.

**`access: 'public'` vs `'private'` is a real decision, and the UI already made a
promise.** `app/(phone)/page.tsx:88-91` renders "Your data stays private. We
don't share your health information with anyone you haven't chosen." A public
blob URL for a discharge letter is unguessable but genuinely public, which
contradicts that sentence on the same device. For the hackathon the data is
synthetic (`plan/raw-transcript.md:88-90`), so `public` is defensible and
simpler. If `private` is used instead, the model can no longer fetch the file by
URL and `lib/extraction/extract.ts` must `get()` the bytes server-side and pass
them inline — more code, more tokens, but honest. Decide deliberately; do not
default into it.

**`lib/extraction/extract.ts` — the AI SDK call, server-only.** Per the
`vercel:ai-sdk` skill's bundled reference, the current API is `generateText` with
the `output` option; **`generateObject` is deprecated**:

```ts
import { generateText, Output } from "ai";
const result = await generateText({
  model: "anthropic/claude-sonnet-5",
  output: Output.object({ schema: PlanSchema }),
  // ... message with the discharge-letter file parts
});
result.output; // typed as Plan
```

Three things the implementing agent must do rather than trust: **[verify after
install]** the exact shape of file/image message parts for a PDF and a JPEG;
**[verify after install]** whether `Output.object` returns a parsed value or
whether an explicit `PlanSchema.safeParse` is still wanted at the route boundary
(prefer `safeParse` regardless — a model returning something unusable is an
expected outcome, so the route can return a 422 with a user-facing sentence the
way `route.ts:18-19` returns a coded 502); and **fetch the model ID live** rather
than hardcoding one from memory —
`curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id |
startswith("anthropic/")) | .id] | reverse | .[]'`. I ran that endpoint today and
it responded; `anthropic/claude-opus-5` and `anthropic/claude-sonnet-5` were
present. Also note `maxTokens` was renamed `maxOutputTokens`. The gateway is the
SDK's default global provider, so a `"provider/model"` string is enough and **no
`@ai-sdk/*` provider package is needed**.

**`lib/plan/samples/margaret-hip.ts` is a seed, not a data source.** Written as
`export const MARGARET_HIP = { … } satisfies Plan` — a TypeScript module rather
than JSON, so `tsc` catches fixture drift the moment the schema changes, which
will happen several times in 24 hours. A `.json` import under `resolveJsonModule`
(`tsconfig.json:22`) is type-widened and would need its own runtime parse.
`satisfies` over `as` is `CLAUDE.md:39-40`. `POST /api/seed` writes it into Redis,
and a `make seed` target (`curl -X POST localhost:3000/api/seed`) gives a
one-command reset to a known demo state — genuinely valuable when you are
re-running a demo at 3am. Note this fixture is explicitly throwaway: whatever the
medic generates **is** the demo (`plan/raw-transcript.md:88-90`), so it must be
easy to delete, and the `Plan` schema must be **condition-agnostic** because the
case is not yet chosen (`:91-97`).

**`lib/timeline/schedule.ts`** — pure functions, no I/O, no React, importing
nothing but `lib/plan/schema.ts`. Purity is not aesthetic: **the same function
runs in two runtimes** — on the server to render `/plan`, and in the browser
inside the voice tool handler that answers "what am I meant to take today?". Any
server-only import breaks the second use. Four call sites (plan page, home
summary, prompt builder, tool handler) satisfy `CLAUDE.md:23-25`.

**`lib/escalation/rules.ts`** — same purity argument, though with state in Redis
its main caller is now server-side. One exported function returning a
discriminated union (`{ kind: "none" } | { kind: "nudge"; … } | { kind:
"alert-kin"; … }`) so the consumer's `switch` is exhaustive — the pattern already
at `voice-session.tsx:19` and `:69`.

**`lib/drugs/lookup.ts`** — server-only, fetches whatever source the drug track
picks (meeting 2 nominates the BNF, `plan/raw-transcript.md:45-51`) and Zod-parses
the response: the same trust boundary as `route.ts:8`. Two call sites justify it —
the `/api/drug-info` handler (for the voice tool) and the plan page's medication
rows, rendered server-side. **Safety constraint, in code not in a comment:**
`plan/initial-idea.md:99` explicitly cuts open-web "ask anything" Q&A, so
`app/api/drug-info/route.ts` must validate the requested drug against the names in
the patient's stored plan and 404 anything else. That is a five-line guard that
keeps the feature inside the scope line at `initial-idea.md:30`, and it means the
route Zod-parses its `searchParams` — named as a trust boundary at `CLAUDE.md:44`.

**All writes are route handlers, called from the client with the
`fetchSignedUrl` idiom.** `/api/log`, `/api/locale`, `/api/extract` each
Zod-parse their request body (a trust boundary), do the work, and return a narrow
JSON result; the caller then calls `router.refresh()` so the server tree re-reads
Redis. This extends `app/api/eleven/signed-url/route.ts:12` and
`voice-session.tsx:414-419` rather than introducing anything. **Server Actions are
the reasonable alternative** — they would remove the JSON plumbing and offer
`revalidatePath` — but they are a new primitive for this repo and `CLAUDE.md:13-14`
says follow the patterns already here. If the team wants them, adopt them
wholesale for all four writes, not one at a time.

**`lib/env.ts` gains three sibling functions; the `env` object is untouched.**
This is the most safety-critical item in the plan, so it is spelled out exactly:

| Var                        | Where it goes                     | Why                                                                      |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_AGENT_ID`     | `env` (module-scope parse, `:12`) | Already there. Browser-safe by design (`.env.example:10`).               |
| `NEXT_PUBLIC_XI_VOICE_ID`  | `env`                             | Already there. Set as a per-session TTS override (`.env.example:13-15`). |
| `XI_API_KEY`               | `serverEnv()` (`:23`)             | Already there. **Leave uncoupled.**                                      |
| `AI_GATEWAY_API_KEY`       | **new `llmEnv()`**                | Server-only secret. Never in `env`.                                      |
| `BLOB_READ_WRITE_TOKEN`    | **new `blobEnv()`**               | Server-only secret. Never in `env`.                                      |
| `UPSTASH_REDIS_REST_URL`   | **new `redisEnv()`**              | Not secret on its own, but pointless to split from the token.            |
| `UPSTASH_REDIS_REST_TOKEN` | **new `redisEnv()`**              | Server-only secret. Never in `env`.                                      |

Two rules behind that table. **Nothing without a `NEXT_PUBLIC_` prefix may be
added to the `env` object**, because the parse at `lib/env.ts:12` is module-scope
and `voice-session.tsx:14` — a `"use client"` file — imports it. I verified that a
missing value there fails the entire build; a _secret_ there would ship to the
browser. And **four separate functions rather than one fat `serverEnv()`**,
because the whole point of the lazy split (the comment at `lib/env.ts:21-22`) is
that a missing secret breaks only the feature that needs it. A single combined
schema would mean an unset AI Gateway key throws inside the ElevenLabs route and
kills the voice demo. Four subsystems, four failure domains, one existing pattern
applied four times — not four new abstractions.

**`lib/i18n/*`** — the library choice belongs to another track; the placement and
the flow do not. Recommended flow, in order of how little it disturbs the repo:

1. `locales.ts` exports `LOCALES` (the eight `code`/`label` pairs lifted from
   `language-picker.tsx:11-20`) and `export type Locale = (typeof
LOCALES)[number]["code"]`. The `FlagIcon` SVGs stay in the picker — presentation.
2. `en.ts` / `cy.ts` each export an object of the ~55 strings. `dictionary.ts`
   exports `getDictionary(locale)`, a `switch` returning `en` for the six showcase
   locales. Not a barrel (`CLAUDE.md:60-61` bans `index.ts` re-export files); a
   function with a body.
3. Locale lives in a **cookie**, read on the server with `await cookies()`. It is
   also mirrored onto `juno:patient:{id}` so the voice agent and the caregiver view
   agree on it. No `[locale]` route segment: that rewrites every path and
   invalidates every existing `<Link href>` (`page.tsx:40`, `back-button.tsx:13`,
   `voice-session.tsx:289`) under Next 16's typed routes, for an SEO benefit a
   phone-shell demo does not have.
4. `POST /api/locale` sets the cookie via `NextResponse.cookies.set`; the picker's
   row handler (`language-picker.tsx:217`) calls it, then `router.refresh()`. Same
   route-handler idiom as every other write — **zero new Next primitives in the
   whole plan.**

**The family dashboard: polling via `router.refresh()`, and here is exactly why.**
Upstash Redis is REST-based and has no persistent connection, therefore no pub/sub
and no subscriptions — the same property that makes it right for serverless makes
it unable to push. Server-Sent Events would need a long-lived function and its own
route; a WebSocket needs infrastructure this stack does not have. For a
thirty-second demo beat, a five-second poll is the correct engineering answer.
Concretely:

- `app/(phone)/family/page.tsx` is an **async Server Component**. It reads Redis
  directly — no route handler needed for reads — with
  `const [patient, plan, logs] = await Promise.all([...])`, because sequential
  awaits that do not depend on each other are the waterfall bug `CLAUDE.md:49-51`
  names. It then calls `assess()` from `lib/escalation/rules.ts` and renders
  `<EscalationCard/>` — all server, zero JS.
- `components/family/refresh-poller.tsx` is `"use client"`, roughly twelve lines:
  a `useEffect` with `setInterval(() => router.refresh(), 5000)` and a cleanup,
  returning `null`. It is the only client file on that page and it does **not**
  pull the page client, because it is a leaf import. `router.refresh()` re-fetches
  the server tree and reconciles it **without discarding client state** — the right
  primitive.
- A component that renders `null` and exists only to hold an effect looks like the
  kind of thing `CLAUDE.md:23-25` warns about. It is not: a client directive
  cannot be "inlined" into a Server Component, so a separate file is the minimum
  possible implementation. Worth a one-line comment saying so, or a reviewer will
  flag it.
- Set `export const dynamic = "force-dynamic"` on `/family` and `/plan`. Without
  it there is a real risk that `router.refresh()` replays a cached render instead
  of re-reading Redis — Next's caching defaults are the single most-changed thing
  across versions, so make it explicit rather than inferred, and confirm
  empirically with one manual test.

**`app/(phone)/layout.tsx` needs no change at all.** With adherence in Redis
there is no cross-tree client state to host, so no second Context provider and no
temptation to reach for `"use client"` on a layout. This also makes the demo
strictly better than a client-state design could: the caregiver dashboard on a
second screen genuinely reflects what the patient just logged on the phone,
because both are reading the same Redis keys.

**No new routes beyond those listed.** Specifically no `/plan/[day]` — one
scrolling timeline anchored on today is enough, the frame already scrolls
(`layout.tsx:96-103`), and a dynamic segment would be the repo's first encounter
with async `params`.

**No `loading.tsx` — with one possible exception.** `/plan` and `/family` now
await Redis, which is a fast REST round-trip; a `loading.tsx` would flash and
vanish. The genuinely slow operation, extraction, happens inside the client leaf's
own pending state after a user gesture, not during a route transition. If the
Redis read on `/plan` proves visibly slow in practice, add `loading.tsx` then — not
speculatively (`CLAUDE.md:15-16`). One `app/(phone)/error.tsx` **is** worth it:
without it, a schema mismatch or a Redis failure renders Next's default error page
**outside** the phone frame, which looks catastrophic on stage. Next requires
`"use client"` on `error.tsx`; that is a framework contract, not a violation of
`CLAUDE.md:63` — `error.tsx` is neither a page nor a layout.

---

## Server/Client boundary plan for the new screens

| Component                                                                              | Directive               | Why                                                                                                                                      |
| -------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(phone)/layout.tsx`                                                               | **none — unchanged**    | No provider needed. State is in Redis.                                                                                                   |
| `app/(phone)/upload/page.tsx`                                                          | **none**                | Shell + heading + `<UploadPanel/>`. Exact shape of `check-in/page.tsx:9-19`.                                                             |
| `components/upload/upload-panel.tsx`                                                   | **"use client"**        | `<input type="file" accept="image/*,application/pdf" capture>`, Blob client `upload()`, `POST /api/extract`, pending/error/result state. |
| `components/upload/extracted-preview.tsx`                                              | none                    | Imported by the panel, so already client-side. No directive of its own — the `components/voice/` rule (`CLAUDE.md:34-36`).               |
| `app/(phone)/plan/page.tsx`                                                            | **none — async server** | `Promise.all([readPlan(), readLog(today)])`, `buildTimeline()`, renders `<Timeline/>`. `export const dynamic = "force-dynamic"`.         |
| `components/plan/timeline.tsx`, `day-section.tsx`, `task-row.tsx`, `red-flag-card.tsx` | **none — server**       | Presentational. Zero JS shipped for the whole timeline body.                                                                             |
| `components/plan/task-check.tsx`                                                       | **"use client"**        | The single interactive leaf: optimistic tick, `POST /api/log`, `router.refresh()`. One island in a server-rendered list.                 |
| `app/(phone)/family/page.tsx`                                                          | **none — async server** | Reads Redis, runs `assess()`, renders server components. `export const dynamic = "force-dynamic"`.                                       |
| `components/family/escalation-card.tsx`                                                | **none — server**       | Pure rendering of a discriminated union. No interactivity.                                                                               |
| `components/family/refresh-poller.tsx`                                                 | **"use client"**        | `setInterval(() => router.refresh(), 5000)`, returns `null`. The only client file on that page.                                          |
| `app/(phone)/check-in/page.tsx`                                                        | **none — async server** | `await cookies()` for locale, read plan + today's items from Redis, `buildCheckInPrompt(...)`, pass a small `copy` object down.          |
| `components/voice/voice-session.tsx`                                                   | already `"use client"`  | Gains `locale` for `overrides.agent.language`, the tool registrations, and `copy`.                                                       |
| `lib/timeline/schedule.ts`, `lib/escalation/rules.ts`                                  | n/a — pure              | Must import nothing server-only; they run in both runtimes.                                                                              |
| `lib/store/*`, `lib/extraction/*`, `lib/drugs/*`                                       | n/a — **server-only**   | Hold or reach secrets. Must never appear in a client import graph. Mark with `server-only`.                                              |

### Where the boundaries actually fall, and why

The upload screen is inherently interactive and the timeline is inherently data,
so they sit at opposite ends. The upload page keeps a server shell and pushes
every stateful thing — the file input, the Blob upload progress, the extraction
call, the error message — into one leaf, `upload-panel.tsx`. The timeline is the
reverse: the entire tree is server-rendered from Redis, and exactly one leaf
(`task-check.tsx`) is a client component. The family dashboard is server-rendered
too, with a single non-visual client leaf whose only job is to re-trigger the
server render.

The voice screen is the one place where a client component performs writes, and
that is unavoidable: ElevenLabs client tools execute **in the browser**. So the
tool handler does `fetch("/api/log", …)` — the same shape as `fetchSignedUrl()` at
`voice-session.tsx:414-419` — and `lib/store/*` is never imported by a client
file. (ElevenLabs _server_ tools could call our API directly, but that needs a
publicly reachable URL and dashboard configuration; worse for a hackathon.)

### Where a naive implementation goes wrong

1. **`"use client"` on `app/(phone)/upload/page.tsx`** because "the upload screen
   is interactive". Drags the page and its imports into the bundle;
   `CLAUDE.md:63` bans it. The interactivity lives in one leaf.
2. **`"use client"` on `app/(phone)/layout.tsx`** to host a state provider. Under
   this design there is nothing to host, but the instinct will still arrive when
   someone wants optimistic UI. It would pull **every phone screen** into the
   client bundle. If a provider ever is needed, use the composition already at
   `voice-session.tsx:49-55`: the provider file is `"use client"`, the layout is
   not, and `{children}` passes through as a prop.
3. **`const redis = Redis.fromEnv()` at module scope.** Crashes `next build`
   wherever the vars are unset — verified failure mode. Lazy factory only.
4. **Importing `lib/store/*` from a client component** to "just read the plan".
   Ships the Redis token to the browser. `server-only` turns this into a build
   error; without it, nothing stops it.
5. **Adding a server secret to the `env` object in `lib/env.ts`.** The parse at
   `:12` is module-scope and `voice-session.tsx:14` imports it, so the value must
   exist in the browser. Verified that a missing value fails the whole build; a
   secret there would be worse than a crash.
6. **Trusting `redis.get<Plan>()`.** The generic is unchecked. Parse it.
7. **Doing the extraction in Blob's `onUploadCompleted` webhook.** Works in
   production, silently does nothing on `localhost`.
8. **Server-side `put()` for the discharge photos.** Hits the serverless request
   body limit on a multi-page phone-camera bundle.
9. **Importing `lib/i18n/en.ts` and `cy.ts` into a client component.** Both
   dictionaries ship. Client leaves receive a small `copy` prop of just the strings
   they render — `orb.tsx:115-123`'s four status labels, `composer.tsx:53-68`'s
   placeholder and aria-labels, `suggested-questions.tsx:18`'s heading.
10. **Making `components/plan/timeline.tsx` client because one row ticks.** Push
    the boundary down to `task-check.tsx`.
11. **`useState` at the top of the plan page for "which day is expanded".** Use a
    native `<details>` (zero JS) or push it into a leaf. `CLAUDE.md:54-56`.
12. **Rendering blob images with `<img>` or with `next/image` and no config.**
    `next.config.ts` has no `images.remotePatterns`, so `next/image` will refuse
    the Blob hostname; `<img>` trips `eslint-config-next`'s `no-img-element`. Add
    the remote pattern deliberately.

---

## Risks & gaps in the current code

**1. `overrides.agent.language` is hardcoded `"en"` — `voice-session.tsx:225`.**
Welsh voice will not work until this becomes a prop. Confirmed `"cy"` is valid in
the SDK's language union
(`@elevenlabs/types/dist/generated/types/asyncapi-types.d.ts:58`), so this is
plumbing, not a capability gap. Two non-code dependencies remain: the ElevenLabs
agent must list Welsh in its additional languages, and the voice at
`NEXT_PUBLIC_XI_VOICE_ID` (`.env.example:16`) must actually speak it. Both are
dashboard configuration — verify before the demo, not at 4am.

**2. The prompt override silently no-ops if the agent forbids overrides.** README
`:70-74` and the comment at `voice-session.tsx:221-223`. Today that only costs the
persona. Once the plan is appended (`check-in-prompt.ts:2-3`), a silent override
failure means **the agent answers with no plan data at all** and falls back to its
dashboard prompt — the worst possible demo failure, and it produces no error.
Verify the agent's security setting explicitly, early.

**3. `end()` clears the transcript — `voice-session.tsx:250-253`.** Anything
logged during a call must reach `/api/log` **as it happens**, not be accumulated in
component state and flushed at the end, because `setTranscript([])` at `:251` and
the `phase` reset discard everything held locally. Write on each tool call.

**4. Module-level state on serverless — the risk that drove the stack decision,
now mitigated.** The reasoning is worth keeping because it is _why_ Upstash is
here: a `let` at module scope in a route handler survives only within one warm
serverless instance, and a second request can hit a cold instance, a different
instance or a different region and see `null`. It produces a demo that works on
the laptop and fails on the deploy link. Redis removes that failure class
entirely, and it removes it for reads _and_ writes across two devices at once —
which the family-dashboard beat actually needs. What replaces it is a smaller,
different constraint: **Upstash REST has no persistent connection, therefore no
pub/sub and no realtime**, which is exactly why the dashboard polls. Note also
that `plan/initial-idea.md:109`'s pitch advice — "we mocked the persistence layer"
— is now **wrong**; the pitch should say the opposite.

**5. Typecheck and lint are not in CI, and the format gate is currently red.**
`ci.yml` runs only `format:check` (`:28`). Two coders merging fast for 24 hours
with no type gate is how `main` breaks — and the type surface is about to grow by
a Zod plan schema, four store modules and an SDK. Verified cheap fix: add `pnpm
typecheck` and `pnpm lint` steps; both pass today and neither needs env. Do **not**
add `pnpm build` without dummy `NEXT_PUBLIC_*` values — verified it fails at
`lib/env.ts:12` otherwise. Separately, run `make format` before the first PR.

**6. Tool arguments are untyped input from an LLM.** The React-layer signature is
`Parameters extends Record<string, unknown>`
(`@elevenlabs/react/dist/conversation/types.d.ts:3`). The model can send anything.
`CLAUDE.md:38` bans `any`, `CLAUDE.md:44` puts Zod at trust boundaries, and this
payload marks a medication as taken. Parse it in the handler, and parse it again
in `/api/log` — they are two separate boundaries, and the second one is an open
HTTP endpoint.

**7. No error boundary anywhere.** No `error.tsx` exists. A Redis failure, a
schema mismatch or an extraction crash renders Next's default error page outside
the phone frame.

**8. `lib/env.ts:12` makes every consumer of `env` fail loudly at build time.**
Verified. Correct behaviour, but it means every new environment — a Vercel preview
on a fresh branch, a teammate's clone, any CI build step — needs all three
existing vars, and soon all seven. Provisioning Upstash and Blob through the
Marketplace injects their vars into the Vercel project automatically; getting them
locally is `vercel env pull`. Put all four new names in `.env.example` with the
same public/secret commentary the file already uses at `:1-2` and `:5-7`.

**9. i18n touches roughly 55 strings across 12 files, and two of them are not
UI.** Counted: home 8 (`page.tsx`), check-in page 4, plan page 3,
`voice-session.tsx` 9 (including the three connecting states at `:315-319` and
both error sentences at `:417` and `:422-426`), `orb.tsx` 5 (`:119-122`),
`composer.tsx` 5, `suggested-questions.tsx` 1, `language-picker.tsx` 7,
`back-button.tsx` 1, `not-found.tsx` 4, root `metadata` 3
(`app/layout.tsx:31-46`). The two non-UI ones matter most: `CHECK_IN_PROMPT`
(`check-in-prompt.ts:4-16`) and `SUGGESTED_QUESTIONS` (`:18-23`) — the **voice
persona itself** must be authored in Welsh, not machine-translated at runtime, or
the tone collapses.

**10. `<html lang="en">` is hardcoded at `app/layout.tsx:50`.** Screen readers
will pronounce Welsh with English phonemes. Fixing it makes the root layout async
(`await cookies()`) and flips the currently-static routes to dynamic — verified
they prerender static today.

**11. Verbatim clinical text versus translation is an unresolved contradiction,
and it changes the schema.** `plan/initial-idea.md:26` — the app "only ever
reformats, schedules, and reads back the clinician's own words" — and `:66`
requires red-flag lines stored **verbatim** with their source span. A Welsh
translation of a verbatim English red-flag line is, definitionally, not verbatim.
This must be decided before either the extraction track or the i18n track writes
code, because it determines whether `Plan` carries one string per clinical item or
a `{ verbatim, source, translations }` triple — and the schema is now also the
Redis value shape, so changing it later means reseeding. Cheapest 24h answer:
extract once in English with verbatim + source, and seed a **hand-authored Welsh
sample plan** alongside the English one; live extraction stays English-only, the
Welsh demo runs off the seeded plan, and the verbatim guarantee is never violated
because the Welsh text is presented as a translation next to the original — which
the Blob source-link makes literally visible.

**12. `SUGGESTED_QUESTIONS` contains a question the agent must not answer.**
`check-in-prompt.ts:20` — "Is this normal after surgery?" — is generic clinical
Q&A, explicitly cut at `plan/initial-idea.md:99`. Either the prompt forces a
plan-grounded or route-to-human answer, or the question is replaced. One line, and
exactly what a judge or the medic will poke at.

**13. `components/voice/voice-session.tsx` is 428 lines and three new features
land in it.** Tool registrations, Zod schemas for tool args, the `locale` prop and
the `copy` prop all go into `Session`. `CLAUDE.md:23-25` says don't extract before
the third call site, so the first tools should be inline. Flagging it so the
growth is a decision: if the diff crosses roughly 60 lines, split by screen
concern, not by extracting a util. This file is also the single worst merge-conflict
hazard in the repo — see Residual risk.

**14. The composer's `+` button is a `<span>` with no handler
(`composer.tsx:41-48`).** The comment says "There is no attachment flow yet, so it
carries no handler." It is the obvious place to hang "upload a letter from inside
the conversation", but it is not currently a button — turning it into one is a
real change, not a wiring-up.

**15. `vercel.json:1-6` sets no `maxDuration`.** The extraction route runs a
multi-page multimodal LLM call and will be the slowest thing in the app; the
platform default applies. Set `export const maxDuration` on
`app/api/extract/route.ts` deliberately. The related body-size limit is now
**designed away** by client-side Blob upload — `/api/extract` receives only a
small JSON array of URLs.

**16. `next.config.ts` has no `images.remotePatterns`.** If the extracted preview
or the source-link UI renders the uploaded pages with `next/image`, the Blob
hostname must be allowed or the image is refused at runtime. Easy to miss because
it fails only once real uploads exist.

**17. The 404 inside the phone group renders outside the frame.**
`app/not-found.tsx:5` uses `min-h-dvh` — correct for a root-level 404, but there is
no `app/(phone)/not-found.tsx`, so a bad path under the group escapes the bezel.
Low priority. Note `min-h-dvh` there is the one legitimate use in the repo:
copying that page as a template for a screen _inside_ the group would break the
height contract (`CLAUDE.md:71-74`).

**18. `app/(phone)/page.tsx:88-91` already promises privacy in the UI.** "Your
data stays private. We don't share your health information with anyone you
haven't chosen." That sentence is now a design constraint on the Blob access
decision and on anything the caregiver view exposes, not just marketing copy.

---

## Dependency delta

Runtime deps today are exactly `@elevenlabs/react`, `next`, `react`, `react-dom`,
`zod` (`package.json:16-22`).

**Add — three runtime packages:**

| Package          | For                              | Notes                                                                                                                                                                                                             |
| ---------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai`             | Extraction via the AI Gateway    | The gateway is the SDK's default global provider, so **no `@ai-sdk/*` provider package is needed** — a `"provider/model"` string is enough. Use `generateText` + `Output.object`; `generateObject` is deprecated. |
| `@upstash/redis` | Patient, plan, logs, caregiver   | Replaces the sunset `@vercel/kv`. REST-based; no pool to manage.                                                                                                                                                  |
| `@vercel/blob`   | Discharge-letter images and PDFs | Client upload via `@vercel/blob/client` plus a token route handler.                                                                                                                                               |

**Add — one dev-time guard:** `server-only`. Previously a judgement call with one
secret; with four it is the cheapest possible insurance that `lib/store/*`,
`lib/extraction/*` and `lib/drugs/*` can never be reached from a client component.
It is a compile-time import guard, not runtime defence, so the `CLAUDE.md:17-18`
objection does not really bite.

**Environment variables to add** — all four are **server-only** and none may be
prefixed `NEXT_PUBLIC_`:

```
AI_GATEWAY_API_KEY=            # llmEnv()    — or OIDC on Vercel deployments
BLOB_READ_WRITE_TOKEN=         # blobEnv()   — auto-injected when Blob is provisioned
UPSTASH_REDIS_REST_URL=        # redisEnv()  — auto-injected by the Marketplace integration
UPSTASH_REDIS_REST_TOKEN=      # redisEnv()  — auto-injected by the Marketplace integration
```

Provision through the Marketplace (`vercel integration add upstash`; Blob from the
dashboard or CLI) so the vars are injected into the Vercel project automatically,
then `vercel env pull` locally. Mirror all four into `.env.example` with the same
public/secret commentary the file already carries at `:1-2` and `:5-7`, since
`make setup` copies that file (`Makefile:13-14`).

**Possible config change:** `next.config.ts` may need `images.remotePatterns` for
the Vercel Blob hostname (`*.public.blob.vercel-storage.com`) if uploaded pages are
rendered with `next/image`.

**Explicitly not needed.** `@vercel/kv` (sunset). Supabase, Neon, any Postgres
driver, Prisma, Drizzle, or any ORM. `@ai-sdk/openai` or any direct provider SDK.
Resend, Twilio, or any messaging provider — escalation is in-app only. A PDF
parsing library, most likely: modern multimodal models take PDF file parts
directly, so verify before adding one. `pdf-parse`, `sharp`, or any image
processing: client-side Blob upload removes the body-size pressure that would have
motivated downscaling. Push notification infrastructure: there is no service
worker and no manifest, and the decided call model is a tap into the existing
in-app orb session, not a real push.

**Optional — `vitest`.** `lib/timeline/schedule.ts` and `lib/escalation/rules.ts`
are pure and trivially testable, and the timeline is the kind of date arithmetic
that is wrong in a way nobody notices until the demo. There is no test runner and
no test file today, so this is new infrastructure (config, script, Makefile
target, CI step) — real cost against 24 hours. Recommend a handful of tests on the
scheduler only, or skip it consciously.

**Do not delete `pnpm-workspace.yaml:5-8`.** The three `minimumReleaseAgeExclude`
entries bypass pnpm 11's new-version quarantine and `CLAUDE.md:143-144` says
installs fail without them. This is now materially more likely to bite: three new
packages land at once and `ai` publishes very frequently, so budget time for
adding an `ai@<version>` line (and possibly `@upstash/redis@…` / `@vercel/blob@…`)
rather than being surprised by a failed install at hour three. **Add** entries;
never remove the block.

---

## What changed vs the prior assumption

Against `plan/initial-idea.md` (meeting 1), `README.md`, and meeting 2
(`plan/raw-transcript.md:11-117`), which takes precedence over meeting 1 — plus
the stack decisions, which take precedence over both.

| Prior assumption                                                                                         | Reality now                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Storage: "JSON file / in-memory", Supabase a stretch goal (`initial-idea.md:109`)                        | **Superseded.** Real persistence: Upstash Redis for state, Vercel Blob for the source documents. Still no Supabase and no Postgres. The pitch line "we mocked the persistence layer" is now wrong — say the opposite.                                                                                                                |
| "OpenAI extraction" (`initial-idea.md:39`, `:106`)                                                       | **Superseded.** Vercel AI SDK through the AI Gateway; the model is a `"provider/model"` string, so the provider is a runtime choice rather than a dependency. No direct provider SDK.                                                                                                                                                |
| Voice agent "grounded via RAG on THIS patient's plan" via an ElevenLabs knowledge base (`:43-47`, `:58`) | The repo's working mechanism is a **per-session prompt override** (`voice-session.tsx:224`, README `:70-74`), and `check-in-prompt.ts:2-3` already anticipates appending the plan. For one patient in 24h, reading the plan out of Redis and appending it to the override is simpler and already wired. **Meaningful scope saving.** |
| Tool calling logs adherence inside the conversation (`:57`)                                              | Not implemented — `useConversation` at `voice-session.tsx:98-159` takes callbacks only. Verified buildable: `useConversationClientTool` is exported by the installed SDK and needs no new architecture. Now it has somewhere real to write.                                                                                          |
| The app **calls** the patient on the phone, in Urdu (`:9`, `:72`, `:129`)                                | **Superseded and confirmed.** Notification → tap → the existing in-app orb session, inside the tap. No Twilio, no outbound telephony. `components/voice/` is extended, never rebuilt — which also preserves the `getUserMedia`-inside-the-gesture rule at `CLAUDE.md:84-86`.                                                         |
| Escalation via email / SMS to the next of kin (`:73`, `raw-transcript.md:36`)                            | **Superseded.** In-app family dashboard only. No Resend, no Twilio. Because Upstash has no realtime, the dashboard polls with `router.refresh()`.                                                                                                                                                                                    |
| Hero language is **Urdu** (`:9`, `:129`)                                                                 | Meeting 2 supersedes: "English and Welsh" fully mapped (`raw-transcript.md:80`). The picker at `language-picker.tsx:11-20` already leads with `en` + `cy` and six showcase locales — already aligned.                                                                                                                                |
| Push notifications as Tier 3 (`:76-78`)                                                                  | No service worker, no manifest, no web-push dependency. Out of reach; the tap-into-orb model replaces it.                                                                                                                                                                                                                            |
| Demo patient fixed as "Margaret, 74, hip replacement" (`:125`)                                           | Meeting 2 leaves the case to the medic — one common linear case preferred (`raw-transcript.md:91-97`), medic generates the bundle (`:56-58`), whatever he generates **is** the demo (`:88-90`). `Plan` must be **condition-agnostic** and the seed fixture must be throwaway.                                                        |
| No drug reference source in the plan doc                                                                 | **New in meeting 2**: the BNF as the per-drug side-effect and red-flag source (`raw-transcript.md:45-51`), with the medic's constraint that the agent should _advise_ contacting a clinician, never act (`:49`). Reinforces `initial-idea.md:88`.                                                                                    |
| "we'll hard code everything" for the upload (`raw-transcript.md:62`)                                     | No longer necessary. With Blob + the AI SDK, the live upload path is genuinely buildable, and the seeded plan exists as a fallback rather than as the mechanism.                                                                                                                                                                     |
| README's "What's here" tree (`:42-60`)                                                                   | Accurate today; stale the moment this work lands. Worth one commit at the end.                                                                                                                                                                                                                                                       |
| README `:37-38`: typecheck and lint not in CI                                                            | Confirmed accurate, and understated — the one gate that does exist (`format:check`) is currently failing.                                                                                                                                                                                                                            |

---

## Residual risk

Ranked by what it costs if it goes wrong.

1. **The prompt override could be disabled on the ElevenLabs agent.** Not
   checkable from the repo — a dashboard setting. If it is off, the plan never
   reaches the agent and there is no error message. Verify first, before any
   prompt work.
2. **The AI SDK surface is unverified here.** `ai` is not installed and installing
   it would have modified the repo, so everything above about `generateText` +
   `Output.object`, file parts and model IDs comes from the skill's bundled
   reference, not from the package. The `vercel:ai-sdk` skill is emphatic that
   internal knowledge of this SDK is stale. First implementation step: install,
   then `grep node_modules/ai/docs/` for the current structured-output and
   file-part APIs, then fetch model IDs from
   `https://ai-gateway.vercel.sh/v1/models` (verified reachable today) rather than
   hardcoding.
3. **Welsh TTS quality is unknown.** `"cy"` is a valid type; whether the
   configured voice renders intelligible Welsh is empirical. If not, the Welsh half
   of the headline feature degrades to UI-only. Test one sentence early —
   `plan/initial-idea.md:107` says credits are not the constraint.
4. **The verbatim-versus-translation decision (Risk 11) blocks two tracks and now
   also blocks the data.** It changes the `Plan` schema, which is also the Redis
   value shape, so deciding late means reseeding. Needs an owner in the first hour.
5. **The extraction schema itself is not designed here.** This audit places the
   file; `plan/initial-idea.md:139` makes locking the fields the first artifact to
   write, and it is the acknowledged biggest technical risk (`:66`).
6. **Timing of the medic's bundle.** Schema fields, timeline shape and which drugs
   the lookup needs are all shaped by a document that does not exist yet
   (`raw-transcript.md:56-58`). The synthetic seed is the mitigation; write it to
   be thrown away and keep the swap to one file plus one `POST /api/seed`.
7. **Blob access mode is undecided** and interacts with an on-screen promise
   (`app/(phone)/page.tsx:88-91`). `private` changes how `lib/extraction/extract.ts`
   feeds the model (bytes, not URLs). Decide before writing the extraction call, not
   after.
8. **Next's caching defaults versus `router.refresh()`.** The family dashboard's
   whole escalation beat depends on a refresh actually re-reading Redis.
   `force-dynamic` should ensure it; confirm with one manual two-window test rather
   than assuming.
9. **Vercel function duration and any remaining body limits** are stated from
   general platform knowledge, not verified against this project's plan tier.
   Confirm `maxDuration` behaviour before relying on a slow multi-page extraction.
10. **Two coders, one 428-line file.** Client tools, the `locale` prop and the
    `copy` prop all land in `components/voice/voice-session.tsx`. If the task split
    puts two people in that file simultaneously, the merge conflicts will cost more
    than the features. Sequence it, or give one person the file.
