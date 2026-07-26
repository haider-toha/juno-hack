# 14 — Track 3: adversarial verification of Phase 1

Date: 2026-07-26. Branch `haider/track-a`, working tree (uncommitted). Verifier
had **write access to this file only**; no source file was edited.

Skills invoked before starting: `/code-review-and-quality`,
`/web-design-guidelines`, `/haider-engineering-defaults`.

**Verdict in one line:** the demo arc is real. `assess()` genuinely drives the
family escalation, the seed genuinely resets, the operator genuinely cannot
paint a card. Two things do not survive contact — **live-mode extraction is
dead on this machine** (missing `ANTHROPIC_API_KEY`, HTTP 500), and the
**ElevenLabs runbook is incomplete in a way that would leave the two server
tools unattached to the agent**.

---

## Scope and method

Everything below was reproduced from a **cold start**, not from the warm state
the build agents left behind.

```bash
kill $(lsof -ti:3000); rm -rf .next; pnpm dev      # Ready in 236ms, cold
```

Starting state before any of my writes, read straight out of Upstash:

```
portico:demo:today, portico:log:demo:2026-07-25, portico:log:demo:2026-07-26,
portico:patient:demo, portico:plan:demo, + 20 portico:nhs:med:v1:* cache keys
```

What I ran, in order:

| Tool                                                                       | Purpose                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `curl` against Upstash REST directly                                       | Read/scan/delete keys without going through the app                                                                                                                                                   |
| `curl` against `:3000`                                                     | Every route, every failure mode                                                                                                                                                                       |
| `make arc` (`scripts/demo-arc.sh`)                                         | Track 1's harness — run, and its assertions read line by line                                                                                                                                         |
| `node scripts/e2e-demo.ts`                                                 | The older harness — 10/10 pass; it destroys `.e2e/ui`                                                                                                                                                 |
| `node scripts/demo-shots.ts`                                               | Track 2's screenshots, re-run twice (before and after the above)                                                                                                                                      |
| Two Playwright harnesses of my own (scratchpad, not committed)             | Flip timing, tick persistence, both home states, badge sweep, real file upload, "can the operator lie" probe                                                                                          |
| A **live-mode server on :3100**                                            | rsync of the working tree + cloned `node_modules`, `NEXT_PUBLIC_PORTICO_MODE=live ./node_modules/.bin/next dev -p 3100`. `.env` was never edited; `:3000` never left demo mode. Torn down afterwards. |
| A subagent against live ElevenLabs docs + `api.elevenlabs.io/openapi.json` | Independent schema validation of the pasteable tool config                                                                                                                                            |
| `pnpm typecheck`, `pnpm lint`, targeted greps                              | Repo hygiene                                                                                                                                                                                          |

`:3000` is **left up, in demo mode, seeded** (`today 2026-07-27`, log keys
`2026-07-25` and `2026-07-26` only, `/family` = "A dose that matters was missed
twice"). `.e2e/ui/` was regenerated after `e2e-demo.ts` wiped it.

**Not done, deliberately:** no real ElevenLabs session was started (costs
credits, needs a mic). Everything about the voice call below is verified at the
payload level only. **The audio itself is unverified.**

---

## Beat table

| #   | Beat                                 | Verdict                                                             | Evidence                                            |
| --- | ------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Seed from cold + `clearLog()`        | **PASS**                                                            | [§1](#1--seed)                                      |
| 2   | Home story, both plan states         | **PASS (mechanism)** / **FAIL (against the brief)**                 | [§2](#2--home-story)                                |
| 3   | Upload / scan affordance → Blob      | **PASS**                                                            | [§3](#3--upload--scan)                              |
| 4   | Plan: real timeline, tick persists   | **PASS**                                                            | [§4](#4--plan)                                      |
| 5   | Incoming check-in flips, no reload   | **PASS**                                                            | [§5](#5--incoming-check-in)                         |
| 6   | Voice starts with plan context       | **PASS (payload)** · audio **UNTESTED**                             | [§6](#6--voice-context)                             |
| 7   | `/api/log` + `/api/escalate`         | **PASS with one defect**                                            | [§7](#7--log--escalate)                             |
| 7b  | ElevenLabs tool config paste-ready   | **PASS (JSON)** / **FAIL (runbook)**                                | [§7b](#7b--the-elevenlabs-tool-config)              |
| 8   | Family escalation is **computed**    | **PASS** — the important one                                        | [§8](#8--family-escalation-is-computed-not-painted) |
| 9   | Operator controls write real state   | **PASS**                                                            | [§9](#9--operator-controls)                         |
| 10  | Demo badge on every on-camera screen | **PASS** (5/5 patient screens; `/operator` uses a Mode row instead) | [§10](#10--demo-badge)                              |
| 11  | D9 boundary in live mode             | **PASS (demo routes)** / **FAIL (D9 rule 3)**                       | [§11](#11--d9-boundary)                             |
| 12  | Repo hygiene                         | **PASS**                                                            | [§12](#12--repo-hygiene)                            |

---

### 1 · Seed

Cold `POST /api/seed` produced **exactly** the claimed state, first try:

```json
{
  "patientId": "demo",
  "today": "2026-07-27",
  "letters": ["letters/demo/02_Whitfield_Harold_Pneumonia.pdf"],
  "plan": "seed/02-whitfield",
  "medications": 7,
  "redFlags": 1,
  "missed": { "itemId": "med-apixaban", "days": ["2026-07-26", "2026-07-25"] },
  "clearedLogDays": [
    "portico:log:demo:2026-07-25",
    "portico:log:demo:2026-07-26"
  ]
}
```

Read back out of Redis, not out of the response — no residue, and both entries
are real `LogEntry` rows:

```
log keys: ['portico:log:demo:2026-07-25', 'portico:log:demo:2026-07-26']
2026-07-25 → {"id":"seed-missed-2026-07-25","itemId":"med-apixaban","status":"missed",
              "source":{"kind":"manual"},"at":"2026-07-25T20:00:00+01:00"}
portico:demo:today → "2026-07-27"
```

**The `clearLog()` claim (X1) independently reproduced, and made harder.** I
advanced the clock **three** days and wrote misses on **two** forward days, one
of which (`2026-08-02`) is outside any plausible backwards window:

```
clock +3               → {"today":"2026-07-30"}
demo/log (day:null)    → {"itemId":"med-apixaban","day":"2026-07-30","status":"missed"}
demo/log 2026-08-02    → {"itemId":"med-metformin","day":"2026-08-02","status":"missed"}
scan                   → ['…07-25','…07-26','…07-30','…08-02']
POST /api/seed         → clearedLogDays:["…07-25","…07-26","…07-30","…08-02"]
scan                   → ['…07-25','…07-26']          ← exactly the seed
GET /api/demo/clock    → {"today":"2026-07-27"}       ← clock reset too
```

**PASS.** The reset is total. Track 2's residual risk #1 ("`POST /api/seed`
does not clear it … Track 1 should flush `portico:log:demo:2026-07-28`") is
**stale** — Track 1 fixed it after Track 2 wrote that. See Lies §L1.

`make arc` reproduced 19 passed, 0 failed. `node scripts/e2e-demo.ts`
reproduced 10/10.

---

### 2 · Home story

Both states are real, and I proved it by deleting the plan key rather than
trusting the JSX.

**With a plan** (`main a` link texts, straight off the DOM):

```
["Start today's check-in",
 "See my recovery plan | Day by day, from discharge.",
 "Add another letter | Photograph it, or choose the file."]
```

**With `portico:plan:demo` deleted** (`{"result":1}`), same page:

```
["Take a photo of your letter"]
```

and the body reads: _"Take a photo of your letter / Photograph every page, or
choose the file. Your plan is built from it. / Your plan appears here once we
have read your letter. Then I check in with you each day."_ — one door, no dead
ends. `/plan` correctly shows the named empty state, `/family` says "No recovery
plan has been loaded yet.", `/check-in` falls back to the invariant persona.
Restored with a re-seed.

**PASS on the mechanism. FAIL against the brief as written.** The brief asked
for home to lead with letter → plan → check-in. In the state you will actually
film — seeded — home leads with a full-width blue **"Start today's check-in"**,
and the ingest path is the **third** item on the screen, a hairline row labelled
"Add another letter" with a 20px glyph. A viewer who sees only the seeded home
does not learn that this product is built from a discharge letter. Track 2's
reasoning (two doors into an empty room is worse than none) is sound
engineering; it just does not deliver the story the brief asked for. **Decide
before the shoot whether to open on the empty state** (see "What a human must
do", item 5).

Screenshots: `.e2e/ui/phone-home.png`, `.e2e/ui/desktop-home.png`, and
`scratchpad/shots/{phone,desktop}-home-no-plan.png`.

---

### 3 · Upload / scan

Exactly **one** file input on `/upload`, attributes read off the live DOM:

```json
{"accept":"image/*,application/pdf","capture":"environment","multiple":true,"disabled":false}
label = "Take a photo or choose a file"
```

**Does it reach Blob?** Yes — I drove a real PDF through the real control with
Playwright's `setInputFiles` (not a mocked fetch):

```
setInputFiles fixtures/discharge-summaries/02_Whitfield_Harold_Pneumonia.pdf
→ navigated to /plan after 1754ms
```

That is a genuine `@vercel/blob/client` `upload()` → `/api/blob/upload` →
`/api/extract` → `writePlan` → `router.push` round trip. **PASS.**

**One thing the camera must not narrate.** In demo mode the extraction is baked
_before_ the model call, so uploading **any** letter yields Harold Whitfield's
plan. I proved it by uploading `01_Clarke_Emma_Cholecystitis.pdf`:

```
/plan after uploading Emma Clarke's letter:
  "Your recovery plan / A chest infection, with a flare-up of your COPD / Home since Saturday 25 July …"
stored bundle extraction.modelId = "seed/02-whitfield"
demo badge visible on that /plan? true
GET /api/extract → 200 {"mode":"demo","modelId":"seed/02-whitfield", …}
```

The **code is honest** — the mode is on screen, in the stored bundle, and in the
response, which is D9 rule 2 satisfied three ways. The **narration** is where
this becomes a lie. See Residual risk R2.

---

### 4 · Plan

12 untapped tick buttons on `/plan`. Ticked the first one and reloaded:

```
ticking     : "Apixaban 5mg, today: tap to record as taken."
after click : "Apixaban 5mg, today: recorded as taken. Tap to change to missed."
after RELOAD: "Apixaban 5mg, today: recorded as taken. Tap to change to missed."   PERSISTED
redis portico:log:demo:2026-07-27 →
  {"id":"manual:demo:med-apixaban:2026-07-27","status":"taken","source":{"kind":"manual"},…}
```

Real Redis-backed timeline, today dominant, tick persists. Tomorrow's card
carries **no** marks — Track 2's future-day fix holds in the pixels
(`.e2e/ui/phone-plan-today.png`). **PASS.**

---

### 5 · Incoming check-in

Phone parked on `/check-in`, untouched, operator rings from another process.
Three runs, `h1` change awaited with no navigation of any kind:

```
run 1: "Let's check in." → "Portico — your check-in" in 3118ms
run 2: "Let's check in." → "Portico — your check-in" in 3357ms
run 3: "Let's check in." → "Portico — your check-in" in 3367ms
```

**PASS — it flips without a reload.** But treat my numbers with the same
suspicion I gave Track 1's: my three runs all sat at the same point in the 5s
poll cycle, so they are one sample, not three. **The honest figure is a uniform
0–5s plus a server render** — Track 1's 4.56s and my 3.1s are both inside it.
Plan the shot for 5s, not 3.

Screenshot: `scratchpad/shots/desktop-check-in-incoming.png` — reads as an
incoming call ("Incoming check-in / Portico — your check-in / It is time for
today's check-in. Tap to answer." + a full-width **Answer**).

`raiseCheckIn` sets a 15-minute TTL (`lib/store/check-in.ts:16`), and the seed
clears it. Confirmed: `DELETE` → `{"raisedAt":null}`.

---

### 6 · Voice context

Read off the wire — decoded from the React Flight payload of `GET /check-in`,
not from the source. The `systemPrompt` prop is a lazily-streamed 3656-char
chunk (`10b:Te48,`). It contains, verbatim:

```
## Who you are speaking to
Harold.
## When
2026-07-27
Days since they came home from hospital: 2
## Their plan for today
- [med-apixaban] Apixaban 5mg: 1 tab, BD, Oral, Ongoing (important) — Stops clots forming, …
- [med-metformin] Metformin 500mg: 1 tab, BD, Oral, Ongoing (reduced)
- [med-atorvastatin] … - [med-tiotropium] …
## Recently missed
- [med-apixaban] 2026-07-26
- [med-apixaban] 2026-07-25
## What the letter says to watch out for
- [flag-worsening-chest-infection] breathless, feverish or confused again → Advised to seek urgent help
```

`firstMessage` = `Hello Harold, it's Portico. I have 4 things on your plan for
today. How are you feeling?`

French (`Cookie: portico_locale=fr`) composes correctly:
`Bonjour Harold, c'est Portico. J'ai 4 choses à votre plan pour aujourd'hui.
Comment vous sentez-vous ?` with an authored French persona and French section
headings.

`components/voice/voice-session.tsx:335` puts this into
`overrides.agent.prompt.prompt`, with `language: locale`, `firstMessage`, and
`dynamicVariables: { patient_id }`. **Real ids, real doses, real red flag. Not
filler. PASS on the payload.**

> **The audio itself is unverified.** No ElevenLabs session was started. Whether
> the agent's Security tab permits these four overrides is untested, and a
> disallowed override does **not** silently degrade — the socket closes 1008 and
> `onError` paints a banner over the transcript. See Residual risk R1.

**One finding Track 1 did not report.** In the **French** prompt the red flag is
handed to the agent in **English**:

```
- [flag-worsening-chest-infection] breathless, feverish or confused again → Advised to seek urgent help
```

even though the bundle carries authored French for exactly that string
(`lib/plan/samples/demo-plan.ts:523-524` — `triggerFr: "essoufflé, fiévreux, ou
de nouveau confus"`, `actionFr: …`), and `voice-session.tsx:472` renders the
French on the card. `lib/check-in-prompt.ts` never reads a `*Fr` field
(`grep -n "Fr" lib/check-in-prompt.ts` → no matches). So the on-screen card is
French and the spoken words the agent is told to read verbatim are English. Not
a crash, but it is the English-into-a-French-screen leak D9 §5 is about, and it
will be audible if the French take reaches the red-flag beat. Same for
`purposePlain` and the instruction text, which have no French at all — that one
is a data gap, not a bug.

---

### 7 · log / escalate

Every path, exercised against the running server with the real secret:

| Case                              | Result                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/log` no header              | `401 {"error":"unauthorized"}`                                                                                                       |
| `/api/log` wrong secret           | `401 {"error":"unauthorized"}`                                                                                                       |
| `/api/log` valid                  | `200 {"ok":true,"item_id":"med-apixaban","day":"2026-07-27"}`                                                                        |
| `/api/log` unknown item           | `422 {"error":"unknown_item","item_id":"med-nonexistent"}`                                                                           |
| `/api/log` bad `status`           | `400 {"error":"invalid_arguments","detail":"…"}`                                                                                     |
| `/api/log` missing field          | `400 {"error":"invalid_arguments","detail":"…"}`                                                                                     |
| `/api/log` unknown patient        | `409 {"error":"no_plan_stored"}`                                                                                                     |
| **`/api/log` body is not JSON**   | **`500`, empty body** ← defect                                                                                                       |
| `/api/escalate` no header         | `401 {"error":"unauthorized"}`                                                                                                       |
| `/api/escalate` valid             | `200 {… "next_of_kin":"Daughter","tell_the_patient":"A note has been left on the family view. Nobody has been called or messaged."}` |
| `/api/escalate` non-medication id | `422 {"error":"unknown_medication","item_id":"inst-falls"}`                                                                          |
| `/api/escalate` empty reason      | `400 {"error":"invalid_arguments","detail":"…"}`                                                                                     |

**Defect (minor, real).** `await request.json()` in both routes has no `.catch`,
so a non-JSON body throws before Zod and Next returns a bare 500 with an empty
body. The repo's own pattern is right next door —
`app/api/extract/route.ts:16` and `app/api/blob/upload/route.ts:46` both use
`await request.json().catch(() => null)`. Track 1's beat 9 ("`/api/log` rejects
a malformed body — **PASS** `400`") is true for JSON-shaped bodies and false for
malformed JSON. Not demo-blocking (ElevenLabs sends valid JSON) but it is the
kind of thing that reads as fine in an audit table and is not.

**FYI (not blocking):** the secret compare is `!==`
(`app/api/log/route.ts:38`), not `timingSafeEqual`. One shared secret, one demo,
fine — but say so if a judge asks about auth.

**Has a real ElevenLabs agent ever invoked these? No.** Track 1 says so plainly
(beats 23–26 UNTESTED, R1 marked 🔴 "This is the big one"). I confirm that is
documented honestly and not glossed: the beat table marks it UNTESTED, the
residual-risk section leads with it, and option 3 explicitly instructs "**Say so
if asked. Do not imply the agent did it.**" That is the right disclosure.

---

### 7b · The ElevenLabs tool config

I had this validated independently against the **live** `api.elevenlabs.io/openapi.json`
(fetched today) with a real Draft 2020-12 validator, not by eye.

**The JSON is correct.** All three payloads (`log_step`, `escalate_to_next_of_kin`,
`show_red_flag`) validate with **zero errors**. Every specific claim in Track 1's
grounding notes checks out, including the subtle ones:

- `tool_config` wrapper is right (`ToolRequestModel.required: ["tool_config"]`).
- `tool_error_handling_mode` exists; the schema description says verbatim
  _"'auto' determines handling based on tool type (summarized for native
  integrations, hide for others)"_ — so **G1 is confirmed** and `"hide"` is a
  correct no-op.
- `response_timeout_secs` is a sibling of `api_schema`, default 20, **min 5** for
  webhook / **min 1** for client. `8` and `5` both valid. (A webhook value below
  5 would 422 — worth knowing.)
- `interruption_mode: "allow"` and `pre_tool_speech: "auto"` are real and are the
  defaults.
- `request_headers` is a bare map to `string | {secret_id} | {variable_name} |
{env_var_label}` with **no** discriminator — **G3 confirmed**.
- `dynamic_variable` is the real field; **`value_type` has 0 occurrences in the
  whole live spec** — **G5 confirmed**. `system__conversation_id` is a real
  built-in.
- Client tools take `parameters` as an object schema; `expects_response` and
  `response_timeout_secs` are valid on them — **G6 confirmed**. (The
  client-tools _prose_ page still shows a contradictory array-of-objects form
  with `value_type`; it is stale and cannot validate. Track 1 was right to work
  from the spec.)
- The secrets request/response shapes are byte-for-byte right.

**FAIL — the runbook is incomplete in a demo-breaking way.**
`grep -n "tool_ids" audit/…/12-track-1-demo-flow.md` → **no match anywhere.**
Creating a tool via `POST /v1/convai/tools` is inert: the returned tool id must
then be added to `conversation_config.agent.prompt.tool_ids` on the agent. Track
1's "Checks before the demo" instead says, in bold:

> **C4 says they already do — read the agent back, do not re-PATCH `conversation_config`**

`tool_ids` **lives inside `conversation_config`**. A human following that
runbook literally will create two perfectly-valid tools that the agent never
receives, and the tool beat will silently do nothing on camera. This is the
single most consequential gap in Phase 1's documentation.

Two smaller notes: `"description": "..."` is load-bearing (it is the only signal
the model uses to decide when to call a tool — the real strings in the config
are fine, but do not paste placeholders), and `SECRET_ID_HERE` must be the id
returned by the secrets POST, so create the secret first.

**G8 is slightly overstated.** Track 1 writes "Environment-variable docs
additionally require URLs to begin with `https://`". The documented HTTPS
requirement applies to **post-call webhooks and STT batch webhooks**, not to
webhook tools — the `url` field on `WebhookToolApiSchemaConfig` is a bare string
with no `format` or `pattern`. The **conclusion is still correct and is in fact
better grounded than Track 1 made it**: ElevenLabs publishes static egress IPs
for "Webhook tools: Outbound calls from agent webhook tools", which proves the
call originates from their servers and localhost is unreachable by construction.

**Grounding URLs used:**
`https://api.elevenlabs.io/openapi.json` ·
`https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools.md` ·
`https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools.md`
(stale — see above) ·
`https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables.md` ·
`https://elevenlabs.io/docs/eleven-api/resources/ip-allowlisting.md` ·
`node_modules/@elevenlabs/react/dist/conversation/ConversationClientTools.d.ts`

---

### 8 · Family escalation is computed, not painted

**This is the beat the product claim rests on, and it survives.**

I drove all three states using **only** real log writes, and got to `nudge` and
`alert-kin` through `/api/log` — the ElevenLabs server-tool route, with the
shared secret — so nothing on the path was an operator affordance:

```
STEP 0  freshly seeded                                       → "A dose that matters was missed twice." / Apixaban 5mg
STEP 1  both seeded misses answered as taken                 → "Nothing needs your attention."
STEP 2  POST /api/log  x-portico-tool-secret  status=missed  → "A dose was missed." / Apixaban 5mg
          {"ok":true,"item_id":"med-apixaban","day":"2026-07-27"}
STEP 3  clock +1, POST /api/log again                        → "A dose that matters was missed twice." / Apixaban 5mg
          {"ok":true,"item_id":"med-apixaban","day":"2026-07-28"}
          chips: "Missed on Monday 27 July", "Missed on Tuesday 28 July"
```

**Then I tried to make it lie, four ways, and could not:**

1. **Search params.** `GET /family?kind=alert-kin&assessment=alert-kin` changes
   nothing — `FamilyPage()` takes no arguments at all
   (`app/(phone)/family/page.tsx:24`).
2. **Grep for a second producer.** `alert-kin` appears in exactly two places
   that matter: `lib/escalation/rules.ts` (produced) and
   `components/family/escalation-card.tsx:74` (consumed). Every other hit is a
   comment or an operator hint string. There is no third writer.
3. **The operator panel with an empty log.** I deleted _every_ `portico:log:*`
   key directly in Redis, then pressed **Ring the check-in**, **+1 day**, **−1
   day** and **Cancel** in sequence:
   ```
   /family with ZERO log entries      → "Nothing needs your attention."
   /family after ringing + clock moves → "Nothing needs your attention."
   UNCHANGED
   ```
4. **The escalate route.** `app/api/escalate/route.ts` writes a `LogEntry` and
   returns; it sets no flag. Confirmed by reading it and by the fact that a
   single `escalate` call produces `nudge`, not `alert-kin`.

The card also names its own provenance on screen: _"Two missed doses in 3 days
is why you are seeing this. It has not been reported to anyone else."_ and
_"This is worked out from what was answered in the app, not by a clinician."_

**PASS.** Not FAKE. The single most important claim in Phase 1 is true.

---

### 9 · Operator controls

Every button on `/operator`, from the live DOM:

```
["Reset to the seeded state", "−1 day", "+1 day", "Set",
 "Mark Apixaban 5mg MISSED yesterday", "Mark Apixaban 5mg TAKEN yesterday",
 "Mark Apixaban 5mg TAKEN today",
 "Ring the check-in on the phone", "Cancel the ringing check-in"]
Mode row: "Mode demo"
any button that claims to toggle the mode? false
```

**No mode toggle exists, and the page says why** rather than shipping a switch
that changes a label:

> "NEXT_PUBLIC_PORTICO_MODE is baked into the client bundle at build time, so
> there is no honest way to flip it from this page — a switch here would change
> a label and nothing else. Change it in the .env file and restart the server."

That is exactly the lie I was sent to find, and it is not there. Every write
goes through `appendLogEntry()` / `setDemoToday()` / `raiseCheckIn()` / the seed
route, and the page re-reads state via `router.refresh()` rather than
optimistically rendering. `assess()` is displayed as a computed row
(`alert-kin — Apixaban 5mg (2026-07-25, 2026-07-26)`), not stored. **PASS.**

Screenshot: `.e2e/ui/desktop-operator.png` — and X3 confirmed, there is no
`<code>` and nothing renders in monospace.

---

### 10 · Demo badge

Counted `getByText("Demo mode.")` on every screen at 390×844:

```
/          1        /plan      1        /upload    1
/check-in  1        /family    1        /operator  0   ← no badge component
```

**PASS on all five patient-facing screens**, including the incoming-check-in
variant and both home states. `/operator` has no badge but carries a
`Mode  demo` row plus the paragraph above, which serves D9 rule 2 better than a
badge would. Not a defect; noting it because the brief listed `/operator`.

---

### 11 · D9 boundary

A second server, live mode, on :3100 (`.env` untouched, `:3000` never left demo):

```
GET    /api/demo/check-in  → 403 {"message":"The operator controls only exist in demo mode, and this app is running in live mode."}
POST   /api/demo/check-in  → 403   (same)
DELETE /api/demo/check-in  → 403   (same)
GET    /api/demo/clock     → 403   (same)
POST   /api/demo/clock     → 403   (same)
POST   /api/demo/log       → 403   (same)
POST   /api/seed           → 403 {"message":"The seed overwrites the stored plan with the demo bundle, and this app is running in live mode, so it has not run."}
```

7 of 7. **PASS.** (This also proves the process env var overrides `.env` — the
message names "live mode".)

**D9 rule 1 holds — no failure path serves baked data.** I read every `catch`
in `app/`, `lib/` and `components/`. `lib/extraction/extract.ts:57` checks the
mode **before** the model call and every failure below returns
`unreadable`/`invalid`; `lib/drugs/lookup.ts:114` likewise returns from the seed
map in demo and `{kind:"failed"}` on any live error. Nothing catches its way
into `DEMO_PLAN`.

**FAIL — D9 rule 3.** _"Every demo shortcut must have a live counterpart that
has been proven to work at least once."_ On this machine the live counterpart
for the biggest shortcut **cannot run at all**:

```
POST :3100/api/extract  →  HTTP 500, empty body

⨯ Error [ZodError]: [{ "path": ["ANTHROPIC_API_KEY"],
    "message": "Invalid input: expected string, received undefined" }]
    at llmEnv (lib/env.ts:47:20)
    at extractBundle (lib/extraction/extract.ts:63:9)
    at POST (app/api/extract/route.ts:27:37)
```

Cause: commit `fe657f6 "fix: address the four adversarial reviews, and extract
via Anthropic"` swapped the provider to `anthropic("claude-haiku-4-5")` and
`llmEnv()` to `ANTHROPIC_API_KEY`. `.env.example` was updated
(`ANTHROPIC_API_KEY=`). **`.env.local` was not** — it still carries only
`OPENAI_API_KEY`. So live extraction, and therefore `make eval`, has been dead
here since that commit.

It fails **loudly and at the config boundary**, which is the right shape, and it
never falls back to demo data — so this is not a D9 rule 1 violation. But the
bare 500 (rather than the named 422 A6 specifies) means the surface a patient
sees is the generic "We could not finish reading that". And the honest position
for the night is: **you cannot currently demonstrate that live extraction works,
so do not claim it does.**

Related, and both stale: `tasks/plan.md` §Demo mode still says extraction is
"Real AI Gateway → **OpenAI** structured outputs (`Output.object`)", and
`12-track-1-demo-flow.md:11` says "Extraction stays baked — `lib/extraction/`,
**OpenAI**, the AI Gateway …". The code has used Anthropic since `fe657f6`.

---

### 12 · Repo hygiene

```
pnpm typecheck   → tsc --noEmit,  exit 0
pnpm lint        → eslint .,      exit 0
```

| Grep                                         | Result                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dvh` / `vh` inside `app/(phone)`            | **Clean.** Only `app/(phone)/layout.tsx` (the frame, which CLAUDE.md says owns the height) and comments. No page uses either.                        |
| `: any` / `as any` / `<any>`                 | **Clean.** One hit, and it is the word "anything" inside a comment.                                                                                  |
| `backdrop-blur` / `backdrop-filter`          | **Clean.** Zero.                                                                                                                                     |
| `font-mono` / `<code` / `<pre` / `monospace` | **Clean.** Two hits, both comments — including the one in `operator/page.tsx:86` explaining why the `<code>` was removed.                            |
| Raw hex in `app/` + `components/`            | **Clean.** `themeColor: "#ffffff"` (a metadata value, not a style) and `components/voice/orb.tsx` — the one gradient CLAUDE.md explicitly sanctions. |

**Voice start chain intact.** `idle-view.tsx:76` `onClick={onStart}` →
`voice-session.tsx:363` `begin()` → `void connect()` →
`connect()` line 326 `await navigator.mediaDevices.getUserMedia({audio:true})`
→ `fetchSignedUrl` → `startSession`. `connect()` is invoked **synchronously**
inside the handler, so `getUserMedia` is reached inside the gesture. No effect,
no timeout, no router transition in the path. `ConversationProvider` wraps
`Session` and stays mounted; `end()` calls `endSession()` explicitly. **PASS.**

Console, page errors and 4xx/5xx across `/`, `/plan`, `/upload`, `/check-in`,
`/family`, `/operator` at both viewports through my whole run: **none**.

---

## Lies and overstatements

**L1 — Track 2 residual risk #1 is stale and would misdirect the operator.**

> "`POST /api/seed` does not clear it (it only writes 25 and 26 July). … **Track
> 1 should flush `portico:log:demo:2026-07-28`**"

It does clear it now. Verified above with two forward-day keys. Nobody needs to
touch Redis by hand. Leaving this sentence in the audit set means that at 2am
someone will go looking for a Redis console they do not need. **Not dishonest —
concurrent tracks — but it must be corrected before anyone reads these two docs
as one report.**

**L2 — "`/api/log` rejects a malformed body — PASS `400`" is true only for
JSON-shaped bodies.** A non-JSON body is a bare `500` with an empty response.
See §7.

**L3 — the runbook cannot actually wire the tools up.** No mention of
`tool_ids`, plus an explicit instruction not to PATCH `conversation_config`,
which is where `tool_ids` lives. See §7b. This is the one I would fix first.

**L4 — G8's HTTPS claim is attributed to the wrong docs.** The HTTPS requirement
covers post-call and STT webhooks, not webhook tools. Conclusion unaffected and
in fact strengthened by the published egress IPs. See §7b.

**L5 — the 4.56s flip figure is presented as a measurement of the slow path.**
It is one sample from a uniform 0–5s distribution; so are my three. Neither
number is a worst case. The worst case is 5s + a server render.

**L6 — "extraction … OpenAI" in both `tasks/plan.md` and
`12-track-1-demo-flow.md`.** The code has used `anthropic("claude-haiku-4-5")`
since `fe657f6`. Track 1 did not touch extraction, so this is inherited, not
introduced — but it is a false sentence in a document a judge might read.

**L7 — one of the 19 arc assertions cannot fail.**
`scripts/demo-arc.sh:49` — `check "clock moves a day" '"today":"'` asserts only
that the response contains the substring `"today":"`. If `shiftDays` were
ignored entirely and the route returned the same date, this passes. (Line 50,
"clock moves back", does assert the exact value, so the pair is not vacuous —
but the count "19 passed" contains one that is.) The other 18 assert real
substrings tied to real behaviour, including the escalation headings, the four
auth/validation codes and the raised-check-in timestamps. **The harness is
substantially honest; the count is one better than it should be.**

**L8 — "Good afternoon." is not computed.** `lib/i18n/en.ts:31` is a hardcoded
string (`fr.ts:21` likewise). It looks like a time-derived greeting and is not.
If you film in the morning, the phone greets an elderly patient with "Good
afternoon." at 9am.

**L9 — `/family` names a next of kin on a screen that says no plan is loaded.**
With `portico:plan:demo` deleted, `/family` renders "Next of kin on the letter:
Daughter" above "No recovery plan has been loaded yet." — because `readPatient`
and `readPlan` are independent. Cosmetic, but it is a claim about a letter the
screen has just said it does not have.

**Where the build agents were straight with me, and should be credited:** the
`clearLog` fix is real and I could not break it; the `assess()` claim is real
and I could not fake it; `NEXT_PUBLIC_PORTICO_MODE` is honestly non-toggleable
with the reason on screen; the localhost trap is stated in bold with an explicit
"do not imply the agent did it"; and the tool-config JSON is correct in every
field I could check against the live spec, including three subtleties the prose
docs get wrong.

---

## Screenshot judgements

Every image below was opened with the Read tool and looked at. Judged as a
frightened, confused 78-year-old two days out of hospital: **what is this, what
is the one thing to do, what can wait.**

| Image                                                  | What I actually saw                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.e2e/ui/desktop-home.png`                             | Best screen in the set. One blue button ("Start today's check-in"), a one-line explanation under it, two hairline rows, admissions anchored at the foot. From across a room the button _is_ the screen. Passes the three-question test instantly.                                                                                                                                                                                                  |
| `.e2e/ui/phone-home.png`                               | Same at 390px. The gap between the second row and the footer is large but reads as calm, not broken, because both admissions are pinned to the bottom.                                                                                                                                                                                                                                                                                             |
| `scratchpad/shots/desktop-home-no-plan.png`            | One door: "Take a photo of your letter", two sentences of consequence, nothing else tappable. This is the screen that tells the ingest story — and it is not the one you will be filming.                                                                                                                                                                                                                                                          |
| `.e2e/ui/desktop-plan-top.png`                         | **The weakest on-camera frame.** ~40% of the phone is the pink "Get help if / breathless, feverish or confused again" block. "Today Monday 27 July · Day 2" and the tap instruction clear the fold, but the first medicine's dose line is **cut by the home indicator**. A confused patient may not realise there is a list below. Track 2 flagged this themselves; I agree with their judgement that shrinking the doctor's words would be worse. |
| `.e2e/ui/phone-plan-today.png`                         | Excellent. Four 28px rings, one plain instruction, four medicines. Tomorrow's card sits below with **no rings and no marks at all** — the future-day fix is visible, not just asserted. One reservation: "1 tab, **BD**, Oral, Ongoing" and "**Nocte**" are clinical shorthand shown verbatim to a 78-year-old. Correct by the verbatim rule, but it undercuts the "plain English" claim if a judge reads it aloud.                                |
| `.e2e/ui/phone-plan-scrolled.png`                      | "Changed in hospital" reads as a section break; "Earlier days. You can still tick anything you took." is a good, unpatronising sentence. The "Missed" chip on Apixaban (25 July) is legible with a red edge and a red triangle. Demotion by position and weight works.                                                                                                                                                                             |
| `.e2e/ui/phone-red-flag.png`                           | The precedence is visible before you read a word: doctor's words on the pink tint, NHS block on grey below. **But the NHS text has scrape artifacts** — "…prescribed dose of doxycycline You can call 111 or get help from 111 online ." (missing sentence break, floating space before the period). Small, and on camera if anyone opens that disclosure.                                                                                         |
| `.e2e/ui/phone-check-in-idle.png`                      | Calmest screen in the app. Orb, "Let's check in.", one sentence, one huge "Start talking", a quiet "Type instead", badge at the foot. Nothing to get wrong.                                                                                                                                                                                                                                                                                        |
| `scratchpad/shots/desktop-check-in-incoming.png`       | Reads unmistakably as an incoming call: "Incoming check-in" eyebrow, "Portico — your check-in", "It is time for today's check-in. Tap to answer.", full-width **Answer**. This is the beat that will sell the demo.                                                                                                                                                                                                                                |
| `.e2e/ui/desktop-family-alert.png`                     | The money shot, and it is honest. Red left rule, "A dose that matters was missed twice.", "Apixaban 5mg", then the sentence that makes the whole product claim: "Two missed doses in 3 days is why you are seeing this. **It has not been reported to anyone else.**" Two date chips in human English. Provenance line under a hairline.                                                                                                           |
| `.e2e/ui/{phone,desktop}-family-nudge.png`             | "A dose was missed." with an amber left rule. Distinguishable from the alert at a glance without reading. Verified as `assess() → nudge`, driven by one real log entry.                                                                                                                                                                                                                                                                            |
| `.e2e/ui/{phone,desktop}-family-none.png`              | "Nothing needs your attention." No rule, no chips. Correctly boring.                                                                                                                                                                                                                                                                                                                                                                               |
| `.e2e/ui/desktop-upload.png`                           | "Add your discharge letter" → two-line instruction → 112px blue panel breaking cleanly at the clause ("Take a photo / or choose a file"). The ~700px dead band Track 2 flagged is real. The footer sentence "We read the medicines, dates and advice off your letter and build your plan from what it actually says." sits directly **under** the demo badge — read in order, the disclaimer lands first, which is the honest ordering.            |
| `.e2e/ui/desktop-operator.png`                         | Backstage but presentable if the camera widens. No monospace anywhere. "Mode demo", "Today 2026-07-27", "assess() alert-kin — Apixaban 5mg (2026-07-25, 2026-07-26)" — the computed state on screen, plus the honest paragraph about why the mode cannot be flipped here.                                                                                                                                                                          |
| `scratchpad/shots/phone-plan-after-foreign-upload.png` | Emma Clarke's letter uploaded; Harold Whitfield's plan on screen with the demo badge above the fold. The app is telling the truth. A presenter narrating over it might not be.                                                                                                                                                                                                                                                                     |

---

## What a human must do before filming

Ordered. Items 1 and 2 are the only ones nobody else can do.

1. **Decide whether the voice tools are in the demo at all, and if they are,
   attach them.** Deploy (or tunnel) to a public HTTPS origin, create the
   workspace secret, create the two webhook tools **and then add the returned
   tool ids to `conversation_config.agent.prompt.tool_ids` on the agent** —
   which Track 1's runbook does not mention and implicitly warns against.
   Read the agent back afterwards and confirm the C1 per-locale TTS pins
   survived. **If you are not doing this, cut the tool beat and say the operator
   reported the miss.** Do not imply the agent did.
2. **Run one real voice call, in English and in French, end to end.** Nobody has
   made a single ElevenLabs session since the prompt became plan-aware. Confirm
   the agent's **Security** tab allows all four overrides in use — prompt, first
   message, language, TTS voice. A disallowed override does not degrade
   gracefully: the socket closes 1008 and the screen shows a red error banner
   where Portico should be talking. **This is the highest-value 10 minutes
   available before the shoot.**
3. **Rotate the OpenAI key in `.env`, and add `ANTHROPIC_API_KEY` to
   `.env.local` if you want live extraction to exist.** `.env` — the file whose
   own header says "Secrets live in .env.local — never put XI_API_KEY / tokens
   here" — currently holds a live `OPENAI_API_KEY` in plaintext. It is
   gitignored, so it is not committed, but it has now been read aloud by tooling
   and it is the wrong file. Separately, `ANTHROPIC_API_KEY` is absent, so live
   extraction 500s (§11). Either add the key and prove it once, or accept that
   live extraction is unproven and never claim it on camera.
4. **Correct the two stale sentences before anyone reads the audit set as one
   report:** Track 2's residual risk #1 (the seed _does_ clear the stale key
   now) and "extraction … OpenAI" in `tasks/plan.md` and `12-…`.
5. **Choose the opening shot deliberately.** If the film needs to say "this is
   built from your discharge letter", open on the **empty** home — `curl -X POST
localhost:3000/api/seed` gives you the seeded one, and deleting
   `portico:plan:demo` gives you the other. Seeded home leads with the check-in
   and the letter is the third item.
6. **Run `make arc` immediately before the take** (19/19, ~5s, leaves the app
   seeded), then `make operator` on the laptop and `/check-in` on the phone.
7. **Reset between takes with the operator's Reset button, not by hand.** It is
   a total reset now, including a forward-parked clock and a ringing check-in.
8. **Ring the check-in a beat early.** Budget 5 seconds, not 3.
9. **Do not upload a letter that is not Harold Whitfield's** unless you are
   explicitly narrating that demo mode serves a recorded bundle.
10. If you film in the morning, know that home will say "Good afternoon."

---

## Residual risk — what can still break on camera

**R1 — 🔴 The live voice call has never been run once since the prompt changed.**
This is my top risk, above the localhost trap. Every beat in the film funnels
through tapping **Answer**. If any of the four session overrides is disallowed
on the agent, the socket closes 1008 _after_ `conversation_initiation_metadata`,
the `try/catch` in `connect()` cannot see it, and `onError` paints a banner over
the transcript. The failure is loud, immediate, and on the hero beat. Payload
verified; audio unverified. **Test it.**

**R2 — 🔴 The narration, not the code, is where the demo can become a lie.** In
demo mode any uploaded letter produces Whitfield's plan (proved with Emma
Clarke's letter, §3). The code discloses this three ways. A presenter saying
"and it's read my letter" over that screen does not. Agree the exact wording
beforehand.

**R3 — 🟠 The server tools cannot fire from localhost, and the runbook will not
get them attached.** Track 1's R1 plus the `tool_ids` gap in §7b. Combined, the
probability that `log_step` fires on camera without a human doing extra work not
written down anywhere is effectively zero.

**R4 — 🟠 Live extraction is dead here** (`ANTHROPIC_API_KEY` missing → 500).
Only bites if someone switches to live mode to "prove it's real", or if a judge
asks to see it. It fails loudly and never serves fake data, so the honest answer
is available — but it is not the answer anyone wants to give on camera.

**R5 — 🟡 `/plan` opens on an alarm.** The red-flag card is ~40% of the first
frame and today's list is cut off at the fold on desktop. Correct for safety,
risky for a 60-second story about a calm daily plan. If the shot needs today
higher, scroll before rolling.

**R6 — 🟡 The French take will hear English clinical words.** The red-flag
trigger and action reach the agent in English even though authored French exists
in the bundle (§6). `purposePlain` and the instructions have no French at all.
The screen is French; the voice will not entirely be.

**R7 — 🟡 The incoming-check-in card can take a full 5 seconds.** Uniform over
the poll interval. Measured 3.1–3.4s in three (phase-correlated) runs.

**R8 — 🟡 The clock and the assessment window interact.** `assess()` reads today
and the two days before. Move the clock forward three days and the seeded misses
fall out of the window and the escalation vanishes — correctly, but surprisingly
on camera. One Reset tap recovers it.

**R9 — 🟢 A non-JSON body to `/api/log` or `/api/escalate` returns a bare 500.**
Not reachable from ElevenLabs, which sends valid JSON. Reachable from a curl
typo during a rehearsal.

**R10 — 🟢 NHS scrape artifacts are visible** in the open red-flag disclosure
("…doxycycline You can call 111…", " ."). Only if someone opens that panel on
camera.

**R11 — 🟢 `/family` is unauthenticated** and `/operator` is unlinked but
reachable. One patient, no auth anywhere in the build. Consistent, not new —
worth one honest sentence if asked.

**R12 — 🟢 Secret comparison is not timing-safe**, and the home greeting is a
hardcoded string. Neither will break a take.

---

## Environment left behind

`:3000` is **up, demo mode, seeded**: `today 2026-07-27`, log keys
`portico:log:demo:2026-07-25` and `…-26` only, `/family` reads "A dose that
matters was missed twice." The live-mode server on :3100 was killed and its tree
removed. `.env` and `.env.local` were not modified. `.e2e/ui/` was regenerated
after `e2e-demo.ts` wiped it. No source file was edited and nothing was
committed.
