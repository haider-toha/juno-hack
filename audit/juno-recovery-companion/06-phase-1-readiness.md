# 06 — Phase 1 readiness: infra re-probe + Portico agent creation

**Date:** 2026-07-25 · **Scope:** verify already-provisioned infrastructure
(re-probe only, no re-provisioning), create and verify the **Portico**
ElevenLabs Conversational AI agent, and prove the signed-URL path against the
new agent id.

**Skills applied:** `/elevenlabs-agents` (agent create/update, config reference,
prompt sectioning), `/elevenlabs-setup-api-key` (key-validity probe pattern),
`/haider-engineering-defaults` (fail-loud config boundaries, no soft defaults),
`/writing-plans` + `/planning-and-task-breakdown` (structuring the handover).

**No secret value appears in this file.** Probes record HTTP status and
non-sensitive response fields only.

---

## 1. Infrastructure re-probe — all PASS

Trusting `tasks/todo.md §Setup status`; these were re-probed, not recreated.

| #   | Dependency                             | Probe                                  | Result                                                               |
| --- | -------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| 1   | ElevenLabs `XI_API_KEY`                | `GET /v1/user`                         | **HTTP 200** — tier `growing_business`, 1,810,000 char limit, 0 used |
| 2   | Vercel AI Gateway `AI_GATEWAY_API_KEY` | `GET /v1/models`                       | **HTTP 200** — 306 models listed                                     |
| 3   | Upstash Redis                          | `GET {UPSTASH_REDIS_REST_URL}/ping`    | **HTTP 200** — `{"result":"PONG"}`                                   |
| 4   | Vercel Blob                            | `GET blob.vercel-storage.com/?limit=1` | **HTTP 200** — `blobs` present, count 0                              |
| 5   | Vercel MCP                             | `claude mcp list`                      | **✔ Connected** (`plugin:vercel:vercel`)                             |
| 6   | Vercel project link                    | `vercel env ls`                        | `haider-projects/juno-hack` resolves                                 |

**No human blocker on any of the six.** Nothing was re-provisioned and no key
was reissued.

Toolchain observed: Node 26.3.1, pnpm 11.9.0 — matches the pinned toolchain.
`@upstash/redis`, `@vercel/blob` and `ai` are still **not installed** (expected;
that is Phase 0 Task in `tasks/todo.md`).

### 1a. Defect found in "Done" list — `NEXT_PUBLIC_XI_VOICE_ID` was dead

`tasks/todo.md §Setup status` marks `NEXT_PUBLIC_XI_VOICE_ID` as done. It was
**set but pointed at a voice that does not exist in this workspace**:

```
GET /v1/voices/YCMgeo2Dvws6xwm7kQNN → HTTP 400
{"type":"not_found","code":"voice_not_found","message":"A voice with ID
 'YCMgeo2Dvws6xwm7kQNN' was not found."}
```

That id came from `.env.example` (see `02-track-2-elevenlabs-feasibility.md:122`)
and was copied into `.env` and Vercel. `voice-session.tsx:228` sends it as
`overrides.tts.voiceId` on **every** session, so this would have failed at the
first live call — after the demo had already started — not at build time.

**Fixed:** replaced with `EXAVITQu4vr4xnSDxMaL` (premade "Sarah — Mature,
Reassuring, Confident"), in `.env`, `.env.example`, and Vercel
Production/Preview/Development.

`verified_languages` for this voice: `ar, en, es, fr, hi, zh` — **`fr` is
verified**, which is the property the build actually needs.

> **Human call outstanding (low risk, 2 min):** voice is brand. Sarah was chosen
> because it exists, is French-verified, and reads warm/reassuring for an
> elderly patient. Alternatives already in the workspace if the human prefers a
> different register: `nPczCjzI2devNBz1zQrb` (Brian — deep, comforting),
> `pqHfZKP75CvOlQylNhV4` (Bill — wise, mature), `XrExE9yKIg1WjnnlVkGX`
> (Matilda — knowledgeable, professional). Swapping is a one-line env change.

---

## 2. The Portico agent — created

```
NEXT_PUBLIC_AGENT_ID = agent_0201kyd61dnjey7bkz56hpyhs3f1
```

Written to `.env` **and** Vercel Production + Preview + Development (verified by
re-listing). `.env` is gitignored; the agent id is a public (`NEXT_PUBLIC_*`)
value, not a secret.

Name/persona is **Portico**. The string "Juno" appears nowhere in the agent
config. Prior agent count in this workspace was **0**, so there is no legacy
agent to confuse it with.

### Configuration, read back from the API after every edit

| Field                                               | Value                                    |
| --------------------------------------------------- | ---------------------------------------- |
| `name`                                              | `Portico`                                |
| `conversation_config.agent.language`                | `en`                                     |
| `conversation_config.tts.voice_id`                  | `EXAVITQu4vr4xnSDxMaL`                   |
| `conversation_config.tts.model_id`                  | **`eleven_flash_v2`**                    |
| `language_presets.fr.overrides.tts.model_id`        | **`eleven_flash_v2_5`**                  |
| `language_presets.fr.overrides.agent.first_message` | authored French (not machine-translated) |
| `agent.prompt.llm`                                  | `gemini-2.5-flash`                       |
| `agent.prompt.temperature`                          | `0.2`                                    |
| `turn.turn_eagerness` / `turn_timeout`              | `patient` / `10s`                        |

`turn_eagerness: patient` and a 10s turn timeout are deliberate: the target user
is an elderly patient who may be tired or in pain, and the default (`normal`/7s)
talks over them.

### D8 Security overrides — all five enabled, verified by readback

```json
{
  "agent": {
    "prompt": { "prompt": true },
    "first_message": true,
    "language": true
  },
  "tts": { "voice_id": true, "model_id": false },
  "asr": { "keywords": true }
}
```

Two things worth recording:

1. **`asr.keywords` override IS supported.** The public overrides doc page does
   not list it, but the API accepts and stores it. Task **B12** is unblocked.
2. **`tts.model_id` override is `false` and cannot be enabled by the client.**
   The TTS model pin therefore _cannot_ be changed from the browser. This is a
   D9 win: the pin is structurally tamper-proof from the client side.

---

## 3. Grounding — what the docs say, and where they were wrong

Sources consulted before touching any agent config:

- `POST /v1/convai/agents/create` API reference —
  https://elevenlabs.io/docs/api-reference/agents/create
- Overrides —
  https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides
- Language / models —
  https://elevenlabs.io/docs/eleven-agents/customization/voice/customization/language,
  https://elevenlabs.io/docs/overview/models

**Confirmed verbatim from the docs, and it is the crux of D8:**

> "Additional languages switch the agent to use the v2.5 Multilingual model.
> English will always use the v2 model."

**Confirmed verbatim, and it corrects `README.md` (Phase 0 Task 0.6):**

> "An error will be thrown if an override is provided for a field that does not
> have overrides enabled."

---

## 4. 🔴 D8 as written is **impossible**. The API rejects it.

Locked D8 instructs: _"Pin TTS explicitly to `eleven_flash_v2_5`. Real locales:
`en` and `fr`."_ The API refuses that combination outright:

```
POST /v1/convai/agents/create
  agent.language = "en", tts.model_id = "eleven_flash_v2_5"
→ HTTP 400
  "Invalid conversation config: Value error, English Agents must use turbo or flash v2."
```

This is not a dashboard quirk — it is server-side validation on the create call.
The full probe matrix (each agent created then deleted):

| base `agent.language` | `tts.model_id`                                  | Result                                               |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `en`                  | `eleven_flash_v2_5`                             | ❌ 400 — "English Agents must use turbo or flash v2" |
| `en`                  | `eleven_turbo_v2_5`                             | ❌ 400 — same error                                  |
| `en`                  | `eleven_flash_v2_5` **+ `language_presets.fr`** | ❌ 400 — presets do **not** unlock v2.5              |
| `en`                  | `eleven_flash_v2`                               | ✅ 200                                               |
| `en`                  | `eleven_multilingual_v2`                        | ✅ 200                                               |
| `fr`                  | `eleven_flash_v2_5`                             | ✅ 200                                               |

Note the error message is itself imprecise — `eleven_multilingual_v2` is
accepted despite not being "turbo or flash v2". The real rule is: **an
English-base agent cannot use a v2.5 model.**

### What was built instead

The only configuration that pins an explicit, French-capable model per locale
_and_ is accepted by the API:

- base `en` → **`eleven_flash_v2`** (English-only Flash, ~75ms)
- `language_presets.fr` → **`eleven_flash_v2_5`** (32-language Flash, ~75ms)

Both models are named explicitly in config. Neither comes from a dropdown
default. Both are Flash-tier, so latency is unchanged. **Re-verified after the
subsequent `client_events` PATCH — both pins survived** (the D8 re-check step).

This honours D8's _intent_ (no silent model drift; every model explicitly
pinned; both real locales on a model that supports them) while being legal under
the platform's actual constraint. It does contradict D8's _letter_, so:

### ⚠️ DECISION CHANGE REQUIRED FROM THE HUMAN

> **D8 says:** one agent, `tts.model_id` pinned to `eleven_flash_v2_5`, French
> added on top.
> **Reality:** an English-base agent may not use `eleven_flash_v2_5`. A single
> agent cannot have one pinned v2.5 model serving both `en` and `fr`.
>
> **Option 1 (built, in place now):** one agent, base `en` on `eleven_flash_v2`,
> `fr` language preset on `eleven_flash_v2_5`. _Unverified assumption:_ that a
> per-session `overrides.agent.language: "fr"` actually activates the `fr`
> preset. See §6 — this is the top residual risk.
>
> **Option 2 (recommended):** **two agents, one per real locale**, each with its
> model pinned in its own base config — `Portico EN` (`en` + `eleven_flash_v2`)
> and `Portico FR` (`fr` + `eleven_flash_v2_5`). `/api/eleven/signed-url` takes
> a `locale` param and picks the id. This removes the preset-routing assumption
> entirely: nothing is inferred, every model is pinned at its own agent root.
> D8 already fixes locale before `startSession` ("no mid-call en/fr switch"), so
> a per-locale agent costs nothing architecturally. Cost: two agents to keep in
> sync — mitigated because the runtime prompt and first message come from
> overrides anyway, so only the override toggles, tools and `client_events` must
> match.
>
> **Not recommended:** `eleven_multilingual_v2` for both locales. It is legal and
> simple, but drops both locales off Flash-tier latency for a demo whose hero
> feature is responsiveness.

---

## 5. 🔴 Default `client_events` would have silently broken the transcript

On creation the platform defaulted to:

```
["audio","interruption","agent_response","user_transcript",
 "agent_response_correction","agent_tool_response"]
```

`components/voice/voice-session.tsx` consumes `onAgentChatResponsePart`
(line 116) to build `agentLive`, and `CLAUDE.md` calls the audio-paced reveal
"the whole effect". **`agent_chat_response_part` was not in the default set** —
the transcript would have rendered nothing, with no error anywhere.

Patched to:

```
["conversation_initiation_metadata","ping","audio","interruption",
 "user_transcript","agent_response","agent_response_correction",
 "agent_chat_response_part","agent_response_complete",
 "client_tool_call","agent_tool_request","agent_tool_response"]
```

This also pre-satisfies two later tasks: `client_tool_call` for **B6**
(`show_red_flag`) and `agent_tool_request`/`agent_tool_response` for **B7** — the
plan correctly notes these must be set on the agent, not per-session.

**Also learned:** `audio_alignment` is **not** a valid `client_events` value.
The API enumerates the legal set on rejection, and alignment data rides with the
`audio` event. `onAudioAlignment` therefore needs no toggle — but the plan
should stop implying one exists.

---

## 6. Live session proof — signed URL and overrides

Three real WebSocket sessions against `agent_0201kyd61dnjey7bkz56hpyhs3f1`,
opened via the app's own signed-URL endpoint shape, read to first agent
response, then closed. No secrets logged.

| Test               | Overrides sent                                             | Result                                                                                                                        |
| ------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **A — English**    | `prompt`, `first_message`, `language:"en"`, `tts.voice_id` | signed-url **HTTP 200**; `conversation_initiation_metadata` received; agent spoke the overridden line **"Ready in English."** |
| **B — French**     | same, `language:"fr"`                                      | signed-url **HTTP 200**; agent spoke the overridden line **"Prêt en français."**                                              |
| **C — disallowed** | added `agent.prompt.llm` (override **not** enabled)        | **WS closed `1008`**, reason: `"Override for field 'llm' is not allowed by config."`                                          |

**Test C is the empirical settlement of Phase 0 Task 0.6 / D9.** A disallowed
override does **not** get silently ignored — the session is refused. `README.md`
and the comment at `voice-session.tsx:25-27` are both wrong and must be
corrected.

**Precision the plan currently gets wrong:** the failure is a **WebSocket close
after** `conversation_initiation_metadata`, _not_ a synchronous throw from
`startSession()`. The `try/catch` around `connect()` at
`voice-session.tsx:212-234` will **not** catch it. It surfaces asynchronously
through the SDK's `onError` callback (which the code does wire, line 150). Task
0.6 should say "the session is refused and surfaces via `onError`", not "throws".

### The Welsh negative control, reproduced

Direct TTS, `eleven_flash_v2_5`, Welsh text → **HTTP 200, 74,440 bytes of
audio.** A model with no Welsh support returns a perfectly healthy-looking
response. This is D9's cautionary tale reproduced first-hand: **HTTP 200 proves
nothing about audio correctness.** Every language claim in this project must be
settled by ear, never by status code.

---

## 7. Residual risk

| #   | Risk                                                                                                                                                                                                                                                                                                                                | Severity       | Action                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | **Does `overrides.agent.language:"fr"` activate `language_presets.fr` (and thus `eleven_flash_v2_5`), or does TTS stay on base `eleven_flash_v2` — an English-only model reading French?** The API does not expose the model used at runtime (`realtime_config_snapshots` comes back empty), so this is **not machine-verifiable**. | 🔴 **Highest** | Human ear-test before Checkpoint 1. Audio pairs prepared (§8). If it fails, take Option 2 in §4.                                                                                     |
| R2  | An attempted duration-comparison to settle R1 was **inconclusive** and is recorded as such — the conversation endpoint resamples to MPEG-2/16kHz, so its durations are not comparable to direct-TTS renders, and the control run landed between both references. No conclusion should be drawn from it.                             | —              | Superseded by the ear-test.                                                                                                                                                          |
| R3  | Agent LLM `gemini-2.5-flash` was chosen by this pass, not by the plan — the plan never specifies one. Picked for low latency + French competence.                                                                                                                                                                                   | 🟡 Medium      | Human to confirm. `claude-haiku-4-5` is the alternative if instruction-adherence on "never invent" proves weak in rehearsal.                                                         |
| R4  | Voice `EXAVITQu4vr4xnSDxMaL` chosen by this pass (§1a).                                                                                                                                                                                                                                                                             | 🟢 Low         | Human to confirm; one-line env change.                                                                                                                                               |
| R5  | `platform_settings.auth.enable_auth` left at platform default. The app always uses signed URLs, so this is not a functional gap, but the agent id is public and the origin allowlist is unset.                                                                                                                                      | 🟡 Medium      | Deliberate hardening decision for the human — **not** done silently. Enabling it with an empty allowlist has unverified semantics; do not enable it blind the night before the demo. |
| R6  | Server tools (B4) are **not** registered on the agent yet — they need a deployed URL, which does not exist.                                                                                                                                                                                                                         | 🟢 Low         | Already Task B4; the localhost trap is already called out in the plan.                                                                                                               |

---

## 8. Ear-test pack (hand to the human before Checkpoint 1)

Four clips, same French clinical sentence — _"Prenez votre comprimé
anticoagulant ce matin, puis appelez le service si vous saignez."_

| File                                                | What it proves                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `FR-on-eleven_flash_v2.mp3`                         | French rendered by the **English-only** model — this is what "mush" sounds like |
| `FR-on-eleven_flash_v2_5.mp3`                       | French rendered by the **correct** 32-language model — the target               |
| `live-session-PORTICO-fr-via-language-override.mp3` | A real session on the built agent, French via `language` override               |
| `live-session-CONTROL-fr-as-base-language.mp3`      | A real session on a control agent with `fr` as its **base** language            |

**Decision rule (D9 — no downgrade):** if clip 3 sounds like clip 1 rather than
clip 2, the preset is not being activated → switch to **Option 2** in §4 (two
agents). Do **not** ship French UI with English-model voice under any
circumstance.

---

## 9. What changed on disk / in the platform

- **Created:** ElevenLabs agent `Portico` — `agent_0201kyd61dnjey7bkz56hpyhs3f1`
- **Modified:** `.env` — real `NEXT_PUBLIC_AGENT_ID`, corrected `NEXT_PUBLIC_XI_VOICE_ID`
- **Modified:** `.env.example` — corrected voice placeholder + a warning comment
- **Vercel:** `NEXT_PUBLIC_AGENT_ID` and `NEXT_PUBLIC_XI_VOICE_ID` replaced on
  Production, Preview and Development
- **Untouched, as instructed:** Upstash, Blob, AI Gateway, `XI_API_KEY`, the
  `.env`/`.env.local` public/secret split
- **Cleaned up:** six throwaway probe agents and one control agent, all deleted

## 10. Verdict

**Phase 1: PASS with one decision escalated.** Infrastructure is green on all
six probes. The Portico agent exists, is correctly named, has all five D8
overrides enabled, has a tamper-proof model pin, has `client_events` corrected
for the code that actually exists, and is proven to accept the app's overrides
over a live signed-URL session in both English and French.

The one thing Phase 1 could **not** settle is R1, and it is not settleable by
machine. It needs 60 seconds of human listening, and §8 makes that a
two-clip comparison.
