"use client";

import Link from "next/link";
import type { WalletOption } from "@/lib/wallet";
import { PHAROS_NETWORKS, type PharosNetworkId } from "@/lib/tokens";
import { t, useSiteLang } from "@/lib/i18n";

interface WalletPicker {
  options: WalletOption[];
  onChoose: (opt: WalletOption) => void;
  onClose: () => void;
}

interface ChatHeaderProps {
  walletAddress?: string;
  balance?: string;
  isConnecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isWrongNetwork?: boolean;
  onSwitchNetwork?: () => void;
  network: PharosNetworkId;
  walletPicker?: WalletPicker | null;
}

export default function ChatHeader({
  walletAddress, balance, isConnecting, onConnect, onDisconnect,
  isWrongNetwork, onSwitchNetwork, network, walletPicker,
}: ChatHeaderProps) {
  const [lang] = useSiteLang();

  return (
    <header className="relative z-20 shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/[0.06] chat-topbar">
      <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center chat-orb-mini">
          <img src="/pharos-logo.svg" alt="" className="w-5 h-5 opacity-90" />
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-bold text-white leading-none tracking-[-0.02em] font-display">ProsPilot</p>
          <p className="text-[10px] mt-0.5 text-[var(--text-dim)]">Pharos DeFi · Chain 1672</p>
        </div>
      </Link>

      <div className="flex-1" />

      {walletAddress ? (
        <div className="flex items-center gap-2">
          {isWrongNetwork && onSwitchNetwork && (
            <button onClick={onSwitchNetwork} className="btn-navy-warn text-xs px-3 py-1.5 rounded-lg font-semibold">
              {t("wallet.switch", lang)}
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl chat-wallet-pill">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isWrongNetwork ? "bg-amber-400" : "bg-emerald-400"}`} />
            <span className="text-xs font-data text-gray-300">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
            {!isWrongNetwork && balance && (
              <>
                <span className="w-px h-3 bg-white/10" />
                <span className="text-xs font-data font-semibold text-[var(--accent-soft)]">
                  {balance} {PHAROS_NETWORKS[network].nativeSymbol}
                </span>
              </>
            )}
            {onDisconnect && (
              <button onClick={onDisconnect} className="ml-1 text-gray-500 hover:text-red-400 transition-colors" aria-label="Disconnect">
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6M10.5 11l3-3-3-3M13.5 8H6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative">
          {onConnect && (
            <button onClick={onConnect} disabled={isConnecting} className="btn-primary text-xs px-4 py-2 rounded-xl">
              {isConnecting ? t("wallet.connecting", lang) : t("wallet.connect", lang)}
            </button>
          )}
          {walletPicker && walletPicker.options.length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-xl glass-panel p-2 z-50">
              {walletPicker.options.map((opt) => (
                <button key={opt.id}
                  onClick={() => { walletPicker.onChoose(opt); walletPicker.onClose(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-white hover:bg-white/5 transition-colors">
                  {opt.icon ? <img src={opt.icon} alt="" className="w-6 h-6 rounded-md" /> : null}
                  {opt.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
