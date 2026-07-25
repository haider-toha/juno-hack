# 08 — Track B stress test: holes, contradictions and silent-degradation paths

**Date:** 2026-07-25 · **Scope:** Track B only (voice → tools → escalation →
family dashboard → EN/FR i18n), tasks **B1–B14** plus the Phase 0 tasks Track B
depends on (**0.1**, **0.5**, **0.6**).

**Premise:** `06-phase-1-readiness.md` changed Track B's inputs. The Portico agent
now exists, D8 as written is impossible, `asr.keywords` is available,
`client_events` is patched, override failure is a WebSocket close and not a
throw, and the voice id was dead and is now French-verified. This file propagates
those consequences into the task list and looks for what else moved with them.

**No secret value appears in this file.** Secrets are named, never printed.
**Nothing was changed on the ElevenLabs platform and no credit-consuming API call
was made.** SDK claims are read from `node_modules`; platform claims are read
from the public docs and cited by URL.

**Output constraint honoured:** this file is the only thing written.
`tasks/plan.md` and `tasks/todo.md` are **not** edited — every fix below is a
quoted patch for a later phase to apply.

---

## Scope

| In                                                                                                                                         | Out                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Tasks B1–B14 and their acceptance criteria                                                                                                 | Track A tasks (A1–A11) except where they are a seam     |
| Phase 0 tasks 0.1, 0.5, 0.6 (Track B blocks on all three)                                                                                  | Task 0.2 / 0.3 / 0.4 (Track A / shared infra)           |
| `tasks/plan.md`, `tasks/todo.md`, `plan/spec.md` wording                                                                                   | Re-verifying anything settled in `06`                   |
| The five files Track B edits: `voice-session.tsx`, `language-picker.tsx`, `check-in-prompt.ts`, `check-in/page.tsx`, `signed-url/route.ts` | The clinical schema (`01`), drug lookup (`03`)          |
| ElevenLabs server-tool / client-tool / dynamic-variable / secret shapes, from live docs                                                    | Anything requiring a live agent mutation or an ear-test |

28 holes found: **6 blockers**, **17 should-fix**, **5 nice-to-have**.

---

## Verdicts & evidence

### 1. French / TTS-model consistency

#### 🔴 H1 — "pin `eleven_flash_v2_5`" is impossible, and it appears in 18 places

**What the plan says now.** Eighteen occurrences across three files:

- `tasks/plan.md:45`, `:73`, `:135`, `:373`, `:452`, `:506`
- `tasks/todo.md:30`, `:37`, `:59`, `:76`, `:140`, `:161`, `:197`, `:210`
- `plan/spec.md:133`, `:291`, `:319`, `:431`

**Why it is wrong.** `06 §4`: `POST /v1/convai/agents/create` with
`agent.language = "en"` and `tts.model_id = "eleven_flash_v2_5"` returns
**HTTP 400 — "English Agents must use turbo or flash v2"**, and adding
`language_presets.fr` does **not** unlock it. As built (`06 §2`): base `en` →
`eleven_flash_v2`; `language_presets.fr.overrides.tts.model_id` →
`eleven_flash_v2_5`.

**The dangerous instance is `tasks/plan.md:452`**, Task B11 step 1:

> 1. Confirm `tts.model_id` is still `eleven_flash_v2_5` after any dashboard
>    edits.

Run against the correctly-built agent, this reads back `eleven_flash_v2`, which
the task tells the operator to treat as **drift** and fix. The two available
"fixes" are (a) set the base to `eleven_flash_v2_5` and get a 400, or (b) set it
to `eleven_multilingual_v2`, which the API **accepts** (`06 §4` probe matrix) and
which silently drops both locales off Flash-tier latency with no error anywhere.
Option (b) is precisely the D9 failure class B11 exists to prevent, produced by
B11 itself. This is why it is ranked blocker rather than a wording nit.

#### 🔴 H2 — Track B has no landing zone for the two-agent contingency

**What the plan says now.** `tasks/plan.md:372-374` (Task B3.5):

> Verify: English session first (regression), then French ear-test on the pinned
> Flash v2.5 agent. If French audio is wrong, **stop** — do not downgrade to
> English voice under French UI [Locked D9].

**Why it is incomplete.** `06 §7 R1` is the project's **highest** residual risk
and is explicitly not machine-verifiable: whether a per-session
`overrides.agent.language: "fr"` activates `language_presets.fr`. `06 §4` and
`§8` both name the remedy — **Option 2, two agents, one per locale**, with
`/api/eleven/signed-url` taking a `locale` param. "Stop" is a correct instinct
and an incomplete instruction: the plan tells the builder to halt at the exact
moment it stops giving directions.

Option 2 is not a config change, it is a code change nobody has costed:

| File                                 | Line               | Current                                                                  | Needed for Option 2                                                                                                                      |
| ------------------------------------ | ------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/env.ts`                         | `:8`               | `NEXT_PUBLIC_AGENT_ID: z.string().min(1)` — one id                       | two ids in the schema, both on Vercel × 3 environments                                                                                   |
| `app/api/eleven/signed-url/route.ts` | `:12-22`           | `GET()` with no params, `env.NEXT_PUBLIC_AGENT_ID` interpolated at `:15` | validated `locale` search param (Zod belongs here — it is a route handler) selecting the id                                              |
| `components/voice/voice-session.tsx` | `:216`, `:414-419` | `fetchSignedUrl()` takes no argument                                     | `fetchSignedUrl(locale)`, still inside the tap                                                                                           |
| ElevenLabs platform                  | —                  | one agent                                                                | five override toggles, `client_events`, and later both server tools mirrored onto a second agent (`06 §4` names this as Option 2's cost) |

Verified constraint that forces the agent-id switch: `GET
/v1/convai/conversation/get-signed-url` accepts only `agent_id`,
`include_conversation_id`, `branch_id` and `environment` — there is **no**
server-side slot for overrides or conversation-initiation data
([API reference](https://elevenlabs.io/docs/api-reference/conversations/get-signed-url)).
Locale selection therefore cannot happen anywhere except the agent id.

#### 🟡 H3 — B11's ear-test sits in Phase 3; the decision it gates is due at Checkpoint 1

`tasks/plan.md:450-459` places B11 in Phase 3. But `06 §7 R1` says "Human
ear-test **before Checkpoint 1**", and B3.5 (Phase 1, `tasks/plan.md:372`)
already instructs a French ear-test. So the test is duplicated, and the copy that
can still change the architecture cheaply is the one scheduled last.

If Option 2 turns out to be required and it is discovered in Phase 3, the rework
lands on `voice-session.tsx` **after** B6, B7 and B12 have layered onto it — the
same file the plan's own risk table flags as the merge-conflict hotspot
(`tasks/plan.md:507`).

#### 🟡 H4 — the French UI strings that no Track B task names

`tasks/plan.md:337-339` (B1 acceptance) points at
`04 §Why the zero-dependency option wins`, which enumerates the surface by **file
count** ("`voice/orb.tsx` (5)", "`voice/voice-session.tsx` (7)"), not by string.
That is not a checkable acceptance criterion, and these are exactly the
"conditional or rarely used" strings that
`04 §How the six showcase-only languages degrade` quotes Bilingual Technology
Toolkit **5.1** as forbidding in the alternate language.

Live English strings on Track B's own screens today:

| File:line                                                                        | String                                                                                                                       | Note                                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `components/voice/orb.tsx:113-121`                                               | `Connecting…` / `Connection error` / `Not connected` / `Speaking` / `Listening`                                              | announced by `aria-live="polite"` at `orb.tsx:87` and `:101` |
| `components/voice/voice-session.tsx:315-319`                                     | `Connecting…` / `Getting ready…` / `Starting…`                                                                               |                                                              |
| `voice-session.tsx:417`                                                          | `"Could not start the conversation. Please try again."`                                                                      | also breaks `04 §A.16` / S20 — "please" is banned            |
| `voice-session.tsx:423`, `:426`                                                  | `"Microphone access was blocked…"`, `"Something went wrong starting the conversation."`                                      |                                                              |
| `voice-session.tsx:291`, `:394`, `:403`                                          | `aria-label="Menu"`, `Start talking`, `Type instead`                                                                         |                                                              |
| `components/voice/composer.tsx:55-56`, `:66`, `:81`                              | `Ask anything` (placeholder + `aria-label`), `Voice input` / `Send`, `End conversation`                                      |                                                              |
| `components/voice/suggested-questions.tsx:19`                                    | `Suggested questions`                                                                                                        |                                                              |
| `components/language-picker.tsx:196-197`, `:209`, `:223`, `:236`, `:272`, `:321` | `Search languages` ×2, `No languages match "…"`, `Default`, `See more languages`, `Language`, `aria-label="Change language"` |                                                              |
| `app/(phone)/check-in/page.tsx:4`                                                | `metadata = { title: "Check in" }`                                                                                           | `%s · Portico` template at `app/layout.tsx:34`               |
| `app/layout.tsx:32-47`                                                           | title, description, OG title/description                                                                                     |                                                              |

#### 🟡 H5 — `LanguagePicker` hard-codes the current language as "English"

`components/language-picker.tsx:276`:

```tsx
<span className="text-base text-ink-muted">English</span>
```

B2's fix list (`tasks/plan.md:342-348`) covers flags, active-locale filtering,
the "Default" badge, ≥44px rows and placement — not this. Under `fr` the home row
would read "Language / English" beside French copy: two languages on one screen,
the 5.1 violation D9 rule 2 exists to prevent.

#### 🟡 H6 — "See more languages" is a dead affordance

`components/language-picker.tsx:231-238` renders a button whose only handler is
`onClose`. B2 does not mention it. `CLAUDE.md` ("Every line justifies itself…
Delete rather than keep") and D9 ("one explicit path") both say delete, not
leave a button that lies about what exists.

#### 🟡 H7 — the showcase panel needs `latin-ext`, and Task 0.5 explicitly forbids it

**What the plan says now.** `tasks/plan.md:177-178`:

> French uses the existing `latin` subset; no Welsh `latin-ext` work.

and `tasks/todo.md:71`: "`app/layout.tsx` — make `<html lang>` dynamic (no Welsh
`latin-ext`)".

**Why it is wrong.** B2 (`tasks/plan.md:349-352`) requires an **in-language**
"not yet" panel for the six showcase locales, which include `cy`, `pl`, `ro` and
`tr`. `04 §Font subsets – a real, verified bug` verified against the live Google
Fonts CSS that 13 Welsh characters — `ŵ Ŵ ŷ Ŷ ẃ Ẃ ẁ Ẁ ỳ Ỳ ẅ Ẅ Ÿ` — fall **outside**
the `latin` unicode-range and inside `latin-ext`. The same applies to Polish
`ł ą ę ż ź ć ń ś`, Romanian `ș ț ă`, Turkish `ğ ı ş İ`. `app/layout.tsx:7` and
`:16` both load `subsets: ["latin"]`.

So the panel whose entire job is "we take your language seriously" renders
mid-word fallback glyphs in four of its six languages. The two statements are
only compatible if there is no in-language showcase panel — which contradicts D4,
D9 rule 2 and B2.

---

### 2. Portico persona integrity

#### 🟢 H8 — runtime is clean; three stale strings sit outside it

`app/`, `components/` and `lib/` contain **zero** occurrences of "Juno". `06 §2`
confirms the agent config contains none either, and that the workspace had no
prior agent to confuse it with. Remaining:

- `package.json:2` — `"name": "juno"`. Cosmetic, but it is what `pnpm` prints.
- `README.md:70-75` — the override paragraph, wrong for a different reason (H12).
- `audit/juno-recovery-companion/01|02|03-*.md` — full of "Juno". This is
  **legacy research and must not be rewritten**: those files are the provenance
  for decisions D4/D6/D8 and a `sed` pass over them destroys the citation trail
  that `plan/spec.md` and `tasks/plan.md` depend on. Worth stating out loud so
  nobody "tidies" it.

#### 🟡 H9 — three places still let Welsh read as a real locale

D4 makes `cy` showcase-only and `REAL_LOCALES = ["en","fr"]` at
`tasks/plan.md:330` is correct. But:

1. `tasks/plan.md:178` / `tasks/todo.md:71` — "no Welsh `latin-ext`" implies
   Welsh needs _nothing_. See H7: the showcase panel needs the subset.
2. `components/language-picker.tsx:8-10`, the file B2 edits, still says:

   > Hardcoded language list — presentation-only in this build. **English +
   > Cymraeg are real**; the rest signal multilingual reach for the demo.

   Factually wrong under D4, and sitting in the file as an instruction.

3. `components/language-picker.tsx:12-19` orders the list `en, cy, pl, ro, tr,
pt, es, fr` — the one real second locale is **last**, below six that do not
   work. B2 should reorder real locales first.

---

### 3. Agent / tool / webhook seams

#### 🔴 H10 — the `secret__` header token cannot be a secret; it is browser-supplied by construction

**What the plan says now.** `tasks/plan.md:383-385` (B4), echoed at
`tasks/todo.md:144`:

> Bind `patient_id` and `check_in_id` as **dynamic variables** (never
> model-filled), authenticate with a `secret__`-prefixed header variable.

**Why it is wrong.** Dynamic variables reach a session through exactly one
channel in this architecture, and it is the **browser**. Verified in the pinned
SDK,
`node_modules/.pnpm/@elevenlabs+client@1.15.2_*/node_modules/@elevenlabs/client/dist/utils/overrides.js`:

```js
if (config.dynamicVariables) {
  overridesEvent.dynamic_variables = config.dynamicVariables;
}
```

`config` here is the client's `startSession` argument; the result is sent as
`conversation_initiation_client_data` over the WebSocket the browser opened. And
the server-side alternative does not exist: `GET
/v1/convai/conversation/get-signed-url` accepts only `agent_id`,
`include_conversation_id`, `branch_id`, `environment`
([API reference](https://elevenlabs.io/docs/api-reference/conversations/get-signed-url)).

So a `secret__portico_tool_token` would have to be shipped to the browser and
would be readable in the network tab of the demo device. `/api/log` and
`/api/escalate` would be forgeable by anyone who opened devtools. The `secret__`
prefix stops the value reaching the **LLM provider** — that is all it claims:

> "should only be used in dynamic variable headers and never sent to an LLM
> provider as part of an agent's system prompt or first message"
> — [Dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)

It says nothing about the client, because in the server-initiated flows it was
designed for there is no client.

**The correct shape**, from
[`POST /v1/convai/tools`](https://elevenlabs.io/docs/api-reference/tools/create):
`api_schema.request_headers` accepts four reference types — a static string,
`{"secret_id": "…"}` (workspace secret), `{"variable_name": "…"}` (dynamic
variable) and `{"env_var_label": "…"}` (workspace environment variable). The
first, third and fourth resolve **on ElevenLabs' side**; only the third involves
the browser. Use a workspace secret or a workspace environment variable
([Environment variables](https://elevenlabs.io/docs/eleven-agents/integrate/environment-variables)),
and hold the matching value server-side in a new `toolEnv()` beside `serverEnv()`
in `lib/env.ts` — per `CLAUDE.md`, "Every new secret goes into its own
`xxxEnv()`".

#### 🟡 H11 — "never model-filled" is right about the LLM and silent about the client

Same evidence as H10. Binding `patient_id` / `check_in_id` to dynamic variables
stops the model **hallucinating or transposing** them, which is the real and
worthwhile win `02 §(a)` claims. It does not make them trustworthy identity,
because the client supplies them.

Practical consequence for a one-patient demo: `patient_id` should be
`constant_value` in the tool's `request_body_schema` rather than a dynamic
variable at all — one of the five mutually-exclusive property fields confirmed at
[`POST /v1/convai/tools`](https://elevenlabs.io/docs/api-reference/tools/create):
`description` (LLM supplies), `dynamic_variable`, `constant_value`,
`is_system_provided`, `is_omitted`. That removes a client-controlled input
entirely. `check_in_id` still wants to be a dynamic variable, for the idempotency
reason `02 §(a)` gives.

Either way `/api/log` and `/api/escalate` Zod-parse the body at the boundary
(already `CLAUDE.md` law) **and** check the header from H10 before trusting any
identifier in it.

#### 🔴 H12 — Task 0.6 instructs the builder to write the wrong correction

**What the plan says now.** `tasks/plan.md:182-189`:

> **Task 0.6: Correct the override-failure documentation — loud is correct.**
> `README.md` and the comment in `components/voice/voice-session.tsx` both claim
> a disallowed override is silently ignored. The docs say it **throws**. Fix
> both. Do not add catch-and-continue around that throw [Locked D9].
>
> - Verify: text now says overrides throw when disabled

**Why it is wrong.** `06 §6` Test C settled it live: the WebSocket closes
**1008**, reason `"Override for field 'llm' is not allowed by config."`, **after**
`conversation_initiation_metadata`. It is not a synchronous throw. The
`try/catch` at `voice-session.tsx:213-233` cannot see it; it arrives through
`onError` at `voice-session.tsx:150`.

Two concrete harms in the current wording. First, "do not add catch-and-continue
around that throw" points code review at a `catch` block that will never receive
the failure, while the block that _does_ receive it — `onError: (message) =>
setError(message)` — is unguarded by any stated rule. Second, a builder who tests
the correction by wrapping `startSession` and seeing nothing thrown will conclude
the docs (and this instruction) are wrong, and may "simplify" `onError` in the
process.

The invariant actually worth protecting: **`onError` must keep rendering into the
visible `role="alert"` banner at `voice-session.tsx:304-311` and must never be
downgraded to a `console.error` or a swallowed no-op.**

#### 🟡 H13 — B7's prerequisite is already met; as written it invites a redundant agent edit, and B6's prerequisite is unnamed

**What the plan says now.** `tasks/plan.md:415-418`:

> **Prerequisite, must be set on the agent (not per-session):**
> `agent_tool_request` / `agent_tool_response` in
> `conversation_config.conversation.client_events`.

**Why it needs rewording.** `06 §5` already patched `client_events` to the full
set, and recorded that the platform default **omitted** `agent_chat_response_part`
— which `voice-session.tsx:116` depends on and without which the audio-paced
transcript reveal (`CLAUDE.md`: "that's the whole effect") renders nothing, with
no error anywhere.

Two consequences the plan misses:

1. B7 should be a **readback verification**, not a config edit. `06 §4` notes
   both model pins were re-verified specifically because the `client_events`
   PATCH could have moved them. Every unnecessary PATCH is another chance for the
   D8 pins to drift.
2. **B6 has an unstated prerequisite.** `client_tool_call` must be in
   `client_events` for `show_red_flag` to fire, and it is present today only as a
   side effect of the same `06 §5` patch. `tasks/plan.md:404-410` does not
   mention it. If anyone recreates the agent, B6 breaks **silently** — the client
   tool simply never fires and nothing reports it.

Also worth stating positively, because someone will look for it: `06 §5`
established that **`audio_alignment` is not a valid `client_events` value** —
alignment rides with `audio`, so `onAudioAlignment` needs no toggle. Nothing in
`tasks/` currently implies one exists, which is correct; say so explicitly so a
future reader does not "fix" the absence.

#### 🟡 H14 — the localhost trap has no decision artifact, and the tool-tuning fields are absent entirely

`tasks/plan.md:389-392` says "Decide a stable deployed alias early and point the
agent's tool config at it once" but produces no artifact recording what was
decided, so the agent config and the repo can drift with nothing to compare.

Absent from B4 and B5 entirely, all confirmed at
[`POST /v1/convai/tools`](https://elevenlabs.io/docs/api-reference/tools/create):

| Field                                 | Default             | Why it matters on stage                                                                                |
| ------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| `api_schema.method`                   | **`GET`**           | the plan does say "explicitly POST" — keep that, it is correct                                         |
| `response_timeout_secs`               | **20**, range 5–120 | the agent is **silent** for the whole wait                                                             |
| `pre_tool_speech` / `tool_call_sound` | unset               | the only fix for that silence (`02 §Practical webhook constraints`)                                    |
| `tool_error_handling_mode`            | **`auto`**          | `02` recommends `summarized` or `hide`; `auto` risks an error string being narrated over the projector |

Also unrecorded anywhere in `tasks/`: the agent's LLM (`gemini-2.5-flash`),
`temperature` `0.2`, `turn_eagerness: patient`, `turn_timeout: 10s` — all chosen
by Phase 1 (`06 §2`, and R3 flags the LLM as a human confirmation). If the agent
is ever recreated, none of it is reproducible from the task list. `02 §What the
two-way-chat framing changes` also recommends `disable_first_message_interruptions`
so the "I'm not a clinician" line always completes; that appears nowhere.

#### 🟡 H15 — B6 is missing the failure mode most likely to appear on the projector

`tasks/plan.md:404-410` covers "never throws internally" and "do not supply
`onUnhandledClientToolCall`". Both correct. `02 §Failure modes mid-demo` —
verified from `@elevenlabs/client@1.15.2/dist/BaseConversation.js:171-211` —
adds a third the plan omits: **a tool name present in the agent config but not
registered in the browser (or misspelled either side) fires
`onError("Client tool with name X is not defined on client")`**, which
`voice-session.tsx:150` routes straight to the red `role="alert"` banner over the
transcript while the agent keeps talking.

"Register the tool name exactly matching the agent config (case-sensitive)"
(`tasks/plan.md:409`) is a hope, not a check. The acceptance criterion should be
a round-trip: read the tool names back off the agent and assert them against the
string literal in the code.

Reachability confirmed against the pinned SDK, so nobody upgrades mid-build to
"get" these: `useConversationClientTool` is exported by the installed
`@elevenlabs/react@1.10.2` (`dist/index.d.ts` line 12), and
`onAgentToolRequest`, `onAgentToolResponse`, `onAudioAlignment` and
`onUnhandledClientToolCall` are all in `HookCallbacks`
(`dist/conversation/types.d.ts:5`).

#### 🟢 H16 — `environment` on get-signed-url is the clean answer to preview-URL churn

`GET /v1/convai/conversation/get-signed-url` accepts an `environment` parameter
(defaults `production`), and workspace environment variables resolve per
environment, referenced in tool URLs as `{{system__env_<label>}}`
([Environment variables](https://elevenlabs.io/docs/eleven-agents/integrate/environment-variables)).
So a single tool config can point at a staging host and a production host without
re-editing the agent. Not needed for the demo — the stable alias in B4 is the
24-hour answer — but record it as the answer to "what if we need a second
target", because it is otherwise a 2am discovery.

---

### 4. D7 / D8 / D9 violations and forced silent degradation

#### 🔴 H17 — D7's dual render has no Track B task, and Track B owns its French half

**What the plan says now.** D7 (`00 §D7`) and `plan/spec.md:381-386` require: in
French mode a red-flag card shows the French translation **and** the doctor's
exact English words, English labelled as the original. The schema slot is Task
0.2 (shared). The card is Task **A9** (`tasks/plan.md:295-303`, Track A).

**The gap.** The **French label string** ("exact words from your letter" →
authored French) lives in Track B's dictionary. B1's acceptance criterion
(`tasks/plan.md:337-339`) is "all ~55 strings enumerated in `[04 §Why the
zero-dependency option wins]` plus the persona content" — that enumeration
predates D7 and contains no red-flag labels. Nothing in B1, B2 or B3 mentions
them.

Consequence: A9 lands in Phase 3 with no authored French label. The two likely
improvisations are both banned — an English label on a French card (Bilingual
Technology Toolkit 5.1, two languages on one screen, D9 rule 2), or a machine
translation (D7: "author `en` and `fr` copy by hand"; `plan/spec.md:294`: "Ship a
machine-translated French first message or system prompt" is in the Never list).

Two related items, also unassigned:

- **WCAG 3.1.2 Language of Parts.** `04 §C.26`: the verbatim English block inside
  a French page needs `lang="en"` on its wrapper. No task says so.
- **`translate="no"`.** `04 §C.26` asks for it on "Portico", "NHS", "111", "999"
  and medication names so browser auto-translate does not garble a phone number
  or a drug name. The string `translate` appears **nowhere** in `tasks/`,
  `plan/spec.md`, or the codebase.

#### 🟡 H18 — B3's suggested-questions fix is under-specified, and the composer breaks the same rule

`lib/check-in-prompt.ts:18-23` ships four questions. `tasks/plan.md:361-363`
correctly flags `"Is this normal after surgery?"` as generic clinical Q&A. What
it does not say: `00 §Standing constraints` **cut** "open-web 'ask anything' Q&A"
and "AI symptom-checker / triage", so the replacement must be plan-grounded **by
construction** (drawn from the plan slice already in the prompt), not by prompt
discipline alone — a prompt rule is exactly the kind of soft guard D9 rejects.

And `components/voice/composer.tsx:55-56` sets both placeholder and `aria-label`
to literally **"Ask anything"** — the phrase for the feature that was cut, on the
one input a judge will look at. The plan patches the questions and not the input.

#### 🟡 H19 — B12 names a wire type, not the toggle, and the toggle is already on

`tasks/plan.md:463-465`:

> `overrides.asr.keywords` seeded from the plan's actual drug names plus
> French/English yes-no tokens (needs Security toggle
> `ASRConversationalConfigOverrideConfig.keywords`).

`ASRConversationalConfigOverrideConfig` is a generated wire type, not something
anyone can toggle. The agent's readback field is `overrides.asr.keywords`, and
`06 §2` records it **enabled and verified**, plus the finding that the public
overrides doc omits it — which is why B12 was previously considered at risk. B12
is unblocked and the task should say so.

One SDK detail worth carrying into the task: `constructOverrides` emits the `asr`
block **only when `keywords !== undefined`** (`overrides.js`), so omitting the
key and sending an empty array are different wire messages.

#### 🟡 H20 — the per-session `firstMessage` supersedes the agent's authored French preset

`06 §2` records `language_presets.fr.overrides.agent.first_message` as authored
French. `voice-session.tsx:226` sends `firstMessage` on **every** session and
`constructOverrides` maps it to `agent.first_message`, so the preset's French
opener never plays. That is fine and intended — but it means there are two
sources of truth for the French opener and the plan documents neither as
authoritative.

The failure mode this creates: if B3.5 (`language: "fr"`) lands before B3
(authored French `firstMessage`), the session runs French language with an
English opening line — French UI, English voice, no error. The plan sequences
B3 → B3.5, which is right; it should say **why**.

#### 🟢 H21 — B10's proposed card copy contains an em-dash

`tasks/plan.md:437`: `"Portico — your check-in"` (U+2014). `04 §S18` resolves the
two design skills' conflict as: prefer a full stop, never U+2014. This is UI copy
being specified, not doc prose, so the rule applies.

---

### 5. AI-slop UI risk in voice / family / i18n screens

#### 🔴 H22 — no Track B screen task carries the phone-shell height rule

Track A's A4 does (`tasks/plan.md:235`): "renders … inside the phone frame (no
`dvh`/`vh`, fills with `flex min-h-0 flex-1 flex-col`)". Track B's three new
surfaces do not: **B8** `/family` (`tasks/plan.md:420-425`), **B10** the
notification card (`:435-442`), and **B2**'s showcase panel (`:349-352`).

`04 §S10` calls this "the single most dangerous skill/project conflict in the
set", and it is: `/design-taste-frontend §3.E` says, in capitals, "NEVER use
`h-screen` … ALWAYS use `min-h-[100dvh]`". `app/(phone)/layout.tsx:20` sets
`h-dvh` on the frame and `:104` gives the content region `flex min-h-0 flex-1
flex-col overflow-y-auto`. A child `min-h-dvh` resolves to the whole browser
window and pushes content through the bezel — on the projector, at `lg`, in front
of judges. A builder following the design skill produces this bug by obedience.

#### 🟡 H23 — `prefers-reduced-motion` is Phase 3, and B10 adds a fresh violation before it lands

Verified: the string `prefers-reduced-motion` appears **nowhere** in `app/` or
`components/`. Live infinite loops today:

- `components/voice/orb.tsx:25`, `:26`, `:38`, `:39` — `animate-pulse` on the
  sphere blobs and the glow
- `components/voice/orb.tsx:82` — six pulsing listening dots
- `components/voice/transcript.tsx:37`, `:60` — the live caret and three thinking
  dots

`04 §C.33` grounds this in WCAG **2.2.2 Pause, Stop, Hide (Level A)** — the orb
"starts automatically, lasts more than 5 seconds, and is presented in parallel
with other content" — for an audience of recovering elderly patients. B13
(`tasks/plan.md:471-476`) fixes it in Phase 3, but **B10 adds another always-on
orb** (the notification card) in Phase 2. The `globals.css` block is about ten
lines; moving it to Phase 1 removes the window in which B10 can ship a new
violation.

#### 🟡 H24 — "standardise `focus-visible`" has no named target, so it is unverifiable

`tasks/plan.md:474-475` says "Standardise `focus-visible` treatment across every
interactive element — several currently have none." Current state, verified:

| Element               | File:line                                     | Focus treatment                                                                       |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Home action cards     | `app/(phone)/page.tsx:41`                     | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |
| Language row trigger  | `components/language-picker.tsx:265`          | same as above                                                                         |
| Suggested question    | `components/voice/suggested-questions.tsx:27` | `focus-visible:border-accent` only — a 1px colour change                              |
| Menu link             | `components/voice/voice-session.tsx:292`      | none                                                                                  |
| `LanguageGlobe`       | `components/language-picker.tsx:324`          | none                                                                                  |
| Composer submit / end | `components/voice/composer.tsx:66`, `:82`     | none                                                                                  |
| Composer input        | `components/voice/composer.tsx:57`            | `outline-none`, no replacement                                                        |
| Language search input | `components/language-picker.tsx:202`          | `outline-none`, no replacement                                                        |

`04 §C.32` cites SC 2.4.7 (AA), 2.4.11 (AA, new in 2.2) and 2.4.13 (AAA). Name
the winning treatment in the task or "standardise" cannot be reviewed.

#### 🟡 H25 — sub-44px targets sit in Track B's own files and only some are assigned

From `04 §C.27`, re-verified against current source:

| Control                 | File:line                 | Size                            | Assigned?              |
| ----------------------- | ------------------------- | ------------------------------- | ---------------------- |
| `LanguageGlobe` trigger | `language-picker.tsx:324` | `size-10` = 40px                | B2                     |
| Language menu rows      | `language-picker.tsx:218` | `px-3 py-2` on `text-sm` ≈ 36px | B2                     |
| "See more languages"    | `language-picker.tsx:234` | ≈ 36px                          | **no** (delete per H6) |
| Menu link               | `voice-session.tsx:292`   | `size-10` = 40px                | **no**                 |
| Composer submit         | `composer.tsx:66`         | `size-9` = 36px                 | **no**                 |

`CLAUDE.md` mandates ≥44px, which `04 §C.27` identifies as the WCAG 2.5.5 AAA
bar. Three of the five are in Track B's files and unassigned.

#### 🟡 H26 — `text-ink-faint` is 2.74:1 and Track B's screens use it for text

`04 §C.28` measured `ink-faint` at **2.74:1** against white — below the 4.5:1 AA
floor, and far below the 7:1 that `04` recommends for this audience. Live text
uses in Track B's files:

- `components/voice/voice-session.tsx:314` — the `Connecting… / Getting ready… /
Starting…` line
- `components/voice/orb.tsx:100` — `VoiceStatusLine`, which is an `aria-live`
  region **and** `text-xs` (12px, below the 14px floor `04 §C.31` sets for
  incidental chrome)
- `components/language-picker.tsx:202` placeholder, `:208` empty state, `:223`
  "Default"

Track A's A11 names contrast for plan/upload. B13 (`tasks/plan.md:471`) says
"accessibility pass on voice/family/check-in" without naming it.

#### 🟢 H27 — flags are the headline picker fix; the same class of error is waiting on `/family`

B2 correctly deletes `FlagIcon` (`components/language-picker.tsx:81-161`) —
`04 §L1` cites Bilingual Technology Toolkit **4.8** ("National flags or other
metaphors for language should not be used") and W3C
["Don't use flags to indicate languages!"](https://www.w3.org/International/questions/qa-link-lang).

The same _category_ of error to pre-empt: `04 §S22` and `/design-taste-frontend
§9.F` ban decorative status dots, and WCAG **1.4.1 Use of Color** plus `04 §C.29`
require medication and escalation state to be "a word plus a shape, not a green
or amber dot". B8's escalation card is precisely where a red dot will want to
appear. Say it in B8's criteria, before it is written.

#### 🟢 H28 — no icon library, and the design skill says the opposite

`CLAUDE.md` bans Heroicons; `04 §S8` extends that to **any** icon library and
explicitly overrides `/design-taste-frontend §3.C`, which says "NEVER hand-roll
SVG icons" and prescribes Phosphor / HugeIcons / Radix / Tabler. The house set is
`components/icons.tsx`: 16px grid, `strokeWidth` 1.4–1.75, `currentColor`,
`aria-hidden`, round caps and joins. B8 and B10 need new glyphs and neither task
says where they come from — so a builder following the loaded design skill will
`pnpm add` a library and drag in a foreign house style.

---

## Proposed patches (not yet applied)

Quoted replacements only. A later phase applies them to `tasks/plan.md` /
`tasks/todo.md`. Nothing here has been written to those files.

### P1 — the model pin (fixes H1). Replace every occurrence listed in H1

Canonical sentence to use wherever "pinned `eleven_flash_v2_5`" currently
appears:

> **Both TTS models are explicitly pinned, one per locale**: base `en` →
> `eleven_flash_v2`; `language_presets.fr.overrides.tts.model_id` →
> `eleven_flash_v2_5`. An English-base agent **cannot** use a v2.5 model — the
> API returns HTTP 400 "English Agents must use turbo or flash v2", and language
> presets do not unlock it [06 §4]. Both models are Flash-tier, so latency is
> unchanged. Neither comes from a dropdown default. `tts.model_id` is **not**
> client-overridable, so the pin is tamper-proof from the browser [06 §2].

Replace `tasks/plan.md:452` (B11 step 1) with:

> 1. Read the agent config back and confirm **both** pins are intact: base
>    `conversation_config.tts.model_id == "eleven_flash_v2"` **and**
>    `language_presets.fr.overrides.tts.model_id == "eleven_flash_v2_5"`. If the
>    base has moved to `eleven_multilingual_v2`, that is drift — it is accepted
>    by the API and costs both locales their Flash latency with no error. Restore
>    `eleven_flash_v2`. **Do not** attempt to set the base to a v2.5 model; the
>    API rejects it (HTTP 400).

Replace the risk row at `tasks/plan.md:506`:

> | Agent model pins drift after a dashboard or API edit (silent latency loss, or French on an English-only model) | High — the Welsh/v2.5 class of failure | Task 0.1 + B11 read **both** pins back after every agent edit (`06 §4` re-verified them after the `client_events` PATCH for this reason); ear-test; **stop** on bad audio — no English-voice downgrade [D8, D9] |

### P2 — the Option 2 contingency (fixes H2, H3). New task, and a B3.5 rewrite

Insert as **Task B3.6**, Phase 1, immediately after B3.5:

> - [ ] **Task B3.6: French routing decision — the R1 gate.** Run the ear-test
>       pack from `[06 §8]` (four clips, same French sentence) with the human,
>       **before Checkpoint 1**. Decision rule, verbatim from `06 §8`: if the live
>       session clip sounds like `FR-on-eleven_flash_v2.mp3` rather than
>       `FR-on-eleven_flash_v2_5.mp3`, the `fr` preset is **not** being activated by
>       the `language` override.
>   - **If it passes:** record the result in `tasks/todo.md`, close R1, continue.
>   - **If it fails:** take **Option 2** from `[06 §4]` — two agents, one per
>     locale, each with its model pinned at its own root. This is a code change,
>     not a config change: - `lib/env.ts:8` — replace `NEXT_PUBLIC_AGENT_ID` with
>     `NEXT_PUBLIC_AGENT_ID_EN` and `NEXT_PUBLIC_AGENT_ID_FR`, both in the zod
>     schema, both on Vercel Production/Preview/Development. - `app/api/eleven/signed-url/route.ts:12` — take a `locale` search param,
>     Zod-parsed at this boundary (it is a route handler), and select the id.
>     `GET /v1/convai/conversation/get-signed-url` accepts only `agent_id`,
>     `include_conversation_id`, `branch_id`, `environment` — there is no
>     server-side override slot, so the agent id **is** the locale switch. - `components/voice/voice-session.tsx:216`, `:414` —
>     `fetchSignedUrl(locale)`. The `getUserMedia → fetchSignedUrl →
startSession` chain stays inside the tap. - Mirror onto the second agent: the five Security override toggles, the
>     full `client_events` set, and (once B4 lands) both server tools.
>   - **Never:** ship French UI with the English-model voice, or "try another
>     model" [D9].
>   - Dependencies: 0.1, B3, B3.5.

Then replace the last clause of B3.5 (`tasks/plan.md:372-374`):

> Verify: English session first (regression), then French. If French audio is
> wrong, **stop and run Task B3.6's decision rule** — do not downgrade to English
> voice under French UI, and do not swap the TTS model [Locked D9].

And delete B11 steps 1–2 (now covered by P1 and B3.6), leaving B11 as the
Phase 3 ASR/TTS regression re-check only.

### P3 — B1's acceptance criterion (fixes H4, H17)

Replace `tasks/plan.md:337-339`:

> - Acceptance: covers every user-visible string in `app/layout.tsx`,
>   `app/(phone)/page.tsx`, `check-in/page.tsx`, `plan/page.tsx`,
>   `not-found.tsx`, `back-button.tsx`, `language-picker.tsx`, `voice/orb.tsx`,
>   `voice/composer.tsx`, `voice/transcript.tsx`,
>   `voice/suggested-questions.tsx`, `voice/voice-session.tsx` and
>   `lib/check-in-prompt.ts` — **including** `aria-label`s, placeholders,
>   `role="alert"` copy, empty states and `metadata`. The specific strings
>   currently missing from the `[04]` enumeration are listed in
>   `[08 §H4]`. **Plus** the D7 red-flag dual-render labels ("exact words from
>   your letter" and its authored French), which A9 consumes.
> - Acceptance: `grep -rn "aria-label=\"" app components` returns nothing not
>   sourced from the dictionary.

### P4 — B2's fix list (fixes H5, H6, H7, H9, H27)

Replace `tasks/plan.md:342-352` (the B2 body) with:

> Server action sets the cookie, `revalidatePath`. `components/language-picker.tsx`
> row handler calls it instead of just closing the menu. Also:
>
> - delete the `FlagIcon` set and the `FlagCode` type (`:81-161`) — flags for
>   languages are banned [04 §L1];
> - delete the dead "See more languages" button (`:231-238`) — it calls
>   `onClose` and nothing else;
> - filter out the currently-active locale (`:212`) [04 §L2];
> - remove the hardcoded "Default" badge (`:222-224`) [04 §L3];
> - **replace the hardcoded `English` at `:276`** with the active locale's
>   endonym;
> - **reorder `LANGUAGES` (`:12-19`) so the real locales lead** — `fr` is
>   currently last, below six that do not work;
> - **rewrite the file comment at `:8-10`** — it still says "English + Cymraeg
>   are real", which D4 superseded;
> - raise every row and both triggers to ≥44px (`:218`, `:234`, `:324`) [04 §L6];
> - put the same top-right control on every screen [04 §L5].
> - Acceptance: picking Français reloads the page in French; picking a showcase
>   language shows an in-language "not yet" panel — never a silent English
>   fallthrough, never two languages on one screen. The panel is wrapped in
>   `<div lang="pl">` (etc.) per WCAG 3.1.2, offers exactly two buttons
>   (`English`, `Français`), and **does not** set the locale cookie —
>   `getDictionary` accepts only `Locale`, so a showcase locale can never reach
>   it.
> - Acceptance: the panel fills the phone-shell column with
>   `flex min-h-0 flex-1 flex-col`. **No `dvh`/`vh`** — the frame owns the height
>   [CLAUDE.md §The phone shell].

Add a new bullet to **Task 0.5** (fixes H7), replacing
`tasks/plan.md:177-178`:

> French uses the existing `latin` subset. **`latin-ext` is required, not
> optional**, because B2's showcase panels are written in-language and Welsh
> (`ŵ ŷ Ŵ Ŷ`), Polish (`ł ą ę ż ź ć ń ś`), Romanian (`ș ț ă`) and Turkish
> (`ğ ı ş İ`) all fall outside `latin` — verified against the live Google Fonts
> unicode-ranges in `[04 §Font subsets]`. Set
> `subsets: ["latin", "latin-ext"]` on **both** `Hanken_Grotesk` and
> `Newsreader` in `app/layout.tsx:7` and `:16`.
>
> - Verify: render `tŷ`, `ŵy`, `łąka`, `știință`, `değil` in the panel and
>   confirm no mid-word glyph fallback.

### P5 — B4's tool auth and configuration (fixes H10, H11, H14)

Replace `tasks/plan.md:383-387`:

> Bind `check_in_id` as a **dynamic variable** and `patient_id` as a
> **`constant_value`** in the tool's `request_body_schema` — neither is
> model-filled. (`description`, `dynamic_variable`, `constant_value`,
> `is_system_provided` and `is_omitted` are the five mutually-exclusive property
> fields; see `POST /v1/convai/tools`.) **Authenticate with an ElevenLabs
> workspace secret or workspace environment variable bound to a request header**
> — `request_headers: { "X-Portico-Token": { "secret_id": "…" } }` or
> `{ "env_var_label": "…" }` — **not** a `secret__` dynamic variable. A dynamic
> variable is supplied by the **browser** (`constructOverrides` in
> `@elevenlabs/client@1.15.2/dist/utils/overrides.js` maps `config.dynamicVariables`
> into `conversation_initiation_client_data`), and `get-signed-url` has no
> server-side slot to inject one, so a `secret__` token would ship to the client
> and be readable in devtools. `secret__` keeps a value away from the **LLM**,
> not from the **client**. Hold the matching value server-side in a new
> `toolEnv()` beside `serverEnv()` in `lib/env.ts`.
>
> Register the tools on the ElevenLabs agent (dashboard/API, outside this repo)
> with:
>
> - `api_schema.method: "POST"` **explicitly** — the default is `GET`;
> - `response_timeout_secs` set deliberately (default 20, range 5–120) — the
>   agent is **silent** for the whole wait;
> - `pre_tool_speech` and/or `tool_call_sound`, so that silence reads as thinking
>   rather than a hang;
> - `tool_error_handling_mode: "summarized"` or `"hide"` — the default `auto`
>   risks an error string being read aloud on the projector.
>
> Both handlers Zod-parse the body **and** check the header before trusting any
> identifier in it: the header is what proves the caller is ElevenLabs; the body
> is untrusted input either way.
>
> - **The localhost trap:** ElevenLabs' backend calls this URL — it cannot reach
>   a dev machine. Decide a stable deployed alias and **record it in
>   `tasks/todo.md §Setup status`**, so the agent config and the repo have one
>   comparable source of truth.

### P6 — Task 0.6 (fixes H12)

Replace `tasks/plan.md:182-189` entirely:

> - [ ] **Task 0.6: Correct the override-failure documentation — loud is
>       correct, but it is not a throw.** `README.md:70-75` and the comment at
>       `components/voice/voice-session.tsx:25-27` both claim a disallowed override
>       is silently ignored. Verified live in `[06 §6 Test C]`: the session is
>       **refused** — the WebSocket closes with code **1008**, reason "Override for
>       field 'X' is not allowed by config.", **after**
>       `conversation_initiation_metadata`. It is **not** a synchronous throw: the
>       `try/catch` around `connect()` at `voice-session.tsx:213-233` will not see
>       it. It surfaces through the SDK's `onError` callback (`:150`).
>   - Files: `README.md`, `components/voice/voice-session.tsx` (comment only)
>   - Verify: both texts say the session is refused and surfaces via `onError`.
>   - **The invariant to protect [D9]:** `onError` must keep rendering into the
>     visible `role="alert"` banner at `voice-session.tsx:304-311`. Code review
>     rejects any change that downgrades it to `console.error`, a toast that
>     auto-dismisses, or a swallowed no-op.

### P7 — B6 and B7 (fixes H13, H15)

Add to **B6** (`tasks/plan.md:404-410`):

> - **Prerequisite, already satisfied — verify by readback, do not re-PATCH:**
>   `client_tool_call` must be in `conversation_config.conversation.client_events`.
>   `[06 §5]` patched it in. If the agent is ever recreated this is the
>   silent failure — the tool simply never fires and nothing reports it.
> - Acceptance: the tool name is asserted against an agent readback, not
>   eyeballed. A name present one side and not the other fires
>   `onError("Client tool with name X is not defined on client")`, which lands
>   in the red banner over the transcript while the agent keeps talking
>   [02 §Failure modes mid-demo, verified from `BaseConversation.js:171-211`].

Replace B7's prerequisite (`tasks/plan.md:415-418`):

> **Prerequisite, already satisfied — verify by readback, do not re-PATCH:**
> `agent_tool_request` and `agent_tool_response` are in
> `conversation_config.conversation.client_events` (`[06 §5]`), alongside
> `agent_chat_response_part`, which `voice-session.tsx:116` depends on and
> which the **platform default omitted**. Every unnecessary agent PATCH is
> another chance for the D8 model pins to move — `[06 §4]` re-verified both
> pins after the `client_events` patch for exactly this reason.
> **Note:** `audio_alignment` is **not** a valid `client_events` value —
> alignment rides with the `audio` event, so `onAudioAlignment` needs no
> toggle. Do not go looking for one.

Add a note to **Task 0.1**, capturing what Phase 1 chose (fixes H14):

> - Agent settings chosen in Phase 1 and not otherwise recorded in this plan —
>   reproduce them if the agent is ever recreated: `agent.prompt.llm =
"gemini-2.5-flash"`, `temperature 0.2`, `turn.turn_eagerness = "patient"`,
>   `turn_timeout = 10s`, voice `NEXT_PUBLIC_XI_VOICE_ID`
>   (French-verified). `[06 §2]`. Consider
>   `disable_first_message_interruptions` so the "I'm not a clinician" line
>   always completes `[02 §What the two-way-chat framing changes]`.

### P8 — B12 (fixes H19)

Replace `tasks/plan.md:463-465`:

> `overrides.asr.keywords` seeded from the plan's actual drug names plus
> French/English yes-no tokens. The `asr.keywords` Security override is
> **already enabled and verified** (`[06 §2]`) — the public overrides doc omits
> it, but the API accepts and stores it, so B12 is unblocked. Verify by readback;
> do not re-toggle. Note `constructOverrides` emits the `asr` block **only when
> `keywords !== undefined`**, so omitting the key and sending `[]` are different
> wire messages.

### P9 — B3 and the composer (fixes H18, H20)

Add to **B3** (`tasks/plan.md:361-363`):

> Fix `SUGGESTED_QUESTIONS` — "Is this normal after surgery?" is generic clinical
> Q&A, which `[00 §Standing constraints]` cut along with open-web Q&A and
> symptom triage. The replacement must be **plan-grounded by construction**
> (derived from the day slice already in the prompt), not held in place by a
> prompt rule — a prompt rule is the soft guard D9 rejects. Rename the composer
> placeholder and `aria-label` at `components/voice/composer.tsx:55-56` for the
> same reason: they currently read **"Ask anything"**, the exact phrase for the
> cut feature.
>
> **Ordering matters:** B3 (authored French prompt + `firstMessage`) must land
> **before** B3.5 (`language: "fr"`). The per-session `firstMessage` override
> supersedes `language_presets.fr.overrides.agent.first_message` on the agent
> (`06 §2`), so B3.5 alone produces French language with an English opening
> line — French UI, English voice, no error.

### P10 — Taste-safe acceptance criteria (fixes H21–H28)

Append this block verbatim to **B2**, **B8**, **B10** and **B13**. It is one
block, not four, because the failure modes are identical and a shared checklist
is reviewable in one pass.

> **Taste-safe acceptance criteria (every new Track B screen).** Each line is
> checkable by reading the diff; `CLAUDE.md` wins any conflict with a design
> skill, and the three sharpest conflicts are named.
>
> 1. **Height.** Fills the phone-shell column with `flex min-h-0 flex-1
flex-col`. **Zero** occurrences of `dvh`, `vh` or `h-screen` in the diff.
>    The frame (`app/(phone)/layout.tsx:20`) owns the height.
>    _`/design-taste-frontend §3.E` says the opposite; it loses._
> 2. **Icons.** New glyphs are added to `components/icons.tsx` in its existing
>    register — 16px grid, `strokeWidth` 1.4–1.75, `currentColor`, `aria-hidden`,
>    round caps and joins. **No icon package is installed.**
>    _`/design-taste-frontend §3.C` prescribes Phosphor; it loses [04 §S8]._
> 3. **Type.** No monospaced font anywhere. Tabular figures come from `.tnum`.
>    No `uppercase`, no `tracking-[…]` on text, no eyebrow labels. Minimum 16px
>    for anything a patient reads, 14px for incidental chrome — never `text-xs`
>    [04 §C.31].
> 4. **Colour.** Semantic tokens only (`bg-surface`, `text-ink`,
>    `text-ink-muted`, `border-rule`, `text-accent`, `bg-mist`, `bg-lavender`).
>    **No raw hex** — the orb gradient is the one sanctioned exception. No
>    gradients as decoration, no `backdrop-blur`, no glassmorphism.
>    `text-ink-faint` (2.74:1) is **decorative-glyph duty only** and never carries
>    text [04 §C.28].
> 5. **State is never colour alone.** Escalation and adherence state is a **word
>    plus a shape**, never a red/amber dot. WCAG 1.4.1; `04 §C.29`;
>    `/design-taste-frontend §9.F`.
> 6. **Shape and depth.** `rounded-tactile` (12px) for buttons and tags,
>    `rounded-card` / `rounded-bubble` (16px) for cards, `rounded-pill` for
>    capsules. One shadow token: `shadow-card`. No `rounded-xl` everything, no
>    drop-shadow soup.
> 7. **Targets.** Every interactive element ≥44px in both axes. Current
>    violations to fix while in the file: `voice-session.tsx:292` (40px),
>    `composer.tsx:66` (36px), `language-picker.tsx:218`, `:234`, `:324`.
> 8. **Focus.** Every interactive element carries
>    `focus-visible:outline-2 focus-visible:outline-offset-2
focus-visible:outline-accent` — the treatment already at
>    `app/(phone)/page.tsx:41`. Never `outline-none` without a replacement
>    (`composer.tsx:57`, `language-picker.tsx:202` currently do).
> 9. **Motion.** 120–200ms, ease-out, opacity and small translate only. No bare
>    `transition` shorthand — list the properties (`page.tsx:41` and
>    `language-picker.tsx:265` currently do not). A
>    `@media (prefers-reduced-motion: reduce)` block in `app/globals.css` stops
>    the orb pulse (`orb.tsx:25`, `:26`, `:38`, `:39`, `:82`) and the
>    transcript dots (`transcript.tsx:37`, `:60`); state stays legible through
>    the existing `aria-live` label. **This block moves to Phase 1** — B10 adds
>    a second always-on orb before B13 currently runs.
> 10. **Copy.** British English, sentence case, ≤20-word sentences. No em-dash
>     (U+2014) — prefer a full stop [04 §S18]. No "please", "sorry",
>     "successfully", "just", "simply". No exclamation marks, no emoji, no
>     ampersands. No negative contractions ("do not", never "don't") — a safety
>     rule, GDS research shows they are misread as their opposite [04 §A.7].
>     Error messages name the problem **and** the next step.
> 11. **Language integrity.** Every user-visible string, `aria-label`,
>     placeholder and `metadata` value comes from the dictionary. A foreign-
>     language run carries `lang` on its wrapper (WCAG 3.1.2). `translate="no"`
>     on "Portico", "NHS", "111", "999" and every medication name.
> 12. **Full state set.** Loading, empty and error ship with the happy path.
>     Skeletons over spinners. No barren "No items" empty state.
> 13. **No `"use client"` above a leaf.** `/family` is an async Server Component;
>     `refresh-poller.tsx` is the only client file on it and returns `null`.

---

## Grounding notes

**Skills invoked for this pass, and what each contributed.** `/elevenlabs-agents`
supplied the tool-type taxonomy, the `built_in_tools` / `client_events` surface,
and the agent-config vocabulary used to read `06` critically.
`/nextjs-app-router-patterns` framed the route-handler-as-trust-boundary and
Server-Component-default arguments in P2 and P10.13.
`/haider-engineering-defaults` supplied the "validate at the edge, fail closed,
no long-lived credential in a casual place" line that H10 turns on.
`/haider-design-taste` and `/design-taste-frontend` supplied the anti-slop
vocabulary in P10 — and both were **overridden by `CLAUDE.md`** where they
conflict, at three named points (height, icons, monospace/density), per
`04 §Merged anti-slop checklist`. `/web-design-guidelines` supplied the focus,
reduced-motion, `Intl`, and `translate="no"` checks.

**Live documentation, fetched during this pass:**

- Webhook / server tools —
  https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools
  (note: the older `/docs/agents-platform/customization/tools/server-tools` path
  now 404s; `/docs/eleven-agents/…` is current)
- Client tools —
  https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools
- `POST /v1/convai/tools` — https://elevenlabs.io/docs/api-reference/tools/create
  — source for: `api_schema.method` default **`GET`**, allowed values
  `GET|POST|PUT|PATCH|DELETE`; `request_headers` reference types (static string,
  `{"secret_id"}`, `{"variable_name"}`, `{"env_var_label"}`); the five
  mutually-exclusive property fields `description` / `dynamic_variable` /
  `constant_value` / `is_system_provided` / `is_omitted`;
  `response_timeout_secs` default **20**, range **5–120**;
  `tool_error_handling_mode` ∈ `auto|summarized|passthrough|hide`
- Dynamic variables —
  https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables
  — source for the `secret__` semantics quoted in H10 ("only be used in dynamic
  variable headers and never sent to an LLM provider")
- Environment variables —
  https://elevenlabs.io/docs/eleven-agents/integrate/environment-variables
  — source for `{{system__env_<label>}}` in tool URLs and
  `"request_headers": { "X-Api-Key": { "env_var_label": "my_api_key" } }`
- Overrides —
  https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides
  — confirms the documented overridable set and "An error will be thrown if an
  override is provided for a field that does not have overrides enabled" (the
  doc's wording; `06 §6` establishes the empirical mechanism is a 1008 close)
- `GET /v1/convai/conversation/get-signed-url` —
  https://elevenlabs.io/docs/api-reference/conversations/get-signed-url
  — parameters: `agent_id` (required), `include_conversation_id`, `branch_id`,
  `environment`. **No** overrides, **no** dynamic variables. This is the pin
  under H2 and H10.
- W3C, "Don't use flags to indicate languages!" —
  https://www.w3.org/International/questions/qa-link-lang

**Pinned SDK, read from `node_modules` (not from docs):**

- `@elevenlabs/client@1.15.2/dist/utils/overrides.js` — `constructOverrides`
  serialises `agent.{prompt, first_message, language}`,
  `tts.{voice_id, speed, stability, similarity_boost}`, `asr.keywords`
  (**only when `!== undefined`**), `conversation.text_only`, and maps
  `config.dynamicVariables → dynamic_variables`, `config.userId → user_id`,
  `config.toolMockConfig → tool_mock_config`. No `knowledge_base`, no
  `tool_ids`, no `model_id`.
- `@elevenlabs/react@1.10.2/dist/index.d.ts:12` — `useConversationClientTool` is
  exported.
- `@elevenlabs/react@1.10.2/dist/conversation/types.d.ts:5` — `HookCallbacks`
  includes `onAgentToolRequest`, `onAgentToolResponse`, `onAudioAlignment`,
  `onUnhandledClientToolCall`, `onAgentChatResponsePart`.
- `package.json` declares `"@elevenlabs/react": "^1.8.0"`; the lockfile resolved
  `1.10.2` with `@elevenlabs/client@1.15.2` and `@elevenlabs/types@0.17.1`.

**Repo state read for this pass:** `CLAUDE.md`, `tasks/plan.md`,
`tasks/todo.md`, `plan/spec.md`, `audit/…/00-locked-decisions.md`,
`audit/…/02-track-2-elevenlabs-feasibility.md` §(a)(b)(c),
`audit/…/04-track-4-i18n-and-accessibility.md` §i18n / §C / §Merged anti-slop,
`audit/…/06-phase-1-readiness.md`, `README.md`, `app/layout.tsx`,
`app/not-found.tsx`, `app/(phone)/layout.tsx`, `app/(phone)/page.tsx`,
`app/(phone)/check-in/page.tsx`, `app/api/eleven/signed-url/route.ts`,
`lib/env.ts`, `lib/check-in-prompt.ts`, `components/language-picker.tsx`,
`components/voice/{voice-session,orb,composer,suggested-questions}.tsx`,
`.env.example`, `package.json`.

**Not done, deliberately:** no ElevenLabs agent was created, read, patched or
deleted; no TTS or conversation call was made; no credit was consumed. Every
platform claim here is either from public docs or quoted from `06`.

---

## Residual risk

| #   | Risk                                                                                                                                                                                                                          | Severity | Note                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RB1 | **R1 is still open and this file cannot close it.** Whether `overrides.agent.language: "fr"` activates `language_presets.fr` needs an ear. P2 gives it a landing zone; it does not settle it.                                 | 🔴       | Inherited from `06 §7 R1`. The only change here is that "stop" now has a next step.                                                                                      |
| RB2 | **Option 2 costs roughly an hour that the plan has not budgeted.** Two agent ids, a signed-URL param, an env change on Vercel × 3 environments, and mirroring five toggles + `client_events` + two tools onto a second agent. | 🟡       | If the ear-test is deferred past Checkpoint 1 the cost rises sharply, because B6/B7/B12 will already have layered onto `voice-session.tsx` (`tasks/plan.md:507`).        |
| RB3 | **`{"secret_id": …}` in `request_headers` is documented but was not exercised.** H10's fix is grounded in two doc pages, not in a live tool creation — which was out of scope for this pass.                                  | 🟡       | Verify with one throwaway tool at the start of B4, before writing the route handlers. `{"env_var_label": …}` is the documented alternative if `secret_id` misbehaves.    |
| RB4 | **`06 §7 R5` (`platform_settings.auth.enable_auth` at platform default, agent id public, origin allowlist unset) has no task in Track B.**                                                                                    | 🟡       | Still a human hardening decision. Do not enable it blind the night before the demo — `06` flags the empty-allowlist semantics as unverified.                             |
| RB5 | **Track B carries no test.** `lib/escalation/rules.ts` (B5) is a pure discriminated-union function driving the demo's second hero beat, and `plan/spec.md §Open Questions` item 4 leaves vitest undecided.                    | 🟢       | Same argument as A3. If vitest lands for one module, this is the one.                                                                                                    |
| RB6 | **B9's 5s `router.refresh()` re-renders an `aria-live`-adjacent surface every poll.** A screen reader on `/family` may re-announce.                                                                                           | 🟢       | Cheap mitigations: scope any `aria-live` to the escalation card only, and pause the interval on `document.hidden`. Not worth a task unless a judge uses a screen reader. |
| RB7 | **`package.json:2` still says `"name": "juno"`.** Cosmetic under D10 (repo slug is explicitly legacy scaffolding), but it is what `pnpm` prints.                                                                              | 🟢       | One-line change; not worth a task on its own, worth folding into the next `tasks/` edit.                                                                                 |

---

## Skills applied

Invoked in full for this pass, in this order:

1. **`/elevenlabs-agents`** — tool taxonomy (webhook / client / system), agent
   config vocabulary, `client_events` and override surfaces. Used to read `06`
   critically and to frame H10, H13, H14, H15, P5, P7.
2. **`/nextjs-app-router-patterns`** — Server-Component default, route handler as
   the trust boundary, client leaves. Used in H2/P2 (the signed-URL locale
   param), H11 (Zod at the route), P10.13.
3. **`/haider-engineering-defaults`** — validate at the edge, no long-lived
   credential in a casual place, fail closed and name the missing secret. The
   spine of H10, H11 and the `toolEnv()` recommendation in P5.
4. **`/haider-design-taste`** — quiet-default doctrine, emphasis by weight before
   colour, borders before shadows, the review-as-table format. Applied in P10;
   **overridden by `CLAUDE.md`** on density (§S25), radii (§S6), fonts (§S1),
   shadows on in-flow cards (§S5) and component library (§S12).
5. **`/design-taste-frontend`** — the AI-tell catalogue (eyebrows, decorative
   dots, hand-rolled SVG, em-dash, fake precision, three-equal-cards). Applied in
   H21, H27, H28 and P10; **overridden by `CLAUDE.md`** on §3.E (`min-h-[100dvh]`
   → banned inside the phone shell, H22), §3.C (icon library → banned, H28) and
   §7 (`font-mono` for numerals → banned, `.tnum` instead).
6. **`/web-design-guidelines`** — focus states, `prefers-reduced-motion`,
   `Intl.*` over hardcoded formats, `translate="no"` on identifiers, long-content
   handling. Applied in H17, H23, H24, H26 and P10.

Project law consulted throughout and treated as overriding all six:
`CLAUDE.md` — §Voice (ElevenLabs), §The phone shell, §UI & Design, §Frontend.
