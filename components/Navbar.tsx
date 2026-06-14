"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavbarProps {
  walletAddress?: string;
  balance?: string;
  isConnecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isWrongNetwork?: boolean;
  onSwitchNetwork?: () => void;
  stats?: { totalCount: number; favoriteToken?: string | null; favoriteChain?: string | null } | null;
}

function OrbLogo() {
  return (
    <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full" style={{ animation: "ringRotate 7s linear infinite", transformOrigin: "center", transformBox: "fill-box" }} viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="16" stroke="rgba(0,212,255,0.45)" strokeWidth="1.2" strokeDasharray="4 4" />
      </svg>
      <svg className="absolute inset-0 w-full h-full" style={{ animation: "ringRotateCCW 4.5s linear infinite", transformOrigin: "center", transformBox: "fill-box" }} viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="10" stroke="rgba(56,189,248,0.55)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
      <div className="w-7 h-7 rounded-[9px] flex items-center justify-center relative"
        style={{
          background: "linear-gradient(135deg, rgba(0,212,255,0.22) 0%, rgba(56,189,248,0.1) 100%)",
          border: "1px solid rgba(0,212,255,0.45)",
          boxShadow: "0 0 22px rgba(0,212,255,0.4), inset 0 0 12px rgba(0,212,255,0.1)",
        }}>
        <svg viewBox="0 0 18 18" className="w-3.5 h-3.5" fill="none">
          <circle cx="9" cy="9" r="3" fill="#00d4ff"
            style={{ animation: "orbPulseEl 3s ease-in-out infinite" }} />
          <circle cx="9" cy="9" r="6.5" stroke="#00d4ff" strokeWidth="0.7" opacity="0.35" />
        </svg>
      </div>
    </div>
  );
}

export default function Navbar({ walletAddress, balance, isConnecting, onConnect, onDisconnect, isWrongNetwork, onSwitchNetwork, stats }: NavbarProps) {
  const pathname = usePathname();

  const navLinks = [
    { label: "Chat",     href: "/chat"      },
    { label: "About",    href: "/#about"    },
    { label: "Features", href: "/#features" },
  ];

  return (
    <header className="relative z-30 sticky top-0"
      style={{
        background: "rgba(5,10,26,0.88)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderBottom: "1px solid rgba(0,212,255,0.14)",
        boxShadow: "0 1px 0 rgba(0,212,255,0.1), 0 4px 32px rgba(0,0,0,0.45)",
      }}>
      <div className="flex items-center justify-between px-5 py-3 max-w-6xl mx-auto gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <OrbLogo />
          <div>
            <span className="font-display text-[15px] font-bold text-white leading-none tracking-[-0.025em]"
              style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif", textShadow: "0 0 20px rgba(0,212,255,0.3)" }}>
              Pharos Agent
            </span>
            <p className="text-[10px] mt-0.5 font-medium" style={{ color: "rgba(0,212,255,0.45)" }}>
              AI DeFi Copilot
            </p>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {navLinks.map(({ label, href }) => {
            const active = pathname === href || (href === "/chat" && pathname.startsWith("/chat"));
            return (
              <Link
                key={label}
                href={href}
                className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                style={{
                  color: active ? "rgba(0,212,255,0.9)" : "rgba(148,163,184,0.7)",
                  background: active ? "rgba(0,212,255,0.08)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.85)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "rgba(148,163,184,0.7)";
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Wallet / CTA */}
        <div className="flex items-center gap-2.5 shrink-0">
          {walletAddress ? (
            <div className="flex items-center gap-2 shrink-0">
              {isWrongNetwork && onSwitchNetwork && (
                <button onClick={onSwitchNetwork}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs text-black transition-all duration-150 hover:scale-[1.03]"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)", boxShadow: "0 4px 14px rgba(245,158,11,0.35)" }}
                  title="Switch to Pharos network">
                  <span>⚠</span> Switch to Pharos
                </button>
              )}
              <div className="p-px rounded-xl"
                style={{ background: isWrongNetwork ? "linear-gradient(135deg, rgba(245,158,11,0.4), rgba(245,158,11,0.12))" : "linear-gradient(135deg, rgba(0,212,255,0.35), rgba(56,189,248,0.12))" }}>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(4,10,24,0.97)" }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: isWrongNetwork ? "#fbbf24" : "#34d399", boxShadow: isWrongNetwork ? "0 0 6px rgba(251,191,36,0.9)" : "0 0 6px rgba(52,211,153,0.9)" }} />
                  <span className="text-xs font-data font-medium text-gray-300 tracking-[-0.01em]">
                    {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                  </span>
                  <span className="w-px h-3 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
                  {isWrongNetwork ? (
                    <span className="text-xs font-data font-semibold" style={{ color: "#fbbf24" }}>Wrong network</span>
                  ) : (
                    <span className="text-xs font-data font-semibold" style={{ color: "#00d4ff" }}>
                      {balance} <span className="opacity-60">PROS</span>
                    </span>
                  )}
                  {onDisconnect && (
                    <>
                      <span className="w-px h-3 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
                      <button onClick={onDisconnect} title="Disconnect wallet" aria-label="Disconnect wallet"
                        className="shrink-0 flex items-center justify-center transition-colors"
                        style={{ color: "rgba(148,163,184,0.6)" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(248,113,113,0.95)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.6)")}>
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6M10.5 11l3-3-3-3M13.5 8H6" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : onConnect ? (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs text-black transition-all duration-200 disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #00d4ff, #38bdf8)",
                boxShadow: "0 4px 14px rgba(0,212,255,0.3)",
              }}
              onMouseEnter={(e) => {
                if (!isConnecting) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px) scale(1.03)";
              }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
            >
              {isConnecting ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="currentColor">
                  <path d="M12 4H2a.88.88 0 00-.88.88v3.5A.88.88 0 002 9.25h10a.88.88 0 00.88-.87v-3.5A.88.88 0 0012 4zM2.88 8.12V6.63A.88.88 0 012 5.75a.88.88 0 01.88-.88v3.25z"/>
                </svg>
              )}
              {isConnecting ? "Connecting…" : "Connect Wallet"}
            </button>
          ) : (
            <Link
              href="/chat"
              className="px-4 py-2 rounded-xl font-semibold text-xs text-black transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #00d4ff, #38bdf8)",
                boxShadow: "0 4px 14px rgba(0,212,255,0.3)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px) scale(1.03)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = ""; }}
            >
              Launch App →
            </Link>
          )}
        </div>
      </div>

      {/* Stats strip (chat page only) */}
      {stats && stats.totalCount > 0 && (
        <div className="flex items-center justify-center gap-2 px-5 pb-2.5 flex-wrap">
          <span className="text-[10px] px-2.5 py-1 rounded-full font-medium"
            style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.1)", color: "rgba(148,163,184,0.6)" }}>
            {stats.totalCount} txs completed
          </span>
          {stats.favoriteToken && (
            <span className="text-[10px] px-2.5 py-1 rounded-full font-medium"
              style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.1)", color: "rgba(148,163,184,0.6)" }}>
              ★ {stats.favoriteToken}
            </span>
          )}
        </div>
      )}
    </header>
  );
}
