"use client";

import { useEffect, useState } from "react";
import { getTokenPrice } from "@/lib/prices";

// Small always-visible PROS price display (CoinGecko via getTokenPrice — public,
// client-side, 60s cached). Auto-refreshes every 60s. Shows a subtle loading
// state first, and "—" if the fetch fails (never crashes).
type Status = { price: number; change: number } | "loading" | "error";

function fmtPrice(n: number): string {
  return n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

export default function PriceTicker() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const p = await getTokenPrice("pros");
        if (!cancelled) setStatus({ price: p.price, change: p.change24h });
      } catch {
        if (!cancelled) setStatus((prev) => (typeof prev === "object" ? prev : "error"));
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const pill = "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0";
  const pillStyle = { background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.16)" } as const;

  if (status === "loading" || status === "error") {
    return (
      <div className={pill} style={pillStyle} title="PROS price">
        <span className="text-xs font-data font-semibold" style={{ color: "rgba(0,212,255,0.8)" }}>PROS</span>
        <span className={`text-xs font-data ${status === "loading" ? "animate-pulse" : ""}`} style={{ color: "rgba(148,163,184,0.7)" }}>
          {status === "loading" ? "…" : "—"}
        </span>
      </div>
    );
  }

  const up = status.change >= 0;
  return (
    <div className={pill} style={pillStyle} title="PROS price (CoinGecko, 24h)">
      <span className="text-xs font-data font-semibold" style={{ color: "rgba(0,212,255,0.8)" }}>PROS</span>
      <span className="text-xs font-data font-semibold text-white">{fmtPrice(status.price)}</span>
      <span className="text-xs font-data" style={{ color: up ? "#34d399" : "#f87171" }}>
        {up ? "📈" : "📉"} {up ? "+" : ""}{status.change.toFixed(2)}%
      </span>
    </div>
  );
}
