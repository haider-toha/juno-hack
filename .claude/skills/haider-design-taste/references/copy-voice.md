# Copy and voice

Contents: language · casing · tone · buttons and labels · page chrome · errors · empty states · confirmations · numbers and time.

## Language

- British English, always: colour, behaviour, organise, customise, licence (noun) / license (verb), grey.
- Exception: code, CSS properties, token names, and file identifiers keep US spellings (`color`, `center`, `gray`) to match the platform – prose is British, identifiers are not.
- En-dashes, not em-dashes: spaced en-dash for breaks in a sentence (`fast – almost instant`), closed en-dash for ranges (`4–8px`). Never the em-dash character (U+2014 —).
- No ampersands in prose or UI copy: "Terms and conditions", not "Terms & Conditions". Exception: proper nouns that spell themselves with one.

## Casing

Sentence case for everything – titles, buttons, menu items, tabs, table headers, tooltips.

| Wrong              | Right          |
| ------------------ | -------------- |
| Create New Project | Create project |
| Save Changes       | Save changes   |
| Team Members       | Team members   |

Product nouns keep their capitalisation: "Connect to GitHub", "Import from Linear". No uppercase anywhere unless explicitly requested (see `typography.md`).

## Tone

Quiet, precise, confident. The interface is a professional tool speaking to a professional.

- No exclamation marks. Ever.
- No emoji in UI chrome.
- No "Oops", "Uh oh", "Whoops", "Hmm".
- No filler: "successfully", "please note", "simply", "just".
- Say less: if a sentence works without a word, cut the word.

## Buttons and labels

- Verb-first, three words max: "Create project", "Invite", "Export CSV".
- The button says what it does – never "OK", "Yes", "Submit", "Continue" on destructive or consequential actions.
- Field labels are nouns ("Due date"), placeholders are examples or empty ("Search…"), never instructions doubling as labels.
- Busy buttons keep their label with a 16px inline spinner: "Creating…" not a bare spinner.

## Page chrome

- No page descriptions under titles unless the description is genuinely needed to explain what the page contains. "Settings" does not need "Manage your account settings and preferences" beneath it – the title and the content already say so.
- Same for section headers, cards, and dialogs: the description slot exists for the rare case where the content is not self-explanatory, not as a template field to fill.
- If a page does need orientation, one short sentence in `--muted-foreground` at 13px – never a paragraph.

## Errors

What happened + what to do. Both, always. Inline at the point of failure.

| Wrong                | Right                                                              |
| -------------------- | ------------------------------------------------------------------ |
| Something went wrong | Couldn't save changes – check your connection and retry            |
| Error 403            | You don't have access to this project – ask an admin to invite you |
| Invalid input        | Name must be under 60 characters                                   |
| Failed to load       | Couldn't load issues – retry                                       |

- Name the object ("Couldn't save _the webhook_"), not "the item".
- Offer the fix as the action: an inline "Retry" beats an instruction to retry.
- Never blame the user; state the constraint.

## Empty states

State what belongs here + the single action that creates it.

| Surface                   | Copy                                          |
| ------------------------- | --------------------------------------------- |
| Issues list, first run    | No issues yet – Create issue                  |
| Filtered list, no matches | No issues match these filters – Clear filters |
| Search, no results        | No results for "billing"                      |
| Activity feed             | Activity from your team shows up here         |

One sentence, `--muted-foreground`, one action. No "It's quiet in here!", no illustrations.

## Confirmations and destructive actions

- Destructive confirms name the object and the consequence: "Delete 'API redesign'? Its 14 issues will be removed."
- The confirming button repeats the verb: "Delete project", never "Yes"/"OK".
- Prefer undo over confirmation for reversible actions – a quiet toast "Issue deleted – Undo" beats a modal.
- Only irreversible, high-blast-radius actions earn type-to-confirm.

## Numbers and time

- Tabular numerals everywhere data lives (`typography.md`).
- Relative time under 7 days ("2h ago", "yesterday"), absolute beyond ("Jun 12"), full timestamp on hover.
- Abbreviate at scale: 1.2k, 3.4M – with the exact value on hover.
- Units in `--muted-foreground`: 128 ms, 42%.
