import { cookies, headers } from "next/headers";

import { en, type Dictionary } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";
import { isRealLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/locales";

// Reads next/headers, so this module is server-only by construction. The picker
// is a client leaf and imports lib/i18n/locales.ts instead.

// The stored choice wins. Accept-Language is consulted only when there is no
// cookie, and only to pick between the two locales that are fully authored —
// never to invent a half-translated screen. A browser asking for Welsh gets
// English here and reaches Cymraeg through the picker's "not yet" panel, which
// is honest; a partial Welsh UI would not be.
export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isRealLocale(stored)) return stored;
  const accepted = (await headers()).get("accept-language") ?? "";
  return /(^|,)\s*fr\b/i.test(accepted) ? "fr" : "en";
}

// Accepts only Locale. A showcase locale has no dictionary and cannot be given
// one, which is what stops `05:628`'s "return en for the showcase locales" from
// being reachable at all [C10, Locked D9].
export function getDictionary(locale: Locale): Dictionary {
  return locale === "fr" ? fr : en;
}
