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

  home: {
    greeting: "Good afternoon.",
    subtitle: "How are you doing today?",
    checkInTitle: "Start today's check-in",
    checkInBlurb: "I'll talk you through it.",
    planTitle: "See my recovery plan",
    planBlurb: "Day by day, from discharge.",
    privacy:
      "Your data stays private. We do not share your health information with anyone you have not chosen.",
  },

  plan: {
    metaTitle: "Recovery plan",
    title: "Your recovery plan",
    empty: "Nothing here yet. This is where your day-by-day plan will appear.",
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
    search: "Search languages",
    noMatch: "No languages match that search.",
  },

  // Locked D7. In French the red-flag card shows the French translation AND the
  // clinician's exact English words, labelled as the original. These are the
  // labels that dual render needs; the card itself is Task A9.
  redFlag: {
    verbatim: "The exact words from your letter",
    viewSource: "See where it says that",
    nhsSource: "From the NHS website",
  },

  notFound: {
    code: "404",
    title: "Page not found.",
    body: "This page does not exist.",
    backHome: "Back to home",
  },

  common: {
    back: "Back",
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
    firstMessage: "Hello, it's Portico. How are you feeling today?",
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
};

export type Dictionary = typeof en;
