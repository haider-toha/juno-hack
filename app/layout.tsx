import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

import { getDictionary, getLocale } from "@/lib/i18n/dictionary";

// `latin-ext` is required, not optional. French lives inside `latin`, but the
// language picker's in-language "not yet" panels do not: Welsh ŵ ŷ, Polish
// ł ą ę ż ź ć ń ś, Romanian ș ț ă and Turkish ğ ı ş İ all fall outside the
// `latin` unicode-range. Without it, four of the six showcase panels render
// mid-word fallback glyphs — on the one screen whose whole job is "we take your
// language seriously".
const sans = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

// Editorial serif accent, held for pull-quotes and asides — no screen uses it
// yet. Italic 400 is the one weight/axis the design system allows.
const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-newsreader",
  display: "swap",
});

// themeColor is a browser <meta> value, not a component style — raw hex permitted here only.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return {
    title: {
      default: t.meta.title,
      template: t.meta.titleTemplate,
    },
    description: t.meta.description,
    applicationName: t.meta.title,
    openGraph: {
      title: t.meta.title,
      description: t.meta.ogDescription,
      siteName: t.meta.title,
      type: "website",
    },
  };
}

// Async so `lang` carries the chosen locale instead of asserting English to
// every reader and every screen reader (WCAG 3.1.1). Reading the cookie here
// makes the tree dynamic, which is correct for a per-visitor language.
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
