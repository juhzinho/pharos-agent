"use client";

// Payment request creator — form UI on top of the same /pay link flow the
// chat agent uses ("request 10 PROS for design work").

import { useMemo, useState } from "react";
import PageShell from "@/components/PageShell";
import { connectWallet } from "@/lib/wallet";
import { TOKENS } from "@/lib/tokens";

const REQUEST_TOKENS = ["PROS", ...Object.keys(TOKENS).filter((t) => t !== "PROS")];

export default function RequestPage() {
  const [wallet, setWallet] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("PROS");
  const [memo, setMemo] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const link = useMemo(() => {
    const amt = Number(amount);
    if (!wallet || !(amt > 0)) return "";
    const qs = new URLSearchParams({ to: wallet, amount: String(amt), token });
    if (memo.trim()) qs.set("memo", memo.trim().slice(0, 140));
    return typeof window !== "undefined" ? `${window.location.origin}/pay?${qs.toString()}` : "";
  }, [wallet, amount, token, memo]);

  async function connect() {
    setConnecting(true);
    setError("");
    try {
      setWallet(await connectWallet());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }

  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <PageShell
      eyebrow="Payment Request"
      title="Get paid on Pharos in one link"
      subtitle="Create a shareable on-chain invoice — the payer opens the link, connects their wallet, and pays you in one click. Non-custodial on both sides."
      accent="#38bdf8"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="p-6 rounded-2xl" style={{ background: "rgba(6,12,28,0.75)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Step 1: wallet */}
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-2" style={{ color: "rgba(148,163,184,0.5)" }}>
              1 · Receive to
            </p>
            {wallet ? (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
                <span className="text-xs font-mono text-white/85">{wallet.slice(0, 8)}…{wallet.slice(-6)}</span>
                <span className="text-[10px] font-bold" style={{ color: "#34d399" }}>✓ Connected</span>
              </div>
            ) : (
              <button onClick={connect} disabled={connecting}
                className="w-full py-3 rounded-xl text-sm font-bold text-black transition-transform hover:scale-[1.01] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #00d4ff, #38bdf8)", boxShadow: "0 4px 16px rgba(0,212,255,0.3)" }}>
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            )}
          </div>

          {/* Step 2: amount + token */}
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-2" style={{ color: "rgba(148,163,184,0.5)" }}>
              2 · Amount
            </p>
            <div className="flex gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0.00"
                className="flex-1 px-4 py-3 rounded-xl text-lg font-bold text-white outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
              />
              <select value={token} onChange={(e) => setToken(e.target.value)}
                className="px-4 py-3 rounded-xl text-sm font-bold text-white outline-none cursor-pointer"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
                {REQUEST_TOKENS.map((t) => (
                  <option key={t} value={t} style={{ background: "#0a1322" }}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3: memo */}
          <div className="mb-2">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-2" style={{ color: "rgba(148,163,184,0.5)" }}>
              3 · What&apos;s it for? <span className="normal-case font-normal opacity-60">(optional)</span>
            </p>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={140}
              placeholder="Design work, dinner split, subscription…"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
            />
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
          )}
        </div>

        {/* Live preview */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 p-6 rounded-2xl flex flex-col"
            style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.14)" }}>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-4" style={{ color: "rgba(0,212,255,0.55)" }}>
              Invoice preview
            </p>

            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center text-xl"
                style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(56,189,248,0.12))", border: "1px solid rgba(0,212,255,0.3)" }}>
                💸
              </div>
              <p className="text-3xl font-extrabold text-white tracking-[-0.02em] mb-1"
                style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                {Number(amount) > 0 ? Number(amount).toLocaleString("en-US", { maximumFractionDigits: 6 }) : "0.00"}{" "}
                <span style={{ color: "#00d4ff" }}>{token}</span>
              </p>
              {memo.trim() && <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>“{memo.trim()}”</p>}
              <p className="text-xs mt-3" style={{ color: "rgba(148,163,184,0.4)" }}>
                {wallet ? `→ ${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "→ connect wallet to set recipient"}
              </p>
            </div>

            {link ? (
              <>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3"
                  style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <span className="flex-1 text-xs font-mono truncate" style={{ color: "#67e8f9" }}>{link}</span>
                  <button onClick={copy}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.25)", color: "#00d4ff" }}>
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <a href={link} target="_blank" rel="noopener noreferrer"
                  className="text-center py-3 rounded-xl text-xs font-bold text-black transition-transform hover:scale-[1.01]"
                  style={{ background: "linear-gradient(135deg, #00d4ff, #38bdf8)", boxShadow: "0 4px 16px rgba(0,212,255,0.3)" }}>
                  Preview payment page →
                </a>
              </>
            ) : (
              <p className="text-center text-xs py-3" style={{ color: "rgba(148,163,184,0.4)" }}>
                Fill the form to generate your link
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl text-xs leading-relaxed"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(148,163,184,0.55)" }}>
            💡 You can also do this in chat: <span className="font-mono text-cyan-300/80">&quot;request 10 PROS for design work&quot;</span> —
            the agent generates the same link instantly.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
