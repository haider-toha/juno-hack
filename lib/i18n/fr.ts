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
    // Quiet-row subtitle when check-in is demoted (e.g. adding another letter).
    checkInBlurb: "Un court échange vocal sur votre journée.",
    planTitle: "Voir mon plan de rétablissement",
    planBlurb: "Jour par jour, depuis votre sortie.",
    familyTitle: "Espace proche",
    familyBlurb: "Ce que votre proche peut voir.",
    letterTitle: "Prenez une photo ou ajoutez un PDF",
    letterHint:
      "Votre lettre de sortie d'hôpital. Photographiez chaque page, ou ajoutez le PDF.",
    letterAgainTitle: "Ajouter une autre lettre",
    letterAgainBlurb: "Photographiez-la, ou ajoutez le PDF.",
    privacy:
      "Vos données restent privées. Nous ne partageons vos informations de santé avec personne sans votre accord.",
  },

  upload: {
    panel: {
      cta: "Prenez une photo ou ajoutez un PDF",
      // "Page envoyée : 0 sur 1" / "Pages envoyées : 2 sur 5". Framed as a
      // label so the participle agrees with the total, never with the running
      // count — "0 pages envoyées" is the wart this phrasing avoids.
      sentOne: "Page envoyée : {done} sur {total}",
      sentMany: "Pages envoyées : {done} sur {total}",
      reading: "Lecture de votre lettre",
      building: "Construction de votre plan",
      idleNote: "Rien n'est partagé avec personne sans votre accord.",
      uploadingNote:
        "Gardez cet écran ouvert jusqu'à ce que les pages soient envoyées.",
      readingNote:
        "Médicaments, dates et conseils — cela prend quelques secondes.",
      buildingNote: "Presque fini. Votre plan jour par jour arrive.",
      errorSend:
        "Nous n'avons pas pu terminer l'envoi, donc rien n'a été enregistré. Vérifiez votre connexion et réessayez.",
      errorUnreadable:
        "Nous n'avons pas pu lire cette lettre, donc rien n'a été enregistré. Photographiez chaque page à nouveau, bien à plat et avec un bon éclairage.",
      errorRead:
        "Nous n'avons pas pu terminer la lecture, donc rien n'a été enregistré. Réessayez dans un instant.",
    },
  },

  plan: {
    metaTitle: "Plan de rétablissement",
    title: "Votre plan de rétablissement",
    loading: "Chargement de votre plan de rétablissement",
    homeSince: "De retour chez vous depuis le {date}",
    emptyTitle: "Pas encore de plan",
    emptyBody:
      "Votre plan de rétablissement est construit à partir de votre lettre de sortie. Photographiez-la, ou ajoutez le PDF, et il apparaîtra ici.",
    today: "Aujourd'hui",
    todayLower: "aujourd'hui",
    dischargeDay: "Jour de la sortie",
    dayNumber: "Jour {n}",
    tapHint: "Touchez le cercle quand vous l'avez fait.",
    outsideRangeTitle: "Aujourd'hui ne fait pas partie de ce plan",
    outsideRangeBefore:
      "Il commence le {date} : rien ne peut encore être coché. Voici comment il débute.",
    outsideRangeAfter:
      "Son dernier jour est passé : plus rien ne peut être coché. Voici comment il avait commencé.",
    moreOnPlan: "Plus sur votre plan",
    comingUp: "Suivis",
    anyTime: "Si besoin",
    anyTimeBlurb: "Quand vous en avez besoin — sans jour précis.",
    changed: "Modifié à l'hôpital",
    changedBlurb:
      "Ce que le service hospitalier a changé à vos médicaments habituels, dans ses propres mots.",
    changeStoppedNote: "La lettre indique que ce médicament a été arrêté.",
    changeAmendedNote: "La lettre indique que ce médicament a été modifié.",
    earlierDays:
      "Jours passés. Vous pouvez encore cocher ce que vous avez pris.",
    // Masculine singular, with no noun to agree with: the chip sits beside
    // medicines and instructions alike, so "dose manquée" cannot be assumed.
    missed: "Manqué",
    markedTaken: "Marqué comme pris",
    markedMissed: "Marqué comme manqué",
    // "GP" has no British equivalent in French; "médecin traitant" is the
    // registered family doctor, which is the role the letter means.
    forGp: "Pour votre médecin traitant",
    booked: "Rendez-vous pris",
    notBooked: "Pas encore fixé",
    tick: {
      unanswered: "{label} : touchez pour indiquer que c'est pris.",
      taken: "{label} : enregistré comme pris. Touchez pour indiquer manqué.",
      missed: "{label} : enregistré comme manqué. Touchez pour indiquer pris.",
      notSaved: "Non enregistré. Touchez à nouveau.",
    },
  },

  checkIn: {
    metaTitle: "Point du jour",
    title: "Faisons le point.",
    blurb:
      "Racontez-moi votre journée et je vous rappelle ce qu'il reste à faire.",
  },

  checkInSummary: {
    metaTitle: "Notes du point du jour",
    title: "Point du jour",
    blurb: "Voici ce qui a été noté pendant cette conversation.",
    empty: "Rien n'a été noté cette fois.",
    taken: "Pris",
    missed: "Manqué",
    unanswered: "Pas abordé",
    scheduled: "Rappel à {time}",
    markedTaken: "Noté comme pris",
    markedMissed: "Noté comme manqué",
    markedScheduled: "Rappel prévu",
    nudgeBlurb: "Un rappel est prévu à {time} — {name}.",
    seePlan: "Voir mon plan",
    done: "Terminer",
  },

  voice: {
    start: "Commencer à parler",
    typeInstead: "Écrire plutôt",
    incomingLabel: "Appel de suivi",
    incomingTitle: "Portico — votre point du jour",
    incomingBlurb:
      "C'est l'heure de votre point du jour. Touchez pour répondre.",
    pushApp: "Portico",
    pushNow: "maintenant",
    pushTitle: "C'est l'heure de votre point du jour",
    pushBody: "Touchez pour parler avec Portico de votre plan du jour.",
    dosePushTitle: "C'est l'heure — {name}",
    dosePushBody: "Touchez pour le noter sur votre plan.",
    answer: "Répondre",
    noting: "J'en prends note…",
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
  },

  letter: {
    metaTitle: "Votre lettre",
    title: "Votre lettre",
    blurb: "La phrase dont cela vient.",
    blurbPage: "La phrase dont cela vient, page {page}.",
    loading: "Ouverture de votre lettre…",
    failed:
      "Nous n'avons pas pu ouvrir cette lettre. Revenez en arrière et réessayez.",
    missing: "Nous n'avons pas trouvé cet endroit dans votre lettre.",
    notFound:
      "Nous avons ouvert la page, mais n'avons pas pu marquer la phrase exacte. Cherchez les mots de votre plan sur cette page.",
    pageLabel: "Page {page} de votre lettre de sortie",
  },

  redFlag: {
    verbatim: "Les mots exacts de votre lettre",
    viewSource: "Voir où cela est écrit",
    nhsSource: "Source : le site du NHS",
    getHelpIf: "Demandez de l'aide si",
    noRecipient: "Votre lettre ne précise pas qui contacter dans ce cas.",
    sourcePage: ", page {page}",
    newTab: " (s'ouvre dans un nouvel onglet)",
    translationHeading: "En français",
    untranslated:
      "Cette consigne n'a pas encore été traduite. Les mots ci-dessus sont ceux de votre médecin, en anglais.",
    originalNote: "Le texte en anglais ci-dessus est celui de votre médecin.",
  },

  nhs: {
    heading: "Ce que le NHS dit de vos médicaments",
    partialMatch:
      "La page du NHS ne décrit que la partie « {part} » de ce médicament.",
    noUrgent:
      "La page du NHS pour ce médicament ne donne aucune consigne d'urgence.",
    notListed:
      "Ce médicament ne figure pas dans l'index des médicaments du NHS.",
    unreachable:
      "Nous n'avons pas pu joindre le NHS pour ce médicament à l'instant.",
    stale:
      "Nous n'avons pas pu joindre le NHS à l'instant. Voici la copie enregistrée le {date}.",
    // The licence's own name is a legal proper noun and stays in English in the
    // component, so both sentences stop just before it.
    attribution:
      "Informations provenant du site du NHS, publiées sous la licence",
    attributionDated:
      "Informations provenant du site du NHS, à la date du {date}, publiées sous la licence",
    newTab: " (s'ouvre dans un nouvel onglet)",
  },

  family: {
    metaTitle: "Vue famille",
    title: "Vue famille",
    sharedWith: "Proche indiqué sur la lettre :",
    noKin: "La lettre ne nomme aucun proche à prévenir.",
    todayLabel: "Aujourd'hui",
    noneTitle: "Rien ne demande votre attention.",
    noneBody: "Toutes les doses auxquelles il a répondu ont été prises.",
    nudgeTitle: "Une dose a été manquée.",
    nudgeBody: "Un appel serait peut-être utile. Ce n'est pas urgent.",
    alertTitle: "Une dose importante a été manquée deux fois.",
    alertBody:
      "Deux doses manquées en 3 jours : voilà pourquoi ce message s'affiche. Personne d'autre n'en a été informé.",
    computed:
      "Ceci est calculé à partir des réponses données dans l'application, pas par un soignant.",
    noPlan: "Aucun plan de rétablissement n'a encore été chargé.",
    pushApp: "Portico",
    pushNow: "maintenant",
    pushTitle: "Une note sur les médicaments du jour",
    pushBody: "Ouvrez pour voir ce qui a été manqué.",
  },

  notFound: {
    code: "404",
    title: "Page introuvable.",
    body: "Cette page n'existe pas.",
    backHome: "Retour à l'accueil",
  },

  common: {
    back: "Retour",
    dismiss: "Fermer",
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
- Après avoir expliqué une étape, posez une question courte et directe sur cette étape précise. Nommez le médicament ou la tâche, et demandez un fait clair — en général l'heure. Bien : « À quelle heure prenez-vous votre prochain metformine ? » Mal : demander si vous avez bien expliqué, ou « que devez-vous dire ». La personne doit savoir exactement quoi répondre.

Après votre salutation, attendez sa réponse. Ne relisez pas tout son plan.`,
    firstMessage:
      "Bonjour, c'est Portico. Comment vous sentez-vous aujourd'hui ?",
    firstMessageNamed: "Bonjour {name}, c'est Portico.",
    firstMessageDue: "J'ai {count} choses à votre plan pour aujourd'hui.",
    firstMessageOneDue: "J'ai 1 chose à votre plan pour aujourd'hui.",
    firstMessageNothingDue: "Rien n'est prévu à votre plan aujourd'hui.",
    firstMessageAsk: "Comment vous sentez-vous ?",
    suggestedQuestions: [
      "Que dois-je prendre aujourd'hui ?",
      "Que me reste-t-il à faire aujourd'hui ?",
      "À quoi dois-je faire attention ?",
      "Quand est mon prochain rendez-vous ?",
    ],
  },

  checkInPrompt: {
    whoHeading: "À qui vous parlez",
    whoUnnamed: "La lettre ne donne pas son prénom. N'en inventez pas un.",
    whenHeading: "Quand",
    dayNumber: "Jours écoulés depuis son retour de l'hôpital :",
    planHeading: "Son plan pour aujourd'hui",
    planNothing: "Rien n'est prévu aujourd'hui.",
    standingHeading: "Conseils permanents, sans jour précis",
    answeredHeading: "Déjà répondu pour aujourd'hui",
    answeredNone: "Rien n'a encore été répondu pour aujourd'hui.",
    recentHeading: "Manqué récemment",
    recentNone: "Rien n'a été noté comme manqué ces derniers jours.",
    redFlagHeading: "Ce que la lettre dit de surveiller",
    redFlagNone: "La lettre ne nomme rien à surveiller.",
    redFlagRule:
      "Lisez le signe et la consigne tels que la lettre les a écrits. N'ajoutez pas de symptômes et n'adoucissez pas la consigne. Une ligne marquée (fr) est une traduction fidèle : dites-la telle quelle ; une ligne marquée (en) est l'anglais d'origine de la lettre, que vous rendez dans la langue de la personne, sans inventer de symptôme ni adoucir la consigne.",
    toolsHeading: "Ce que vous pouvez faire",
    toolsBody: `- Quand la personne vous dit qu'elle a pris ou manqué une des étapes du jour, appelez log_step avec l'identifiant de cette étape et le résultat, pris ou manqué. Une seule fois par étape. N'annoncez pas l'appel de l'outil ; confirmez ensuite avec vos propres mots, chaleureusement.
- N'utilisez qu'un identifiant de la liste ci-dessus. Si vous ne savez pas de quelle étape il s'agit, demandez laquelle avant d'appeler quoi que ce soit.
- Si elle prendra plus tard aujourd'hui un médicament encore dû et donne une heure, appelez schedule_reminder avec l'identifiant de cette étape et l'heure en format 24 h HH:mm (par exemple 22:00 pour dix heures du soir). Confirmez que vous lui enverrez un rappel à cette heure. Ne le marquez ni pris ni manqué.
- Si elle décrit une chose de la liste à surveiller, appelez show_red_flag avec l'identifiant de ce signe pour qu'il s'affiche à l'écran, puis dites la consigne que donne la lettre.
- Si elle ne peut pas faire une étape que le plan signale comme importante, et qu'elle semble avoir besoin de quelqu'un, appelez escalate_to_next_of_kin avec l'identifiant de cette étape et une raison courte et simple. Dites-lui que vous avez laissé une note pour son proche. Ne dites jamais que quelqu'un a été appelé ou contacté.
- Ce n'est pas à vous de décider si une série d'oublis est grave. Vous rapportez ce qui s'est passé ; l'application fait le reste.
- Quand le point du jour est terminé, dites un court au revoir chaleureux, puis appelez end_check_in. Ne posez plus de questions après l'au revoir. Si end_check_in n'est pas disponible, appelez end_call à la place.`,
    idNote:
      "L'identifiant de chaque étape est entre crochets. Les identifiants servent uniquement aux outils. Ne les dites jamais à voix haute.",
  },
} satisfies Dictionary;
