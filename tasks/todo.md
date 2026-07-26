# Portico — Build Checklist

Full detail, acceptance criteria and citations: `tasks/plan.md` and
`tasks/spec.md`. Locked decisions (incl. French + no silent fallbacks + name):
`audit/juno-recovery-companion/00-locked-decisions.md` (D4, D8, D9, **D10**).

**Product name: Portico.** Juno is the hackathon host only — never the app
brand [Locked D10].

This file is the fast-scan version for the build itself.

> ### RECONCILED 2026-07-26 — the boxes below now match the repo
>
> Every box was re-checked against the code on 2026-07-26, file by file, and
> the boxes were moved to match. **Evidence, in the order it should be trusted:**
>
> - `17-deploy-and-tool-wiring.md` — Portico deployed, and **a real ElevenLabs
>   agent proven to invoke the deployed routes**. All three tools fired. This
>   closed the biggest hole in the build.
> - `14-track-3-adversarial-verify.md` — a cold-start adversarial re-run of the
>   whole arc by a verifier who tried to break it. **No FAKEs.** It tried four
>   separate ways to make the family escalation lie and could not.
> - `15-track-4-todo-reconcile.md` — the per-task inventory behind these boxes,
>   plus the disagreements between the reports and which reading was taken.
> - `12-track-1-demo-flow.md` (incl. §X4) and `13-track-2-demo-ui.md` — the two
>   build tracks' own reports, treated throughout as claims to check, not proof.
>
> **How to read a box now:**
>
> - `[x]` — the code exists, is wired to a caller, and was seen to do the thing.
> - `[ ]` — not done, **or** done-but-never-proven. Every unticked line that has
>   code behind it says so in its own parenthetical, so you can tell "nothing
>   written" from "written but never exercised" at a glance. One is now the
>   second kind: **B3.5**, whose English half is proven live and whose French
>   half nobody has heard.
>
> ### Two facts that can lose the shoot on their own
>
> 1. **Production ships the working tree, not `HEAD`, and most of this work is
>    uncommitted.** The live deployment is a snapshot taken at 01:20; the French
>    prompt fix, the localised `/plan` and `/upload`, the malformed-body fix and
>    `make clear-letter` all landed **after** it. The ElevenLabs tools point at
>    the production alias, so rehearsing on `localhost` exercises different code
>    from what the agent will call. **Redeploy before filming.**
> 2. **Local and production share one Redis and one Blob store.** `make seed` on
>    the laptop, the deployed operator panel and the agent's own tool calls all
>    mutate the same demo state. **Pick one host per take**, and re-seed between
>    takes.
>
> **The one thing still unproven that a demo could over-claim:** live extraction
> has never been shown to work anywhere (see A6). Everything else that failed
> adversarial contact has since been fixed and re-verified.
>
> **Tree health, re-measured on the third pass:** `pnpm typecheck`, `pnpm lint`
> and `pnpm format:check` **all pass**, and `make arc` is **21 passed, 0
> failed**. Nothing was loosened to make a check pass.
>
> **The tree has been moving all night** — several agents wrote to it while these
> boxes were being set, and at one point typecheck was briefly red from a
> half-landed dictionary edit. **Re-run the three checks yourself before
> trusting any of this.** These boxes describe the repo as of the third
> reconciliation pass, not as of whenever you are reading.
>
> **Extraction contract (unchanged, restated so nobody drifts):**
>
> 1. **Live / eval** — real PDFs → AI Gateway → **OpenAI structured outputs**
>    (`generateText` + `Output.object`) → score vs medic gold JSON via
>    `make eval`. That gates "the AI works." **Out of scope for the 2026-07-26
>    build night** — the code is still Anthropic direct + prompt JSON [L9].
> 2. **Demo mode** — **no** LLM extraction; use the baked Whitfield / seed
>    JSON. Voice / Redis / UI stay real. Live failures must never fall into
>    demo [D9]. This half is built and visible.

## Setup status (updated 2026-07-26) — read this first

**Infra is green and the ElevenLabs agent exists.** Do not re-provision
anything. Evidence: `audit/juno-recovery-companion/06-phase-1-readiness.md`.
Hole-finding passes: `07` (Track A), `08` (Track B), `09` (two-dev seams).
Consolidated go/no-go: `10-plan-lock-two-dev.md`. Build-night reports: `12`
(demo flow, incl. §X4), `13` (demo UI), `14` (adversarial verify), `15` (this
reconciliation), `17` (deploy + tool wiring).

**Portico is deployed at `https://juno-hack.vercel.app`**, and the ElevenLabs
agent's three tools are created, attached via `tool_ids` and proven firing
against it. Do not re-create the tools or the workspace secret; rollback steps
for every mutation are in `17-…md §Rollback`.

> ### ✅ DECISIONS LOCKED — no open human gates. Do not re-open.
>
> 1. **French ear-test PASSED.** Stay on the **single** Portico agent. Task
>    B3.6 (two agents) is contingency only — **do not build it**.
> 2. **Demo gold letter is now `02_Whitfield_Harold_Pneumonia`**, not Sinclair —
>    the medic chose apixaban and Whitfield is the only letter carrying it.
>    **05 Bradley** is the red-flag QA letter. Rationale in `plan.md` Track A.
> 3. **Agent LLM is `gemini-3.5-flash`**; voice stays Sarah; `auth.enable_auth`
>    stays **OFF**. All PATCHed and read back.
> 4. **Skip** the Tier 3 Resend email stretch and `vitest` unless spare time
>    remains at the end. Neither blocks anything.
> 5. **Extraction = OpenAI structured outputs via AI Gateway** [L9]. Anthropic
>    is out for this schema. `make eval` against corpus gold JSON licenses
>    demo's baked bundle.
>
> ### ⚠️ Five technical corrections that override older wording
>
> 1. **`eleven_flash_v2_5` cannot be pinned on an English agent.** The API
>    returns `400 "English Agents must use turbo or flash v2"`. The model is
>    pinned **per locale**: `en` → `eleven_flash_v2` (base), `fr` →
>    `eleven_flash_v2_5` (language preset). **Do not "fix" this.**
> 2. **Blob is Private** — closed by infrastructure. Source images need a
>    streaming route handler, not `<img>`.
> 3. **`secret__` is not request auth** — it hides a value from the LLM, not
>    from the browser. Use `request_headers` with a `secret_id`.
> 4. **A disallowed override does not throw** — the socket closes `1008` and it
>    surfaces via `onError`, so `try/catch` never sees it.
> 5. **NHS urgent blocks are in the NESTED `hasPart`** — scanning the top level
>    returns zero. Four states, not two. See `fixtures/nhs-drug-map.json`.
>
> Full detail and line numbers: `tasks/plan.md §DECISIONS LOCKED` and
> `§READ FIRST`.

### Done

| Item                             | Where                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product name locked              | **Portico** (D10) — not Juno                                                                                                                                                            |
| Vercel project linked            | `haider-projects/juno-hack` (slug legacy; product is Portico)                                                                                                                           |
| Claude Vercel MCP authenticated  | `claude mcp list` → ✔ Connected                                                                                                                                                         |
| Upstash Redis (free) provisioned | URL + token on Vercel Prod/Preview/**Development**                                                                                                                                      |
| Vercel Blob                      | `BLOB_READ_WRITE_TOKEN` on all envs                                                                                                                                                     |
| `AI_GATEWAY_API_KEY`             | Created and probed 200 on 2026-07-25. **No longer in the local env files** — restore it when A6 is rewired to the Gateway [L9]                                                          |
| `XI_API_KEY`                     | `.env.local` + Vercel; `GET /v1/user` → 200                                                                                                                                             |
| `NEXT_PUBLIC_XI_VOICE_ID`        | **Was pointing at a nonexistent voice** (`voice_not_found`) — fixed to `EXAVITQu4vr4xnSDxMaL` (French-verified) in `.env`, `.env.example` + Vercel all envs                             |
| `PORTICO_TOOL_SECRET`            | New for B4. Server-only, in `.env.local` + `.env.example`. ElevenLabs sends it as the `x-portico-tool-secret` header; it is never a `NEXT_PUBLIC_` var and never a `secret__` variable  |
| Local env layout                 | **`.env`** = public `NEXT_PUBLIC_*`; **`.env.local`** = quoted secrets. **Drifted:** `.env` now also carries an unused `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY` is in neither file     |
| Real locales locked              | **English + French** — D4/D8/D9. Model pinned **per locale**, see correction 1 above                                                                                                    |
| **Portico agent created**        | `agent_0201kyd61dnjey7bkz56hpyhs3f1` — in `.env` + Vercel all envs. All 5 D8 overrides verified; `client_events` corrected; live EN + FR sessions proved the overrides apply            |
| Blob store access                | **Private** (`juno-letters` / `store_D2WuxECBKxmSPVzn`) — decided by infra, not open                                                                                                    |
| **Deployed to production**       | `https://juno-hack.vercel.app` (stable alias). `PORTICO_TOOL_SECRET` added to Vercel Production — it was the blocker. **Ships the working tree, not `HEAD`: redeploy before filming**   |
| **ElevenLabs tools wired**       | Workspace secret `jSDnjhNCouONynsL6JwP`; `log_step`, `escalate_to_next_of_kin`, `show_red_flag` created **and attached via `tool_ids`**; all three proven firing from a real agent      |
| Free-tier confirmed              | Hobby Blob + Upstash free + AI Gateway $5 credits — fine for demo                                                                                                                       |
| Medic discharge corpus           | **`fixtures/discharge-summaries/`** — **demo gold = Whitfield pneumonia (02)** [L6]; **Bradley (05) = red-flag QA**; Sinclair / Clarke / Okafor = QA. Not in `public/`                  |
| **NHS drug lookup fully mapped** | **`fixtures/nhs-drug-map.json`** — all 25 corpus drugs resolved against the live A–Z: **18 found, 6 no-urgent-guidance, 1 absent, 0 failures.** A7's test oracle; A8 done early         |
| Demo clot-preventer              | **Apixaban** (medic's call) → gold letter switched to Whitfield, the only letter carrying it. Resolves on NHS.uk with 2 urgent blocks. Enoxaparin/Sinclair stay as the `absent` QA case |

### Still to do (before / as Phase 0)

| Item                    | Notes                                                                                                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packages                | **Done.** `@upstash/redis`, `@vercel/blob`, `ai`, `server-only` are all in `package.json`                                                                                                                                                                                        |
| Code Phase 0            | **Done.** Schema (`portico-extract/1`), `lib/store/log.ts`, redis client, clock, `llmEnv`/`blobEnv`/`redisEnv`/`toolEnv`, CI, `<html lang>`, override docs — see Phase 0 below                                                                                                   |
| Server tools webhooks   | **Done.** Deployed, tools created and attached via `tool_ids`, and a real agent proven calling them — see B4. A5's `onUploadCompleted` still cannot reach `localhost`, but the browser upload path does not depend on it                                                         |
| Extraction key          | **Live extraction is dead here.** `POST /api/extract` → 500, `ZodError: ANTHROPIC_API_KEY` at `lib/env.ts:47`, since commit `fe657f6`. Fails loudly and never serves baked data, but it means D9 rule 3 is breached — the demo shortcut has no runnable live counterpart. See A6 |
| Human calls outstanding | **One:** the French ear-test (B11). Everything else only a human could do is done — deployed, tools attached, a real agent proven calling them. See "Before filming" at the foot of this file                                                                                    |

### Env file contract (do not undo)

- Secrets → `.env.local` (quoted). Public → `.env`.
- `NEXT_PUBLIC_PORTICO_MODE` (`live` | `demo`, default `live`) is **public** —
  the UI has to render it. See `plan.md §Demo mode vs live mode`.
- `PORTICO_TOOL_SECRET` is **server-only** and lives in `.env.local`. It is the
  shared secret behind `/api/log` and `/api/escalate`.
- Never print secret values into chat, commits, or audit files.
- `vercel env pull .env.local --yes` is safe to re-run; it will not remove the
  layout above if you re-apply the split afterward.
- **Drift to fix:** `.env` currently holds a live `OPENAI_API_KEY`, which nothing
  in the codebase reads and which the file's own header says must not be there.
  It is gitignored, so it is not committed — but it is in the wrong file and has
  been read aloud by tooling. Move it, or rotate it.
- **Missing:** `ANTHROPIC_API_KEY`, which `llmEnv()` requires. Its absence is why
  live extraction 500s.

---

## Phase 0 — Shared foundation (BOTH — do together, ~1h)

- [x] Accept Upstash Marketplace terms; Redis provisioned + env on Vercel
      (Prod/Preview/Development)
- [x] Create `AI_GATEWAY_API_KEY` (local + Vercel all envs; probe 200).
      **Note:** it is no longer in the local env files — restore it with A6
- [x] Local `.env` / `.env.local` cleaned; secrets on Vercel for deploy
- [x] Real `XI_API_KEY` in `.env.local` (probe 200)
- [x] **Portico ElevenLabs agent created** — `agent_0201kyd61dnjey7bkz56hpyhs3f1`.
      Per-locale model pin, 5 overrides, `client_events` fixed, live EN+FR
      proof. **Do not redo; do not "fix" the base TTS model**
- [x] `make format` **first and alone**, then `pnpm typecheck` + `pnpm lint` in
      `.github/workflows/ci.yml` — three jobs (`format`, `lint`, `typecheck`),
      all three on PR and on push to `main`
- [x] `pnpm add @upstash/redis @vercel/blob ai server-only` (Task 0.8)
- [x] **Both devs, one keyboard —** `lib/plan/schema.ts`: `ExtractedBundle`
      renamed to `portico-extract/1`, `triggerFr` / `actionFr` on `RedFlag`
      (D7), and the referential check — `documentId`, `contactId` and
      `relatedMedicationIds` all resolve or the parse fails
- [x] **Both devs, one keyboard —** `lib/store/log.ts` (Task 0.7): `LogEntry` +
      `appendLogEntry()` + `readLog()`, plus `clearLog()`, which scans the
      keyspace rather than a window counted back from a movable "today"
- [x] `lib/store/redis.ts` — lazy Redis client factory
- [x] `lib/store/clock.ts` — `getDemoToday()`/`setDemoToday()`. Gated on demo
      mode: live mode always returns the real day
- [x] `lib/env.ts` — `llmEnv()`, `blobEnv()`, `redisEnv()`, plus `toolEnv()`
      for B4's shared secret
- [x] `app/layout.tsx` — `<html lang>` is dynamic. Fonts load `latin` **and**
      `latin-ext`, which B2's `cy/pl/ro/tr` showcase panels need
- [x] `README.md` + `voice-session.tsx` comment — both now say a disallowed
      override **closes the socket `1008` and surfaces via `onError`**, not a
      synchronous throw. Neither swallows it (Locked D9)

**Checkpoint 0:** `pnpm typecheck && pnpm lint && pnpm format:check` all
green; both devs can import `ExtractedBundle`, `redis()` and
`appendLogEntry()`; `POST /api/seed` works; both can state `LogEntry`'s shape
from memory. **Fail = nobody branches.** — **PASSED.**

---

## Track A — Ingestion, Timeline, Drug Data

### Phase 1

- [x] A1 — `lib/plan/samples/demo-plan.ts` seed fixture + `POST /api/seed`.
      Demo letter is Whitfield (02) [L6]. The route also uploads the source
      PDFs to Blob (so the source trace resolves), primes two missed apixaban
      days, and **403s outside demo mode** — it overwrites the same key a real
      upload writes to
- [x] A2 — `lib/store/plan.ts`, `lib/store/patient.ts` (parse on every read;
      throw on corrupt data — no soft defaults)
- [x] A3 — `lib/timeline/schedule.ts` — `buildTimeline`, `dueToday` (pure),
      plus `standingItems` for everything real that has no day
- [x] A4 — `/plan` rebuilt: timeline + day-section + task-row, with a
      `loading.tsx` and a real empty state

**Checkpoint 1 (joint):** `/plan` renders a real Redis-backed timeline. —
**PASSED.**

### Phase 2

- [x] A5 — Blob client upload: `/api/blob/upload` token route +
      `upload-panel.tsx`. **One control for both paths**:
      `accept="image/*,application/pdf"` + `capture="environment"` +
      `multiple`, uploaded in parallel with honest progress. Access is
      `Private`. `onUploadCompleted` still cannot reach localhost
- [ ] A6 — **OUT OF SCOPE for the 2026-07-26 build night; do not expand into
      it. But know that live extraction is currently DEAD on this machine.**
      Verified against a live-mode server: `POST /api/extract` → **HTTP 500**,
      `ZodError: ANTHROPIC_API_KEY … received undefined` at `lib/env.ts:47`.
      Commit `fe657f6` moved the provider to `anthropic("claude-haiku-4-5")` and
      updated `.env.example`, but **no local env file carries that key**, so it
      has been dead locally since that commit. It fails loudly at the config
      boundary and never serves baked data, so **D9 rule 1 holds** — but **D9
      rule 3 is breached**: nobody has demonstrated a successful live extraction
      anywhere, and that rule is what the whole demo-mode argument rests on.
      (Production _does_ now carry `ANTHROPIC_API_KEY` and `AI_GATEWAY_API_KEY`
      — but it runs in demo mode, so the model is never called there either. The
      key existing is not the same as the path working.) **Do not claim live
      extraction works.** The bare 500 also means the
      patient sees the generic error, not A6's named 422. **Target [L9]:** AI
      Gateway → **OpenAI** + `generateText` + `Output.object`; both 422
      surfaces are already written. Private blob → file bytes, never a URL.
      Rewire the provider, point `llmEnv()` back at `AI_GATEWAY_API_KEY`, and
      put a working key in `.env.local`
- [ ] A6.5 — **The checking mechanism (source of truth). OUT OF SCOPE
      tonight.** Harness exists (`scripts/eval-extraction.ts` + `make eval`)
      but is **not** the accepted green gate, and cannot be until A6 is
      rewired. Run A6 over **all five** PDFs vs medic gold JSON. Five families:
      patient identity (100%), med names (100% recall), appointments (100%
      recall), red-flag quotes (100%), source refs (100%).
      Whitespace/punctuation-insensitive compare; exempt composed
      address/practice fields. **This is what licenses demo's baked JSON.**
- [x] A6.6 — **`NEXT_PUBLIC_PORTICO_MODE=live|demo`.** Parsed as a `z.enum`
      with no silent fallback; the demo short-circuit is checked **before** the
      model call, never in a `catch`. The badge now renders on all six
      patient-facing surfaces — home, `/plan`, `/plan` loading, `/upload`,
      `/family` and the check-in idle view. `/api/seed` and every `/api/demo/*`
      route 403 outside demo. Only 4 things differ: extraction (baked, no LLM),
      drug context (`nhs-drug-map.json`), clock, seed. **Voice/Redis/tools/
      `assess()`/Blob/UI stay REAL.** Live failure fails loudly, never demo
      [D9] — verified by reading every `catch` in `app/`, `lib/` and
      `components/`: none of them catches its way into `DEMO_PLAN`.
      **Two caveats that have not moved.** A6.5 is still not green, so demo's
      baked bundle is used but not yet _licensed_ by an eval. And in demo mode
      uploading **any** letter yields Harold Whitfield's plan — proved by
      uploading Emma Clarke's. The code discloses that three ways (badge on
      screen, `modelId: "seed/02-whitfield"` in the stored bundle, `mode` in the
      extract response); a presenter narrating "it's read my letter" would not
- [x] A7 — `lib/drugs/lookup.ts` + `/api/drug-info` (NHS.uk fetch, 24h Redis
      cache; 404 guard against drugs not in the patient's own plan, kept
      distinct from "no plan stored"). **Four-state union
      `found | no-urgent-guidance | absent | unavailable`**, never a bare
      `null`, plus a `device` kind for a plan entry with no drug behind it.
      The committed map is the alias layer. Oracle:
      `fixtures/nhs-drug-map.json`. **Exercised over HTTP against the running
      app, not just read:** apixaban → `found`, 2 urgent blocks, `origin: seed`;
      ramipril → `no-urgent-guidance`; tiotropium → `found` via the alias
      `tiotropium-inhalers` (the alias layer doing its job); a drug not on the
      plan → 404, kept distinct from "no plan stored"
- [x] A8 — `fixtures/nhs-drug-map.json` committed, covering all five letters.
      The resolution order is explicit (seed → cache → network) and a seed hit
      is labelled as one in `Provenance.origin`

**Checkpoint 2 (joint):** real letter → extraction → timeline → drug context,
live — **and `make eval` passes on all five letters.** — **NOT PASSED, and
worse than "by decision".** Timeline and drug context are real and were
re-verified over HTTP. Extraction is not: on a live-mode server it returns a
bare 500 before it reaches a model at all, so `make eval` cannot be run, let
alone be green. A green eval is what would license `PORTICO_MODE=demo`; without
it the baked bundle is a mock in a costume, and that is how it should be
described if asked.

### Phase 3

- [x] A9 — `red-flag-card.tsx` + source-trace ("tap to see where it says
      that"), with the OGL v3.0 attribution line and retrieval date per licence
      bucket; dual EN+FR on red flags (Locked D7), `lang="en"` +
      `translate="no"` on the verbatim block. The source image is served by the
      streaming route `app/api/blob/source/[...path]` — Blob is Private.
      **Exercised over HTTP against the running app:** `/plan` renders the
      verbatim trigger inside `<blockquote lang="en" translate="no">` with a
      "…where it says that, page 1" link, and that link returns a real 194KB
      `application/pdf` under `cache-control: private, no-store`. The scope
      guard holds — a pathname not in this patient's plan, or an unknown
      patient, both 404. **Known cosmetic flaw:** the NHS text carries scrape
      artifacts (a missing sentence break, a floating space before a full stop),
      visible only if that disclosure is opened on camera
- [x] A10 — `task-check.tsx` client leaf → **Server Action** (`logStep` in
      `app/(phone)/plan/actions.ts`), not B4's `/api/log`. Both write paths
      converge on Task 0.7's `appendLogEntry()`, and the tick is optimistic
      with an explicit "Not saved. Tap again." on failure
- [x] A11 — Accessibility pass: base-layer `:focus-visible` floor so no
      interactive element can ship without a ring, ≥44px targets, error and
      empty states on `/plan`, `/upload`, `/family` and `error.tsx`, contrast
      reasoning recorded at each fix

**Checkpoint 3:** upload a real letter live, tap a red flag, see the source
photo. — **Red flag + source photo pass. "Upload a real letter live" does
not**, because A6 is out of scope; the seeded letter's source pages are real
Blob objects and do resolve.

---

## Track B — Voice, Escalation, Family Dashboard, i18n

### Phase 1

- [x] B1 — `lib/i18n/` dictionary module is **built** (`locales.ts` with
      `REAL_LOCALES = ["en","fr"]`, `dictionary.ts`, `en.ts`,
      `fr.ts satisfies Dictionary`, and a separate showcase union so
      `getDictionary` cannot be handed a locale it has no words for).
      **Closed.** `/plan` and `/upload` now call `getDictionary`, and every
      `components/plan/*` and `components/upload/*` leaf takes its strings as a
      prop; the hardcoded `locale="en"` and the "English until B1's
      `getLocale()` lands" comment are both gone. Verified over the wire: a
      French session renders "Votre plan de rétablissement", "Ajouter votre
      lettre de sortie", "Aujourd'hui", "Ce que le NHS dit de vos médicaments"
      and a French demo badge. **One honest gap remains, and it is a data gap,
      not a fallthrough:** the letter's own clinical text — dose directions,
      `purposePlain`, red-flag wording — has no authored French on the bundle,
      so it renders in English. It is correctly declared as such, inside
      `lang="en"` (plus `translate="no"` on anything verbatim), which is what
      WCAG 3.1.2 asks for. Closing it needs schema fields and an extraction
      pass, not an i18n change
- [x] B2 — `app/actions/set-locale.ts` (throws on a locale with no dictionary
      rather than defaulting) + `language-picker.tsx`: endonyms only, no flags,
      active locale filtered out, no "Default" badge, ≥44px rows, top-right on
      every screen. `app/(phone)/language/page.tsx` is the wholly-in-language
      "not yet" panel, with `notFound()` on anything that is not a showcase
      locale
- [x] B3 — `buildCheckInPrompt({bundle, today, logs, locale})` +
      `buildFirstMessage` are **built and correct on their own terms**: authored
      persona in en/fr (no machine translate), plan-aware `firstMessage`, the
      prompt _frame_ authored per language, and the generic "Is this normal
      after surgery?" question gone. Read off the wire, the French prompt
      composes with real ids, real doses and an authored French persona.
      **The D9 leak this was unticked for is fixed.** `lib/check-in-prompt.ts`
      now tags each red flag with the language it is handing over: `(fr)` with
      the authored `triggerFr`/`actionFr` when the locale is French and both
      exist, `(en)` with the letter's verbatim otherwise — explicit, never a
      silent fallthrough, and `checkInPrompt.redFlagRule` explains the tag to
      the model in both dictionaries. Re-verified over the wire rather than
      taken on trust: an English session emits
      `(en) breathless, feverish or confused again → …`, a French session emits
      `(fr) essoufflé, fiévreux, ou de nouveau confus → …`
- [ ] B3.6 — **DO NOT BUILD.** The ear-test PASSED [L1]; French works on the
      single agent. This stays on the page only as the pre-authorised remedy if
      French ever regresses later. Two
      agents, one per locale, each pinning its model in its own base config
      (`Portico EN`/`eleven_flash_v2`, `Portico FR`/`eleven_flash_v2_5`).
      Needs `NEXT_PUBLIC_AGENT_ID_FR`, a `locale` param on
      `/api/eleven/signed-url`, `fetchSignedUrl(locale)`. The signed-URL
      endpoint takes only `agent_id`, so locale **must** be an id switch.
      Mirror both agents' overrides + `client_events` + tools or they drift
- [ ] B3.5 — `voice-session.tsx` takes a `locale` prop and passes it as
      `overrides.agent.language`; the hardcoded `"en"` is gone. **The English
      half is now proven live:** three real agent sessions ran with
      `agent.language` and `tts.voice_id` sent exactly as this component sends
      them, and the platform accepted all four overrides — so the override frame
      is not merely allowed on paper. `platform_settings` independently confirms
      `tts.model_id` is **not** client-overridable, so the pin cannot drift from
      the browser. **Unticked because the French half is untouched:** every
      proving session was `language: "en"`. Bad French audio → **stop**, do not
      downgrade to English voice (Locked D9)

**Checkpoint 1 (joint):** check-in session starts, reads the seeded plan,
speaks English, then French on the per-locale-pinned agent. — **English half
PASSED live; French half still unheard.** Three real agent sessions ran against
the deployed app carrying the production system prompt, held a coherent
conversation about Harold's actual plan, and called tools. The prompt carries
real ids, real doses and the real red flag in both languages. **The C2 ear-test
PASSED [L1] on the earlier build — French is confirmed on the single agent** —
but nothing French has been heard since, so B11 is the outstanding half. A
later regression means B3.6, never a downgrade.

### Phase 2

- [x] B4 — Server tools: `/api/log` and `/api/escalate` **exist and are
      correct** — header auth on `x-portico-tool-secret` (**not** `secret__`),
      `patient_id`/`check_in_id` bound as inputs, `day` taken from the demo
      clock rather than the model, `item_id` checked against the stored plan.
      Twelve auth/validation paths behave, and a non-JSON body now returns
      `400 {"error":"invalid_arguments"}` rather than a bare 500 — both routes
      gained `.catch(() => null)`, verified. **A real ElevenLabs agent has now
      invoked the deployed routes**, which is what this task was actually
      about. Portico is at `https://juno-hack.vercel.app`; the tools point at
      the stable alias, so redeploys do not invalidate them. Proven three
      independent ways: ElevenLabs' own execution ledger
      (`toolexec_2201kydx4v6bfn184c3zj57y55vr`,
      `toolexec_4701kydx6penfp0vaecqkmbyr0yx`, both `is_error: false`, 0.6–1.4s
      against an 8s budget), Vercel runtime logs (two `POST /api/log 200` on
      `dpl_38RU6N21Wp5Js3jZmk9skxP1QLwV`), and the deployed app's own state
      flipping to "recorded as taken". The ledger also proves the design:
      `patient_id` arrived as the browser's dynamic variable, `check_in_id` as
      the platform's own `conv_…` id, `day` absent and supplied server-side, and
      the shared secret stored `<REDACTED>` in ElevenLabs' own records — which a
      `secret__` variable would not have been. **The missing step was
      `tool_ids`:** the agent read back `prompt.tool_ids = []`, so the tools
      were unattached, not merely unexercised. All three are now attached, the
      PATCH deep-merged (118 config leaf keys before and after, 2 changed), both
      TTS pins and all 12 `client_events` survived, and the runbook is corrected
      in `12-…md §X4`. These routes serve ElevenLabs only — A10 uses an action
- [x] B5 — `lib/escalation/rules.ts` — pure `assess()` discriminated union
      (`none | nudge | alert-kin`), with `assessmentWindow()` so every caller
      reads exactly the days the rule uses
- [x] B6 — `show_red_flag` client tool is registered, narrows the model's
      argument, returns a plain string for an unknown id and never throws
      internally; no `onUnhandledClientToolCall`. **Fired by a real agent**: told
      "I've gone very breathless again since last night, and I feel feverish",
      the agent emitted `client_tool_call` with
      `flag_id: "flag-worsening-chest-infection"` — **the real id from the
      letter, not invented** — and then spoke the letter's action. It was
      created as a third tool and attached alongside the two webhooks; before
      that it was unattached, so `12-…md §R2`'s "wired but never exercised" was
      understating it
- [x] B7 — `onAgentToolRequest`/`onAgentToolResponse` drive the live "noting
      that down" tick. **Received from a real agent in all three proving
      sessions**, and `agent_tool_request` carried `tool_name` with **no**
      `parameters`, exactly as `12-…md §G7` predicted — which is all the tick
      reads. `client_events` were preserved through the tool attach: 12 values,
      order included, still carrying `agent_tool_request`,
      `agent_tool_response`, `client_tool_call` and `agent_chat_response_part`
- [x] B8 — `/family` dashboard (`force-dynamic`, `Promise.all` reads,
      `flex min-h-0 flex-1 flex-col` — no `dvh`/`vh`). Dates render in words in
      both locales
- [x] B9 — `refresh-poller.tsx` (5s `router.refresh()` on a `force-dynamic`
      page, so each tick is a real read)
- [x] B10 — Incoming check-in card, driven by real Redis state the operator
      raises (with a TTL) and a 5s poll — never a timer painting a card.
      Answering clears the flag. Tier A only: **no** Web Push, no manifest, no
      service worker
- [x] B10.5 — **`/operator` demo control panel.** Reset/seed, move the demo
      clock, mark a step taken or missed, ring and cancel the check-in — every
      button writing real state through the product's own functions, with the
      panel re-reading that state. Outside the `(phone)` group, `noindex`,
      never linked from the product. **The mode toggle is deliberately absent
      and the page says why:** `NEXT_PUBLIC_PORTICO_MODE` is compiled into the
      client bundle, so a switch there would change a label and nothing else

**Checkpoint 2 (joint):** voice call logs adherence, UI ticks live, a second
miss escalates visibly on `/family` from another device. — **PASSED, all
three.** A real agent session logged adherence through the deployed `/api/log`
and the deployed `/plan` re-rendered as "recorded as taken"; the live tick fires
off a genuine `agent_tool_request`; and the escalation is real and computed
(`none → nudge → alert-kin`, driven end to end through the tool route, with
`assess()` proven unfakeable four ways). The one caveat worth saying aloud: the
agent's user turns were sent as text frames rather than through a microphone —
the agent, the LLM, the tool dispatch and the webhook were all genuine.

### Phase 3

- [ ] B11 — **Pre-demo French re-check** (the _gate_ was Checkpoint 1). **Both
      pins are now structurally verified twice over** — base `eleven_flash_v2`
      and `fr` preset `eleven_flash_v2_5`, asserted before and after the tool
      attach, with `language_presets.fr` byte-identical throughout. **What is
      still missing is the only part that counts: a human ear.** All three
      proving sessions were `language: "en"`; no French audio has been heard by
      anyone, and C2 is explicit that HTTP 200 proves nothing here — Phase 1
      reproduced Welsh returning 200 with 74KB of healthy-looking audio on a
      model with no Welsh support. Run one real `fr` session; ear-test TTS and
      ASR separately. Fail = escalate to a human, **no** French-UI +
      English-voice downgrade. **This is the last human-only item on the list**
- [ ] B12 — High-stakes ASR safety. **Barely started:** the typed `Composer` is
      the explicit path the user can choose, and it is locale-aware. Still
      missing all three of the real protections — bilingual `asr.keywords` on
      the agent, tappable French answer chips for taken/missed (the suggestion
      rows are opening _questions_, not answers), and confirm-before-logging
- [x] B13 — `prefers-reduced-motion` block written as a wildcard sweep so a
      later component cannot reintroduce motion by forgetting the file;
      `focus-visible` standardised in the base layer
- [ ] B14 — `make seed` exists, and so do `make arc`, `ring`, `unring`,
      `clock`, `miss` and `operator`; `scripts/demo-arc.sh` asserts every beat
      over HTTP and leaves the app seeded and primed with two missed
      **apixaban** doses. The operator runbook is the "How to run the demo arc
      locally" section of `12-track-1-demo-flow.md`, plus §X4. **`make arc` is
      now 21 passed, 0 failed**, run just now — two new beats cover the empty
      opening shot, and the one hollow assertion is fixed (`clock moves a day`
      now asserts the date it should land on, not merely that a date came back).
      **`make clear-letter`** (`DELETE /api/demo/plan`) deletes the stored plan
      while keeping the log, the patient and the clock, so the arc can be filmed
      from an empty home and the escalation still computes from the surviving
      history. **Unticked for the half that decides the demo: nobody has
      rehearsed it with a stopwatch against the 60s limit**

**Checkpoint 3:** full demo arc runs twice back-to-back in **`demo`** mode, no
manual Redis surgery between runs. **Checkpoint 2 must already have passed in
`live` mode with `make eval` green** — passing 3 without 2 means the app does
not actually work, and demo polish does not fix that. — **The
back-to-back-without-surgery half holds** (re-seeding is a total reset; it
scans the keyspace rather than clearing a window counted back from a movable
today), and `make clear-letter` now gives the empty opening shot without a Redis
console. **The precondition still does not:** `make eval` has never been green,
because live extraction has never run. The voice tools, which were the other
half of this warning, **have now fired for real**. Say the extraction part
aloud if asked.

---

## Cross-cutting — do not forget

- [x] Never construct `Redis()` or a Blob client at module scope — `redis()` is
      lazy, and every Blob call is inside a route handler with an explicitly
      asserted token
- [x] Every new secret goes in its own `xxxEnv()`, never the browser-safe `env`
      object — five schemas (`serverEnv`, `llmEnv`, `blobEnv`, `toolEnv`,
      `redisEnv`), all throwing on absence, never soft-defaulting
- [x] `getUserMedia → fetchSignedUrl → startSession` stays inside the direct
      tap — `begin()` calls `connect()` synchronously; the check-in dismissal
      is fired after it and not awaited
- [x] Escalation threshold lives in `lib/escalation/rules.ts`, never in the
      agent prompt or the tool itself — the prompt explicitly tells the model
      it does not decide what a run of misses means
- [ ] `lib/plan/schema.ts` changes are announced to both tracks before
      merging — it's the one file that can force a Redis reseed. **A standing
      commitment, not a task; it has no done state**
- [x] `PORTICO_MODE` is set by a human, never by a `catch`. It never quietly
      serves the baked bundle, and the mode is rendered on screen whenever it is
      `demo`. **One correction to the old wording:** a live extraction failure
      is supposed to 422, and the two 422 surfaces are written — but today it
      dies earlier, at the missing-key boundary, as a bare 500 (see A6). It
      still fails loudly and still never falls into demo
- [ ] **No silent fallbacks** [Locked D9]. **Rules 1 and 2 hold, and were
      attacked:** every `catch` in `app/`, `lib/` and `components/` was read and
      none of them catches its way into `DEMO_PLAN`; all 7 demo/seed routes 403
      in live mode; the mode is on screen, in the stored bundle and in the
      extract response. **Two of the three breaches are now closed:** `/plan`
      and `/upload` are localised (B1), and the French prompt tags each red flag
      with the language it is handing over (B3). **One remains — rule 3:** live
      extraction has never been demonstrated to work anywhere, so the biggest
      demo shortcut still has no proven live counterpart (see A6). Close that
      and this ticks

## End-to-end flow (cheat sheet)

This is the **intended** flow. Where the code differs today it is marked.

```
locale (en|fr) → upload → Blob → extract → Redis
  → drug lookup (NHS.uk, four-state union, never a bare null)
  → /plan (buildTimeline)
  → check-in tap → signed URL → voice on the per-locale pin (overrides)
  → log / escalate (server tools) → /family (poll)

# extract, TARGET [L9]: AI Gateway → OpenAI → Output.object
# extract, CODE TODAY: anthropic("claude-haiku-4-5") direct — 500s locally, no key
# server tools:        LIVE, on https://juno-hack.vercel.app — not localhost
# demo mode:           extract + NHS.uk are baked; everything else stays real
```

## Open decisions — none block coding

All human gates from the planning phase are closed. See the locked-decisions
callout at the top of this file, and `tasks/plan.md §DECISIONS LOCKED` (L1–L8)
for the full table.

### Before filming — only a human can do 1 and 2

Detail and evidence: `17-deploy-and-tool-wiring.md` (deploy, tools, rollback)
and `14-track-3-adversarial-verify.md` (everything else).

1. **Redeploy.** Production is a snapshot of the working tree at 01:20, and
   almost everything since — the French prompt fix, the localised `/plan` and
   `/upload`, the malformed-body fix, `make clear-letter` — is not on it. The
   ElevenLabs tools call the deployed alias, so until you redeploy the agent is
   talking to older code than the one you rehearsed against:
   `pnpm typecheck && pnpm lint && vercel deploy --prod --yes --scope haider-projects`.
   The `--scope` is not optional; without it you get `Not authorized`.
2. **Run one real French voice call** (B11). This is the only genuinely
   human-only item left. Both TTS pins are structurally verified and every
   proving session so far was English. Ear-test TTS and ASR separately. A
   disallowed override does not degrade gracefully: the socket closes 1008 and a
   red banner lands where Portico should be talking, on the hero beat.
3. **Pick one host and stay on it.** Local and production share one Redis and
   one Blob store, so a laptop `make seed` moves the deployed site's state and
   vice versa. Two people rehearsing on different hosts will fight.
4. **Open on the empty home.** `make clear-letter` deletes the plan and keeps
   the log, the patient and the clock, so home shows "Take a photo of your
   letter", the letter goes in on camera, and `/family` still escalates off the
   surviving history. Seeded home leads with the check-in and buries the letter
   third, which does not tell the audience what the product is built from.
5. **Move `OPENAI_API_KEY` out of `.env`** — a live secret in the file whose own
   header forbids secrets, read by nothing. Add `ANTHROPIC_API_KEY` to
   `.env.local` if live extraction should exist at all; otherwise accept it is
   unproven and never claim it on camera.
6. **Run `make arc` immediately before the take** (21/21, ~5s, leaves the app
   seeded), then `make operator` on the laptop and `/check-in` on the phone.
   Reset between takes with the operator's Reset button, never by hand.
7. **Ring the check-in a beat early** — budget 5 seconds, not 3. The measured
   3.1–4.6s figures are single samples from a uniform 0–5s poll window.
8. **Do not upload a letter that is not Harold Whitfield's** unless you are
   explicitly narrating that demo mode serves a recorded bundle. In demo mode
   any letter yields Whitfield's plan; the code discloses this three ways, a
   presenter saying "and it's read my letter" would not.
9. **Take `/operator` down afterwards.** It, `/api/seed` and every `/api/demo/*`
   route are live and unauthenticated on the public internet — production is in
   demo mode, so the guard permits them. Anyone with the URL can reset the plan
   or ring the phone mid-take. Obscurity, not security; fine for one night.
10. **If you film in the morning, home still says "Good afternoon."** It is a
    hardcoded string, not a time-derived greeting.
11. **One stale sentence left in the audit set:** `13-…md` residual risk #1 tells
    an operator to flush a Redis key by hand that the seed already clears.

**Optional, whenever convenient — neither blocks anyone:**

1. Photograph one printed letter. All six corpus PDFs are born-digital with a
   perfect text layer, so **the camera path is currently untested** and A6's
   real-world behaviour is unmeasured. Ten minutes closes it.
2. Ask the medic whether a real letter would carry a callable ward or clinic
   number. No letter in the corpus names one, so `contacts[]` in the seed is
   partly composed rather than transcribed.

**Deferred by decision [L7/L8]:** Tier 3 Resend email escalation, and `vitest`
for the two pure modules. Build neither unless there is spare time at the end.

**Closed since this list was written:** Blob access — the store is **Private**,
decided by infrastructure, not pending a call.

Settled: second language is **French**, on an explicitly pinned model per
locale — `en` → `eleven_flash_v2`, `fr` → `eleven_flash_v2_5` (not Welsh, and
not unpinned Multilingual drift). See correction 1 at the top of this file.
