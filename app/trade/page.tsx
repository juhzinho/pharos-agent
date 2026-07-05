"use client";

// Trade dashboard — live $PROS market data from CoinGecko, interactive chart
// with range toggles, market stats, and CEX/DEX trading venues.

import { useEffect, useMemo, useState } from "react";
import PageShell from "@/components/PageShell";
import {
  getTokenPrice, getPriceHistory, PROS_CEX_LINKS,
  type TokenPrice, type PricePoint, type ChartRange,
} from "@/lib/prices";

const RANGES: Array<{ id: ChartRange; label: string }> = [
  { id: "1", label: "24H" },
  { id: "7", label: "7D" },
  { id: "30", label: "30D" },
];

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function Chart({ points, positive }: { points: PricePoint[]; positive: boolean }) {
  const W = 720, H = 220, PAD = 8;
  const path = useMemo(() => {
    if (points.length < 2) return { line: "", area: "" };
    const min = Math.min(...points.map((p) => p.p));
    const max = Math.max(...points.map((p) => p.p));
    const span = max - min || 1;
    const step = (W - PAD * 2) / (points.length - 1);
    const coords = points.map((p, i) => {
      const x = PAD + i * step;
      const y = PAD + (1 - (p.p - min) / span) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const line = "M" + coords.join(" L");
    const area = line + ` L${(PAD + (points.length - 1) * step).toFixed(1)},${H} L${PAD},${H} Z`;
    return { line, area };
  }, [points]);

  const color = positive ? "#34d399" : "#fb7185";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#chartFill)" />
      <path d={path.line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function TradePage() {
  const [price, setPrice] = useState<TokenPrice | null>(null);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [range, setRange] = useState<ChartRange>("1");
  const [error, setError] = useState("");

  useEffect(() => {
    getTokenPrice("PROS").then(setPrice).catch((e) => setError(String(e?.message ?? e)));
    const t = setInterval(() => getTokenPrice("PROS").then(setPrice).catch(() => {}), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setHistory([]);
    getPriceHistory("PROS", range).then(setHistory).catch(() => {});
  }, [range]);

  const rangeChange = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0].p, last = history[history.length - 1].p;
    return ((last - first) / first) * 100;
  }, [history]);

  const positive = (rangeChange ?? price?.change24h ?? 0) >= 0;

  return (
    <PageShell
      eyebrow="Trade"
      title="$PROS live market"
      subtitle="Real-time price, market data and every venue where you can trade the Pharos native token — refreshed every minute via CoinGecko."
      accent="#34d399"
      wide
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t load live data: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Chart card */}
        <div className="lg:col-span-2 p-6 rounded-2xl"
          style={{ background: "rgba(6,12,28,0.75)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.25)", color: "#00d4ff" }}>
                  P
                </span>
                <span className="text-sm font-semibold text-white">PROS / USD</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                  LIVE
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-white tracking-[-0.02em]"
                  style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                  {price ? `$${price.price >= 1 ? price.price.toFixed(2) : price.price.toFixed(4)}` : "—"}
                </span>
                {rangeChange != null && (
                  <span className="text-sm font-bold" style={{ color: positive ? "#34d399" : "#fb7185" }}>
                    {positive ? "▲" : "▼"} {Math.abs(rangeChange).toFixed(2)}%
                    <span className="ml-1 text-xs font-medium opacity-60">{RANGES.find((r) => r.id === range)?.label}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
              {RANGES.map((r) => (
                <button key={r.id} onClick={() => setRange(r.id)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: range === r.id ? "rgba(0,212,255,0.15)" : "transparent",
                    color: range === r.id ? "#00d4ff" : "rgba(148,163,184,0.6)",
                  }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {history.length > 1 ? (
            <Chart points={history} positive={positive} />
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <span className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: "rgba(0,212,255,0.5)", borderTopColor: "transparent" }} />
            </div>
          )}
        </div>

        {/* Stats column */}
        <div className="flex flex-col gap-4">
          {[
            { label: "Market Cap", value: price ? fmtUsd(price.marketCap) : "—", color: "#00d4ff" },
            { label: "24h Volume", value: price ? fmtUsd(price.volume24h) : "—", color: "#a78bfa" },
            {
              label: "24h Change",
              value: price ? `${price.change24h >= 0 ? "+" : ""}${price.change24h.toFixed(2)}%` : "—",
              color: (price?.change24h ?? 0) >= 0 ? "#34d399" : "#fb7185",
            },
          ].map((s) => (
            <div key={s.label} className="flex-1 p-5 rounded-2xl flex flex-col justify-center"
              style={{ background: "rgba(6,12,28,0.75)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-1.5" style={{ color: "rgba(148,163,184,0.45)" }}>
                {s.label}
              </p>
              <p className="text-xl font-extrabold tracking-[-0.02em]"
                style={{ color: s.color, fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Venues */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-2xl" style={{ background: "rgba(6,12,28,0.75)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="text-sm font-bold text-white mb-1">Trade &amp; track $PROS</h2>
          <p className="text-xs mb-4" style={{ color: "rgba(148,163,184,0.55)" }}>CEX listings and market data trackers for PROS.</p>
          <div className="flex flex-col gap-2">
            {PROS_CEX_LINKS.map((l) => (
              <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:translate-x-1"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}>
                {l.name}
                <span className="text-xs" style={{ color: "rgba(0,212,255,0.6)" }}>Trade ↗</span>
              </a>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl flex flex-col" style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.14)" }}>
          <h2 className="text-sm font-bold text-white mb-1">Trade onchain with the Agent</h2>
          <p className="text-xs mb-4 leading-relaxed" style={{ color: "rgba(148,163,184,0.6)" }}>
            Swap PROS for USDC, WETH or any Pharos token straight from the chat —
            best route via FaroSwap and LI.FI, signed in your own wallet.
          </p>
          <div className="flex flex-col gap-2 mb-5">
            {["swap 50 PROS to USDC", "bridge 100 USDC to Base", "add liquidity WPROS/USDC"].map((ex) => (
              <span key={ex} className="text-xs font-mono px-3 py-2 rounded-lg"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,255,0.1)", color: "rgba(165,243,252,0.75)" }}>
                “{ex}”
              </span>
            ))}
          </div>
          <a href="/chat" className="mt-auto text-center px-5 py-3 rounded-xl text-xs font-bold text-black transition-transform hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #00d4ff, #38bdf8)", boxShadow: "0 4px 16px rgba(0,212,255,0.3)" }}>
            Open the Agent →
          </a>
        </div>
      </div>
    </PageShell>
  );
}
