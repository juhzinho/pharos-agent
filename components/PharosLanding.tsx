"use client";

import WaveBackground from "@/components/WaveBackground";

// Ported from the Lovable landing (src/routes/index.tsx) into a Next.js client
// component. Keeps the hero ("DeFi inteligente / para o oceano RWA") and the
// canvas wave animation (WaveBackground). TanStack Link/router replaced by
// onStart/onAbout callbacks supplied by the host route. UI only — no agent logic.

interface PharosLandingProps {
  onStart: () => void;
  onAbout: () => void;
}

const DISPLAY = "var(--font-display), var(--font-inter), sans-serif";

const HIGHLIGHTS = [
  { k: "Sub-second", v: "Finalidade ultra-rápida" },
  { k: "RWA-native", v: "Infra para tokenização" },
  { k: "Parallel EVM", v: "Throughput institucional" },
];

export default function PharosLanding({ onStart, onAbout }: PharosLandingProps) {
  return (
    <div
      className="relative flex min-h-screen w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% -10%, oklch(0.36 0.28 264 / 0.5) 0%, oklch(0.18 0.18 264 / 0.3) 42%, transparent 64%), radial-gradient(ellipse at top, oklch(0.18 0.18 264) 0%, oklch(0.06 0.06 262) 70%)",
      }}
    >
      {/* Canvas wave animation */}
      <WaveBackground intensity="full" />

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <div className="mx-auto max-w-3xl text-center">
          {/* Tagline chip */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full glass-panel px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-accent">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 5c1.2-1.2 2.5-1.2 3.7 0S7.3 6.2 8.5 5 11 3.8 12.2 5 14.8 6.2 16 5M0 11c1.2-1.2 2.5-1.2 3.7 0S6.3 12.2 7.5 11 10 9.8 11.2 11 13.8 12.2 15 11" />
            </svg>
            Pharos Network · AI Agent
          </div>

          {/* Hero heading */}
          <h1 className="mt-6 text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight" style={{ fontFamily: DISPLAY }}>
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-pharos)" }}>
              DeFi inteligente
            </span>
            <br />
            <span className="text-foreground">para o oceano RWA.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Converse com um agente especializado em DeFi, Real World Assets e TradFi — construído nativamente para a Pharos Network.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={onStart}
              className="group inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-4 text-base font-semibold text-primary-foreground transition hover:scale-[1.03]"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              Iniciar conversa
              <svg viewBox="0 0 16 16" className="h-4 w-4 transition group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
            <button
              onClick={onAbout}
              className="inline-flex items-center gap-2 rounded-2xl glass-panel px-7 py-4 text-base font-semibold text-foreground transition hover:scale-[1.03]"
            >
              Sobre a Pharos
            </button>
          </div>

          {/* Highlights */}
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {HIGHLIGHTS.map((f) => (
              <div key={f.k} className="glass-panel rounded-2xl p-5 text-left">
                <div className="text-sm font-bold text-accent">{f.k}</div>
                <div className="mt-1 text-xs text-muted-foreground">{f.v}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
