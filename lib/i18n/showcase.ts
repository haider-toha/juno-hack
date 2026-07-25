import type { ShowcaseLocale } from "@/lib/i18n/locales";

// The six languages Portico can name but cannot yet speak. Picking one does NOT
// set the locale — it opens a panel written wholly in that language, so no
// screen ever shows two languages at once [Bilingual Technology Toolkit 5.1,
// Locked D9]. The way out is the two endonym buttons the panel renders, which
// is why there is no "close" string here: chrome in the current UI language
// sitting inside this panel would be the mixed-language state it exists to
// avoid.
//
// Welsh ŵ ŷ, Polish ł ą ę, Romanian ș ț ă and Turkish ğ ı İ all fall outside the
// `latin` font subset, so app/layout.tsx loads `latin-ext` as well — without it
// four of these six render mid-word fallback glyphs.
//
// Short, high-visibility copy: worth a native speaker's eye before the demo.
type ShowcaseNotice = {
  title: string;
  body: string;
};

export const SHOWCASE_NOTICES = {
  cy: {
    title: "Ddim ar gael eto",
    body: "Mae Portico ar gael yn Saesneg ac yn Ffrangeg heddiw. Dewiswch iaith i fynd yn eich blaen.",
  },
  pl: {
    title: "Jeszcze niedostępne",
    body: "Portico jest dziś dostępne po angielsku i po francusku. Wybierz język, aby kontynuować.",
  },
  ro: {
    title: "Încă indisponibil",
    body: "Portico este disponibil astăzi în engleză și în franceză. Alegeți o limbă pentru a continua.",
  },
  tr: {
    title: "Henüz kullanılamıyor",
    body: "Portico bugün İngilizce ve Fransızca olarak kullanılabiliyor. Devam etmek için bir dil seçin.",
  },
  pt: {
    title: "Ainda não disponível",
    body: "O Portico está hoje disponível em inglês e em francês. Escolha um idioma para continuar.",
  },
  es: {
    title: "Todavía no disponible",
    body: "Portico está hoy disponible en inglés y en francés. Elige un idioma para continuar.",
  },
} satisfies Record<ShowcaseLocale, ShowcaseNotice>;
