"use client";

// Network dashboard — live Pharos chain health straight from the public RPC:
// block height, block time, gas price, recent activity. Auto-refreshes every 10s.

import { useEffect, useRef, useState } from "react";
import PageShell from "@/components/PageShell";
import { PHAROS_NETWORKS } from "@/lib/tokens";

interface BlockInfo {
  number: number;
  timestamp: number; // unix s
  txCount: number;
  gasUsed: number;
  gasLimit: number;
}

interface NetStats {
  blockNumber: number;
  gasPriceGwei: number;
  blocks: BlockInfo[];   // recent blocks, newest first
  blockTimeSec: number | null;
  tps: number | null;
  updatedAt: number;
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "RPC error");
  return j.result as T;
}

const hex = (h: string) => parseInt(h, 16);

async function fetchStats(rpcUrl: string): Promise<NetStats> {
  const [latestHex, gasPriceHex] = await Promise.all([
    rpc<string>(rpcUrl, "eth_blockNumber", []),
    rpc<string>(rpcUrl, "eth_gasPrice", []),
  ]);
  const latest = hex(latestHex);

  // Sample 6 recent blocks for block time / activity
  const blockNums = Array.from({ length: 6 }, (_, i) => latest - i);
  const raw = await Promise.all(
    blockNums.map((n) =>
      rpc<{ number: string; timestamp: string; transactions: string[]; gasUsed: string; gasLimit: string } | null>(
        rpcUrl, "eth_getBlockByNumber", ["0x" + n.toString(16), false],
      ).catch(() => null),
    ),
  );
  const blocks: BlockInfo[] = raw
    .filter((b): b is NonNullable<typeof b> => b != null)
    .map((b) => ({
      number: hex(b.number),
      timestamp: hex(b.timestamp),
      txCount: b.transactions.length,
      gasUsed: hex(b.gasUsed),
      gasLimit: hex(b.gasLimit),
    }));

  let blockTimeSec: number | null = null;
  let tps: number | null = null;
  if (blocks.length >= 2) {
    const newest = blocks[0], oldest = blocks[blocks.length - 1];
    const span = newest.timestamp - oldest.timestamp;
    if (span > 0) {
      blockTimeSec = span / (blocks.length - 1);
      const txs = blocks.reduce((n, b) => n + b.txCount, 0);
      tps = txs / span;
    }
  }

  return {
    blockNumber: latest,
    gasPriceGwei: hex(gasPriceHex) / 1e9,
    blocks,
    blockTimeSec,
    tps,
    updatedAt: Date.now(),
  };
}

export default function NetworkPage() {
  const net = PHAROS_NETWORKS.mainnet;
  const [stats, setStats] = useState<NetStats | null>(null);
  const [error, setError] = useState("");
  const prevBlock = useRef(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchStats(net.rpc)
        .then((s) => {
          if (!alive) return;
          if (prevBlock.current && s.blockNumber > prevBlock.current) {
            setFlash(true);
            setTimeout(() => setFlash(false), 700);
          }
          prevBlock.current = s.blockNumber;
          setStats(s);
          setError("");
        })
        .catch((e) => alive && setError(String(e?.message ?? e)));
    load();
    const t = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, [net.rpc]);

  const cards = [
    {
      label: "Block Height",
      value: stats ? stats.blockNumber.toLocaleString("en-US") : "—",
      sub: "auto-refresh 10s",
      color: "#00d4ff",
      pulse: flash,
    },
    {
      label: "Avg Block Time",
      value: stats?.blockTimeSec != null ? `${stats.blockTimeSec.toFixed(1)}s` : "—",
      sub: "last 6 blocks",
      color: "#34d399",
    },
    {
      label: "Gas Price",
      value: stats ? `${stats.gasPriceGwei < 0.01 ? stats.gasPriceGwei.toFixed(4) : stats.gasPriceGwei.toFixed(2)} Gwei` : "—",
      sub: "current",
      color: "#fbbf24",
    },
    {
      label: "Live TPS",
      value: stats?.tps != null ? stats.tps.toFixed(2) : "—",
      sub: "recent sample · max 30,000",
      color: "#a78bfa",
    },
  ];

  return (
    <PageShell
      eyebrow="Network"
      title="Pharos network health"
      subtitle={`Live stats straight from the public RPC (${net.rpc}) — verifiable against the explorer at any time.`}
      accent="#34d399"
      wide
    >
      {error && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 mb-6">
          RPC hiccup: {error} — retrying automatically.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="p-5 rounded-2xl relative overflow-hidden transition-all duration-300"
            style={{
              background: "rgba(6,12,28,0.75)",
              border: `1px solid ${c.pulse ? `${c.color}55` : "rgba(255,255,255,0.07)"}`,
              boxShadow: c.pulse ? `0 0 30px ${c.color}25` : "none",
            }}>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-2" style={{ color: "rgba(148,163,184,0.45)" }}>
              {c.label}
            </p>
            <p className="text-2xl font-extrabold tracking-[-0.02em] mb-1"
              style={{ color: c.color, fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
              {c.value}
            </p>
            <p className="text-[10px]" style={{ color: "rgba(148,163,184,0.4)" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent blocks */}
        <div className="lg:col-span-2 p-6 rounded-2xl" style={{ background: "rgba(6,12,28,0.75)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-bold text-white">Recent blocks</h2>
          </div>
          <div className="space-y-2">
            {(stats?.blocks ?? []).map((b) => {
              const fill = b.gasLimit > 0 ? (b.gasUsed / b.gasLimit) * 100 : 0;
              const age = stats ? Math.max(0, Math.round(stats.updatedAt / 1000 - b.timestamp)) : 0;
              return (
                <a key={b.number} href={`${net.explorer}/block/${b.number}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors group"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.25)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)")}>
                  <span className="text-xs font-mono font-semibold" style={{ color: "#00d4ff" }}>
                    #{b.number.toLocaleString("en-US")}
                  </span>
                  <span className="text-xs" style={{ color: "rgba(148,163,184,0.55)" }}>
                    {b.txCount} tx{b.txCount === 1 ? "" : "s"}
                  </span>
                  {/* Gas fill bar */}
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(fill, 1)}%`, background: fill > 70 ? "#fb7185" : fill > 35 ? "#fbbf24" : "#34d399" }} />
                  </div>
                  <span className="text-[10px] w-14 text-right" style={{ color: "rgba(148,163,184,0.4)" }}>
                    {age < 60 ? `${age}s ago` : `${Math.round(age / 60)}m ago`}
                  </span>
                </a>
              );
            })}
            {!stats && (
              <div className="py-12 flex justify-center">
                <span className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
                  style={{ borderColor: "rgba(52,211,153,0.5)", borderTopColor: "transparent" }} />
              </div>
            )}
          </div>
        </div>

        {/* Chain facts */}
        <div className="p-6 rounded-2xl" style={{ background: "rgba(6,12,28,0.75)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="text-sm font-bold text-white mb-4">Chain parameters</h2>
          <div className="space-y-3">
            {[
              { k: "Network", v: "Pharos Mainnet (Pacific Ocean)" },
              { k: "Chain ID", v: "1672" },
              { k: "Native token", v: "PROS" },
              { k: "Max TPS", v: "30,000" },
              { k: "Finality", v: "< 1 second" },
              { k: "Throughput", v: "2 Gigagas/s" },
              { k: "EVM", v: "Fully compatible" },
              { k: "RPC", v: net.rpc },
            ].map((row) => (
              <div key={row.k} className="flex items-start justify-between gap-3 text-xs border-b pb-2.5"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span style={{ color: "rgba(148,163,184,0.5)" }}>{row.k}</span>
                <span className="text-right font-medium text-white/85 break-all">{row.v}</span>
              </div>
            ))}
          </div>
          <a href={net.explorer} target="_blank" rel="noopener noreferrer"
            className="mt-5 block text-center px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
            style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", color: "#00d4ff" }}>
            Open Block Explorer ↗
          </a>
        </div>
      </div>
    </PageShell>
  );
}
