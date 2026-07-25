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
    default: "Juno",
    template: "%s · Juno",
  },
  description:
    "Juno turns a hospital discharge letter into a living, day-by-day recovery plan — and calls to check you're on track.",
  applicationName: "Juno",
  openGraph: {
    title: "Juno",
    description:
      "A living day-by-day recovery plan for the thirty days after you leave hospital.",
    siteName: "Juno",
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
