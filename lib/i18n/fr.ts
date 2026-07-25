import type { Dictionary } from "@/lib/i18n/en";

// Authored French, not machine translation [Locked D7, tasks/spec.md §Never].
// `satisfies Dictionary` is the guard: a key missing here fails `pnpm
// typecheck`, so French can never silently fall through to English [Locked D9].
//
// Same copy rules as en.ts, with sentences kept under 25 words to absorb
// French's expansion. Clinical proper nouns and service numbers (Portico, NHS,
// 111, 999, drug names) are never translated.
export const fr = {
  meta: {
    title: "Portico",
    titleTemplate: "%s · Portico",
    description:
      "Portico transforme votre lettre de sortie d'hôpital en un plan de rétablissement jour par jour, puis prend de vos nouvelles.",
    ogDescription:
      "Un plan de rétablissement jour par jour pour les 30 jours qui suivent votre sortie de l'hôpital.",
  },

  home: {
    greeting: "Bon après-midi.",
    subtitle: "Comment allez-vous aujourd'hui ?",
    checkInTitle: "Faire le point du jour",
    checkInBlurb: "Je vous guide pas à pas.",
    planTitle: "Voir mon plan de rétablissement",
    planBlurb: "Jour par jour, depuis votre sortie.",
    privacy:
      "Vos données restent privées. Nous ne partageons vos informations de santé avec personne sans votre accord.",
  },

  plan: {
    metaTitle: "Plan de rétablissement",
    title: "Votre plan de rétablissement",
    empty:
      "Rien ici pour l'instant. Votre plan jour par jour apparaîtra à cet endroit.",
  },

  checkIn: {
    metaTitle: "Point du jour",
    title: "Faisons le point.",
    blurb:
      "Racontez-moi votre journée et je vous rappelle ce qu'il reste à faire.",
  },

  voice: {
    start: "Commencer à parler",
    typeInstead: "Écrire plutôt",
    menu: "Menu",
    connecting: "Connexion…",
    connectionError: "Erreur de connexion",
    notConnected: "Non connecté",
    speaking: "Portico parle",
    listening: "Portico écoute",
    gettingReady: "Préparation…",
    starting: "Démarrage…",
    errorStart:
      "La conversation n'a pas pu démarrer. Touchez Commencer à parler pour réessayer.",
    errorMic:
      "L'accès au microphone a été bloqué. Autorisez le microphone, puis réessayez.",
    errorUnknown:
      "Un problème est survenu au démarrage. Touchez Commencer à parler pour réessayer.",
  },

  composer: {
    placeholder: "Posez une question sur votre plan",
    voiceInput: "Entrée vocale",
    send: "Envoyer",
    end: "Terminer la conversation",
  },

  transcript: {
    thinking: "Réflexion",
  },

  suggestions: {
    heading: "Questions suggérées",
  },

  languagePicker: {
    label: "Langue",
    change: "Changer de langue",
    search: "Rechercher une langue",
    noMatch: "Aucune langue ne correspond à cette recherche.",
  },

  redFlag: {
    verbatim: "Les mots exacts de votre lettre",
    viewSource: "Voir où cela est écrit",
    nhsSource: "Source : le site du NHS",
  },

  notFound: {
    code: "404",
    title: "Page introuvable.",
    body: "Cette page n'existe pas.",
    backHome: "Retour à l'accueil",
  },

  common: {
    back: "Retour",
  },

  persona: {
    systemPrompt: `Vous êtes Portico, un compagnon chaleureux et patient pour une personne qui se rétablit chez elle après un séjour à l'hôpital. Vous parlez un français simple, avec calme et sans jargon. C'est une conversation parlée : chaque réponse doit sonner comme les mots d'une personne bienveillante.

Comment répondre :

- Répondez en une ou deux phrases courtes. Jamais plus de trois. Dites d'abord le point le plus important, puis laissez la personne répondre.
- Parlez avec chaleur, avec des mots de tous les jours. Ne commencez jamais par un terme médical.
- Ne faites pas de liste. Une seule idée claire par réponse.
- Expliquez les choses comme à une personne de 9 ans.
- Donnez les heures en clair, comme 8h du matin ou 6h du soir. Ne dites jamais une heure sous la forme 18:00.
- Répondez uniquement à partir du plan ci-dessous. Si une chose n'y figure pas, dites que vous ne l'avez pas notée, et proposez de la signaler à son infirmier ou à son médecin.
- N'inventez jamais un médicament, une dose, une date ou une consigne.
- Vous n'êtes pas soignant et vous ne portez jamais de jugement médical. Si la personne décrit quelque chose d'inquiétant, dites-lui simplement d'appeler le 111, ou le 999 si cela semble grave, puis arrêtez-vous là.
- Après avoir expliqué une étape, vérifiez votre propre explication, et non la personne. Demandez par exemple : pour être sûr d'avoir été clair, à quelle heure prenez-vous la prochaine ?

Après votre salutation, attendez sa réponse. Ne relisez pas tout son plan.`,
    firstMessage:
      "Bonjour, c'est Portico. Comment vous sentez-vous aujourd'hui ?",
    suggestedQuestions: [
      "Que dois-je prendre aujourd'hui ?",
      "Que me reste-t-il à faire aujourd'hui ?",
      "À quoi dois-je faire attention ?",
      "Quand est mon prochain rendez-vous ?",
    ],
  },
} satisfies Dictionary;
