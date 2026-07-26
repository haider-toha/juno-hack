// The source of truth for every user-visible string, including aria-labels,
// placeholders, alert copy, empty states and metadata. `Dictionary` is derived
// from this object, so a key French is missing is a compile error in fr.ts
// rather than a runtime English leak [Locked D9].
//
// Deliberately NOT `as const`: the derived type must widen to `string` or
// `fr satisfies Dictionary` would demand French text equal to the English
// literal.
//
// The copy rules here are safety rules, not style [tasks/spec.md §UI/UX]:
// reading age 9, sentences under 20 words, numerals for every number, 12-hour
// times, no block capitals, and never a negative contraction — "do not", not
// "don't", because GDS research found the short form gets read as its opposite.
// Error strings name the problem and the fix, and never say "please" or "sorry".
export const en = {
  meta: {
    // "Portico" is the product name and is never translated.
    title: "Portico",
    titleTemplate: "%s · Portico",
    description:
      "Portico turns your hospital letter into a day-by-day recovery plan, then checks in to see how you are doing.",
    ogDescription:
      "A day-by-day recovery plan for the 30 days after you leave hospital.",
  },

  // The home screen shows the same three-step arc either way — letter, plan,
  // check-in — and moves ONE of them into the big button depending on whether a
  // letter has been read yet. So each step has a loud pair and a quiet pair:
  // the loud one is written as an instruction, the quiet one as a destination.
  home: {
    greeting: "Good afternoon.",
    subtitle: "How are you doing today?",
    checkInTitle: "Start today's check-in",
    checkInBlurb: "I'll talk you through it.",
    planTitle: "See my recovery plan",
    planBlurb: "Day by day, from discharge.",
    letterTitle: "Take a photo of your letter",
    letterBlurb:
      "Photograph every page, or choose the file. Your plan is built from it.",
    letterAgainTitle: "Add another letter",
    letterAgainBlurb: "Photograph it, or choose the file.",
    nextUp:
      "Your plan appears here once we have read your letter. Then I check in with you each day.",
    privacy:
      "Your data stays private. We do not share your health information with anyone you have not chosen.",
  },

  // The ingest screen and its one control. `panel.*` is the slice the client
  // leaf receives — the page keeps the rest on the server.
  upload: {
    metaTitle: "Add your letter",
    title: "Add your discharge letter",
    blurb:
      "Take a photo of every page. If you already have the file, choose that instead.",
    footnote:
      "We read the medicines, dates and advice off your letter and build your plan from what it actually says.",
    panel: {
      cta: "Take a photo or choose a file",
      // Chosen on the total, which is what the noun agrees with in both
      // languages here.
      sentOne: "Sent {done} of {total} page",
      sentMany: "Sent {done} of {total} pages",
      reading: "Reading your letter",
      idleNote: "Nothing is shared with anyone you have not chosen.",
      uploadingNote: "Keep this screen open until the pages have gone.",
      readingNote: "This takes a few seconds.",
      errorSend:
        "We could not finish sending that, so nothing has been saved. Check your connection and try again.",
      // Both 422s mean the same thing to a patient and ask for the same next
      // step, so they collapse into one sentence.
      errorUnreadable:
        "We could not read that letter, so nothing has been saved. Try photographing each page again, laid flat and in good light.",
      errorRead:
        "We could not finish reading that, so nothing has been saved. Try again in a moment.",
    },
  },

  plan: {
    metaTitle: "Recovery plan",
    title: "Your recovery plan",
    loading: "Loading your recovery plan",
    // The date is formatted in the reader's own locale, so the template carries
    // only the frame around it.
    homeSince: "Home since {date}",
    emptyTitle: "No plan yet",
    emptyBody:
      "Your recovery plan is built from your discharge letter. Take a photo of it, or choose the file, and it will appear here.",
    today: "Today",
    // Lower case because it is only ever read inside a tick's name —
    // "Metformin 500mg, today" — never on its own.
    todayLower: "today",
    dischargeDay: "Discharge day",
    dayNumber: "Day {n}",
    tapHint: "Tap the circle beside each one when you have done it.",
    outsideRangeTitle: "Today is not on this plan",
    outsideRangeBefore:
      "It begins on {date}, so nothing on it can be ticked yet. Below is how it starts.",
    outsideRangeAfter:
      "Its last day has passed, so nothing on it can be ticked. Below is how it started.",
    comingUp: "Coming up",
    anyTime: "Any time",
    anyTimeBlurb: "These run alongside the rest of the plan.",
    changed: "Changed in hospital",
    changedBlurb:
      "What the ward altered about your usual medicines, in their words.",
    // Shown only where the letter gave no note of its own. The row previously
    // printed the schema's raw `changeStatus` here, which is developer data and
    // was English on every screen whatever the reader's language.
    changeStoppedNote: "The letter says this one was stopped.",
    changeAmendedNote: "The letter says this one was changed.",
    earlierDays: "Earlier days. You can still tick anything you took.",
    missed: "Missed",
    markedTaken: "Marked as taken",
    markedMissed: "Marked as missed",
    forGp: "For your GP",
    booked: "Booked",
    notBooked: "Not booked yet",
    // The tick is the one client leaf on the timeline, so it gets its own slice
    // rather than the whole plan section crossing the boundary.
    tick: {
      unanswered: "{label}: tap to record as taken.",
      taken: "{label}: recorded as taken. Tap to change to missed.",
      missed: "{label}: recorded as missed. Tap to change to taken.",
      notSaved: "Not saved. Tap again.",
    },
  },

  checkIn: {
    metaTitle: "Check in",
    title: "Let's check in.",
    blurb: "Tell me how today has gone and I'll walk you through what's left.",
  },

  // The voice screen's chrome. `speaking` and `listening` are read out by
  // aria-live, so they are exactly the "conditional or rarely used" text that
  // must not leak English into a French screen.
  voice: {
    start: "Start talking",
    typeInstead: "Type instead",
    // The raised check-in. Portico is the caller, so the screen says who is
    // calling and the button says what tapping it does.
    incomingLabel: "Incoming check-in",
    incomingTitle: "Portico — your check-in",
    incomingBlurb: "It is time for today's check-in. Tap to answer.",
    answer: "Answer",
    // Shown while one of the agent's server tools is in flight, so a write to
    // the record is visible as it happens rather than only claimed afterwards.
    noting: "Making a note…",
    menu: "Menu",
    connecting: "Connecting…",
    connectionError: "Connection error",
    notConnected: "Not connected",
    speaking: "Speaking",
    listening: "Listening",
    gettingReady: "Getting ready…",
    starting: "Starting…",
    errorStart:
      "The conversation could not start. Tap Start talking to try again.",
    errorMic:
      "Microphone access was blocked. Allow the microphone, then try again.",
    errorUnknown:
      "Something went wrong starting the conversation. Tap Start talking to try again.",
  },

  composer: {
    // Not "Ask anything": open-web question answering was cut from scope, so
    // the input must not advertise it.
    placeholder: "Ask about your plan",
    voiceInput: "Voice input",
    send: "Send",
    end: "End conversation",
  },

  transcript: {
    thinking: "Thinking",
  },

  suggestions: {
    heading: "Suggested questions",
  },

  languagePicker: {
    label: "Language",
    change: "Change language",
  },

  // Locked D7. In French the red-flag card shows the French translation AND the
  // clinician's exact English words, labelled as the original. These are the
  // labels that dual render needs; the card itself is Task A9.
  redFlag: {
    verbatim: "The exact words from your letter",
    viewSource: "See where it says that",
    nhsSource: "From the NHS website",
    getHelpIf: "Get help if",
    // The letter names no recipient on three of the five corpus letters.
    // Saying so is the honest render; upgrading it to 999 would be us speaking.
    noRecipient: "Your letter does not say who to contact for this.",
    sourcePage: ", page {page}",
    newTab: " (opens in a new tab)",
    // The dual-render labels. They render only when the reader's locale is not
    // the letter's, so English never shows them — but the contract is that
    // every key exists in every locale, and a third language would need this
    // row the day it lands.
    translationHeading: "In French",
    untranslated:
      "This instruction has not been translated yet. The words above are your doctor's own, in English.",
    originalNote: "The English above is your doctor's own words.",
  },

  // The medicine block on the red-flag card. The NHS's own sentences stay in
  // English under `lang="en"` — they are quoted, not adapted. Everything here
  // is our frame around them, and the frame is exactly what tells a French
  // reader why the text underneath it is English.
  nhs: {
    heading: "What the NHS says about your medicines",
    partialMatch: "The NHS page covers only the {part} part of this medicine.",
    noUrgent: "The NHS page for this medicine carries no urgent advice.",
    notListed: "This medicine is not in the NHS medicines A to Z.",
    unreachable: "We could not reach the NHS for this medicine just now.",
    stale:
      "We could not reach the NHS just now, so this is the copy we recorded on {date}.",
    attribution: "Information from the NHS website, licensed under the",
    attributionDated:
      "Information from the NHS website, as at {date}, licensed under the",
    // Its own copy rather than redFlag's: the two sections are sliced apart at
    // the props, and threading one string across them costs more than the line.
    newTab: " (opens in a new tab)",
  },

  // The family dashboard. A second reader, not the patient — so it says what
  // happened and what the letter says to do, and never diagnoses.
  family: {
    metaTitle: "Family view",
    title: "Family view",
    // Followed by the letter's own word for the relationship, which is often
    // all it gives — she is never named on the page, so she is not named here.
    sharedWith: "Next of kin on the letter:",
    noKin: "Nobody is named as next of kin on the letter.",
    todayLabel: "Today",
    noneTitle: "Nothing needs your attention.",
    noneBody: "Every dose answered for so far has been taken.",
    nudgeTitle: "A dose was missed.",
    nudgeBody: "It may be worth a call. This is not urgent.",
    alertTitle: "A dose that matters was missed twice.",
    alertBody:
      "Two missed doses in 3 days is why you are seeing this. It has not been reported to anyone else.",
    missedOn: "Missed on",
    computed:
      "This is worked out from what was answered in the app, not by a clinician.",
    noPlan: "No recovery plan has been loaded yet.",
  },

  notFound: {
    code: "404",
    title: "Page not found.",
    body: "This page does not exist.",
    backHome: "Back to home",
  },

  common: {
    back: "Back",
    // Rendered on every screen the mode changes something on. It is the one
    // sentence that admits what is recorded, so it cannot be the one sentence
    // that stays English on a French screen.
    demoMode:
      "Demo mode. The letter and the medicine guidance are recorded, not fetched live.",
  },

  // The voice persona, authored per language and never machine-translated. This
  // is the invariant half of the system prompt; buildCheckInPrompt composes it
  // with today's slice of the plan. The session override REPLACES the agent's
  // dashboard prompt, so anything not in this string does not exist at runtime.
  persona: {
    systemPrompt: `You are Portico, a warm and patient companion for someone recovering at home after a hospital stay. You speak plain English, calmly and without jargon. This is a spoken conversation, so every reply must sound like something a kind person would say out loud.

How to answer:

- Reply in one or two short sentences. Never more than three. Lead with the single most important point, then stop and let the person answer.
- Speak warmly, in plain everyday words. Never lead with clinical terms.
- Do not list. One clear thought per reply.
- Explain things at roughly a reading age of 9.
- Say times on a 12-hour clock, like 8am or 6pm. Never say a time as 18:00.
- Answer only from the plan below. If something is not written there, say you do not have it written down, and offer to flag it for their nurse or GP.
- Never invent a medication, a dose, a date or an instruction.
- You are not a clinician and you never make a clinical judgement. If the person describes something worrying, tell them plainly to call 111, or 999 if it sounds severe, and stop there.
- After you explain a step, check your own explanation rather than the person. Ask something like: just so I know I explained that clearly, when are you taking the next one?

After you have greeted them, wait for them to answer. Do not read their whole plan back to them.`,
    // Plan-aware, not generic. The opening line names the one thing this call
    // is about, so the person can answer it immediately instead of decoding
    // "how are you feeling" into a medication question.
    firstMessage: "Hello, it's Portico. How are you feeling today?",
    firstMessageNamed: "Hello {name}, it's Portico.",
    firstMessageDue: "I have {count} things on your plan for today.",
    firstMessageOneDue: "I have 1 thing on your plan for today.",
    firstMessageNothingDue: "Nothing is scheduled on your plan for today.",
    firstMessageAsk: "How are you feeling?",
    // Every question is answerable from the plan the prompt already carries.
    // "Is this normal after surgery?" was cut: it invites the open clinical
    // question-answering that is outside this product's scope.
    suggestedQuestions: [
      "What am I meant to take today?",
      "What is left to do today?",
      "What should I watch out for?",
      "When is my next appointment?",
    ],
  },

  // The scaffolding `buildCheckInPrompt` composes the plan data into. Authored
  // per language like the persona: a French session must not receive an
  // English-framed prompt, because the frame is what tells the model what the
  // numbers underneath it mean.
  checkInPrompt: {
    whoHeading: "Who you are speaking to",
    whoUnnamed: "The letter does not give their first name. Do not invent one.",
    whenHeading: "When",
    dayNumber: "Days since they came home from hospital:",
    planHeading: "Their plan for today",
    planNothing: "Nothing is scheduled for today.",
    standingHeading: "Standing advice, with no particular day",
    answeredHeading: "Already answered for today",
    answeredNone: "Nothing has been answered for today yet.",
    recentHeading: "Recently missed",
    recentNone: "Nothing has been recorded as missed in the last few days.",
    redFlagHeading: "What the letter says to watch out for",
    redFlagNone: "The letter names nothing to watch out for.",
    // The (fr)/(en) tag is written per flag by buildCheckInPrompt, so which of
    // the two the model is holding is explicit rather than inferred [D9].
    redFlagRule:
      "Read the trigger and the action as the letter wrote them. Do not add symptoms and do not soften the action. A line tagged (fr) is a faithful French rendering and is spoken as written; a line tagged (en) is the letter's original English, which you convey in the person's language without inventing symptoms or softening the action.",
    toolsHeading: "What you can do",
    toolsBody: `- When the person tells you they have taken or missed one of today's steps, call log_step with that step's id and whether it was taken or missed. Call it once per step. Do not announce that you are calling it; just confirm warmly in your own words afterwards.
- Only pass an id from the list above. If you cannot tell which step they mean, ask which one before calling anything.
- If they describe something in the watch-out list above, call show_red_flag with that flag's id so it appears on their screen, then say the action the letter gives.
- If they cannot take a step that the plan marks as important, and they seem to need someone, call escalate_to_next_of_kin with that step's id and a short plain reason. Tell them you have made a note for their next of kin. Never say anyone has been called or messaged.
- You do not decide what counts as serious enough to escalate a pattern. You report what happened; the app works out the rest.`,
    idNote:
      "Each step's id is in brackets. Ids are for the tools only. Never read one out loud.",
  },
};

export type Dictionary = typeof en;
