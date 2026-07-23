import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans, Mukta } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mukta = Mukta({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hindi",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sudriv — AI Co-pilot for News Producers",
    template: "%s · Sudriv",
  },
  description:
    "Real-time voice-controlled running order management for live television news production.",
  keywords: [
    "news production",
    "running order",
    "voice AI",
    "teleprompter",
    "LiveKit",
    "PCR",
  ],
  applicationName: "Sudriv",
  authors: [{ name: "Sudriv" }],
  openGraph: {
    title: "Sudriv — AI Co-pilot for News Producers",
    description:
      "Voice-controlled timeline management for live TV news production.",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${outfit.variable} ${mukta.variable} font-sans antialiased selection:bg-primary/20 selection:text-primary`}>
        {/* TODO: Add global providers (theme, toast, etc.) */}
        {children}
      </body>
    </html>
  );
}
