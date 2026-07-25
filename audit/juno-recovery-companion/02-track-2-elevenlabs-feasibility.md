# Track 2 — ElevenLabs feasibility

Research pass only. No implementation code was written. Findings are grounded in
(1) the repo as it stands, (2) the **installed** SDK's own type definitions and
compiled source — which outrank the docs where they disagree, because they are
what will actually run — and (3) current ElevenLabs documentation, cited inline.

Installed, verified from `node_modules`: `@elevenlabs/react@1.10.2` (resolved
from `^1.8.0`) → `@elevenlabs/client@1.15.2` → `@elevenlabs/types@0.17.1`.
Next 16.2.9, React 19.2.7, Zod 4.4.3.

---

## Scope

Four questions, each answered with an explicit recommendation:

- **(a)** How to ground the agent in ONE patient's plan for one call —
  prompt-injection vs ElevenLabs RAG/knowledge base vs dynamic variables.
- **(b)** Tool calling — client tools vs server/webhook tools, for logging
  adherence mid-call and triggering escalation mid-call.
- **(c)** Call-initiation model — how the check-in starts, and the revised demo
  beat.
- **(d)** Welsh (Cymraeg) voice support in both directions — TTS and ASR — with
  a concrete fallback plan. **Verdict: GREEN, with conditions.** Both directions
  work, but only on a configuration the platform never gives you by default, and
  a wrong configuration **fails silently**. Seven mandatory conditions, three of
  which are one-line fixes to files already in this repo.

**Two mid-track decisions from the orchestrator supersede parts of the original
brief. They are reflected throughout and restated in _What changed_.**

1. **Call initiation is decided.** No Twilio, no SIP, no PSTN call. The model is:
   notification → patient taps → app opens → the **existing** orb session starts
   inside that tap → two-way spoken conversation. Section (c) is therefore a
   confirmation-and-mechanism section, not a build-or-buy verdict. The
   outbound-telephony analysis has been cut down to the two sentences needed to
   answer a judge.
2. **Persistence now exists.** Vercel Blob for uploaded letter images, plus a
   Vercel Marketplace KV/Postgres store for patient, plan JSON, adherence log and
   caregiver
   ([Storage on Vercel Marketplace](https://vercel.com/docs/marketplace-storage),
   [Vercel Storage overview](https://vercel.com/docs/storage)). Still no Supabase.
   This **reverses** the tool-type recommendation in (b): a durable server-side
   write is now both possible and desirable.

Extraction runs through the Vercel AI SDK via the AI Gateway. Not this track, but
it sets where the plan JSON comes from — see (a).

Out of scope, and deliberately not smuggled back in: open-web "ask anything" Q&A.
`plan/initial-idea.md:99` cut it; meeting 1 (`plan/raw-transcript.md:6`) floated
"11 labs API does have access to web search". **I agree with the cut and am not
reopening it.** It reintroduces ungrounded clinical content, which is the one
thing the guiding principle forbids, and it is the fastest way to lose the
regulatory-shield argument in front of judges. Roadmap line, not a feature.

---

## What is already built

A complete, working single-agent voice session. Nothing here needs rebuilding —
every recommendation below is an extension.

**The one client boundary** — `/Users/haidertoha/Code/juno-hack/components/voice/voice-session.tsx`

| Lines      | What is there                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `:3`       | Imports `ConversationProvider`, `useConversation` from `@elevenlabs/react`.                                                                                                                                        |
| `:19`      | `type Phase = "idle" \| "conversation"` — two internal view states, not sub-routes.                                                                                                                                |
| `:21-31`   | `VoiceSessionProps`: `title`, `blurb`, `systemPrompt`, `firstMessage`, `suggestedQuestions`. This is the whole grounding surface today.                                                                            |
| `:25-28`   | Comment: the override _replaces_ the dashboard prompt and "the agent must have prompt overrides enabled in its ElevenLabs security settings **or this is silently ignored**". **This comment is wrong — see (a).** |
| `:49-55`   | `VoiceSession` wraps `<Session>` in `<ConversationProvider>`. The provider stays mounted across phase changes.                                                                                                     |
| `:98-159`  | `useConversation({...})` with `onMessage`, `onAgentChatResponsePart`, `onAudioAlignment`, `onError`, `onStatusChange`. Returns `status`, `mode`, `startSession`, `endSession`, `sendUserMessage`.                  |
| `:116-134` | `onAgentChatResponsePart` accumulates the target text from `start`/`delta`/`stop`.                                                                                                                                 |
| `:135-146` | `onAudioAlignment` converts each chunk's `char_start_times_ms` into absolute `performance.now()` timestamps.                                                                                                       |
| `:150`     | `onError: (message) => setError(message)` — **any SDK error paints a red banner over the transcript.** Load-bearing for (b).                                                                                       |
| `:166-176` | 30 ms interval walks the timeline and advances `revealedCount` with a 120 ms lead. This is the signature effect.                                                                                                   |
| `:182-187` | Flushes questions queued before `status === "connected"`.                                                                                                                                                          |
| `:212-234` | `connect()`: `getUserMedia` → `fetchSignedUrl` → `startSession`.                                                                                                                                                   |
| `:217-230` | The override payload actually sent today: `overrides.agent.prompt.prompt`, `overrides.agent.language: "en"` (hardcoded), `overrides.agent.firstMessage`, `overrides.tts.voiceId`.                                  |
| `:236-244` | `begin()` — the gesture boundary. `connect()` is invoked synchronously inside the tap.                                                                                                                             |
| `:249-253` | `end()` calls `endSession()` explicitly, because hiding the view would otherwise leave mic + socket alive.                                                                                                         |
| `:260-267` | `ask()` — optimistic user turn, then `sendUserMessage` or queue.                                                                                                                                                   |
| `:272-282` | The `phase === "idle"` branch renders `IdleView`; `:353-408` is `IdleView` itself, with the two CTAs. **This is the component that becomes the incoming-check-in screen in (c).**                                  |
| `:412-419` | `fetchSignedUrl` with a Zod parse of our own route's response.                                                                                                                                                     |

**Supporting files**

- `/Users/haidertoha/Code/juno-hack/app/api/eleven/signed-url/route.ts:12-22` —
  server-only `GET`; reads `XI_API_KEY` via `serverEnv()`, calls
  `GET /v1/convai/conversation/get-signed-url?agent_id=…`, Zod-parses
  `{ signed_url }`, returns `{ signedUrl }`. The key never enters a response body.
  **This is the template for the tool webhook route in (b).**
- `/Users/haidertoha/Code/juno-hack/lib/env.ts:7-15` — browser-safe schema
  (`NEXT_PUBLIC_AGENT_ID`, `NEXT_PUBLIC_XI_VOICE_ID`); `:17-27` — `serverEnv()`
  for `XI_API_KEY`.
- `/Users/haidertoha/Code/juno-hack/lib/check-in-prompt.ts:4-16` —
  `CHECK_IN_PROMPT`, persona + concision rules, with "never invent a medication,
  a dose, a date or an instruction" and "you are not a clinician" already
  present. `:15` already says "After you have greeted them, wait for them to
  answer. Do not read their whole plan back to them" — see (c). `:18-23` — four
  `SUGGESTED_QUESTIONS`.
- `/Users/haidertoha/Code/juno-hack/app/(phone)/check-in/page.tsx:9-19` — thin
  Server Component passing five props into the client leaf. **The natural place
  to read the plan from KV and compose the prompt.**
- `/Users/haidertoha/Code/juno-hack/components/voice/orb.tsx:11-59` `OrbSphere`,
  `:63-92` `OrbDock`, `:98-113` `VoiceStatusLine`, `:115-123` `voiceStatusLabel`
  — all driven off `mode` (`speaking`/`listening`), never `status`.
- `/Users/haidertoha/Code/juno-hack/components/voice/transcript.tsx:8-44` —
  renders `items` plus the audio-gated `live.slice(0, revealedCount)`;
  `:48-66` `TypingBubble` covers the think-time gap visually.
- `/Users/haidertoha/Code/juno-hack/components/voice/composer.tsx:8-89` — typed
  input; submit disabled only when empty, never on `!connected` (`:67`).
  **This is the ASR fallback for Welsh.**
- `/Users/haidertoha/Code/juno-hack/components/voice/suggested-questions.tsx:6-45`.
- `/Users/haidertoha/Code/juno-hack/components/language-picker.tsx:11-20` —
  `LANGUAGES` already lists `en` + `cy` as "real" and six more as showcase-only.
  Selecting a row is a no-op today (`:218`).
- `/Users/haidertoha/Code/juno-hack/README.md:62-79` — the ElevenLabs section,
  repeating the "silently ignored" claim at `:70-75`.
- `/Users/haidertoha/Code/juno-hack/vercel.json` — plain Next preset, no crons.
- `.env.example` — three vars; the sample voice is `YCMgeo2Dvws6xwm7kQNN`.

**What is NOT there:** no tool calling of any kind; no `clientTools`; no
`dynamicVariables`; no knowledge base; no notification surface; no plan data
model; no storage bindings; no Welsh anywhere except the picker label.

**Setup gap found:** the local `.env` still contains the `.env.example`
placeholders (`XI_API_KEY` is 47 chars of `sk_` + `x`; agent id is
`agent_xxx…`). A live API probe returned `401 invalid_api_key`. Nothing in this
report could be verified against a live workspace — see _Could not confirm_.

---

## (a) Grounding the agent — verdict

### Verdict

**Inject the extracted plan into `overrides.agent.prompt` — the pattern already
at `voice-session.tsx:217-230`. Do not use RAG or the knowledge base.** Add
exactly two dynamic variables (`patient_id`, `check_in_id`) — not for grounding,
but because the server tools in (b) need identity they cannot get any other way.
`plan/initial-idea.md:43` and `:58` assume RAG; that assumption is wrong for this
shape of problem and should be dropped.

Persistence does not change this. It changes where the plan is **stored** (KV,
written by the AI-Gateway extraction step) not how it **reaches the agent**. The
Server Component at `app/(phone)/check-in/page.tsx` reads the plan and today's
slice, composes the prompt string, and passes it down as the existing
`systemPrompt` prop. One read, no waterfall, no new client-side fetching.

### Why RAG is the wrong tool here

**1. It is not reachable from the current architecture.** The docs list
"Knowledge base" as an overridable field
([Overrides](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides)),
but the installed browser SDK cannot send it. `constructOverrides()` in
`node_modules/.pnpm/@elevenlabs+client@1.15.2_*/node_modules/@elevenlabs/client/dist/utils/overrides.js`
serialises exactly this and nothing else:

```
conversation_config_override = {
  agent: { prompt, first_message, language },
  tts:   { voice_id, speed, stability, similarity_boost },
  asr:   { keywords }            // only when provided
  conversation: { text_only },
}
```

The generated wire types agree —
`@elevenlabs/types@0.17.1/dist/generated/types/asyncapi-types.d.ts` defines
`ConversationConfigOverrideAgent` as `{ first_message?, language?, prompt?,
native_mcp_server_ids? }` and `ConversationConfigOverrideAgentPrompt` as
`{ prompt?: string; llm?: string }`. There is no `knowledge_base` and no
`tool_ids` anywhere in the browser protocol. Attaching a per-patient KB would
mean moving session initiation server-side. That is a rebuild.

**2. A knowledge base is a shared, mutable agent object — sessions are not.** A
KB document is a workspace resource attached to the agent's
`conversation_config.agent.prompt.knowledge_base`
([Knowledge base](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base)).
Creating one per patient at runtime means `PATCH`ing the shared agent config
between calls. Two judges opening the demo at once, or a re-run mid-presentation,
race each other. The prompt override is per-WebSocket and cannot collide.

**3. Retrieval's failure mode is the exact failure this product cannot have.**
RAG returns top-k chunks. A miss means the agent says "I don't have that written
down" about a drug the surgeon _did_ prescribe — a silent omission on a
safety-critical read-back. The whole regulatory shield in
`plan/initial-idea.md:26` is "we only reformat and read back the clinician's own
words". Reading back a _subset_ selected by a similarity score is a different,
worse product. Full-context injection is deterministic: the whole plan is there
or the session doesn't start.

**4. Size is a non-issue.** One patient's day-slice is single-digit kilobytes.
ElevenLabs' own full-context (non-RAG) knowledge-base documents hold "roughly
300,000 characters" before RAG is forced, and documents under 500 bytes bypass
indexing and go into the prompt automatically
([Knowledge base](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base),
[RAG](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag)).
Orders of magnitude below any ceiling.

**5. Indexing latency is unbounded from the app's point of view.** The docs say
only "Indexing may take a few minutes for large documents"
([RAG](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag)).
No SLA. You cannot build a create-and-index-at-upload flow against "a few
minutes" inside a 24h build and demo it live.

**6. RAG costs latency at every turn.** "RAG adds slight latency to the response
time of your agent, around 250ms"
([RAG](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag)).
Prompt injection adds zero. On a voice product where the pause before the orb
speaks _is_ the perceived quality, 250 ms per turn is a regression for no gain.

Workspace RAG storage caps by tier, for completeness: Free 1 MB, Starter 2 MB,
Creator 20 MB, Pro 100 MB, Scale 500 MB, Business/Enterprise 1 GB
([RAG](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag)).
Not a constraint either way.

### Dynamic variables — now needed, for exactly one reason

They are real and wired in the installed SDK: `BaseSessionConfig` in
`@elevenlabs/client@1.15.2/dist/utils/BaseConnection.d.ts` declares
`dynamicVariables?: Record<string, string | number | boolean>`, and
`constructOverrides()` maps it to `dynamic_variables` on
`conversation_initiation_client_data`. Values interpolate as `{{var_name}}` into
system prompts, first messages **and tool parameters**, alongside a set of
platform-provided `system__*` variables (`system__time`, `system__timezone`,
`system__conversation_id`, `system__conversation_history`, …)
([Dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)).

Under the original no-database brief I recommended skipping them. **With a server
tool writing to KV, that reverses.** A webhook tool receives whatever parameters
the LLM fills in — and the patient's identity must never be one of those. Bind
it instead:

- `patient_id` — passed at `startSession`, bound to the tool's `patient_id`
  parameter so the model cannot invent or transpose it.
- `check_in_id` — the day's check-in, so a repeated tool call is idempotent
  against the KV key rather than double-logging.
- `secret__juno_tool_token` — a `secret__`-prefixed variable bound to a request
  header. Per the docs, secret dynamic variables "should only be used in dynamic
  variable headers and never sent to an LLM provider as part of an agent's system
  prompt or first message"
  ([Dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)).
  This is what stops an arbitrary internet POST from writing adherence rows.

Nothing else. The plan itself stays in the prompt.

### What to build

Compose `systemPrompt` from `CHECK_IN_PROMPT` + today's slice of the plan JSON,
in the Server Component. Keep persona and concision rules in the same string —
`voice-session.tsx:222-224` is right that the override _replaces_ the dashboard
prompt, so anything not in the string does not exist at runtime. Section the
prompt with markdown headings (`# Personality` / `# Environment` / `# Tone` /
`# Goal`), which the
[prompting guide](https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide)
says the model follows more reliably. Give today's steps their own heading, and
the doctor's red-flag lines a separate, explicitly-verbatim heading with a rule
that they may be read aloud but never paraphrased.

### Correction: overrides do NOT fail silently

Both `voice-session.tsx:25-28` and `README.md:70-75` state that a disallowed
override is silently ignored and you get the dashboard prompt. The docs say the
opposite:

> "For security reasons, overrides are disabled by default."
> "An error will be thrown if an override is provided for a field that does not
> have overrides enabled."
> "Navigate to your agent's settings and select the **Security** tab."
> — [Overrides](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides)

This matters twice. The comments are misleading and should be fixed. And because
`onError` at `voice-session.tsx:150` renders a red banner, a mis-configured agent
produces a _visible failure_ rather than a subtly-wrong agent — better for
debugging, worse for a demo. Verify the Security tab before the first rehearsal.

**Overrides that must be enabled for the current code to work at all:** system
prompt (`prompt.prompt`), first message, language, and voice ID (the repo sends
`overrides.tts.voiceId` at `voice-session.tsx:228`). The full documented
overridable set is: System prompt, First message, Language, Voice ID, LLM, Tools,
Knowledge base, Text-only mode, Stability, Speed, Similarity boost
([Overrides](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides)).

---

## (b) Tool calling — verdict

### Verdict

**Adherence logging and escalation are both server tools (webhooks) hitting Next
route handlers that write to the Marketplace KV store. The browser drives its UI
off the SDK's `onAgentToolRequest` / `onAgentToolResponse` callbacks, not off a
second tool.** Keep exactly one client tool, for a purely visual, session-local
job. This reverses the client-tool-only recommendation that the original
no-database brief forced.

### Why persistence flips the answer

ElevenLabs has three tool types
([Tools](https://elevenlabs.io/docs/eleven-agents/customization/tools)):
**webhook/server tools** (ElevenLabs' backend calls your HTTPS endpoint),
**client tools** ("Tools executed directly on the client-side application (e.g.,
web browser, mobile app)"), and **system tools** (`end_call`,
`transfer_to_number`, `language_detection`, …).

Under the old constraint, a webhook was pointless: a Vercel function is stateless
per invocation, so a "write" to process memory would read back empty from a
different instance, and the browser tab was the only durable store. With a
Marketplace KV/Postgres store that argument evaporates, and three requirements
now point hard the other way:

1. **The family view is a different browser.** Priya's screen must see the missed
   dose and the escalation. Client state is invisible to it by construction.
2. **"A pattern of missed high-stakes meds" is a cross-day rule.** It cannot be
   evaluated from one tab's React state; it needs the adherence log.
3. **A refresh must not erase the demo.** Client state dies with the tab. This is
   the single most likely way to lose the pitch mid-sentence.

### The three tools

**1. `log_step` — adherence. Server tool.**
`POST` to `/api/agent/log-step` on the deployed origin.
Parameters: `patient_id` (bound to a dynamic variable, not model-filled),
`check_in_id` (likewise), `step_id`, `done: boolean`, and optionally
`patient_words` (what they actually said, stored verbatim — consistent with the
"only the patient's and clinician's own words" principle). Handler validates with
Zod at the boundary, writes to KV, returns `{ result: "..." }`.

**2. `escalate_to_next_of_kin` — escalation. Server tool.**
`POST` to `/api/agent/escalate`. Parameters: `patient_id`, `reason`. Writes an
escalation record the family view reads. If a real email/SMS is in scope it fires
from the same handler — an outbound call to a third party, immune to any
statelessness concern.

Do **not** let the agent decide the escalation threshold. The prompt should
instruct it to call the tool when it logs a miss on a step the plan marks
high-stakes; the _rule_ ("twice in three days") lives in the route handler,
against the KV log, where it is deterministic and auditable. That keeps the
"never generates new clinical judgement" line honest — the agent reports an
event, the server applies a rule the team wrote.

**3. `show_red_flag(line_id)` — the one client tool.**
Purely visual and session-local: when the patient describes something that
matches a red-flag line the surgeon wrote, this surfaces that line on screen,
verbatim, with the phone number from the letter, while Juno reads it aloud. There
is nothing to persist and nothing another device needs to see, so a server round
trip would only add latency. It is also the strongest visual beat in the demo:
the doctor's own sentence appearing on screen while the agent speaks it is the
regulatory-shield argument made visible.

### Keeping the UI live without a second tool

The obvious trap is registering both a server tool (for the write) and a client
tool (for the tick), which doubles the LLM's decision surface and lets the two
diverge. There is a clean alternative, and it is already in the installed SDK.

`HookCallbacks` in
`node_modules/@elevenlabs/react/dist/conversation/types.d.ts` includes
`onAgentToolRequest` and `onAgentToolResponse`. `BaseConversation.js:223-235`
dispatches them from the `agent_tool_request` / `agent_tool_response` wire
events. So the browser can **observe** the server tool call as it happens —
`onAgentToolRequest` gives `{ tool_name, tool_call_id, … }` optimistically, and
`onAgentToolResponse` confirms — and tick the step off in React with no extra
tool and no polling. One source of truth (KV), instant UI.

**Prerequisite:** `agent_tool_request` and `agent_tool_response` must be in the
agent's `conversation_config.conversation.client_events`. The wire type
`ConversationConfigOverrideConversation` does contain a `client_events` field, but
`constructOverrides()` serialises only `text_only` — so **this cannot be set per
session from the browser and must be configured on the agent**. Easy to miss;
the symptom is callbacks that simply never fire.

### Registration surface — both halves are required

**Half one — declare the tools on the agent (one-time, outside this repo).**
Under `conversation_config.agent.prompt.tools`. As established in (a), the wire
protocol's `ConversationConfigOverrideAgentPrompt` is `{ prompt?, llm? }` only,
with no `tools` and no `tool_ids` — the docs' claim that "Tools" is overridable
is not reachable from `@elevenlabs/client@1.15.2`. Names are case-sensitive and
must match exactly
([Client tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools)).

Server tool shape, from
`.claude/skills/elevenlabs-agents/references/client-tools.md:118-143`:

```
{ type: "webhook", name, description, response_timeout_secs,
  api_schema: { url, method: "POST", request_headers, request_body_schema } }
```

**The default `api_schema.method` is `GET`** — it must be set to `POST`
explicitly or the body never arrives. Bind `patient_id` / `check_in_id` to
dynamic variables in the `request_body_schema` properties rather than letting the
model fill them; the reference documents `dynamic_variable`, `constant_value`,
`is_system_provided` and `is_omitted` as JSON-schema property fields
(`client-tools.md:489-491`). Exact live-doc confirmation of that syntax is in
_Could not confirm_.

**Half two — register the client-tool handler in the browser.** Preferred API,
exported at `node_modules/@elevenlabs/react/dist/index.d.ts:12`:

```ts
useConversationClientTool<TTools>(name, handler);
```

From the package's own docblock: "Registers a named client tool with the nearest
`ConversationProvider`. The tool is available during any active conversation and
is automatically unregistered when the component unmounts. The handler always
reflects the latest closure value (ref pattern), so it is safe to reference
component state or props without listing them as dependencies."

That last property is exactly what this repo needs. The alternative
(`clientTools: {...}` on `useConversation` / `ConversationProvider`, per
`HookOptions` in `dist/conversation/types.d.ts`) has no latest-ref treatment.
Place the call inside `Session` (`voice-session.tsx:57`), already inside the
provider (`:51`). `buildClientTools` (`ConversationProvider.js:75`) merges option
tools with the hook registry at `startSession` and then mutates
`clientToolsRef.current` in place, so tools registered later still reach a live
conversation — but registering before `begin()` is the safe pattern. It
**throws** if a name is supplied by both mechanisms; pick one.

Handler signature, from `dist/conversation/types.d.ts`:

```ts
type ClientToolResult = string | number | void;
type ClientTool<P, R> = (parameters: P) => Promise<R> | R;
```

Return `void` and the SDK substitutes `"Client tool execution successful."`;
return an object and it is `JSON.stringify`'d (`BaseConversation.js:176`).

### Practical webhook constraints — the 24h traps

**ElevenLabs' backend makes the call, so `localhost` is unreachable.** There is
no way to point a server tool at a dev machine without a tunnel. Develop against
a deployed URL, or run `ngrok`/equivalent and swap the agent's tool URL. Budget
for this; it surprises people at 2am.

**Per-commit preview URLs move.** The tool URL is static agent config, so
pointing it at a preview deployment means re-editing the agent on every push.
Point it at a **stable production alias** and deploy to it, or use ElevenLabs
workspace environment variables — `{{system_env__label}}` is supported in server
tool URLs (`.claude/skills/elevenlabs-agents/references/client-tools.md:146-163`).
The stable alias is the 24h answer.

**Authenticate it.** The route handler is public. Bind a `secret__`-prefixed
dynamic variable to a request header and check it server-side; secret dynamic
variables are documented as header-only and never sent to the LLM
([Dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)).

**Keep it fast.** `response_timeout_secs` defaults to 20 with a 5–120 range
(`client-tools.md:174-182`; not confirmed against live docs). A KV write is
single-digit milliseconds, so this is comfortable — but the agent is _silent_
while it waits. Set `pre_tool_speech` and/or `tool_call_sound` so the pause reads
as thinking rather than as a hang.

**Choose the error posture deliberately.** `tool_error_handling_mode` takes
`auto`, `summarized`, `passthrough`, `hide` (`client-tools.md:495-503`). For a
demo, `summarized` or `hide` — you do not want a stack trace read aloud in a
Welsh accent.

### Failure modes mid-demo

**Server tools fail quietly.** The SDK is not in the loop, so no `onError` fires
and no red banner appears. The agent receives a tool error and behaves per
`tool_error_handling_mode`. This is materially safer on stage than a client tool.

**Client tools fail loudly.** Verified from
`@elevenlabs/client@1.15.2/dist/BaseConversation.js:171-211`, not from docs (the
docs are silent on all of it):

| Situation                               | What actually happens                                                                                                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Handler throws                          | `onError("Client tool execution failed with following error: …", { clientToolName })` fires, **and** a `client_tool_result` with `is_error: true` is sent. The conversation continues; the agent sees the error string and usually apologises. |
| Tool name not registered in the browser | `onError("Client tool with name X is not defined on client")` fires, **and** an `is_error: true` result is sent.                                                                                                                               |
| `onUnhandledClientToolCall` is supplied | The SDK calls it and **returns early — no result is sent at all.** The agent waits indefinitely. **Do not supply this callback unless you send a result yourself.**                                                                            |
| `expects_response: false`               | Agent fires and forgets; it will not block or acknowledge.                                                                                                                                                                                     |

**The demo-critical consequence:** `voice-session.tsx:150` routes every SDK error
to a red `role="alert"` banner (`:304-311`). One typo in the `show_red_flag` name
puts a red box on the projector while Juno keeps talking. Two cheap mitigations:
never let the handler throw (catch inside, return a plain string like "Could not
show that just now"), and route tool-scoped errors — identified by the
`{ clientToolName }` context argument — somewhere quieter than the
connection-error banner.

**Escape hatch:** `BaseSessionConfig` exposes `toolMockConfig?: { mockingStrategy?:
"none" | "all" | "selected"; mockedToolNames?: string[]; fallbackStrategy?:
"raise_error" | "call_real_tool" }`. If a tool goes bad an hour before the demo,
force it to mock at `startSession` without touching the agent config.

### Belt-and-braces (stretch, not v1)

Post-call webhooks fire after analysis with the full transcript and structured
Data Collection output, authenticated by HMAC via the `ElevenLabs-Signature`
header and verified with the SDK's `constructEvent`
([Post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks)).
That gives a second, independent write path for adherence in case a mid-call tool
call is missed. It is real insurance and a good "what we'd harden next" line —
but it is extra surface, it only lands after the call, and it does not help the
live UI. Do not build it in the first 24h.

---

## (c) Call initiation model — CONFIRMED

### The decision

Notification lands → patient taps → app opens → the existing orb session starts
inside that tap → two-way spoken conversation. Not a phone call; a two-way chat
that opens itself.

**This is exactly what `voice-session.tsx` already implements**, and it satisfies
the `CLAUDE.md` mic-in-gesture rule for free. `begin()` at `:236-244` calls
`connect()` synchronously from `onClick`, and `connect()` reaches `getUserMedia`
before its first `await`. The work in (c) is a screen and a trigger, not a
session-lifecycle change.

### Confirmation against the docs

Nothing about this model is unusual for the platform. The browser flow the repo
uses — server-minted signed URL from
`GET /v1/convai/conversation/get-signed-url`, then `startSession({ signedUrl,
overrides })` — is the documented pattern for authenticated web sessions
([React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react),
[Overrides](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides)),
and per-session personalisation via `conversation_config_override` +
`dynamic_variables` is the same mechanism ElevenLabs' own telephony path uses
(`.claude/skills/elevenlabs-agents/references/outbound-calls.md:59-115`). We are
using the supported surface, not bending it.

What the gesture rule actually forbids and permits, precisely:

- **Forbidden:** a truly autonomous in-app start. No `setTimeout` at 8pm, no
  `useEffect` on mount, no post-navigation auto-start can open the microphone.
  Safari rejects `getUserMedia` and the user lands on the "Microphone access was
  blocked" branch at `voice-session.tsx:422-424`. This is a browser security
  invariant, not an SDK limitation, and there is no workaround.
- **Permitted:** everything except the microphone. The app may decide it is time,
  ring, vibrate, render a full-screen incoming-check-in card, and wait. The tap on
  **Answer** is the gesture. That tap is not a workaround for the constraint —
  it is what answering has always been.

### The notification mechanism — research and recommendation

Three tiers, and only two of them should be built.

**Tier A — in-app check-in card. Build this. It is the demo path.**
`IdleView` (`voice-session.tsx:353-408`) already has the orb at rest, a title, a
blurb and a primary CTA. Give it a variant that reads as an incoming check-in:
orb, "Juno — your evening check-in", a soft repeating tone, and one large
**Answer** button (plus "Not now"). Trigger it from a due-time check on the
server-rendered page or a client timer. Zero platform dependency, works on the
projector, on desktop, on any phone, and cannot be broken by a permission prompt.
Roughly an hour of work on components that already exist.

**Tier B — local notification. Optional garnish, Android/desktop only.**
The Notifications API can raise a real OS notification with no push server, no
VAPID, and no subscription storage: request permission inside a tap, then fire
`new Notification(...)` (or `registration.showNotification(...)`) from a client
timer while the page is open. Two constraints, both cited:

- `Notification.requestPermission()` **consumes transient activation in WebKit**,
  so it must be called from inside a click handler — not on load
  ([The User Activation API — WebKit](https://webkit.org/blog/13862/the-user-activation-api/),
  [MDN: Notification.requestPermission()](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)).
  A denial is sticky for days, so a mistimed prompt during setup can poison the
  demo device
  ([Pushpad: the notification prompt can only be triggered by a user gesture](https://pushpad.xyz/blog/the-notification-prompt-can-only-be-triggered-by-a-user-gesture)).
- **On iOS this does not work in a Safari tab at all** — see Tier C. So Tier B
  buys you a real notification on Android Chrome and on desktop, and nothing on
  an iPhone.

**Tier C — true Web Push. Do not build. Say the roadmap line instead.**
Apple's own announcement is unambiguous: "with iOS and iPadOS 16.4, we are adding
support for Web Push **to Home Screen web apps**", and "a web app that has been
added to the Home Screen can request permission to receive push notifications as
long as that request is in response to direct user interaction — such as tapping
on a 'subscribe' button", with the manifest's `display` member set to
`standalone` or `fullscreen`
([Web Push for Web Apps on iOS and iPadOS — WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
A regular Safari tab cannot receive push on iOS, at any version
([Safari on Mobile — Pushly](https://documentation.pushly.com/integration/web-browser-push/safari/safari-on-mobile-ios-ipados),
[PWA iOS Limitations and Safari Support](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)).

So on the most likely demo device, Web Push costs: a manifest, a service worker,
VAPID keys, a push-send route, subscription rows in KV, **and an
Add-to-Home-Screen step performed live in front of judges**, with a sticky
permission denial as the failure mode. That is a disproportionate amount of the
24h budget spent on the one component that is not the product, to make the demo
_more_ fragile. Plainly: **Web Push is too fragile to demo reliably in a 24h box.
Do not build it.**

The honest roadmap sentence, if a judge asks "how does she know to open the
app?": _"Web Push, once it's installed to the home screen — that's an iOS
platform requirement, not a design choice. For the demo we're showing the
check-in card the notification opens."_ That is true, complete, and costs nothing.

### What the demo operator does

Written as a runbook, because the operator has to be able to do it half-asleep.

**Before the demo**

1. Open the deployed URL on the demo phone (or the mirrored browser). Do **not**
   dismiss any permission prompt — none should appear on the Tier A path.
2. Seed state to day 7 with two prior misses on the clot-preventer, so the
   escalation rule is already primed and a refresh lands back at the interesting
   moment rather than at day 1.
3. Confirm the mic works with one throwaway tap-and-talk, then reload.
4. Leave the app on the check-in route, pre-notification.

**During beat 3** 5. Trigger the check-in — a due-time crossing, or a discreet operator control.
The screen flips to the incoming-check-in card and the tone plays. 6. Hand the phone to the presenter (or point at the mirror). Presenter taps
**Answer**. That tap is the gesture; the mic opens; the session starts. 7. Talk. Do not touch the address bar for the rest of the demo.

**If it goes wrong** 8. If the mic is refused, tap **Answer** again — the second tap is a fresh
gesture and usually clears it. 9. If ASR mishears (most likely on Welsh), type into the composer instead. It is
always live, it is never disabled on `!connected` (`composer.tsx:67`), and the
agent responds identically. Rehearse this so it looks deliberate.

### Revised demo beat 3 — concrete

Replace `plan/initial-idea.md:129`:

> 3. **The hero moment — Day 7:** the app _calls_ Margaret, in Urdu, and walks
>    her through today's meds. She's missed her clot-preventer twice → **Priya's
>    phone lights up, in Urdu:** _"Mum's missed her clot-prevention medicine
>    twice."_

with:

> **3. The hero moment — Day 7, evening.** Margaret's phone chimes with her
> check-in. The screen is the orb and one big **Answer**. She taps it, and Juno
> starts talking — **in Welsh**, by name.
>
> This is a conversation, not a form. Juno asks how she's feeling and waits.
> Then it walks today's steps one at a time — Juno's entire prompt is her own
> discharge letter, nothing else. She says she took the paracetamol; the step
> ticks off on screen while she is still talking. She admits she's skipped the
> clot-preventer again. Juno doesn't lecture — it logs it, and because the server
> can now see that's twice this week on a high-stakes med, it escalates.
>
> **Cut to the family view on the second screen:** Priya's card appears —
> _"Mum has missed her clot-prevention medicine twice."_ That state is in the
> database, not in a browser tab; she'd see it from two hours away.
>
> **4. The safe proactive beat** (unchanged in substance): Margaret mentions calf
> pain. Juno matches it against the red-flag lines the surgeon wrote, the
> surgeon's own sentence appears on screen, Juno reads it aloud verbatim and
> offers to help her call the number in the letter. It never names a condition.

Three notes. **Urdu → Welsh**: meeting 2 (`plan/raw-transcript.md:80`) supersedes
`plan/initial-idea.md:9`, `:125`, `:129`. **"The app calls Margaret" is retired as
a phrase** — "her check-in comes through and she answers" is what actually
happens and reads better than a claim someone can poke at. **The escalation is a
screen** — and with real persistence it is now a _true_ claim rather than the
scripted fake `plan/initial-idea.md:109` permitted.

### What the two-way-chat framing changes

This is the part of the decision with real configuration consequences. A
read-the-plan-at-you monologue and a two-way check-in want different turn-taking.

**Turn-taking — set `turn_eagerness: "patient"`.** The docs describe the three
modes as: Eager, "responds quickly to user input, jumping in at the earliest
opportunity"; Normal, "balanced turn-taking that works well for most
conversational scenarios"; Patient, "waits longer before taking its turn, giving
users more time to complete their thoughts. Ideal for collecting detailed
information"
([Conversation flow](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow)).
Our user is an elderly patient recovering from surgery being asked to recall
whether she took a tablet. Patient is the obvious choice, and the elsewhere-cited
guidance to use it "when collecting structured information" is precisely what a
medication check-in is.

**`turn_timeout` — raise it.** It "determines how long your assistant waits during
periods of user silence before taking the next turn", range 1–30 seconds
([Conversation flow](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow)).
The default is 7 (per `.claude/skills/elevenlabs-agents/references/agent-configuration.md:137`;
the live page does not state a default). Somewhere around 10 gives a slow speaker
room to finish without the agent talking over her. Tune it on the first test call
and then leave it alone.

**Interruptions — leave them on.** A two-way chat means she can cut in with "no,
wait, I did take it". Interruption is a client event and must be selected for the
behaviour to be enabled
([Conversation flow](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow)).
The one exception worth considering is `disable_first_message_interruptions`, so
the greeting — which carries the "I'm not a doctor" line — always completes.

**Soft timeout — probably leave off.** `soft_timeout_config` speaks a filler while
the LLM thinks (default message "Hhmmmm...yeah.", `timeout_seconds` 0.5–8.0,
default -1 / disabled)
([Conversation flow](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow)).
Two reasons to skip it: the repo already covers the gap _visually_ with
`TypingBubble` (`transcript.tsx:48-66`), and a health companion muttering
"hhmmmm" at a worried patient lands badly. If a server tool call makes the pause
long enough to notice, prefer `pre_tool_speech` on that specific tool — a warm,
purposeful "let me note that down" — over a generic filler.

**`firstMessage` — rewrite it, and it now has three jobs.** The current opener at
`check-in/page.tsx:15` is "Hello, it's Juno. How are you feeling today?" Under
the two-way framing it should (i) identify itself and why it's calling _now_,
(ii) carry the non-clinician line that `plan/initial-idea.md:90` correctly calls
a regulatory shield, and (iii) ask exactly one open question and stop. Something
in the shape of: _"Hello Margaret, it's Juno — your evening check-in. I'm not a
doctor; I just help you follow the plan your team gave you. How have you been
feeling today?"_ Leading with the open feelings question is deliberate: it is the
safe-capture design from `plan/initial-idea.md:86`, and it gets symptoms on the
record before the adherence questions make her defensive.

**The prompt rule at `check-in-prompt.ts:15` becomes more important, not less.**
"After you have greeted them, wait for them to answer. Do not read their whole
plan back to them." With the entire day-slice now in the prompt, the model's pull
toward reciting it goes up sharply. Strengthen that instruction: one step per
turn, wait for an answer, never enumerate.

**The composer stays.** `composer.tsx` is the ASR fallback, and it matters most in
Welsh — see (d).

### Outbound telephony, in two sentences

Cut per the decision. For the record and for a judge's question: the mechanism is
real and trivial (`POST /v1/convai/twilio/outbound-call`,
[API reference](https://elevenlabs.io/docs/api-reference/twilio/outbound-call),
with scheduling available via
[batch calling](https://elevenlabs.io/docs/eleven-agents/phone-numbers/batch-calls)),
but ElevenLabs does not sell numbers and a UK long code needs an approved Twilio
regulatory-compliance bundle whose review "generally takes up to three business
days"
([Twilio Phone Number Regulatory FAQ](https://www.twilio.com/docs/phone-numbers/regulatory/faq)) —
which does not fit in twenty-four hours. Separately, PSTN would have cost us the
screen and dropped the audio to G711 8 kHz
([SIP trunking](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking)),
so the in-app path is the better demo regardless of the calendar.

---

## (d) Welsh voice feasibility — verdict + fallback plan

### Bottom line: **GREEN, with conditions**

Welsh works in both directions — but only on a configuration the platform will
never give you by default, and **a wrong configuration fails silently rather than
loudly**. Every condition below is mandatory. Miss any one and you do not get an
error; you get an agent that mispronounces Welsh, or speaks English, in front of
judges.

**The conditions, in full:**

1. `conversation_config.tts.model_id = "eleven_v3_conversational"`. The API
   default is `eleven_flash_v2` — **English-only**.
2. Do **not** use the dashboard's "Additional Languages" flow. It pins the agent
   to v2.5 Multilingual, which has no Welsh.
3. Enable five Security-tab override toggles — all default `false`:
   `prompt.prompt`, `first_message`, `language`, `tts.voice_id`, `asr.keywords`.
4. Send `overrides.agent.language: "cy"` (ISO 639-1, not `cym`, not `cy-GB`).
5. Author the Welsh first message. Do not ship the dashboard's LLM
   auto-translation.
6. Add `latin-ext` to both `next/font/google` subset lists — **this repo has
   `["latin"]` only, at `app/layout.tsx:7` and `:16`.**
7. Choose the language before `startSession`. It is fixed for the call.

Ear-test it once. Silent degradation means the config cannot be validated by
reading code.

### The headline trap: the obvious route cannot produce a Welsh agent

This is the single most likely way the Welsh feature fails, and it fails quietly.

The agents language page says, verbatim: **"Additional languages switch the agent
to use the v2.5 Multilingual model. English will always use the v2 model"**
([Language](https://elevenlabs.io/docs/eleven-agents/customization/voice/customization/language)).
Multilingual v2.5 does not support Welsh. So the natural, documented, dashboard
route — open the agent, add a language — **lands you on a model that physically
cannot speak Welsh**, and tells you nothing.

It is worse than that at the API level. From ElevenLabs' live OpenAPI spec
(`https://api.elevenlabs.io/openapi.json`, fetched and parsed directly — 1.89 MB,
1372 schemas), `TTSConversationalConfig.model_id` carries
**`"default": "eleven_flash_v2"`**. Flash v2 is the _English-only_ model. A
freshly created agent is therefore not merely on a non-Welsh model, it is on a
monolingual one.

The fix is one field, and it must be set explicitly:

```json
{ "conversation_config": { "tts": { "model_id": "eleven_v3_conversational" } } }
```

The full enum, from the same spec (`TTSConversationalModel`):

```json
[
  "eleven_turbo_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2",
  "eleven_flash_v2_5",
  "eleven_multilingual_v2",
  "eleven_v3_conversational"
]
```

with `eleven_turbo_v2` and `eleven_turbo_v2_5` both flagged `deprecated: true`.

**Note for the spec writer:** `model_id` is marked `x-convai-client-override:
true`, and `TTSConversationalConfigOverrideConfig.model_id` exists — so the
_platform_ permits overriding the TTS model per session. The **installed browser
SDK cannot send it**: `constructOverrides()` in `@elevenlabs/client@1.15.2`
serialises only `voice_id`, `speed`, `stability` and `similarity_boost` under
`tts`, and `ConversationConfigOverrideTts` in `@elevenlabs/types@0.17.1` has no
`model_id`. **The model must be pinned on the agent, not from the client.**

### Model support, confirmed

Source: [Models](https://elevenlabs.io/docs/overview/models).

| Model                                    | Languages    | Welsh                                |
| ---------------------------------------- | ------------ | ------------------------------------ |
| `eleven_v3` / `eleven_v3_conversational` | 70+          | **YES** — "Welsh (cym)"              |
| `eleven_flash_v2_5`                      | 32           | No                                   |
| `eleven_flash_v2` (**API default**)      | English only | No                                   |
| `eleven_multilingual_v2`                 | 29           | No                                   |
| `eleven_turbo_v2_5` (deprecated)         | 31           | No                                   |
| Scribe v2 / v2 Realtime (STT)            | 90+          | **YES** — "Welsh (cym)", "Good" tier |

v3's published list ends "…Turkish (tur), Ukrainian (ukr), Urdu (urd),
Vietnamese (vie), **Welsh (cym)**". Two independent fetches returned Welsh both
times.

That `eleven_v3_conversational` inherits that coverage is confirmed by the agents
documentation itself: "Set your agent's TTS model to **V3 Conversational**",
described as "an ultra-low-latency version of Eleven v3, optimized for live,
back-and-forth dialogue", with **"70+ language support"** expanded from "~32
languages in Flash models", priced "the same as other ElevenLabs TTS models in
Agents, starting at $0.08 per minute"
([Expressive mode](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode)).
This also disposes of the reasonable worry that v3 is too slow for a live agent:
ElevenLabs shipped a latency-optimised v3 variant specifically for agents. Its
availability is confirmed four ways — the OpenAPI enum above, the
[create](https://elevenlabs.io/docs/api-reference/agents/create) and
[update](https://elevenlabs.io/docs/api-reference/agents/update) API references,
and the [9 February 2026 changelog](https://elevenlabs.io/docs/changelog/2026/2/9)
("Added `eleven_v3_conversational` to the available TTS models for agents").

### ASR — Welsh transcribes, at "Good" accuracy

Agents transcribe with Scribe v2 Realtime. Confirmed from the OpenAPI spec:
`ASRConversationalConfig.provider` defaults to `scribe_realtime`, and
`ASRProvider` enumerates exactly `["elevenlabs", "scribe_realtime"]` with
`elevenlabs` deprecated. There is no per-language ASR field — `agent.language`
drives it, described in the spec as **"Language of the agent - used for ASR and
TTS"**. One field, both directions.

Welsh (cym) sits in the third of five accuracy buckets, **"Good (>10% to ≤20%
WER)"**, against English at ≤5%
([Transcription](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)).

One caveat I owe you, because I flagged it as a blocker earlier and it turned out
to be softer than I read it. The tier table is introduced as "the WER for each
language that **Scribe v2** supports", which I initially read as batch-only. Two
things overturn that: the docs disambiguate explicitly with "(batch)" elsewhere on
the same page when they mean the batch model, so unqualified "Scribe v2" reads as
the generation; and **the tiers sum to 90 languages (34 + 20 + 18 + 18), exactly
matching the "90 languages" Scribe v2 Realtime advertises**
([Scribe v2 Realtime](https://elevenlabs.io/realtime-speech-to-text)). Same set.
Treat Welsh ASR as supported, and treat 10–20% WER as the realistic number.

That WER still matters, because under (b) a misheard answer now writes a row to a
database that drives escalation. Three mitigations, all cheap, all recommended
regardless:

1. **`overrides.asr.keywords`, seeded bilingually.** Supported in
   `BaseSessionConfig` and forwarded by `constructOverrides()`. Seed per session
   with the patient's actual medication names from the plan JSON plus Welsh _and_
   English affirm/deny tokens (`ydw`, `nac ydw`, `do`, `naddo`, `ie`, `nage`,
   `wedi`, `yes`, `no`) — Welsh speakers routinely code-switch on yes/no.
   **This needs its own Security toggle**: `ASRConversationalConfigOverrideConfig.keywords`
   is a boolean defaulting to `false`. (This resolves an item I had previously
   listed as unconfirmed.)
2. **Tappable Welsh answer chips.** A medication check-in is mostly closed
   questions. Render _Do, dwi wedi_ / _Naddo, ddim eto_ / _Dwi ddim yn siŵr_
   through the existing `SuggestedQuestions` component
   (`suggested-questions.tsx:6-45`, already ≥44px full-width rows) wired to
   `onAsk`. A tap sends text and bypasses ASR entirely. Better UX for a
   78-year-old than speech-only, and it makes the demo robust to a bad-audio room.
3. **Confirm before logging.** Required anyway now that `log_step` writes to a
   database: Juno reads back what it heard on any high-stakes step — "so that's
   the clot-prevention one taken, is that right?" — and logs only after
   confirmation.

The always-live composer (`composer.tsx`, submit disabled only when empty, never
on `!connected`, `:67`) is the final input fallback: typed Welsh reaches the LLM
with no ASR in the path at all.

### Unsupported language does not throw — it degrades silently

This is the reason every condition above is mandatory rather than advisory.

I searched the entire live OpenAPI spec: **zero occurrences of "Welsh", `"cy"` or
`cym` across 1.89 MB and 1372 schemas.** The agent language field is:

```json
"language": { "type": "string", "title": "Language",
              "description": "Language of the agent - used for ASR and TTS",
              "default": "en", "x-convai-client-override": true }
```

**No enum.** The override variant is `anyOf: [string, null]` — also no enum. So
`cy` is accepted by _any_ model, on _any_ agent, and validated by nothing. On a
model without Welsh you get no error and no warning: Scribe still transcribes the
Welsh, the LLM still answers in Welsh, and the TTS renders that Welsh text through
a voice model that has never seen the language. The result is the
starts-in-Welsh-then-turns-to-mush failure — **worse than not offering Welsh at
all**, because it fails mid-demo rather than at setup.

Two distinct failure modes, and they must not be conflated:

| Cause                                     | Symptom                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Override field not enabled in Security    | **Throws.** Surfaces as a red banner via `voice-session.tsx:150`. Loud, easy to debug. |
| `language: "cy"` on a model without Welsh | **Silent.** Mispronounced Welsh. Invisible until you listen.                           |

Only the first is catchable by code. The second is why the spike must be an
ear-test.

### CORRECTION 1 — overrides throw; the README says the opposite

`README.md:70-75` states that a disallowed override "is silently ignored and you
get the dashboard prompt instead". `voice-session.tsx:25-28` repeats it. **Both
are wrong.** The docs say: "An error will be thrown if an override is provided for
a field that does not have overrides enabled", and "For security reasons,
overrides are disabled by default"
([Overrides](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides)).

The OpenAPI spec confirms it mechanically — every override permission is a boolean
defaulting to `false`:

- `AgentConfigOverrideConfig`: `first_message`, `language`,
  `max_conversation_duration_message`, `prompt` (nested)
- `PromptAgentAPIModelOverrideConfig`: `prompt`, `llm`, `tool_ids`,
  `native_mcp_server_ids`, `knowledge_base`
- `TTSConversationalConfigOverrideConfig`: `model_id`, `voice_id`, `stability`,
  `speed`, `similarity_boost`
- `ASRConversationalConfigOverrideConfig`: `keywords`

**The spec must fix `README.md:70-75` and the comment at
`voice-session.tsx:25-28`.** This is a correctness fix to checked-in documentation,
not a nice-to-have — the current text will send someone hunting for a silent
failure that does not exist while ignoring a red banner that does.

For this build, enable: `prompt.prompt`, `first_message`, `language`,
`tts.voice_id`, `asr.keywords`.

### CORRECTION 2 — do not publish a Welsh text-expansion percentage

There is no citable Welsh-specific expansion figure; the standard reference tables
(Andiamo, W3C, General Translation) all omit Welsh. Measured gov.wales /
llyw.cymru parallel pages show prose at **length parity** (−0.5% characters),
while short labels ≤25 characters are **highly variable** — real pairs run −29% to
+100%.

The correct spec wording is a **rule, not a number**: Welsh prose needs no extra
space; never size a control to its English string. Any figure quoted in a spec
here would be invented.

### Welsh orthography — this repo will render fallback glyphs today

Thirteen Welsh characters sit outside the Google Fonts `latin` subset and inside
`latin-ext`:

**ŵ** U+0175, **Ŵ** U+0174, **ŷ** U+0177, **Ŷ** U+0176, **Ÿ** U+0178,
**ẁ** U+1E81, **Ẁ** U+1E80, **ẃ** U+1E83, **Ẃ** U+1E82, **ẅ** U+1E85,
**Ẅ** U+1E84, **ỳ** U+1EF3, **Ỳ** U+1EF2.

(â ê î ô û and their capitals are already in `latin`, which is why casual testing
misses this.)

**Confirmed against this repo, and it is currently broken.** `app/layout.tsx:7`
is `Hanken_Grotesk({ subsets: ["latin"], … })` and `:16` is
`Newsreader({ subsets: ["latin"], … })`. Neither includes `latin-ext`. The moment
a Welsh string containing _ŵ_ or _ŷ_ renders — and those are common; _dŵr_,
_sŵn_, _tŷ_, _blwyddyn newydd_ — it falls back to a system font mid-word.

One-line fix in both calls: `subsets: ["latin", "latin-ext"]`. Invisible until a
Welsh string appears, which is exactly why it needs to be in the spec rather than
found on stage. `CLAUDE.md` bans a monospace/fallback look in the UI; a fallback
glyph in the middle of a Welsh word is precisely that failure.

### Practical wiring — the remaining answers

**The exact value is `"cy"`.** The ConvAI protocol's generated enumeration —
`ConversationConfigOverrideAgentLanguage` in
`@elevenlabs/types@0.17.1/dist/generated/types/asyncapi-types.d.ts:58` — is 74
entries ending in `"cy"`. Not `"cy-GB"`, not `"cym"`. (`"ur"` is in there too;
Urdu was never blocked, it is simply no longer the story.)

**Watch the notation trap.** The same language is written three ways across three
ElevenLabs surfaces: `cy` (ISO 639-1) in the ConvAI agent language enum; `cym`
(ISO 639-3) in the TTS model language lists and the STT accuracy tables; either
form in the standalone realtime STT API, documented as "ISO 639-1 or ISO 639-3".
Use `cy` for `overrides.agent.language` and do not "correct" it.

**Language is fixed for the call.** No mid-call en↔cy switch, so the language must
be chosen before `startSession`. This is convenient rather than limiting: the
choice is a natural part of the incoming-check-in screen in (c), and it keeps the
gesture chain intact. (The `language_detection` system tool does exist and does
switch languages mid-conversation, but it requires the target languages to be
pre-registered in agent settings and would reopen the Additional-Languages trap
above. Do not enable it.)

**`language_presets`** lives on `ConversationalConfigAPIModel` (confirmed in the
spec). `LanguagePreset-Input` **requires** `overrides` (a
`ConversationConfigClientOverride`) and optionally takes
`first_message_translation` and `soft_timeout_translation`. Shape, verbatim from
the language page:

```json
"language_presets": {
  "cy": {
    "overrides": { "agent": { "first_message": "Helô Margaret, Juno sy'n galw." } }
  }
}
```

This is the platform-native way to bind a Welsh first message and a Welsh voice to
`cy` without branching in application code.

**Author the Welsh first message — do not ship the auto-translation.** The
dashboard translates first messages with an LLM. For a health product whose entire
defence is "we only reproduce words a human wrote", shipping a machine-translated
greeting is off-message as well as risky. Write it, have it checked, pin it.

**Voice ID — probably no change needed, but expect an English accent.** Language
capability is a property of the model, not the voice, so the repo's existing
`NEXT_PUBLIC_XI_VOICE_ID` should render Welsh once the model is pinned. Quality is
the open question: ElevenLabs' Welsh TTS page offers only the standard English
premade voices — Jessica, Laura, Alice, Bill, Brian — and claims only that "Our
TTS technology can adapt to various regional Welsh accents"
([Welsh Text to Speech](https://elevenlabs.io/text-to-speech/welsh)). **There is no
Welsh-native voice.** The Voice Library exposes a language filter that then reveals
an accent filter
([Which voices are native to a specific language?](https://help.elevenlabs.io/hc/en-us/articles/19450861739409-Which-voices-in-the-voice-library-are-native-to-a-specific-language));
a human should check it. If a better voice is found, pin it as
`NEXT_PUBLIC_XI_VOICE_ID_CY` or bind it through `language_presets`.

### The ten-minute spike — still do it, but it is now a check, not a gamble

1. Put a real key in `.env` (it currently holds `.env.example` placeholders).
2. `PATCH /v1/convai/agents/{id}` →
   `conversation_config.tts.model_id = "eleven_v3_conversational"`.
3. Security tab: enable `prompt.prompt`, `first_message`, `language`,
   `tts.voice_id`, `asr.keywords`.
4. One session with `overrides.agent.language: "cy"` and a two-line Welsh prompt.
   **Test the directions separately** — they fail independently:
   - **TTS:** does Juno speak intelligible Welsh? Judge by ear. There is no
     programmatic signal; a bad model produces confident mush.
   - **ASR:** speak two Welsh sentences and watch the user turns render
     (`voice-session.tsx:100-103`). Garbage or empty means the input path needs
     the tap/type mitigations to carry the demo.
5. Render a Welsh string containing _ŵ_ and _ŷ_ and confirm no fallback glyph.

Cost: one short call, a few thousand credits of ~1.8M.

### Fallbacks, if the spike surprises us

**Fallback 1 — Welsh UI, English voice, stated plainly.** The picker at
`components/language-picker.tsx:11-20` already carries `cy`. Translate the
check-in screen's own copy — title, blurb, suggested questions, status labels, the
incoming-check-in card — keep `language: "en"` and an English voice, and say so:
_"the interface is fully bilingual today; Welsh speech needs one model flag."_
This still delivers most of the meeting-2 requirement, which was itself as much a
UI claim as a voice one — `plan/raw-transcript.md:80` is _"the entire app could be
like whatever language you want"_.

**Fallback 2 — a single authored Welsh greeting.** Generate one Welsh
`firstMessage` through the v3 TTS endpoint ahead of time, play it on the Answer
tap, then continue in English. Narratively adequate, technically a cheat, worth it
only if the demo hinges on hearing any Welsh at all. Last resort.

### Do not wire the other six languages

`language-picker.tsx:11-20` lists `pl`, `ro`, `tr`, `pt`, `es`, `fr` as
showcase-only. All six are in the SDK's language union, so they would work — which
is exactly why it is tempting and exactly why it should not be done. Meeting 2
scoped two fully-functional languages. Keep the six as the "and it generalises"
line and leave the rows as no-ops (`:218`).

## What changed vs the prior assumption

**Against `plan/initial-idea.md`:**

**1. RAG → prompt injection.** `plan/initial-idea.md:43` (`grounded via RAG on
THIS patient's plan`), `:58` and `:72` should all be restated as prompt injection.
The source-attribution idea at `:58` goes with it —
`conversation.source_attribution` only reports knowledge-base sources, so with no
knowledge base there is nothing to attribute. The "everything traces to the
doctor's words" guarantee is not lost; it moves from a platform feature to a
property of how the prompt is built, and the prompt version is _stronger_ because
nothing is retrieved and nothing can be silently missed. Say that in the pitch.

**2. Outbound telephony → notification + tap + two-way chat.**
`plan/initial-idea.md:129` ("the app _calls_ Margaret") and `:107` ("scheduled
calls") assumed PSTN. Now decided against. `plan/initial-idea.md:77`'s push
notifications drop from Tier 3 to roadmap: iOS Web Push requires Add-to-Home-Screen
([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)),
which is too fragile to demo. Note that meeting 1 already preferred this shape —
_"get a notification click on it takes you to the app and it's like… voice mode…
orb talking to you"_ (`plan/raw-transcript.md:6`). The plan document drifted; the
original instinct was right.

**3. Urdu → Welsh.** `plan/initial-idea.md:9`, `:125` and `:129` are superseded by
_"English and Welsh"_ (`plan/raw-transcript.md:80`). The word "Urdu" does not
appear anywhere in the transcript. A strict improvement for a UK audience —
bilingual provision is a live statutory obligation for NHS Wales, making the
feature a compliance story rather than a nice-to-have. Urdu (`ur`) is in the SDK
union too, so nothing was lost; the story simply got better grounded.

Two things the plan document does not anticipate, both from (d). **The technical
cost is not zero:** the agent must be pinned to `eleven_v3_conversational`,
because the API default (`eleven_flash_v2`) is English-only and none of Flash
v2.5, Turbo v2.5 or Multilingual v2 lists Welsh — and the dashboard's own
"Additional Languages" flow actively undoes that fix. **And the failure mode is
silent, not loud:** there is no enum on `language` anywhere in ElevenLabs' API, so
a wrong model produces mispronounced Welsh rather than an error. Budget an ear-test,
not a unit test.

**Against my own original brief (superseded mid-track by the orchestrator):**

**4. No-database → Vercel Marketplace KV/Postgres + Blob.** This reverses (b).
Under the no-database constraint I recommended client tools only, because a Vercel
function's process memory is not a store. With real persistence, `log_step` and
`escalate_to_next_of_kin` become **server tools**, because the family view is a
different browser, the escalation rule is cross-day, and a tab refresh must not
erase the demo. One client tool survives, for the purely visual red-flag card.
The browser keeps its live UI via `onAgentToolRequest` / `onAgentToolResponse`
rather than a duplicate tool.

**5. "Skip dynamic variables" → use exactly three.** Also a consequence of
persistence. A server tool must not learn the patient's identity from the LLM;
`patient_id` and `check_in_id` are bound as dynamic variables, and a
`secret__`-prefixed variable authenticates the webhook via a header
([Dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)).

**Three corrections to files already in this repo.** These are not deltas against
the plan; they are defects the spec should schedule as small, explicit tasks.

**C1 — `README.md:70-75` and `voice-session.tsx:25-28` are factually wrong.** Both
say a disallowed override "is silently ignored and you get the dashboard prompt
instead". The docs say it throws, and every override permission in the OpenAPI
spec is a boolean defaulting to `false`. Left as-is, the checked-in documentation
will send someone hunting for a silent failure that does not exist while ignoring
a red banner that does. See Correction 1 in (d).

**C2 — `app/layout.tsx:7` and `:16` load `subsets: ["latin"]`.** Thirteen Welsh
characters (ŵ Ŵ ŷ Ŷ Ÿ ẁ Ẁ ẃ Ẃ ẅ Ẅ ỳ Ỳ) live in `latin-ext`. Welsh text will break
into a fallback font mid-word. One-line fix in two places.

**C3 — no Welsh text-expansion percentage may be published.** No citable figure
exists. The spec must state a rule instead: Welsh prose is at length parity with
English; short labels are highly variable; never size a control to its English
string. See Correction 2 in (d).

---

## Could not confirm

Stated plainly rather than guessed. Items 1–2 are the only ones a human must
resolve before the Welsh work can be called done.

1. **Whether Welsh appears in the dashboard's "Additional Languages" dropdown
   under V3 Conversational.** The docs say the "All" option gives 31 languages and
   never enumerate them; `help.elevenlabs.io` returns 403 to automated fetches.
   **A logged-in human must check this in the dashboard.** Note it may not matter:
   the recommendation in (d) is to avoid that flow entirely and pin the model plus
   `language_presets` directly, precisely because the dropdown pins v2.5
   Multilingual. But if the dropdown _is_ the only way to register `cy`, that
   changes the setup steps.
2. **Whether the ear-test passes.** Silent degradation (see (d)) means no
   automated check can confirm Welsh TTS is correctly configured. Someone has to
   listen to it once, and ideally someone who speaks Welsh.
3. **Whether a Welsh or Welsh-accented voice exists in the Voice Library.** The
   Welsh marketing page lists only standard English premade voices. The Library's
   language+accent filter needs a human to run. Not blocking — the default voice
   should render Welsh once the model is pinned — but it decides how good it
   sounds.
4. **The exact JSON-schema syntax for binding a dynamic variable to a tool
   parameter.** The skill reference documents `dynamic_variable`,
   `constant_value`, `is_system_provided` and `is_omitted` as property fields
   (`.claude/skills/elevenlabs-agents/references/client-tools.md:489-491`); the
   live docs describe only the dashboard flow ("set the value type to Dynamic
   variable"). Confirm against the agent-create API reference before writing the
   tool definitions in (b).
5. **The webhook-tool request/response payload and timeout semantics.** The
   server-tools doc pages 404'd under several URL shapes. The skill reference gives
   `{ tool_call_id, tool_name, parameters, conversation_id }` in, `{ result }` out,
   `response_timeout_secs` default 20 / range 5–120
   (`client-tools.md:78-114`, `:174-182`). Unverified against live docs, and (b)
   depends on it — verify early.
6. **Any hard character/token ceiling on a system-prompt override.** None
   documented anywhere, and the OpenAPI spec puts no `maxLength` on the field. The
   practical bound is the chosen LLM's context window
   (`GET /v1/convai/llm/list` reports per-model token limits). Irrelevant at our
   size, but do not claim a number.
7. **The default value of `turn_timeout`.** The live
   [Conversation flow](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow)
   page gives the 1–30 s range but no default; the skill reference says 7
   (`agent-configuration.md:137`). Read the agent's current value rather than
   assuming.
8. **Anything exercised against a live workspace.** The local `.env` holds
   `.env.example` placeholders (`XI_API_KEY` = `sk_` + 44 `x`); a probe of
   `GET /v1/models` returned `401 invalid_api_key`. Schema-level claims in this
   report are verified against ElevenLabs' live OpenAPI spec
   (`https://api.elevenlabs.io/openapi.json`, fetched and parsed directly);
   behavioural claims are from documentation or from installed SDK source. No
   conversation was ever started.

**Resolved since the first draft, and worth recording because they were open
questions:**

- _Does Scribe v2 Realtime transcribe Welsh?_ **Yes.** The accuracy tiers sum to
  90 languages, exactly matching Realtime's advertised count, and Welsh (cym) is
  in the "Good" tier. My earlier reading of that table as batch-only was wrong.
- _Does `eleven_v3_conversational` exist for agents?_ **Yes** — confirmed in the
  live OpenAPI `TTSConversationalModel` enum.
- _Does an unsupported `language` value throw?_ **No** — the field has no enum
  anywhere in the spec. It degrades silently, which is worse and drove the
  restructuring of (d).
- _Does `overrides.asr.keywords` need a Security toggle?_ **Yes** —
  `ASRConversationalConfigOverrideConfig.keywords`, default `false`.
- _Is the "silently ignored" override behaviour in our README correct?_ **No.**
  See Correction 1 in (d).

---

## Residual risk

Ordered by expected damage.

**Highest — a wrong Welsh configuration produces no error, only bad audio.** The
`language` field has no enum anywhere in ElevenLabs' OpenAPI spec, so `cy` is
accepted on a model that cannot speak it and degrades at runtime into mispronounced
Welsh. There is no log line, no exception, no red banner — nothing a test or a
type-check can catch. **This is the only risk in this report that cannot be
mitigated by code**, and the mitigation is procedural: pin
`conversation_config.tts.model_id = "eleven_v3_conversational"` (the API default is
`eleven_flash_v2`, which is English-only), then have a human listen once. Everything
else in (d) is downstream of this.

**High — the dashboard's own "Additional Languages" flow walks you into it.**
"Additional languages switch the agent to use the v2.5 Multilingual model", which
has no Welsh
([Language](https://elevenlabs.io/docs/eleven-agents/customization/voice/customization/language)).
The documented, obvious route silently undoes the fix above. Anyone touching the
agent config needs to know not to use it — put it in the spec, not in someone's
head.

**High — the server-tool URL cannot point at localhost.** ElevenLabs' backend
makes the call. Development against a dev machine needs a tunnel, and per-commit
preview URLs move under you. Decide on a stable production alias early and put
the URL in the agent config once. This is the most likely cause of a silent
"the tool never fires" afternoon.

**Medium — Welsh ASR is real but weak, and it now writes to a database.** Welsh
sits at 10–20% WER against English's ≤5%
([Transcription](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)).
A misheard "naddo" writes a wrong adherence row, which drives the escalation rule
and shows up on Priya's screen. Mitigated three ways, all required, none optional:
`overrides.asr.keywords` seeded bilingually from the plan's drug names (remember
its own Security toggle), tap-to-answer Welsh chips that bypass ASR entirely, and
a prompt rule requiring Juno to confirm what it heard before logging anything
high-stakes.

**Medium — Welsh text will render in a fallback font until someone adds
`latin-ext`.** `app/layout.tsx:7` and `:16` both load `subsets: ["latin"]`, which
omits ŵ, ŷ, ẁ, ẃ, ẅ, ỳ and their capitals. Common Welsh words (_dŵr_, _sŵn_,
_tŷ_) will break mid-word into a system font — the exact "AI tell" `CLAUDE.md`
bans. One-line fix in two places, invisible until the first Welsh string appears.

**Medium — client-tool errors paint a red banner on the projector.**
`voice-session.tsx:150` routes every SDK error, including a mistyped tool name, to
a `role="alert"` box over the transcript. The one surviving client tool must never
throw, and tool-scoped errors should be routed away from the connection banner.

**Medium — `onUnhandledClientToolCall` will hang the agent.** If anyone adds it
without also sending a `client_tool_result`, the SDK returns early and the agent
waits indefinitely. It looks exactly like a network stall. Do not add it.

**Medium — `agent_tool_request` / `agent_tool_response` are not enabled by
default.** The live-UI design in (b) depends on them, they must be set in the
agent's `client_events`, and they **cannot** be set per session from the browser
(`constructOverrides()` serialises only `text_only` under `conversation`). The
symptom is callbacks that never fire and a UI that never ticks.

**Medium — a notification permission prompt at the wrong moment.** If Tier B is
built, `Notification.requestPermission()` must be called from inside a tap, and a
denial is sticky for days
([WebKit: The User Activation API](https://webkit.org/blog/13862/the-user-activation-api/),
[Pushpad](https://pushpad.xyz/blog/the-notification-prompt-can-only-be-triggered-by-a-user-gesture)).
A careless test on the demo device can poison it before the pitch. If Tier B is
built at all, test it on a _different_ device.

**Low — override enforcement bites at the first Welsh session.** If `language` is
not enabled in Security, the Welsh session throws where the English one did not.
Enable all four override fields at once during the spike.

**Low — concurrent sessions.** Prompt injection is per-socket, so two people
opening the demo do not collide. This risk exists only if someone reintroduces a
per-patient knowledge base. Don't.

**Low — the demo state gets ahead of the story.** With real persistence, a
rehearsal run now leaves rows behind. There must be a one-click reseed to "day 7,
two prior misses" or the fourth rehearsal will start from an escalated state.

**Low — scope creep back toward open-web Q&A.** `plan/raw-transcript.md:6` floats
ElevenLabs web search and "take actions on behalf of me"; `plan/initial-idea.md:99`
cuts the first and `:119` warns about the second. Both are still tempting at 4am
and both break the guiding principle. Hold the line.
