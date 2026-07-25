# Locked decisions — human calls, not research output

These are decisions the human made directly during planning. They are **not**
open questions and **not** research findings. Phase 2 (spec) and Phase 3 (task
split) must treat them as fixed inputs. Where a Phase 1 findings file was
written under an older assumption, this file wins.

Recorded: 2026-07-25.

---

## D10 — Product name: Portico (not Juno)

**Decision (human, 2026-07-25):** the product is **Portico**.

**Juno** is the hackathon host / event — not our brand. Do not use "Juno" as
the app name, voice persona, check-in copy, or `<title>`. Repo / Vercel
project / audit folder may still say `juno-hack` or `juno-recovery-companion`
as legacy paths; that is scaffolding, not the product name.

**Voice / UI:** the companion introduces itself as Portico
("Hello, it's Portico…"). Redis key prefix and locale cookie for new code:
`portico:` and `portico_locale` (do not introduce new `juno:` keys).

**Metaphor (for pitch, optional):** the threshold between ward and home —
Portico is the doorway you pass through with a clear plan.

---

## D1 — Persistence: Vercel-native, via the Marketplace

**Decision:** Real persistence is in scope. It is Vercel-native.

| Concern                                        | Choice                     | Package         | Env                                              |
| ---------------------------------------------- | -------------------------- | --------------- | ------------------------------------------------ |
| App state (patient, plan JSON, daily log, kin) | **Upstash Redis**          | `@upstash/redis`| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Uploaded letter images / PDFs                  | **Vercel Blob**            | `@vercel/blob`  | `BLOB_READ_WRITE_TOKEN`                          |

**Supersedes:** `plan/initial-idea.md` line ~109 ("Storage: local / mock first…
Supabase = stretch goal") and the "no database of any kind" constraint given to
the Phase 1 research tracks.

**Still explicitly excluded:** Supabase. Neon / Postgres. Any ORM (Prisma,
Drizzle). `@vercel/kv` (sunset — Upstash is its documented replacement).

**Why:** the data model is tiny and key-value shaped, so Redis needs no schema,
no migrations and no ORM. More importantly, module-level state on Vercel
serverless is per-instance and does not survive between invocations — with no
store, the adherence log and the family dashboard could only ever be faked. The
cross-device escalation beat is the product's second hero moment; it has to be
real.

**Consequence:** Upstash has no realtime subscriptions, so the family dashboard
polls. See D5.

---

## D2 — LLM: Vercel AI SDK through the Vercel AI Gateway

**Decision:** Discharge-letter extraction runs through the **Vercel AI SDK**,
with the model addressed as a `"provider/model"` string via the **Vercel AI
Gateway**. Env: `AI_GATEWAY_API_KEY`.

**Supersedes:** `plan/initial-idea.md`'s assumption of OpenAI direct.

**Why:** platform-native given we deploy on Vercel; one key rather than per-
provider keys; provider failover if one rate-limits mid-demo.

**Note:** no LLM key of any kind exists in `.env` today. This is the single
hardest blocker on the Tier 1 critical path.

---

## D3 — Call model: notification → tap → in-app orb, NOT a phone call

**Decision, in the human's words:**

> "Not really a call but more so it would be a notification they get and then we
> have like the orb and kinda like chatgpt voice mode kinda thing where it'll ask
> u like if u done what u needed to and u talk to it and also like it'll ask how
> are u feeling etc rather than a call more like a two way chat"

So: a notification lands → the patient taps it → the app opens → the **existing**
ElevenLabs orb session starts inside that tap → two-way spoken conversation.

**Supersedes:** demo-script beat 3 in `plan/initial-idea.md` ("the app _calls_
Margaret"). That beat must be rewritten.

**Explicitly excluded:** Twilio. SIP. Any real outbound telephony. No phone
number is being provisioned.

**Why this is good news, not a compromise:** it is exactly what
`components/voice/voice-session.tsx` already implements, and it satisfies the
CLAUDE.md mic-in-user-gesture rule for free — the mic request stays inside the
tap, so Safari cannot refuse it.

---

## D4 — Second language: French (`fr`), not Welsh / Urdu

**Decision (revised 2026-07-25, human):** the two languages that must work fully
end to end — every UI string **and** every voice interaction — are **English
(`en`)** and **French (`fr`)**.

**Why French, not Welsh:** Welsh TTS only exists on `eleven_v3_conversational`.
The dashboard's "Additional Languages" path silently switches the agent to
Flash / Multilingual v2.5, which has **no Welsh**, and the API accepts `cy`
anyway — so a misconfigured agent fails as mushy audio with **no error**. Welsh
ASR is also only "Good" (~10–20% WER). French is on **Flash v2.5** (the 32-
language set that path uses) and Scribe ASR is **Excellent (≤5% WER)** — same
tier as English. Demo reliability over novelty.

The other locales already in `components/language-picker.tsx` (`cy`, `pl`,
`ro`, `tr`, `pt`, `es`) are **showcase-only**: visible in the picker, not
required to work behind. Selecting one must show an explicit in-language "not
yet" panel — **never** a half-translated screen and **never** a silent fall-
back to English.

**Supersedes:** Welsh as the real second locale (earlier D4); the entire Urdu
framing in `plan/initial-idea.md`. Welsh research in
`02-track-2-elevenlabs-feasibility.md` remains useful as the cautionary tale
for silent model/language mismatch — it is no longer the build target.

---

## D5 — Escalation channel: in-app family dashboard, primary

**Decision:** escalation surfaces in an **in-app family/caregiver dashboard**.
Polling is acceptable — the human was asked about the 2–3s lag and said it is
"not the biggest problem".

**Email (Resend) is an explicitly-flagged Tier 3 stretch**, not spine. Build it
only if time remains after Tier 1 and Tier 2 are done.

**Excluded:** SMS (would have required the Twilio account that D3 removed).

**Why dashboard over email as primary:** demoing our own UI beats demoing a mail
client; the caregiver dashboard is where the family lives in the product story;
and it needs no third-party account on the critical path.

**Caveat to verify before anyone builds the email stretch:** Resend's free tier
is understood to restrict sending to a verified domain or the account owner's
own address, which would mean "Priya's inbox" is really the builder's inbox.
This was **not** verified during planning — check it before committing.

---

## D6 — Drug red-flag source: NHS.uk medicines A-Z (BNF is unusable)

**Decision:** follows Track 3's evidence, and overrides the medic's BNF
suggestion on access grounds — not on clinical grounds; he was right about the
content.

The BNF is unreachable: `bnf.nice.org.uk` returns HTTP 403 ("BNF is only
available in the UK"), BNF content is excluded from the NICE UK Open Content
Licence, commercial licensing runs through `licensing@rpharms.com`, and scraping
is explicitly forbidden and IP-blocked. See
`03-track-3-drug-lookup-feasibility.md` for the retrieved evidence.

**Replacement:** NHS.uk medicines A-Z, fetched **at ingestion time** (not as a
live mid-call tool), keyed off the drugs actually named in that patient's letter.
Results are stored as extra fields on that patient's plan JSON.

**Still excluded:** any standing / general drug side-effect database.

### Action item for the medic (time-critical)

The demo's clot-preventer must be **apixaban or rivaroxaban**, *not* enoxaparin
or dalteparin — the injectable LMWHs 404 on the NHS medicines A-Z, so the
red-flag lookup would return nothing on the single most important drug in the
demo. Apixaban is clinically correct here (its PIL covers prevention of clots
after hip/knee replacement), so this is not a workaround. **Raf needs this before
he writes the bundle.**

---

## D7 — Translation policy for clinical text

**Decision (human, two parts; locale revised to French per D4):**

**Part 1 — red-flag lines render dual.** In French mode, a red-flag card shows
the French translation **and** the doctor's exact English words together, with
the English labelled as the original (e.g. "exact words from your letter").
Ordinary timeline items, medication steps and general advice are translated
cleanly, French only — no English mixed in. Rationale: there are only a handful
of red flags, so dual-rendering costs little screen space on exactly the text
where verbatim matters most.

**Part 2 — clinical proper nouns are never translated.** In the human's words:

> "we'll bare the responsibility of the translation we obv wont translate the
> condition names and stuff but explain it and say it in their native language"

So: drug names, condition names and procedure names stay in the original
(`apixaban` stays `apixaban` — the patient has to match it to the box in their
hand). What gets translated is the **explanation** around them. "Anticoagulant"
is not rendered as a French medical jargon dump; it is explained in French as
"médicament qui empêche les caillots" (or equivalent plain French).

**Also settled:** the team accepts responsibility for translation quality. Do not
add further guardrails, disclaimers or hedging beyond the dual-render above — that
question is closed. **No machine-translated first message or system prompt** —
author `en` and `fr` copy by hand.

**Schema consequence:** this is a shared-contract change, so it must be fixed
before either coder starts. Translatable string fields need to carry the original
alongside the translation for red flags, and clinical nouns need to be
distinguishable from surrounding prose so they survive translation untouched.
Deciding this late would mean reseeding Redis.

**Interaction with D6:** consistent with the NHS.uk licence finding — translated
NHS content may not be attributed to the NHS (terms 3.6(b) counts translation as
adaptation). So quote the symptom list, and keep the recommended action in
Portico's own words, which stays stable across languages.

---

## Confirmed defects in existing code (found during planning, not yet fixed)

These are real, verified, and small. They are recorded here rather than patched
because this was a planning-only pass. Phase 3 must schedule them.

1. **`<html lang>` is hardcoded `"en"`** at `app/layout.tsx:50`. Must follow the
   active locale, or screen readers announce French with English pronunciation.
2. **`overrides.agent.language` is hardcoded `"en"`** at
   `components/voice/voice-session.tsx:225`. Must take a `locale` prop.
3. **README.md is factually wrong about overrides.** It states a disallowed
   override "is silently ignored and you get the dashboard prompt instead". The
   ElevenLabs docs say the opposite: "An error will be thrown if an override is
   provided for a field that does not have overrides enabled." Fix the README —
   and treat that throw as **desired** (loud failure), not something to soften.
4. **CI is red.** `prettier --check` fails on `plan/raw-transcript.md`; the last
   commit landed without `make format`. CI runs *only* `format:check` — `tsc
   --noEmit` and `eslint .` both pass and need no env vars, so they are free
   additions.
5. **`next build` fails at `lib/env.ts:12`** when `NEXT_PUBLIC_*` are empty. The
   same module-scope trap will hit `Redis.fromEnv()`. The lazy `serverEnv()` shape
   at `lib/env.ts:23` is the existing fix to copy.
6. **No ElevenLabs agent exists for this project yet.** `NEXT_PUBLIC_AGENT_ID` is
   still a placeholder. Creating and configuring the agent is part of Phase 0
   (see D8), not an afterthought.

---

## D8 — ElevenLabs agent: pin Flash v2.5, French + English, no silent model drift

**Decision (revised 2026-07-25 with D4):** create a dedicated **Portico**
Conversational AI agent. Pin TTS explicitly to **`eleven_flash_v2_5`**. Real
locales: `en` and `fr`. French is on that model's published 32-language list;
ASR is Excellent.

**The lesson from Welsh (still binding as engineering law):** ElevenLabs has
**no language enum** on the agent `language` field. An unsupported code is
accepted and fails at *runtime* as bad audio, not a config error. The dashboard
"Additional Languages" flow also **rewrites the TTS model** under you. That is
exactly the class of silent fallback this project forbids (see D9).

**Therefore, for French we still pin the model — we do not "trust the
dropdown":**

```json
{ "conversation_config": { "tts": { "model_id": "eleven_flash_v2_5" } } }
```

Adding French via Additional Languages is fine **only after** that pin is
verified and re-checked (the flow must not have moved us off Flash v2.5). If
the pin and the language disagree, **stop and fix** — do not ship, do not
downgrade to English voice with French UI, do not "try another model".

**Agent setup checklist (human + API — Phase 0, before Track B voice work):**

1. Create the Conversational AI agent; put its id in `NEXT_PUBLIC_AGENT_ID`.
2. Pin `tts.model_id = "eleven_flash_v2_5"`. Confirm after any language edit.
3. Enable Security overrides (all default `false`): `prompt.prompt`,
   `first_message`, `language`, `tts.voice_id`, `asr.keywords`. A missing
   toggle must **throw** in session — that is the correct failure mode.
4. Author dashboard first-message stubs only as placeholders; **runtime**
   `firstMessage` and system prompt come from `buildCheckInPrompt` overrides
   (authored `en` / `fr`, never LLM auto-translate).
5. Register server tools later (Track B) against a **deployed** URL — never
   `localhost`. Set `client_events` for tool request/response ticks on the
   agent config, not per-session.
6. Ear-test one English and one French session before Checkpoint 1. Bad audio
   with HTTP 200 is a failed spike — escalate to the human, do not paper over.

**Also settled:** language is fixed for the duration of a call — no mid-call
en/fr switch; locale is chosen before `startSession`.

---

## D9 — No silent fallbacks. Fail loudly. One explicit path.

**Decision (human, 2026-07-25):** the Welsh / Multilingual-v2.5 trap is the
canonical example of why this project bans silent fallbacks. If something is
wrong, the demo (and the code) must make that **obvious**. Never degrade into a
configuration that "mostly works".

**Hard rules:**

1. **No silent model/language fallback.** Pin TTS model + language explicitly.
   Never rely on dashboard defaults. Never accept "starts in French then turns
   to mush" as a recoverable state.
2. **No UI language fallback.** Missing dictionary keys are compile errors
   (`fr.ts satisfies Dictionary`). Showcase locales show an explicit "not yet"
   panel — never English leaking into a French screen.
3. **No English-voice-with-French-UI downgrade** if French voice fails. Stop,
   tell the human, fix the agent. That old Welsh "fallback 1" is **rejected**.
4. **No soft env defaults.** Missing `XI_API_KEY`, Redis, Blob, or AI Gateway
   keys throw at the `xxxEnv()` boundary — do not invent placeholders at
   runtime.
5. **No silent clinical degradation.** Redis parse failures throw. Extraction
   `safeParse` failures return a clear 422. Drug lookup returning `null` means
   "this drug is not on NHS.uk A–Z" as a typed empty result — it must not be
   papered over with a generic side-effect blurb.
6. **Overrides disabled → throw.** Document and keep that behaviour. Do not
   catch-and-ignore.

**Allowed explicit branches (these are not fallbacks):** typed `null` for
absence, discriminated unions (`assess()` kinds), showcase "not yet" panels,
and HTTP error responses with plain-language messages. Each is a named state
in the flow map, not a quiet substitute for the happy path.

---

## Standing constraints (unchanged, restated so they are not lost)

- Stack is fixed: TypeScript, React, Next.js App Router, Vercel. Not up for
  re-litigation.
- The medic generates the **entire** discharge bundle (PDFs / images / photos)
  and sanity-checks clinical plausibility. It is an **external input contract**,
  not a deliverable of ours. We own the pipeline and everything downstream.
- The medic has **not** picked the clinical scenario yet, and pushed back on
  exotic cases: "when you hear hooves… think there's a horse, not zebras." Do not
  hard-code around hip replacement.
- `fal.ai` image generation is decorative and optional only. It must never be the
  data path — image models cannot reliably render readable text, and the medic's
  real scans are the source of truth.
- ElevenLabs is the hero feature. ~1.8M credits, so not resource-constrained, but
  each test call costs a little — script test calls tightly rather than looping.
- Still cut, per `plan/initial-idea.md`, and not to be reintroduced without an
  explicit flagged change: AI symptom-checker / triage, computer-vision pill ID,
  label OCR, open-web "ask anything" Q&A, discharge-conversation dictation.
- The guiding principle is unchanged and decides every feature: **the app only
  reformats, schedules and reads back the clinician's own words, and routes to
  humans. It never generates new clinical judgement.**
