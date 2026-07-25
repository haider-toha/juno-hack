"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isRealLocale, LOCALE_COOKIE } from "@/lib/i18n/locales";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

// The only place the locale cookie is written. A server action is a network
// boundary, so the argument is re-checked here rather than trusted from the
// caller's type. An unknown locale throws instead of quietly settling on
// English — there is no dictionary to fall back to, and pretending otherwise is
// the failure Locked D9 exists to stop.
async function writeLocale(locale: string) {
  if (!isRealLocale(locale)) {
    throw new Error(
      `Portico has no dictionary for "${locale}". Showcase languages open the "not yet" panel; they never set the cookie.`,
    );
  }
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: "lax",
  });
  // The root layout reads the cookie for <html lang> and metadata, so the whole
  // tree has to re-render, not just the current page.
  revalidatePath("/", "layout");
}

// Picked from the language menu: switching reloads the same screen and keeps
// the reader where they were.
export async function setLocale(locale: string) {
  await writeLocale(locale);
}

// Picked from a showcase language's "not yet" panel. That screen is written in
// a language Portico cannot render, so staying on it is not an option — the
// choice has to land somewhere real.
export async function setLocaleAndReturnHome(locale: string) {
  await writeLocale(locale);
  redirect("/");
}
