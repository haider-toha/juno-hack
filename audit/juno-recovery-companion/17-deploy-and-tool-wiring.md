# 17 — Deploy, and the ElevenLabs tools actually wired

Date: 2026-07-26. Branch `haider/track-a`. Target: `https://juno-hack.vercel.app`
(Vercel project `haider-projects/juno-hack`; the slug is legacy, the product is
**Portico**).

---

## Scope

Closing the single biggest hole in the demo: `/api/log` and `/api/escalate` were
built, authenticated and curl-verified, but **no real ElevenLabs agent had ever
invoked them**, because ElevenLabs' backend cannot reach `localhost` (12 §R1,
beats 23–25 `UNTESTED`).

Done here, in order: ground against today's docs → audit and complete the Vercel
production env → deploy → create the workspace secret → create the tools against
the production URL → **attach them via `tool_ids`** (the gap 14 §7b flagged) →
prove all three fire from a real agent session.

**Beats 23, 24 and 25 are now PASS.** Evidence below is from three independent
sources: the ElevenLabs tool-execution ledger, Vercel's runtime logs, and the
deployed app's own rendered state.

I own only this file and the correction appended to `12`. No other repo file was
edited, nothing was committed or pushed, and `.env` / `.env.local` were read but
never written.

---

## Grounding notes — confirmed against today's docs before any mutating call

The runbook in `12` was written against these and validated clean; what it was
missing was the **attach** step. That is confirmed below from three sources.

| Thing                         | Endpoint                                                                              | Confirmed by                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create workspace secret       | `POST /v1/convai/secrets`                                                             | [API ref](https://elevenlabs.io/docs/api-reference/workspace/secrets/create) + `openapi.json` → `PostWorkspaceSecretRequest`                                                                                                                                                                           |
| Create a tool                 | `POST /v1/convai/tools`                                                               | [API ref](https://elevenlabs.io/docs/api-reference/tools/create) + `openapi.json` → `ToolRequestModel`                                                                                                                                                                                                 |
| **Attach a tool to an agent** | `PATCH /v1/convai/agents/{agent_id}` with `conversation_config.agent.prompt.tool_ids` | [Agent update API ref](https://elevenlabs.io/docs/api-reference/agents/update) · [Webhook tools guide](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools) · [Agent tools deprecation](https://elevenlabs.io/docs/agents-platform/customization/tools/agent-tools-deprecation) |
| Tool execution ledger         | `GET /v1/convai/tools/{tool_id}/executions`                                           | `openapi.json` — "Get paginated list of tool executions for a specific tool"                                                                                                                                                                                                                           |

Payload shapes, verbatim from the live spec:

- `PostWorkspaceSecretRequest` = `{type, name, value}` → response
  `PostWorkspaceSecretResponseModel` = `{type, secret_id, name}`. Byte-for-byte
  as `12 §G3` documented.
- `ToolRequestModel` = `{tool_config, response_mocks?}`, `tool_config` a
  discriminated union on `type` (`webhook | client | system | mcp`). Response
  `ToolResponseModel` carries the id in **`id`**, not `tool_id`.
- `WebhookToolConfig-Input` required: `[name, description, api_schema]`. Every
  optional field the runbook uses — `response_timeout_secs`,
  `tool_error_handling_mode`, `interruption_mode`, `pre_tool_speech` — is a real
  sibling of `api_schema`, not nested inside it. `12 §G2` is correct.
- `PATCH /v1/convai/agents/{agent_id}` body: `conversation_config` is typed
  `{additionalProperties: true}` — the spec does **not** tell you whether it
  merges or replaces. That is exactly why the read-modify-verify below was run
  rather than trusted. **Empirically it deep-merges** (proof in the diff).

### The `tools` → `tool_ids` migration, which is why this step is not optional

The legacy `conversation_config.agent.prompt.tools` (inline tool definitions) was
**permanently removed on 2025-07-23**; requests carrying it are rejected. The
supported field is `tool_ids`, referencing tools created standalone via
`POST /v1/convai/tools`. So a tool created and never referenced is **inert** —
which is precisely the failure 14 predicted.

`prompt.tools` still appears on **GET** responses, but as a read-only expansion
of `tool_ids` (see the diff — it populated itself when `tool_ids` was set, and
was never sent).

---

## The gap this closes — 14 §FAIL #2, confirmed live

Before I touched anything:

```
prompt.tool_ids = []
```

The agent had **zero tools attached**. Anyone following `12` literally would
have created two valid tools, seen `200 OK` twice, and filmed an agent that
could never call either — silently, with no error anywhere. 14 called this "the
single most consequential gap in Phase 1's documentation" and it was real.

The runbook's bold instruction —
_"read the agent back, do not re-PATCH `conversation_config`"_ — is well-motivated
(it protects the C1 pins) but overshoots: `tool_ids` **lives inside**
`conversation_config`, so obeying it literally makes the wiring impossible. The
correct move is not "never PATCH" but "PATCH the narrowest possible path, then
diff". A correction is appended to `12`.

---

## Vercel state

|                    |                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Account            | `mohammedhaidertoha`, scope `haider-projects`                                                     |
| Project            | `juno-hack` — `prj_WVktGUkZHsIhDH9YBO9PwxYvVxv2`                                                  |
| Org                | `team_twqOAgAGAoR1QIpdvqHRjE62`                                                                   |
| **Production URL** | **`https://juno-hack.vercel.app`** (stable alias — this is what the tools point at)               |
| Other aliases      | `juno-hack-haider-projects.vercel.app`, `juno-hack-mohammedhaidertoha-haider-projects.vercel.app` |

The tools are pointed at the **alias**, not the immutable per-deployment URL, so
tonight's redeploys do not invalidate the tool config.

### Environment — Production

Already present and correct: `XI_API_KEY`, `NEXT_PUBLIC_AGENT_ID`,
`NEXT_PUBLIC_XI_VOICE_ID`, `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_PORTICO_MODE`, plus
`ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY`, `REDIS_URL`.

**Set by me — one variable, and it was the blocker:**

| Name                  | Environment | Type      |
| --------------------- | ----------- | --------- |
| `PORTICO_TOOL_SECRET` | Production  | Sensitive |

Value taken from `.env.local` so the deployed routes and the ElevenLabs
workspace secret share one secret. **No secret value appears in this file, in
any command output quoted here, or in any commit.** `.env` / `.env.local` were
read, never modified.

`NEXT_PUBLIC_PORTICO_MODE` is marked Sensitive on Vercel, so `vercel env pull`
returns `[SENSITIVE]` rather than the value. It was therefore verified the only
way that actually proves anything — by reading the deployed bundle (below).

---

## Deployment

|               |                                                          |
| ------------- | -------------------------------------------------------- |
| Id            | `dpl_38RU6N21Wp5Js3jZmk9skxP1QLwV`                       |
| Target        | production                                               |
| Status        | **● Ready**                                              |
| Created       | 2026-07-26 01:20 BST                                     |
| Immutable URL | `https://juno-hack-bopuodjof-haider-projects.vercel.app` |
| Aliased to    | `https://juno-hack.vercel.app`                           |

**Gate before deploying** (two other agents are mid-edit; shipping a broken tree
was the risk):

```
pnpm typecheck   → exit 0
pnpm lint        → exit 0
```

Both clean, so the deploy went ahead. Note the CLI deploys the **working tree**,
not `HEAD` — and `app/api/log/`, `app/api/escalate/`, `app/operator/`,
`app/(phone)/family/` and the rest of Track A are still **untracked**. They are
not gitignored (`git check-ignore` returns nothing), so they upload and run.
This is verified, not assumed — see the 401s below.

`vercel deploy --prod --yes` first failed with `Not authorized`; re-running with
an explicit `--scope haider-projects` succeeded. Worth knowing at 2am.

### Verification that the right thing shipped

```
POST https://juno-hack.vercel.app/api/log       → 401 {"error":"unauthorized"}
POST https://juno-hack.vercel.app/api/escalate  → 401 {"error":"unauthorized"}
GET  https://juno-hack.vercel.app/operator      → 200
GET  https://juno-hack.vercel.app/plan          → "Demo mode. The letter and the
                                                   medicine guidance are recorded,
                                                   not fetched live."
```

Before this deploy both routes 404'd — the Next not-found page, with
`"c":["","api","log"]` in the RSC payload. That is what the ElevenLabs tools
would have been pointed at.

The demo badge is `DemoModeBadge`, which returns `null` unless
`NEXT_PUBLIC_PORTICO_MODE === "demo"` and is compiled into the bundle. Its
presence in the served HTML is proof the **deployed build** is in demo mode —
stronger than reading the env var back.

`PORTICO_TOOL_SECRET` proven to match, without writing anything to the shared
demo state (a valid secret with a deliberately invalid id):

```
POST /api/log  -H "x-portico-tool-secret: <redacted>"
     {"patient_id":"demo","item_id":"med-nonexistent",…}
  → 422 {"error":"unknown_item","item_id":"med-nonexistent"}
```

422 rather than 401 proves the header matched; `unknown_item` rather than
`no_plan_stored` proves the deployed instance also reads the shared plan.

---

## ElevenLabs wiring

### Workspace secret

```
POST /v1/convai/secrets  {"type":"new","name":"portico_tool_secret","value":"<redacted>"}
  → 200 {"type":"stored","secret_id":"jSDnjhNCouONynsL6JwP","name":"portico_tool_secret"}
```

Workspace had **zero** secrets and **zero** tools beforehand, so nothing was
overwritten and there are no orphans from earlier attempts.

### Tools created

| Tool                      | Id                                  | Type    | URL                                         |
| ------------------------- | ----------------------------------- | ------- | ------------------------------------------- |
| `log_step`                | `tool_7601kydwv6qbev69gefqxep8k0r9` | webhook | `https://juno-hack.vercel.app/api/log`      |
| `escalate_to_next_of_kin` | `tool_8201kydwv80ffmv9h13k8pfzbd50` | webhook | `https://juno-hack.vercel.app/api/escalate` |
| `show_red_flag`           | `tool_1901kydwv97pf1mbz4jq2kmqfxjz` | client  | — (runs in the browser)                     |

Configs are exactly `12`'s paste-ready JSON with `PORTICO_HOST` →
`juno-hack.vercel.app` and `SECRET_ID_HERE` → `jSDnjhNCouONynsL6JwP`.

**`show_red_flag` is a deliberate addition beyond the two server tools.** It is
in the same runbook block, `voice-session.tsx:245` still registers it under that
exact name, and with `tool_ids` empty it was as unattached as the other two — so
`12 §R2` ("wired but never exercised") was understating it. It is now attached
and proven firing. Rollback is listed below if that is not wanted.

### The attach — read, modify, verify

Full config saved to `agent-BEFORE.json` first. Then the **narrowest possible**
PATCH — one leaf path, nothing else in the body:

```json
{
  "conversation_config": {
    "agent": {
      "prompt": {
        "tool_ids": [
          "tool_7601kydwv6qbev69gefqxep8k0r9",
          "tool_8201kydwv80ffmv9h13k8pfzbd50",
          "tool_1901kydwv97pf1mbz4jq2kmqfxjz"
        ]
      }
    }
  }
}
```

`PATCH → 200`, then `GET` and a full leaf-by-leaf diff of `conversation_config`.

### Before/after diff — the C1 pins and `client_events` survived

```
conversation_config leaf keys: before=118  after=118

CHANGED PATHS (2):
  agent.prompt.tool_ids
    before: []
    after:  ["tool_7601…", "tool_8201…", "tool_1901…"]
  agent.prompt.tools
    before: []
    after:  [ {log_step…}, {escalate_to_next_of_kin…}, {show_red_flag…} ]
```

**Two paths changed. Both intended.** `prompt.tools` is the read-only expansion
of `tool_ids` described above — it was never sent. 118 leaf keys before, 118
after: the PATCH **deep-merges**, it does not replace.

Explicit assertions on the landmine:

```
PASS  base tts.model_id             eleven_flash_v2    → eleven_flash_v2
PASS  language_presets.fr…model_id  eleven_flash_v2_5  → eleven_flash_v2_5
PASS  client_events                 identical, 12 values, order included
PASS    contains agent_tool_request
PASS    contains agent_tool_response
PASS    contains client_tool_call
PASS    contains agent_chat_response_part
PASS  language_presets.fr           whole block byte-identical
PASS  tts                           whole block byte-identical
PASS  agent.prompt.prompt           unchanged
```

Re-verified a **second time** after all three live sessions
(`agent-FINAL.json`): still `eleven_flash_v2` / `eleven_flash_v2_5`, still 12
`client_events`, still the same three `tool_ids`. Nothing drifted. No restore
was needed.

The base model was **not** touched. `platform_settings.overrides` independently
confirms C1's reasoning: `conversation_config_override.tts.model_id` is
**`false`** — the model is not client-overridable, so the pin cannot drift from
the browser either. Allowed overrides are exactly what the app sends:
`agent.prompt.prompt`, `agent.first_message`, `agent.language`, `tts.voice_id`.

---

## End-to-end proof — a real agent, calling the deployed routes

Not "the API returned 200". A real agent session against the real platform.

**Method.** `get-signed-url` → open the conversation WebSocket → send
`conversation_initiation_client_data` carrying **the actual production system
prompt** (extracted from the deployed `/check-in` RSC payload, 3656 bytes, the
same string the browser sends) plus `dynamic_variables: {patient_id: "demo"}` →
send user turns as `user_message` text frames. No microphone. The agent, the
LLM, the tool dispatch and the webhook call are all genuine; only the user's
audio is substituted. `tts.voice_id` and `agent.language` were sent exactly as
`voice-session.tsx` sends them.

### Session 1 — `log_step` — beat 23

```
conversation_id: conv_0701kydx4g4efyqbrcqt3n1xd370
<< Hello Harold, it's Portico. I have 4 things on your plan for today. How are you feeling?
>> Yes, I've taken my metformin this morning.
** agent_tool_request  {tool_name: log_step, tool_type: webhook, expects_response: true,
                        response_timeout_secs: 8, execution_mode: immediate}
** agent_tool_response {tool_name: log_step, is_error: false, is_called: true}
<< That is great, thank you for letting me know. Just so I can be sure I explained
   things clearly, do you know when you need to take your next metformin tablet?
```

### Session 2 — `show_red_flag` — beats 24 and 25

```
conversation_id: conv_0501kydx5tn7ehavt6j609wqr1y5
>> I've gone very breathless again since last night, and I feel feverish.
** agent_tool_request  {tool_name: show_red_flag, tool_type: client, response_timeout_secs: 5}
** client_tool_call    {tool_name: show_red_flag,
                        parameters: {flag_id: "flag-worsening-chest-infection"}}
** agent_tool_response {tool_name: show_red_flag, is_error: false, is_called: true}
<< I am putting a warning on your screen now because you are breathless and feverish.
   The advice is to seek urgent help, so please call one one one, or nine nine nine
   if it is severe.
```

The `flag_id` is the **real id from the letter**, not invented. `12 §G6`'s
narrowing path in `voice-session.tsx` will find it. Beat 25 (the live tick) is
proven with it: `agent_tool_request` arrives carrying `tool_name` and, as
`12 §G7` said, **no** `parameters`.

### Session 3 — `escalate_to_next_of_kin`

```
conversation_id: conv_6501kydx6cbnemvb7cjpa48q9c54
>> I couldn't take my apixaban today. I've run out and I can't get to the chemist
   on my own. I could really do with some help.
** agent_tool_request/response  escalate_to_next_of_kin   is_error: false, is_called: true
** agent_tool_request/response  log_step                  is_error: false, is_called: true
<< I am so sorry to hear that. I have left a note on the family view to let your
   daughter know you need some help getting your medicine.
```

The agent said "left a note on the family view" — **not** "I have called anyone".
The D9 wording rule survives contact with a live model.

### Corroboration 1 — ElevenLabs' own execution ledger

`GET /v1/convai/tools/{tool_id}/executions`:

```
log_step
  toolexec_4701kydx6penfp0vaecqkmbyr0yx  err=false  0.61s  https://juno-hack.vercel.app/api/log
    body: {"patient_id":"demo","check_in_id":"conv_6501kydx6cbnemvb7cjpa48q9c54",
           "item_id":"med-apixaban","status":"missed"}
    resp: {"ok":true,"item_id":"med-apixaban","day":"2026-07-27"}
    X-Portico-Tool-Secret: <REDACTED>
  toolexec_2201kydx4v6bfn184c3zj57y55vr  err=false  1.37s  https://juno-hack.vercel.app/api/log
    body: {"patient_id":"demo","check_in_id":"conv_0701kydx4g4efyqbrcqt3n1xd370",
           "item_id":"med-metformin","status":"taken"}
    resp: {"ok":true,"item_id":"med-metformin","day":"2026-07-27"}

escalate_to_next_of_kin
  toolexec_7501kydx6peme0hsjgptfz4rp40k  err=false  0.63s  https://juno-hack.vercel.app/api/escalate
    body: {…,"item_id":"med-apixaban",
           "reason":"I have run out of my apixaban and cannot get to the chemist on my own."}
    resp: {"ok":true,…,"recorded_as":"missed","next_of_kin":"Daughter",
           "tell_the_patient":"A note has been left on the family view. Nobody has been
            called or messaged."}
```

Four things this proves beyond "it fired":

1. **The design decisions in `12 §G5` work.** `patient_id` arrived as the
   browser-supplied dynamic variable; `check_in_id` is the **platform's own**
   `conv_…` id, so the model never filled either. `day` is absent from every
   request body and was supplied server-side from the demo clock.
2. **The secret never leaks.** ElevenLabs stores the header as `<REDACTED>` in
   its own ledger — resolved server-side from the workspace secret, exactly as
   `12 §G3`/C7 argued and as a `secret__` dynamic variable would **not** have.
3. **Latency 0.61–1.37s** against a `response_timeout_secs: 8` budget. `12 §G2`'s
   choice of 8 is comfortable, including a cold start.
4. The model volunteered a well-formed `reason` in the patient's own words.

### Corroboration 2 — Vercel runtime logs

```
00:29:00  POST /api/log  200  [info/serverless]  dep=dpl_38RU6N21Wp5Js3jZmk9skxP1QLwV
00:27:57  POST /api/log  200  [info/serverless]  dep=dpl_38RU6N21Wp5Js3jZmk9skxP1QLwV
00:21:58  POST /api/log  422  [info/serverless]   ← my auth probe
00:21:42  POST /api/log  401  [info/serverless]   ← my auth probe
```

Requests genuinely arrived at the deployed function. The two 200s are the agent.

### Corroboration 3 — the app's own rendered state

`/plan` on the deployed site changed to
`"Metformin 500mg, today: recorded as taken. Tap to change to missed."` — the
write reached Redis and rendered. `/family` correctly did **not** change on the
`taken` write (`assess()` counts only `missed`), and the escalation card held at
"A dose that matters was missed twice".

### Cleanup — test residue removed

The three sessions wrote real entries for `2026-07-27`. Leaving them would have
been exactly the rehearsal residue X1 exists to prevent, so production was
re-seeded:

```
POST /api/seed → today 2026-07-27, plan seed/02-whitfield, 7 medications
   missed: med-apixaban ["2026-07-26","2026-07-25"]
   clearedLogDays: [… :2026-07-25, … :2026-07-26, … :2026-07-27]   ← my residue, gone
```

Verified after: `/family` = "A dose that matters was missed twice";
`/plan` = "Metformin 500mg, today: tap to record as taken." **Canonical filmable
state restored.**

---

## Beat checklist — the three that were UNTESTED in `12`

| #   | Beat                                           | Was      | Now                | Evidence                                                           |
| --- | ---------------------------------------------- | -------- | ------------------ | ------------------------------------------------------------------ |
| 23  | A real voice call actually invoking `log_step` | UNTESTED | **PASS**           | `toolexec_2201…` / `toolexec_4701…`, Vercel `POST /api/log 200` ×2 |
| 24  | `show_red_flag` fired by a real agent          | UNTESTED | **PASS**           | `client_tool_call` with `flag_id: flag-worsening-chest-infection`  |
| 25  | The live tick from a real `agent_tool_request` | UNTESTED | **PASS**           | `agent_tool_request` received in all three sessions                |
| 26  | French voice ear-test                          | UNTESTED | **STILL UNTESTED** | B11's job; needs a human ear. See below.                           |

---

## Rollback — every mutation, undone

Nothing here is destructive; all five are reversible.

**1 · Detach the tools from the agent** (restores `prompt.tool_ids = []`):

```bash
curl -X PATCH "https://api.elevenlabs.io/v1/convai/agents/agent_0201kyd61dnjey7bkz56hpyhs3f1" \
  -H "xi-api-key: $XI_API_KEY" -H "Content-Type: application/json" \
  -d '{"conversation_config":{"agent":{"prompt":{"tool_ids":[]}}}}'
```

To drop only `show_red_flag`, PATCH `tool_ids` with just the two webhook ids.

**2 · Delete the tools** — `DELETE /v1/convai/tools/{tool_id}` for
`tool_7601kydwv6qbev69gefqxep8k0r9`, `tool_8201kydwv80ffmv9h13k8pfzbd50`,
`tool_1901kydwv97pf1mbz4jq2kmqfxjz`. Detach first — check
`GET /v1/convai/tools/{tool_id}/dependent-agents`.

**3 · Delete the workspace secret** —
`DELETE /v1/convai/secrets/jSDnjhNCouONynsL6JwP`. Do this last; it is referenced
by both webhook tools.

**4 · Remove the Vercel env var** — `vercel env rm PORTICO_TOOL_SECRET production`.
Note this breaks `/api/log` and `/api/escalate` on production (they will 401).

**5 · Roll back the deployment** — `vercel rollback --scope haider-projects`, or
`vercel promote <previous-url> --scope haider-projects`. The previous production
deployment is `https://juno-hack-sdjjlczo3-haider-projects.vercel.app`. It does
**not** contain the tool routes.

**Full agent restore**, if the config is ever suspected of drift: the complete
pre-change `conversation_config` is in this session's scratchpad as
`agent-BEFORE.json`. It is not in the repo — if it matters beyond tonight,
re-fetch with `GET /v1/convai/agents/{agent_id}` and keep a copy.

---

## Residual risk

### D1 — 🔴 Production is a snapshot of an **uncommitted** working tree

`vercel deploy` uploaded the working tree, not `HEAD` (`20a790f`). Track A's
routes are still untracked. Two other agents were mid-edit while this shipped —
so **production is whatever the tree looked like at 01:20 BST, and every later
edit by anyone is invisible to it until someone redeploys.**

The tools point at the production alias. Rehearsing against `localhost:3000`
exercises different code from what the agent will call. **Before filming:
redeploy** (`pnpm typecheck && pnpm lint && vercel deploy --prod --yes --scope
haider-projects`) so the two match.

### D2 — 🔴 Local and production share one Redis and one Blob store

Same Upstash instance. `make seed` locally, the operator panel on the deployed
site, and the agent's tool calls all mutate **the same demo state**. Two people
rehearsing on different hosts will fight. It also means a laptop rehearsal is
visible on the deployed `/family` — useful, but only if intended.

Pick one host for the take. Re-seed between takes; since X1 the reset is total.

### D3 — 🟡 French has still never been heard

Both pins verified structurally, and `language_presets.fr` is byte-identical to
before. But no French audio was heard, and no French session was run — my three
sessions were all `language: "en"`. **C2/B11 stands unchanged: HTTP 200 proves
nothing.** This is the last thing on the list only a human ear can close.

### D4 — 🟡 `/operator`, `/api/seed` and `/api/demo/*` are live and unauthenticated on the public internet

Production is in demo mode, so the demo-only guard **permits** them. Anyone with
the URL can reset the plan, move the clock, or ring the phone mid-take.
`/operator` is `robots: {index:false}` and unlinked, so this is obscurity, not
security. Acceptable for one night; do not leave it up afterwards.

### D5 — 🟡 The tool descriptions are load-bearing and now frozen in two places

The `description` on each tool is the only signal the model uses to decide when
to call it (14). They now live both in `12`'s JSON block and on the ElevenLabs
platform. Editing one does not edit the other. If a description changes, PATCH
the tool — `PATCH /v1/convai/tools/{tool_id}`.

### D6 — 🟢 `escalate_to_next_of_kin` also triggered `log_step` in the same turn

Session 3 fired both — correct behaviour (the escalate route records the miss,
and the agent additionally logged it), and idempotent: `(patientId, itemId, day)`
collapses them into one entry, as `12` documents. Worth knowing so the double
tick on screen is not read as a bug.

### D7 — 🟢 `vercel deploy --prod` needs `--scope haider-projects`

Without it: `Not authorized`. Reproducible. Costs a minute if nobody expects it.

### D8 — 🟢 The `tools`/`tool_ids` duality reads like drift

A `GET` on the agent now shows **both** a populated `tool_ids` and a populated
`tools`. `tools` is a read-only expansion. Do **not** try to "clean it up" by
sending `tools` — the field was removed from write requests in July 2025 and the
request will be rejected.
