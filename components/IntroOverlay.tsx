"use client";

import { useEffect, useState } from "react";

// Lightweight brand reveal shown once per browser session (sessionStorage, so
// it never blocks returning users). Purely a visual overlay — clicking anywhere
// or waiting ~2.5s reveals the chat underneath. Mounts nothing if already seen.

const SESSION_KEY = "pharos-intro-seen";

export default function IntroOverlay() {
  // Start hidden so server and first client render match (avoids hydration
  // mismatch); the effect decides whether to play.
  const [phase, setPhase] = useState<"hidden" | "showing" | "leaving">("hidden");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setPhase("showing");
    const tLeave = setTimeout(() => setPhase("leaving"), 2200);
    const tDone = setTimeout(() => setPhase("hidden"), 2900);
    return () => {
      clearTimeout(tLeave);
      clearTimeout(tDone);
    };
  }, []);

  if (phase === "hidden") return null;

  const dismiss = () => setPhase("leaving");

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center"
      style={{
        background: "radial-gradient(ellipse at 50% 35%, oklch(0.18 0.18 264) 0%, oklch(0.06 0.06 262) 70%)",
        opacity: phase === "leaving" ? 0 : 1,
        transition: "opacity 650ms ease-out",
        pointerEvents: phase === "leaving" ? "none" : "auto",
        cursor: "pointer",
      }}
      aria-hidden
    >
      {/* ambient glow */}
      <div className="absolute inset-0 animate-pulse-glow" style={{ background: "var(--gradient-glow)", opacity: 0.4 }} />

      {/* Orb logo */}
      <div
        className="relative glass-panel w-28 h-28 rounded-3xl flex items-center justify-center"
        style={{ boxShadow: "var(--shadow-glow)", animation: "intro-orb-in 1s cubic-bezier(0.22,1,0.36,1) forwards" }}
      >
        <svg viewBox="0 0 28 28" className="w-16 h-16" fill="none">
          <circle cx="14" cy="14" r="4.5" fill="oklch(0.78 0.16 220 / 0.9)" style={{ animation: "orbPulseEl 3s ease-in-out infinite" }} />
          <circle cx="14" cy="14" r="9.5" stroke="oklch(0.58 0.26 258 / 0.5)" strokeWidth="0.8" />
          <circle cx="14" cy="14" r="12.5" stroke="oklch(0.58 0.26 258 / 0.2)" strokeWidth="0.6" />
        </svg>
      </div>

      {/* Title */}
      <h1
        className="relative mt-7 font-display font-bold text-white text-3xl uppercase"
        style={{
          fontFamily: "var(--font-display), sans-serif",
          letterSpacing: "0.16em",
          animation: "intro-title-in 1.1s ease-out 0.25s both",
          textShadow: "0 0 30px oklch(0.58 0.26 258 / 0.6)",
        }}
      >
        Pharos Agent
      </h1>
      <p
        className="relative mt-2 text-xs uppercase tracking-[0.32em]"
        style={{ color: "oklch(0.78 0.16 220 / 0.7)", animation: "intro-title-in 1.1s ease-out 0.5s both" }}
      >
        AI DeFi Copilot
      </p>
    </div>
  );
}
