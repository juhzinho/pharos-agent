"use client";

// Network dashboard — live Pharos chain health straight from the public RPC:
// block height, block time, gas price, recent activity. Auto-refreshes every 10s.

import { useEffect, useMemo, useRef, useState } from "react";
import PageShell from "@/components/PageShell";
import { PHAROS_NETWORKS } from "@/lib/tokens";

interface SeriesPoint { date: string; value: number }
interface ChartSeries { id: string; title: string; unit?: string; points: SeriesPoint[] }
interface ChartsPayload {
  series: ChartSeries[];
  rwa: { name: string; tvl: number; apy: string; assetClass: string }[];
  rwaTotal: number;
  updatedAt: number;
}

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

function fmtMetric(v: number, unit?: string): string {
  if (unit === "USD") {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
  }
  let num: string;
  if (v >= 1e9) num = `${(v / 1e9).toFixed(2)}B`;
  else if (v >= 1e6) num = `${(v / 1e6).toFixed(2)}M`;
  else if (v >= 1e3) num = `${(v / 1e3).toFixed(1)}K`;
  else if (Number.isInteger(v)) num = v.toLocaleString("en-US");
  else num = v >= 1 ? v.toFixed(2) : v.toPrecision(3);
  return unit ? `${num} ${unit}` : num;
}

const SERIES_COLORS: Record<string, string> = {
  defi_tvl: "#34d399",
  daily_txns: "#00d4ff",
  failed_txns: "#fb7185",
  avg_txn_fee: "#fbbf24",
  avg_gas_price: "#fbbf24",
  active_addresses: "#a78bfa",
  new_addresses: "#a78bfa",
  total_addresses: "#818cf8",
  daily_blocks: "#00d4ff",
  block_time: "#34d399",
  avg_block_size: "#38bdf8",
  txns_per_block: "#38bdf8",
  erc20_transfers: "#f472b6",
  erc721_transfers: "#f472b6",
};

function MetricChart({ s }: { s: ChartSeries }) {
  const color = SERIES_COLORS[s.id] ?? "#00d4ff";
  const [hover, setHover] = useState<number | null>(null);
  const W = 320, H = 96, PAD = 4;

  const geo = useMemo(() => {
    const pts = s.points;
    if (pts.length < 2) return null;
    const min = Math.min(...pts.map((p) => p.value));
    const max = Math.max(...pts.map((p) => p.value));
    const span = max - min || 1;
    const step = (W - PAD * 2) / (pts.length - 1);
    const coords = pts.map((p, i) => ({
      x: PAD + i * step,
      y: PAD + (1 - (p.value - min) / span) * (H - PAD * 2),
    }));
    const line = "M" + coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" L");
    const area = line + ` L${coords[coords.length - 1].x.toFixed(1)},${H} L${PAD},${H} Z`;
    return { coords, line, area, step };
  }, [s.points]);

  const latest = s.points[s.points.length - 1];
  const shown = hover != null ? s.points[hover] : latest;

  return (
    <div className="p-5 rounded-2xl" style={{ background: "rgba(6,12,28,0.75)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: "rgba(148,163,184,0.45)" }}>
          {s.title}
        </p>
        <p className="text-[10px]" style={{ color: "rgba(148,163,184,0.4)" }}>{shown?.date ?? ""}</p>
      </div>
      <p className="text-xl font-extrabold tracking-[-0.02em] mb-2"
        style={{ color, fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
        {shown ? fmtMetric(shown.value, s.unit) : "—"}
      </p>
      {geo && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto cursor-crosshair" preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * W;
            const idx = Math.round((x - PAD) / geo.step);
            setHover(Math.min(Math.max(idx, 0), s.points.length - 1));
          }}>
          <defs>
            <linearGradient id={`fill-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geo.area} fill={`url(#fill-${s.id})`} />
          <path d={geo.line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          {hover != null && geo.coords[hover] && (
            <>
              <line x1={geo.coords[hover].x} y1="0" x2={geo.coords[hover].x} y2={H}
                stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3" />
              <circle cx={geo.coords[hover].x} cy={geo.coords[hover].y} r="3.5" fill={color} stroke="#060c1c" strokeWidth="1.5" />
            </>
          )}
        </svg>
      )}
    </div>
  );
}

export default function NetworkPage() {
  const net = PHAROS_NETWORKS.mainnet;
  const [stats, setStats] = useState<NetStats | null>(null);
  const [error, setError] = useState("");
  const prevBlock = useRef(0);
  const [flash, setFlash] = useState(false);
  const [charts, setCharts] = useState<ChartsPayload | null>(null);
  const [chartsError, setChartsError] = useState("");

  useEffect(() => {
    fetch("/api/charts")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ChartsPayload) => setCharts(d))
      .catch((e) => setChartsError(String(e?.message ?? e)));
  }, []);

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

      {/* ── Historical charts & statistics ─────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Charts & statistics</h2>
            <p className="text-xs" style={{ color: "rgba(148,163,184,0.5)" }}>
              Daily blockchain metrics — same data that powers{" "}
              <a href="https://pharos.socialscan.io/charts" target="_blank" rel="noopener noreferrer"
                className="underline decoration-dotted" style={{ color: "#00d4ff" }}>
                pharos.socialscan.io/charts
              </a>
              {" "}· DeFi TVL via DefiLlama · RWA via Pharos Port
            </p>
          </div>
          {charts && (
            <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
              style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
              {charts.series.length} metrics · updated {new Date(charts.updatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {chartsError && !charts && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 mb-4">
            Couldn&apos;t load historical charts: {chartsError}
          </div>
        )}

        {!charts && !chartsError && (
          <div className="py-16 flex justify-center">
            <span className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: "rgba(52,211,153,0.5)", borderTopColor: "transparent" }} />
          </div>
        )}

        {charts && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {charts.series.map((s) => <MetricChart key={s.id} s={s} />)}
            </div>

            {/* RWA market cap breakdown */}
            {charts.rwa.length > 0 && (
              <div className="mt-6 p-6 rounded-2xl" style={{ background: "rgba(6,12,28,0.75)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                  <h3 className="text-sm font-bold text-white">RWA Market Cap (Pharos Harbor)</h3>
                  <span className="text-sm font-extrabold" style={{ color: "#34d399" }}>
                    Total: {fmtMetric(charts.rwaTotal, "USD")}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {charts.rwa.map((a) => (
                    <div key={a.name} className="px-4 py-3 rounded-xl flex items-center justify-between gap-3"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{a.name}</p>
                        <p className="text-[10px]" style={{ color: "rgba(148,163,184,0.5)" }}>{a.assetClass} · APY {a.apy}</p>
                      </div>
                      <span className="text-xs font-bold shrink-0" style={{ color: "#34d399" }}>
                        {fmtMetric(a.tvl, "USD")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
