# 18 — Live extraction, rebuilt on OpenAI, and the first real `make eval`

Date: 2026-07-26. Worked in the git worktree `/Users/haidertoha/Code/juno-hack-t1`
(branch `docs/demo-qa-guide`, same repo, `NEXT_PUBLIC_PORTICO_MODE=live`), on a
dev server at `:3001`. Three other agents were editing the primary checkout at
the same time; **the only file I wrote there is this one.**

---

## Scope

A6 and A6.5, together. Live extraction had never run anywhere: `POST /api/extract`
returned a bare 500 with `ZodError: ANTHROPIC_API_KEY … received undefined` at
`lib/env.ts`, because no env file on this machine has ever carried an Anthropic
key. That meant `make eval` — the harness that is supposed to license demo mode's
baked bundle — had also never been run against a real model. Not "was failing":
**had never produced a number at all.**

I owned:

- `lib/extraction/extract.ts` — provider, structured-output strategy, prompt
- `lib/env.ts` — `llmEnv()` → `openAiEnv()`
- `package.json` / `pnpm-lock.yaml` — provider package swap
- `.env`, `.env.local`, `.env.example` — key hygiene only
- `lib/plan/schema.ts` — **not touched.** It is frozen and it stayed frozen; the
  section "The decision" explains why it did not need to change.

Explicitly **not** routed through the Vercel AI Gateway. `tasks/todo.md` A6 and
`tasks/plan.md` L9 both still say "AI Gateway → OpenAI"; the product owner
overrode that for an ongoing Gateway/Anthropic issue. This calls
`https://api.openai.com` directly with `OPENAI_API_KEY`. **Those two task files
are now stale on that point and nobody has corrected them** — see Residual risk.

Nothing was committed or pushed. No secret value appears in this file.

---

## Grounding notes — what the searches actually returned

Everything below was checked on 2026-07-26 before any code was written. Where a
doc page was ambiguous I probed the live API instead of guessing, and those
probes are reported as probes.

### (a) OpenAI strict JSON-schema mode — the real ceilings

| Constraint                                                        | Value                                                                          | Source                                                                                                                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Max object properties                                             | **5,000**                                                                      | [Raised from 100, July 2025](https://community.openai.com/t/structured-outputs-limits-are-raised-to-support-larger-schemas/1313593)                                                                                        |
| Max nesting depth                                                 | **5 levels**                                                                   | [Supported schemas](https://developers.openai.com/api/docs/guides/structured-outputs) · [community measurement](https://community.openai.com/t/measuring-maximum-depth-and-object-properties-in-structured-outputs/918388) |
| Max total chars across property names, definitions, enums, consts | **120,000**                                                                    | same July 2025 raise (from 15,000)                                                                                                                                                                                         |
| Max enum values across the whole schema                           | **1,000**                                                                      | same July 2025 raise (from 500)                                                                                                                                                                                            |
| `additionalProperties: false`                                     | **required** on every object                                                   | [Structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)                                                                                                                               |
| Every property in `required`                                      | **required**; optionality is expressed as a `T \| null` union, not by omission | same                                                                                                                                                                                                                       |
| `anyOf`                                                           | permitted (not at the root)                                                    | same                                                                                                                                                                                                                       |
| `oneOf`, `allOf`                                                  | **not permitted**                                                              | confirmed by live probe, below                                                                                                                                                                                             |

**The bundle schema measured against those numbers** (script run against
`z.toJSONSchema(ExtractedBundleFromModel, { target: "draft-7" })`, then deleted):

```
draft-7 raw JSON bytes: 17345
properties: 193      (ceiling 5000)
depth:        4      (ceiling 5)
enumValues:  98      (ceiling 1000)
name/enum chars: 2541 (ceiling 120000)
$ref count:   0
objects: 38 — of which 38 already carry additionalProperties:false
              and 38 already list every property in `required`
oneOf sites:  5      anyOf sites: 50
```

So the premise written into `extract.ts` today — _"every clinical field is
`.nullable()`, which compiles to 51 union-typed parameters and exceeds its
ceiling"_ — is **true of Anthropic and false of OpenAI**. 50 nullable unions
against a 5,000-property ceiling is not close to anything. And the schema's own
design rule (`.nullable()` everywhere, never `.optional()`) is exactly what
strict mode wants: all 38 objects come out fully `required` with
`additionalProperties: false` **with no post-processing at all**.

**Live probe 1 — does OpenAI actually take it?** Posted the generated schema to
`POST /v1/responses` with `text.format = {type: "json_schema", strict: true}`:

```
[as-generated]     400  Invalid schema for response_format 'response':
                        In context=('properties','medications','items','properties',
                        'duration','properties','start','anyOf','0'),
                        'oneOf' is not permitted.
[oneOf->anyOf]     200  OK
[+addlProps:false] 200  OK   (no-op — Zod already emits it)
[+all required]    200  OK   (no-op — Zod already emits it)
[-constraints]     200  OK   (no-op — minLength/format/exclusiveMinimum are all fine)
```

**One keyword.** Zod compiles `z.discriminatedUnion` to `oneOf`; OpenAI takes
`anyOf` and rejects `oneOf`. Five sites, all of them the `DateAnchor` union
(`Medication.duration.start`/`.end`, `Instruction.anchor`,
`Instruction.recurrence.until`, `Appointment.when`). The two keywords accept the
same documents here — a discriminated union's branches are mutually exclusive by
construction, so "exactly one matches" and "at least one matches" cannot differ.

**Live probe 2 — `strict: false`** with the schema untouched: `200 OK`. Non-strict
`json_schema` accepts `oneOf` but does not constrain decoding, so it buys nothing
the prompt contract did not already buy. Recorded because it was a real option.

### (b) Model catalogue and pricing — verified, not remembered

The task warned the spawning request was voice-transcribed and might name a
hallucinated model. It did not name one, and I did not assume one. I listed the
models this key can actually reach — `GET /v1/models`, 200, ~80 ids — and priced
them against [OpenAI's pricing page](https://developers.openai.com/api/docs/pricing)
and [the July 2026 pricing roundup](https://www.tldl.io/resources/openai-api-pricing).

| Model           | Input / output per 1M | On this key | Notes                            |
| --------------- | --------------------- | ----------- | -------------------------------- |
| `gpt-5.4-nano`  | **$0.20 / $1.25**     | yes         | cheapest current-generation tier |
| `gpt-5.4-mini`  | **$0.75 / $4.50**     | yes         |                                  |
| `gpt-5.6-luna`  | **$1.00 / $6.00**     | yes         | cheapest of the 5.6 family       |
| `gpt-5.4`       | $2.50 / $15.00        | yes         |                                  |
| `gpt-5.6-terra` | $2.50 / $15.00        | yes         |                                  |
| `gpt-5.6-sol`   | $5.00 / $30.00        | yes         | aliased `gpt-5.6`                |
| `gpt-4.1-nano`  | $0.10 / $0.40         | yes         | older generation; not evaluated  |

PDF input is not a model flag you look up — it is a property of the request
shape. `@ai-sdk/openai@4.0.20` defaults `openai(id)` to the **Responses API**
(confirmed in its own error string: _"The default OpenAI provider model uses the
Responses API"_), and its message converter maps an AI SDK
`{type: "file", mediaType: "application/pdf", data: Uint8Array}` part to
`{type: "input_file", filename, file_data: "data:application/pdf;base64,…"}`.
That is the shape `extract.ts` was already building for Anthropic, so **the
message construction did not change at all**. Verified by reading
`node_modules/@ai-sdk/openai/dist/index.js`, then by 60-odd successful two-page
PDF extractions.

### (c) `ai@7.0.37` — what the installed version actually exposes

The docs and the installed typings agree, and the typings are what I went by
(`node_modules/ai/dist/index.d.ts`):

- **`Output.object({ schema })` on `generateText`**, via `output:` — **not**
  `experimental_output`. The v7 export is `output as Output`; the parameter is
  `output`. Matches [the AI SDK docs](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).
- `generateObject` also exists. Not used: it would give the same strict call with
  less control over the failure surfaces.
- `jsonSchema()` and `zodSchema()` are re-exported from `@ai-sdk/provider-utils`
  through `ai`, so no new dependency was needed for either.
- `zodSchema(x).jsonSchema` is typed `JSONSchema7`, so building the schema
  through it rather than through `z.toJSONSchema` directly avoids a cast between
  Zod's JSON-Schema type and the SDK's (they differ only in allowing draft-4's
  boolean `exclusiveMinimum`). **Zero `as` in the shipped code.**
- `jsonSchema(fn)` memoises: the getter calls `fn` once and caches the result, so
  the conversion happens on first use, not per request.
- The provider defaults `strictJsonSchema` to `true` and sends
  `text.format = {type: "json_schema", strict: true, schema}`.
- Failure surfaces, read from `ai/dist/index.js`: a response that will not
  `JSON.parse` throws **`NoObjectGeneratedError`** from `parseCompleteOutput`; a
  step that finished for any reason other than `stop` (`length`, i.e. truncation)
  leaves `output` unset and reading it throws **`NoOutputGeneratedError`**. Both
  are `AISDKError` subclasses with a static `isInstance`.

---

## The decision

**Three options were on the table.**

**Option 1 — keep the prompted JSON contract, swap only the provider.** A
three-line diff: `anthropic` → `openai`, new model id, `llmEnv` → `openAiEnv`.
The `OUTPUT_CONTRACT` block keeps stuffing the 17KB JSON Schema into every
request and the response keeps being fence-stripped, `JSON.parse`d and
Zod-checked by hand.

_Against:_ the comment justifying that workaround says in as many words that the
provider's strict mode "refuses this schema… exceeds its ceiling". Probe 1 shows
OpenAI does not refuse it. Keeping the workaround means carrying a workaround for
a constraint that is not there — the thing `CLAUDE.md` calls out as "every line
justifies itself; delete rather than keep". It also spends ~4,500 input tokens
per letter re-sending a schema the API will hold in `text.format` for free, and
it leaves a whole failure class live: a fenced or truncated blob becomes a 422
the patient sees.

**Option 2 — `strictJsonSchema: false`.** Send the schema to the provider as a
hint, no rewrite needed (probe 2: accepted as-generated).

_Against:_ it is Option 1 with extra steps. Non-strict mode does not constrain
decoding, so every guarantee still has to be re-established in our code, and we
would have paid the coupling to a provider schema format for none of the benefit.

**Option 3 — native strict structured outputs, with `oneOf` rewritten to
`anyOf`. CHOSEN.** `generateText` + `Output.object({ schema })` where the schema
is `zodSchema(ExtractedBundleFromModel).jsonSchema` with five `oneOf` keys
renamed. Constrained decoding then makes a schema-invalid response impossible.

_Why:_ the evidence in (a) says the schema fits every published ceiling with room
to spare and needs **one mechanical, meaning-preserving keyword rename** — not a
schema change, not a shape change, not a field dropped. That rename is nine lines
and it is provably lossless. In exchange the prompt loses 17KB of JSON Schema,
the fence-stripping regex and the hand-rolled `JSON.parse` both become dead code
and are deleted, and `lib/plan/schema.ts` stays byte-for-byte frozen. It is also
what `tasks/plan.md` L9 asked for in the first place — _"Use `generateText` +
`Output.object` against an OpenAI model… Do not keep the Claude workaround"_ —
the owner's override was about the Gateway, not about `Output.object`.

_The cost, stated plainly:_ the two 422 surfaces are now raised partly from a
`catch`, which they were not before. That is handled narrowly — see below — and
the demo short-circuit is still the first statement in the function, still
unreachable from any `catch`.

**`lib/plan/schema.ts` was not changed.** It did not need to be. No `.nullable()`
was removed, no union was flattened, no field made optional. The only thing that
moved is a keyword in the _generated_ JSON Schema, downstream of Zod, at request
time.

---

## What changed, file by file

### `lib/extraction/extract.ts`

**Provider and model.** `@ai-sdk/anthropic` → `@ai-sdk/openai`;
`claude-haiku-4-5` → `gpt-5.6-luna`. Model choice is argued from eval numbers, not
from the price list — see "Choosing the model".

**Structured output.** `OUTPUT_CONTRACT` (the prompt-embedded schema) is gone.
In its place:

```ts
const OUTPUT_SCHEMA = jsonSchema(async () => {
  const schema = await zodSchema(ExtractedBundleFromModel).jsonSchema;
  oneOfToAnyOf(schema);
  return schema;
});
```

`oneOfToAnyOf` is a nine-line recursive walk over `unknown` with a declared type
predicate — the same `isRecord` idiom `scripts/eval-extraction.ts` already uses.
No `any`, no `as`. The comment above it records the measured numbers so the next
reader does not have to re-derive them.

**Both 422 surfaces, preserved.** `{kind: "unreadable"}` still means "that does
not look like a discharge letter" and `{kind: "invalid"}` still means "read, but
what came back does not hold together". The model call is wrapped, and the catch
is deliberately narrow:

```ts
if (
  !NoObjectGeneratedError.isInstance(error) &&
  !NoOutputGeneratedError.isInstance(error)
) {
  throw error;
}
return { kind: "unreadable", detail: error.message };
```

Only the two SDK errors that mean "the model did not produce an object" become
`unreadable`. A 401, a rate limit or a dropped socket is **rethrown** and still
surfaces as a 500 — exactly as it did before — because telling a patient "we
could not find a discharge letter in those pages" when the real cause was an
expired key is a lie they have no way to correct.

`ExtractedBundleFromModel.safeParse` is still run after the call. Strict mode
guarantees the JSON Schema, not the Zod schema behind it: `format: "date"` and
the `min(1)` lengths are checked there or nowhere.

**Preserved unchanged:** the demo-mode short-circuit is still the first statement
in `extractBundle`, still before the config assertion and the model call, still
unreachable from any `catch`. `readBytes` still pulls bytes inline from the
Private blob store and hands the model a `Uint8Array`, never a URL.
`mergeStorageIdentity`'s missing-document and dangling-document-id checks are
untouched.

**`extraction.modelId` now records the id the API reports back**
(`result.response.modelId`) rather than the constant we asked for. On the 5.4 tier
that resolves an alias to a dated snapshot — the bundles produced during this work
recorded `gpt-5.4-mini-2026-03-17` and `gpt-5.4-nano-2026-03-17`. `gpt-5.6-luna`
is itself a concrete id and reports back as `gpt-5.6-luna`.

**`maxOutputTokens` 24000 → 32000.** The GPT-5 family spends reasoning tokens
inside the same budget (measured: 1,101 reasoning + 3,344 text on Whitfield), and
running out mid-JSON is now a 422 rather than a truncated parse.

**`SYSTEM_PROMPT` — five sections added or rewritten**, every one of them driven
by a miss line the harness printed. Detail under "Prompt iteration" below.

### `lib/env.ts`

`llmSchema`/`llmEnv()` → `openAiSchema`/`openAiEnv()`, reading `OPENAI_API_KEY`.
Same one-function-per-integration pattern as `blobEnv`/`toolEnv`/`redisEnv`,
still throwing on absence, still called at the top of the live path exactly where
`llmEnv()` was. `grep -rn llmEnv` over the repo found one call site, in
`extract.ts`; `grep -rn "@ai-sdk/anthropic"` found one import, same file. Both are
gone, so nothing is orphaned.

### `package.json` / `pnpm-lock.yaml`

`- "@ai-sdk/anthropic": "^4.0.20"` / `+ "@ai-sdk/openai": "^4.0.20"`. One
`pnpm remove` and one `pnpm add`, run **only in the worktree**. Same major as the
provider it replaces and matching `ai@7.0.37`; `@ai-sdk/openai@4.0.20` is the
current latest, peer `zod ^3.25.76 || ^4.1.8` against the pinned `4.4.3`. The
lockfile diff is a clean swap of one package for one package.

### `.env.example`

- Anthropic block deleted, OpenAI block added under a server-only heading, with
  a line saying to keep it out of `.env`.
- The demo-mode comment said "no AI Gateway call". There is no Gateway in this
  path any more, so it now says "no model call" — which is the claim that
  actually matters and is still true.

### `.env` / `.env.local` — the edit the orchestrator must apply by hand

These files are gitignored and **not shared between worktrees**. I fixed the
worktree's copies. The primary checkout at `/Users/haidertoha/Code/juno-hack`
still has the drift, and it is the drift `tasks/todo.md` §"Env file contract"
already flagged: a live `OPENAI_API_KEY` sitting in `.env`, the file whose own
header says "Secrets live in .env.local — never put XI_API_KEY / tokens here."

**Apply exactly this, in `/Users/haidertoha/Code/juno-hack`:**

1. **Delete** the single `OPENAI_API_KEY=…` line from `.env`. Nothing else in
   that file changes. It must end holding only the three `NEXT_PUBLIC_*` vars.
2. `.env.local` **already has the same key** — I checked, one occurrence, same
   variable. So step 1 removes a duplicate, it does not remove the key. Nothing
   breaks: Next loads both files with `.env.local` winning, and `make eval` runs
   `node --env-file-if-exists=.env --env-file-if-exists=.env.local`.
3. Optionally tidy `.env.local`: the key currently sits unlabelled between the
   Redis block and the tool-secret block. In the worktree I moved it under
   `# --- OpenAI (extraction) ---` after the ElevenLabs block. Cosmetic.
4. `ANTHROPIC_API_KEY` needs no action anywhere — it was never in either local
   file, and nothing reads it now.

**Rotation.** `todo.md` notes this key "has been read aloud by tooling" while it
sat in the wrong file. Moving it does not un-leak it. **A human should decide
whether to rotate it at <https://platform.openai.com/api-keys>.** Only the owner
of that account can do this; it is not something an agent should do unasked.

No secret value appears in this file, and none was printed to a terminal — every
inspection of these files went through `sed -E 's/=.*/=<redacted>/'`.

---

## Choosing the model — three tiers, measured

The brief said "cheapest current model that can read a multi-page PDF and
**reliably** emit JSON of this shape". Reliability is the load-bearing word, and
it only shows up across repeated runs. All three tiers were run against the same
final prompt.

| Model          | Price/1M    | identity · medNames · medDetail · appointments · redFlags | sourceRefs                             | Verdict                               |
| -------------- | ----------- | --------------------------------------------------------- | -------------------------------------- | ------------------------------------- |
| `gpt-5.4-nano` | $0.20/$1.25 | 100% on every letter once the prompt was fixed            | **71% → 100%, run to run**             | rejected — not stable                 |
| `gpt-5.4-mini` | $0.75/$4.50 | 100% on every letter, every run                           | **one dropped quote in ~half of runs** | rejected — 94–98% fails a 100% family |
| `gpt-5.6-luna` | $1.00/$6.00 | 100%                                                      | **100%, four runs, four exits 0**      | **chosen**                            |

`gpt-5.4-nano` swung wildly on an unchanged prompt: whole-table-row quotes in one
run, correct cell-level quotes in the next. `gpt-5.4-mini` was genuinely close —
five of six families perfect on every run — but `sourceRefs` is scored at a 1.00
threshold over ~35 individual checks per letter, so a single bad quote drops the
cell to 97% and fails the family. It failed that way in roughly half its runs,
each time on a different letter. That is not a bar you can present.

`gpt-5.6-luna` costs 33% more than mini and about 5× nano. On measured usage
(Whitfield, two pages: 11,711 input tokens of which 10,839 were cache reads,
4,445 output of which 1,101 reasoning) that is roughly **$0.03–0.04 per letter
uncached** — about 20 pence for the whole five-letter corpus. Latency 15–35s per
letter.

`gpt-4.1-nano` ($0.10/$0.40) is cheaper still but is a previous-generation model;
given the 5.4 tiers already failed on instruction adherence, it was not evaluated.
Recorded as an untested option, not as a rejected one.

---

## Prompt iteration — what the harness taught, in order

The first real run scored **11 missed thresholds**. Every change below was made
in response to a printed miss line, and re-measured.

| Round | Missed | What the misses said, and what changed                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 11     | Baseline, `gpt-5.4-nano`, original prompt. `contacts[]` came back **empty on every letter**; appointments carried "6 weeks" where the letter's Date column said `~03/09/2026`; medication `dose` was null on Clarke; every medication quote was a whole table row.                                                                                                                                                                                                                |
| 2     | 5      | Added **THE FOLLOW-UP TABLE** (every non-`N/A` row of "Actions and Outstanding Investigations" is an appointment; `when.verbatim` is the Date cell copied, the Person Responsible cell becomes a contact), added **CONTACTS**, spelled out that `dose`/`route`/`schedule.verbatim` each hold one cell, and made the red-flag **ladder** rule require both rungs in `actionVerbatim`. identity/medNames/medDetail/redFlags hit 100% everywhere and never moved again.              |
| 3–6   | 4 → 1  | Everything left was source quotes. `pdftotext` without `-layout` — which the harness uses deliberately — linearises this form **column-major**, so a quote spanning a wrapped cell has the neighbouring column spliced into it. Rewrote SOURCE REFS as three rules: **ONE CELL**, **ONE LINE inside a box** (with the full-width prose paragraphs named as the explicit exception), **ONE PLACE** (never blend the "G.P. Actions" row with the advice paragraph that repeats it). |
| 7–8   | 1 → 0  | Two last worked examples: a short action still wraps (`"GP review in 2 weeks; no district nursing"` / `"input required."`), and the follow-up table's Person Responsible and Date cells are neighbours, never one quote. **First fully green run.**                                                                                                                                                                                                                               |
| 9–15  | —      | Stability runs on `gpt-5.4-mini`: green often, but one dropped quote in about half. Moved to `gpt-5.6-luna`.                                                                                                                                                                                                                                                                                                                                                                      |

One genuine hallucination was caught and fixed by the ONE PLACE rule: on
Whitfield the model emitted `"For GP: recheck U&E and CRP in 1 week; review
inhaler technique…"`, which reads perfectly and is a **splice of two different
sentences** — the G.P. Actions row says "Recheck U&E and CRP in 1 week; review
inhaler technique at next review" and the advice paragraph says "For GP: recheck
U&E/CRP in 1 week (AKI on CKD3a)". Neither line contains what it wrote. This is
precisely the failure `SourceRef` exists to make visible, and the harness found
it.

**Honesty about overfitting:** the prompt now names this specific NHS form's
layout — its boxes, its follow-up table, its "G.P. Actions" row — and one worked
example is lifted from Bradley's own letter. Two of the rules are general product
rules (a short quote is easier for a human to verify; never blend two passages);
the box-versus-prose rule is shaped by how `pdftotext` linearises _this_ form.
See Residual risk R3.

---

## Verdicts and evidence

### `make eval` — complete stdout, verbatim

Run against the exact shipped `lib/extraction/extract.ts`
(`shasum 4bd907a7433c74c043deb415463f7249982d52c1`), live mode, `:3001`:

```
$ cd /Users/haidertoha/Code/juno-hack-t1 && PORTICO_URL=http://localhost:3001 make eval
node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/eval-extraction.ts
Scoring 5 letters against http://localhost:3001

  [1] 01_Clarke_Emma_Cholecystitis … done
  [2] 02_Whitfield_Harold_Pneumonia … done
  [3] 03_Okafor_David_NSTEMI … done
  [4] 04_Sinclair_Margaret_NOF_Fracture … done
  [5] 05_Bradley_Susan_COPD … done

Removed 5 eval plan key(s) from Redis.

Family                                [1]         [2]         [3]         [4]         [5]
Patient identity                100% pass   100% pass   100% pass   100% pass   100% pass
Medication names (recall)       100% pass   100% pass   100% pass   100% pass   100% pass
Dose, frequency, route          100% pass   100% pass   100% pass   100% pass   100% pass
Appointments (recall)                none   100% pass   100% pass   100% pass   100% pass
Red-flag safety-netting         100% pass   100% pass   100% pass   100% pass   100% pass
Source refs resolve and quote   100% pass   100% pass   100% pass   100% pass   100% pass

01_Clarke_Emma_Cholecystitis — Appointments (recall)
    nothing to check — no gold action records a follow-up — hospital: the letter records no follow-up (date "N/A", responsible "N/A"); community_and_specialist_services: the letter records no follow-up (date "N/A", responsible "N/A")

Measured 5/5 letters and 29/30 family scores (1 had nothing in the gold letter to check, 0 individual check(s) skipped).
Note: 02_Whitfield's gold labels were used to author the seed, so its column is not independent.

All thresholds met.

$ echo $?
0
```

**Reading it honestly.**

- **29 of 30 cells scored, 29 of 29 at 100%.** Exit code 0.
- The one unscored cell is Clarke's appointments, and the harness says why: her
  gold letter records `N/A` in both follow-up rows. That is `nothing-to-check`,
  the harness's one non-verdict, and it is reachable only from an empty **gold**
  field — our own output being empty cannot produce it.
- **Column [2] is not an independent measurement.** The harness prints this
  itself: Whitfield's gold labels were used to author `lib/plan/samples/demo-plan.ts`.
  Four independent letters is what this actually demonstrates.
- Four consecutive fully-green runs on `gpt-5.6-luna` (two before the final
  comment-only edit, two after). Not one lucky run.

### Static checks

```
$ pnpm typecheck
$ tsc --noEmit
(no output, exit 0)

$ pnpm lint
$ eslint .
(no output, exit 0)

$ pnpm exec prettier --check lib/extraction/extract.ts lib/env.ts .env.example package.json
Checking formatting...
All matched files use Prettier code style!
```

**`pnpm format:check` over the whole tree FAILS — and it failed before I
started.** 25 files, **none of them mine**:

```
$ pnpm format:check
Checking formatting...
[warn] app/(phone)/check-in/summary/page.tsx
[warn] app/(phone)/family/page.tsx
[warn] app/(phone)/page.tsx
[warn] app/apple-icon.tsx
[warn] app/icon.tsx
[warn] app/operator/page.tsx
[warn] brand/logo-candidates/a-line-art.json
[warn] brand/logo-candidates/b-editorial.json
[warn] brand/logo-candidates/c-thin.json
[warn] brand/logo-candidates/d-bold.json
[warn] brand/logo-candidates/e-pi.json
[warn] brand/logo-candidates/f-door.json
[warn] brand/logo-candidates/g-three.json
[warn] brand/logo-candidates/h-info.json
[warn] brand/logo-candidates/w1-sans.json
[warn] brand/logo-candidates/w2-line.json
[warn] brand/logo-candidates/w3-thin.json
[warn] brand/logo-candidates/w4-invert.json
[warn] components/family/escalation-card.tsx
[warn] components/letter/letter-viewer.tsx
[warn] components/plan/timeline.tsx
[warn] components/upload/upload-status.tsx
[warn] DEMO.md
[warn] public/pdf.worker.min.mjs
[warn] README.md
[warn] Code style issues found in 25 files. Run Prettier with --write to fix.
```

Reproduced at `2185ca6` (the commit both checkouts sit on) with a clean tree. I
ran `pnpm format` once, saw it
rewrite all 25, and **reverted every one of them with `git checkout --`** — they
belong to other tracks who are editing those exact files right now, and the
`brand/*.json` and `public/pdf.worker.min.mjs` entries suggest `.prettierignore`
is missing entries rather than that anyone wrote bad code. Whoever owns CI should
decide; the fix is one `pnpm format` at a moment when nobody else is mid-edit.

### The live path, proven end to end

- `POST /api/seed` → **403** on `:3001`, i.e. genuinely live mode, not demo. Run
  before trusting any eval number.
- `POST /api/extract` → **200** with a real body, e.g.
  `{"patientId":"…","mode":"live","modelId":"gpt-5.6-luna","medications":7,"redFlags":1,"unresolved":11}`.
- **104 real extractions** across the session, 99 of them 200s. **D9 rule 3 is
  closed**: a successful live extraction has now been demonstrated, repeatedly,
  and measured.

---

## Residual risk

### R1 — 🔴 Vercel Blob intermittently times out on the first request, and it is a bare 500

Five times across **104 extractions** (99 × 200, 5 × 500), `readBytes` failed
with `UND_ERR_CONNECT_TIMEOUT` connecting to
`…private.blob.vercel-storage.com:443` (undici's 10s connect timeout), and the
harness reported
`HTTP 500 — (no response body; check the dev server log)`. Always the **first**
request of a run, never a later one — a cold DNS/TLS handshake, not our code, and
not the model.

I did not paper over it: a retry in `readBytes` would be exactly the defensive
programming `CLAUDE.md` forbids, and the loud failure is correct behaviour. But
it means **a filmed live upload can fail on the first try for reasons nothing on
screen explains.** If live extraction is demoed, warm the path with one throwaway
upload first.

### R2 — 🔴 The task files still say "AI Gateway", and the code no longer does

`tasks/plan.md` L9, `tasks/plan.md` §"Next extraction work", `tasks/todo.md` A6
and `tasks/todo.md` §"Env file contract" all describe the target as
`AI_GATEWAY_API_KEY` → Gateway → OpenAI, and A6.5 still says the harness "is not
the accepted green gate". All four are now stale: the call is direct, the key is
`OPENAI_API_KEY`, and the gate is green. **I did not edit them** — three other
agents are working in those files tonight and a merge conflict in `todo.md` at
2am helps nobody. Someone should reconcile them before anyone reads them as
current.

### R3 — 🟡 The prompt is tuned to one hospital's form

`SYSTEM_PROMPT` now names this form's structure directly — its boxed columns, its
"Actions and Outstanding Investigations" table, its "G.P. Actions" row — and two
worked examples are lifted verbatim from corpus letters (Bradley's action cell,
Sinclair's consultant). All five fixtures are the same template. **A discharge
letter from a different trust has never been through this path**, and the
box-versus-prose quoting rule in particular is shaped by how `pdftotext`
linearises _this_ layout. Expect quality to drop on a genuinely different form,
and re-run `make eval` before claiming otherwise.

### R4 — 🟡 `sourceRefs` is one bad quote away from failing, by design

The family is scored at a 1.00 threshold over ~35 checks per letter. `gpt-5.6-luna`
held it four runs running; `gpt-5.4-mini` did not. Nothing guarantees the fifth
run. If a future change makes quotes longer — a prompt edit, a model bump, a new
fixture — this is the family that will move first, and it will move to FAIL, not
to 97%-and-a-shrug. That is the harness working as intended, not a flaw.

### R5 — 🟡 The camera path is still untested

The corpus is five text-layer PDFs. `make eval` uploads them as
`application/pdf`. **A photograph of a letter has never been extracted.** The
upload control accepts `image/*` and the AI SDK maps images to `input_image`
fine, but nobody has measured what the model does with a phone photo at an angle
under ward lighting. A presenter must not claim the camera path works.

### R6 — 🟡 Cost and latency are real now

15–35s per two-page letter, ~$0.03–0.04 uncached. Fine for a demo, and it is
exactly why `plan.md` chose demo mode for the filmed take ("a 5–15s round-trip
does not fit in a 60s video"). That reasoning still stands — it is now backed by
a measurement rather than an estimate, and the measurement is worse than the
estimate.

### R7 — 🟢 Whitfield's column still is not independent

Unchanged from before, and the harness prints it on every run. Column [2]'s gold
labels authored the seed bundle. **Four letters, not five, are independent
evidence.** Do not quote "5/5 letters, 100%" without that sentence attached.

### R8 — 🟢 `@ai-sdk/anthropic` is gone from the lockfile

If any other track adds an Anthropic call tonight, `pnpm install` will be needed
again. Nothing imports it today (`grep` confirms), and `DEMO.md:153` mentions
`ANTHROPIC_API_KEY` in passing — a stale line in another track's file, harmless,
but worth knowing it exists.

---

## Files to copy back into `/Users/haidertoha/Code/juno-hack`

From `/Users/haidertoha/Code/juno-hack-t1`, exactly these five:

| File                        | Why                                                               |
| --------------------------- | ----------------------------------------------------------------- |
| `lib/extraction/extract.ts` | The whole change: provider, strict schema, error surfaces, prompt |
| `lib/env.ts`                | `llmEnv()` → `openAiEnv()`. Nothing else in the file moved        |
| `package.json`              | `@ai-sdk/anthropic` → `@ai-sdk/openai`                            |
| `pnpm-lock.yaml`            | Must travel with `package.json` — copy both or neither            |
| `.env.example`              | OpenAI block, Anthropic block removed, demo comment corrected     |

**Then, in the primary checkout:**

1. `pnpm install` — the lockfile changed.
2. Apply the `.env` edit from "What changed" above: delete the one
   `OPENAI_API_KEY=` line from `.env`. `.env.local` already has it; do not touch
   that key.
3. `pnpm typecheck && pnpm lint` before anything ships.

**Do not copy** `.env` or `.env.local` — they are gitignored, machine-local, and
the worktree's copies carry the same secrets in a different arrangement. Apply the
edit by hand instead.

Nothing else in the worktree was modified: `git status` there shows exactly these
five files and nothing untracked.
