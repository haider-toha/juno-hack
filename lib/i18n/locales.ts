// The locale universe, split by what actually works. Real locales have a full
// authored dictionary; showcase locales have an in-language "not yet" panel and
// nothing else. Keeping them in separate unions is what makes an English
// fallthrough unrepresentable rather than merely discouraged [Locked D4, D9]:
// getDictionary accepts only Locale, so a showcase locale can never reach it.
//
// Pure data, no next/headers — the language picker is a client leaf and imports
// this file. The server-side reads live in dictionary.ts.

export const REAL_LOCALES = ["en", "fr"] as const;
export const SHOWCASE_LOCALES = ["cy", "pl", "ro", "tr", "pt", "es"] as const;

export type Locale = (typeof REAL_LOCALES)[number];
export type ShowcaseLocale = (typeof SHOWCASE_LOCALES)[number];
export type PickerLocale = Locale | ShowcaseLocale;

export const LOCALE_COOKIE = "portico_locale";

// Endonyms: every language names itself in its own words, so this map is never
// translated. Flags are banned as a metaphor for language, so this text is the
// only identifier a row gets [04 §L1].
export const LOCALE_NAMES = {
  en: "English",
  fr: "Français",
  cy: "Cymraeg",
  pl: "Polski",
  ro: "Română",
  tr: "Türkçe",
  pt: "Português",
  es: "Español",
} satisfies Record<PickerLocale, string>;

// Picker order: the two that work lead. Ordering the one real second locale
// below six that do not would misrepresent what the product can do today.
export const PICKER_LOCALES = [
  ...REAL_LOCALES,
  ...SHOWCASE_LOCALES,
] satisfies readonly PickerLocale[];

export function isRealLocale(value: string | undefined): value is Locale {
  return REAL_LOCALES.some((locale): boolean => locale === value);
}

export function isShowcaseLocale(
  value: string | undefined,
): value is ShowcaseLocale {
  return SHOWCASE_LOCALES.some((locale): boolean => locale === value);
}
