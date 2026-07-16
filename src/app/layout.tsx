import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";

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
  metadataBase: new URL("https://poolbench.com"),
  title: "Poolbench — Water chemistry, handled",
  description:
    "Poolbench turns a quick water test into a health score, the exact chemical doses to fix it, and a shareable report. Built for pool-service companies.",
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Script
          id="strip-extension-attrs"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `new MutationObserver((m,s)=>{for(const r of m)for(const n of r.addedNodes)if(n.nodeType===1){const e=n;e.hasAttribute?.("bis_skin_checked")&&e.removeAttribute("bis_skin_checked");e.querySelectorAll?.("[bis_skin_checked]").forEach(t=>t.removeAttribute("bis_skin_checked"))}}).observe(document.documentElement,{childList:!0,subtree:!0})`,
          }}
        />
        {children}
        <Toaster />
        <CookieConsentBanner />
      </body>
    </html>
  );
}
