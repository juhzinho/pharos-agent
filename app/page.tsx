"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteBackground from "@/components/SiteBackground";

// ── Protocol ecosystem badges ─────────────────────────────────────────────────

const PROTOCOLS = [
  { name: "FaroSwap",    color: "#00d4ff", letter: "F" },
  { name: "LI.FI",       color: "#818cf8", letter: "L" },
  { name: "CCIP",        color: "#f472b6", letter: "C" },
  { name: "CCTP v2",     color: "#34d399", letter: "C" },
  { name: "LayerZero",   color: "#fbbf24", letter: "Z" },
  { name: "Faroo",       color: "#a78bfa", letter: "F" },
  { name: "R25",         color: "#38bdf8", letter: "R" },
  { name: "AquaFlux",    color: "#6ee7b7", letter: "A" },
  { name: "Zona",        color: "#fb923c", letter: "Z" },
  { name: "Morpho",      color: "#c084fc", letter: "M" },
  { name: "Bitverse",    color: "#f9a8d4", letter: "B" },
  { name: "Ember",       color: "#fcd34d", letter: "E" },
];

// ── Terminal chat preview ─────────────────────────────────────────────────────

const DEMO_MESSAGES = [
  { role: "user",  text: "swap 50 PROS to USDC" },
  { role: "agent", text: "Best route via FaroSwap 0.30% pool.\n~$12.40 USDC received · Gas ~0.001 PROS", hasAction: true, actionLabel: "Execute Swap" },
  { role: "user",  text: "show my liquidity positions" },
  { role: "agent", text: "Found 3 FaroSwap V3 positions:\n• NFT #2861 — Closed · Fees: 0.118 WPROS\n• NFT #2860 — Out of Range\n• NFT #1937 — ✓ In Range", hasPositions: true },
  { role: "user",  text: "bridge 100 USDC to Base" },
  { role: "agent", text: "Route via Circle CCTP v2: ~2 min, $0.12 fee.\nOr LI.FI bridge: ~5 min, $0.08 fee.", hasAction: true, actionLabel: "Bridge via CCTP" },
];

function TerminalPreview() {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (visibleCount >= DEMO_MESSAGES.length) return;
    const t = setTimeout(() => setVisibleCount(v => v + 1), visibleCount % 2 === 0 ? 1400 : 1000);
    return () => clearTimeout(t);
  }, [visibleCount]);

  return (
    <div className="relative rounded-[1.35rem] overflow-hidden w-full max-w-md mx-auto glass-panel"
      style={{ boxShadow: "var(--glow-cyan), var(--panel-shadow)" }}>
      {/* Terminal bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(0,212,255,0.1)", background: "rgba(0,212,255,0.03)" }}>
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
        </div>
        <span className="ml-2 text-xs font-medium" style={{ color: "rgba(0,212,255,0.5)" }}>
          ProsPilot · Mainnet
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(52,211,153,0.7)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Connected
        </span>
      </div>

      {/* Messages */}
      <div className="px-4 py-4 space-y-3 min-h-[280px]">
        {DEMO_MESSAGES.slice(0, visibleCount).map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            style={{ animation: "fadeSlideIn 0.3s ease both" }}>
            {m.role === "agent" && (
              <div className="w-6 h-6 rounded-full shrink-0 mr-2 mt-0.5 flex items-center justify-center"
                style={{ background: "radial-gradient(circle, rgba(0,212,255,0.3), rgba(0,212,255,0.05))", border: "1px solid rgba(0,212,255,0.25)" }}>
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                  <circle cx="6" cy="6" r="2.5" fill="rgba(0,212,255,0.9)" style={{ animation: "orbPulseEl 3s ease infinite" }} />
                </svg>
              </div>
            )}
            <div className="max-w-[75%]">
              <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${m.role === "user" ? "text-right" : ""}`}
                style={m.role === "user" ? {
                  background: "linear-gradient(135deg, rgba(0,130,190,0.3), rgba(0,80,160,0.2))",
                  border: "1px solid rgba(0,212,255,0.2)",
                  color: "rgba(220,240,255,0.9)",
                } : {
                  background: "rgba(12,22,44,0.8)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(200,220,245,0.85)",
                }}>
                {m.text.split("\n").map((line, j) => <div key={j}>{line}</div>)}
              </div>
              {m.hasAction && (
                <div className="mt-1.5 flex justify-start">
                  <span className="text-[10px] px-2.5 py-1 rounded-lg font-semibold cursor-default"
                    style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(56,189,248,0.12))", border: "1px solid rgba(0,212,255,0.3)", color: "#00d4ff" }}>
                    ⚡ {m.actionLabel}
                  </span>
                </div>
              )}
              {m.hasPositions && (
                <div className="mt-1.5 flex gap-1.5">
                  <span className="text-[9px] px-2 py-0.5 rounded-md font-medium" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "rgba(52,211,153,0.8)" }}>In Range</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-md font-medium" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", color: "rgba(251,191,36,0.8)" }}>Out of Range</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-md font-medium" style={{ background: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.2)", color: "rgba(148,163,184,0.7)" }}>Closed</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator when agent is about to respond */}
        {visibleCount < DEMO_MESSAGES.length && visibleCount % 2 === 1 && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full shrink-0 mr-2 flex items-center justify-center"
              style={{ background: "radial-gradient(circle, rgba(0,212,255,0.3), rgba(0,212,255,0.05))", border: "1px solid rgba(0,212,255,0.25)" }}>
              <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                <circle cx="6" cy="6" r="2.5" fill="rgba(0,212,255,0.9)" />
              </svg>
            </div>
            <div className="px-3 py-2.5 rounded-xl flex items-center gap-1" style={{ background: "rgba(12,22,44,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {[0, 0.18, 0.36].map((d, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "rgba(0,212,255,0.6)", animation: `typingBounce 1.1s ease-in-out ${d}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input bar mock */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="flex-1 text-xs" style={{ color: "rgba(100,116,139,0.5)" }}>Ask me anything about Pharos…</span>
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,212,255,0.15)", color: "#00d4ff" }}>
            <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="currentColor">
              <path d="M1.5 1a.5.5 0 00-.55.63l1.27 4.37H9.5a.5.5 0 010 1H2.22l-1.27 4.37A.5.5 0 001.5 12a19.26 19.26 0 0010.2-4.77.5.5 0 000-.74A19.26 19.26 0 001.5 1z" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
    title: "Token Swap",
    desc: "Best route across FaroSwap, ZentraFi, OKX DEX via LI.FI. One message to swap anything.",
    color: "#00d4ff",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Cross-Chain Bridge",
    desc: "Bridge to Ethereum, Base, Arbitrum, Polygon via Jumper (LI.FI), Chainlink CCIP, Circle CCTP v2, or LayerZero.",
    color: "#818cf8",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    title: "V3 Liquidity Manager",
    desc: "Add, remove, or view your FaroSwap V3 concentrated liquidity positions. Full LP lifecycle management.",
    color: "#34d399",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
    ),
    title: "Pharos Expert AI",
    desc: "Deep knowledge of every Pharos dApp — R25, Faroo, Zona, AquaFlux, Morpho, Ember, and 60+ protocols.",
    color: "#f472b6",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
    ),
    title: "Live Web Search",
    desc: "Detects when real-time data is needed — TVL, APYs, news — and searches the web instantly.",
    color: "#38bdf8",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
      </svg>
    ),
    title: "Script Generator",
    desc: "Generate TypeScript or Python scripts to automate any Pharos DeFi action — swaps, bridges, liquidity ops.",
    color: "#fbbf24",
  },
];

// ── Explore sections (dedicated pages) ────────────────────────────────────────

const EXPLORE_SECTIONS = [
  {
    href: "/chat",
    title: "AI Chat",
    desc: "Swap, bridge, LP, pay — everything in natural language. The heart of the agent.",
    color: "#00d4ff",
    tag: "Core",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    href: "/wallet",
    title: "Wallet Analyzer",
    desc: "Score, all tokens held, volume per token, swaps/bridges breakdown and gas — for any address.",
    color: "#34d399",
    tag: "Intelligence",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <rect x="2" y="6" width="20" height="14" rx="2.5"/><path d="M16 13h.01M2 10h20M7 3h10"/>
      </svg>
    ),
  },
  {
    href: "/ecosystem",
    title: "Ecosystem",
    desc: "40+ Pharos dApps, filterable by category — DEX, RWA, lending, bridges, infra.",
    color: "#34d399",
    tag: "Directory",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: "/trade",
    title: "Trade $PROS",
    desc: "Live price, interactive chart, market cap, volume, and every CEX/DEX venue.",
    color: "#fbbf24",
    tag: "Live data",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
      </svg>
    ),
  },
  {
    href: "/campaigns",
    title: "Campaigns",
    desc: "Every active reward campaign from Pharos Port, with live deadlines.",
    color: "#f472b6",
    tag: "Live data",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M6 9H4a2 2 0 00-2 2v2a2 2 0 002 2h2m0-6v6m0-6l8-4v14l-8-4m12-4v2a4 4 0 01-2 3.46" />
      </svg>
    ),
  },
  {
    href: "/news",
    title: "News",
    desc: "Official announcements and blog posts, live from pharos.xyz.",
    color: "#a78bfa",
    tag: "Live data",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9h4M18 14h-8M15 18h-5M10 6h8v4h-8z" />
      </svg>
    ),
  },
  {
    href: "/network",
    title: "Network",
    desc: "Block height, block time, gas price and TPS — live from the public RPC.",
    color: "#38bdf8",
    tag: "Live data",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    href: "/chat",
    title: "Wallet Intelligence",
    desc: "On-chain profile of any wallet + plain-language transaction explainer.",
    color: "#fb923c",
    tag: "AI",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v3l2 2" />
      </svg>
    ),
  },
];

// ── Stats ─────────────────────────────────────────────────────────────────────

const CHAIN_STATS = [
  { label: "Max TPS",       value: "30,000",     unit: "" },
  { label: "Finality",      value: "<1",          unit: "s" },
  { label: "Throughput",    value: "2",           unit: "Ggps" },
  { label: "Chain ID",      value: "1672",        unit: "" },
  { label: "EVM",           value: "Compatible",  unit: "" },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <SiteBackground variant="full" />

      <div className="relative z-10">
        <Navbar />

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="min-h-[93vh] flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20 px-5 pt-16 pb-20 max-w-6xl mx-auto">

          {/* Left: text */}
          <div className="flex-1 text-center lg:text-left" style={{ animation: "heroFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both" }}>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-7 text-xs font-semibold"
              style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.18)", color: "rgba(0,212,255,0.7)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00d4ff" }} />
              Pharos Mainnet · Pacific Ocean · Chain ID 1672
            </div>

            <h1 className="font-display font-extrabold tracking-[-0.04em] leading-[1.02] mb-5 text-gradient-hero"
              style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)" }}>
              Your DeFi Agent<br />
              <span className="text-gradient-accent">on Pharos</span>
            </h1>

            <p className="text-base leading-relaxed mb-8 max-w-lg lg:max-w-none mx-auto lg:mx-0"
              style={{ color: "var(--text-muted)", fontSize: "clamp(0.95rem, 1.6vw, 1.1rem)" }}>
              Swap, bridge, manage liquidity, and explore every Pharos protocol
              through natural conversation. Non-custodial, multilingual, always onchain.
            </p>

            <div className="flex items-center gap-3 flex-wrap justify-center lg:justify-start mb-10">
              <Link href="/chat" className="btn-primary pulse-glow">
                <span className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)", animation: "shimmer 3s ease-in-out infinite" }} />
                <svg viewBox="0 0 20 20" className="w-4.5 h-4.5 shrink-0 relative" fill="currentColor">
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.903 6.557H13.5a.75.75 0 010 1.5H4.182l-1.903 6.557a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                </svg>
                <span className="relative">Launch Agent</span>
              </Link>

              <a href="https://docs.pharos.xyz" target="_blank" rel="noopener noreferrer" className="btn-ghost">
                Pharos Docs ↗
              </a>
            </div>

            {/* Chain stats */}
            <div className="flex items-center gap-5 flex-wrap justify-center lg:justify-start">
              {CHAIN_STATS.map((s) => (
                <div key={s.label} className="text-center lg:text-left">
                  <p className="font-bold tracking-[-0.025em] leading-none"
                    style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif", fontSize: "1.1rem", color: "rgba(255,255,255,0.9)" }}>
                    {s.value}<span className="text-sm font-semibold ml-0.5" style={{ color: "#00d4ff" }}>{s.unit}</span>
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.1em] font-semibold mt-0.5" style={{ color: "rgba(0,212,255,0.38)" }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: terminal preview */}
          <div className="flex-shrink-0 w-full max-w-sm lg:max-w-md" style={{ animation: "heroFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.15s both" }}>
            <TerminalPreview />
          </div>
        </section>

        {/* ── Protocol Ecosystem ───────────────────────────────────────────── */}
        <section className="py-14 px-5 border-y" style={{ borderColor: "rgba(0,212,255,0.06)", background: "rgba(0,0,0,0.15)" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-xs uppercase tracking-[0.18em] font-semibold mb-8" style={{ color: "rgba(0,212,255,0.3)" }}>
              Integrated with the full Pharos ecosystem
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {PROTOCOLS.map((p) => (
                <div key={p.name}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-default"
                  style={{ background: `${p.color}08`, border: `1px solid ${p.color}18`, color: "rgba(203,213,225,0.7)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = `${p.color}15`;
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${p.color}35`;
                    (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.95)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = `${p.color}08`;
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${p.color}18`;
                    (e.currentTarget as HTMLDivElement).style.color = "rgba(203,213,225,0.7)";
                    (e.currentTarget as HTMLDivElement).style.transform = "";
                  }}>
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0"
                    style={{ background: `${p.color}20`, color: p.color }}>
                    {p.letter}
                  </span>
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Explore the app ──────────────────────────────────────────────── */}
        <section className="py-24 px-5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: "rgba(0,212,255,0.45)" }}>Explore</p>
              <h2 className="font-bold tracking-[-0.03em] mb-4"
                style={{
                  fontFamily: "var(--font-display), var(--font-inter), sans-serif",
                  fontSize: "clamp(1.75rem, 4vw, 2.8rem)",
                  color: "rgba(255,255,255,0.94)",
                }}>
                One app, every Pharos tool
              </h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(148,163,184,0.55)" }}>
                Each function has its own dedicated space — organized, fast, and always live.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {EXPLORE_SECTIONS.map((s, i) => (
                <Link key={s.title} href={s.href}
                  className="group relative p-5 rounded-2xl glass-panel glass-card-hover overflow-hidden"
                  style={{ animation: `cardAppear 0.45s cubic-bezier(0.22,1,0.36,1) ${i * 0.06}s both` }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${s.color}35`;
                    e.currentTarget.style.boxShadow = `0 10px 40px ${s.color}14`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "";
                    e.currentTarget.style.boxShadow = "";
                  }}>
                  {/* Top glow */}
                  <span className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(90deg, transparent, ${s.color}80, transparent)` }} />

                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${s.color}12`, border: `1px solid ${s.color}25`, color: s.color }}>
                      {s.icon}
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                      style={{ background: `${s.color}0d`, border: `1px solid ${s.color}20`, color: `${s.color}90` }}>
                      {s.tag}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white mb-1.5 text-sm tracking-[-0.01em] flex items-center gap-1.5"
                    style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                    {s.title}
                    <span className="opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0 text-xs" style={{ color: s.color }}>→</span>
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(148,163,184,0.6)" }}>{s.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section id="features" className="py-24 px-5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: "rgba(0,212,255,0.45)" }}>Capabilities</p>
              <h2 className="font-bold tracking-[-0.03em] mb-4"
                style={{
                  fontFamily: "var(--font-display), var(--font-inter), sans-serif",
                  fontSize: "clamp(1.75rem, 4vw, 2.8rem)",
                  color: "rgba(255,255,255,0.94)",
                }}>
                Everything you need on Pharos
              </h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(148,163,184,0.55)" }}>
                One AI agent. Full Pharos DeFi access. Just talk to it.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <div key={f.title}
                  className="p-5 rounded-2xl glass-panel glass-card-hover group cursor-default"
                  style={{ animation: `cardAppear 0.45s cubic-bezier(0.22,1,0.36,1) ${i * 0.07}s both` }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.border = `1px solid ${f.color}28`;
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 36px ${f.color}12`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.border = "";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                  }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${f.color}12`, border: `1px solid ${f.color}22`, color: f.color }}>
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-white mb-2 text-sm tracking-[-0.01em]"
                    style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                    {f.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(148,163,184,0.6)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section className="py-20 px-5" style={{ background: "rgba(0,0,0,0.12)" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: "rgba(0,212,255,0.45)" }}>How it works</p>
              <h2 className="font-bold tracking-[-0.03em]"
                style={{
                  fontFamily: "var(--font-display), var(--font-inter), sans-serif",
                  fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                  color: "rgba(255,255,255,0.93)",
                }}>
                Talk → Agent builds → You sign
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  step: "01",
                  title: "Say what you want",
                  desc: "In any language. \"Swap 50 PROS to USDC\" or \"add liquidity to FaroSwap 0.30% ±10%\".",
                  color: "#00d4ff",
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  ),
                },
                {
                  step: "02",
                  title: "Agent builds the tx",
                  desc: "Queries pools, gets quotes, validates routes, and builds the exact calldata — all onchain.",
                  color: "#818cf8",
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                    </svg>
                  ),
                },
                {
                  step: "03",
                  title: "You sign, never the agent",
                  desc: "Non-custodial always. MetaMask, Rabby, OKX Wallet, or any EIP-6963 provider.",
                  color: "#34d399",
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  ),
                },
              ].map((item, i) => (
                <div key={item.step}
                  className="relative p-6 rounded-2xl text-center"
                  style={{
                    background: "rgba(6,12,28,0.6)",
                    border: `1px solid ${item.color}18`,
                    animation: `cardAppear 0.45s cubic-bezier(0.22,1,0.36,1) ${i * 0.1}s both`,
                  }}>
                  {/* Step connector */}
                  {i < 2 && (
                    <div className="hidden sm:block absolute top-1/2 -right-3 w-6 z-10 text-center" style={{ transform: "translateY(-50%)" }}>
                      <svg viewBox="0 0 20 10" className="w-5 h-3" fill="none" stroke="rgba(0,212,255,0.2)" strokeWidth="1.5">
                        <path d="M0 5h16M12 1l4 4-4 4" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `${item.color}12`, border: `1px solid ${item.color}25`, color: item.color }}>
                    {item.icon}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.15em] font-bold mb-2" style={{ color: `${item.color}60` }}>{item.step}</div>
                  <h3 className="font-semibold text-white mb-2 text-sm"
                    style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(148,163,184,0.55)" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security + CTA ────────────────────────────────────────────────── */}
        <section id="about" className="py-24 px-5">
          <div className="max-w-4xl mx-auto">

            {/* Security pills */}
            <div className="flex flex-wrap gap-3 justify-center mb-16">
              {[
                { icon: "🔐", text: "Non-custodial · Your keys, always" },
                { icon: "🛡️", text: "Zero key exposure, ever" },
                { icon: "✅", text: "You sign every transaction" },
                { icon: "🌐", text: "30+ languages supported" },
                { icon: "⚡", text: "6 AI providers, always up" },
              ].map((pill) => (
                <div key={pill.text}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
                  style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", color: "rgba(110,231,183,0.75)" }}>
                  <span>{pill.icon}</span>
                  {pill.text}
                </div>
              ))}
            </div>

            {/* Final CTA card */}
            <div className="relative p-8 sm:p-12 rounded-3xl text-center overflow-hidden"
              style={{
                background: "radial-gradient(ellipse at 50% 0%, rgba(0,100,200,0.18) 0%, rgba(4,9,22,0.95) 70%)",
                border: "1px solid rgba(0,212,255,0.18)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 0 80px rgba(0,212,255,0.08), 0 30px 80px rgba(0,0,0,0.4)",
              }}>
              {/* Background glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(0,212,255,0.12), transparent 70%)", filter: "blur(20px)" }} />

              <div className="relative">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle at 38% 28%, rgba(0,212,255,0.25), rgba(2,8,22,0.98))",
                    border: "1.5px solid rgba(0,212,255,0.3)",
                    boxShadow: "0 0 40px rgba(0,212,255,0.2)",
                  }}>
                  <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none">
                    <circle cx="20" cy="20" r="6" fill="rgba(0,212,255,0.9)" style={{ animation: "orbPulseEl 3s ease-in-out infinite" }} />
                    <circle cx="20" cy="20" r="13" stroke="rgba(0,212,255,0.2)" strokeWidth="1" />
                    <circle cx="20" cy="20" r="19" stroke="rgba(0,212,255,0.07)" strokeWidth="1" />
                  </svg>
                </div>

                <h2 className="font-bold text-white mb-3 tracking-[-0.03em]"
                  style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif", fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)" }}>
                  Ready to trade on Pharos?
                </h2>
                <p className="text-sm leading-relaxed max-w-md mx-auto mb-8" style={{ color: "rgba(148,163,184,0.6)" }}>
                  The most powerful way to navigate Pharos DeFi. No extensions needed — just connect your wallet and start.
                </p>

                <Link href="/chat"
                  className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-sm text-black transition-all duration-200 relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #00d4ff 0%, #38bdf8 60%, #0ea5e9 100%)",
                    boxShadow: "0 6px 28px rgba(0,212,255,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
                    fontFamily: "var(--font-display), var(--font-inter), sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px) scale(1.04)";
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 14px 44px rgba(0,212,255,0.65), inset 0 1px 0 rgba(255,255,255,0.35)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.transform = "";
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 28px rgba(0,212,255,0.45), inset 0 1px 0 rgba(255,255,255,0.3)";
                  }}>
                  <span className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)", animation: "shimmer 3s ease-in-out infinite" }} />
                  <span className="relative">Start with ProsPilot →</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="py-8 px-5 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)" }}>
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                  <circle cx="6" cy="6" r="2.5" fill="rgba(0,212,255,0.9)" />
                </svg>
              </div>
              <p className="text-xs" style={{ color: "rgba(71,85,105,0.55)" }}>
                ProsPilot · Mainnet Chain ID 1672 · Non-custodial
              </p>
            </div>
            <div className="flex items-center gap-4">
              {[
                { label: "pharos.xyz", href: "https://pharos.xyz" },
                { label: "Docs", href: "https://docs.pharos.xyz" },
                { label: "Explorer", href: "https://pharos.socialscan.io" },
                { label: "Ecosystem", href: "https://port.pharos.xyz/ecosystem" },
              ].map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                  className="text-xs transition-colors" style={{ color: "rgba(71,85,105,0.5)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.65)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(71,85,105,0.5)"; }}>
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
