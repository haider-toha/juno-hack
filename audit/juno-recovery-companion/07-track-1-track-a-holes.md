# 07 — Track A stress test: holes in the plan

**Date:** 2026-07-25 · **Target:** `tasks/plan.md` Phase 0 (0.1–0.6) and Track A
(A1–A11) · **Method:** read the plan against the real repo, the locked decisions
(D1, D2, D6, D9, D10), the live provisioned infrastructure, and the **actual
published API surfaces** of `ai`, `@vercel/blob` and `@upstash/redis`.

**Audit only. No feature code was written.** The only file created is this one.
Every proposed change to `tasks/plan.md` / `tasks/todo.md` appears below as
quoted text for a later phase to apply.

**No secret values appear in this file.** Environment variables are referred to
by name. The Blob store id and hostname below are identifiers, not credentials —
a private store rejects unauthenticated reads.

---

## Scope

In scope: ingestion → extraction → timeline → drug lookup → the `/plan` UI, i.e.
Phase 0 Tasks 0.1–0.6 and Track A Tasks A1–A11, plus the Track A side of every
seam with Track B.

Out of scope: Track B internals (voice, escalation, i18n, family dashboard) except
where Track A depends on them (A10 ↔ B4, A1 ↔ B14, A9 ↔ D7). ElevenLabs agent
configuration is settled in `06-phase-1-readiness.md` and is not re-litigated here.

Five questions were asked of every task:

1. Is the API shape it assumes real, today, in the version that will install?
2. Does anything degrade quietly instead of failing loudly (D9)?
3. Is every cross-track contract actually specified, or only named?
4. Is the task the right size, in the right order, with its real dependencies?
5. Will the wording produce generic AI-default UI once a builder is tired?

**Verdict: the plan is directionally right and unusually well-cited, but it has
six blockers.** Three are contract holes that only surface at Checkpoint 2 (the
worst possible time), one is a false assumption about infrastructure that already
exists on disk, one is a D9 violation inherited verbatim from a Phase 1 audit, and
one makes the very first code task unbuildable as written.

---

## Verdicts & evidence

### 🔴 H1 — The Blob store is **already private**. A5's open question is closed, and its consequences are unmapped.

**What the plan says.** `tasks/plan.md:250-252`:

> - Decide first: `public` vs `private` access — Open Question in the spec.
>   Ask the human; do not quietly pick one mid-PR [Locked D9].

`plan/spec.md:339-341` lists the same thing as Open Question 2, framed as "a
product call, not a technical one".

**Why it is wrong.** The store exists and its access mode was fixed when it was
created, two hours before the plan was last touched:

```
$ vercel blob list-stores
  Name           ID                       Status     Region   Size   Files   Projects    Age
  juno-letters   store_D2WuxECBKxmSPVzn   ● Active   iad1     0B     0       juno-hack   2h

$ vercel blob get-store store_D2WuxECBKxmSPVzn
  Access: Private
  Base URL: d2wuxecbkxmspvzn.private.blob.vercel-storage.com
```

Access is a **store** property, chosen at creation ("Select **Continue**, then set
the access to **Private** or **Public**" —
<https://vercel.com/docs/vercel-blob/client-upload>), not a per-upload flag. Asking
the human to choose `public` produces an answer the infrastructure cannot honour
without creating a second store.

It is also **not** merely a product call. Three Track A tasks change shape:

- **A5.** `upload()` must pass `access: 'private'`; the returned `blob.url` lives on
  `*.private.blob.vercel-storage.com` and is "not publicly accessible"
  (<https://vercel.com/docs/vercel-blob/private-storage>).
- **A6.** The model cannot be handed a `blobUrl`. The AI SDK's default file
  handling "automatically downloads files in parallel when they are not supported
  by the model" (`node_modules/ai/docs/02-foundations/03-prompts.mdx`), and that
  download is unauthenticated — it will 401 against a private store. Extraction
  must either read bytes server-side with `get(pathname, { access: 'private' })` or
  supply `experimental_download`.
- **A9.** "Tap to see where it says that" cannot be `<img src={blobUrl}>` or
  `next/image`. Private blobs are delivered "through your own Functions": a route
  handler that authenticates, calls `get()`, and streams the result. The
  `images.remotePatterns` note in `05-track-5-codebase-audit.md §Dependency delta`
  names `*.public.blob.vercel-storage.com` — the wrong hostname, and no remote
  pattern grants `next/image` a bearer token anyway.

Success Criterion 1 (`plan/spec.md:300-302`, "a working link back to the source
image") therefore has no implementation path in the plan as written.

**Silver lining:** private is the _right_ answer for a health product whose home
screen already promises "we don't share your health information", and the schema
already carries `blobPathname` (`01-track-1-clinical-schema.md:1157`), which is
exactly what `get()` needs. The decision is good; only the plan is stale.

---

### 🔴 H2 — `lib/store/log.ts` and the adherence-log schema have no owner.

**What the plan says.** A2 (`tasks/plan.md:213-217`) creates `lib/store/plan.ts`
and `lib/store/patient.ts`. That is the whole store task.

**Why it is wrong.** `readLog` is consumed twice:

- `tasks/plan.md:229-230` (A4): `Promise.all([readPlan(), readLog(today)])`
- `tasks/plan.md:420-421` (B8): `Promise.all([readPatient(), readPlan(), readLog(recentDays)])`

and written twice (B4's `/api/log`, A10's optimistic tick). `plan/spec.md:109`
lists `store/plan.ts, log.ts, patient.ts` — but **no task creates `log.ts`**, and
Task 0.2 ports only `ExtractedBundle`, so **no task defines a `LogEntry` schema
either**.

The adherence log is the _second_ shared contract in this build. It is written by
both tracks and read by three modules including `assess()` — the function whose
output is spoken aloud on the family dashboard. Leaving it unowned means it gets
invented twice and diverges precisely at Checkpoint 2, which is the moment the plan
schedules for "the full loop is real".

This also blocks A4 in **Phase 1**: A4 cannot compile without `readLog`, and
`readLog` is not scheduled until Track B's Phase 2 at the earliest.

---

### 🔴 H3 — A10 ↔ B4 is an impossible join as specified.

**What the plan says.**

- B4 (`tasks/plan.md:382-386`): "Bind `patient_id` and `check_in_id` as **dynamic
  variables** (never model-filled), authenticate with a `secret__`-prefixed header
  variable."
- A10 (`tasks/plan.md:305-310`): "The one client leaf in the otherwise-server-
  rendered timeline. Optimistic tick, `POST /api/log`, `router.refresh()`. …
  Dependencies: Track B's `/api/log` route (Task B4) — coordinate here, it's the
  seam between tracks."

**Why it is wrong.** B4 designs `/api/log` as an **ElevenLabs webhook target**: it
authenticates on a shared secret header that only ElevenLabs' backend holds. A
browser client leaf cannot send that header without shipping the secret into the
client bundle — which `lib/env.ts:12` makes trivially easy to do by accident (the
module-scope `env` object is imported by `voice-session.tsx`) and which
`plan/spec.md:263-264` explicitly bans.

Second mismatch: `check_in_id`. A manual tick on `/plan` happens outside any voice
session, so there is no check-in to attribute it to. The log entry shape must model
both origins.

"Coordinate here" is the entire specification. There is no request body, no
response body, no idempotency rule (tap twice, or tick something the agent already
logged), no key format, no answer to "what does the optimistic tick roll back to
when the POST fails".

The cheapest correct answer is already in the repo's plan: B2 introduces
`app/actions/set-locale.ts`, so **Server Actions are an established pattern** —
A10 should call a server action, not `fetch("/api/log")`, and `/api/log` should
stay the machine-to-machine surface. Both paths then converge on one
`appendLogEntry()` in `lib/store/log.ts`.

---

### 🔴 H4 — Nothing produces the French red-flag translation that D7, A9 and Success Criterion 6/7 require.

**What the plan says.**

- Task 0.2 (`tasks/plan.md:149-151`): "Port the Zod schema … **plus the French
  translation slot on `RedFlag` per Locked D7**."
- A9 (`tasks/plan.md:295-303`): renders `triggerVerbatim` + `actionVerbatim` with
  visual precedence and an attribution line. **French is not mentioned at all.**
- `tasks/todo.md:110-112` _does_ say A9 must do "dual EN+FR on red flags (Locked
  D7)". The two files disagree.

**Why it is wrong.** Three gaps compound:

1. **Shape unspecified.** `01-track-1-clinical-schema.md:1314-1327` defines
   `RedFlag` with no translation field. Task 0.2 instructs the builder to add one
   but does not say what it looks like — and this is the one file the plan itself
   calls "the shared contract … any change is communicated to both tracks before
   merging" (`plan/spec.md:256-258`). A field invented at 2am on the shared
   contract is the exact scenario Phase 0 exists to prevent.
2. **No producer.** A6 extracts English verbatim from an English letter. B1 authors
   UI strings. B3 authors the persona in `en`/`fr`. Nothing writes
   `RedFlag.<french field>`. D7 forbids machine-translating the _persona_ and is
   silent on the red flags.
3. **The failure is silent.** In French mode a missing translation renders as an
   empty half-card or an English-only card — i.e. English leaking into a French
   screen, which D9 §2 bans by name.

D7's own note constrains the answer: NHS licence term 3.6(b) treats translation as
adaptation, so translated NHS-derived content may not carry NHS attribution. That
pushes toward **hand-authored French for the demo bundle's handful of red flags**,
committed alongside the seed fixture, rather than a runtime translation step.

---

### 🔴 H5 — Drug lookup collapses "not on the A–Z" and "the fetch failed" into one `null`. That is a silent fallback.

**What the plan says.** A7 (`tasks/plan.md:272-274`):

> On miss, return typed `null` meaning "not on NHS.uk A–Z" — a named empty result,
> **not** a substitute side-effect blurb and not a fake cache hit [Locked D9].

**Why it is wrong.** The source it is compressing says something different.
`03-track-3-drug-lookup-feasibility.md:426-427` and `:441`:

> **Output:** `NhsMedicine | null`. `null` means "not in the NHS A-Z, **or fetch
> failed**" …
> Resolution order inside it: … **On any failure at any layer, return `null`.**

Those are two states wearing one value. On demo night, an NHS.uk timeout, a DNS
blip, a 500, or a schema change renders **identically** to "apixaban is genuinely
not listed" — on the single most important drug in the demo (D6's action item
exists precisely because enoxaparin/dalteparin 404). The UI shows a calm empty
state; nobody learns anything is broken. That is D9 §5 word for word: "Drug lookup
returning `null` … must not be papered over".

D9's own allowance is the fix: "Allowed explicit branches … **discriminated
unions** (`assess()` kinds)". The lookup should return a union, not `null`.

---

### 🔴 H6 — Phase 0 has no install task, and Task 0.3 cannot compile without one.

**What the plan says.** Phase 0 is Tasks 0.1–0.6. None of them installs a package.
Task 0.3 (`tasks/plan.md:160-167`) creates `lib/store/redis.ts`, whose reference
implementation (`plan/spec.md:189`) opens with `import { Redis } from "@upstash/redis"`.

`06-phase-1-readiness.md:36-37` confirms: "`@upstash/redis`, `@vercel/blob` and `ai`
are still **not installed**". The install exists only in `tasks/todo.md:64`, and the
risk table (`tasks/plan.md:509`) mentions "Install `ai` first" as a _mitigation_,
which is not a task anyone ticks.

**Why it matters beyond bookkeeping.** Three things ride on that missing task:

- **pnpm 11 quarantines new releases.** `CLAUDE.md:143-144`: "installs fail without
  them", referring to `pnpm-workspace.yaml`'s `minimumReleaseAgeExclude` block.
  `05-track-5-codebase-audit.md §Dependency delta` warns this "is now materially
  more likely to bite: three new packages land at once and `ai` publishes very
  frequently". Verified today: `ai@7.0.37` published 2026-07-23,
  `@vercel/blob@2.6.1` 2026-07-08 — all currently outside the 24h window, so the
  exclude list is probably not needed _right now_, but `ai` ships roughly daily.
- **`server-only` is never added.** `05-track-5-codebase-audit.md §Dependency delta`
  recommends it as "the cheapest possible insurance that `lib/store/*`,
  `lib/extraction/*` and `lib/drugs/*` can never be reached from a client
  component", and §naive-implementation #4 names the exact mistake it prevents
  ("Importing `lib/store/*` from a client component … ships the Redis token to the
  browser"). A10 puts a client leaf inside the timeline tree — this is not
  theoretical.
- **Version pinning.** Taking `latest` for `ai` mid-build means two coders can end
  up on different minors of a package whose structured-output API changed name
  between majors.

---

### 🟡 H7 — The AI SDK shape is now settled. Say so, and fix A6's acceptance criterion, which describes an API that does not exist.

**What the plan says.** A6 (`tasks/plan.md:255-266`):

> AI SDK call: `generateText` + `Output.object({ schema: ExtractedBundleFromModel })`.
> **Verify the exact API shape against `node_modules/ai/docs/` after installing** …
>
> - Acceptance: … a `safeParse` failure returns a 422 with a plain sentence, not a 500.

**Verified — the plan's API claim is correct.** Against `ai@7.0.37` (current
`latest`, published 2026-07-23):

- `import { generateText, Output } from 'ai'` — `Output` is exported as
  `output as Output` (`dist/index.d.ts:8846`).
- The parameter is **`output`**, not `experimental_output` (`dist/index.d.ts:4690`
  destructures `output` in the `generateText` signature).
- The result is `const { output } = await generateText(...)`;
  `GenerateTextResult.output: InferCompleteOutput<OUTPUT>` (`dist/index.d.ts:4329+`).
- `generateObject` is still exported but carries, verbatim
  (`dist/index.d.ts:7121`): `@deprecated Use \`generateText\` with an \`output\`
  setting instead.`— D2 and`spec.md:48` are right.
- The verification route the plan names is real: the package ships a `docs/`
  directory (272 files). The exact file is
  `node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx`.

**What is wrong is the acceptance criterion.** With `Output.object`, schema
validation happens _inside_ the SDK and **throws**; there is no `safeParse` result
to branch on. Same doc file, §Error Handling:

> When `generateText` with structured output cannot generate a valid object, it
> throws a `AI_NoObjectGeneratedError`. … The error preserves … `text`, `response`,
> `usage`, `cause`.

There are, in fact, **two** distinct failure surfaces in A6 and the plan conflates
them into one word:

1. the model failing to produce a schema-valid object → `NoObjectGeneratedError`
   thrown by `generateText`, detected with `NoObjectGeneratedError.isInstance(error)`;
2. the _merged_ object (model output + `blobUrl`/`blobPathname` merged back in)
   failing the full `ExtractedBundle` — this one genuinely is a `safeParse`.

As written, a builder wraps the whole thing in a bare `try/catch`, loses `cause`,
and returns one indistinguishable 422 — or, more likely, a 500. Both failures are
loud, but they are loud about different things, and D9 wants the message to name
the problem.

---

### 🟡 H8 — How the documents actually reach the model is unspecified, and the part shape changed.

A6 says "never ask the model for a URL" but never says what it _is_ given. In
`ai@7` (`node_modules/ai/docs/02-foundations/03-prompts.mdx`) images are file parts:

```ts
{ type: 'file', mediaType: 'image/jpeg', data: <Uint8Array | base64 | URL> }
```

The old `{ type: 'image', image: … }` shape is gone; PDFs use the same `type: 'file'`
with `mediaType: 'application/pdf'`. The same doc documents `experimental_download`
for authenticated sources, with a sample whose URL is literally
`https://api.company.com/private/document.pdf`. Combined with **H1**, this is the
concrete fork: private store ⇒ bytes read server-side via `get()`, or
`experimental_download` supplying the `Authorization` header.

---

### 🟡 H9 — `llmEnv()` risks being dead code, which unenforces D9 §4 for the AI Gateway.

Task 0.3 creates `llmEnv()`. No Track A task says to _call_ it. The AI SDK reads the
key from `process.env` itself — the gateway is the SDK's default global provider
(`node_modules/ai/docs/02-getting-started/00-choosing-a-provider.mdx:37-47`:
`AI_GATEWAY_API_KEY=your_api_key_here` … "The AI Gateway is the default global
provider, so you can access models using a simple string"). So `generateText({ model:
"anthropic/claude-…" })` works without the app ever touching `llmEnv()`, and a missing
key surfaces as a gateway 401 in the middle of an extraction rather than as a loud
failure at the config boundary. D9 §4 says the opposite: "Missing … AI Gateway keys
throw at the `xxxEnv()` boundary".

---

### 🟡 H10 — `blobEnv()` has the same problem plus an OIDC trap.

Blob credential resolution (<https://vercel.com/docs/vercel-blob/using-blob-sdk>
§Authentication), in order: explicit `token` → OIDC (`VERCEL_OIDC_TOKEN` +
`BLOB_STORE_ID`) → `process.env.BLOB_READ_WRITE_TOKEN` → throw. Two consequences:

- `handleUpload` specifically needs the long-lived static token: it is "required by
  `handleUpload` … to generate client tokens for browser uploads"
  (<https://vercel.com/docs/vercel-blob/client-upload>). So `blobEnv()` asserts
  `BLOB_READ_WRITE_TOKEN` and A5 passes it explicitly.
- `tasks/todo.md:29` records OIDC in `.env.local`. `VERCEL_OIDC_TOKEN` is
  short-lived and auto-rotated; a pulled copy goes stale. If A5/A6 fall through to
  OIDC locally, "it worked yesterday" is a foreseeable mid-build failure with an
  unhelpful error.

---

### 🟡 H11 — `redis().get()` lies about its type, and Upstash silently returns the raw string on bad JSON.

Verified against `@upstash/redis@1.38.0` (unpacked from npm):

- `GetCommand<TData = string>` (`error-8y4qG0W2.d.ts:1207`), so
  `await redis().get(key)` types as `string | null` while automatic
  deserialization returns a **parsed object** at runtime. `plan/spec.md:212-214`'s
  reference snippet inherits that wrong type.
- Deserialization is `try { parseRecursive(result) } catch { return result }`
  (`chunk-2X4SLXT7.mjs`) — a non-JSON value comes back as a raw string rather than
  throwing.

Neither is fatal (`ExtractedBundle.parse()` on a string throws loudly, which is the
D9-correct outcome), but this is exactly `05-track-5-codebase-audit.md
§naive-implementation #6`: "Trusting `redis.get<Plan>()`. The generic is unchecked.
Parse it." A2's wording should make the annotation explicit so nobody types the
generic as `<ExtractedBundle>` and skips the parse.

---

### 🟡 H12 — A7's dependency on A6 is false, and it stacks both external integrations in series.

A7 (`tasks/plan.md:281`): "Dependencies: A6 (needs a real medication list to look
up)." But A1's seed fixture already carries medication names
(`tasks/plan.md:203-206`) and `03-track-3-drug-lookup-feasibility.md:430-432`'s
contract takes a bare drug-name string. A7's own verification step
(`tasks/plan.md:278-281`) names the drugs directly: "apixaban and rivaroxaban both
return rich urgent blocks; enoxaparin/dalteparin return `null`".

Real dependency: **A1**, not A6. Keeping the stated order means NHS.uk — an
uncontrolled third-party HTML scrape, the second-riskiest thing in Track A — is not
exercised until extraction already works. If both are broken you find out at hour
12 with nothing to fall back on. Moving A7 to Phase 1 also de-risks A8's seed-file
decision, which the plan defers to "if NHS.uk is flaky in rehearsal" — i.e. too
late to act on.

---

### 🟡 H13 — A7 is two or three tasks wearing one bullet, and its Redis keys contradict D10.

`03-track-3-drug-lookup-feasibility.md §Call shape` specifies: A–Z index fetch and
cache; slug resolution rules (exact → `slug.startsWith(name + "-for-")` preferring
`-for-adults`); page fetch; a **wire** JSON-LD schema _and_ a **domain** schema;
scan every `hasPart` for `identifier === "urgent"` (not just side-effects — the
overdose warning lives under `UsageOrScheduleHealthAspect`); record the parent
aspect; discard the rest of `UsageOrSchedule`; 24h TTL; descriptive `User-Agent`.
Plus `/api/drug-info` with the in-plan guard. A7's bullet compresses all of that
into four lines, and the two "non-obvious" rules the audit flags (scan all aspects;
record the parent aspect) are only half-carried.

Separately: the audit's cache keys are `nhs:med:v1:<slug>` and `nhs:az-index:v1`.
D10 says "Redis key prefix … for new code: `portico:`" and "do not introduce new
`juno:` keys". `nhs:` is neither — the plan should say explicitly whether the drug
cache is `portico:nhs:med:v1:<slug>` or is a deliberate exception, before two people
type two different prefixes.

---

### 🟡 H14 — A4 is four files plus a whole state set, and the non-happy states are unspecified. `app/(phone)/error.tsx` is unowned.

A4's acceptance (`tasks/plan.md:234-235`) covers exactly one state: "renders the
seeded demo plan as a day-by-day list inside the phone frame". But:

- `readPlan()` returns `ExtractedBundle | null` (`plan/spec.md:209-215`). What does
  `/plan` render when it is `null`? Not stated. A blank timeline is the quietest
  possible failure and D9 exists to prevent exactly that.
- A parse throw from A2 needs somewhere to land. `plan/spec.md:78` lists
  `app/(phone)/error.tsx` as a new file — **no task creates it**, in either track.
- No `loading.tsx` / `<Suspense>` decision, though the page does two Redis round
  trips.

Deferring all of this to A11 ("empty/error states in plain language") in Phase 3
means the states get retrofitted onto finished markup at hour 20, which is how
"Something went wrong" gets shipped.

---

### 🟡 H15 — `patientId` has no defined source.

`readPlan(patientId)` (`plan/spec.md:209-211`); keys `portico:plan:demo` /
`portico:patient:demo` (`tasks/plan.md:209-211`). Nothing says where `"demo"` comes
from — a constant, a cookie, a route param. Every Track A task and B3/B8 need it.
Two people will hardcode it in two places with two names.

---

### 🟡 H16 — A1's seed does not seed the log that B14 depends on.

B14 (`tasks/plan.md:478-481`) wants `make seed` to reset to "two prior misses on the
clot-preventer, so the escalation is already primed". A1's acceptance
(`tasks/plan.md:209-211`) populates only `portico:plan:demo` and
`portico:patient:demo`. The file is Track A's (`app/api/seed/route.ts`); the
requirement is Track B's; nobody owns the overlap. Discovered at rehearsal, this
becomes manual Redis surgery between demo runs — which Checkpoint 3 explicitly
forbids.

---

### 🟡 H17 — The `onUploadCompleted` localhost trap is not named for A5, though the identical trap is named for B4.

`tasks/plan.md:390-392` gives B4 a bolded **"The localhost trap"** callout. A5 gets
nothing, despite the same failure mode being documented
(<https://vercel.com/docs/vercel-blob/client-upload>): "When running your
application locally, the `onUploadCompleted` callback will not work as Vercel Blob
cannot contact your localhost" — and despite
`05-track-5-codebase-audit.md §naive-implementation #7` naming it precisely:
"Doing the extraction in Blob's `onUploadCompleted` webhook. Works in production,
silently does nothing on `localhost`."

The plan's own architecture is safe (`extract/route.ts` takes `{ blobUrls }` —
`plan/spec.md:86`), but nothing _says_ so, and `onUploadCompleted` is the obvious
place to put "then extract".

---

### 🟡 H18 — Referential integrity between `SourceRef.documentId` and `documents[].id` is never checked.

A6 (`tasks/plan.md:258-260`) merges `blobUrl`/`blobPathname` back in after parse —
implicitly by id. `01-track-1-clinical-schema.md:1103-1114` makes the contract
explicit: "`documentId` resolves to `documents[].blobUrl`". Zod cannot express that
cross-field constraint and the plan adds no post-parse check.

A model that renames `doc_1` to `document_1`, or invents a `documentId` for a quote
it hallucinated a source for, produces a bundle that **parses cleanly** and whose
every "tap to see where it says that" link is dead. Silent clinical degradation —
D9 §5. It is a five-line check and it is the structural guarantee the whole pitch
rests on ("everything Portico says … read back verbatim with a link",
`plan/spec.md:412-414`).

---

### 🟢 H19 — Pin exact versions; the release-age quarantine is a live hazard, not a stale note.

`pnpm config list` confirms the `minimumReleaseAgeExclude` block is active config.
Today `ai@7.0.37` (2026-07-23), `@vercel/blob@2.6.1` (2026-07-08) and
`@upstash/redis@1.38.0` are all outside the quarantine window, so a plain install
should work — but `ai` publishes near-daily (7.0.35 → 7.0.36 → 7.0.37 inside 72
hours). Install exact versions rather than floating, so a second `pnpm install` on
the other coder's machine resolves the same tree.

### 🟢 H20 — The `vitest` question is pre-decided in A3 while still listed as open.

`plan/spec.md:344-345` lists it as human decision 4; A3
(`tasks/plan.md:226-227`) says "Verify (if time allows a test): a handful of vitest
cases per anchor variant." Decide it at Checkpoint 0, in or out. `buildTimeline`
across three `DateAnchor` variants is the one place in Track A where a wrong answer
is invisible until day 7 on stage.

### 🟢 H21 — File-name drift between the audit and the plan.

`03-track-3-drug-lookup-feasibility.md` writes the module as `lib/nhs-medicines.ts`;
plan and spec say `lib/drugs/lookup.ts`. The builder will paste the audit's code
block, header comment included. One line in A7 fixes it.

---

## AI-slop UI risk on Track A screens

`CLAUDE.md` is law and overrides every design skill on conflict; the merged
enumeration is `04-track-4-i18n-and-accessibility.md §Merged anti-slop checklist`
(rules S1–S30). These are the violations that are _foreseeable from the plan's own
wording_ on Track A screens, each with the task that will produce it.

| #   | Where it will happen                                                  | The AI-default that will appear                                              | Rule it breaks                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **A9** — "tap to see where it says that"                              | `fixed inset-0` full-screen lightbox with `backdrop-blur`                    | S4 (no glassmorphism/`backdrop-blur`), S10 + `CLAUDE.md` "The phone shell" (the frame owns the height; "no page needs `env()` or fixed positioning")                                                                                                                                                                                 |
| 2   | **A4** — day headings                                                 | `uppercase tracking-[0.18em] text-ink-faint` → "DAY 1"                       | S17 (no uppercase, no tracking utilities; NHS: "we do not use block capitals"), and `ink-faint` = **2.74:1**, fails WCAG AA                                                                                                                                                                                                          |
| 3   | **A4/A10** — taken / missed / due                                     | `text-success`, `text-warning` as body text; colour as the only state signal | `success` 3.31:1, `warning` 3.23:1 on white and **2.94:1 on `mist`** — fails 1.4.3; colour-alone fails 1.4.1                                                                                                                                                                                                                         |
| 4   | **A4, A5, A9, A10** — new glyphs (check, alert, pill, upload, camera) | `pnpm add lucide-react`                                                      | S8 — **no icon library at all**; extend `components/icons.tsx` (10 icons today: `IconDoc`, `IconKeyboard`, `IconChevron`, `IconMenu`, `IconChat`, `IconClose`, `IconSend`, `IconMic`, `IconPlus`, `IconLock`). **No Track A task lists `components/icons.tsx` in its files**, though `plan/spec.md:93` says four icons must be added |
| 5   | **A4** — timeline sections                                            | three-up card grid with an icon per card                                     | S7                                                                                                                                                                                                                                                                                                                                   |
| 6   | **A5** — upload drop zone                                             | dashed border, `rounded-xl`, a gradient fill                                 | S3 (no decorative gradients), S6 (only `rounded-tactile` / `rounded-card` / `rounded-pill`)                                                                                                                                                                                                                                          |
| 7   | **A4/A9** — doses, times, day numbers                                 | a mono face for "technical values"                                           | S2 — **no monospace anywhere**; `.tnum` only. Plus `plan/spec.md:367-368`: 12-hour times (`5pm`), numerals for 1 and 2                                                                                                                                                                                                               |
| 8   | **A5/A6** — extraction progress                                       | indeterminate spinner + "Analysing your documents…"                          | Skeleton matching the timeline, not a spinner; and S20 bans "please" / "sorry" / "Oops" in the error text                                                                                                                                                                                                                            |
| 9   | **A4–A11** — all new copy                                             | em-dashes, Title Case buttons, "don't", "&"                                  | S18 (never U+2014; prefer a full stop), S16 (sentence case), `plan/spec.md:361-363` (no negative contractions — a safety rule), S19                                                                                                                                                                                                  |
| 10  | **A10** — the tick control                                            | a 20px glyph with a 20px hit area                                            | `CLAUDE.md` ≥44px; `plan/spec.md:326-327` counts six existing violations already                                                                                                                                                                                                                                                     |
| 11  | **A4** — headings                                                     | `font-bold` (700), copied from `app/(phone)/plan/page.tsx:13`                | S26 — `globals.css` sets `h1`–`h4` to 600 and three existing files override to 700. A4 rewrites that exact file; resolve the inconsistency there rather than propagating it                                                                                                                                                          |

### Taste-safe acceptance criteria (hold the builder to these)

Proposed as a single reusable block appended to A4, A5, A9 and A10, so it is not
deferred to A11:

> **UI acceptance (every new Track A screen, checked before the task is ticked):**
>
> 1. No `dvh`, `vh`, `h-screen`, `fixed` or `absolute inset-0` anywhere inside
>    `app/(phone)/`. Fill with `flex min-h-0 flex-1 flex-col`. The source-image
>    view is a **route** (`/plan/source/[documentId]`), not an overlay.
> 2. `grep -rE "backdrop-blur|bg-gradient|rounded-(xl|2xl|3xl)|font-mono|uppercase|tracking-\[" app components` returns nothing new.
> 3. No new dependency provides an icon. Every new glyph is added to
>    `components/icons.tsx` in its existing register — 16px grid, `strokeWidth`
>    1.4–1.75, `currentColor`, `aria-hidden`, round caps and joins.
> 4. No raw hex outside `app/globals.css`. `text-ink-faint` is not used for text
>    (2.74:1). `text-success` / `text-warning` never carry body text; every state
>    is also carried by a word, never colour alone.
> 5. Every interactive element measures ≥44×44px, including the tick in
>    `task-check.tsx`.
> 6. Copy: sentence case, British English, no U+2014, no negative contractions
>    ("do not", never "don't"), no ampersands, no "please" / "sorry" / "oops" /
>    exclamation marks, no block capitals, numerals for all numbers, 12-hour
>    times.
> 7. The full state set ships together: happy, empty, loading, error. Loading is a
>    skeleton matching the real layout, not a spinner. Empty and error name the
>    problem **and** the next step.
> 8. Transitions list their properties (never bare `transition`), 120–200ms,
>    ease-out, opacity and small translate only. Anything that moves is disabled
>    under `prefers-reduced-motion`.
> 9. Headings use weight 600, matching `globals.css`; no `font-bold`.

---

## Proposed patches (not yet applied)

Quoted replacement wording for `tasks/plan.md`. Nothing below has been written to
that file.

### P1 — new Phase 0 task, before Task 0.3 (fixes H6)

> - [ ] **Task 0.0: Install the three runtime packages + `server-only`.**
>       `pnpm add ai@7.0.37 @upstash/redis@1.38.0 @vercel/blob@2.6.1 server-only`
>       (exact versions, not ranges — `ai` publishes near-daily and both coders must
>       resolve the same tree). If pnpm 11's release-age quarantine rejects any of
>       them, **add** a `name@version` line to `pnpm-workspace.yaml`'s
>       `minimumReleaseAgeExclude` — never delete the block [CLAUDE.md:143-144].
>       `server-only` is imported by every module in `lib/store/`, `lib/extraction/`
>       and `lib/drugs/`, so a client import becomes a build error rather than a
>       leaked Redis token [05 §naive-implementation 4].
>   - Files: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
>   - Verify: `pnpm typecheck` passes; `node_modules/ai/docs/` exists (it ships
>     272 doc files — this is where Task A6's API check happens).

### P2 — Task 0.2 addition (fixes H4 part 1 and H2 part 2)

> - Acceptance: exports `ExtractedBundle`, `type ExtractedBundle`, and every
>   sub-schema is composable for the model-facing variant (documents minus
>   `blobUrl`/`blobPathname`).
> - **`RedFlag` gains `triggerFr: string | null` and `actionFr: string | null`
>   — nullable, never replacing the English verbatim [Locked D7]. Null means "no
>   French authored yet" and the French red-flag card must say so in French, not
>   fall through to English [Locked D9 §2]. These are authored by hand alongside
>   the seed fixture (Task A1) and the extracted bundle (Task A6); nothing
>   machine-translates them at runtime.**
> - **Also exports `LogEntry` + `type LogEntry` — the second shared contract,
>   written by both tracks:**
>   ```ts
>   const LogEntry = z.object({
>     id: z.string(),
>     patientId: z.string(),
>     itemId: z.string(), // a medication/step id from the bundle
>     day: z.iso.date(), // the plan day this entry answers
>     status: z.enum(["taken", "missed"]),
>     source: z.discriminatedUnion("kind", [
>       z.object({ kind: z.literal("voice"), checkInId: z.string() }),
>       z.object({ kind: z.literal("manual") }),
>     ]),
>     at: z.iso.datetime({ offset: true }),
>   });
>   ```
>   **`(patientId, itemId, day)` is the idempotency key: a repeat write for the
>   same triple replaces, never appends. Both `/api/log` (B4) and the manual tick
>   (A10) go through the same `appendLogEntry()`.**

### P3 — Task 0.3 addition (fixes H15)

> - **Also exports `DEMO_PATIENT_ID = "demo"` from `lib/store/keys.ts` together
>   with the key builders (`planKey`, `patientKey`, `logKey`, `nhsMedicineKey`,
>   `nhsIndexKey`). Every key is `portico:`-prefixed [Locked D10] — including the
>   NHS cache, which `03` sketches as `nhs:med:v1:<slug>`; it becomes
>   `portico:nhs:med:v1:<slug>`. One module, so nobody types a prefix twice.**

### P4 — Task A2 replacement (fixes H2, H11, H14 part 2)

> - [ ] **Task A2: `lib/store/plan.ts`, `lib/store/patient.ts`, `lib/store/log.ts`.**
>       Read/write with the matching schema's `.parse()` on every read (Redis reads
>       are a trust boundary). Annotate reads as `redis().get<unknown>(key)` — the
>       default generic is `string`, but `@upstash/redis` deserialises automatically
>       and returns the parsed object, so the default type is a lie and encourages
>       skipping the parse [05 §naive-implementation 6].
>   - Files: `lib/store/plan.ts`, `lib/store/patient.ts`, `lib/store/log.ts`
>   - `log.ts` exports `readLog(patientId, days)` and `appendLogEntry(entry)`,
>     both typed on `LogEntry` from Task 0.2. `appendLogEntry` is idempotent on
>     `(patientId, itemId, day)`. **A4 and B8 both call `readLog`; A10 and B4 both
>     write through `appendLogEntry`. This file is a cross-track contract — treat
>     a change to it like a change to `schema.ts`.**
>   - Every module in this directory starts with `import "server-only"`.
>   - Verify: a manually corrupted Redis value throws a clear parse error instead
>     of `undefined` three components deep.

### P5 — Task A4 addition (fixes H14)

> - **Acceptance (state set, all four, in this task — not deferred to A11):**
>   seeded plan renders as a day-by-day list inside the phone frame (no `dvh`/`vh`;
>   fill with `flex min-h-0 flex-1 flex-col`); **`readPlan()` returning `null`
>   renders a named empty state that says no plan has been uploaded yet and links
>   to `/upload`** — not a blank column; **a parse throw lands in a new
>   `app/(phone)/error.tsx` that names the problem and offers one action**; a
>   loading skeleton matches the timeline's real layout.
> - Files: `app/(phone)/plan/page.tsx`, `app/(phone)/error.tsx`,
>   `components/plan/timeline.tsx`, `day-section.tsx`, `task-row.tsx`,
>   **`components/icons.tsx` (add `IconCheck`, `IconPill` — no icon library
>   [04 §S8])**
> - Dependencies: A1, A2, A3.

### P6 — Task A5 replacement of the access-mode bullet (fixes H1, H10, H17)

> - **The store already exists and is `Private`.** `vercel blob get-store
store_D2WuxECBKxmSPVzn` → `Access: Private`, base URL
>   `d2wuxecbkxmspvzn.private.blob.vercel-storage.com`. Access is a store
>   property fixed at creation, not a per-upload flag, so Open Question 2 in
>   `plan/spec.md` is **closed by the infrastructure**: pass `access: "private"`
>   in both `upload()` and `handleUpload`. This is the right answer for a health
>   product — the home screen already promises we do not share health information
>   — but it is a **technical** fork, not a cosmetic one. Its two consequences are
>   Tasks A6 and A9 below; do not start either until this is understood.
> - `blobEnv()` asserts `BLOB_READ_WRITE_TOKEN` and A5 passes it explicitly to
>   `handleUpload`: the long-lived static token is _required_ to mint client upload
>   tokens, and the OIDC fallback (`VERCEL_OIDC_TOKEN`) is short-lived and goes
>   stale in a pulled `.env.local`.
> - **Do not trigger extraction from `onUploadCompleted`.** Vercel Blob calls that
>   callback from its own backend and cannot reach a dev machine — it works in
>   production and silently does nothing on localhost [05 §naive-implementation 7].
>   The browser calls `/api/extract` with the returned pathnames instead. This is
>   the same class of trap as B4's ElevenLabs webhook.
> - Verify: a multi-page photo bundle uploads without hitting a body-size error.

### P7 — Task A6 replacement of the API-shape and acceptance bullets (fixes H7, H8, H18)

> **Verified API shape (settled — do not re-derive).** Against `ai@7.0.37`:
> `import { generateText, Output } from "ai"`; the parameter is `output`, **not**
> `experimental_output`; read the result as `const { output } = await
generateText({ model, output: Output.object({ schema }), messages })`.
> `generateObject` is still exported but carries `@deprecated Use generateText
with an output setting instead` [`ai@7.0.37` `dist/index.d.ts:7121`]. Reference
> in-tree after install: `node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx`.
>
> **Document parts.** Images and PDFs are both `{ type: "file", mediaType, data }`
> — the old `{ type: "image" }` part is gone
> [`node_modules/ai/docs/02-foundations/03-prompts.mdx`]. **Because the Blob store
> is private (A5), passing `new URL(blobUrl)` will 401**: the SDK's default
> downloader is unauthenticated. Read the bytes server-side with
> `get(blobPathname, { access: "private" })` and pass them as `data`.
>
> **Two distinct failure surfaces, two distinct 422 messages:**
>
> 1. the model failing to produce a schema-valid object — `generateText` **throws**
>    `NoObjectGeneratedError` (there is no `safeParse` result at this layer); catch
>    with `NoObjectGeneratedError.isInstance(error)` and return a 422 naming
>    "the letter could not be read", preserving `error.cause` in the server log;
> 2. the **merged** object (model output + `blobUrl`/`blobPathname` merged back in
>    by `documents[].id`) failing `ExtractedBundle.safeParse` — a different 422,
>    naming which field failed.
>
> **Referential-integrity check, after the merge and before the write** (Zod cannot
> express it, and without it every "tap to see where it says that" link can be
> dead while the bundle parses cleanly — silent clinical degradation, D9 §5):
> every `documents[].id` must be one of the ids passed into the prompt, and every
> `SourceRef.documentId` in the bundle must resolve to one of them. A mismatch is
> a 422, not a repair.

### P8 — Task A7 replacement (fixes H5, H12, H13, H21)

> - [ ] **Task A7: `lib/drugs/lookup.ts` — NHS.uk fetch + Redis cache.** Follow
>       `03 §Call shape` exactly, including both non-obvious rules: scan **every**
>       `hasPart` for `identifier === "urgent"` (the overdose warning lives under
>       `UsageOrScheduleHealthAspect`, not side-effects), and record the parent aspect
>       so an overdose warning is distinguishable from a side-effect warning. Take
>       nothing else from `UsageOrSchedule`. Two Zod schemas: the wire schema (nhs.uk
>       JSON-LD, the trust boundary) and the domain schema. 24-hour TTL, descriptive
>       `User-Agent`. Keys come from `lib/store/keys.ts` (P3), so they are
>       `portico:`-prefixed [Locked D10].
> - **Return a discriminated union, not `null`.** `03:426` collapses "not on the
>   A–Z" and "the fetch failed" into one `null` — those are different states and
>   merging them is the silent fallback D9 §5 forbids. On demo night an NHS.uk
>   outage would render identically to "apixaban is genuinely not listed", on the
>   single most important drug in the demo. Required shape:
>   ```ts
>   export type DrugLookup =
>     | {
>         kind: "found";
>         medicine: NhsMedicine;
>         from: "cache" | "seed" | "network";
>       }
>     | { kind: "not-listed"; slugTried: string }
>     | { kind: "fetch-failed"; slugTried: string; status: number | "network" };
>   ```
>   `not-listed` renders as a calm, named absence. `fetch-failed` renders as a
>   visible problem and is logged — it is never shown as absence. `from` makes A8's
>   resolution order observable rather than assumed.
> - **Dependencies: A1** (the seed fixture already names the drugs), **not A6**.
>   Building this in Phase 1 stops the two riskiest external integrations from
>   being stacked in series, and surfaces A8's seed-file decision early enough to
>   act on it.
> - **Guard:** `/api/drug-info` validates the requested drug against the names in
>   the patient's stored plan and 404s anything else — this is what keeps the
>   feature inside the scope line (no open drug lookup).
> - Verify against real drugs: apixaban and rivaroxaban return rich urgent blocks;
>   enoxaparin/dalteparin return `{ kind: "not-listed" }` (confirms why the demo
>   must use the oral agent); a deliberately broken URL returns
>   `{ kind: "fetch-failed" }` and **looks different on screen**.

### P9 — Task A9 replacement (fixes H1 consequence, H4 part 2)

> - [ ] **Task A9: Red-flag card + source-trace route.**
>       `components/plan/red-flag-card.tsx` renders `triggerVerbatim` +
>       `actionVerbatim` with visual precedence (doctor's words primary, any
>       NHS-derived content visibly secondary, per `[03 §Safety framing]`).
> - **French (Locked D7):** in `fr`, the card shows `triggerFr`/`actionFr`
>   **and** the English verbatim together, English labelled as the original. If a
>   French field is `null`, say so in French — never render the English alone and
>   never machine-translate at runtime [D9 §2].
> - **Source trace is a route, not an overlay:** `/plan/source/[documentId]`.
>   The Blob store is private, so the image is served by a route handler that
>   resolves `documentId` → `blobPathname` from the stored bundle, calls
>   `get(pathname, { access: "private" })`, and streams the response with
>   `Cache-Control: private, no-cache`
>   [<https://vercel.com/docs/vercel-blob/private-storage>]. A raw `blobUrl` in an
>   `<img>` returns 401, and `next/image` cannot attach a bearer token, so
>   `images.remotePatterns` is not the fix.
> - Files: `components/plan/red-flag-card.tsx`,
>   `app/(phone)/plan/source/[documentId]/page.tsx`,
>   `app/api/blob/file/route.ts`, `components/icons.tsx` (add `IconAlert`)
> - Acceptance: NHS-derived text always carries its attribution line inline, per
>   the licence bucket (English-unmodified vs any-translation) — structural, not
>   optional. No `fixed`/`inset-0`/`backdrop-blur` anywhere in this task.

### P10 — Task A10 replacement (fixes H3)

> - [ ] **Task A10: `components/plan/task-check.tsx`.** The one client leaf in the
>       otherwise-server-rendered timeline. Optimistic tick → **server action**
>       `app/actions/log-step.ts` → `appendLogEntry()` → `router.refresh()`. On
>       rejection the tick reverts and an inline message names what failed.
> - **Do not `POST /api/log` from the browser.** B4 designs that route as the
>   ElevenLabs webhook target, authenticated with a `secret__`-prefixed header
>   variable; a browser cannot send that header without shipping the secret into
>   the client bundle. Both paths converge on `appendLogEntry()` in
>   `lib/store/log.ts` (A2) instead — the server action for the manual tick,
>   `/api/log` for the agent.
> - **The join contract with B4, fixed here so neither track invents it:** the
>   entry shape is `LogEntry` from Task 0.2; the idempotency key is
>   `(patientId, itemId, day)`; a manual tick is `source: { kind: "manual" }` and
>   a voice log is `source: { kind: "voice", checkInId }`. A repeat write for the
>   same triple replaces, so ticking something the agent already logged is a
>   no-op, not a duplicate.
> - Files: `components/plan/task-check.tsx`, `app/actions/log-step.ts`
> - Dependencies: A2 (`appendLogEntry`), Task 0.2 (`LogEntry`). **No longer blocked
>   on B4.**

### P11 — Task A1 addition (fixes H16)

> - Acceptance: `curl -X POST localhost:3000/api/seed` populates
>   `portico:plan:demo`, `portico:patient:demo`, **and `portico:log:demo` with two
>   prior misses on the clot-preventer, so B14's `make seed` resets straight into a
>   primed escalation without manual Redis surgery.** The fixture also carries
>   hand-authored `triggerFr`/`actionFr` on every red flag [Locked D7].

### P12 — Risk-table row to replace the AI-SDK row (H7)

> | AI SDK call shape | **Resolved 2026-07-25 against `ai@7.0.37`: `output` (not `experimental_output`), `const { output } = await generateText(...)`, `generateObject` deprecated. See `07 §H7`.** Remaining risk is the _failure_ shape: `Output.object` throws `NoObjectGeneratedError` rather than returning a `safeParse` result | A6 names both failure surfaces separately; budget 15 min, not 30 |

### P13 — Spec Open Questions (fixes H1, H20)

> 2. ~~**Blob access: `public` vs `private`.**~~ **Closed 2026-07-25 by the
>    provisioned store: `juno-letters` is `Private`.** Consequences are folded into
>    Tasks A5, A6 and A9. Reopening it means creating a second store.
> 3. **`vitest`** — decide at Checkpoint 0, not later. A3 currently pre-decides it
>    with "if time allows".

---

## Grounding notes

Everything asserted above about a third-party API was checked against the
published artefact today (2026-07-25), not from memory. `ai`, `@vercel/blob` and
`@upstash/redis` are not installed, so packages were fetched from the registry and
read directly.

**Vercel AI SDK — `ai@7.0.37`** (current `latest`, published 2026-07-23T22:31Z)

- <https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data> — "The AI SDK
  standardises structured object generation … using the `output` property on
  `generateText` and `streamText`"; sample is
  `const { output } = await generateText({ model, output: Output.object({ schema }), prompt })`.
- `ai-7.0.37.tgz → package/dist/index.d.ts` — `generateText` signature destructures
  `output` (line 4690); `GenerateTextResult.output: InferCompleteOutput<OUTPUT>`
  (interface at 4329); `Output` exported as `output as Output` (line 8846);
  `generateObject` carries `@deprecated Use \`generateText\` with an \`output\`
  setting instead.` (line 7121). **`experimental_output`does not appear as a`generateText` parameter.\*\*
- `package/docs/03-ai-sdk-core/10-generating-structured-data.mdx` §Error Handling —
  "it throws a `AI_NoObjectGeneratedError` … The error preserves `text`,
  `response`, `usage`, `cause`."
- `package/docs/02-foundations/03-prompts.mdx` — image and PDF parts are
  `{ type: 'file', mediaType, data }`; "The default download implementation
  automatically downloads files in parallel when they are not supported by the
  model"; `experimental_download` exists for authenticated URLs.
- `package/docs/02-getting-started/00-choosing-a-provider.mdx` —
  `AI_GATEWAY_API_KEY=your_api_key_here`; "The AI Gateway is the default global
  provider, so you can access models using a simple string".
- The package **does** ship `docs/` (272 files), so `tasks/plan.md:256`'s stated
  verification route is valid.

**Vercel Blob — `@vercel/blob@2.6.1`** (published 2026-07-08)

- <https://vercel.com/docs/vercel-blob/client-upload> — `handleUpload({ body,
request, onBeforeGenerateToken, onUploadCompleted })` in a route handler;
  `upload(file.name, file, { access: 'private' /* or 'public' */, handleUploadUrl })`
  in the browser. Store access is chosen at creation. `BLOB_READ_WRITE_TOKEN` is
  "required by `handleUpload` … to generate client tokens for browser uploads".
  "When running your application locally, the `onUploadCompleted` callback will not
  work as Vercel Blob cannot contact your localhost."
- <https://vercel.com/docs/vercel-blob/using-blob-sdk> — `access` is a **required**
  parameter on `put`, `get`, `head`, `del`, `copy`, `list`; credential resolution is
  explicit `token` → OIDC (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`) →
  `BLOB_READ_WRITE_TOKEN` → throw.
- <https://vercel.com/docs/vercel-blob/private-storage> — "Every file uploaded to a
  private Blob store gets a URL … **This URL is not publicly accessible.**" Delivery
  is "a route that authenticates the request, fetches the blob using `get()`, and
  streams the response"; recommended header `Cache-Control: private, no-cache`;
  presigned GET URLs exist via `presignUrl()`. Requires `@vercel/blob >= 2.3` and
  Vercel CLI >= 50.20.0 (installed CLI is 56.3.1).
- **Live infrastructure:** `vercel blob list-stores` → `juno-letters`
  (`store_D2WuxECBKxmSPVzn`, project `juno-hack`, 0 files, age 2h);
  `vercel blob get-store` → `Access: Private`, base URL
  `d2wuxecbkxmspvzn.private.blob.vercel-storage.com`.

**Upstash Redis — `@upstash/redis@1.38.0`**

- `upstash-redis-1.38.0.tgz → package/error-8y4qG0W2.d.ts` — `automaticDeserialization?: boolean`
  on the config; `declare class GetCommand<TData = string>`, so the default type of
  `get()` is `string` while the runtime value is the deserialised object.
- `package/chunk-2X4SLXT7.mjs` — `function parseResponse(result) { try { return
parseRecursive(result) } catch { return result } }`, i.e. a non-JSON value comes
  back as the raw string rather than throwing.

**Toolchain**

- `pnpm config list` → `minimumReleaseAgeExclude` active with three entries;
  `minimumReleaseAge` itself resolves to `undefined` at the CLI but pnpm 11's
  quarantine is what `CLAUDE.md:143-144` and `05 §Dependency delta` describe.
- Publish dates checked via `npm view <pkg> time --json`.

**Repo facts cited**

`lib/env.ts:7-27` (module-scope browser `env` + lazy `serverEnv()`);
`app/(phone)/plan/page.tsx:6-22` (placeholder A4 replaces, `font-bold` at :13);
`app/(phone)/layout.tsx:10-21` (the frame owns the height);
`components/icons.tsx` (10 hand-rolled icons);
`app/api/eleven/signed-url/route.ts` (the house route-handler shape: `serverEnv()`,
Zod at the boundary, no `as`);
`app/globals.css` `@theme` (token vocabulary, `--color-ink-faint: #909db2`);
`next.config.ts` (no `images.remotePatterns`).

---

## Residual risk

| #   | Risk                                                                                                                                                                                                                                                                  | Severity | Note                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **The `RedFlag` French fields are a shared-contract change made after Phase 0 was written.** P2 proposes `triggerFr`/`actionFr`, but the human may prefer a nested `translations: { fr: {...} }` shape for future locales.                                            | 🟡       | Must be settled **before** Task 0.2 is committed, or Redis is reseeded later — the exact failure `tasks/plan.md:18-20` exists to prevent.                                                                              |
| R2  | **`get()` for private blobs was not executed end to end** — the store has 0 files, so nothing could be read back. The API shape is documented and the CLI confirms the store is private, but the round trip (client `upload` → `get` → stream → `<img>`) is unproven. | 🟡       | First thing to prove in A5, before A6 and A9 are written against it.                                                                                                                                                   |
| R3  | **The extraction prompt itself is unspecified in the plan.** A6 names the schema and the merge but not the instruction. Given the guiding principle ("only ever reformats … never generates new clinical judgement"), the prompt is a safety artefact, not glue.      | 🟡       | `01 §Draft extraction schema` has the invariants; nobody is tasked with turning them into prompt text.                                                                                                                 |
| R4  | NHS.uk's JSON-LD shape is a third-party HTML contract that can change without notice; `03`'s wire schema was verified in Phase 1, not today.                                                                                                                          | 🟡       | A7's wire schema throws loudly on drift, which is the right failure — but it fails at _ingestion_, mid-demo. A8's seed file is the mitigation and should be decided in Phase 1 (see H12), not "if flaky in rehearsal". |
| R5  | I did not verify that the AI Gateway's available models accept image/PDF file parts in the shape A6 needs — `/v1/models` returns 306 ids but capability flags were not checked.                                                                                       | 🟡       | One `curl` against the gateway with a one-page fixture, during Task 0.0, would settle it.                                                                                                                              |
| R6  | `patientId` is proposed as a constant (P3). If the demo ever needs two patients on stage (patient + family view of a _different_ patient), that constant becomes a refactor across both tracks.                                                                       | 🟢       | Acceptable for a 24h build; recorded so it is a choice.                                                                                                                                                                |
| R7  | Track B holes were out of scope. B4's request/response shape is only half-specified here (from A10's side); the ElevenLabs-facing half is unaudited.                                                                                                                  | 🟢       | Suggest the same treatment for Track B before Checkpoint 1.                                                                                                                                                            |

---

## Skills applied

Invoked at the start of this pass and applied as noted:

- **`/nextjs-app-router-patterns`** — Server-Component-first reading of A4/A9,
  `Promise.all` parallelism, pushing `"use client"` to the leaf, route-vs-overlay
  for the source trace, `error.tsx`/`loading.tsx` as part of the state set (H14,
  P5, P9, P10).
- **`/typescript-best-practices`** — discriminated unions over nullable returns
  (H5/P8, `DrugLookup`), making illegal states unrepresentable (`LogEntry.source`
  in P2), Zod at trust boundaries only, `parse` vs `safeParse` placement (H7),
  distrusting an unchecked generic (H11).
- **`/haider-engineering-defaults`** — "fail closed if a required secret is
  missing — name which one" (H9, H10), validate at the edge, structured errors at
  boundaries (H7's two 422s), `server-only` on privileged modules (H6),
  short-lived vs long-lived credentials (H10).
- **`/haider-design-taste`** — the full state set ships together, skeletons over
  spinners, emphasis by weight not size, error copy that names problem and next
  step, no decorative colour; consciously **overridden** by `CLAUDE.md` on
  density (≥44px / 16px+ body, not 13px/36px rows), radii, shadow-vs-border, font
  stack and icon strategy, per `04 §S1, S5, S6, S8, S25`.
- **`/design-taste-frontend`** — its AI-tell catalogue drove the slop table
  (three-up feature cards, gradients, fake precision, em-dashes, decorative
  labels); consciously **overridden** by `CLAUDE.md` on `min-h-[100dvh]` (S10 —
  the single most dangerous skill/project conflict here), on icon libraries (S8 —
  the skill says never hand-roll SVG icons, this repo must), and on
  glassmorphism (S4).
- **`/web-design-guidelines`** — target size ≥44px, contrast floors (1.4.3,
  1.4.11), never colour alone (1.4.1), `min-w-0` and no truncation on long
  strings, listed transition properties, `prefers-reduced-motion`.

`CLAUDE.md` was treated as law throughout; every skill conflict is named at the
point of use rather than silently resolved.
