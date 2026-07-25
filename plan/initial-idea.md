# Post-Discharge Recovery Companion — Final Hackathon Plan

_A voice-first companion that turns a hospital discharge letter into a day-by-day recovery plan, calls the patient in their own language to keep them on track, and quietly alerts family when something's wrong._

---

## The one-line pitch

> An Urdu-speaking grandmother, home after a hip op, gets a phone call every morning **in Urdu** that walks her through her recovery — and quietly tells her daughter if something's wrong.

**Positioning:** Patiently makes a discharge letter _understandable at a moment in time_. We deliver the _ongoing transitional-care follow-up over the 30-day window_. Different job.

---

## Why this is real (the grounding)

- **The comprehension gap is validated.** Only ~1 in 4 patients understand their discharge instructions; up to ~88% of written discharge plans are effectively unreadable by patients (jargon + reading level + language).
- **The danger window is the 30 days after discharge.** ~1 in 5 Medicare patients is readmitted within 30 days; ~27% of readmissions are potentially preventable. _(Note: the earlier "75% avoidable" figure was wrong — it referred to adverse events during transition, a different denominator. Use ~27%.)_
- **The fix already exists but is too expensive to scale.** "Transitional care" (Naylor / Coleman models) has cut readmissions by up to ~45% in RCTs — but it needs a nurse per patient. **The proven active ingredient is the structured post-discharge phone call.** We are automating the one part of proven care that a voice agent can genuinely replicate.
- **Elderly usability research backs our core design decision.** Older adults face four stacked barriers to health apps — cognition, physical ability, perception, motivation — all reinforced by illness. The answer is **not** a better tutorial; it's making the screen the _family's_ interface and giving the patient a channel with zero learning curve: **a phone call.**

---

## The guiding principle (this decides every feature)

**The app only ever reformats, schedules, and reads back the clinician's own words, and routes to humans. It never generates new clinical judgment.**

This is the regulatory shield. Reformatting the doctor's words is _not_ a medical device. Interpreting patient-entered data to recommend care _is_ (and sits in a category with almost no grey zone, where the bar is 100% emergency detection — unachievable at a hackathon). Everything we ship passes this test.

**The scope-creep test for any future idea:** _Does this feature generate new clinical judgment, or does it just move the doctor's existing words around / connect people?_ Move words or route to humans → ship it. Generate judgment → cut it.

---

## Architecture: the voice agent is the spine

For the patient, **ElevenLabs is not a feature — it's the entire product.** The web app is the _family's_ window into what the voice agent captured.

```
Discharge letter ──(OpenAI extraction)──► Structured plan JSON  (verbatim, source-traced)
                                                │
                                                ├──► Day-by-day timeline  (patient's language)
                                                │
                                                ├──► ElevenLabs voice agent  ◄── grounded via RAG on THIS patient's plan
                                                │       • calls in patient's language
                                                │       • reads today's steps aloud
                                                │       • logs answers via tool calls
                                                │       • matches symptoms → doctor's red-flags
                                                │       • triggers escalation
                                                │
                                                └──► Family dashboard + escalation  (local state)
                                                        • soft nudge → patient
                                                        • pattern of misses → alert next-of-kin (their language)
```

Two ElevenLabs capabilities that make it load-bearing (not decorative):

- **Tool calling** — the agent logs adherence, checks red-flags, and triggers family alerts _inside the conversation_. The call is both the input and the trigger for the whole system.
- **RAG / knowledge base** — the agent is grounded in _this patient's extracted plan_, not generic chat. (Source-attribution can be toggled on, enforcing "everything traces to the doctor's words" at the voice layer.)

---

## What we're shipping (final feature list)

### Tier 1 — The spine (build first; ~70% of effort must land here)

1. **Discharge letter → structured extraction.** Upload PDF/photo → LLM extracts meds (name, dose, timing, food, duration), wound/activity guidance, follow-ups, and **red-flag lines as their own list — all verbatim, each storing its source span.** _This is the biggest technical risk — de-risk it first._
2. **Day-by-day timeline.** Extracted items placed on their days (antibiotics end day 7, stitches day 10, painkiller taper across week 1). This _is_ the "living plan" — pure scheduling of the doctor's words.
3. **Plain-language + multilingual rendering** of every item.

### Tier 2 — The differentiator (this is what wins)

4. **ElevenLabs voice check-in call** — the digitised transitional-care follow-up, in the patient's language, grounded in their plan via RAG. Reads today's plan, asks check-in questions, logs spoken yes/no via tool calls. **Hero feature — the patient's entire interface. Prioritise over everything in Tier 3.**
5. **Tiered escalation to a family dashboard** — missed logs → gentle patient nudge; a _pattern_ of missed high-stakes meds → alert linked family member in _their_ language. The evidence says the effective ingredient is **human support**, so the escalation is the point; reminders are plumbing.

### Tier 3 — Narrative glue (happy-path only)

6. **Push notifications** — repositioned: (a) backup nudge for the patient _in-language_ if they miss the voice call, and (b) the caregiver's alert channel. Not the primary patient reminder — the _call_ is.

---

## The safe symptom-capture design (important — get this exact)

The instinct ("let the patient say how they feel") is right. The trap is only in _who decides_.

1. Voice agent **captures** how the patient feels (data capture — fine).
2. **Matches** it _only_ against the red-flag lines **the doctor wrote in the letter**. On a match, reads back the doctor's own instruction verbatim: _"Your letter says if your calf is swollen and painful, call your surgical team on 020-XXXX — shall I help you call?"_ (Reading the letter aloud, not diagnosing.)
3. Everything else → **log, trend, escalate to a human** if a pattern emerges. Never triage.
4. **Universal fallback always one tap:** "call your care team / call 111" — never gated behind the app's own judgment.

Agent persona: a plain, non-clinical, warm name (**not** "Claude" / not a generic-AI framing). It says early: _"I'm not a doctor — I help you follow the plan your doctors gave you."_ That line is itself a regulatory shield.

---

## Explicitly CUT (and why — shows rigour to judges)

- **AI symptom-checker / triage** ("I feel dizzy" → app decides "call 111"). Industry triage accuracy stuck ~56% for years, misses >40% of emergencies; squarely a medical device with a 100%-emergency-detection bar. _Salvaged as the match-to-doctor's-red-flags design above._
- **Computer-vision pill identification.** Accuracy volatile on real phone photos (~57–72% swings on clinical data); a wrong ID is a safety claim; catastrophic live-demo risk.
- **Label OCR "what's this for."** Doesn't run through the voice spine, doesn't serve the non-English patient, extra surface to babysit. Gone.
- **Open-web "ask anything about your condition" Q&A.** Re-opens the ungrounded-clinical-content door. Keep the agent scoped to the patient's own letter + the call-a-human fallback. Post-hackathon at best.
- **Discharge-conversation dictation** (record consult, doctor confirms). Good, but it's a _clinician documentation_ product with a different user — and Patiently already does it. Optional 20-second demo _opener_, not a built feature.

---

## Stack & build decisions

- **OpenAI** — discharge letter → structured plan JSON (Tier 1).
- **ElevenLabs** — the voice agent: calls, RAG on the patient's plan, tool-calling for logging/escalation (Tier 2, the core). _(~1.8M credits available — not resource-constrained. But each test call costs a little and setup/testing is half-rate, so script the demo call tightly rather than looping it hundreds of times.)_
- **Vercel** — hosting + serverless functions (extraction, scheduled calls).
- **Storage: local / mock first.** Skip standing up Supabase on day one. Data model is tiny (patient, plan JSON, daily logs, one caregiver) → JSON file / in-memory. Say so out loud in the pitch: _"we mocked the persistence layer to focus build time on the voice agent."_ **Supabase = stretch goal** only if time remains (for live family-dashboard updates). For the demo, fake real-time family alert with polling or a scripted step.
- **UI — already in the repo.** The phone shell, the design system and the ElevenLabs voice wiring are built and working (see the README). Retrofit onto them rather than rebuilding. Biggest time-saver available.

---

## Roles & timeboxing

- **Haider + teammate** — two coders. Split: one owns Tier 1 (extraction + timeline), one owns Tier 2 (voice agent + escalation). Reconvene every few hours.
- **Raf (medic)** — more than QA. Use him to (a) tell you exactly what's in a real NHS discharge bundle (summary, TTO/medication list, wound-care/physio sheets) so your **synthetic data is credible**, and (b) sanity-check that the mock letter + red-flag matching are **clinically plausible**. A medic catching "no surgeon writes it like that" before the judges do is worth more than another QA pass.

**Hold the scope line.** With <24h, the only remaining trap is making the voice agent do _more_ (general Q&A, web search, vague "proactive" behaviour). Every one is both a time sink and a safety risk. Narrow wins.

---

## Demo script (one patient, one arc)

**Margaret, 74. Home after a hip replacement. Four pages of NHS abbreviations. Daughter Priya lives two hours away, speaks Urdu.**

1. **Upload** the (synthetic) discharge letter live → the day-by-day timeline generates.
2. Show the timeline in **plain language** — and flip the language toggle.
3. **The hero moment — Day 7:** the app _calls_ Margaret, in Urdu, and walks her through today's meds. She's missed her clot-preventer twice → **Priya's phone lights up, in Urdu:** _"Mum's missed her clot-prevention medicine twice."_
4. **The safe proactive beat:** Margaret mentions calf pain → agent matches the doctor's red-flag line → reads back the surgeon's own instruction and offers to help her call.
5. Close on the vision (what we'd build with more time): GP side-effect reporting, medication-change support, "take actions on your behalf" — framed as roadmap, not tonight's scope.

That single arc contains the entire thesis: living plan + meds-in-the-day + multilingual voice follow-up + human escalation + highest-stakes clinical fact (clot risk), all firing at once.

---

## Next two artifacts to write (the buildable core)

1. **Extraction schema** — the JSON structure, with red-flags as their own list, everything verbatim + source-traced. Locks in the safe design for both the timeline and the symptom feature at once.
2. **Voice-agent system prompt + tool definitions** — scoped strictly to the patient's plan, with the match-don't-interpret rule and the "I'm not a doctor" persona baked in.
