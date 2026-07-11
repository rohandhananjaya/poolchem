import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// Inter drives all headings, UI labels, and body text — clean and highly
// legible on phones in bright outdoor light. Variable font, so every weight
// (400/500/600/700) ships from one file.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// JetBrains Mono is used ONLY for critical numeric data (pH, LSI, doses,
// scores) via `font-mono tabular-nums`, so digits align in columns.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PoolChem — Water chemistry, handled",
  description:
    "PoolChem turns a quick water test into a health score, the exact chemical doses to fix it, and a shareable report. Built for pool-service companies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
