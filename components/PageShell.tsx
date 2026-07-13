"use client";

// Shared layout shell for section pages (/ecosystem, /trade, /campaigns, …).
// Keeps the ProsPilot identity consistent: dark ocean background, subtle
// grid, navbar on top, centered content column and a standard page header.

import Navbar from "@/components/Navbar";
import type { ReactNode } from "react";

interface PageShellProps {
  eyebrow: string;          // small uppercase label above the title
  title: string;
  subtitle?: string;
  accent?: string;          // accent color for the eyebrow/glow
  children: ReactNode;
  wide?: boolean;
}

export default function PageShell({ eyebrow, title, subtitle, accent = "#00d4ff", children, wide }: PageShellProps) {
  return (
    <div className="min-h-screen relative overflow-x-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% -10%, rgba(0,60,140,0.5) 0%, rgba(0,20,60,0.18) 45%, transparent 65%), linear-gradient(170deg, #060c1e 0%, #040914 55%, #020710 100%)",
      }}>
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: "linear-gradient(rgba(0,212,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.5) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

      <div className="relative z-10">
        <Navbar />

        <main className={`mx-auto px-5 pt-12 pb-24 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
          {/* Page header */}
          <div className="mb-10" style={{ animation: "heroFadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both" }}>
            <p className="text-xs uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: `${accent}75` }}>
              {eyebrow}
            </p>
            <h1 className="font-extrabold tracking-[-0.035em] leading-tight mb-3"
              style={{
                fontFamily: "var(--font-display), var(--font-inter), sans-serif",
                fontSize: "clamp(1.9rem, 4.2vw, 3rem)",
                background: "linear-gradient(140deg, #ffffff 0%, #e2f4ff 40%, #a5f3fc 80%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "rgba(148,163,184,0.65)" }}>
                {subtitle}
              </p>
            )}
          </div>

          <div style={{ animation: "heroFadeUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s both" }}>
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-8 px-5 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs" style={{ color: "rgba(71,85,105,0.55)" }}>
              ProsPilot · Mainnet Chain ID 1672 · Non-custodial
            </p>
            <div className="flex items-center gap-4">
              {[
                { label: "pharos.xyz", href: "https://pharos.xyz" },
                { label: "Docs", href: "https://docs.pharos.xyz" },
                { label: "Explorer", href: "https://pharos.socialscan.io" },
              ].map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                  className="text-xs transition-colors hover:text-cyan-400" style={{ color: "rgba(71,85,105,0.5)" }}>
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
