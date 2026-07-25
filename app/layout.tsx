import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

// Editorial serif accent, held for pull-quotes and asides — no screen uses it
// yet. Italic 400 is the one weight/axis the design system allows.
const serif = Newsreader({
  subsets: ["latin"],
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

export const metadata: Metadata = {
  title: {
    default: "Portico",
    template: "%s · Portico",
  },
  description:
    "Portico turns a hospital discharge letter into a living, day-by-day recovery plan — and checks in to see you're on track.",
  applicationName: "Portico",
  openGraph: {
    title: "Portico",
    description:
      "A living day-by-day recovery plan for the thirty days after you leave hospital.",
    siteName: "Portico",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
