"use client";

// Network switcher (navbar) — Pharos Mainnet ⇄ Atlantic Testnet.
// Persists the choice globally (lib/network) and asks the wallet to switch
// chains when one is connected.

import { useEffect, useRef, useState } from "react";
import { PHAROS_NETWORKS, type PharosNetworkId } from "@/lib/tokens";
import { getSelectedNetwork, setSelectedNetwork, onNetworkChange } from "@/lib/network";
import { switchToChain, isWalletAvailable } from "@/lib/wallet";

const META: Record<PharosNetworkId, { dot: string; short: string; walletChain: string }> = {
  mainnet: { dot: "#00d4ff", short: "Mainnet", walletChain: "Pharos" },
  testnet: { dot: "#fbbf24", short: "Testnet", walletChain: "PharosTestnet" },
};

export default function NetworkSwitcher() {
  const [network, setNetwork] = useState<PharosNetworkId>("mainnet");
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNetwork(getSelectedNetwork());
    return onNetworkChange(setNetwork);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function choose(id: PharosNetworkId) {
    setOpen(false);
    if (id === network) return;
    setSelectedNetwork(id);
    // If a wallet is connected, ask it to switch too (best-effort).
    if (isWalletAvailable()) {
      setSwitching(true);
      try {
        await switchToChain(META[id].walletChain);
      } catch {
        // User rejected or wallet unavailable — selection still applies app-wide.
      } finally {
        setSwitching(false);
      }
    }
  }

  const meta = META[network];

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${network === "testnet" ? "rgba(251,191,36,0.3)" : "rgba(0,212,255,0.22)"}`,
          color: "rgba(226,232,240,0.85)",
        }}
        title="Switch network"
      >
        {switching ? (
          <span className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="w-2 h-2 rounded-full" style={{ background: meta.dot, boxShadow: `0 0 8px ${meta.dot}` }} />
        )}
        <span className="hidden sm:inline">{PHAROS_NETWORKS[network].label}</span>
        <span className="sm:hidden">{meta.short}</span>
        <svg viewBox="0 0 10 6" className={`w-2 h-2 transition-transform ${open ? "rotate-180" : ""}`} fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-50"
          style={{
            background: "rgba(6,12,28,0.97)",
            border: "1px solid rgba(0,212,255,0.22)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}>
          <div className="px-3.5 py-2.5 border-b" style={{ borderColor: "rgba(0,212,255,0.1)" }}>
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(0,212,255,0.45)" }}>
              Select network
            </p>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {(Object.keys(PHAROS_NETWORKS) as PharosNetworkId[]).map((id) => {
              const n = PHAROS_NETWORKS[id];
              const m = META[id];
              const active = id === network;
              return (
                <button key={id} onClick={() => choose(id)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-150"
                  style={{ background: active ? `${m.dot}10` : "transparent", border: `1px solid ${active ? `${m.dot}28` : "transparent"}` }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                  <span className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                    style={{ background: `${m.dot}14`, border: `1px solid ${m.dot}30` }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: m.dot, boxShadow: `0 0 8px ${m.dot}` }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-white leading-tight">{n.label}</span>
                    <span className="block text-[10px]" style={{ color: "rgba(148,163,184,0.5)" }}>
                      Chain ID {n.chainId} · {n.nativeSymbol}
                    </span>
                  </span>
                  {active && <span className="text-xs font-bold" style={{ color: m.dot }}>✓</span>}
                </button>
              );
            })}
          </div>
          <div className="px-3.5 py-2 border-t text-[10px]" style={{ borderColor: "rgba(255,255,255,0.05)", color: "rgba(148,163,184,0.45)" }}>
            DeFi actions (swap/bridge/LP) run on Mainnet only.
          </div>
        </div>
      )}
    </div>
  );
}
