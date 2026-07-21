import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Sudriv — AI Co-pilot for News Producers",
  description:
    "Real-time voice-controlled timeline management for live television news production.",
  keywords: ["news", "producer", "AI", "voice", "timeline", "teleprompter"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${outfit.variable} font-sans antialiased selection:bg-primary/20 selection:text-primary`}>
        {/* TODO: Add global providers (theme, toast, etc.) */}
        {children}
      </body>
    </html>
  );
}
