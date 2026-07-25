# Brief for Raf — discharge bundle generation

Paste-able. Everything here came out of research done after our call, and each
item changes something about how you should generate the bundle. Sorry for the
length — the first four are the ones that actually matter.

---

## 1. Write the LETTERS first. Derive the JSON from them afterwards.

If you generate the JSON first and then write letters to match it, the letters
come out too clean and too regular — and the whole point of the demo is that our
pipeline copes with real messiness. Letters first, JSON second, derived from what
you actually wrote.

## 2. Your JSON is a test fixture, not the thing we ingest.

To be clear on how we'll use it: we ingest the **letters** (photos / PDFs). Your
JSON is what we check our extraction *against* — the answer key. If we ingested
your JSON directly we'd be skipping the entire extraction step, which is the
hardest and most impressive part of the build. So the JSON doesn't need to be
pretty; it needs to be *correct for the letters you wrote*.

## 3. The clot-preventer must be apixaban or rivaroxaban.

Not enoxaparin, not dalteparin. Reason: our red-flag lookup pulls from the NHS.uk
medicines A-Z, and the injectable LMWHs simply aren't on it — they 404. So on the
single most important drug in the demo we'd get nothing back.

Apixaban is clinically right for this anyway (its PIL covers preventing clots
after hip/knee replacement), so this isn't us bending medicine to fit the tech.

**The BNF is out, by the way** — sorry, you were right that it's the ideal source,
but `bnf.nice.org.uk` returns a hard 403 outside its licence, BNF content is
excluded from NICE's open licence, and scraping is explicitly forbidden and
IP-blocked. NHS.uk is the workable substitute and it's actually better suited to
us: it's written for patients, and every page has an explicit "Call NHS 111 if:"
block. Which is precisely the thing you described — advise, don't act.

## 4. Discharge letters don't list side effects. Confirm?

Our research says there's no side-effect field anywhere in the national discharge
standard's medication section, and no real letter we found lists them. That kills
one of our planned demo moments ("she reports a side effect her letter warned
about").

Two options, your call:

- **(a)** We drop it and route that moment through the red-flag path instead
  (safer, better evidenced, and it's the design you pushed us toward anyway).
- **(b)** You deliberately author a side-effect line into the letter — but only
  if a real clinician plausibly would. Don't add it just to help us.

**Is (a) right? Do letters ever mention side effects in practice?**

---

## 5. Smaller things

**Scenario.** You said you'd pick something linear — "when you hear hooves, think
horse not zebras" — and pushed back on hip replacement. Totally agreed, and we've
built the schema so it doesn't assume surgery (it handles surgical / medical /
other). Just tell us what you land on. **Also: you said something that transcribed
as "HRC" — we couldn't work out what that was. What did you mean?**

**"High-stakes" medications.** Our escalation logic needs to know which drugs are
serious enough that missing them twice should alert the next of kin. No letter
ever says this, so it can't be extracted — it has to be a list we configure.
Two-minute job for you: for whatever scenario you pick, which drugs are the
"if they miss this, actually worry" ones?

**Relative dates are fine — good, even.** Real advice sheets say "14 days after
your operation", "around 6 weeks". Write it exactly how a real letter would. We
resolve offsets to real dates in code. One thing though: if you write
"approximately 6 weeks", we will *not* render a specific date, because that would
invent precision you didn't write.

**Red flags come in pairs, and contacts vary.** For each red flag we need both the
symptom *and* the action, verbatim. And if different times of day route to
different numbers (one trust we looked at had three numbers for one symptom list,
split by hours), write it that way — we handle it, and it makes the letter more
realistic.

**Messy is good.** Different sections in different formats, some meds in a table
and some in prose, a section missing, handwriting or a wonky photo angle. All of
that makes the extraction demo more convincing, not less. Don't sand it smooth.
