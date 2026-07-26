# 24 — Overnight consolidated report (2026-07-26)

Orchestrator's roll-up of the six-track overnight pass. Files `18`–`23` are the
tracks' own reports; this file states what was asked for, what actually landed,
which prior claims turned out to be false, and what only a human can now close.

**Nothing was committed and nothing was pushed.** `HEAD` is still `2185ca6`
("Merge pull request #7 from haider-toha/docs/demo-qa-guide"). Every change is
in the working tree for review.

---

## 1. What was asked for, and whether it happened

| Objective                                                                         | Verdict                                                                                                        |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Replace the dead Anthropic-direct extraction with OpenAI, verified by `make eval` | **Done.** `make eval` green on all 5 letters, every scored family 100%. First green run in this repo's history |
| Make demo mode airtight — UI/UX, voice agent, functionality                       | **Done**, with four honest residuals listed in §5                                                              |
| `pnpm typecheck && pnpm lint && pnpm format:check` all green                      | **Green.** `format:check` was red on 25 files at HEAD _before_ this pass; that is fixed too                    |
| `make arc` green                                                                  | **21/21.** It was **18/21** when the night started, contrary to what `todo.md` claimed                         |
| Every finding written to disk under `audit/`                                      | **Done** — files `18`–`24`                                                                                     |
| Nothing committed, nothing pushed                                                 | **Held.** `HEAD` unmoved                                                                                       |

---

## 2. Execution shape — and why it differed from the brief

The brief asked for four parallel Phase-1 tracks, each with its own dev server on
its own port (`next dev -p 300X`). **That mitigation does not work**, and it was
worth finding out before dispatching rather than after.

Next.js 16 refuses a second `next dev` **per directory**, on any port:

```
⨯ Another next dev server is already running.
- Local:        http://localhost:3000
- PID:          87794
- Dir:          /Users/haidertoha/Code/juno-hack
```

Verified empirically by starting `-p 3001` and `-p 3002` from the repo root:
both printed a ready line, then both refused and pointed at the existing PID.
Nothing ever listened on either port. **Ports are not the isolation boundary;
directories are.**

That mattered because Track 1 needs `NEXT_PUBLIC_PORTICO_MODE=live` while every
other track needs `demo` — two values of a build-time public var that cannot
coexist in one server process.

**Resulting shape:**

| Track                 | Directory                                      | Dev server            | Redis key space           |
| --------------------- | ---------------------------------------------- | --------------------- | ------------------------- |
| 1 — OpenAI extraction | `../juno-hack-t1` (worktree, created for this) | own `:3001`, **live** | `portico:plan:eval-*`     |
| 2 — Demo UI/UX        | primary checkout                               | `:3000`, **demo**     | owned `demo` (phase 1a)   |
| 3 — ElevenLabs        | primary checkout (files only)                  | none                  | none — barred from `demo` |
| 4 — Functional/edge   | primary checkout                               | `:3000`, **demo**     | owned `demo` (phase 1b)   |
| 5a / 5b               | primary checkout (+ `:3001` worktree for 5a)   | both                  | read-mostly               |

**Track 4 was serialized after Track 2 rather than run alongside it.** Both drive
the shared `demo` Redis key space — `lib/store/keys.ts` hardcodes
`DEMO_PATIENT_ID = "demo"`, and Redis and Blob are single instances shared by
localhost and production. Run concurrently, Track 4 would have reported Track 2's
re-seeds as real failures and Track 2 would have screenshotted states Track 4
mutated. The brief anticipated this ("serialize those specific steps across
tracks if you can't avoid the shared key"); that option was taken deliberately
rather than hoping the race would not fire.

**Shared-file hazards, and how they were contained:**

- `lib/i18n/en.ts` / `fr.ts` — split by key region: Track 2 owned UI copy, Track 3
  owned the `persona` and `checkInPrompt` objects. Both were told Edit-only
  (never Write) and to re-Read immediately before each edit. **It held**: the
  final diff shows Track 2's hunks at lines 21–250 and Track 3's at 272+, with no
  clobbering.
- `package.json` / `pnpm-lock.yaml` / `pnpm install` — Track 1 only, and only in
  its worktree. Every other track was told to write a dependency request into its
  findings file instead of installing.
- No track was permitted to run `prettier --write .` repo-wide while others were
  mid-edit. The orchestrator ran it once, after all four had landed.

---

## 3. Per-track verdicts

### Track 1 — live extraction, Anthropic → OpenAI (`18-…md`)

**Landed.** Live extraction works; `make eval` is green for the first time.

- **Model `gpt-5.6-luna`**, chosen by measuring three tiers on the same prompt
  rather than assuming a name: `gpt-5.4-nano` swung 71–100% on source quotes
  run-to-run; `gpt-5.4-mini` reached 100% on five of six families every run but
  dropped one quote in roughly half of runs, which fails a family scored at
  threshold 1.00. Luna was green four consecutive runs.
- **Native strict mode** — `generateText` + `Output.object`, `strict: true`. The
  prompted-JSON-contract workaround is deleted.
- **`lib/plan/schema.ts` was not touched**, which is the good outcome. A live
  probe found OpenAI rejects the schema for exactly one reason: Zod compiles
  `z.discriminatedUnion` to `oneOf`, which strict mode forbids while permitting
  `anyOf` — five sites, all `DateAnchor`. A nine-line rewrite on the _generated_
  JSON Schema fixes it. Everything else already fit (193 properties vs 5,000;
  depth 4 vs 5; 98 enums vs 1,000), and because the schema uses `.nullable()`
  never `.optional()`, all 38 objects already emitted fully `required` with
  `additionalProperties: false`.
- **Independently re-verified in `22-…md`**: schema identical to HEAD, `DEMO_PLAN`
  still validates (with a negative control), all measurements reproduce to the
  byte, and the `oneOf → anyOf` rewrite proved lossless.

### Track 2 — demo UI/UX flow (`19-…md`)

**Landed.** One genuine tap-count collapse, and it did not inflate the others to
manufacture a saving — which is the right call.

- **B12's UI half**: `suggested-questions.tsx` → `chip-row.tsx`, a pill strip
  that changes job mid-call — opening questions until the first user turn, then
  tappable "I have taken it" / "I have not taken it yet" in both languages. 3+
  interactions → 1 tap, and it is the only answer path on that screen that does
  not go through ASR.
- **`/letter` went from useless to working** — fit-to-column rendered the quoted
  line at under 5px; it now draws at 900px in a pan box, opening centred on the
  highlight at a measured 22px.
- **Red-flag card 273px → 153px**, tint reduced to the clinician's own words plus
  a number worth ringing.
- **Copy deleted, none added**: `plan.anyTimeBlurb` and two dead keys removed,
  four strings halved, one heading demoted to an `aria-label`.
- **Correctly declined** to collapse the check-in to one tap: that would move
  `getUserMedia` out of the direct user tap, which `CLAUDE.md` forbids because
  Safari refuses the mic outside the gesture.

### Track 3 — ElevenLabs voice agent (`20-…md`)

**Landed.** 34 scenarios × 3 repeats: **25/31 baseline → 99/102 final**, 32 of 34
green on all three repeats.

Three probe findings that made the battery trustworthy, each confirmed against
the live `openapi.json` because the skill's own docs were wrong or silent:

- **`tool` tests never execute the webhook** (`"Skipping tool call in test
mode"`). This is why the battery was provably side-effect-free against the
  shared demo Redis that Tracks 2 and 4 depended on.
- Parameter assertion paths are **prefixed by tool type** — webhook needs
  `body.item_id`, client takes bare `flag_id`.
- The dashboard prompt is a **placeholder**, so every run had to pass the real
  6.5k session-override prompt regenerated from the repo.

**Six real defects fixed**, two of them serious: a **missed high-stakes dose
being logged as `taken`** (which silently defeats `assess()`, since it counts
only `missed`), and **dose advice being given** in both languages. Also a
promised nurse/GP callback no tool delivers, a French turn claiming two medicines
logged after one `log_step` call, `end_check_in` not firing after a French
farewell, and a third party getting doses logged on the patient's behalf.

**Three remote mutations, each read back leaf-by-leaf, each with a rollback
step:** ASR keywords `["Portico"]` → 29 bilingual terms; bilingual
`end_check_in` description; `prompt_injection` guardrail on. It deliberately left
`medical_and_legal_information` **off** — `content.trigger_action` is `end_call`,
so a medical filter would hang up on the red-flag beat.

### Track 4 — functional correctness & edge cases (`21-…md`)

**Landed, and it found the night's most consequential correction.**

- **`make arc` was 18 passed, 3 failed**, not 21/21. `family_says()` keyed on a
  Tailwind class list, and the alert branch never carried
  `font-display`/`tracking-tight` at all — so those three assertions could only
  ever have matched the calm branch, even before `c6986ef` added the `id`
  attribute. Re-keyed on `id="family-assessment"`, the hook the card's own
  `aria-labelledby` already depends on.
- **Separated two numbers `todo.md` conflated**: the arc's wall clock (median
  4.29s over 5 runs) and the _ring latency_ that "budget 5 seconds" refers to
  (median 1.92s, max 4.36s over 8 phase-randomised samples).
- **Fixed a bare 500 on malformed bodies** at `/api/demo/clock` and
  `/api/demo/log` — reachable in practice, since the operator panel's date input
  posts `{"day":""}` when cleared.
- **Two new test targets**: `make state` (15 steps, 24s) and `make ui-edges`
  (4 steps, 15s, with a pasted negative control).

### Track 5a — adversarial regression (`22-…md`)

**Attacked the guarantees and could not break them** — which is the evidence they
are real, and is reported as such rather than as a formality.

- **Escalation: nine independent probes**, all held. Search params, cookies and
  the tool secret header do nothing (`FamilyPage()` takes no arguments).
  `/api/escalate` called twice in one day still yields a _nudge_. A
  `standard`-class drug missed twice in-window nudges and never alerts. The
  window is exactly 3 days in both directions. One day written by two different
  writers counts once. The threshold exists in `lib/escalation/rules.ts` only,
  verified three ways including that `buildCheckInPrompt` never imports it.
- **Track 4's arc fix is not looser** — proven by a 12-cell discrimination matrix
  (exactly 3 passes, all diagonal) _and_ a mutated harness run against a broken
  state.
- **The `PORTICO_MODE` guard is now proven, not inferred**: all **11** handlers
  403 against a real live-mode server, four more than anyone had tested.
- **D9 rule 1 re-derived from scratch** across all 18 catches after Track 1
  rewrote `extractBundle`.
- **Fixed nothing, and said so.** It found no defect it could prove broken inside
  its remit and declined to manufacture one. Two candidates were deliberately
  left alone and documented.

### Track 5b — security & config hygiene (`23-…md`)

**Clean, and proven rather than asserted.**

- **No secret exists outside `.env.local`** — three scans: working tree (631
  files including `audit/`, `.e2e/`, `scripts/`), **full git history (41 commits,
  0 hits)**, and a partial-prefix/suffix probe.
- **Client-bundle check done properly**: a real production build in an isolated
  copy carrying the real `.env.local`, so any inlining would have happened.
  **0 of 8 secret values** across 33 client chunks, server output and prerendered
  HTML. It also caught and corrected itself — initial `ANTHROPIC_API_KEY` hits
  were stale dev chunks.
- **ElevenLabs auth intact**: all three webhook tools send the shared secret as a
  `secret_id` _reference_; `secret__` appears nowhere;
  `dynamic_variable_placeholders` is empty.
- **`@ai-sdk/openai@4.0.20` is genuine** — `github.com/vercel/ai`, published via
  npm OIDC trusted publishing, integrity hash matching the registry byte-for-byte,
  sharing identical `@ai-sdk/provider` and `provider-utils` versions with
  `ai@7.0.37`. 0 advisories in `@ai-sdk/*`.
- **Fixed `.gitignore`**: a stray `.env*` appended under `# OS` by `vercel link`
  made the deliberate `# Env` block dead and silently ignored `.env.example` —
  the file `make setup` copies. Now `.env*` + `!.env.example`.

---

## 4. Prior claims this pass disproved

These matter more than the new work, because they were load-bearing and believed.

1. **`make arc` = 21/21** — stated in `todo.md` (twice) and `16-…md`'s evidence
   table. It was **18/21**. True when written at 02:24, false from 02:51.
2. **`pnpm format:check` passes** — stated in `todo.md`'s reconciliation callout.
   It was **red on 25 files** at HEAD, including files no track had touched
   (`brand/logo-candidates/*.json`, `public/pdf.worker.min.mjs`, `README.md`,
   `DEMO.md`). Now fixed.
3. **The demo-mode badge renders on 5/5 on-camera screens** — recorded as PASS in
   both `14-…md` and `16-…md`. **The component does not exist**;
   `components/demo-mode-badge.tsx` was deleted in `5cbaca9`, and all seven
   screens grep zero in both locales. This removes one of the three disclosures
   D9's honesty argument rests on, and `lib/env.ts:10` still carries a comment
   asserting the UI renders it.
4. **`14-…md`'s French red-flag finding was already false when written.** It
   rests on `grep "Fr" lib/check-in-prompt.ts` returning no matches; it returns
   four, and the file has been unmodified since `1df20a3` (01:57) — 27 minutes
   _before_ `14-…md` was written at 02:24.
5. **`make eval` is not reliably green even though the score is.** An independent
   re-run hit `03_Okafor_David_NSTEMI: fetch failed`; the server answered 200
   after 5.0 minutes and the harness, which sets no explicit timeout, hit
   undici's 300s default. Per-letter latency over 10 samples: median 28.1s, with
   41s, 49s and one >300s. Track 1's "15–35s per letter" understates the tail.
6. **Raw-hex hygiene has drifted** from 2 sanctioned sites to 5 (flag SVGs,
   favicon routes).

---

## 5. Residual risk and human-only gates

**Only a human can close these.**

1. **B11 — the French ear-test.** Not closed, and Track 3 does not claim it is.
   French tool selection is now 3/3 over text and the `fr` TTS pin is confirmed a
   third way, but **nobody has heard a French voice**. The 29 new ASR keywords
   are a hypothesis only a microphone can test. Run one real `fr` session and
   ear-test TTS and ASR separately.
2. **B14 — the stopwatched take.** The arc is timed (median 4.29s) and the ring
   latency is timed (median 1.92s), but nothing here times a _human_ against the
   60s limit. Still open.
3. **Rotate `OPENAI_API_KEY`.** Nothing in the repo leaked it — verified across
   the working tree, all 41 commits, and a production build. **The exposure is an
   agent transcript**, where the orchestrator printed the value while removing it
   from `.env`. One call site, unused in demo mode, so rotation is cheap: update
   `.env.local` **and** Vercel production.
4. **Decide the demo-mode badge** — restore it, or brief the presenter never to
   claim the app discloses demo mode. The surviving disclosures are the stored
   bundle's `modelId: "seed/…"` and the extract response's `mode` field, neither
   of which is visible on camera.
5. **Decide `next@16.2.9 → 16.2.11`** — clears 4 high + 5 moderate advisories,
   none introduced tonight. Three of the four highs do not apply here (no
   middleware, no custom server, no rewrites); the residual is a Server Actions
   DoS on a public URL. `CLAUDE.md` pins Next exactly, so this is a policy call.
6. **Redeploy before filming.** Production is still the 01:20 snapshot. Every
   change from tonight — OpenAI extraction, the chip row, the `/letter` fix, the
   arc fix, the malformed-body fix — is local only. The ElevenLabs tools call the
   deployed alias, so rehearsing on localhost exercises different code.

**Known and accepted, not blocking:**

- **No identity model** on `/api/extract` and `/api/blob/*` — guessing a
  `patientId` reads another patient's letter. Pre-existing and consistent with
  the stated threat model, but have the answer ready if a judge asks. Related:
  Track 3's `P-S03` shows an attacker asserting "I'm Harold" can still get doses
  logged, 1 run in 3. That is a product decision, not a prompt edit.
- **The French red-flag card is still below the fold.** Track 2's halving is
  English-only: the French tint is 365px and the first tappable row sits at
  812–971px depending on viewport. The deeper cause is a **schema** gap, not a
  data gap — there is no `purposePlainFr` field to fill, so no prompt work closes
  it. Scroll before the French take.
- **French `end_check_in` fires 1/3.** The demo survives it: `FAREWELL_RE` in
  `voice-session.tsx` already matches "au revoir", at ~0.9s cost.
- **Vercel Blob cold-handshakes** on the first request of a run (5 of 104
  extractions), surfacing as a bare 500. Warm the path before filming a live
  upload.

**What Phase 2 did not get to**, stated so nobody mistakes silence for a pass:
`make e2e` (it destroys four screenshot sets), **Track 3's 34×3 battery and its
three remote ElevenLabs mutations were not independently re-run** — 5b verified
their _auth_ surface but nobody re-executed the scenarios — any real voice call,
the camera path, and Track 2's before/after pixel deltas beyond a spot check.

---

## 6. Tree state at hand-off

```
HEAD              2185ca6   (unchanged — nothing committed, nothing pushed)
pnpm typecheck    exit 0
pnpm lint         exit 0
pnpm format:check All matched files use Prettier code style!
make arc          21 passed, 0 failed   (median 4.29s)
make eval         5/5 letters, every scored family 100%, exit 0
```

Working tree: 45 modified files, 1 deleted (`components/voice/suggested-questions.tsx`),
9 untracked (7 audit files, `components/voice/chip-row.tsx`, plus
`scripts/demo-state.ts` and `scripts/demo-ui-edges.ts`).

A dev server is left running on `:3000` in demo mode with the demo state seeded.
The `../juno-hack-t1` worktree has been removed; its five files were copied into
this checkout and `pnpm install` was run once to reconcile the lockfile.
</content>
