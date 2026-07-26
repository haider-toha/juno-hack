# 12 — Track 1: demo flow plumbing

Date: 2026-07-26. Branch `haider/track-a`. Mode under test: `PORTICO_MODE=demo`
on `http://localhost:3000`.

---

## Scope

Making the demo arc **mechanically complete** in demo mode. Voice stays real.
Extraction stays baked — `lib/extraction/`, OpenAI, the AI Gateway and
`make eval` were not touched.

Built, in order:

1. `components/voice/idle-view.tsx` — the declared handshake extraction. Landed
   first, mechanically, and handed to Track 2. They have since restyled it; I
   have not touched it again.
2. `lib/check-in-prompt.ts` — `buildCheckInPrompt` / `buildFirstMessage` (B3).
3. `lib/escalation/rules.ts` — pure `assess()` (B5).
4. `app/api/log/route.ts` + `app/api/escalate/route.ts` — the two ElevenLabs
   server tools (B4).
5. `/family` + `components/family/*` (B8, B9).
6. The incoming check-in card, driven by real Redis state (B10, Tier A).
7. `/operator` + `app/api/demo/*` (B10.5).
8. Voice tool wiring — `show_red_flag` client tool, `onAgentToolRequest` /
   `onAgentToolResponse` live tick (B6, B7).

Not built, deliberately: Web Push, service workers, the Notifications API, a
second agent (B3.6 — the C2 gate passed), Resend email (L7), vitest (L8).

**One `SUGGESTED_QUESTIONS` note:** the plan's B3 asks to fix
"Is this normal after surgery?". It was **already gone** when I arrived —
`lib/i18n/en.ts` carries four plan-grounded questions and a comment saying why
it was cut. Nothing to do. The prompt now additionally forces the
route-to-human answer for anything not in the plan.

---

## Grounding notes — ElevenLabs, read before the code was written

Docs have moved from `/docs/agents-platform/…` to `/docs/eleven-agents/…`.
Appending `.md` to any docs URL returns the raw markdown, which is the only
readable form. Several of the fields this task depends on are documented **only**
in the OpenAPI spec, not in the prose guide.

Sources used:

- [Webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools)
- [Create tool (API ref)](https://elevenlabs.io/docs/api-reference/tools/create)
- [Create workspace secret](https://elevenlabs.io/docs/api-reference/workspace/secrets/create)
- [Dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)
- [Environment variables](https://elevenlabs.io/docs/eleven-agents/integrate/environment-variables)
- [Client tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools)
- [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react)
- [Client events](https://elevenlabs.io/docs/eleven-agents/customization/events/client-events)
- [Agent WebSocket AsyncAPI](https://elevenlabs.io/docs/eleven-agents/api-reference/eleven-agents/websocket)
- [Changelog 2026-02-09](https://elevenlabs.io/docs/changelog/2026/2/9)
- [OpenAPI](https://api.elevenlabs.io/openapi.json) → `WebhookToolConfig-Input`
- Installed SDK on disk: `@elevenlabs/client@1.15.2`, `@elevenlabs/react@1.10.2`,
  `@elevenlabs/types@0.17.1`

### G1 — `tool_error_handling_mode`: the plan's premise is **wrong**

Task B4 says "the default narrates tool errors aloud, which on a projector is
worse than silence." The OpenAPI description says the opposite:

> `'auto'` determines handling based on tool type (**summarized for native
> integrations, hide for others**), `'summarized'` sends an LLM-generated
> summary, `'passthrough'` sends the raw error, `'hide'` does not share the
> error with the agent.

A custom webhook tool is not a native integration, so the **default `auto`
resolves to `hide`** — the agent is never told. That is the behaviour B4 wanted.
I still set it **explicitly to `hide`** in the tool config below, because a
default that resolves conditionally is a default that can change.

Introduced in the 2026-02-09 changelog. **Unconfirmed:** what the pre-existing
behaviour was, so the plan's claim may have been true when it was written.

### G2 — `response_timeout_secs`

Sibling of `api_schema`, not inside it. Default **20**, allowed range **5–120**
for webhook tools (1–120 for client tools). Documented only in the OpenAPI.
I set **8**: long enough for a Vercel cold start, short enough that a stalled
tool does not eat a 60-second take.

### G3 — `request_headers` + `secret_id` is the authentication mechanism

`request_headers` is `{ [headerName]: <one of four shapes> }`, and there is
**no `type` discriminator** (I had assumed one; wrong):

```jsonc
{
  "Content-Type": "application/json", // literal string
  "X-Portico-Tool-Secret": { "secret_id": "..." }, // ConvAISecretLocator
  "X-Tenant": { "variable_name": "..." }, // ConvAIDynamicVariable
  "X-Api-Key": { "env_var_label": "..." }, // ConvAIEnvVarLocator
}
```

`ConvAISecretLocator` is exactly `{ "secret_id": string }` and nothing else.
Create the secret with `POST /v1/convai/secrets`:

```jsonc
// request                                    // response
{ "type": "new",                              { "type": "stored",
  "name": "portico_tool_secret",                "secret_id": "...",
  "value": "<hex>" }                            "name": "portico_tool_secret" }
```

ElevenLabs resolves it **server-side**; the value never reaches the browser.
`env_var_label` also exists (workspace environment variables, per-environment
values), and is the better choice if this ever ships to more than one
environment.

### G4 — why `secret__` dynamic variables are **not** request auth [confirms C7]

The docs only claim this much:

> Secret dynamic variables … indicate to our ElevenAgents that these should
> only be used in dynamic variable headers and **never sent to an LLM
> provider** …

The guarantee is scoped to the **LLM provider**. Nothing claims confidentiality
from the browser, and three things prove there is none:

1. The documented way to supply them is
   `Conversation.startSession({ dynamicVariables: { … } })` — from page JS.
2. The same page documents passing them **in a URL query string**
   (`?vars=<base64>`, `&var_user_name=John`). A value that survives in a
   shareable URL is not a credential.
3. Installed SDK, `@elevenlabs/client@1.15.2`
   `dist/utils/overrides.js:31–32`:
   ```js
   export const CONVERSATION_INITIATION_CLIENT_DATA_TYPE =
     "conversation_initiation_client_data";
   if (config.dynamicVariables) {
     overridesEvent.dynamic_variables = config.dynamicVariables;
   }
   ```
   The **browser** builds that frame. Anything in it is readable and forgeable
   in devtools.

So: `secret__` hides a value from the LLM; `secret_id` hides it from the client.
Only the second authenticates a request. **Unconfirmed:** no single docs page
states this contrast — the conclusion follows from the two mechanisms.

### G5 — binding a parameter so the model cannot fill it

`value_type` does **not exist in the OpenAPI** (it is the dashboard's UI label
and appears in the legacy `parameters`-array form). The REST field is
`dynamic_variable`, set directly on the property. `LiteralJsonSchemaProperty`
carries the note _"IMPORTANT: Only ONE of the following fields can be set"_ —
`description` (LLM fills it), `dynamic_variable` (**LLM cannot**),
`constant_value`, `is_system_provided`, `is_omitted`,
`allowed_values_dynamic_variable`.

Built-in `system__` variables, available with no runtime configuration and
**not** overridable from the client: `system__agent_id`,
`system__conversation_id`, `system__time_utc`, `system__time`,
`system__timezone`, `system__caller_id`, `system__called_number`,
`system__call_duration_secs`, `system__call_sid`, `system__agent_turns`,
`system__current_agent_id`, `system__current_agent_turns`,
`system__current_subagent_turns`, `system__is_text_only`,
`system__conversation_history`.

**This changed my design.** I had planned to generate a `check_in_id` in the
browser. `system__conversation_id` is the platform's own call identifier, needs
nothing from the client, and cannot be forged from the client. `check_in_id` is
now bound to it. Only `patient_id` is sent from the browser, and it is identity
for the handler to key on — never authentication.

Note the docs' constraint: _"The `dynamic_variables` field must contain all
dynamic variables defined for the agent."_ Adding a custom dynamic variable to
the agent means adding it to `startSession` too, or the session fails.

### G6 — client tools in `@elevenlabs/react`

Signature confirmed on disk
(`@elevenlabs/react@1.10.2/dist/conversation/ConversationClientTools.d.ts`):

```ts
useConversationClientTool<TTools, TName>(name: TName, handler: TTools[TName]): void;
```

Positional, returns `void`, no schema and no runtime validation — parameters
arrive as `Record<string, unknown>`, which is why `voice-session.tsx` narrows
before using `flag_id`. Tools auto-unregister on unmount; the handler always
sees the latest closure. `buildClientTools` **throws** if a hook-registered name
collides with one passed via options, so `show_red_flag` is registered in
exactly one place.

Throw behaviour, from `@elevenlabs/client` `dist/BaseConversation.js`: a throw
calls local `onError(...)` **and** sends
`{ result: "Client tool execution failed: <msg>", is_error: true }`. `onError`
is what paints the red banner over the transcript, so the handler returns a
plain string on the unknown-id path instead of throwing. Return values are
coerced (`typeof result === "object" ? JSON.stringify(result) : String(result)`),
and `ClientToolResult` is `string | number | void`, so a string is returned
rather than an object.

`onUnhandledClientToolCall` is **not** supplied. Confirmed in source: providing
it causes an early `return` and **no `client_tool_result` is sent at all**. With
`expects_response: true` that stalls the agent for the whole
`response_timeout_secs`, and there is no public API to send the result manually
(`connection` is `protected`). The plan's warning is correct and stricter than
the docs, which say nothing.

### G7 — `agent_tool_request` / `agent_tool_response`

`agent_tool_request` is **absent from the prose docs entirely**; its only schema
is the AsyncAPI reference. Wire shape:

```yaml
AgentToolRequest:
  required:
    [
      tool_name,
      tool_call_id,
      tool_type,
      event_id,
      expects_response,
      disable_interruptions,
      response_timeout_secs,
      execution_mode,
    ]
AgentToolResponse:
  required: [tool_name, tool_call_id, tool_type, is_error, event_id, is_called]
```

**There is no `parameters` field on `agent_tool_request`** — the event says
which tool fired, not with what. That is why the live tick shows "Making a
note…" and not the arguments: the arguments are not on the wire.

The callback receives the **inner object, not the envelope**, and
`onAgentToolResponse` is a union that also fires for
`agent_tool_response_full_payload`. The installed `@elevenlabs/types@0.17.1`
declares only four fields on `AgentToolRequest` and is **out of date** versus the
wire — harmless here, since only `tool_name` is read.

`client_events` has 24 valid values and **no published default**. C4 already put
`agent_tool_request`, `agent_tool_response` and `client_tool_call` on the agent,
so — per the brief — I did **not** re-PATCH `conversation_config` and did not
risk the C1 per-locale model pins.

### G8 — the localhost trap, stated honestly

No docs sentence says "the tool URL must be publicly reachable". The strongest
documented statement is the OpenAPI description of `WebhookToolConfig`:

> A webhook tool is a tool that **calls an external webhook from our server**.

ElevenLabs' backend originates the request, so `http://localhost:3000`
is unreachable **by construction**. Environment-variable docs additionally
require URLs to begin with `https://`. See "Residual risk" for what this costs
on the night.

---

## Beat checklist

`make arc` runs beats 1–7 headlessly and asserts each one. Full output below.

| #   | Beat                                                        | Result          | Evidence                                                                                           |
| --- | ----------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| 1   | `idle-view.tsx` extracted and handed over                   | **PASS**        | File exists; Track 2 has since restyled it (`text-lg` blurb, new comment)                          |
| 2   | Plan-aware system prompt composed from the stored bundle    | **PASS**        | Prompt dump below — real ids, doses, red flag, tool rules                                          |
| 3   | Plan-aware `firstMessage`                                   | **PASS**        | `Hello Harold, it's Portico. I have 4 things on your plan for today. …`                            |
| 4   | Same, in authored French                                    | **PASS**        | `Bonjour Harold, c'est Portico. J'ai 4 choses à votre plan …`                                      |
| 5   | `assess()` → `none` / `nudge` / `alert-kin`                 | **PASS**        | All three rendered on `/family`; transitions below                                                 |
| 6   | `/api/log` rejects an unauthenticated call                  | **PASS**        | `401 {"error":"unauthorized"}`                                                                     |
| 7   | `/api/log` writes with the shared secret                    | **PASS**        | `200 {"ok":true,"item_id":"med-apixaban","day":"2026-07-27"}`                                      |
| 8   | `/api/log` rejects an id not in the plan                    | **PASS**        | `422 {"error":"unknown_item","item_id":"med-nonexistent"}`                                         |
| 9   | `/api/log` rejects a malformed body                         | **PASS**        | `400 {"error":"invalid_arguments", …}`                                                             |
| 10  | `/api/escalate` rejects unauthenticated                     | **PASS**        | `401 {"error":"unauthorized"}`                                                                     |
| 11  | `/api/escalate` records a miss, names next of kin           | **PASS**        | `200 {… "next_of_kin":"Daughter", "tell_the_patient":"…"}`                                         |
| 12  | Two **voice-tool** misses over 2 days ⇒ `alert-kin`         | **PASS**        | none → nudge → alert-kin, driven only by `/api/log`                                                |
| 13  | `/family` renders the escalation and the missed days        | **PASS**        | Chips `Missed on 2026-07-25`, `Missed on 2026-07-26`                                               |
| 14  | `/family` poller runs 6s with no console error              | **PASS**        | Playwright: `console/page errors: none`                                                            |
| 15  | Operator raises a check-in ⇒ phone flips **without reload** | **PASS**        | Playwright: flipped to `"Portico — your check-in"` after **4559 ms**                               |
| 16  | Answering clears the raised flag                            | **PASS**        | `DELETE /api/demo/check-in` → `{"raisedAt":null}`; wired into `begin()`                            |
| 17  | Demo clock moves (±1 day and explicit date)                 | **PASS**        | `{"today":"2026-07-28"}` then back to `{"today":"2026-07-27"}`                                     |
| 18  | Operator panel renders live state                           | **PASS**        | Screenshot; shows `Mode demo`, `assess() alert-kin — Apixaban 5mg (…)`                             |
| 19  | `/api/demo/*` and `/api/seed` refused outside demo mode     | **PASS**        | Live-mode server on :3200 — all five routes 403, see below                                         |
| 20  | Re-seeding is a **total** reset regardless of the clock     | **PASS**        | X1 below — a future-day key written after advancing the clock is cleared                           |
| 21  | `/family` prints human dates in both locales                | **PASS**        | `Missed on Saturday 25 July` / `Manquée le samedi 25 juillet`                                      |
| 22  | `pnpm typecheck` + `pnpm lint` clean                        | **PASS**        | Both exit 0                                                                                        |
| 23  | **A real voice call actually invoking `log_step`**          | **PASS** (`17`) | Real agent → `https://juno-hack.vercel.app/api/log`; `toolexec_2201…`, Vercel `POST /api/log 200`  |
| 24  | **`show_red_flag` fired by a real agent**                   | **PASS** (`17`) | `client_tool_call` with `flag_id: flag-worsening-chest-infection` — the real id from the letter    |
| 25  | **The live tick from a real `agent_tool_request`**          | **PASS** (`17`) | `agent_tool_request` received in all three live sessions, carrying `tool_name` and no `parameters` |
| 26  | **French voice ear-test since these changes**               | **UNTESTED**    | B11's job; the French prompt/first message compose, the audio was not heard                        |

### `make arc`, full output

```
Portico demo arc → http://localhost:3000

1 · reset
  PASS  seed returns the Whitfield plan
2 · clock
  PASS  clock reads the seeded day
  PASS  clock moves a day
  PASS  clock moves back
3 · escalation, from the seeded misses
  PASS  family escalates to next of kin
4 · escalation clears when the misses are answered
  PASS  one answered miss drops it to a nudge
  PASS  both answered clears it
5 · the ElevenLabs server tools
  PASS  log_step refuses an unauthenticated call
  PASS  log_step writes with the shared secret
  PASS  log_step rejects an id that is not in the plan
  PASS  escalate refuses an unauthenticated call
  PASS  escalate records a miss and names the next of kin
6 · the raised check-in
  PASS  nothing is ringing to start with
  PASS  the operator can ring it
  PASS  the phone can see it ringing
  PASS  answering clears it
7 · the screens
  PASS  the check-in prompt carries a real plan item
  PASS  the opening line is plan-aware
  PASS  the operator panel renders

8 · leaving the app seeded and ready to film
  today is now 2026-07-27, apixaban missed twice

19 passed, 0 failed
```

### The escalation arc, driven only by the ElevenLabs tool path

```
$ curl -sS -X POST localhost:3000/api/seed
{"patientId":"demo","today":"2026-07-27","letters":[…],"plan":"seed/02-whitfield",
 "medications":7,"redFlags":1,
 "missed":{"itemId":"med-apixaban","days":["2026-07-26","2026-07-25"]}}

# clear the seeded misses so nothing but the tool drives the arc
baseline  /family → "Nothing needs your attention."

$ curl -sS -X POST localhost:3000/api/log -H "x-portico-tool-secret: $SECRET" \
    -d '{"patient_id":"demo","check_in_id":"conv_A","item_id":"med-apixaban","status":"missed"}'
{"ok":true,"item_id":"med-apixaban","day":"2026-07-27"}
after 1   /family → "A dose was missed."

$ curl -sS -X POST localhost:3000/api/demo/clock -d '{"shiftDays":1}'
{"today":"2026-07-28"}
$ curl -sS -X POST localhost:3000/api/log -H "x-portico-tool-secret: $SECRET" \
    -d '{"patient_id":"demo","check_in_id":"conv_B","item_id":"med-apixaban","status":"missed"}'
{"ok":true,"item_id":"med-apixaban","day":"2026-07-28"}
after 2   /family → "A dose that matters was missed twice."
          chips: "Missed on 2026-07-27", "Missed on 2026-07-28"
```

Two writes on the **same** day collapse into one, because
`(patientId, itemId, day)` is the idempotency key. That is deliberate and was
observed live: answering twice in one check-in cannot manufacture an escalation.

### The composed prompt, read back off the wire

Extracted from the RSC payload of `GET /check-in`, abridged after the persona:

```
[… the authored persona, verbatim from lib/i18n/en.ts …]

## Who you are speaking to
Harold.

## When
2026-07-27
Days since they came home from hospital: 2

## Their plan for today
Each step's id is in brackets. Ids are for the tools only. Never read one out loud.
- [med-apixaban] Apixaban 5mg: 1 tab, BD, Oral, Ongoing (important) — Stops clots forming, because your heartbeat is irregular (atrial fibrillation).
- [med-metformin] Metformin 500mg: 1 tab, BD, Oral, Ongoing (reduced)
- [med-atorvastatin] Atorvastatin 20mg: 1 tab, Nocte, Oral, Ongoing
- [med-tiotropium] Tiotropium 18mcg: 1 puff, OD, Inhaled, Ongoing

## Standing advice, with no particular day
- [med-salbutamol] Salbutamol 100mcg inh: 2 puffs, PRN, Inhaled, Ongoing
- [inst-antibiotics] Both counselled on signs of worsening chest infection, …
- [inst-falls] Patient/daughter counselled as above re infection signs, …

## Already answered for today
Nothing has been answered for today yet.

## Recently missed
- [med-apixaban] 2026-07-26
- [med-apixaban] 2026-07-25

## What the letter says to watch out for
Read the trigger and the action as the letter wrote them. Do not add symptoms and do not soften the action.
- [flag-worsening-chest-infection] breathless, feverish or confused again → Advised to seek urgent help

## What you can do
- When the person tells you they have taken or missed one of today's steps, call log_step …
- Only pass an id from the list above. If you cannot tell which step they mean, ask which one …
- If they describe something in the watch-out list above, call show_red_flag …
- If they cannot take a step that the plan marks as important … call escalate_to_next_of_kin …
- You do not decide what counts as serious enough to escalate a pattern. You report what
  happened; the app works out the rest.
```

### The incoming check-in, in a real browser

Headless Chromium, `/check-in` open and untouched, operator rings from another
process:

```
clear: 200 {"raisedAt":null}
h1 before ring: "Let's check in."
ring:  200 {"raisedAt":"2026-07-25T23:25:54.594Z"}
PASS: flipped to "Portico — your check-in" after 4559ms
shows 'Answer' button: true
shows incoming label: true
operator shows mode row: true
operator shows assess(): true
family after one poll cycle: A dose that matters was missed twice.
console/page errors: none
```

### Live-mode refusal, on a second server

`NEXT_PUBLIC_PORTICO_MODE` is compiled into the bundle, so this needed its own
server rather than an env flip on :3000 (which would have taken Track 2's
screenshots into live mode mid-shoot). A copy of the tree with
`NEXT_PUBLIC_PORTICO_MODE=live`, on :3200, torn down afterwards. :3000 was never
touched.

```
GET  /api/demo/check-in -> {"message":"The operator controls only exist in demo mode, and this app is running in live mode."} [403]
POST /api/demo/check-in -> {"message":"The operator controls only exist in demo mode, …"} [403]
POST /api/demo/clock    -> {"message":"The operator controls only exist in demo mode, …"} [403]
POST /api/demo/log      -> {"message":"The operator controls only exist in demo mode, …"} [403]
POST /api/seed          -> {"message":"The seed overwrites the stored plan with the demo bundle, and this app is running in live mode, so it has not run."} [403]
/operator               -> renders "— these controls are refused outside demo mode"
```

---

## X1 — cross-track finding from Track 2: the seed's reset was not a reset

**Reported by Track 2, in my domain, fixed here.** Confirmed real before touching
anything — `portico:log:demo:2026-07-28` was sitting in the live store:

```
log keys BEFORE fix:
["portico:log:demo:2026-07-25","portico:log:demo:2026-07-26","portico:log:demo:2026-07-28"]
```

**Cause.** The seed cleared a 7-day window counted **backwards** from today:

```ts
const window = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
await redis().del(...window.map((day) => logKey(DEMO_PATIENT_ID, day)));
```

The demo clock moves. An answer written while the clock was parked further
forward lands on a day no backwards window reaches, so it survives what looks
like a reset. Track 2 saw it render on `/plan` as "Tuesday 28 July · Day 3" with
apixaban missed, and masked it in presentation — correctly, a day you cannot yet
answer for must not show an answer — but the key was still there.

**Why it matters, and why it is a D9 problem rather than a cosmetic one.**
Advance the clock past that day and `assess()` counts the residue. Three missed
doses in three days instead of two means the escalation on camera would have been
produced by **rehearsal residue, not by the seed**. The whole claim of the
operator panel — real state, real code paths, nothing painted — depends on the
reset actually resetting.

**Fix.** `lib/store/log.ts` gains `clearLog(patientId)`, which SCANs
`portico:log:<patient>:*` and deletes what it finds, so the reset is total
whatever the clock has done. It returns the keys it removed, and the seed
response names them, so the operator can **see** the stale day go rather than
trust that it did. The seed also now clears a raised check-in, for the same
reason: a take that ended mid-call must not leave the next one already ringing.

**Verified with a real curl**, exactly the sequence asked for — advance the clock
three days, write a miss on that future day, re-seed, read the log back:

```
$ node --env-file=.env.local -e "…scan portico:log:demo:*…"
["portico:log:demo:2026-07-25","portico:log:demo:2026-07-26","portico:log:demo:2026-07-28"]

$ curl -sS -X POST localhost:3000/api/demo/clock -d '{"shiftDays":3}'
{"today":"2026-07-30"}

$ curl -sS -X POST localhost:3000/api/demo/log \
    -d '{"itemId":"med-apixaban","day":null,"status":"missed"}'
{"itemId":"med-apixaban","day":"2026-07-30","status":"missed"}

$ …scan again…
["…07-25","…07-26","…07-28","…07-30"]        ← two days no backwards window reaches

$ curl -sS -X POST localhost:3000/api/seed
{"patientId":"demo","today":"2026-07-27", …,
 "missed":{"itemId":"med-apixaban","days":["2026-07-26","2026-07-25"]},
 "clearedLogDays":["portico:log:demo:2026-07-25","portico:log:demo:2026-07-26",
                   "portico:log:demo:2026-07-28","portico:log:demo:2026-07-30"]}

$ …scan again…
["portico:log:demo:2026-07-25","portico:log:demo:2026-07-26"]   ← exactly the seed
```

`make arc` still 19/19 afterwards.

### X2 — `/family` printed raw ISO dates. **Taken.**

It now says "Missed on Saturday 25 July", matching the rest of the app.

It does **not** reuse `formatDay` from `components/plan/day-section.tsx`: that
one is pinned to `en-GB`, which is right on a screen that is English-only and
wrong here — it would print an English weekday on the French dashboard, which is
the silent English fallthrough D9 bans. `components/family/escalation-card.tsx`
has its own three-line locale-aware formatter instead. Verified in both:

```
EN  ('Missed on', 'Saturday 25 July')    ('Missed on', 'Sunday 26 July')
FR  ('Manquée le', 'samedi 25 juillet')  ('Manquée le', 'dimanche 26 juillet')
```

The `.tnum` class went with the ISO dates — tabular figures are for columns of
numerals, not for prose dates.

### X3 — `/operator` rendered env-var names in monospace. **Taken.**

The `<code>` tags are gone; the variable name carries itself in the body face.
The panel is now free of the one typeface this project bans, which matters
because it is in shot if the camera widens. This removes what was R8 below.

---

## What changed, file by file

### New

| File                                    | What it is                                                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/voice/idle-view.tsx`        | The handshake. Idle view extracted from `voice-session.tsx`, plus an `incoming` variant flag. **Track 2's from the moment it landed.**                               |
| `lib/check-in-prompt.ts`                | `buildCheckInPrompt` + `buildFirstMessage`. Pure — `today` and the log are arguments, nothing reads Redis or the clock.                                              |
| `lib/escalation/rules.ts`               | `assess(bundle, logs, today)` → `none \| nudge \| alert-kin`, plus `assessmentWindow(today)`. Imports nothing `server-only`. The threshold lives here and only here. |
| `lib/store/check-in.ts`                 | `raiseCheckIn` / `clearCheckIn` / `readIncomingCheckIn`. 15-minute TTL so a rehearsal cannot leave the next take ringing.                                            |
| `app/api/log/route.ts`                  | `log_step`. Header auth, Zod at the boundary, id validated against the stored plan, `day` taken from the demo clock (never model-filled).                            |
| `app/api/escalate/route.ts`             | `escalate_to_next_of_kin`. Records a real miss and stops. Does **not** set an "escalated" flag — `assess()` decides that.                                            |
| `app/api/demo/demo-only.ts`             | `refuseOutsideDemo()`. One guard, three routes.                                                                                                                      |
| `app/api/demo/check-in/route.ts`        | GET / POST / DELETE on the raised-check-in state.                                                                                                                    |
| `app/api/demo/clock/route.ts`           | `{day}` or `{shiftDays}`. A shift is computed server-side from the current demo day.                                                                                 |
| `app/api/demo/log/route.ts`             | Answer for a step, through `appendLogEntry()`.                                                                                                                       |
| `app/(phone)/family/page.tsx`           | `force-dynamic`, `Promise.all`, `assess()`, `EscalationCard`. Phone-shell rule respected — `flex min-h-0 flex-1 flex-col`, no `dvh`/`vh`.                            |
| `components/family/escalation-card.tsx` | Exhaustive `switch` on the union. Three tones, one shape.                                                                                                            |
| `components/family/refresh-poller.tsx`  | `setInterval(() => router.refresh(), 5000)`, cleanup, returns `null`.                                                                                                |
| `app/operator/page.tsx`                 | The control panel. Outside `(phone)`, desktop width, `robots: {index:false}`, labelled "Operator — not part of the product", never linked.                           |
| `components/operator/control.tsx`       | One button → one route → show the response verbatim → `router.refresh()`.                                                                                            |
| `components/operator/clock-control.tsx` | ±1 day and a date field.                                                                                                                                             |
| `scripts/demo-arc.sh`                   | `make arc`. Drives the arc, asserts each beat, leaves the app seeded.                                                                                                |

### Edited

| File                                 | Change                                                                                                                                                                                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/voice/voice-session.tsx` | Functional wiring only. Idle markup removed (now the leaf). Added: `patientId` / `incomingAt` / `redFlags` props, `dynamicVariables: { patient_id }`, `show_red_flag` via `useConversationClientTool`, `onAgentToolRequest`/`onAgentToolResponse` live tick, the idle-only poll, and clearing the flag on answer. |
| `app/(phone)/check-in/page.tsx`      | Now `force-dynamic` and async over `Promise.all([getLocale, getDemoToday, readPlan, readIncomingCheckIn])`, composes the prompt, passes the new props.                                                                                                                                                            |
| `lib/store/keys.ts`                  | `incomingCheckInKey(patientId)`.                                                                                                                                                                                                                                                                                  |
| `lib/store/log.ts`                   | `clearLog(patientId)` — SCAN + DEL over `portico:log:<patient>:*`, returning what it removed. See X1.                                                                                                                                                                                                             |
| `app/api/seed/route.ts`              | Reset is now total: `clearLog` + `clearCheckIn` replace the backwards 7-day window, and the response names `clearedLogDays`. See X1.                                                                                                                                                                              |
| `lib/env.ts`                         | `toolEnv()` → `PORTICO_TOOL_SECRET`, with the C7 reasoning in the comment.                                                                                                                                                                                                                                        |
| `lib/i18n/en.ts` / `fr.ts`           | New keys only, authored in both: `voice.{incomingLabel,incomingTitle,incomingBlurb,answer,noting}`, `persona.firstMessage*`, the `family` block, the `checkInPrompt` block. **No existing copy was rewritten.**                                                                                                   |
| `Makefile`                           | `operator`, `ring`, `unring`, `clock`, `miss`, `arc`.                                                                                                                                                                                                                                                             |
| `.env.example`                       | Documents `PORTICO_TOOL_SECRET` and why it is not a `secret__` variable.                                                                                                                                                                                                                                          |
| `.env.local`                         | A generated `PORTICO_TOOL_SECRET` (not committed).                                                                                                                                                                                                                                                                |

`lib/store/clock.ts` and `lib/plan/samples/demo-plan.ts` were in my remit and
needed no change — the seed already primes exactly the history `assess()` reads,
and the clock's demo-mode guard was already correct.

### Two design decisions worth flagging

**The `/check-in` poll is client-side, not `router.refresh()`.** `/family` uses
the poller exactly as B9 specifies. `/check-in` does not, and deliberately:
`router.refresh()` on that route would re-run the Server Component **every five
seconds during a live voice call**. The incoming card only matters while the
screen is idle, so the poll lives in `voice-session.tsx`, gated on
`phase === "idle"`, and stops the instant the call starts. Nothing polls across
a live session. The server still renders the initial state, so a fresh load
never flashes the wrong card.

**`escalate_to_next_of_kin` writes a log entry and nothing else.** It does not
set an "escalated" flag. If it did, the family card would be repeating a model's
judgement back to a relative. `assess()` reads the log and reaches the
conclusion, which is what lets the card say "missed twice in 3 days" and mean
it [Locked D9].

---

## How to run the demo arc locally

At 2am, in order. Nothing here needs a browser devtools window.

```bash
# 0 · once, if it is not already there
grep -q PORTICO_TOOL_SECRET .env.local || \
  echo "PORTICO_TOOL_SECRET=$(openssl rand -hex 24)" >> .env.local
grep NEXT_PUBLIC_PORTICO_MODE .env        # must say demo

# 1 · run it
make dev                                   # :3000

# 2 · prove every beat works, in one command (another terminal)
make arc                                   # 19 assertions, ends seeded

# 3 · open the two screens
open http://localhost:3000/check-in        # the phone
make operator                              # the laptop → /operator
```

Then, on camera:

| Beat                | Do this                                       | You should see                                          |
| ------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Reset between takes | Operator → **Reset to the seeded state**      | `Today 2026-07-27`, `assess() alert-kin — Apixaban 5mg` |
| The call arrives    | Operator → **Ring the check-in on the phone** | Phone flips to "Portico — your check-in" within 5s      |
| Answer it           | Tap **Answer** on the phone                   | Mic prompt, then the plan-aware opening line            |
| The escalation      | Open `/family` on a second device             | "A dose that matters was missed twice", with both dates |
| Move a day          | Operator → **+1 day**                         | Plan, check-in and family all move together             |

Headless equivalents, if the panel is not on screen:

```bash
make seed                                  # reset
make ring                                  # raise the check-in
make unring                                # cancel it
make clock SHIFT=1                         # or: make clock DAY=2026-07-28
make miss ITEM=med-apixaban DAY=2026-07-26 # arm the escalation by hand
```

---

## The ElevenLabs tool config, ready to paste

**Prerequisite — create the workspace secret once** (this is what makes
`secret_id` available; the value is the same `PORTICO_TOOL_SECRET` the app has):

```bash
curl -X POST https://api.elevenlabs.io/v1/convai/secrets \
  -H "xi-api-key: $XI_API_KEY" -H "Content-Type: application/json" \
  -d '{"type":"new","name":"portico_tool_secret","value":"<PORTICO_TOOL_SECRET>"}'
# → {"type":"stored","secret_id":"SECRET_ID_HERE","name":"portico_tool_secret"}
```

Then create the two tools. **Replace `https://PORTICO_HOST` with a public
HTTPS origin** — see "Residual risk".

### `log_step`

```json
{
  "tool_config": {
    "type": "webhook",
    "name": "log_step",
    "description": "Record that the person has taken or missed one step of today's recovery plan. Call once per step, only with an id from the plan in the system prompt. Do not announce the call.",
    "response_timeout_secs": 8,
    "tool_error_handling_mode": "hide",
    "interruption_mode": "allow",
    "pre_tool_speech": "auto",
    "api_schema": {
      "url": "https://PORTICO_HOST/api/log",
      "method": "POST",
      "content_type": "application/json",
      "request_headers": {
        "Content-Type": "application/json",
        "X-Portico-Tool-Secret": { "secret_id": "SECRET_ID_HERE" }
      },
      "request_body_schema": {
        "type": "object",
        "properties": {
          "patient_id": { "type": "string", "dynamic_variable": "patient_id" },
          "check_in_id": {
            "type": "string",
            "dynamic_variable": "system__conversation_id"
          },
          "item_id": {
            "type": "string",
            "description": "The id in square brackets next to the step in the plan, for example med-apixaban. Never invent one."
          },
          "status": {
            "type": "string",
            "description": "Exactly 'taken' or 'missed'."
          }
        },
        "required": ["patient_id", "check_in_id", "item_id", "status"]
      }
    }
  }
}
```

### `escalate_to_next_of_kin`

```json
{
  "tool_config": {
    "type": "webhook",
    "name": "escalate_to_next_of_kin",
    "description": "Leave a note on the family view when the person cannot take a step the plan marks as important and seems to need someone. Never say anyone has been called or messaged.",
    "response_timeout_secs": 8,
    "tool_error_handling_mode": "hide",
    "interruption_mode": "allow",
    "pre_tool_speech": "auto",
    "api_schema": {
      "url": "https://PORTICO_HOST/api/escalate",
      "method": "POST",
      "content_type": "application/json",
      "request_headers": {
        "Content-Type": "application/json",
        "X-Portico-Tool-Secret": { "secret_id": "SECRET_ID_HERE" }
      },
      "request_body_schema": {
        "type": "object",
        "properties": {
          "patient_id": { "type": "string", "dynamic_variable": "patient_id" },
          "check_in_id": {
            "type": "string",
            "dynamic_variable": "system__conversation_id"
          },
          "item_id": {
            "type": "string",
            "description": "The id of the medicine they could not take, from the plan."
          },
          "reason": {
            "type": "string",
            "description": "One short plain sentence in the person's own words about why."
          }
        },
        "required": ["patient_id", "check_in_id", "item_id", "reason"]
      }
    }
  }
}
```

### `show_red_flag` (client tool — runs in the browser, no URL)

```json
{
  "tool_config": {
    "type": "client",
    "name": "show_red_flag",
    "description": "Put one of the letter's warning lines on the person's screen while you read the action aloud. Only use an id from the watch-out list in the system prompt.",
    "expects_response": true,
    "response_timeout_secs": 5,
    "parameters": {
      "type": "object",
      "properties": {
        "flag_id": {
          "type": "string",
          "description": "The id in square brackets next to the warning, for example flag-worsening-chest-infection."
        }
      },
      "required": ["flag_id"]
    }
  }
}
```

The name is **case-sensitive** and must match
`useConversationClientTool("show_red_flag", …)` exactly.

### ⚠️ CORRECTION (2026-07-26) — creating the tools is only half the job

**This section was incomplete in a demo-breaking way. Fixed in `17`, which has
also now executed the whole runbook live.** Read this before following the steps
above.

`POST /v1/convai/tools` creates a tool that **no agent can call**. The returned
id must then be attached to the agent at
`conversation_config.agent.prompt.tool_ids`. Verified live: before that PATCH the
agent read back `prompt.tool_ids = []` — the two tools existed, validated, and
were unreachable. The legacy inline `prompt.tools` field was **removed from write
requests in July 2025**; `tool_ids` is the only supported mechanism.

**The bold instruction below — "do not re-PATCH `conversation_config`" — is
therefore impossible to obey and still have working tools**, because `tool_ids`
lives inside `conversation_config`. Its intent (protect the C1 per-locale TTS
pins) is right; its rule is too broad. The correct procedure is **narrow PATCH,
then diff**:

```bash
# 1 · save the whole config first
curl -sS "https://api.elevenlabs.io/v1/convai/agents/$AGENT_ID" \
  -H "xi-api-key: $XI_API_KEY" -o agent-BEFORE.json

# 2 · PATCH exactly one leaf path and nothing else
curl -X PATCH "https://api.elevenlabs.io/v1/convai/agents/$AGENT_ID" \
  -H "xi-api-key: $XI_API_KEY" -H "Content-Type: application/json" \
  -d '{"conversation_config":{"agent":{"prompt":{"tool_ids":["<log_step id>","<escalate id>","<show_red_flag id>"]}}}}'

# 3 · read back and diff against agent-BEFORE.json — assert BOTH pins survived:
#     tts.model_id == eleven_flash_v2
#     language_presets.fr.overrides.tts.model_id == eleven_flash_v2_5
#     client_events unchanged (12 values)
```

**The PATCH deep-merges** — verified: 118 `conversation_config` leaf keys before,
118 after, and only `tool_ids` (plus its read-only `tools` expansion) changed.
Both model pins and the full `client_events` list survived untouched. So the
narrow PATCH is safe; a _wide_ one still is not.

`show_red_flag` needs attaching too — it is a client tool, but it is still
dispatched by the platform, so an empty `tool_ids` leaves it as dead as the other
two. This closes what R2 below calls "wired but never exercised".

Live tool ids and the workspace `secret_id` are in `17`; all three tools have now
been fired by a real agent against the deployed routes, closing beats 23–25.

### Checks before the demo

- `client_events` must contain `client_tool_call`, `agent_tool_request` and
  `agent_tool_response`. **C4 says they already do — read the agent back rather
  than re-PATCHing them.** (See the correction above for the one PATCH you _do_
  need, and how to make it safely.)
- The agent's **Security** tab must allow the overrides already in use
  (prompt, first message, language, TTS voice). Dynamic variables need no
  allow-listing; overrides do.
- The docs note: the `dynamic_variables` frame must carry **every** dynamic
  variable the agent declares. The browser sends only `patient_id`;
  `system__conversation_id` is supplied by the platform. Adding another custom
  variable to the agent means adding it to `startSession` too.

---

## Residual risk — what will break on camera

### R1 — ✅ CLOSED (2026-07-26) by the deploy in `17`

**Option 1 below was taken.** Portico is deployed at
`https://juno-hack.vercel.app` with `PORTICO_TOOL_SECRET` set on Vercel
Production and the build serving demo mode. Both webhook tools point at that
stable alias, all three tools are attached via `tool_ids`, and **a real agent has
now called `log_step`, `escalate_to_next_of_kin` and `show_red_flag` against the
deployed routes** — confirmed independently by the ElevenLabs tool-execution
ledger, Vercel runtime logs (`POST /api/log 200`) and the app's own rendered
state. Beats 23–25 are **PASS**. Details, ids and rollback in `17`.

Two things this replaces R1 with, both in `17`: production is a snapshot of an
**uncommitted working tree**, so redeploy before filming; and local and
production **share one Redis**, so pick one host for the take.

The original analysis, kept because the reasoning still holds:

ElevenLabs' backend originates the webhook call, so
`http://localhost:3000/api/log` is unreachable. **Beats 21–23 are UNTESTED for
this reason, and will stay untested until the app has a public HTTPS origin.**

Three options, best first:

1. **Deploy to Vercel and point the tools at the production URL.** The stable
   alias is what B4 asked for. Everything else in the arc already works against
   Redis and Blob, which are shared, so a deployed instance and the laptop see
   the same state. Set `PORTICO_TOOL_SECRET` in the Vercel project env, and set
   `NEXT_PUBLIC_PORTICO_MODE=demo` for the take.
2. **A tunnel** (`ngrok http 3000` / `cloudflared`). Works, but the URL changes
   on every restart, which means re-editing the tool config mid-rehearsal —
   exactly what B4 warned against.
3. **Do not demo the tool beat.** The arc still shows the plan-aware call, the
   escalation and the family dashboard, all real. The operator panel writes the
   same `LogEntry` the tool writes, through the same `appendLogEntry()`, so the
   escalation on camera is genuine either way — it is simply the operator, not
   the agent, that reported it. **Say so if asked. Do not imply the agent did it.**

**This is the one thing only a human can unblock.** It needs a deploy (or a
tunnel) plus five minutes in the ElevenLabs dashboard pasting the two configs
above.

### R2 — ✅ CLOSED (2026-07-26) by `17`

Both have now been seen firing from a real agent session. `show_red_flag` was
called with `flag_id: "flag-worsening-chest-infection"` — an id from the letter,
not invented — and `agent_tool_request` arrived carrying `tool_name` and, as G7
predicted, **no** `parameters`. One correction to the text below: the client tool
was not merely unexercised, it was **unattached** — `prompt.tool_ids` was empty,
so the platform could never have called it. See the correction above.

The original note follows.

### R2 (original) — 🟡 `show_red_flag` and the live tick are wired but never exercised

Both depend on the platform calling into the session. The client tool is
registered under the exact name above, narrows its argument, and cannot throw.
The tick reads `tool_name` off `agent_tool_request`. Neither has been seen
firing. If `show_red_flag` is not registered on the agent, nothing happens and
nothing breaks — the failure mode is silence, not an error banner.

### R3 — 🟡 `NEXT_PUBLIC_PORTICO_MODE` needs a server restart

It is compiled into the client bundle, so the panel **displays** it and says
plainly why it cannot flip it. If someone edits `.env` mid-session, restart the
dev server or half the app will disagree about the mode.

### R4 — 🟡 The incoming card takes up to 5 seconds

Measured 4.56s on the slow path. If the shot is tight, ring it a beat early, or
have the operator ring it while the camera is still on the laptop.

### R5 — 🟡 The demo clock and the log window interact

`assess()` looks at today and the two days before it. Move the clock forward
three days and the seeded misses fall out of the window and the escalation
disappears — correctly, but surprisingly. **Reset after moving the clock a long
way.** Since X1 the reset is total, so this is now recoverable with one tap
rather than requiring Redis surgery.

### R6 — 🟢 The French voice has not been re-heard since these changes

The French prompt and first message compose correctly (evidence above), and
nothing here touches `tts.model_id` or the language preset. B11's pre-demo
ear-test still stands and is still required — HTTP 200 proves nothing.

### R7 — 🟢 `/family` is not access-controlled

Anyone who knows the URL sees the demo patient's card. There is one patient and
no auth anywhere in this build, so this is consistent, not new. Worth one
sentence if a judge asks.

### R8 — ✅ Closed by X3

The operator panel no longer uses inline `<code>`, so nothing on any screen
renders in monospace.

### R9 — 🟢 `clearLog` scans, which is O(keyspace)

One patient and a handful of days, so it is two round trips. If this ever grew a
real patient table, `SCAN` across the whole keyspace per seed would be the wrong
shape — but the seed only exists in demo mode, and demo mode has one patient.

---

## X4 — the opening shot: "Clear the letter", and the malformed-body 500

Date: 2026-07-26, after Track 3's adversarial pass
(`14-track-3-adversarial-verify.md`). Two changes, both from that report's
findings. Verified against the same `:3000` demo server, which was left up and
seeded.

### Why it exists

Track 3 §2 marks the home story **PASS (mechanism) / FAIL (against the brief)**:
in the state you actually film — seeded — home leads with "Start today's
check-in" and the letter is the third row, so a viewer never learns the product
is built from a discharge letter. Their item 5 says to decide the opening shot
deliberately. **The decision is: open on an empty plan.** Home then shows "Take
a photo of your letter", the letter is uploaded on camera, the plan appears,
then the check-in, then the escalation.

That needs the **history without the plan**, and nothing could reach it. The
seed is a total reset by design (X1) — plan, clock and log together — so it
gives you the primed misses and a plan. Deleting `portico:plan:demo` by hand in
a Redis console, which is what Track 3 did to prove the empty state exists, is
not a thing to do at 2am with a camera running.

### What was added

| File                              | What                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `lib/store/plan.ts`               | `clearPlan(patientId)` — deletes the plan key and nothing else.                                                          |
| `lib/store/log.ts`                | `logDays(patientId)` — the SCAN, now shared. `clearLog` is written on top of it; its signature and return are unchanged. |
| `app/api/demo/plan/route.ts`      | `DELETE`. Same shape as its three neighbours: `refuseOutsideDemo()` first, then the write, then read the state back.     |
| `app/operator/page.tsx`           | The button, in "1 · Set the stage" under Reset. The Plan row's empty text no longer says "run the seed".                 |
| `components/operator/control.tsx` | A third `tone`, `destructive`. `primary` and `normal` render identically to before.                                      |
| `Makefile`                        | `make clear-letter`.                                                                                                     |
| `scripts/demo-arc.sh`             | Beat 8, "the empty opening shot". Also tightened the vacuous clock assertion — see below.                                |

**It writes real state through real code paths [D9].** No plan stored is the
state every account is in before its first letter is read: `readPlan` already
returns `null` for it, and home, `/plan`, `/family` and `/check-in` all name it.
The app cannot tell an account cleared here from one that never had a letter,
which is exactly what makes this a legitimate button and not a painted screen.

The response names what survived, the way the seed names what it removed, and
the panel prints it verbatim — so the operator **sees** the primed misses
survive rather than trusting they did:

```
{"plan":null,"today":"2026-07-27","keptLogDays":["2026-07-25","2026-07-26"]}
```

The button is the one red-edged control on the page. The edge carries the
warning and the label does not: `error` is 4.31:1 on white, which clears the
3:1 a UI boundary needs and misses the 4.5:1 a run of words needs, so the words
stay `ink` — the same reasoning the `@theme` block already applies to that
token. The hint names what goes **and** what is kept, because both are on
camera if the shot widens.

### Verified by actually doing it

Full sequence, real curl against `:3000`, with Redis read directly rather than
through the app at each step.

**1 · Seed — plan and two log entries exist**

```
$ curl -sS -X POST localhost:3000/api/seed
{"patientId":"demo","today":"2026-07-27","letters":[…],"plan":"seed/02-whitfield",
 "medications":7,"redFlags":1,"missed":{"itemId":"med-apixaban","days":["2026-07-26","2026-07-25"]},
 "clearedLogDays":["portico:log:demo:2026-07-25","portico:log:demo:2026-07-26"]}

$ …scan Upstash directly…
log keys : ["portico:log:demo:2026-07-25","portico:log:demo:2026-07-26"]
plan key : 1
clock    : "2026-07-27"
  portico:log:demo:2026-07-25 → ["med-apixaban","{"id":"seed-missed-2026-07-25", … "status":"missed" …}"]
  portico:log:demo:2026-07-26 → ["med-apixaban","{"id":"seed-missed-2026-07-26", … "status":"missed" …}"]

/family → "A dose that matters was missed twice."
```

**2 · Clear the letter**

```
$ curl -sS -X DELETE localhost:3000/api/demo/plan
DELETE /api/demo/plan → 200
{"plan":null,"today":"2026-07-27","keptLogDays":["2026-07-25","2026-07-26"]}
```

**3 · Home falls back to the empty state — and the log is still there**

```
$ curl -sS localhost:3000/ | …every <a href> on the page…
href="/upload"                                    ← one door, nothing else tappable
"Take a photo of your letter"
"Your plan appears here once we have read your letter. Then I check in with you each day."

/plan   → 200  h1 "No plan yet"
/family → 200  h1 "Family view"

$ …scan Upstash directly…
log keys    : ["portico:log:demo:2026-07-25","portico:log:demo:2026-07-26"]   ← survived
plan key    : 0   (gone)
patient key : 1   (survived)
clock       : "2026-07-27"                                                    ← survived
```

**4 · Upload on camera restores a plan through the real path.** Not a curl at
`/api/extract` — Playwright driving the actual `<input type="file">` on
`/upload`, i.e. `@vercel/blob/client upload()` → `/api/blob/upload` →
`/api/extract` → `writePlan` → `router.push`:

```
home doors  : ["Take a photo of your letter"]        ← tapped the only one
landed on   : /upload
upload→plan : 1160ms, now at /plan
plan h1     : "Your recovery plan"
console/page errors: none
```

**5 · `/family` still computes `alert-kin` from the surviving history**

```
/family → "A dose that matters was missed twice."  ·  Apixaban 5mg
          "Missed on Saturday 25 July"  "Missed on Sunday 26 July"
          "Two missed doses in 3 days is why you are seeing this. It has not been reported to anyone else."
/operator assess() row → alert-kin — Apixaban 5mg (2026-07-25, 2026-07-26)

$ …scan Upstash directly…
log keys : ["portico:log:demo:2026-07-25","portico:log:demo:2026-07-26"]   ← never touched
plan key : 1                                                               ← restored by the upload
clock    : "2026-07-27"
```

The escalation on camera is therefore produced by the seeded history that
predates the take, and the plan on camera is produced by the letter that was
photographed during it. Neither is painted.

**Edge case, since the arc never hits it:** `clearLog`'s zero-key branch. Every
log key deleted by hand, then both routes run — `redis().del()` is not called
with no arguments:

```
DELETE /api/demo/plan → {"plan":null,"today":"2026-07-27","keptLogDays":[]} [200]
POST   /api/seed      → "clearedLogDays":[]
```

**`make arc` is now 21 assertions, 21 passed, 0 failed**, ending seeded as
before. Beat 8 seeds, clears the letter, and asserts on the exact surviving
days — which is also the on-camera procedure: reset, clear, roll.

```
8 · the empty opening shot
  PASS  clearing the letter keeps the primed misses and the clock
  PASS  the panel sees no plan stored
9 · leaving the app seeded and ready to film
  today is now 2026-07-27, apixaban missed twice
21 passed, 0 failed
```

### The malformed-body 500 — Track 3 §7 / L2. Fixed.

`await request.json()` in both server-tool routes had no `.catch`, so a body
that was not JSON threw before Zod and Next returned a bare 500 with an empty
body. `app/api/extract/route.ts:16` and `app/api/blob/upload/route.ts:46`
already had the pattern; both routes now match it.

```
                                          before          after
POST /api/log       --data 'not json'     500, 0 bytes →  400 {"error":"invalid_arguments","detail":"… expected object, received null"}
POST /api/escalate  --data 'not json'     500, 0 bytes →  400 {"error":"invalid_arguments","detail":"… expected object, received null"}
POST /api/log       empty body            500, 0 bytes →  400 {"error":"invalid_arguments", …}
POST /api/escalate  empty body            500, 0 bytes →  400 {"error":"invalid_arguments", …}
```

Every path that already worked, re-proved unchanged: `/api/log` no header
`401`, wrong-shape JSON `400`, unknown item `422`; `/api/escalate` empty reason
`400`. Beat 9 of the table above ("rejects a malformed body — PASS 400") is now
true for **any** body, not only JSON-shaped ones.

### Also taken, in a file already being edited: L7

`scripts/demo-arc.sh` asserted `"today":"` for "clock moves a day", which a
route that ignored `shiftDays` and echoed today would satisfy. It now asserts
the date it should land on. Adding new assertions to a harness while leaving a
known-vacuous one beside them would have undercut the count.

### What was NOT re-verified

The 403 outside demo mode. `DELETE /api/demo/plan` calls `refuseOutsideDemo()`
as its first statement, byte-identical to the three neighbouring routes Track 3
proved 7-of-7 on a live-mode server — but that live-mode server was not stood
up again for this route, because the only way to do it is a second copy of the
tree while two other agents are editing it. The guard is shared and proven; this
specific route's 403 is inferred, not observed. **If anyone stands a live-mode
server up again, add `DELETE /api/demo/plan` to the sweep.**

`pnpm typecheck` and `pnpm lint` both exit 0.
