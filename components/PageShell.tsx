"use client";

// Shared layout shell for section pages (/ecosystem, /trade, /campaigns, …).

import Navbar from "@/components/Navbar";
import SiteBackground from "@/components/SiteBackground";
import type { ReactNode } from "react";

interface PageShellProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  accent?: string;
  children: ReactNode;
  wide?: boolean;
}

export default function PageShell({ eyebrow, title, subtitle, accent = "#0066ff", children, wide }: PageShellProps) {
  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <SiteBackground variant="subtle" />

      <div className="relative z-10">
        <Navbar />

        <main className={`mx-auto px-5 pt-12 pb-24 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
          <div className="mb-10" style={{ animation: "heroFadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both" }}>
            <p className="section-eyebrow mb-3" style={{ color: `${accent}75` }}>
              {eyebrow}
            </p>
            <h1 className="font-display font-extrabold tracking-[-0.035em] leading-tight mb-3 text-gradient-hero"
              style={{ fontSize: "clamp(1.9rem, 4.2vw, 3rem)" }}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>

          <div style={{ animation: "heroFadeUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s both" }}>
            {children}
          </div>
        </main>

        <footer className="py-8 px-5 border-t border-white/[0.05]">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              ProsPilot · Mainnet Chain ID 1672 · Non-custodial
            </p>
            <div className="flex items-center gap-4">
              {[
                { label: "pharos.xyz", href: "https://pharos.xyz" },
                { label: "Docs", href: "https://docs.pharos.xyz" },
                { label: "Explorer", href: "https://pharos.socialscan.io" },
              ].map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                  className="text-xs transition-colors hover:text-cyan-400" style={{ color: "var(--text-dim)" }}>
                  {l.label} ↗
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
