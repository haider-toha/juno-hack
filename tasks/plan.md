# Implementation Plan: Portico (Recovery Companion)

Reference: `tasks/spec.md` for the full spec; `audit/juno-recovery-companion/`
for every cited finding. This plan turns the spec into an ordered, two-person
task list.

**Product name: Portico** [Locked D10]. Juno = hackathon host only.

---

## ✅ DECISIONS LOCKED (2026-07-25, human) — no open human gates remain

Every question this plan previously escalated has been answered. **Do not
re-open these; do not ask again mid-build.**
| # | Decision | Consequence for the build |
| ------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1** | **French ear-test: PASS.** Clip 3 sounded like clip 2 — clear French, not mush. | The `fr` language override **does** reach `eleven_flash_v2_5`. Stay on the **single** Portico agent. **Task B3.6 is contingency only — do not build a second agent** unless something breaks later. C2 is closed. |
| **L2** | **Agent LLM: `gemini-3.5-flash`** (was `gemini-2.5-flash`). | Confirmed in `/v1/convai/llm/list`, PATCHed, read back. Both TTS pins, all five overrides and the 12 `client_events` verified intact after the change. |
| **L3** | **Voice: keep Sarah** (`EXAVITQu4vr4xnSDxMaL`). | No change. French-verified. |
| **L4** | **`platform_settings.auth.enable_auth` stays OFF.** | Signed URLs suffice for the hackathon. **Do not enable it without a tested origin allowlist** — untested allowlist semantics the night before a demo is exactly the risk D9 exists to stop. Verified `false` on the agent. |
| **L5** | **Clot-preventer: apixaban, per the medic.** | Enoxaparin is out. Only one letter in the corpus carries apixaban, so **the demo gold letter changes — see L6.** |
| **L6** | **Demo gold letter: `02_Whitfield_Harold_Pneumonia`** (was `04_Sinclair`). | Full rationale in the Track A corpus section. Sinclair drops to QA; **05 Bradley** becomes the red-flag QA letter. |
| **L7** | **Skip the Tier 3 Resend email escalation.** | Only if genuinely spare time remains at the end. Not a task. Blocks nothing. |
| **L8** | **Skip `vitest`.** | Only if genuinely spare time remains. `lib/timeline/schedule.ts` and `lib/escalation/rules.ts` are then verified by running the app. Blocks nothing. |
| **L9** | **Extraction provider: OpenAI structured outputs** (via AI Gateway preferred). | Anthropic strict structured output rejects this schema (nullable-heavy → too many union types). Use `generateText` + `Output.object` against an OpenAI model. Gold labels = medic corpus JSON; `make eval` is the gate. Demo mode keeps using the baked bundle with **no** LLM call. |

**Documentation move:** `plan/` is gone. `plan/spec.md` → **`tasks/spec.md`** and
`plan/medic-brief.md` → **`tasks/medic-brief.md`**; `initial-idea.md` and
`raw-transcript.md` are deleted as historical. Citations inside `tasks/` are
repointed. Citations inside `audit/00`–`05` still say `plan/…` **deliberately** —
those files are a dated research record and rewriting them would falsify the
trail. Read them as `tasks/spec.md`.

---

## ✅ CURRENT REALITY (reconciled 2026-07-26)

**`tasks/todo.md` has been reconciled against the repo and is now trustworthy.**
Read it for the progress board; read the checkbox lists **below** as intent and
acceptance criteria, which is all they ever were. Evidence for the
reconciliation: `audit/juno-recovery-companion/15-track-4-todo-reconcile.md`,
read against `14-track-3-adversarial-verify.md` — a cold-start adversarial re-run
that found **no FAKEs** — `17-deploy-and-tool-wiring.md`, which deployed the app
and proved a real ElevenLabs agent calling its routes, and the two build tracks'
own reports (`12-track-1-demo-flow.md` incl. §X4, `13-track-2-demo-ui.md`).

> **⚠️ §Demo mode vs live mode, below, is stale on one point.** It says
> extraction is "Real AI Gateway → **OpenAI** structured outputs
> (`Output.object`)". The code has used `anthropic("claude-haiku-4-5")` since
> commit `fe657f6`, and it currently 500s for want of a key. OpenAI via the
> Gateway remains the **target** [L9]; it is not what runs. The same false
> sentence appears in `12-track-1-demo-flow.md`.

### Intended contract (unchanged, restate so nobody drifts again)

1. **Live / eval:** send real corpus PDFs to a provider with **structured
   outputs**, get an `ExtractedBundle`, score it against the medic's sibling
   JSON (source of truth). Tune prompt / model until `make eval` is green.
2. **Demo (`PORTICO_MODE=demo`):** do **not** call the LLM for extraction.
   Serve the baked Whitfield / seed bundle. Voice, Redis, Blob, and UI stay
   real. A live failure must **never** silently become demo [D9].

### What the code has today (verified file by file, 2026-07-26)

| Area                                                                     | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 0 foundation (schema, redis, log, clock, env helpers, CI, seed)    | **Complete.** `pnpm typecheck` and `pnpm lint` both exit 0; CI gates format, lint and typecheck                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Track A ingest → `/plan` → drugs → red-flag/source → task ticks          | **Complete**, except extraction. A1–A5 and A7–A11 are built and wired                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| A6 extraction                                                            | **Never demonstrated.** On a live-mode server `POST /api/extract` returns a bare **500** — `ZodError: ANTHROPIC_API_KEY … received undefined` at `lib/env.ts:47`. Commit `fe657f6` moved the provider to `anthropic("claude-haiku-4-5")` and updated `.env.example`, but no local env file carries the key. Production _does_ carry it — and runs in demo mode, so the model is never called there either. It fails loudly and never serves baked data (D9 rule 1 holds), but **D9 rule 3 is breached**: nobody has shown a successful live extraction anywhere. Out of scope for the 2026-07-26 build night |
| A6.5 `make eval` harness                                                 | **Exists**; has never been run green. Demo's baked bundle is therefore used but not licensed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Deployment                                                               | **Live at `https://juno-hack.vercel.app`** — but `vercel deploy` ships the **working tree, not `HEAD`**, and the snapshot predates the i18n, prompt and malformed-body fixes. **Redeploy before filming.** Local and production also share one Redis and one Blob store, so pick one host per take                                                                                                                                                                                                                                                                                                           |
| A6.6 demo mode                                                           | **Complete.** Badge counted on all five patient-facing screens from a cold start; `/api/seed` and all six `/api/demo/*` methods 403 in live mode (7 of 7); the short-circuit is checked before the model call, and every `catch` in `app/`, `lib/` and `components/` was read — none reaches `DEMO_PLAN`. Caveat: in demo mode **any** uploaded letter yields Whitfield's plan, disclosed three ways in the code but not by a narrator                                                                                                                                                                       |
| Track B Phase 1 (i18n, locale on voice)                                  | **Complete; both D9 leaks closed.** `/plan` and `/upload` now read the dictionary end to end (verified in French over the wire), and `lib/check-in-prompt.ts` tags each red flag `(fr)` or `(en)` with the language it is handing the agent — explicit, never a fallthrough. Remaining gap is a data one: the letter's own clinical text has no authored French, and is declared `lang="en"` where it appears                                                                                                                                                                                                |
| Track B Phase 2+ (plan-aware prompt, `assess()`, `/family`, `/operator`) | **Complete and adversarially verified.** `assess()` survived four separate attempts to make it lie; `alert-kin` has exactly one producer and one consumer; the operator panel cannot paint a card                                                                                                                                                                                                                                                                                                                                                                                                            |
| Track B server tools (B4/B6/B7)                                          | **Live and proven.** Deployed to `https://juno-hack.vercel.app`; all three tools created **and attached via `tool_ids`** (the agent read back `tool_ids = []` beforehand — they were unattached, not merely unexercised). A real agent invoked them, corroborated by ElevenLabs' execution ledger, Vercel runtime logs and the app's own state. Both TTS pins and all 12 `client_events` survived the PATCH                                                                                                                                                                                                  |
| Voice audio                                                              | **English proven live; French still unheard.** Three real agent sessions held a plan-grounded conversation and called tools, with the app's own override frame accepted. Every one was `language: "en"`. B11's French ear-test is the last human-only item                                                                                                                                                                                                                                                                                                                                                   |
| Home entry                                                               | **Mechanism fixed; story not told in the state that will be filmed.** Home reads the store and leads with the step the patient is on — verified by deleting the plan key, not by reading JSX. But seeded, it leads with a full-width "Start today's check-in" and puts the letter third as a hairline row, so a viewer of the filmed state never learns the product is built from a discharge letter. **Now a one-command choice:** `make clear-letter` deletes the plan and keeps the log, the patient and the clock, so the arc can open on the empty home and still escalate from the surviving history   |

**Next extraction work (L9):** rewire A6 to OpenAI structured outputs (Gateway
`openai/…` preferred), restore `Output.object`, put a working key in
`.env.local`, and prove it with `make eval`. Only then is demo's baked JSON
licensed rather than a mock in a costume. **Until then the honest position is
that live extraction is unproven — do not claim it works.**

---

## ⚠️ READ FIRST — Phase 1 outcome and binding corrections (2026-07-25)

Phase 1 ran live against the real platforms. Evidence:
`audit/juno-recovery-companion/06-phase-1-readiness.md`, plus hole-finding
passes `07` (Track A), `08` (Track B), `09` (two-dev seams) and `11` (fixture
corpus). **Where this block disagrees with anything below, this block wins.**

**Infrastructure: green.** Upstash Redis, Vercel Blob, AI Gateway, `XI_API_KEY`
and Vercel MCP all probe 200. Nothing to re-provision.

**The Portico agent exists:** `NEXT_PUBLIC_AGENT_ID =
agent_0201kyd61dnjey7bkz56hpyhs3f1`, in `.env` and on Vercel
Production/Preview/Development. All five D8 Security overrides verified.

### C1 — 🔴 Locked D8's `eleven_flash_v2_5` pin is **impossible as written**

The ElevenLabs API rejects an English-base agent pinned to `eleven_flash_v2_5`:

```
HTTP 400 — "Invalid conversation config: Value error,
            English Agents must use turbo or flash v2."
```

Language presets do **not** unlock it. Every instruction that said "pin
`eleven_flash_v2_5`" and then "re-verify the pin" was **wrong**, and following it
literally causes the failure it was written to prevent: the agent correctly reads
back `eleven_flash_v2`, an operator reads that as drift, and the only two "fixes"
available are a 400 or a silent downgrade to `eleven_multilingual_v2`.

**What is actually built, and what you verify instead:**

| Locale | Where the model is pinned                    | Model               |
| ------ | -------------------------------------------- | ------------------- |
| `en`   | `conversation_config.tts.model_id`           | `eleven_flash_v2`   |
| `fr`   | `language_presets.fr.overrides.tts.model_id` | `eleven_flash_v2_5` |

Both explicit. Neither a dashboard default. `tts.model_id` is **not**
client-overridable, so the pin cannot be changed from the browser. D8's intent
(no silent model drift) holds; only its literal model id changes.

### C2 — ✅ CLOSED by L1: French confirmed working on the single agent

The ear-test passed. A per-session `overrides.agent.language: "fr"` **does**
activate `language_presets.fr` and therefore `eleven_flash_v2_5`. The project's
largest risk is retired.

**What still holds:** Task B11's pre-demo re-check stays (confirm both pins, one
real `fr` session, ear-test TTS and ASR separately). **HTTP 200 still proves
nothing** — Phase 1 reproduced Welsh returning 200 with 74KB of healthy-looking
audio on a model with no Welsh support. D9 still binds: if French ever degrades,
**stop** — no English-voice-under-French-UI, no model substitution. Task B3.6 is
the pre-authorised remedy; it is **not** to be built now.

### C3 — 🔴 A disallowed override is refused **asynchronously**, not thrown

Verified live: the WebSocket closes with code `1008`, reason `"Override for
field 'llm' is not allowed by config."`, **after**
`conversation_initiation_metadata`. The `try/catch` around `connect()`
(`voice-session.tsx:212-234`) will **never** see it — it arrives via the SDK's
`onError` callback (`:150`). Task 0.6's old wording ("throws") is imprecise; the
invariant worth protecting is that `onError` keeps rendering into the
`role="alert"` banner at `:304-311`.

### C4 — 🔴 Two dead configuration values were found in the "Done" list

- `NEXT_PUBLIC_XI_VOICE_ID` pointed at a voice that **does not exist**
  (`voice_not_found`). It is sent on every session, so this would have failed
  live, mid-demo. Now `EXAVITQu4vr4xnSDxMaL` (French-verified).
- Agent `client_events` defaulted to a set **omitting
  `agent_chat_response_part`**, which `voice-session.tsx:116` depends on — the
  transcript reveal would have rendered nothing, silently. Patched. This also
  pre-satisfies B6 (`client_tool_call`) and B7 (`agent_tool_request/response`),
  so **B7's "set client_events" prerequisite is already done — do not re-PATCH
  it, you risk the C1 pins.** Note `audio_alignment` is **not** a valid
  `client_events` value; alignment rides with `audio`.

### C5 — 🔴 Blob access is already decided: the store is **Private**

`vercel blob get-store store_D2WuxECBKxmSPVzn` → `Access: Private`. The spec's
open question "public vs private" is **closed by infrastructure**. Consequences
that were never mapped, and now bind A5/A6/A9:

- A6 **cannot** hand the model a bare `blobUrl` — an unauthenticated fetch of a
  private blob 401s.
- A9's "tap to see where it says that" **cannot** be `<img>` or `next/image`.
  Private blobs are only deliverable through a route handler that calls
  `get(pathname, { access: "private" })` and streams the bytes.

### C6 — 🔴 `lib/store/log.ts` is a **second shared contract** with no owner

`readLog` is called by A4 and B8, but no task creates it, and `LogEntry` **is**
the `/api/log` contract. It would be invented twice, and it blocks A4 in Phase 1.
Added as **Task 0.7**, in Phase 0, before the fork.

### C7 — 🔴 `/api/log` has two callers with two different trust models

Task A10 (a browser leaf, same-origin, no secret) and Task B4 (ElevenLabs'
backend, authenticated) cannot share one route: either A10 breaks or the write
endpoint ships open to the internet. Split — see the rewritten B4 and A10.

Related, and verified in the installed SDK
(`@elevenlabs/client@1.15.2/dist/utils/overrides.js:32`): dynamic variables are
sent **from the browser** in `conversation_initiation_client_data`. A `secret__`
prefix hides a value from the **LLM**, not from the **client**. It is **not**
request authentication. Server-tool auth must use `request_headers` with a
`secret_id` / `env_var_label` that ElevenLabs resolves server-side.

### C8 — 🟡 Two D10 branding leaks in the build path

`01`'s schema sketch — which Task 0.2 says to port **verbatim** — contains
`schemaVersion: z.literal("juno-extract/1")` (`01:1361`). Land it as
`portico-extract/1`. Also `package.json:2` is `"name": "juno"`. The legacy
research corpus under `audit/` keeps its `juno-*` filenames: it is the citation
trail for D4/D6/D8 and **must not** be bulk-renamed.

### C9 — ✅ CI is now green (was red on six files, plus the corpus)

`pnpm typecheck`, `pnpm lint` **and** `pnpm format:check` all pass on the working
tree. Two things were fixed:

- The six markdown files failing `prettier --check` have been formatted.
- **The medic's corpus was breaking CI too** — 4 of the 5 delivered JSONs are not
  prettier-shaped. They are an **external input contract** and the ground-truth
  label set for extraction QA, so reformatting them would be wrong and would
  break again on every re-send. `fixtures/discharge-summaries` is now in
  `.prettierignore`. Our own generated `fixtures/nhs-drug-map.json` is
  deliberately **not** ignored and stays checked.

Task 0.4's remaining work is therefore only the CI _steps_.

Note prettier's markdown pass is not always idempotent on tables: if `--write`
leaves a file still failing `--check`, run it once more before assuming a config
problem.

### C10 — 🟡 An audit file instructs the exact fallthrough D9 bans

`05:628` tells `getDictionary` to `switch` and return **`en` for the six showcase
locales**. Task B1 cites `05`. That is D9 §2 verbatim. B1 must return an explicit
"not yet" state, never an English dictionary.

### C11 — 🔴 The corpus landed. Drug lookup is fully mapped and committed

Every drug across all five letters has been resolved against the live NHS.uk A–Z
(260-slug index) and committed to **`fixtures/nhs-drug-map.json`**. That file is
ground truth for Task A7 — the dev does not re-derive it.

**Coverage: 25 unique drugs → 18 `found`, 6 `no-urgent-guidance`, 1 `absent`, 0
failures.**

**(a) A7's extraction path was at the wrong nesting depth.** `identifier:
"urgent"` lives one level deeper than the plan implied:

```
ld+json → hasPart[]        (HealthTopicContent, carries hasHealthAspect)
            └── hasPart[]  (WebPageElement)  ← identifier === "urgent" IS HERE
```

Scanning only the top level returns **zero** urgent blocks on every drug. The
instinct to scan all aspects is right — the overdose warning sits under
`UsageOrScheduleHealthAspect`, not `SideEffectsHealthAspect`.

**(b) There are FOUR states, not two.** "Page exists but carries no urgent block"
is real and common — ramipril, ticagrelor, salbutamol, alendronic acid,
prednisolone (6 of 25). Collapsing it into `absent` would tell a patient "not
listed" about a drug that is listed.

**(c) Naive `name → slug` fails on 9 of 25.** `paracetamol`, `co-codamol` and
`ibuprofen` all 404 — the real slugs end `-for-adults` (prefer that variant;
every patient in the corpus is an adult). `salbutamol` → `salbutamol-inhaler`,
`GTN spray` → `glyceryl-trinitrate-gtn`. Two are combination products where the
NHS page covers one component only and the match is therefore **`partial` and
must be labelled as such on screen**: `Adcal-D3` → `colecalciferol`,
`Spiolto Respimat` → `tiotropium-inhalers`.

**Enoxaparin is genuinely `absent`** (404; the `anticoagulants` category page
never names it, so aliasing there would be the generic-blurb substitution D9 §5
bans). That is now moot for the demo — **L5/L6 moved the gold letter to
Whitfield, whose anticoagulant is apixaban.** Enoxaparin remains in the corpus
via Sinclair as the QA case that exercises the `absent` state.

---

## Demo mode vs live mode — `PORTICO_MODE`

**The app must genuinely work. The demo must never depend on it working _on the
night_.** Those are two different requirements and the plan satisfies both with
one explicit switch:

```
NEXT_PUBLIC_PORTICO_MODE = "live" | "demo"     # default: "live"
```

Read it once in `lib/env.ts` alongside the other browser-safe vars. It is public
by design — the UI has to render it (see the visibility rule below).

### Why this exists, and why it is not a cheat

Three of this product's steps depend on a third party answering quickly:
extraction (AI Gateway), drug context (NHS.uk), and voice (ElevenLabs). On a
recorded 60-second demo, a 5–15 second LLM round-trip is dead air, and an NHS.uk
timeout is a dead feature. Demo mode removes **network flakiness and latency**
from the demo path. It does **not** remove features, and it does not excuse us
from building them.

### What actually differs

Most of the stack stays real, because most of it is fast and reliable. Only four
things change:

| Concern          | `live`                                                            | `demo`                                                             | Why                                                                                      |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **Extraction**   | Real AI Gateway → **OpenAI** structured outputs (`Output.object`) | Baked `ExtractedBundle` from the medic's gold JSON, no LLM call    | A 5–15s round-trip does not fit in a 60s video, and a gateway hiccup would kill the take |
| **Drug context** | Live NHS.uk fetch + 24h Redis cache                               | `fixtures/nhs-drug-map.json`, already committed and verified       | Removes a third-party network dependency from the demo path                              |
| **Clock**        | Real `today`                                                      | Overridable via the operator panel (B10.5)                         | A day-by-day timeline is not demonstrable in a minute at real speed                      |
| **Seed state**   | Empty until a letter is uploaded                                  | Primed — two missed apixaban doses, so escalation is already armed | The escalation rule needs history that would otherwise take three days to accrue         |

**Everything else is identical in both modes, and that is deliberate:**

| Stays real in demo mode                   | Why it is never faked                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| **The ElevenLabs voice session**          | It is the hero feature. A faked voice demo is not a demo.                                   |
| **Redis reads and writes**                | Fast, reliable, and the cross-device escalation beat is only impressive because it is real. |
| **Server tools (`log_step`, `escalate`)** | Same. The tick on screen must be caused by the agent.                                       |
| **`assess()` escalation logic**           | The claim spoken on the family dashboard has to be computed, not scripted.                  |
| **Blob upload**                           | Already fast, and uploading a real letter on stage is a beat in itself.                     |
| **The whole UI**                          | Obviously.                                                                                  |

### The three rules that keep this honest [Locked D9]

D9 bans **silent fallbacks**, not deliberate modes. A named, human-set, visible
mode is precisely the "allowed explicit branch" D9 carves out. What turns this
from a legitimate mode into the thing D9 forbids is any of the following, so all
three are hard rules:

1. **A `live` failure never becomes `demo`.** If extraction fails in live mode it
   returns a 422 (per A6). It does not quietly serve the baked JSON. Changing
   mode is a config change a human makes, never a decision the code takes at
   runtime. **This is the single most tempting `catch` block in the build.**
2. **The mode is visible, not just correct.** Render it on screen whenever it is
   `demo`, return it in the `/api/extract` response, and record it on the stored
   bundle. If a judge asks "is that real?", the answer is on the screen. A demo
   mode you cannot see is indistinguishable from a lie.
3. **Every demo shortcut must have a live counterpart that has been proven to
   work at least once.** Demo mode is a _recording of a capability you have
   demonstrated_, not a substitute for having it. Concretely: the baked JSON is
   only allowed because `make eval` (A6.5) measures the real extraction against
   it; the drug map is only allowed because it was generated by a real NHS.uk
   fetch. **If a shortcut has no live counterpart, it is not a shortcut — it is a
   missing feature.**

### How this is verified

Checkpoint 2 requires the full arc to pass in **`live`** mode at least once, with
`make eval` green. Checkpoint 3 rehearses in **`demo`** mode. Passing Checkpoint 3
without ever having passed Checkpoint 2 in live mode means the app does not
actually work, and no amount of demo polish fixes that.

---

## Overview

Two coders build one app in parallel after a short shared-foundation phase.
**Track A** owns ingestion: upload → extraction → the plan schema's
persistence → the day-by-day timeline → drug lookup. **Track B** owns the
voice experience end to end: the check-in call, tool calling, escalation, the
family dashboard, and i18n. Both tracks touch UI, because UI/UX is a graded
axis and neither person should be UI-blind.

The critical shared artifact is `lib/plan/schema.ts` — both tracks read and
write it starting in Phase 1. It is fixed in Phase 0, before either track
branches, precisely so nobody reseeds Redis at hour 18.

## Architecture Decisions

Each of these is already made (see `plan/spec.md` and the audit files); listed
here so the dependency graph below makes sense without re-deriving them.

1. **Persistence is Upstash Redis + Vercel Blob**, provisioned via the Vercel
   Marketplace. No Supabase, no Postgres. [Locked D1]
2. **Extraction runs through the Vercel AI SDK via the AI Gateway**, using
   `generateText` + `Output.object` (`generateObject` is deprecated), with an
   **OpenAI** model string (e.g. `openai/gpt-4o` / `openai/gpt-4.1` — confirm
   against the Gateway model list). Anthropic is **out** for this schema:
   nullable-heavy structured output exceeds its union budget [L9]. [Locked
   D2; L9; 05 §Rationale]
3. **No `timeline[]` in the schema.** The model emits dated facts; a pure
   function computes the day-by-day view. [01 §I3]
4. **Grounding the voice agent is prompt injection, not RAG.** The browser
   SDK cannot send a knowledge-base override at all. [02 §(a)]
5. **Tool calling is server tools (webhooks) for `log_step` and
   `escalate_to_next_of_kin`**, writing to Redis; the browser observes via
   `onAgentToolRequest`/`onAgentToolResponse`. One client tool,
   `show_red_flag`, purely visual. [02 §(b)]
6. **Call initiation is notification → tap → the existing in-app orb
   session.** No phone call, no Twilio. [Locked D3; 02 §(c)]
7. **Real locales are English + French.** Showcase locales show an explicit
   "not yet" panel — never a silent English fallthrough. [Locked D4, D9]
8. **The ElevenLabs agent is created in Phase 0**, pinned to
   `eleven_flash_v2_5`, with Security overrides enabled. Additional Languages
   may add French only after the pin is re-verified — never trust a silent
   model rewrite. No English-voice-under-French-UI downgrade. [Locked D8, D9]
9. **Drug red-flag data comes from NHS.uk's medicines A-Z**, fetched at
   ingestion time, cached in Redis with a 24-hour TTL derived from the NHS
   licence terms. Not the BNF (geo-blocked, licence-excluded). [Locked D6; 03]
10. **i18n is a typed dictionary module, no library.** Cookie-based locale, no
    `[locale]` route segment. `fr.ts satisfies Dictionary`. [04 §i18n]
11. **Red flags render dual in French mode** — translation plus the verbatim
    English side by side; everything else translates cleanly. Clinical proper
    nouns are never translated. [Locked D7]
12. **The family dashboard polls** via `router.refresh()` every 5s — Upstash
    REST has no pub/sub. [05 §The family dashboard]
13. **No silent fallbacks anywhere.** Missing deps throw; bad parse → 422;
    wrong agent config fails the spike out loud. [Locked D9]
14. **Product name is Portico.** Juno is the hackathon host only. UI, voice
    persona, and new Redis keys use Portico / `portico:` — not Juno.
    [Locked D10]

## Dependency Graph

```
Phase 0 — Shared foundation (BOTH, paired, ~45–60 min) + agent setup
    │
    ├── lib/plan/schema.ts          (the shared contract — see spec.md)
    ├── lib/store/redis.ts          (lazy client, both tracks need it immediately)
    ├── lib/env.ts extended         (llmEnv, blobEnv, redisEnv)
    ├── provisioning verified       (Upstash, Blob, AI_GATEWAY_API_KEY)
    ├── ElevenLabs agent created    (Flash v2.5 pin, fr+en, Security overrides,
    │                                NEXT_PUBLIC_AGENT_ID in .env — Locked D8)
    ├── CI fix                      (make format; add typecheck+lint steps)
    └── app/layout.tsx              (dynamic <html lang>)
    │
    ├──────────────────────┬──────────────────────────────────┐
    ▼                      ▼                                  ▼
Phase 1 — Track A          Phase 1 — Track B                  (parallel)
foundations                foundations
    │                          │
    ├── seed fixture           ├── lib/i18n/* (dictionary, en.ts, fr.ts)
    ├── lib/store/plan.ts      ├── language-picker.tsx wiring
    ├── lib/timeline/schedule  ├── check-in/page.tsx (locale + plan → prompt)
    └── /plan page rebuild     └── voice-session.tsx gains locale prop
    │                          │
    ▼                          ▼
Checkpoint 1: both read/write the same Plan object; /plan renders a seeded
timeline; a check-in session starts in en, then a second ear-test in fr.
    │                          │
    ├──────────────────────┐   ├──────────────────────────────┐
    ▼                      ▼   ▼                                ▼
Phase 2 — Track A          Phase 2 — Track B
    │                          │
    ├── Blob client upload     ├── server tools: log_step,
    ├── extract route              escalate_to_next_of_kin
    │   (AI SDK call)          ├── client tool: show_red_flag
    ├── upload-panel.tsx       ├── lib/escalation/rules.ts
    └── lib/drugs/lookup.ts    ├── /family page + escalation-card
                               └── incoming check-in notification card
    │                          │
    ▼                          ▼
Checkpoint 2: upload → extraction → timeline works end to end on real data;
a voice call logs adherence, and a missed high-stakes med shows on /family
from a second device within one poll cycle.
    │                          │
    ├──────────────────────┐   ├──────────────────────────────┐
    ▼                      ▼   ▼                                ▼
Phase 3 — Track A          Phase 3 — Track B
    │                          │
    ├── red-flag card +        ├── French confirm-before-log +
    │   source-trace UI            answer chips (ASR safety, not a fallback)
    ├── accessibility fixes    ├── accessibility fixes on
    │   on plan/upload              voice/family/check-in
    └── polish, loud errors    └── demo rehearsal, seed script

Checkpoint 3 (final): full demo runs twice without intervention.
```

## Task List

### Phase 0: Shared Foundation (both coders, together — do not split this)

> **Status 2026-07-25:** Redis, Blob, AI Gateway and `XI_API_KEY` are
> provisioned and probe green (local + Vercel). Vercel MCP is authenticated. The
> Portico agent exists. Env layout: `.env` = `NEXT_PUBLIC_*` only; `.env.local` =
> quoted secrets. See `tasks/todo.md §Setup status`. **Do not re-run the
> Marketplace install and do not mint new keys unless a probe fails.**

**Ordering matters — two of these are repo-wide writes.** See
§Two-dev operating model for the full sequencing rule.

- [x] **Task 0.1: Create the ElevenLabs agent — DONE 2026-07-25.** Evidence:
      `06-phase-1-readiness.md`. The **Portico** agent exists
      (`agent_0201kyd61dnjey7bkz56hpyhs3f1`), is in `.env` and on Vercel
      Production/Preview/Development, has all five D8 Security overrides verified
      by readback, has corrected `client_events`, runs `gemini-3.5-flash` [L2],
      and has been proven over live signed-URL sessions in English and French.
  - **Do not re-run this task and do not "fix" the TTS model.** See **C1** — the
    model is pinned per locale, which is the only shape the API accepts.
  - Corrected along the way: a dead `NEXT_PUBLIC_XI_VOICE_ID` and default
    `client_events` that would have silently killed the transcript reveal (C4).
  - All four former human gates are now closed — see §DECISIONS LOCKED L1–L4.

- [ ] **Task 0.2: `lib/plan/schema.ts` — the shared contract.** Port the Zod
      schema from `01-track-1-clinical-schema.md §Zod-4 sketch`, plus the French
      translation slot on `RedFlag` per Locked D7. Both coders read this file
      before writing anything else.
  - **Two corrections to "port verbatim" (C8):** rename
    `schemaVersion: z.literal("juno-extract/1")` (`01:1361`) to
    **`portico-extract/1`** — D10 forbids Juno in the product, and this string is
    stored in every Redis value. And **specify the D7 French slot shape here, not
    later**: nothing downstream populates it otherwise, so French mode would
    degrade to English (D9 §2). Concretely, `RedFlag` gains
    `triggerFr: string | null` and `actionFr: string | null` **alongside** —
    never replacing — the English `*Verbatim` fields, so A9's dual render is
    structurally possible.
  - **Corpus-driven amendments (see `11-fixture-corpus-readiness.md`):**
    `Medication.schedule` cannot currently express **weekly** dosing, but the
    corpus contains `Alendronic acid 70mg Weekly` — without a weekly variant it
    renders as a wrong daily task. And every follow-up date in the corpus is
    tilde-prefixed (`~05/09/2026`), so `DateAnchor.date` needs an `approximate`
    flag; the alternative is presenting a hospital's estimate as a firm date.
  - Files: `lib/plan/schema.ts`
  - Acceptance: exports `ExtractedBundle`, `type ExtractedBundle`, and every
    sub-schema is composable for the model-facing variant (documents minus
    `blobUrl`/`blobPathname`). Every clinical field is `.nullable()`, never
    `.optional()`.
  - **Referential integrity:** add a `.superRefine` (or an explicit check in the
    extract route) asserting every `SourceRef.documentId` exists in
    `documents[].id`. Without it a dead source link parses cleanly and A9's "tap
    to see where it says that" fails on stage.
  - Verify: `pnpm typecheck` passes; the JSONC example from the audit file parses
    in a scratch script.

- [ ] **Task 0.3: `lib/store/redis.ts` + `lib/env.ts` extension.** Lazy client
      factory (never module-scope construction — verified crash otherwise). Add
      `llmEnv()`, `blobEnv()`, `redisEnv()` beside the existing `serverEnv()`.
  - **Also add `lib/store/clock.ts`** — `getDemoToday()` / `setDemoToday()`,
    backed by a `portico:demo:today` key with today's real date as the fallback.
    Ten lines, but it belongs in Phase 0 because **both** tracks need it before
    they fork: Track A's `buildTimeline(bundle, today)` (A3/A4) reads it, and
    Track B's operator panel (B10.5) writes it. It is the mechanism that makes a
    day-by-day timeline demonstrable inside a 60-second video. Threading it
    through afterwards means finding every date read in the codebase.
  - Files: `lib/store/redis.ts`, `lib/store/clock.ts`, `lib/env.ts`
  - Acceptance: four separate env functions, not one fat schema — a missing AI
    Gateway key must not break the Redis-only parts of the app. No call site
    anywhere outside `clock.ts` constructs "today" itself.
  - Verify: `next build` succeeds with real env; fails loudly (not silently) if a
    var used by an imported function is missing.

- [ ] **Task 0.4: Add the missing CI steps.** `make format` is already done and
      the tree is green (**C9**) — you only need to add `pnpm typecheck` and
      `pnpm lint` as new steps in `.github/workflows/ci.yml`, which today runs
      `format:check` alone. Both need no env vars.
  - **Do not remove** the `fixtures/discharge-summaries` entry from
    `.prettierignore` — the corpus is an external input contract.
  - Files: `.github/workflows/ci.yml`
  - Verify: a fresh PR shows three green checks, not one.

- [ ] **Task 0.5: Fix `<html lang>` in `app/layout.tsx`.** Make it dynamic
      (`await getLocale()`) instead of hardcoded `"en"` — the root layout becomes
      async, which is expected and fine.
  - **French needs only the existing `latin` subset. But B2's in-language "not
    yet" panels for `cy`/`pl`/`ro`/`tr` do need `latin-ext`** — the old "no
    `latin-ext`" note was wrong, and dropping it silently mojibakes the showcase
    panels, which is the failure D9 §2 is about.
  - Files: `app/layout.tsx`
  - Verify: with locale `fr`, view-source / the a11y tree shows `lang="fr"`.

- [ ] **Task 0.6: Correct the override-failure documentation — loud is correct.**
      `README.md` and the comment in `components/voice/voice-session.tsx` both
      claim a disallowed override is silently ignored. That is wrong — but so is
      "it throws". Per **C3**, verified live: **the session is refused. The
      WebSocket closes with code `1008` and a reason naming the offending field,
      after `conversation_initiation_metadata`.**
  - Write that, not "throws". The distinction matters to whoever debugs it next:
    the refusal is **asynchronous**, so the `try/catch` around `connect()`
    (`:212-234`) never sees it. It surfaces through `onError` (`:150`) into the
    `role="alert"` banner (`:304-311`).
  - The invariant to protect [Locked D9] is that this path stays visible: do not
    swallow `onError`, and do not add catch-and-continue anywhere near it.
  - Files: `README.md`, `components/voice/voice-session.tsx` (comment only)
  - Verify: both texts describe a 1008 refusal surfaced via `onError`, and
    supersede `[02 §Correction 1]`'s "throws" phrasing.

- [ ] **Task 0.7: `lib/store/log.ts` — the SECOND shared contract.** Per **C6**.
      Both tracks need it in Phase 1 and no task created it. Define `LogEntry`,
      `appendLogEntry()` and `readLog(day)` here, in Phase 0, with both devs
      present — this type **is** the `/api/log` contract, so inventing it twice
      guarantees a conflict.
  - Files: `lib/store/log.ts`
  - Acceptance: `LogEntry` satisfies **both** writers — a voice-tool write (has a
    `check_in_id`) and a manual UI tick (has none), so that field is nullable and
    the source is a discriminated `"voice" | "manual"`. `readLog` parses on every
    read and throws on corrupt data — no soft default (D9 §5).
  - Verify: A4's `Promise.all([readPlan(), readLog(today)])` typechecks, and B5's
    `assess(bundle, logs, today)` accepts the same array.
  - Dependencies: Task 0.2 (schema patterns), 0.3 (redis client).

- [ ] **Task 0.8: Install the packages.** Per `07` — Task 0.3 imports
      `@upstash/redis` but no task installed it. Run on `main` before the fork:
      `pnpm add @upstash/redis @vercel/blob ai server-only`.
  - `server-only` is the guard `05` recommends for `lib/store/*`,
    `lib/extraction/*` and `lib/drugs/*` — it turns "a client component imported
    a server module" into a build error rather than a leaked secret.
  - `pnpm-workspace.yaml` carries `minimumReleaseAgeExclude` entries; if an
    install is blocked by the release-age quarantine, add the package there
    rather than disabling the setting.
  - Verify: `pnpm typecheck` still passes; lockfile committed.

**Checkpoint 0:** `pnpm typecheck && pnpm lint && pnpm format:check` all pass.
Both coders can import `ExtractedBundle`, `redis()` and `appendLogEntry()`.
`POST /api/seed` populates `portico:plan:demo`. Both devs can state `LogEntry`'s
shape without looking it up. **Fail = nobody branches.**

---

### Track A: Ingestion, Timeline, Drug Data

**Owns:** everything from a photographed letter to a rendered day-by-day plan
with drug context attached. Vertical slice, touches both `lib/` and UI.

**Medic discharge corpus (landed):** `fixtures/discharge-summaries/` — not
`public/` (those files must not be URL-served). Five synthetic NHS discharge
pairs (PDF source + form-shaped JSON gold label), plus the blank template:

| #   | Patient                                          | Condition                                  | Role                                                       |
| --- | ------------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------- |
| 02  | **Whitfield, Harold** (82)                       | Pneumonia + infective exacerbation of COPD | **Demo gold** [L6] — A1 seed + live demo path              |
| 05  | Bradley, Susan                                   | COPD                                       | **Red-flag QA letter** — best safety-netting in the corpus |
| 04  | Sinclair, Margaret                               | NOF fracture                               | QA / E2E only (was gold; see below)                        |
| 01  | Clarke, Emma                                     | Cholecystitis                              | QA / E2E only                                              |
| 03  | Okafor, David                                    | NSTEMI                                     | QA / E2E only                                              |
| —   | `NHS Discharge Summary Template (corrected).pdf` | blank form                                 | template reference only                                    |

The `.json` files mirror the NHS discharge-summary form fields. They are **not**
`ExtractedBundle`. Full field-by-field coverage, with quoted source strings:
`11-fixture-corpus-readiness.md`.

#### Why the gold letter changed from Sinclair (04) to Whitfield (02) [L5/L6]

The medic's call was apixaban over enoxaparin. **Whitfield is the only letter in
the corpus carrying apixaban**, so the drug decision and the letter decision are
one decision. On inspection Whitfield is also simply the better demo letter:

- **`Apixaban 5mg BD`, ongoing, for permanent AF** — a genuinely high-stakes
  daily anticoagulant, and it resolves on NHS.uk with **2 urgent blocks**. The
  hero drug now has real red-flag content behind it, which under Sinclair it
  never could (enoxaparin is `absent`).
- **`Doxycycline 100mg — 2 days (complete)`** — a course with a hard end date. A
  natural "finish the course" adherence beat that expires on camera.
- **`Ramipril — WITHHELD, GP review`** — a _withheld_ medication. The single most
  confusing thing on a real discharge letter, it exercises
  `medications_stopped_or_changed`, and it is exactly what this product exists to
  make unambiguous.
- **The family member is already in the letter** — _"discussed with patient and
  daughter (with consent)"_, _"Daughter aware/involved in care; has contact
  details for community matron and falls team."_ D5's family dashboard gets a
  named persona from the source instead of an invented one.
- **Both `DateAnchor` shapes appear in one letter**: `~05/09/2026` (approximate
  date) and `"Within 2 weeks"` (relative) — A3 gets real test data.
- 7 medications, so the timeline has real texture.

**Known weakness, accepted:** its red-flag line — _"Advised to seek urgent help
if breathless, feverish or confused again."_ — names **no recipient**, so
`escalationChannel` derives to `"other"` and `contactIds` is `[]`. That is a
legal, named state, not a bug. **3 of the 5 letters share this gap** (only Okafor
and Bradley name an actor), so it is a corpus-wide limitation to raise with the
medic, not a reason to pick a different letter. **05 Bradley is the designated
red-flag QA letter** because it has the best safety-netting in the corpus — two
tiers, both actors named: _"Advised to contact GP/111 if breathless, feverish or
coughing blood; call 999 if severe."_ Exercise the red-flag path against Bradley
even though the demo runs on Whitfield.

#### Phase 1 (Track A)

- [ ] **Task A1: Seed fixture.** `lib/plan/samples/demo-plan.ts` —
      `satisfies ExtractedBundle`, grounded in **Harold Whitfield / pneumonia +
      COPD exacerbation**
      (`fixtures/discharge-summaries/02_Whitfield_Harold_Pneumonia.{pdf,json}`) —
      the locked demo letter [L6]. Schema stays condition-agnostic
      (`episode.kind` etc.); only the seed content is Whitfield-shaped.
      `POST /api/seed` writes it to Redis.
  - **Split this task — it is mis-sized as written** (`11 §Sizing`). It reads as
    30–45 minutes of transcription but is ~2 hours of authoring, because roughly
    40% of the clinically-loaded fields must be **composed, not copied**: the NHS
    form has no directions sentence (`doseDirectionsVerbatim`), no indication
    column (`purposePlain`), and no configured escalation class.
    - **A1a (~45 min):** `documents`, `patient`, `episode`, `medications`,
      `contacts`. Unblocks A2, A3, A7 and B3 immediately.
    - **A1b (~45–60 min):** red flags + their French, `instructions`,
      `appointments`, `extraction.unresolved[]`, and the primed adherence log
      B14 needs.
  - **The JSON supplies facts and field mapping; the PDF supplies strings.**
    Do **not** lift `SourceRef.quote` from the JSON — quotes must come from the
    PDF text or they will not match the document on screen. And because the gold
    JSON is also the extraction answer key, **a diff of A6's output against it is
    not an independent measurement for the demo letter** — do not quote that
    number on stage.
  - **`SourceRef.page` is load-bearing:** all six PDFs are 2-page, page 1 =
    episode/advice, page 2 = the whole medication table.
  - **Seed the honesty channel too.** The corpus contains no `readConfidence:
"unclear"` and no cross-document conflict, yet `01` calls that "the schema's
    most important feature". Whitfield does contain one usable real conflict to
    seed from: `Ramipril` is `WITHHELD-GP review` while still appearing in the
    discharge medication list — exactly the ambiguity `extraction.unresolved[]`
    exists to surface.
  - Files: `lib/plan/samples/demo-plan.ts`, `app/api/seed/route.ts`
  - Acceptance: `curl -X POST localhost:3000/api/seed` populates
    `portico:plan:demo` and `portico:patient:demo` with Whitfield-derived facts
    (pneumonia/COPD, apixaban + the doxycycline course + the withheld ramipril,
    and the daughter as the escalation contact).
  - Dependencies: Task 0.2, 0.3, 0.7.

- [ ] **Task A2: `lib/store/plan.ts`, `lib/store/patient.ts`.** Read/write with
      `ExtractedBundle.parse()` on every read (Redis reads are a trust boundary).
  - Files: `lib/store/plan.ts`, `lib/store/patient.ts`
  - Verify: a manually corrupted Redis value throws a clear parse error
    instead of `undefined` three components deep.

- [ ] **Task A3: `lib/timeline/schedule.ts` — pure functions.** `buildTimeline
(bundle, today) => Day[]`, `dueToday(bundle, today) => Item[]`. No I/O, no
      React import — this runs both server-side (rendering `/plan`) and inside a
      voice tool handler later.
  - Files: `lib/timeline/schedule.ts`
  - Acceptance: handles all three `DateAnchor` variants (`offset`, `date`,
    `conditional`); a `conditional` anchor never produces a day number.
  - **`today` is always a parameter — never call `new Date()` inside these
    functions, and never inline it at a call site.** The demo clock in B10.5
    depends on this: one `getDemoToday()` accessor supplies `today` everywhere,
    so overriding it moves the whole app's sense of "now" at once. Retrofitting
    that later means hunting every date read in the codebase.
  - Verify (if time allows a test): a handful of vitest cases per anchor
    variant.

- [ ] **Task A4: Rebuild `/plan`.** Replace the placeholder. Async Server
      Component: `Promise.all([readPlan(), readLog(today)])`, call
      `buildTimeline`, render `<Timeline/>`.
  - Files: `app/(phone)/plan/page.tsx`, `components/plan/timeline.tsx`,
    `day-section.tsx`, `task-row.tsx`
  - Acceptance: renders the seeded demo plan as a day-by-day list inside the
    phone frame (no `dvh`/`vh`, fills with `flex min-h-0 flex-1 flex-col`).
  - Dependencies: A1, A2, A3.

**Checkpoint 1 (joint with Track B):** `/plan` shows a real timeline from
Redis. `/check-in` (Track B) starts a session with the same plan's data in
its system prompt. Both are reading `portico:plan:demo`.

#### Phase 2 (Track A)

- [ ] **Task A5: Blob client upload.** `app/api/blob/upload/route.ts` mints a
      token via `handleUpload`; `components/upload/upload-panel.tsx` calls
      `upload()` from `@vercel/blob/client` directly from the browser (not a
      server `put()` — phone-camera bundles exceed the serverless body limit).
  - Files: `app/api/blob/upload/route.ts`, `components/upload/upload-panel.tsx`
  - **Access is already decided — the store is `Private` (C5).** This is no
    longer an open question; it is a fact of the provisioned store
    (`juno-letters` / `store_D2WuxECBKxmSPVzn`). Do not switch it to public to
    make A6 or A9 easier — that silently breaks the "we do not share your
    health information" promise already on the home screen.
  - **The `onUploadCompleted` localhost trap applies here too**, not only to
    B4: Vercel's Blob service calls that callback from _its_ backend, so it
    cannot reach a dev machine. Either skip the callback locally or use the
    same deployed alias B4 settles on.
  - **Accept both a camera capture and a file, in one control.** The corpus
    gives us PDFs today, so the file path is testable immediately — but the demo
    story is photographing a letter. Use
    `accept="image/*,application/pdf"` with `capture="environment"` on the
    input, and accept multi-file selection (a discharge bundle is several pages).
    Do not build two separate upload affordances.
  - Verify: a multi-page photo bundle **and** a corpus PDF both upload without
    hitting a body-size error, and both reach `/api/extract`.

- [ ] **Task A6: `lib/extraction/extract.ts` + `/api/extract`.** AI SDK call:
      `generateText` + `Output.object({ schema: ExtractedBundleFromModel })`
      through the **AI Gateway with an OpenAI model** [L9].
      **Status (2026-07-25):** a route and extract path exist, but they call
      **Anthropic direct** with prompt-injected JSON Schema — that is a
      deviation to **undo**. Do not keep the Claude workaround; OpenAI can take
      this nullable schema under structured outputs. `llmEnv()` must read
      `AI_GATEWAY_API_KEY` again (not `ANTHROPIC_API_KEY`).
      Merge `blobUrl`/`blobPathname` back in after parse (never ask the model
      for a URL). Re-validate the merged object with the full `ExtractedBundle`
      schema before writing to Redis.
  - Files: `lib/extraction/extract.ts`, `app/api/extract/route.ts`
  - **API shape now verified against `ai@7.0.37` (07 §Grounding) — the plan was
    right, so stop treating it as unknown:** `import { generateText, Output }
from "ai"`; the parameter is `output`, **not** `experimental_output`; and
    `generateObject` carries `@deprecated Use generateText with an output
setting instead` (`dist/index.d.ts:7121`).
  - **But A6's acceptance below described an API that does not exist.**
    `Output.object` validates _inside_ the SDK and **throws
    `NoObjectGeneratedError`** — there is no `safeParse` result at that layer.
    So there are **two distinct failure surfaces and both need their own 422**:
    (a) the model produced nothing schema-shaped → catch
    `NoObjectGeneratedError`; (b) the merged object fails the full
    `ExtractedBundle` parse after `blobUrl` is added back → Zod error. Do not
    collapse them into one catch — they mean different things to the operator.
  - **Private-blob consequence (C5):** you cannot pass the model a bare
    `blobUrl`. Read the bytes server-side and send them inline. The current
    file-part shape is `{ type: "file", mediaType, data }` — `{ type: "image" }`
    no longer exists.
  - Fetch the live model ID rather than hardcoding:
    `curl -s https://ai-gateway.vercel.sh/v1/models | jq ...`
  - Acceptance: a real photographed letter produces a plausible
    `ExtractedBundle`; **either** failure surface returns a 422 with a plain
    sentence naming which one it was, never a 500 and never a fabricated plan.
    Demo path = Whitfield PDF. QA path = run the other four PDFs too and
    spot-check each against its sibling form JSON (not `ExtractedBundle`) so
    demographics, meds, and dates are not invented.
  - Dependencies: A5, 0.2.

- [ ] **Task A6.5: Extraction accuracy harness — the checking mechanism.**
      `scripts/eval-extraction.ts`, run by `make eval`. Runs A6's extraction over
      **all five** corpus PDFs and scores the result against the medic's JSON
      gold labels. This is what lets us say "the AI works" with a number instead
      of a vibe, and it is the prerequisite for ever trusting the seeded path in
      A6.6.
  - **No test runner needed.** Node 26 strips TypeScript natively, so this is a
    plain `.ts` file run as `node scripts/eval-extraction.ts` — no `vitest`
    (skipped per L8), no `tsx` dependency.
  - **The two documents are different shapes**, so this is a _mapped_ comparison,
    not a diff: the medic's JSON is the 18-key NHS form; ours is
    `ExtractedBundle`. Write the mapping once, in the harness, and score these
    five families separately — a single blended percentage hides the failures
    that matter:

    | #   | Family               | Comparison                                                                             | Threshold                                                                                         |
    | --- | -------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
    | 1   | **Patient identity** | exact on surname, forename, DOB, NHS number                                            | **100%** — the wrong patient is catastrophic, not a score                                         |
    | 2   | **Medications**      | order-insensitive set match on normalised `{name, dose, frequency, route}`             | **100% recall on drug _names_** (a dropped drug is the dangerous failure); ≥90% on dose/frequency |
    | 3   | **Appointments**     | normalised date + owner                                                                | **100% recall** — never silently lose a follow-up                                                 |
    | 4   | **Red-flag quotes**  | every `triggerVerbatim` / `actionVerbatim` appears in the PDF text                     | **100%** — see the invariant below                                                                |
    | 5   | **Source refs**      | every `SourceRef.documentId` resolves, and its `quote` appears in that document's text | **100%**                                                                                          |

  - **Families 4 and 5 are the ones that actually enforce the product's claim.**
    Everything Portico says is supposed to be the clinician's own words. A quote
    that is not in the document is a hallucination, and the harness should fail
    loudly on exactly one occurrence — there is no acceptable rate.
  - **The substring invariant is already calibrated — use these numbers.**
    Measured across all five letters, comparing every JSON string value ≥12 chars
    against `pdftotext` output: - Compare **whitespace- and punctuation-insensitively** (`squash`: lowercase,
    strip everything non-alphanumeric). The NHS form wraps values across lines,
    so a naive `includes()` fails on text that is genuinely present. - Do **not** use `pdftotext -layout` — it scored _worse_ (81% vs 87%) because
    it pads columns inside lines. - With squashing, **158/174 (90%)** of gold values are found verbatim. - **The 16 misses are not extraction errors** — they are JSON-side
    compositions: patient addresses and GP practice names, comma-joined in the
    JSON from separate form cells (e.g. `"8 Orchard Grove, Basingstoke, RG21
5FJ"`), plus four long clinical sentences that span a cell boundary. **So
    exempt composed identity fields from family 4/5 and apply the invariant to
    clinical text only** — otherwise the harness reports a 90% ceiling forever
    and everyone learns to ignore it.
  - Files: `scripts/eval-extraction.ts`, `Makefile` (add `eval`)
  - Acceptance: `make eval` prints a per-letter, per-family table and exits
    non-zero if any threshold is missed. Run it against all five letters, not
    just the demo one — a pipeline tuned on one letter is one-letter-shaped.
  - Dependencies: A6.

- [ ] **Task A6.6: Implement `PORTICO_MODE`.** See §Demo mode vs live mode for
      the full contract — this task builds it. One switch,
      `NEXT_PUBLIC_PORTICO_MODE = "live" | "demo"`, defaulting to `live`.
  - `lib/env.ts` — add it to the browser-safe `env` object (it is public by
    design; the UI must render it). A two-branch literal union, so no Zod enum
    gymnastics: narrow it once and let TypeScript carry it.
  - `lib/extraction/extract.ts` — in `demo`, load the baked bundle instead of
    calling the gateway. **The baked bundle is A1's seed fixture**, which is
    already `satisfies ExtractedBundle` — do not maintain a second copy.
  - **The rule that matters, restated because this is where it gets broken:** a
    `live` extraction failure returns the 422 A6 specifies. It does **not** fall
    through to the baked bundle. No `catch` around the gateway call may reference
    the demo path.
  - **Make it visible** — a persistent, unmissable marker whenever the mode is
    `demo`, plus the mode in the `/api/extract` response body and on the stored
    bundle. Use the existing design tokens; this is on camera, so it should look
    deliberate rather than like a debug string.
  - Files: `lib/env.ts`, `lib/extraction/mode.ts`, `lib/extraction/extract.ts`,
    `app/api/extract/route.ts`, plus the badge component
  - Acceptance: with `demo`, the full arc runs with **zero** AI Gateway and
    **zero** NHS.uk calls, and the screen says so. With `live` and the gateway
    key removed, `/api/extract` 422s — it does not quietly serve the baked JSON.
  - Dependencies: A6, A6.5 (do not trust the baked path until the live one has
    been measured), A1 (supplies the baked bundle).

- [ ] **Task A7: `lib/drugs/lookup.ts` — NHS.uk fetch + Redis cache.** Resolve
      slugs against the cached A-Z index (260 entries); extract every
      `identifier: "urgent"` block across **all** aspects (not just
      side-effects — the overdose warning sits under
      `UsageOrScheduleHealthAspect`). 24-hour TTL.
  - **Ground truth already exists: `fixtures/nhs-drug-map.json`** (see **C11**).
    Every drug in all five letters is resolved there, with slug, alias kind,
    state and extracted urgent blocks. Use it as the A7 test oracle — if your
    implementation disagrees with that file, your implementation is wrong.
  - **Correct nesting — the plan previously had this one level too shallow:**

    ```ts
    // ld+json -> hasPart[] (HealthTopicContent) -> hasPart[] (WebPageElement)
    for (const aspect of doc.hasPart ?? [])
      for (const el of aspect.hasPart ?? [])
        if (el.identifier === "urgent") {
          // aspect.hasHealthAspect, el.headline, el.text
        }
    ```

    Scanning only the top level returns **zero** urgent blocks on every drug.

  - **Return a four-state discriminated union, not a bare `null`.**
    `03:426`/`:441` say "on any failure at any layer, return `null`", which
    collapses states that mean opposite things — the silent clinical
    degradation D9 §5 bans:

    ```ts
    | { kind: "found"; slug: string; match: "exact" | "partial"; urgent: UrgentBlock[] }
    | { kind: "no-urgent-guidance"; slug: string }  // page exists, no urgent block: 6 of 25
    | { kind: "absent" }                            // not on the A-Z at all: enoxaparin
    | { kind: "unavailable" }                       // fetch failed - NEVER "not listed"
    ```

    All four need their own visible state in A9. A `partial` match (combination
    products) must say on screen which component the NHS page actually covers.

  - **`PORTICO_MODE=demo` reads `fixtures/nhs-drug-map.json` and makes no network
    call at all.** That file was generated by a real NHS.uk fetch, which is
    exactly what licenses using it (rule 3 in §Demo mode vs live mode). In
    `live`, the resolution order stays Redis cache → network → that file as a
    last-resort seed, and a seed hit is labelled as a seed hit.
  - **Slug resolution needs an alias layer**, not `name.toLowerCase()` — 9 of 25
    drugs fail a naive slug (`paracetamol`, `co-codamol`, `ibuprofen` all 404;
    the real slugs end `-for-adults`, which is the variant to prefer since every
    patient in the corpus is an adult). The committed map carries every alias.
  - Files: `lib/drugs/lookup.ts`, `app/api/drug-info/route.ts`
  - **Guard:** `/api/drug-info` must validate the requested drug against the
    names already in the patient's stored plan and 404 anything else — this
    is what keeps the feature inside the scope line (no open drug lookup).
  - Verify against the committed map: expect **18 `found`, 6
    `no-urgent-guidance`, 1 `absent`** across the 25 unique drugs. Spot checks —
    `apixaban` and `oxycodone` return 2 urgent blocks each; `ramipril` and
    `alendronic acid` are `no-urgent-guidance` (a page, but no urgent content);
    `enoxaparin` is `absent`. See **C11** for why `absent` on the demo's
    clot-preventer is expected and is not a bug to work around.
  - Dependencies: **A1, not A6.** A7 only needs _a_ medication list, and A1's
    seed fixture provides one. Chaining A7 behind A6 stacks both external
    integrations in series and puts the NHS.uk work behind the LLM work for no
    reason — if extraction slips, drug lookup should not slip with it.

- [x] **Task A8: offline drug seed — DONE ahead of time.**
      `fixtures/nhs-drug-map.json` is committed and covers **every** drug in all
      five letters, not just the demo one — verified slug, alias kind, state and
      extracted urgent blocks. NHS.uk answered 25/25 cleanly during this pass,
      so this is insurance, not a workaround.
  - **Still required of the implementer:** resolution order must be explicit and
    logged — **Redis cache → network → this seed** — and a seed hit must be
    visibly labelled as a seed hit, never dressed up as a live NHS response
    [Locked D9]. A seed hit is a named state, not a silent substitute.
  - Regenerate rather than hand-edit if the corpus changes.

**Checkpoint 2 (joint):** A real photographed letter → extraction → timeline
→ drug context, all working live. Track B's voice tools can log against this
real plan instead of the seed.

#### Phase 3 (Track A)

- [ ] **Task A9: Red-flag card + source-trace UI.**
      `components/plan/red-flag-card.tsx` renders `triggerVerbatim` +
      `actionVerbatim` with visual precedence (doctor's words primary, any
      NHS-derived content visibly secondary, per `[03 §Safety framing]`). A "tap
      to see where it says that" affordance opens the source Blob image.
  - Files: `components/plan/red-flag-card.tsx`,
    `app/api/blob/source/[...path]/route.ts`
  - **The source image needs a route handler (C5).** The Blob store is
    Private, so `<img src={blobUrl}>` and `next/image` both 401. Add a small
    authenticated route that calls `get(pathname, { access: "private" })` and
    streams the bytes, and point the affordance at that. Scope it to pathnames
    referenced by _this_ patient's stored plan — same guard as `/api/drug-info`.
  - **Dual EN+FR render is this task's job [Locked D7].** In French mode the
    card shows the French translation **and** the doctor's exact English words,
    English labelled as the original. Consumes `triggerFr`/`actionFr` from
    Task 0.2 and the label strings from B1's dictionary — so the FR label keys
    must exist before this task starts. Put `lang="en"` and `translate="no"` on
    the verbatim English block so screen readers pronounce it correctly and
    browser auto-translate cannot rewrite a clinical instruction.
  - Acceptance: NHS-derived text always carries its attribution line inline,
    per the licence bucket (English-unmodified vs any-translation) —
    structural, not optional.

- [ ] **Task A10: `components/plan/task-check.tsx`.** The one client leaf in
      the otherwise-server-rendered timeline. Optimistic tick, then persist,
      then `router.refresh()`.
  - Files: `components/plan/task-check.tsx`, `app/actions/log-step.ts`
  - **Do NOT call B4's `/api/log` (C7).** That route authenticates with a
    header only ElevenLabs holds; a browser leaf cannot send it without
    shipping the secret in the client bundle. A manual tick also has no
    `check_in_id`. Use a **Server Action** instead — B2 already establishes
    that pattern for `set-locale` — and have it call the shared
    `appendLogEntry()` from Task 0.7 with `source: "manual"`.
  - Both write paths therefore converge on one function, not one HTTP route.
    That is the seam: **Task 0.7, agreed in Phase 0**, not a mid-build
    negotiation with Track B.
  - Dependencies: Task 0.7 (owns `LogEntry` + `appendLogEntry`). **No longer
    blocked on B4.**

- [ ] **Task A11: Accessibility pass on plan/upload screens.** Fix contrast
      (`ink-faint` is 2.74:1, do not use for text), ≥44px targets, empty/error
      states in plain language, `prefers-reduced-motion` if any motion was added.
  - Files: touched components from A4, A5, A9

**Checkpoint 3 (Track A complete):** Upload a real letter on stage, watch the
timeline build, tap a red flag, see the source photo.

---

### Track B: Voice, Escalation, Family Dashboard, i18n

**Owns:** everything from "the patient taps the check-in card" through "the
family sees an escalation", plus making all of it work in English and French.

#### Phase 1 (Track B)

- [ ] **Task B1: `lib/i18n/` — the dictionary module.** `locales.ts`
      (`REAL_LOCALES = ["en","fr"]`, `SHOWCASE_LOCALES = ["cy","pl","ro","tr",
"pt","es"]`, `LOCALE_COOKIE`), `dictionary.ts` (`getLocale()` reads cookie,
      then `Accept-Language` only to pick an initial real locale — never to
      invent a half-translated screen; `getDictionary(locale)`), `en.ts`,
      `fr.ts` (`satisfies Dictionary` — a missing French key is a **compile
      error**, not a runtime English fallthrough [Locked D9]).
  - Files: `lib/i18n/locales.ts`, `dictionary.ts`, `en.ts`, `fr.ts`
  - **⚠️ `05:628` is wrong and B1 must not follow it (C10).** It instructs
    `getDictionary` to `switch` and return **`en` for the six showcase
    locales`** — the exact English fallthrough D9 §2 bans. `getDictionary`
    returns a dictionary for `en`/`fr` only; a showcase locale resolves to an
    explicit "not yet" state that the caller must handle, so the type system
    makes the English leak unrepresentable rather than merely discouraged.
  - Acceptance: covers all ~55 strings enumerated in `[04 §Why the
zero-dependency option wins]`, plus the persona content below, **plus the
    D7 red-flag labels A9 needs** ("exact words from your letter" and its
    authored French counterpart) — A9 lands in Phase 3 and has nothing to use
    otherwise.
  - No Zod needed here — a cookie value narrowed by a two-branch comparison
    is already typed.

- [ ] **Task B2: `app/actions/set-locale.ts` + wire the picker.** Server
      action sets the cookie, `revalidatePath`. `components/language-picker.tsx`
      row handler calls it instead of just closing the menu. Also: delete the
      `FlagIcon` set (flags-for-languages is explicitly banned), filter out the
      currently-active locale from the list, remove the hardcoded "Default"
      badge, raise every row to ≥44px, put the same top-right control on every
      screen.
  - Files: `app/actions/set-locale.ts`, `components/language-picker.tsx`
  - Acceptance: picking Français reloads the page in French; picking a
    showcase language shows an in-language "not yet" panel — never a silent
    English fallthrough, never two languages on one screen.

- [ ] **Task B3: `lib/check-in-prompt.ts` → `buildCheckInPrompt(bundle, today,
locale)`.** Split the persona into authored `en` / `fr` content inside the
      dictionary (**no** machine translate). Compose today's plan slice + the
      persona + the "I'm not a clinician" line + the red-flag verbatim block into
      one system prompt string (the override _replaces_ the dashboard prompt —
      nothing outside this string exists at runtime). Rewrite `firstMessage` per
      `[02 §firstMessage — rewrite it]`. Fix `SUGGESTED_QUESTIONS` — "Is this
      normal after surgery?" is generic clinical Q&A and must be replaced or
      the prompt must force a plan-grounded/route-to-human answer.
  - Files: `lib/check-in-prompt.ts`
  - `check-in/page.tsx` becomes async: `await getLocale()`, read the plan,
    call `buildCheckInPrompt`, pass props into `<VoiceSession>`.
  - Dependencies: B1, A2 (needs `readPlan`), Task 0.1 (agent must exist).

- [ ] **Task B3.5: `voice-session.tsx` gains a `locale` prop.** Replace the
      hardcoded `overrides.agent.language: "en"` at line ~225 with the prop
      (`"en" | "fr"`).
  - Files: `components/voice/voice-session.tsx`
  - Verify: English session first (regression), then the **French ear-test
    gate (C2)** on the per-locale-pinned agent. If French audio is wrong,
    **stop** — do not downgrade to English voice under French UI [Locked D9],
    and do not switch TTS model. Go to Task B3.6.

- [ ] **Task B3.6: Two-agent contingency — pre-authorised, only if the C2 gate
      fails.** This exists so that failing the ear-test costs about an hour instead
      of a redesign. Do **not** build it speculatively; do **not** improvise
      something else if the gate fails.
  - Shape: one agent per real locale, each pinning its model in its **own base
    config** — `Portico EN` (`en` + `eleven_flash_v2`), `Portico FR` (`fr` +
    `eleven_flash_v2_5`). Nothing is then inferred from preset routing.
  - Verified constraint: `GET /v1/convai/conversation/get-signed-url` accepts
    only `agent_id` (plus `include_conversation_id`/`branch_id`/`environment`).
    There is no per-request language parameter, so **locale selection must be
    an agent-id switch** — that is the whole reason this is a second agent and
    not a flag.
  - Files: `lib/env.ts` (a second `NEXT_PUBLIC_AGENT_ID_FR`),
    `app/api/eleven/signed-url/route.ts` (accept a validated `locale` param and
    pick the id), `components/voice/voice-session.tsx`
    (`fetchSignedUrl(locale)` at `:216`).
  - **Mirror or it drifts:** both agents need the same five override toggles,
    the same `client_events` list, and the same registered tools. Script it or
    use `elevenlabs agents push`; do not click through twice.
  - This is the one sanctioned edit to `app/api/eleven/signed-url/route.ts`,
    which is otherwise marked untouched. Owner: **Track B.**
  - Dependencies: B3.5, and the C2 gate having actually failed.

**Checkpoint 1 (joint with Track A):** see Track A's Checkpoint 1. A
check-in session starts, reads the seeded plan, speaks English; a second
session speaks French on the same pinned agent.

#### Phase 2 (Track B)

- [ ] **Task B4: Server tools — `log_step`, `escalate_to_next_of_kin`.**
      `app/api/log/route.ts`, `app/api/escalate/route.ts`. Bind `patient_id` and
      `check_in_id` as **dynamic variables** (never model-filled). Register the
      tools on the ElevenLabs agent (dashboard/API, outside this repo) with
      `method: "POST"` explicitly (default is GET).
  - **🔴 `secret__` is NOT request authentication (C7).** Verified in the
    installed SDK (`@elevenlabs/client@1.15.2/dist/utils/overrides.js:32`):
    dynamic variables are sent **from the browser** inside
    `conversation_initiation_client_data`. The `secret__` prefix hides a value
    from the **LLM**, not from the **client** — anyone with devtools can read
    and forge it. Authenticate instead with `request_headers` carrying a
    `secret_id` (or `env_var_label`), which ElevenLabs resolves **server-side**
    and the browser never sees.
  - **These routes are for ElevenLabs only.** The browser's manual tick does
    _not_ call them — it uses A10's Server Action. Both paths converge on
    Task 0.7's `appendLogEntry()`. One shared function, two callers, two trust
    models — never one shared route.
  - Also set per-tool: `response_timeout_secs` (default 20 is long enough to
    strand a demo), and `tool_error_handling_mode` — the default narrates tool
    errors aloud, which on a projector is worse than silence.
  - Files: `app/api/log/route.ts`, `app/api/escalate/route.ts`
  - **The localhost trap:** ElevenLabs' backend calls this URL — it cannot
    reach a dev machine. Decide a stable deployed alias early and point the
    agent's tool config at it once, rather than re-editing on every push.
  - The escalation _threshold_ (twice-in-three-days) lives in
    `lib/escalation/rules.ts` (Task B5), not in the tool or the prompt — the
    agent only reports an event.

- [ ] **Task B5: `lib/escalation/rules.ts` — pure function.**
      `assess(bundle, logs, today) => { kind: "none" } | { kind: "nudge"; ... } |
{ kind: "alert-kin"; ... }`. Exhaustive `switch` at every call site.
  - Files: `lib/escalation/rules.ts`
  - Dependencies: A2/A3 patterns (same purity argument — must import nothing
    server-only, since a future tool handler could call it too).

- [ ] **Task B6: `show_red_flag` client tool.** `useConversationClientTool`
      inside `Session` in `voice-session.tsx`. Never throws internally (catch and
      return a plain string) — an uncaught error paints a red connection-error
      banner over the transcript on the projector.
  - Files: `components/voice/voice-session.tsx`
  - Verify: register the tool name exactly matching the agent config
    (case-sensitive); do **not** supply `onUnhandledClientToolCall` unless
    sending a result manually — it hangs the agent otherwise.

- [ ] **Task B7: Enable the live-tick UI without a second tool.** Wire
      `onAgentToolRequest` / `onAgentToolResponse` callbacks in `useConversation`
      to optimistically tick a step in the transcript UI as the server tool
      fires.
  - **Prerequisite already satisfied in Phase 1 — do not re-PATCH the agent
    (C4).** `agent_tool_request` and `agent_tool_response` are already in
    `conversation_config.conversation.client_events`, along with
    `client_tool_call` (which **B6** silently depends on and which no task ever
    named). Re-sending a `conversation_config` PATCH risks the C1 model pins.
    Verify by reading the agent back; only patch if something is missing.
  - Files: `components/voice/voice-session.tsx`

- [ ] **Task B8: `/family` dashboard.** Async Server Component:
      `Promise.all([readPatient(), readPlan(), readLog(recentDays)])`, call
      `assess()`, render `<EscalationCard/>`. `export const dynamic =
"force-dynamic"`.
  - Files: `app/(phone)/family/page.tsx`, `components/family/escalation-card.tsx`
  - Dependencies: A2, B5.

- [ ] **Task B9: `components/family/refresh-poller.tsx`.** The one client
      leaf on `/family`: `setInterval(() => router.refresh(), 5000)`, cleanup,
      returns `null`.
  - Files: `components/family/refresh-poller.tsx`
  - Verify with a real two-window test: log a miss on one device, watch it
    appear on another within 5s. Confirm `force-dynamic` is actually
    preventing a cached render (do not assume).

- [ ] **Task B10: Incoming check-in notification card (Tier A only — do NOT
      build Web Push).** A variant of `IdleView` that reads as an incoming
      check-in: orb, "Portico — your check-in", one large **Answer** button.
  - **The trigger is B10.5's operator panel** (button 4) — build the card to be
    driven by state, not by a timer, so the panel can raise it on cue. A
    due-time check can also raise it, but the demo path is the panel.
  - Files: `components/voice/voice-session.tsx` (or a new sibling component),
    home page wiring
  - Explicitly excluded: any Notifications API permission request, any
    service worker, any manifest. `[02 §Tier C — do not build]`.

- [ ] **Task B10.5: `/operator` — the demo control panel.** The recorded demo is
      **about 60 seconds**. The product's beats are inherently slow — a timeline
      measured in days, an escalation rule that needs "missed twice in three
      days", a check-in that arrives when it is due. None of that fits in a
      minute in real time, so every beat needs a trigger. This panel is that
      trigger, and it is the difference between a demo that demonstrates and a
      demo that waits.
  - **The one rule that keeps this honest [Locked D9]: the panel may only do
    things a real user could do, faster. It writes real state through the real
    code paths — it never paints fake UI.**
    - ✅ "Mark yesterday's apixaban missed" → writes a real `LogEntry` via
      `appendLogEntry()` → `assess()` genuinely returns `alert-kin` → `/family`
      genuinely escalates. Everything on camera is real.
    - ❌ "Show the escalation card" → renders a card nothing produced. That is
      mock data pretending to be live, and it is banned. If a judge asks "is
      that real?", the answer has to be yes.
  - **Controls needed, one tap each** (each maps to a route that already exists
    by this point — the panel is a control surface, not new logic):
    1. **Reset to a known state** — re-run the seed. Between takes, with no
       manual Redis surgery. (This is B14's `make seed`, given a button.)
    2. **Set the demo clock** — override "today". See the note on A3/A4 below;
       this is what makes a day-by-day timeline demonstrable in a minute.
    3. **Mark a step taken / missed** — prime the escalation without waiting
       three days, and without speaking to the agent.
    4. **Send the check-in notification** — this is the "discreet operator
       control" B10 already refers to. B10 and this are the same mechanism.
    5. **Toggle `PORTICO_MODE`** (A6.6) — so a take can be re-run without
       burning a gateway call, visibly.
  - **It is a second screen, not part of the app.** The operator drives it on a
    laptop while the phone shows Portico. So it lives **outside the `(phone)`
    route group** — a plain desktop-width page, no bezel, no phone shell, and
    therefore none of the shell's constraints apply to it. Do **not** link it
    from any product screen.
  - **Build it early, not as polish.** Both devs will otherwise hand-edit Redis
    for every test of the timeline and the escalation rule. A crude version the
    day before is worth hours; a beautiful version on demo night is worth
    nothing. It is placed in Phase 2 because that is when its routes exist, but
    if either dev finds themselves editing Redis by hand twice, build it then.
  - **Taste:** it is internal tooling, so it does not need the product's design
    system — but it is on camera if the shot ever widens. Plain, legible,
    generously spaced buttons; no icon library; and it must never be mistaken
    for a patient-facing screen. Label it "Operator — not part of the product".
  - Files: `app/operator/page.tsx`, `components/operator/*`,
    `app/api/demo/clock/route.ts`
  - Acceptance: with the phone on `/plan` and the laptop on `/operator`, every
    beat of the demo arc can be triggered within two seconds, and each one is
    genuinely produced by the app rather than staged.
  - Dependencies: B4 (log/escalate), B8 (`/family`), A1/0.7 (seed + log store),
    A6.6 (mode toggle).

**Checkpoint 2 (joint):** A voice call logs adherence via a server tool; the
UI ticks live via the callback path; a second miss on a high-stakes med
produces a visible escalation on `/family` from a different device.

#### Phase 3 (Track B)

- [ ] **Task B11: French voice re-confirmation before the demo.** The _gate_
      already happened at Checkpoint 1 (C2 / Task B3.5); this is the pre-demo
      re-check that nothing drifted since.
  1. Read the agent back and confirm **both** pins (C1): base
     `tts.model_id = eleven_flash_v2`, and
     `language_presets.fr.overrides.tts.model_id = eleven_flash_v2_5`.
     **Do not "fix" the base model to `eleven_flash_v2_5` — the API rejects
     that, and the only config it would accept instead is a silent downgrade.**
  2. One real session with `overrides.agent.language: "fr"` and the authored
     French `firstMessage` / prompt.
  3. Ear-test TTS and ASR **separately**. **HTTP 200 proves nothing** — Phase 1
     reproduced this: Welsh text on a model with no Welsh support returned 200
     and 74KB of healthy-looking audio (`06 §6`). Only ears settle it.
  4. Bad audio is a **failed** check — escalate to the human and go to B3.6.
     Do **not** ship French UI + English voice [Locked D9].
  - Dependencies: 0.1, B3, B3.5.

- [ ] **Task B12: High-stakes ASR safety (not a language fallback).**
      `overrides.asr.keywords` seeded from the plan's actual drug names plus
      French/English yes-no tokens (needs Security toggle
      `ASRConversationalConfigOverrideConfig.keywords`). Tappable French answer
      chips via `SuggestedQuestions`. Confirm-before-logging on high-stakes
      steps. Composer stays available as an **explicit** typed path the user
      chooses — not a silent substitute for broken ASR.
  - Files: `components/voice/voice-session.tsx`,
    `components/voice/suggested-questions.tsx`

- [ ] **Task B13: Accessibility pass on voice/family/check-in screens.**
      `prefers-reduced-motion` block in `globals.css` stopping the orb's pulse
      and the listening/thinking dots (state stays legible via the existing
      `aria-live` text label). Standardise `focus-visible` treatment across every
      interactive element — several currently have none.
  - Files: `app/globals.css`, various

- [ ] **Task B14: Demo rehearsal + seed script.** A `make seed` target
      (`curl -X POST localhost:3000/api/seed`) resets to a known state — two
      prior misses on **apixaban** (the gold letter's anticoagulant, per L5/L6),
      so the escalation is already primed. The same reset is button 1 on the
      B10.5 operator panel; `make seed` is the headless form of it.
  - **Rehearse against the 60-second limit, with a stopwatch.** If a beat cannot
    be triggered and shown inside its share of the minute, that is a finding
    about the panel, not about the presenter.
    Write the operator runbook steps from `[02 §What the demo operator does]`
    onto a physical card or a pinned note.
  - Files: `Makefile` (add `seed` target)

**Checkpoint 3 (Track B complete):** the full demo arc runs twice
back-to-back without manual Redis surgery between runs.

---

## Two-dev operating model

Full derivation, the 24 checkable taste rules and the 29 enumerated
"helpful fallback" temptations: `09-track-3-two-dev-seams.md`.

**Three rules everything else hangs off:**

1. **One file, one hand.** Every path has exactly one owner at a time.
2. **Contracts are frozen before the fork**, not negotiated during it.
3. **Every checkpoint has a named verifier, a runnable command, and a written
   consequence for "fail."** A checkpoint nobody can fail is decoration.

### Phase 0 is not parallel work

Order matters, because two of these are repo-wide writes:

1. `make format` — alone, first (it touches six files; C9).
2. Task 0.8 `pnpm add` — alone, on `main`.
3. **Tasks 0.2 and 0.7 at one keyboard, both devs present.** These are the two
   shared contracts. Everything downstream is typed by them.
4. Then split the rest: 0.3, 0.4, 0.5, 0.6 are disjoint.

**Phase 0 exit — nobody branches until all of these are true:**
`pnpm typecheck && pnpm lint && pnpm format:check` all green; both devs can
import `ExtractedBundle`, `redis()` and `appendLogEntry()`; `POST /api/seed`
populates `portico:plan:demo`; and **both devs can state the shape of
`LogEntry` without looking it up.** If the last one fails, Task 0.7 was not
actually agreed — go back to it.

### File ownership

| Path                                                                                                | Owner                                                                                                           |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `lib/plan/schema.ts`, `lib/store/log.ts`                                                            | **SHARED — frozen after Checkpoint 1**                                                                          |
| `lib/store/{redis,plan,patient}.ts`, `lib/timeline/`, `lib/extraction/`, `lib/drugs/`               | Track A                                                                                                         |
| `fixtures/discharge-summaries/`                                                                     | Track A (corpus — do not serve from `public/`)                                                                  |
| `app/(phone)/{plan,upload}/`, `components/{plan,upload}/`, `app/api/{extract,seed,drug-info,blob}/` | Track A                                                                                                         |
| `lib/i18n/`, `lib/check-in-prompt.ts`, `lib/escalation/rules.ts`                                    | Track B                                                                                                         |
| `components/voice/`, `components/family/`, `components/language-picker.tsx`                         | Track B                                                                                                         |
| `app/(phone)/{check-in,family}/`, `app/api/{log,escalate}/`, `app/actions/`                         | Track B                                                                                                         |
| The **ElevenLabs agent itself**                                                                     | **Track B, one hand.** It has no version control and no merge.                                                  |
| `app/(phone)/page.tsx`                                                                              | **Contested — Track A owns the "due today" summary, Track B owns the check-in card. Sequence, do not co-edit.** |
| `app/(phone)/error.tsx`                                                                             | Track A (create in Phase 1)                                                                                     |

**Neither dev touches:** `app/(phone)/layout.tsx` (the phone shell),
the `@theme` block in `app/globals.css` (one sanctioned Phase 0 change: the
`ink-faint` contrast fix, then frozen), `pnpm-workspace.yaml`, the browser-safe
`env` object in `lib/env.ts`.

**Track A never touches** `components/voice/*` or the agent config.
**Track B never touches** `lib/extraction/*`, `lib/drugs/*` or `lib/timeline/*`.

**`voice-session.tsx` is the contention point** — B3.5, B6, B7, B12 all land in
it. Take them as **serial commits in that order**, never parallel edits. B10's
incoming-call card goes in a **sibling file**, and B12's answer chips go into
the existing `suggested-questions.tsx`, which keeps this file's growth to about
+60 lines instead of +250.

### Schema Freeze Protocol

`lib/plan/schema.ts` has no `.default()` and no `.optional()` — every clinical
field is `.nullable()`, and in Zod **`.nullable()` does not make a key
optional.** So _every_ post-fork schema change invalidates _every_ stored
bundle. There is no "small" schema change; there is only "reseed".

Therefore: **Dev A types every schema change**, regardless of who asked for it.
Announce four things — the field, the reason, the reseed command, the commit
sha. The other dev rebases, typechecks and reseeds on a **10-minute timebox**;
if it is not green in ten minutes the change is reverted, not debugged.
**Sealed after Checkpoint 1** — after that, additive-only or it waits.

### Checkpoints

- **Checkpoint 0** — Phase 0 exit above. **Fail = nobody branches.**
- **Checkpoint 1** — `/plan` renders a real Redis timeline; a check-in session
  reads that same plan; **and the C2 French ear-test gate is decided.**
  **Fail on the gate = start Task B3.6 immediately**, before any Phase 2 work.
  This is the one checkpoint that can change the architecture, which is why it
  is early.
- **Checkpoint 2** — upload → extract → timeline → drug context live; a voice
  call logs via the server tool and escalates visibly on `/family` from a
  **second device**. **Fail = cut, do not extend.** Agree the cut list here.
- **Checkpoint 3** — full demo arc twice, back to back, no manual Redis surgery.

### Shared taste rules — both devs, checkable in review

`CLAUDE.md` is law and beats every design skill where they conflict. The three
easiest to get wrong by obediently following a skill's default:

- **No `dvh`/`vh` anywhere inside the phone shell.** The frame owns the height;
  a child `min-h-dvh` resolves to the whole window and overflows the bezel.
  Fill with `flex min-h-0 flex-1 flex-col`. `/design-taste-frontend` tells you
  to use `min-h-[100dvh]` in capitals — **it is wrong for this repo.** This
  rule binds every screen task: A4, A5, **B2's showcase panel, B8 `/family`,
  B10** — the Track B ones never carried it and now do.
- **No icon library.** No `lucide-react`, no Heroicons, no Phosphor. The repo
  hand-rolls `components/icons.tsx`; the four icons `spec.md:93` needs
  (`IconUpload`, `IconPill`, `IconAlert`, `IconCheck`) are added **there**.
- **No monospace in the UI, ever.** Tabular figures come from `.tnum`.

Plus: semantic tokens only, never raw hex (the orb gradient is the one
sanctioned exception); `rounded-tactile`/`rounded-card`/`rounded-pill`;
structure from 1px hairline `rule` borders and `shadow-card`, not from
decorative gradients or `backdrop-blur`; motion 120–200ms ease-out, opacity and
small translate only; tap targets ≥44px; body measure ≤66ch; no block capitals;
no three-feature-card grids; no emoji bullets; and none of the banned fonts
(Inter/Geist/Roboto/Open Sans, Satoshi/General Sans/Clash Display/Bricolage).

**Contrast:** `text-ink-faint` is 2.74:1 and **fails AA** — it is decorative-glyph
duty only, never text. `text-success` (3.31:1) and `text-warning` (2.94:1) fail
as body text on `mist` too. Fix the token once in Phase 0, then `@theme` freezes.

**Review format:** cross-track, in the table above — Track A reviews Track B's
UI and vice versa, against these rules as written, not against taste.

## Checkpoints Summary

- **Checkpoint 0** (both, ~1h in): shared contract compiles, CI green,
  provisioning confirmed.
- **Checkpoint 1** (~4–5h in): a seeded plan renders on `/plan` and drives a
  real voice session in the chosen language.
- **Checkpoint 2** (~10–12h in): the full loop is real — upload, extract,
  check in, log, escalate, see it on a second screen.
- **Checkpoint 3** (final, before sleep/demo): polish, accessibility,
  rehearsal. Run the demo twice.

## Risks and Mitigations

| Risk                                                                                                              | Impact                                                                                       | Mitigation                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medic's scenario/bundle lands late or doesn't match the schema                                                    | ~~High~~ **Landed + demo picked** — Whitfield (02) is the gold seed [L6]; four others are QA | A1 maps `02_Whitfield_*` → `ExtractedBundle`; A6 must still pass on 01–03 and 05 so the pipeline is not one-letter-shaped                                                 |
| The `fr` language override does not actually reach `eleven_flash_v2_5` (French rendered by an English-only model) | **Highest — not machine-verifiable**                                                         | The C2 ear-test **gate** at Checkpoint 1, with Task B3.6 pre-authorised as the remedy. **Stop** on bad audio — no English-voice downgrade, no model substitution [D8, D9] |
| An operator "fixes" the base model to `eleven_flash_v2_5` to match old docs                                       | High — a 400, or a silent downgrade to `eleven_multilingual_v2`                              | C1 states the per-locale pin in three places; B11 step 1 says explicitly not to                                                                                           |
| Two coders both editing `voice-session.tsx`                                                                       | Medium — merge conflicts in the highest-traffic file                                         | Sequence B3.5 → B6 → B7 → B12 as commits, not parallel edits; Track A never touches this file                                                                             |
| ElevenLabs server tool can't reach localhost during dev                                                           | Medium — "the tool never fires" debugging session                                            | Decide a stable deployed alias in Task B4 before writing tool code, not after                                                                                             |
| AI SDK call shape differs from the audit's description (marked `[verify after install]`)                          | Medium — A6 blocked                                                                          | Install `ai` first, read `node_modules/ai/docs/` before writing the call, budget 30 min for this                                                                          |
| `next build` crashes on a module-scope client construction                                                        | Low, verified fix exists                                                                     | Every store module follows the lazy-factory pattern in Task 0.3; code review checks for `Redis.fromEnv()` at module scope                                                 |
| Someone "helps" by catching override/env errors and continuing                                                    | High — recreates silent fallbacks                                                            | Locked D9; code review rejects catch-and-ignore around `xxxEnv()` and override failures                                                                                   |

## Open Questions

**None remain that block coding.** Every question this plan previously escalated
is answered in §DECISIONS LOCKED (L1–L8). `tasks/spec.md §Open Questions` is
superseded by that table — read the table, not the spec section.

**Closed for Track A:** medic corpus landed at `fixtures/discharge-summaries/`;
**demo gold = Whitfield / pneumonia + COPD (02)** [L6], with **Bradley (05)** as
the red-flag QA letter. The other three are QA/E2E only. NHS drug lookup is
fully resolved and committed at `fixtures/nhs-drug-map.json`.

**Two things still worth raising with the medic — neither blocks anyone:**

1. **No letter names a callable clinical contact.** Across all five, the only
   phone numbers are the patient's own and a next-of-kin mobile, plus an internal
   `Bleep No.`. Only Okafor (999) and Bradley (GP/111 + 999) name any actor at
   all. So `contacts[]` in the seed is partly composed rather than transcribed,
   and `escalationChannel` derives to `"other"` on the gold letter. Legal and
   named — but a real letter would carry a ward number.
2. **No letter has been through a camera.** All six PDFs are born-digital with a
   perfect text layer — no skew, glare, fold or handwriting, which the medic
   brief explicitly asked for. **The photo path is therefore untested**, and A6's
   real-world behaviour is unmeasured. Photographing one printed letter before
   Checkpoint 2 would close this in ten minutes.
