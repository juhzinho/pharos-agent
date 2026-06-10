"use client";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import WaveBackground from "@/components/WaveBackground";

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
    title: "Token Swap",
    desc: "Swap any token on Pharos via LI.FI — best route across FaroSwap, ZentraFi, OKX DEX, and more.",
    color: "#00d4ff",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Cross-Chain Bridge",
    desc: "Bridge tokens to Ethereum, Base, Arbitrum, Polygon, Optimism via Jumper (LI.FI) or Chainlink CCIP.",
    color: "#818cf8",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    title: "Concentrated Liquidity",
    desc: "Add V3 concentrated liquidity to FaroSwap WPROS/USDC pools. Choose fee tier and price range — receive an LP NFT.",
    color: "#34d399",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 00-8 0v2" />
      </svg>
    ),
    title: "LP Position Viewer",
    desc: "View all your FaroSwap V3 LP positions — token amounts, fee tier, range, in-range status, and accrued fees.",
    color: "#fbbf24",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    title: "Pharos Expert",
    desc: "Built-in knowledge of every Pharos dApp — R25, Faroo, Zona, AquaFlux, Bitverse, Centrifuge, Ember, and 60+ more.",
    color: "#f472b6",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
      </svg>
    ),
    title: "Live Web Search",
    desc: "Detects when you need real-time data — news, TVL, APYs, recent events — and searches the web instantly.",
    color: "#38bdf8",
  },
];

const SECURITY_POINTS = [
  {
    icon: "🔐",
    title: "Non-custodial",
    desc: "Your keys never leave your wallet. The agent only proposes transactions — you always sign with MetaMask or Rabby.",
  },
  {
    icon: "🛡️",
    title: "Zero key exposure",
    desc: "The agent will never ask for, generate, or store private keys or seed phrases — under any framing, ever.",
  },
  {
    icon: "✅",
    title: "You control every tx",
    desc: "No transaction is sent without your explicit signature. The agent prepares, you approve.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-x-hidden"
      style={{
        background: "radial-gradient(ellipse at 50% -5%, rgba(0,80,170,0.6) 0%, rgba(0,30,80,0.22) 45%, transparent 65%), linear-gradient(170deg, #070d20 0%, #050a1a 55%, #030710 100%)",
      }}>

      <WaveBackground intensity="full" />

      <div className="relative z-10">
        <Navbar />

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="min-h-[92vh] flex flex-col items-center justify-center text-center px-5 pt-16 pb-24">
          {/* Tagline chip */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8 text-xs font-semibold"
            style={{
              background: "rgba(0,212,255,0.07)",
              border: "1px solid rgba(0,212,255,0.22)",
              color: "rgba(0,212,255,0.8)",
              animation: "heroFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both",
            }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00d4ff" }} />
            Pharos Mainnet · Pacific Ocean · Chain ID 1672
          </div>

          {/* Main heading */}
          <h1 className="font-display font-extrabold tracking-[-0.04em] leading-[1.05] mb-6"
            style={{
              fontFamily: "var(--font-display), var(--font-inter), sans-serif",
              fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
              background: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 35%, #00d4ff 65%, #38bdf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "none",
              filter: "drop-shadow(0 0 40px rgba(0,212,255,0.25))",
              animation: "heroFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.1s both",
            }}>
            Pharos Agent
          </h1>

          <h2 className="font-display font-bold tracking-[-0.025em] mb-6"
            style={{
              fontFamily: "var(--font-display), var(--font-inter), sans-serif",
              fontSize: "clamp(1.2rem, 3vw, 2rem)",
              color: "rgba(226,232,240,0.7)",
              animation: "heroFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.2s both",
            }}>
            Your AI DeFi Copilot
          </h2>

          <p className="max-w-2xl text-base leading-relaxed mb-10"
            style={{
              color: "rgba(148,163,184,0.75)",
              fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
              animation: "heroFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.3s both",
            }}>
            Created and dedicated to the Pharos ecosystem. Built to help sailors navigate
            RealFi with maximum security — swap, bridge, provide liquidity, and explore every
            dApp on Pharos through natural conversation.
          </p>

          {/* CTA buttons */}
          <div className="flex items-center gap-3 flex-wrap justify-center"
            style={{ animation: "heroFadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.4s both" }}>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-base text-black transition-all duration-200 relative overflow-hidden pulse-glow"
              style={{
                background: "linear-gradient(135deg, #00d4ff 0%, #38bdf8 60%, #0ea5e9 100%)",
                boxShadow: "0 6px 28px rgba(0,212,255,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
                fontFamily: "var(--font-display), var(--font-inter), sans-serif",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px) scale(1.03)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 10px 36px rgba(0,212,255,0.6), inset 0 1px 0 rgba(255,255,255,0.35)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 28px rgba(0,212,255,0.45), inset 0 1px 0 rgba(255,255,255,0.3)";
              }}
            >
              <span className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)", animation: "shimmer 3s ease-in-out infinite" }} />
              <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0 relative" fill="currentColor">
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.903 6.557H13.5a.75.75 0 010 1.5H4.182l-1.903 6.557a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
              <span className="relative">Start Chatting</span>
            </Link>

            <a
              href="https://pharos.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(226,232,240,0.75)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.9)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLAnchorElement).style.color = "rgba(226,232,240,0.75)";
              }}
            >
              Pharos Docs ↗
            </a>
          </div>

          {/* Subtle scroll hint */}
          <div className="mt-16 flex flex-col items-center gap-1.5 opacity-30">
            <span className="text-xs text-slate-400">Explore</span>
            <svg viewBox="0 0 16 24" className="w-4 h-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="2" y="2" width="12" height="20" rx="6" />
              <path d="M8 6v4" strokeOpacity="0.8" />
            </svg>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section id="features" className="py-24 px-5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="font-display font-bold tracking-[-0.03em] mb-4"
                style={{
                  fontFamily: "var(--font-display), var(--font-inter), sans-serif",
                  fontSize: "clamp(1.75rem, 4vw, 2.8rem)",
                  color: "rgba(255,255,255,0.92)",
                  textShadow: "0 0 30px rgba(0,212,255,0.18)",
                }}>
                Everything you need on Pharos
              </h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(148,163,184,0.6)" }}>
                One AI agent. Full Pharos DeFi access. Talk to it like you would a brilliant friend who knows every protocol.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="group p-5 rounded-2xl transition-all duration-200 relative overflow-hidden"
                  style={{
                    background: "rgba(8,15,32,0.65)",
                    border: `1px solid rgba(255,255,255,0.07)`,
                    backdropFilter: "blur(16px)",
                    animation: `cardAppear 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 0.07}s both`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.border = `1px solid ${f.color}22`;
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${f.color}14`;
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,255,255,0.07)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                    (e.currentTarget as HTMLDivElement).style.transform = "";
                  }}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 shrink-0"
                    style={{ background: `${f.color}12`, border: `1px solid ${f.color}22`, color: f.color }}>
                    {f.icon}
                  </div>
                  <h3 className="font-display font-semibold text-white mb-2 tracking-[-0.015em]"
                    style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(148,163,184,0.62)" }}>
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── About / Security ─────────────────────────────────────────────── */}
        <section id="about" className="py-24 px-5">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="font-display font-bold tracking-[-0.03em] mb-4"
                style={{
                  fontFamily: "var(--font-display), var(--font-inter), sans-serif",
                  fontSize: "clamp(1.75rem, 4vw, 2.8rem)",
                  color: "rgba(255,255,255,0.92)",
                  textShadow: "0 0 30px rgba(0,212,255,0.15)",
                }}>
                Maximum Security. Zero Compromise.
              </h2>
              <p className="text-base max-w-lg mx-auto" style={{ color: "rgba(148,163,184,0.6)" }}>
                Built non-custodial from the ground up. You control every transaction, every signature, every key.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
              {SECURITY_POINTS.map((s, i) => (
                <div key={s.title} className="p-5 rounded-2xl text-center"
                  style={{
                    background: "rgba(8,15,32,0.55)",
                    border: "1px solid rgba(52,211,153,0.12)",
                    animation: `cardAppear 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 0.1}s both`,
                  }}>
                  <div className="text-2xl mb-3">{s.icon}</div>
                  <h3 className="font-display font-semibold text-white mb-2 text-sm"
                    style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                    {s.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(148,163,184,0.55)" }}>
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* About the project */}
            <div className="p-8 rounded-2xl text-center"
              style={{
                background: "rgba(0,30,70,0.4)",
                border: "1px solid rgba(0,212,255,0.1)",
                backdropFilter: "blur(16px)",
              }}>
              <div className="w-12 h-12 rounded-full mx-auto mb-5 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(56,189,248,0.08))", border: "1px solid rgba(0,212,255,0.3)" }}>
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="rgba(0,212,255,0.8)" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-white mb-3 text-lg tracking-[-0.02em]"
                style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                Built for the Pharos Ecosystem
              </h3>
              <p className="text-sm leading-relaxed max-w-xl mx-auto mb-6" style={{ color: "rgba(148,163,184,0.65)" }}>
                Pharos Agent is dedicated to the Pharos Network community. From RWA vaults and liquid staking to perp trading
                and cross-chain bridging — this agent knows the full Pacific Ocean ecosystem and helps you navigate it safely.
              </p>
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-black transition-all duration-200"
                style={{ background: "linear-gradient(135deg, #00d4ff, #38bdf8)", boxShadow: "0 4px 20px rgba(0,212,255,0.35)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px) scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.transform = "";
                }}
              >
                Start Chatting with Pharos Agent →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="py-8 px-5 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs" style={{ color: "rgba(71,85,105,0.6)" }}>
              Pharos Mainnet · Chain ID 1672 · Non-custodial · Your keys, your crypto
            </p>
            <div className="flex items-center gap-4">
              <a href="https://pharos.xyz" target="_blank" rel="noopener noreferrer"
                className="text-xs transition-colors" style={{ color: "rgba(71,85,105,0.5)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.6)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(71,85,105,0.5)"; }}>
                pharos.xyz ↗
              </a>
              <a href="https://docs.pharosnetwork.xyz" target="_blank" rel="noopener noreferrer"
                className="text-xs transition-colors" style={{ color: "rgba(71,85,105,0.5)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.6)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(71,85,105,0.5)"; }}>
                Docs ↗
              </a>
              <a href="https://port.pharos.xyz/ecosystem" target="_blank" rel="noopener noreferrer"
                className="text-xs transition-colors" style={{ color: "rgba(71,85,105,0.5)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.6)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(71,85,105,0.5)"; }}>
                Ecosystem ↗
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
