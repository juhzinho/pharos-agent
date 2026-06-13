"use client";

import { useMemo } from "react";

// Purely presentational ambient background — glow orbs + drifting DeFi terms.
// Adapted (subtly) from the Lovable reference. Renders behind all content and
// NEVER captures pointer events, so it can't interfere with clicks.

const WORDS = [
  "RWA", "DeFi", "TradFi", "Tokenization", "Yield", "Liquidity", "Staking",
  "Restaking", "AMM", "Lending", "Treasuries", "Stablecoins", "Pharos",
  "Parallel EVM", "Sub-second", "On-chain", "Settlement", "Bridges",
  "Real World Assets", "Composable", "Institutional", "Cross-chain",
];

interface FloatingWord {
  word: string;
  left: number;
  tx: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
}

// Deterministic pseudo-random layout (seeded sin) so SSR and client match.
function buildWords(count: number): FloatingWord[] {
  return Array.from({ length: count }, (_, i) => {
    const seed = i + 1;
    const rand = (n: number) => (Math.sin(seed * n) + 1) / 2;
    return {
      word: WORDS[i % WORDS.length],
      left: rand(12.9898) * 100,
      tx: (rand(78.233) - 0.5) * 80,
      delay: rand(43.123) * 18,
      duration: 16 + rand(91.345) * 12,
      size: 13 + rand(27.13) * 22,
      opacity: 0.1 + rand(53.7) * 0.18,
    };
  });
}

export default function GlassBackground() {
  const words = useMemo(() => buildWords(18), []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Deep gradient glow orbs */}
      <div
        className="absolute -top-40 -left-40 h-[42rem] w-[42rem] rounded-full opacity-50 blur-3xl animate-pulse-glow"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div
        className="absolute -bottom-60 -right-32 h-[48rem] w-[48rem] rounded-full opacity-40 blur-3xl animate-pulse-glow"
        style={{
          background: "radial-gradient(circle, oklch(0.78 0.16 220 / 0.35) 0%, transparent 70%)",
          animationDelay: "2s",
        }}
      />

      {/* Drifting terms */}
      <div className="absolute inset-0">
        {words.map((w, i) => (
          <span
            key={i}
            className="absolute bottom-0 whitespace-nowrap font-semibold tracking-wider uppercase"
            style={{
              left: `${w.left}%`,
              fontSize: `${w.size}px`,
              color: i % 3 === 0 ? "oklch(0.78 0.16 220)" : "oklch(0.72 0.18 258)",
              textShadow: "0 0 24px oklch(0.58 0.26 258 / 0.5)",
              animation: `float-word ${w.duration}s ease-in-out ${w.delay}s infinite`,
              ["--tx" as never]: `${w.tx}px`,
              ["--word-opacity" as never]: String(w.opacity),
              opacity: 0,
            }}
          >
            {w.word}
          </span>
        ))}
      </div>
    </div>
  );
}
