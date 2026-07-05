"use client";

// Wallet Analyzer — dedicated dashboard for FULL on-chain wallet intelligence:
// score, every token held (live balances), per-token volume moved (in/out),
// movement types (swaps, bridges, liquidity, transfers, wraps, approvals),
// gas spent, activity timeline and protocol footprint. Works for ANY address.

import { useEffect, useMemo, useState } from "react";
import PageShell from "@/components/PageShell";
import type { WalletIntel } from "@/lib/walletIntel";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function fmt(n: number, maxDec = 4): string {
  if (n === 0) return "0";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n < 0.0001) return n.toExponential(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: maxDec });
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const ACTIVITY_META: Array<{ key: keyof WalletIntel["activity"]; label: string; icon: string; color: string }> = [
  { key: "swaps",         label: "Swaps",          icon: "⇄", color: "#22d3ee" },
  { key: "bridges",       label: "Bridges",        icon: "🌉", color: "#a78bfa" },
  { key: "liquidity",     label: "Liquidity",      icon: "💧", color: "#34d399" },
  { key: "transfers",     label: "Transfers",      icon: "➤", color: "#fbbf24" },
  { key: "wraps",         label: "Wrap/Unwrap",    icon: "🎁", color: "#f472b6" },
  { key: "approvals",     label: "Approvals",      icon: "✓", color: "#94a3b8" },
  { key: "contractCalls", label: "Contract calls", icon: "⚙", color: "#64748b" },
];

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`}
      style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(10,18,38,0.55)" }}>
      <h3 className="text-xs uppercase tracking-[0.14em] font-semibold mb-4" style={{ color: "rgba(148,163,184,0.6)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Gauge({ score, level, emoji }: { score: number; level: string; emoji: string }) {
  const R = 62, C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "#34d399" : pct >= 60 ? "#22d3ee" : pct >= 40 ? "#fbbf24" : "#fb7185";
  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="11" />
        <circle cx="80" cy="80" r={R} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold" style={{ color }}>{score}</span>
        <span className="text-sm mt-1" style={{ color: "rgba(203,213,225,0.85)" }}>{emoji} {level}</span>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [intel, setIntel] = useState<WalletIntel | null>(null);

  // Prefill with the connected wallet, if any (no popup — eth_accounts only).
  useEffect(() => {
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum;
    if (!eth) return;
    eth.request({ method: "eth_accounts" })
      .then((accs) => { if (accs?.[0]) { setConnected(accs[0]); setInput((v) => v || accs[0]); } })
      .catch(() => {});
  }, []);

  async function analyze(addr?: string) {
    const target = (addr ?? input).trim();
    if (!ADDR_RE.test(target)) { setError("Enter a valid address (0x + 40 hex characters)."); return; }
    setError(""); setLoading(true); setIntel(null);
    try {
      const res = await fetch("/api/skill/wallet-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: target }),
      });
      const data = await res.json();
      if (!res.ok || data?.available === false) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setIntel(data as WalletIntel);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const totalMoves = useMemo(
    () => intel ? ACTIVITY_META.reduce((s, m) => s + (intel.activity?.[m.key] ?? 0), 0) : 0,
    [intel]
  );
  const maxMonthly = useMemo(
    () => intel ? Math.max(1, ...intel.monthly.map((m) => m.txs)) : 1,
    [intel]
  );

  return (
    <PageShell
      eyebrow="Wallet Analyzer"
      title="Full on-chain wallet intelligence"
      subtitle="Score, every token held, volume moved per token (PROS, WPROS, USDC and more), movement types — swaps, bridges, liquidity, transfers — gas spent and activity timeline. Works for any Pharos address."
      accent="#34d399"
      wide
    >
      {/* Address input */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && analyze()}
          placeholder="0x… any Pharos address"
          spellCheck={false}
          className="flex-1 rounded-xl px-4 py-3 text-sm font-mono outline-none border transition-colors focus:border-emerald-400/60"
          style={{ background: "rgba(8,15,32,0.7)", borderColor: "rgba(255,255,255,0.09)", color: "#e2e8f0" }}
        />
        <div className="flex gap-2">
          {connected && (
            <button onClick={() => { setInput(connected); analyze(connected); }}
              className="rounded-xl px-4 py-3 text-sm font-semibold border transition-all hover:border-emerald-400/50"
              style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(203,213,225,0.9)" }}>
              My wallet
            </button>
          )}
          <button onClick={() => analyze()} disabled={loading}
            className="rounded-xl px-6 py-3 text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #059669, #0d9488)", color: "#fff" }}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border px-4 py-3 mb-6 text-sm"
          style={{ borderColor: "rgba(251,113,133,0.3)", background: "rgba(251,113,133,0.07)", color: "#fda4af" }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
          <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
            Reading explorer history + live balances…
          </p>
        </div>
      )}

      {intel && (
        <div className="space-y-6">
          {/* Header row: score + key stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title="Wallet Score">
              <Gauge score={intel.score} level={intel.level} emoji={intel.levelEmoji} />
              <div className="mt-4 space-y-2">
                {intel.categories.map((c) => (
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: "rgba(203,213,225,0.8)" }}>{c.label}</span>
                      <span style={{ color: "rgba(148,163,184,0.6)" }}>{c.points}/{c.max}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full" style={{
                        width: `${(c.points / c.max) * 100}%`,
                        background: "linear-gradient(90deg, #059669, #22d3ee)",
                        transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="lg:col-span-2 space-y-6">
              <Card title={`Overview — ${shortAddr(intel.address)}`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total txs", value: intel.txTotal.toLocaleString("en-US") },
                    { label: "Gas spent", value: `${fmt(intel.gasSpentPros)} PROS` },
                    { label: "PROS received", value: fmt(intel.nativeIn ?? 0, 2) },
                    { label: "PROS sent", value: fmt(intel.nativeOut ?? 0, 2) },
                    { label: "Token transfers", value: intel.tokenTransferCount.toLocaleString("en-US") },
                    { label: "Unique tokens", value: String(intel.uniqueTokens.length) },
                    { label: "Failed txs", value: String(intel.failedTxs) },
                    { label: "Active months", value: String(intel.activeMonths) },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: "rgba(100,116,139,0.7)" }}>{s.label}</p>
                      <p className="text-lg font-bold mt-0.5" style={{ color: "#e2e8f0" }}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {intel.flags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {intel.flags.map((f) => (
                      <span key={f} className="text-[11px] px-2.5 py-1 rounded-full border"
                        style={{ borderColor: "rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.08)", color: "#6ee7b7" }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                {intel.truncated && (
                  <p className="text-[11px] mt-3" style={{ color: "rgba(148,163,184,0.5)" }}>
                    Large wallet — most recent {intel.txSampled} txs sampled. Full history on{" "}
                    <a href={intel.explorer} target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-400">SocialScan ↗</a>
                  </p>
                )}
              </Card>

              <Card title={`Movement types (${totalMoves} classified)`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {ACTIVITY_META.map((m) => {
                    const n = intel.activity?.[m.key] ?? 0;
                    return (
                      <div key={m.key} className="rounded-xl border p-3 text-center"
                        style={{ borderColor: n > 0 ? `${m.color}35` : "rgba(255,255,255,0.05)", background: n > 0 ? `${m.color}0d` : "transparent" }}>
                        <div className="text-lg">{m.icon}</div>
                        <div className="text-xl font-extrabold mt-1" style={{ color: n > 0 ? m.color : "rgba(100,116,139,0.5)" }}>{n}</div>
                        <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: "rgba(148,163,184,0.55)" }}>{m.label}</div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>

          {/* Holdings + volumes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title={`Current holdings (${intel.holdings?.length ?? 0} tokens, live balances)`}>
              {(intel.holdings ?? []).length === 0 ? (
                <p className="text-sm" style={{ color: "rgba(148,163,184,0.55)" }}>No balances found.</p>
              ) : (
                <div className="space-y-2">
                  {(intel.holdings ?? []).map((h) => (
                    <div key={h.address} className="flex items-center justify-between rounded-xl border px-3.5 py-2.5"
                      style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                      <div className="flex items-center gap-2.5">
                        {h.logo
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={h.logo} alt="" className="w-6 h-6 rounded-full" />
                          : <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                              style={{ background: "rgba(34,211,238,0.15)", color: "#22d3ee" }}>{h.symbol.slice(0, 2)}</div>}
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{h.symbol}</p>
                          <p className="text-[10px] font-mono" style={{ color: "rgba(100,116,139,0.6)" }}>
                            {h.address === "native" ? "native coin" : shortAddr(h.address)}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold" style={{ color: "#a5f3fc" }}>{fmt(h.balance, 6)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Volume moved per token (in / out)">
              {(intel.tokenVolumes ?? []).length === 0 ? (
                <p className="text-sm" style={{ color: "rgba(148,163,184,0.55)" }}>No token transfers found.</p>
              ) : (
                <div className="space-y-2">
                  {(intel.tokenVolumes ?? []).map((v) => (
                    <div key={v.address} className="rounded-xl border px-3.5 py-2.5"
                      style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{v.symbol}</span>
                        <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.55)" }}>{v.transfers} transfers</span>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span style={{ color: "#34d399" }}>▼ in {fmt(v.inAmount, 4)}</span>
                        <span style={{ color: "#fb7185" }}>▲ out {fmt(v.outAmount, 4)}</span>
                        <span style={{ color: "rgba(148,163,184,0.6)" }}>total {fmt(v.inAmount + v.outAmount, 4)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Timeline + protocols */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Activity timeline (txs per month)">
              {intel.monthly.length === 0 ? (
                <p className="text-sm" style={{ color: "rgba(148,163,184,0.55)" }}>No activity.</p>
              ) : (
                <div className="flex items-end gap-1.5 h-32">
                  {intel.monthly.map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <span className="text-[9px]" style={{ color: "rgba(148,163,184,0.6)" }}>{m.txs}</span>
                      <div className="w-full rounded-t"
                        style={{
                          height: `${Math.max(4, (m.txs / maxMonthly) * 88)}px`,
                          background: "linear-gradient(180deg, #22d3ee, #0e7490)",
                        }} />
                      <span className="text-[9px] truncate w-full text-center" style={{ color: "rgba(100,116,139,0.7)" }}>
                        {m.month.slice(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title={`Protocols touched (${intel.protocols.length})`}>
              {intel.protocols.length === 0 ? (
                <p className="text-sm" style={{ color: "rgba(148,163,184,0.55)" }}>No known protocols detected yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {intel.protocols.map((p) => (
                    <span key={p} className="text-xs px-3 py-1.5 rounded-full border font-medium"
                      style={{ borderColor: "rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.08)", color: "#c4b5fd" }}>
                      {p}
                    </span>
                  ))}
                </div>
              )}
              <a href={intel.explorer} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-4 text-xs underline hover:text-cyan-400" style={{ color: "rgba(148,163,184,0.6)" }}>
                Open full history on SocialScan ↗
              </a>
            </Card>
          </div>
        </div>
      )}

      {!intel && !loading && !error && (
        <div className="rounded-2xl border border-dashed p-12 text-center"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
            Paste any Pharos address above — or use your connected wallet — to see the full breakdown.
          </p>
        </div>
      )}
    </PageShell>
  );
}
