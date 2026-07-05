"use client";

// Shareable payment request page — /pay?to=0x…&amount=10&token=PROS&memo=design%20work
// The payee generates this link in the chat ("request 10 PROS for design work");
// the payer opens it, connects their wallet, and pays in one click.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { connectWallet, sendTransaction, switchToChain } from "@/lib/wallet";
import { buildTransferTxs } from "@/lib/transfer";
import { PHAROS_NETWORKS } from "@/lib/tokens";

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function PayInner() {
  const params = useSearchParams();
  const to = params.get("to") ?? "";
  const amount = Number(params.get("amount") ?? "0");
  const token = (params.get("token") ?? "PROS").toUpperCase();
  const memo = params.get("memo") ?? "";

  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "paying" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const valid = /^0x[a-fA-F0-9]{40}$/.test(to) && amount > 0;

  async function connect() {
    setStatus("connecting");
    setError("");
    try {
      const address = await connectWallet();
      setWallet(address);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  async function pay() {
    setStatus("paying");
    setError("");
    try {
      await switchToChain("Pharos");
      const build = buildTransferTxs([{ to, amount, token }], "mainnet");
      const hash = await sendTransaction({ to: build.txs[0].to, data: build.txs[0].data, value: build.txs[0].value });
      setTxHash(hash);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(0,70,150,0.4) 0%, rgba(0,25,70,0.15) 40%, transparent 60%), linear-gradient(170deg, #060c1e 0%, #050a1a 55%, #030710 100%)" }}>
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-[#0a1322]/90 p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-lg">💸</div>
            <div>
              <h1 className="text-lg font-bold text-white">Payment Request</h1>
              <p className="text-xs text-white/40">Pharos Network · non-custodial</p>
            </div>
          </div>

          {!valid ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              Invalid payment link — missing or malformed recipient/amount.
            </div>
          ) : status === "done" ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✅</div>
              <div className="text-white font-semibold mb-1">Payment sent!</div>
              <div className="text-sm text-white/50 mb-4">
                {amount} {token} → {short(to)}
              </div>
              <a
                href={`${PHAROS_NETWORKS.mainnet.explorerTx}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-cyan-300 text-sm hover:bg-white/10 transition-colors"
              >
                View on explorer ↗
              </a>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5 mb-5">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-white">{amount.toLocaleString("en-US", { maximumFractionDigits: 6 })} <span className="text-cyan-300">{token}</span></div>
                  {memo && <div className="text-sm text-white/50 mt-1">“{memo}”</div>}
                </div>
                <div className="flex justify-between text-xs text-white/40 border-t border-white/5 pt-3">
                  <span>Pay to</span>
                  <span className="font-mono text-white/70">{short(to)}</span>
                </div>
                <div className="flex justify-between text-xs text-white/40 mt-1.5">
                  <span>Network</span>
                  <span className="text-white/70">Pharos Mainnet (1672)</span>
                </div>
                {wallet && (
                  <div className="flex justify-between text-xs text-white/40 mt-1.5">
                    <span>From</span>
                    <span className="font-mono text-white/70">{short(wallet)}</span>
                  </div>
                )}
              </div>

              {!wallet ? (
                <button
                  onClick={connect}
                  disabled={status === "connecting"}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {status === "connecting" ? "Connecting…" : "Connect wallet"}
                </button>
              ) : (
                <button
                  onClick={pay}
                  disabled={status === "paying"}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {status === "paying" ? "Confirm in your wallet…" : `Pay ${amount} ${token}`}
                </button>
              )}

              {error && (
                <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}

              <p className="text-[11px] text-white/25 mt-4 text-center">
                You sign in your own wallet — this page never touches your keys.
              </p>
            </>
          )}
        </div>

        <div className="text-center mt-4">
          <Link href="/chat" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Powered by Pharos Agent →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#060c1e]" />}>
      <PayInner />
    </Suspense>
  );
}
