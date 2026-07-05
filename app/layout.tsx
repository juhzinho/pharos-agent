import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = "https://pharos-agent-pi.vercel.app";
const TITLE = "Pharos Agent — AI DeFi Copilot";
const DESCRIPTION =
  "Swap, bridge, add liquidity and track RealFi positions on Pharos Network via natural language. Non-custodial AI copilot.";

export const metadata: Metadata = {
  // metadataBase makes the og:image URL absolute — required for Discord/Twitter/WhatsApp link previews
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Pharos Agent",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Pharos Agent — AI DeFi Copilot on Pharos Network" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#050a1a]">{children}</body>
    </html>
  );
}
