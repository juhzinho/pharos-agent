"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { parseIntent, type ParsedIntent } from "@/lib/parser";
import { type GroqResult } from "@/lib/groq";
import { buildSwapBridge, formatReceiveAmount, resolveTokenAddressForChain, type QuoteResult } from "@/lib/lifi";
// resolveTokenAddressForChain is used in handleProviderChoice
import {
  buildLiquidityTx, buildApproveCalldata, FAROSWAP, FEE_TIERS,
  type LiquidityBuildResult, type LiquidityParams, type FeeTier,
} from "@/lib/liquidity";
import { fetchUserPositions, formatPositionSummary, type V3Position } from "@/lib/positions";
import { buildFaroSwapSwap, faroswapSupportsPair, type FaroSwapBuildResult } from "@/lib/faroswap";
import { BrowserProvider } from "ethers";
import { checkCcipSupport, buildCcipTransaction, type CcipTxData } from "@/lib/ccip";
import { checkCctpSupport, buildCctpTransaction, type CctpTxData } from "@/lib/cctp";
import {
  connectWallet,
  getBalance,
  sendTransaction,
  sendApproval,
  switchToChain,
  isWalletAvailable,
  getWalletName,
  silentReconnect,
  wasConnected,
  disconnectWallet,
  getCurrentChainId,
  ensurePharosNetwork,
  PHAROS_CHAIN_ID_HEX,
} from "@/lib/wallet";
import { TOKENS, type TokenSymbol } from "@/lib/tokens";
import { getStats, recordTransaction, getPrefsContext, type UserStats } from "@/lib/memory";
import { getTokenPrice, formatPriceBlock } from "@/lib/prices";
import Navbar from "@/components/Navbar";
import WaveBackground from "@/components/WaveBackground";
import GlassBackground from "@/components/GlassBackground";
import IntroOverlay from "@/components/IntroOverlay";

// ─── types ─────────────────────────────────────────────────────────────────

type MessageRole = "user" | "agent";

interface ApprovalData {
  tokenAddress: string;
  spender: string;
  amount: string;
}

interface PendingTx {
  provider: "lifi" | "ccip" | "faroswap" | "cctp";
  quote?: QuoteResult;
  ccip?: CcipTxData;
  cctpV2?: CctpTxData;
  faroswap?: FaroSwapBuildResult;
  intent: ParsedIntent;
  description: string;
  needsApproval: boolean;
  approvalData?: ApprovalData;
}

interface ProviderChoice {
  intent: ParsedIntent;
  ccipSupported: boolean;
  ccipNote?: string;
  cctpSupported: boolean;
  cctpNote?: string;
}

interface LiquidityPendingTx {
  result: LiquidityBuildResult;
}

// Swap route comparison: pre-built pending txs for each available provider,
// shown side by side so the user can pick the better quote.
interface SwapRouteOption {
  provider: "lifi" | "faroswap";
  pending: PendingTx;
  summary: string;
  receiveLabel: string;
}

interface SwapChoice {
  options: SwapRouteOption[];
}

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  pending?: PendingTx;
  liquidityPending?: LiquidityPendingTx;
  positions?: V3Position[];
  providerChoice?: ProviderChoice;
  swapChoice?: SwapChoice;
  txHash?: string;
  isLoading?: boolean;
  isSearching?: boolean;
  isError?: boolean;
  sources?: string[];
}

// ─── helpers ───────────────────────────────────────────────────────────────

const EXECUTION_CLAIM_RE =
  /\b(iniciada|enviada|feita|conclu[íi]da|realizada|processada|done|sent|completed|confirmed|executed|finalized)\b/i;

function sanitizeGroqReply(reply: string): string {
  if (EXECUTION_CLAIM_RE.test(reply)) {
    return "Ready! Choose a provider and confirm in your wallet to proceed.";
  }
  return reply;
}

function safeText(text: string): string {
  if (text.startsWith("{") && text.includes('"reply"')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.reply === "string" && parsed.reply) return parsed.reply;
    } catch { }
  }
  return text;
}

// Calls the server-side AI endpoint. All secret keys (AI cascade, embeddings,
// Tavily) stay on the server — the browser only sees the JSON result. Returns
// null on any failure so handleSend can fall back to the local parser.
type AgentResult = GroqResult & { grounded?: boolean };
async function callAgent(payload: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  prefsContext?: string;
  txContext?: string;
  search?: string;
  docs?: { target: string; query: string };
}): Promise<AgentResult | null> {
  try {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[pharos:agent] HTTP", res.status);
      return null;
    }
    const data = await res.json();
    if (!data || data.error || typeof data.reply !== "string") return null;
    return data as AgentResult;
  } catch (err) {
    console.warn("[pharos:agent] fetch failed:", err);
    return null;
  }
}

// Lightweight PT/EN guess from the most recent user message, used to localize
// non-AI UI follow-ups (e.g. the post-transaction confirmation).
function guessUserLang(msgs: Message[]): "pt" | "en" {
  const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.text ?? "";
  return /[ãõáéíóúâêôçà]|\b(quero|fazer|fa[çc]a|troca|troc(ar|a)|ponte|liquidez|obrigad[oa]|valeu|rede|carteira|para|pra|voc[êe]|conectar|dúvida|opera[çc][ãa]o|mais)\b/i.test(lastUser)
    ? "pt"
    : "en";
}

function buildChatHistory(
  msgs: Message[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return msgs
    .filter((m) => !m.isLoading && m.text && m.text !== "Thinking…")
    .slice(-10)
    .map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.text.slice(0, 500),
    }));
}

function groqToIntent(r: GroqResult): ParsedIntent {
  return {
    action: r.action as ParsedIntent["action"],
    fromToken: r.fromToken ?? "",
    toToken: r.toToken ?? r.fromToken ?? "",
    amount: r.amount ?? 0,
    amount2: r.amount2 ?? undefined,
    fromChain: r.fromChain || "Pharos",
    toChain: r.toChain ?? undefined,
    feeTier: r.feeTier ?? undefined,
    rangeMode: r.rangeMode ?? undefined,
    minPrice: r.minPrice ?? undefined,
    maxPrice: r.maxPrice ?? undefined,
    rangePercent: r.rangePercent ?? undefined,
  };
}

function looksLikeSwapBridge(text: string): boolean {
  const lower = text.toLowerCase();
  const hasAction = /\b(swap|bridge|troca|ponte|manda|envia|transfere)\b/.test(lower);
  const hasToken  = /\b(PROS|WPROS|USDC|WETH|LINK|PGOLD|USDpm)\b/i.test(text);
  const hasAmount = /\d/.test(text);
  return hasAction && hasToken && hasAmount;
}

function isCompleteIntent(r: GroqResult): boolean {
  if (r.action === "view_positions") return true;
  if (r.action === "add_liquidity") {
    const hasAmount =
      (r.amount != null && r.amount > 0) ||
      (r.amount2 != null && r.amount2 > 0);
    const hasFeeTier = r.feeTier != null;
    const hasRange =
      r.rangeMode === "full" ||
      (r.rangeMode === "percent" && r.rangePercent != null) ||
      (r.rangeMode === "price" && r.minPrice != null && r.maxPrice != null);
    return !r.needsAmount && hasAmount && hasFeeTier && !!hasRange;
  }
  const hasTokens = r.action === "bridge" ? !!r.fromToken : (!!r.fromToken && !!r.toToken);
  return (
    !!r.action &&
    hasTokens &&
    r.amount !== null &&
    !r.needsAmount &&
    !r.needsToken &&
    (r.action !== "bridge" || !!r.toChain)
  );
}

// ─── small atoms ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin align-middle shrink-0" />
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-[5px] py-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="block w-2 h-2 rounded-full"
          style={{
            background: "linear-gradient(135deg, #00d4ff, #38bdf8)",
            animation: `typingBounce 1.3s ease-in-out ${i * 0.2}s infinite`,
            boxShadow: "0 0 5px rgba(0,212,255,0.5)",
          }} />
      ))}
    </div>
  );
}

function SearchingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1">
      <svg viewBox="0 0 20 20" className="w-4 h-4 animate-spin shrink-0" fill="none" style={{ animationDuration: "1.6s" }}>
        <circle cx="8.5" cy="8.5" r="5.5" stroke="rgba(0,212,255,0.25)" strokeWidth="1.5" />
        <path d="M12.5 12.5l3 3" stroke="rgba(0,212,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="text-sm" style={{ color: "rgba(0,212,255,0.6)" }}>Searching…</span>
    </div>
  );
}

// ─── provider choice ───────────────────────────────────────────────────────

function ProviderChoiceButtons({ choice, onChoose }: { choice: ProviderChoice; onChoose: (p: "lifi" | "ccip" | "cctp") => void }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-3" style={{ color: "oklch(0.78 0.16 220 / 0.6)" }}>
        Choose bridge provider
      </p>
      <div className="flex gap-2.5 flex-wrap">
        <button onClick={() => onChoose("lifi")}
          className="glass-panel flex-1 min-w-[130px] flex flex-col gap-1.5 px-3.5 py-3 rounded-2xl text-left transition-all duration-200"
          style={{ borderColor: "rgba(99,102,241,0.32)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,102,241,0.6)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-deep), 0 0 24px rgba(99,102,241,0.25)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,102,241,0.32)";
            (e.currentTarget as HTMLButtonElement).style.transform = "";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
          }}>
          <span className="text-sm font-semibold text-white">Jumper (LI.FI)</span>
          <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.6)" }}>Best route aggregator · multi-chain</span>
        </button>

        <button onClick={() => choice.ccipSupported && onChoose("ccip")}
          disabled={!choice.ccipSupported} title={choice.ccipNote}
          className={`glass-panel flex-1 min-w-[130px] flex flex-col gap-1.5 px-3.5 py-3 rounded-2xl text-left transition-all duration-200 ${!choice.ccipSupported ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
          style={{ borderColor: choice.ccipSupported ? "rgba(245,158,11,0.32)" : "rgba(255,255,255,0.08)" }}
          onMouseEnter={(e) => {
            if (!choice.ccipSupported) return;
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,158,11,0.58)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-deep), 0 0 24px rgba(245,158,11,0.22)";
          }}
          onMouseLeave={(e) => {
            if (!choice.ccipSupported) return;
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,158,11,0.32)";
            (e.currentTarget as HTMLButtonElement).style.transform = "";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
          }}>
          <span className={`text-sm font-semibold ${choice.ccipSupported ? "text-white" : "text-gray-500"}`}>Chainlink CCIP</span>
          <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.6)" }}>
            {choice.ccipSupported ? "Secure cross-chain messaging" : (choice.ccipNote || "Unavailable for this route")}
          </span>
        </button>

        <button onClick={() => choice.cctpSupported && onChoose("cctp")}
          disabled={!choice.cctpSupported} title={choice.cctpNote}
          className={`glass-panel flex-1 min-w-[130px] flex flex-col gap-1.5 px-3.5 py-3 rounded-2xl text-left transition-all duration-200 ${!choice.cctpSupported ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
          style={{ borderColor: choice.cctpSupported ? "rgba(16,185,129,0.34)" : "rgba(255,255,255,0.08)" }}
          onMouseEnter={(e) => {
            if (!choice.cctpSupported) return;
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.6)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-deep), 0 0 24px rgba(16,185,129,0.25)";
          }}
          onMouseLeave={(e) => {
            if (!choice.cctpSupported) return;
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.34)";
            (e.currentTarget as HTMLButtonElement).style.transform = "";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
          }}>
          <span className={`text-sm font-semibold ${choice.cctpSupported ? "text-white" : "text-gray-500"}`}>Circle CCTP v2</span>
          <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.6)" }}>
            {choice.cctpSupported ? "Native USDC burn & mint · no aggregator fee" : (choice.cctpNote || "USDC from Pharos only")}
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── swap route choice ─────────────────────────────────────────────────────

const SWAP_ROUTE_META: Record<SwapRouteOption["provider"], { label: string; subtitle: string; accent: string }> = {
  lifi:     { label: "Jumper (LI.FI)",   subtitle: "aggregator · best route",       accent: "99,102,241" },
  faroswap: { label: "FaroSwap direct",  subtitle: "native DEX · no aggregator fee", accent: "16,185,129" },
};

function SwapChoiceButtons({ choice, onChoose }: { choice: SwapChoice; onChoose: (opt: SwapRouteOption) => void }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-3" style={{ color: "oklch(0.78 0.16 220 / 0.6)" }}>
        Choose swap route
      </p>
      <div className="flex gap-2.5 flex-wrap">
        {choice.options.map((opt) => {
          const meta = SWAP_ROUTE_META[opt.provider];
          return (
            <button key={opt.provider} onClick={() => onChoose(opt)}
              className="glass-panel flex-1 min-w-[150px] flex flex-col gap-1.5 px-3.5 py-3 rounded-2xl text-left transition-all duration-200 cursor-pointer"
              style={{ borderColor: `rgba(${meta.accent},0.3)` }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${meta.accent},0.6)`;
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `var(--shadow-deep), 0 0 24px rgba(${meta.accent},0.25)`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${meta.accent},0.3)`;
                (e.currentTarget as HTMLButtonElement).style.transform = "";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
              }}>
              <span className="text-sm font-semibold text-white">{meta.label}</span>
              <span className="text-base font-data font-semibold" style={{ color: `rgb(${meta.accent})`, textShadow: `0 0 16px rgba(${meta.accent},0.5)` }}>receive ~{opt.receiveLabel}</span>
              <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.6)" }}>{meta.subtitle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── tx button ─────────────────────────────────────────────────────────────

function TxButton({ pending, walletAddress, onSuccess, onError }: {
  pending: PendingTx; walletAddress: string; onSuccess: (hash: string) => void; onError: (msg: string) => void;
}) {
  const [step, setStep] = useState<"idle"|"switching"|"approving"|"signing"|"done">("idle");
  const fromChain = pending.intent.fromChain ?? "Pharos";

  async function handleSign() {
    const walletName = getWalletName();
    try {
      setStep("switching");
      await switchToChain(fromChain);
      if (pending.needsApproval && pending.approvalData) {
        setStep("approving");
        const { tokenAddress, spender, amount } = pending.approvalData;
        await sendApproval(tokenAddress, walletAddress, spender, amount);
      }
      setStep("signing");
      let hash: string;
      if (pending.provider === "ccip" && pending.ccip) {
        hash = await sendTransaction({ to: pending.ccip.routerAddress, data: pending.ccip.callData, value: pending.ccip.feeAmount, from: walletAddress });
      } else if (pending.provider === "cctp" && pending.cctpV2) {
        hash = await sendTransaction({ to: pending.cctpV2.to, data: pending.cctpV2.data, value: "0x0", from: walletAddress });
      } else if (pending.provider === "faroswap" && pending.faroswap) {
        hash = await sendTransaction({ ...pending.faroswap.txRequest, from: walletAddress });
      } else if (pending.provider === "lifi" && pending.quote) {
        hash = await sendTransaction({ ...pending.quote.transactionRequest, from: walletAddress });
      } else {
        throw new Error("Invalid transaction data");
      }
      setStep("done");
      onSuccess(hash);
    } catch (err: unknown) {
      setStep("idle");
      const msg = err instanceof Error ? err.message : String(err);
      const isRejected = /user rejected|user denied|rejected the request/i.test(msg);
      onError(isRejected ? "Transaction rejected by user." : msg);
    }
  }

  const walletLabel = getWalletName();
  const stepLabels = { idle: pending.needsApproval ? "Approve & Sign" : "Sign & Execute", switching: `Switching to ${fromChain}…`, approving: "Approving token…", signing: `Waiting for ${walletLabel}…`, done: "Done!" };
  const isIdle = step === "idle";
  const isDone = step === "done";

  return (
    <button onClick={handleSign} disabled={!isIdle}
      className="mt-4 w-full h-11 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200 relative overflow-hidden flex items-center justify-center gap-2"
      style={{
        background: isDone ? "linear-gradient(135deg, oklch(0.70 0.17 162), oklch(0.78 0.16 165))" : "linear-gradient(135deg, oklch(0.42 0.27 264) 0%, oklch(0.52 0.27 260) 55%, oklch(0.58 0.26 258) 100%)",
        boxShadow: isIdle ? "0 8px 24px -6px oklch(0.58 0.26 258 / 0.6), inset 0 1px 0 oklch(1 0 0 / 0.22)" : "none",
      }}
      onMouseEnter={(e) => { if (!isIdle) return; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}>
      {isIdle && <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.18) 50%,transparent 60%)", animation: "shimmer 3s ease-in-out infinite" }} />}
      {!isIdle && !isDone && <Spinner />}
      <span className="relative">{stepLabels[step]}</span>
      {isIdle && <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 relative shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>}
    </button>
  );
}

// ─── position cards ────────────────────────────────────────────────────────

function PositionCards({ positions }: { positions: V3Position[] }) {
  if (positions.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {positions.map((p) => {
        const hasLiq = p.liquidity > 0n;
        const hasFees = p.feesWPROS > 0 || p.feesUSDC > 0;
        const inRange = hasLiq && p.inRange;
        const sc = !hasLiq ? "rgba(100,116,139,0.8)" : inRange ? "#34d399" : "#fbbf24";
        const sb = !hasLiq ? "rgba(100,116,139,0.1)" : inRange ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)";
        const sl = !hasLiq ? "Closed" : inRange ? "In Range" : "Out of Range";
        return (
          <div key={String(p.tokenId)} className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "oklch(0.55 0.22 260 / 0.18)", background: "oklch(0.58 0.26 258 / 0.06)" }}>
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-1.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold z-10" style={{ background: "linear-gradient(135deg,#3b82f6,#60a5fa)", border: "1.5px solid rgba(6,13,31,0.9)" }}>W</div>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "linear-gradient(135deg,#10b981,#34d399)", border: "1.5px solid rgba(6,13,31,0.9)" }}>U</div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">WPROS / USDC</p>
                  <p className="text-[10px] font-data" style={{ color: "rgba(0,212,255,0.55)" }}>NFT #{String(p.tokenId)}</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ color: sc, background: sb, border: `1px solid ${sc}44` }}>{sl}</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-data">
                <span style={{ color: "rgba(100,116,139,0.8)" }}>Fee tier</span>
                <span className="text-right"><span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: "rgba(0,212,255,0.08)", color: "rgba(0,212,255,0.8)", border: "1px solid rgba(0,212,255,0.15)" }}>{(p.fee / 10000).toFixed(2)}%</span></span>
                <span style={{ color: "rgba(100,116,139,0.8)" }}>Tick range</span>
                <span className="text-right text-gray-300 text-[11px]">{p.tickLower} → {p.tickUpper}</span>
                {hasLiq && (<><span style={{ color: "rgba(100,116,139,0.8)" }}>WPROS</span><span className="text-right text-gray-200">{p.amount0WPROS.toFixed(6)}</span><span style={{ color: "rgba(100,116,139,0.8)" }}>USDC</span><span className="text-right text-gray-200">{p.amount1USDC.toFixed(6)}</span></>)}
              </div>
              {hasFees && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                  <span className="text-xs font-data" style={{ color: "rgba(251,191,36,0.7)" }}>Uncollected fees</span>
                  <span className="text-xs font-data font-semibold" style={{ color: "rgba(251,191,36,0.85)" }}>{p.feesWPROS.toFixed(6)} WPROS{p.feesUSDC > 0 ? ` + ${p.feesUSDC.toFixed(6)} USDC` : ""}</span>
                </div>
              )}
              <a href={`https://www.pharosscan.xyz/token/${FAROSWAP.NPM}?a=${String(p.tokenId)}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-medium transition-colors" style={{ color: "rgba(0,212,255,0.38)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.7)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.38)")}>
                View NFT on Pharosscan →
              </a>
            </div>
          </div>
        );
      })}
      {positions[0] && positions[0].currentPriceUSDC > 0 && (
        <p className="text-[10px] font-data text-right" style={{ color: "rgba(100,116,139,0.5)" }}>
          Pool price: ~{positions[0].currentPriceUSDC.toFixed(4)} USDC/WPROS
        </p>
      )}
    </div>
  );
}

// ─── liquidity tx button ───────────────────────────────────────────────────

function LiquidityTxButton({ liquidityPending, walletAddress, onSuccess, onError }: {
  liquidityPending: LiquidityPendingTx; walletAddress: string; onSuccess: (hash: string) => void; onError: (msg: string) => void;
}) {
  type Step = "idle"|"switching"|"approving_wpros"|"confirming_wpros"|"approving_usdc"|"confirming_usdc"|"minting"|"done";
  const [step, setStep] = useState<Step>("idle");
  const { result } = liquidityPending;
  const needsBoth = result.needsApproval0 && result.needsApproval1;
  const needsAny  = result.needsApproval0 || result.needsApproval1;
  const stepLabels: Record<Step, string> = {
    idle: needsAny ? "Approve & Add Liquidity" : "Add Liquidity",
    switching: "Switching to Pharos…",
    approving_wpros: needsBoth ? "Approving WPROS… (1/2)" : "Approving WPROS…",
    confirming_wpros: "Confirming WPROS approval…",
    approving_usdc: needsBoth ? "Approving USDC… (2/2)" : "Approving USDC…",
    confirming_usdc: "Confirming USDC approval…",
    minting: "Adding liquidity…",
    done: "Done!",
  };

  async function handleMint() {
    try {
      setStep("switching");
      await switchToChain("Pharos");
      const ethersProvider = new BrowserProvider(window.ethereum!);
      const signer = await ethersProvider.getSigner();
      if (result.needsApproval0) {
        setStep("approving_wpros");
        const approveData = buildApproveCalldata(FAROSWAP.NPM, result.wprosRaw);
        const tx0 = await signer.sendTransaction({ to: FAROSWAP.WPROS, data: approveData });
        setStep("confirming_wpros");
        await tx0.wait(1);
      }
      if (result.needsApproval1) {
        setStep("approving_usdc");
        const approveData = buildApproveCalldata(FAROSWAP.NPM, result.usdcRaw);
        const tx1 = await signer.sendTransaction({ to: FAROSWAP.USDC, data: approveData });
        setStep("confirming_usdc");
        await tx1.wait(1);
      }
      setStep("minting");
      const mintTx = await signer.sendTransaction({ to: FAROSWAP.NPM, data: result.mintCalldata, value: 0n });
      setStep("done");
      onSuccess(mintTx.hash);
    } catch (err: unknown) {
      setStep("idle");
      const msg = err instanceof Error ? err.message : String(err);
      const isRejected = /user rejected|user denied|rejected the request/i.test(msg);
      onError(isRejected ? "Transaction rejected by user." : msg);
    }
  }

  const isIdle = step === "idle";
  const isDone = step === "done";
  return (
    <button onClick={handleMint} disabled={!isIdle}
      className="mt-4 w-full h-11 px-6 rounded-xl font-semibold text-sm text-black transition-all duration-200 relative overflow-hidden flex items-center justify-center gap-2"
      style={{
        background: isDone ? "linear-gradient(135deg,#0ea5e9,#38bdf8)" : "linear-gradient(135deg,#10b981 0%,#34d399 50%,#059669 100%)",
        boxShadow: isIdle ? "0 4px 18px rgba(52,211,153,0.32), inset 0 1px 0 rgba(255,255,255,0.2)" : "none",
      }}
      onMouseEnter={(e) => { if (!isIdle) return; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}>
      {isIdle && <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.15) 50%,transparent 60%)", animation: "shimmer 3s ease-in-out infinite" }} />}
      {!isIdle && !isDone && <Spinner />}
      <span className="relative">{stepLabels[step]}</span>
    </button>
  );
}

// ─── liquidity panel ───────────────────────────────────────────────────────

function RangeBar({ currentPrice, minPrice, maxPrice }: { currentPrice: number; minPrice: number; maxPrice: number }) {
  const pct = Math.min(100, Math.max(0, ((currentPrice - minPrice) / (maxPrice - minPrice)) * 100));
  const inRange = currentPrice >= minPrice && currentPrice <= maxPrice;
  return (
    <div className="mt-2">
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(90deg,rgba(16,185,129,0.08),rgba(52,211,153,0.18),rgba(16,185,129,0.08))" }} />
        <div className="absolute top-0.5 bottom-0.5 w-0.5 rounded-full" style={{ left: `calc(${pct}% - 1px)`, background: inRange ? "linear-gradient(180deg,#34d399,#10b981)" : "linear-gradient(180deg,#fbbf24,#d97706)", boxShadow: inRange ? "0 0 5px rgba(52,211,153,0.8)" : "0 0 5px rgba(251,191,36,0.8)" }} />
      </div>
      <div className="flex justify-between items-center mt-1.5">
        <span className="text-[10px] font-data" style={{ color: "rgba(100,116,139,0.6)" }}>{minPrice.toFixed(4)}</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: inRange ? "rgba(52,211,153,0.9)" : "rgba(251,191,36,0.9)", background: inRange ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.08)", border: `1px solid ${inRange ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)"}` }}>{inRange ? "● In range" : "● Out of range"}</span>
        <span className="text-[10px] font-data" style={{ color: "rgba(100,116,139,0.6)" }}>{maxPrice.toFixed(4)}</span>
      </div>
    </div>
  );
}

function LiquidityPanel({ liquidityPending, walletAddress, onSuccess, onError }: {
  liquidityPending: LiquidityPendingTx; walletAddress: string; onSuccess: (hash: string) => void; onError: (msg: string) => void;
}) {
  const r = liquidityPending.result;
  const feeLabel = FEE_TIERS[r.feeTier as FeeTier]?.label ?? `${r.feeTier}`;
  const price    = r.poolState.priceUSDCperWPROS;
  const rangeLabel = r.rangeMode === "full" ? "Full range" : r.rangeMode === "percent" ? `±${r.rangePercent ?? ""}%` : "Custom range";
  const approvalParts = [r.needsApproval0 ? "WPROS" : "", r.needsApproval1 ? "USDC" : ""].filter(Boolean);

  return (
    <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: "rgba(6,12,28,0.8)", border: "1px solid rgba(0,212,255,0.12)", backdropFilter: "blur(16px)" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(0,212,255,0.08)", background: "rgba(0,212,255,0.03)" }}>
        <p className="text-xs font-semibold text-white">FaroSwap V3 — WPROS/USDC</p>
        <p className="text-[11px] mt-0.5 font-data" style={{ color: "rgba(0,212,255,0.5)" }}>{feeLabel} · {rangeLabel}</p>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-data">
          <span style={{ color: "rgba(100,116,139,0.75)" }}>Current price</span>
          <span className="text-right text-gray-300">{price.toFixed(4)} USDC/WPROS</span>
          <span style={{ color: "rgba(100,116,139,0.75)" }}>Min price</span>
          <span className="text-right text-gray-300">{r.minPrice.toFixed(4)}</span>
          <span style={{ color: "rgba(100,116,139,0.75)" }}>Max price</span>
          <span className="text-right text-gray-300">{r.maxPrice.toFixed(4)}</span>
          {r.wprosAmount > 0 && (<><span style={{ color: "rgba(100,116,139,0.75)" }}>WPROS</span><span className="text-right font-medium text-gray-200">{r.wprosAmount.toFixed(6)}</span></>)}
          {r.usdcAmount  > 0 && (<><span style={{ color: "rgba(100,116,139,0.75)" }}>USDC</span><span className="text-right font-medium text-gray-200">{r.usdcAmount.toFixed(6)}</span></>)}
        </div>
        {r.rangeMode !== "full" && <RangeBar currentPrice={price} minPrice={r.minPrice} maxPrice={r.maxPrice} />}
        {r.onlyToken0 && <p className="text-[11px] leading-relaxed" style={{ color: "rgba(251,191,36,0.7)" }}>↓ Price below range — position holds only WPROS until price enters range</p>}
        {r.onlyToken1 && <p className="text-[11px] leading-relaxed" style={{ color: "rgba(251,191,36,0.7)" }}>↑ Price above range — position holds only USDC until price enters range</p>}
        {approvalParts.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <span style={{ color: "rgba(245,158,11,0.8)" }} className="mt-0.5 shrink-0 text-sm">⚠</span>
            <span className="text-xs leading-relaxed" style={{ color: "rgba(245,158,11,0.7)" }}>Approvals needed: {approvalParts.join(" + ")}. Each requires a wallet confirmation.</span>
          </div>
        )}
      </div>
      <div className="px-4 pb-4">
        <LiquidityTxButton liquidityPending={liquidityPending} walletAddress={walletAddress} onSuccess={onSuccess} onError={onError} />
      </div>
    </div>
  );
}

// ─── markdown style constants ──────────────────────────────────────────────

const MD_SHADOW_HEADER = "0 1px 0 rgba(56,189,248,0.4), 0 2px 0 rgba(56,189,248,0.25), 0 3px 2px rgba(0,0,0,0.6), 0 0 12px rgba(0,212,255,0.25)";
const MD_SHADOW_BOLD   = "0 0 8px rgba(0,212,255,0.2), 0 1px 0 rgba(56,189,248,0.15)";
const MD_FONT_DISPLAY  = "var(--font-display), var(--font-inter), sans-serif";

// ─── chat bubble ───────────────────────────────────────────────────────────

function ChatBubble({ msg, walletAddress, onTxSuccess, onTxError, onProviderChoice, onSwapChoice }: {
  msg: Message; walletAddress: string;
  onTxSuccess: (id: string, hash: string) => void;
  onTxError: (id: string, err: string) => void;
  onProviderChoice: (id: string, intent: ParsedIntent, provider: "lifi" | "ccip" | "cctp") => void;
  onSwapChoice: (id: string, opt: SwapRouteOption) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-5 msg-enter`}>
      {/* Agent avatar */}
      {!isUser && (
        <div className="shrink-0 mr-3 mt-1">
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "radial-gradient(circle at 35% 35%, oklch(0.58 0.26 258 / 0.4), oklch(0.08 0.08 262 / 0.97))", border: "1px solid oklch(0.58 0.26 258 / 0.45)", boxShadow: "0 0 18px oklch(0.58 0.26 258 / 0.35)" }}>
            <svg viewBox="0 0 28 28" className="w-full h-full" fill="none">
              <circle cx="14" cy="14" r="4" fill="rgba(0,212,255,0.85)" style={{ animation: "orbPulseEl 3s ease-in-out infinite" }} />
              <circle cx="14" cy="14" r="9" stroke="rgba(0,212,255,0.15)" strokeWidth="0.7" />
            </svg>
          </div>
        </div>
      )}

      <div className={`${isUser ? "max-w-[72%]" : "max-w-[84%]"}`}>
        {/* Role label */}
        <p className={`text-[10px] font-medium mb-1.5 ${isUser ? "text-right" : "text-left"}`}
          style={{ color: isUser ? "rgba(0,212,255,0.45)" : "rgba(148,163,184,0.35)" }}>
          {isUser ? "You" : "Pharos Agent"}
        </p>

        <div className={`rounded-2xl text-sm leading-[1.65] ${isUser ? "rounded-br-sm" : "rounded-bl-sm"}`}
          style={isUser ? {
            background: "linear-gradient(135deg, oklch(0.36 0.28 264) 0%, oklch(0.48 0.27 261) 50%, oklch(0.58 0.26 258) 100%)",
            color: "oklch(0.99 0.005 240)",
            fontWeight: 500,
            padding: "11px 16px",
            border: "1px solid oklch(0.65 0.24 258 / 0.5)",
            boxShadow: "0 8px 30px -6px oklch(0.36 0.28 264 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.18)",
          } : msg.isError ? {
            background: "linear-gradient(135deg, oklch(0.22 0.12 25 / 0.6), oklch(0.13 0.08 20 / 0.4))",
            border: "1px solid oklch(0.62 0.24 25 / 0.32)",
            color: "oklch(0.82 0.13 25)",
            padding: "12px 16px",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
          } : {
            background: "linear-gradient(135deg, oklch(0.16 0.12 264 / 0.55), oklch(0.10 0.10 262 / 0.35))",
            border: "1px solid oklch(0.55 0.22 260 / 0.22)",
            color: "rgba(226,232,240,0.92)",
            padding: "12px 16px",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            boxShadow: "0 18px 50px -20px oklch(0.10 0.18 262 / 0.85), inset 0 1px 0 oklch(1 0 0 / 0.05)",
          }}>

          {msg.isLoading ? <TypingIndicator /> : msg.isSearching ? <SearchingIndicator /> : (
            <>
              {isUser ? (
                <p className="whitespace-pre-wrap">{safeText(msg.text)}</p>
              ) : (
                <div className="prose-pharos">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0 text-sm leading-[1.7]" style={{ color: "rgba(215,225,240,0.88)" }}>{children}</p>
                      ),
                      strong: ({ children }) => {
                        const txt = typeof children === "string" ? children : "";
                        const isLabel = txt.trim().endsWith(":");
                        return isLabel ? (
                          <strong style={{
                            display: "inline-block",
                            textTransform: "uppercase",
                            fontFamily: MD_FONT_DISPLAY,
                            fontWeight: 800,
                            fontSize: "0.78rem",
                            letterSpacing: "0.07em",
                            color: "#7dd3fc",
                            textShadow: MD_SHADOW_HEADER,
                          }}>{children}</strong>
                        ) : (
                          <strong style={{ fontWeight: 700, color: "rgba(255,255,255,0.97)", textShadow: MD_SHADOW_BOLD }}>{children}</strong>
                        );
                      },
                      em: ({ children }) => (
                        <em className="italic" style={{ color: "rgba(186,207,230,0.82)" }}>{children}</em>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-2.5 mt-1 space-y-1 list-none pl-0">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-2.5 mt-1 pl-5 space-y-1 list-decimal" style={{ color: "rgba(215,225,240,0.88)" }}>{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="flex items-start gap-2 text-sm leading-[1.65]" style={{ color: "rgba(215,225,240,0.88)" }}>
                          <span className="shrink-0 mt-[0.42em] w-[5px] h-[5px] rounded-full" style={{ background: "rgba(0,212,255,0.55)", boxShadow: "0 0 4px rgba(0,212,255,0.4)" }} />
                          <span>{children}</span>
                        </li>
                      ),
                      h1: ({ children }) => (
                        <h1 style={{
                          textTransform: "uppercase",
                          fontFamily: MD_FONT_DISPLAY,
                          fontWeight: 800,
                          fontSize: "1rem",
                          letterSpacing: "0.065em",
                          color: "#7dd3fc",
                          textShadow: MD_SHADOW_HEADER,
                          marginBottom: "0.5rem",
                          marginTop: "0.85rem",
                        }}>{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 style={{
                          textTransform: "uppercase",
                          fontFamily: MD_FONT_DISPLAY,
                          fontWeight: 800,
                          fontSize: "0.875rem",
                          letterSpacing: "0.06em",
                          color: "#7dd3fc",
                          textShadow: MD_SHADOW_HEADER,
                          marginBottom: "0.4rem",
                          marginTop: "0.75rem",
                        }}>{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 style={{
                          textTransform: "uppercase",
                          fontFamily: MD_FONT_DISPLAY,
                          fontWeight: 700,
                          fontSize: "0.8125rem",
                          letterSpacing: "0.055em",
                          color: "#93c5fd",
                          textShadow: MD_SHADOW_HEADER,
                          marginBottom: "0.3rem",
                          marginTop: "0.6rem",
                        }}>{children}</h3>
                      ),
                      code: ({ children }) => (
                        <code className="px-1.5 py-0.5 rounded text-[11px] font-mono"
                          style={{ background: "rgba(0,212,255,0.08)", color: "rgba(0,212,255,0.85)", border: "1px solid rgba(0,212,255,0.15)" }}>
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="my-2 px-3 py-2.5 rounded-xl overflow-x-auto text-[11px] font-mono"
                          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(200,215,230,0.88)" }}>
                          {children}
                        </pre>
                      ),
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                          className="underline underline-offset-2 transition-colors"
                          style={{ color: "rgba(0,212,255,0.75)" }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,1)")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.75)")}>
                          {children}
                        </a>
                      ),
                      hr: () => <hr className="my-3" style={{ borderColor: "rgba(255,255,255,0.06)" }} />,
                      blockquote: ({ children }) => (
                        <blockquote className="pl-3 my-2 italic"
                          style={{ borderLeft: "2px solid rgba(0,212,255,0.3)", color: "rgba(148,163,184,0.75)" }}>
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {safeText(msg.text)}
                  </ReactMarkdown>
                </div>
              )}

              {!isUser && msg.sources && msg.sources.length > 0 && (
                <p className="mt-2.5 pt-2 text-[10px] font-medium"
                  style={{ borderTop: "1px solid rgba(0,212,255,0.08)", color: "rgba(0,212,255,0.45)" }}>
                  📚 Fonte: {msg.sources.join(" · ")}
                </p>
              )}

              {msg.providerChoice && walletAddress && (
                <ProviderChoiceButtons choice={msg.providerChoice} onChoose={(provider) => onProviderChoice(msg.id, msg.providerChoice!.intent, provider)} />
              )}

              {msg.swapChoice && walletAddress && (
                <SwapChoiceButtons choice={msg.swapChoice} onChoose={(opt) => onSwapChoice(msg.id, opt)} />
              )}

              {msg.pending && walletAddress && (
                <div className="glass-panel mt-4 px-3.5 py-3 rounded-2xl" style={{ borderColor: "oklch(0.58 0.26 258 / 0.3)" }}>
                  <p className="text-[10px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color: "oklch(0.78 0.16 220 / 0.65)" }}>Ready to execute</p>
                  <p className="text-xs font-data leading-relaxed" style={{ color: "rgba(148,163,184,0.7)" }}>{msg.pending.description}</p>
                  <TxButton pending={msg.pending} walletAddress={walletAddress} onSuccess={(hash) => onTxSuccess(msg.id, hash)} onError={(err) => onTxError(msg.id, err)} />
                </div>
              )}

              {msg.liquidityPending && walletAddress && (
                <LiquidityPanel liquidityPending={msg.liquidityPending} walletAddress={walletAddress} onSuccess={(hash) => onTxSuccess(msg.id, hash)} onError={(err) => onTxError(msg.id, err)} />
              )}

              {msg.positions && <PositionCards positions={msg.positions} />}

              {msg.txHash && (
                <a href={`https://www.pharosscan.xyz/tx/${msg.txHash}`} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200 text-xs font-medium"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "rgba(52,211,153,0.88)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.13)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.08)"; }}>
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
                  <span>View on Pharosscan</span>
                  <span className="font-data text-[10px] opacity-55">{msg.txHash.slice(0, 8)}…</span>
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── suggestion chips ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: "Swap PROS", text: "swap 1 PROS to USDC",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 4h10M8 1.5l2.5 2.5L8 6.5M13 10H3M6 7.5L3.5 10 6 12.5" /></svg> },
  { label: "Bridge USDC", text: "bridge 10 USDC to Base",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 7h12M3 3l8 8M11 3L3 11" strokeOpacity="0.5"/><path d="M7 1v12"/></svg> },
  { label: "Add Liquidity", text: "add 5 WPROS to FaroSwap 0.30% fee ±10% range",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 1v12M1 7h12" /></svg> },
  { label: "My Positions", text: "show my liquidity positions",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1.5" y="4" width="11" height="8" rx="1.5"/><path d="M4 4V3a3 3 0 016 0v1"/></svg> },
  { label: "What is RWA?", text: "what is RWA and why does Pharos focus on it?",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="7" cy="7" r="6"/><path d="M7 6v4M7 4.5v.5"/></svg> },
  { label: "Pharos DApps", text: "what DeFi protocols are available on Pharos?",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 4h10v6H2zM5 4V2.5a2 2 0 014 0V4"/></svg> },
];

// ─── main chat page ────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      text: "Hi! I'm Pharos Agent — your AI DeFi copilot on Pharos Network.\n\nConnect your wallet and tell me what you'd like to do. I can swap tokens, bridge to other chains, add liquidity, show your positions, or answer any question about Pharos.\n\nExamples:\n• swap 0.5 PROS to USDC\n• bridge 100 USDC to Base\n• what is Faroo and how does liquid staking work?",
    },
  ]);
  const [input, setInput] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  const isWrongNetwork = !!walletAddress && !!chainId && chainId.toLowerCase() !== PHAROS_CHAIN_ID_HEX;
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 1;

  useEffect(() => {
    const s = getStats();
    setStats(s);
    if (s.totalCount > 0) {
      const fav = s.favoriteToken ? ` Your most-used token: ${s.favoriteToken}.` : "";
      setMessages([{
        id: "welcome", role: "agent",
        text: `Welcome back! You've completed ${s.totalCount} transaction${s.totalCount === 1 ? "" : "s"}.${fav}\n\nWhat would you like to do today?`,
      }]);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus the input: on first load, and again whenever the agent finishes
  // (isSending → false). Only fires on these transitions, so it never steals
  // focus while the user is scrolling or interacting with a card/button.
  useEffect(() => {
    if (!isSending) inputRef.current?.focus();
  }, [isSending]);

  useEffect(() => {
    if (!walletAddress) return;
    getBalance(walletAddress).then(setBalance);
    const iv = setInterval(() => getBalance(walletAddress).then(setBalance), 15000);
    return () => clearInterval(iv);
  }, [walletAddress]);

  // Persist connection across reloads: if the user connected before and the
  // wallet still authorizes us, silently re-attach (no prompt) and read the chain.
  useEffect(() => {
    if (!isWalletAvailable() || !wasConnected()) return;
    let cancelled = false;
    (async () => {
      const addr = await silentReconnect();
      if (cancelled || !addr) return;
      setWalletAddress(addr);
      getBalance(addr).then(setBalance);
      setChainId(await getCurrentChainId());
    })();
    return () => { cancelled = true; };
  }, []);

  // React to wallet account/chain changes so the UI stays in sync and the user
  // stays connected until they explicitly disconnect.
  useEffect(() => {
    if (!isWalletAvailable()) return;
    const eth = window.ethereum!;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts || accounts.length === 0) {
        disconnectWallet();
        setWalletAddress("");
        setBalance("0");
        setChainId(null);
      } else {
        setWalletAddress(accounts[0]);
        getBalance(accounts[0]).then(setBalance);
      }
    };
    const onChain = (...args: unknown[]) => setChainId(args[0] as string);
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener("accountsChanged", onAccounts);
      eth.removeListener("chainChanged", onChain);
    };
  }, []);

  function addMessage(msg: Omit<Message, "id">): string {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }

  function updateMessage(id: string, patch: Partial<Message>) {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
  }

  async function handleConnect() {
    if (!isWalletAvailable()) {
      addMessage({ role: "agent", text: "No wallet detected. Please install Rabby, MetaMask, or another EIP-1193 browser wallet and refresh.", isError: true });
      return;
    }
    setIsConnecting(true);
    try {
      const address = await connectWallet();
      setWalletAddress(address);
      const bal = await getBalance(address);
      setBalance(bal);
      setChainId(await getCurrentChainId());
      addMessage({ role: "agent", text: `Wallet connected: ${address}\n\nYou have ${bal} PROS. Ready to trade!` });
    } catch (err: unknown) {
      addMessage({ role: "agent", text: err instanceof Error ? err.message : "Failed to connect wallet.", isError: true });
    } finally {
      setIsConnecting(false);
    }
  }

  function handleDisconnect() {
    disconnectWallet();
    setWalletAddress("");
    setBalance("0");
    setChainId(null);
  }

  async function handleSwitchNetwork() {
    try {
      await ensurePharosNetwork();
      setChainId(await getCurrentChainId());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRejected = /user rejected|user denied|rejected the request/i.test(msg);
      addMessage({ role: "agent", text: isRejected ? "Você precisa aprovar a troca para a rede Pharos para continuar." : `Falha ao trocar de rede: ${msg}`, isError: true });
    }
  }

  async function buildLifiPending(intent: ParsedIntent): Promise<{ pending: PendingTx; summary: string; receiveLabel: string }> {
    const quote = await buildSwapBridge(intent, walletAddress);
    const receiveAmount = formatReceiveAmount(quote);
    const fromChain = intent.fromChain ?? "Pharos";
    const isSwap = intent.action === "swap";
    const description = isSwap
      ? `Swap ${intent.amount} ${intent.fromToken} → ~${receiveAmount} on ${fromChain}`
      : `Bridge ${intent.amount} ${intent.fromToken} → ~${receiveAmount} on ${intent.toChain}`;

    const pending: PendingTx = {
      provider: "lifi", quote, intent, description,
      needsApproval: false,
      approvalData: undefined,
    };
    const summary = isSwap
      ? `You'll receive approximately **${receiveAmount} ${intent.toToken}** via LI.FI.`
      : `You'll receive approximately **${receiveAmount}** on **${intent.toChain}** via LI.FI.`;
    return { pending, summary, receiveLabel: receiveAmount };
  }

  async function buildFaroswapPending(intent: ParsedIntent): Promise<{ pending: PendingTx; summary: string; receiveLabel: string }> {
    const result = await buildFaroSwapSwap(intent, walletAddress);
    const pending: PendingTx = {
      provider: "faroswap",
      faroswap: result,
      intent,
      description: result.description,
      needsApproval: result.needsApproval,
      approvalData: result.approvalData,
    };
    const summary =
      `You'll receive approximately **${result.expectedOut.toFixed(4)} ${result.outSymbol}** via FaroSwap direct (0.01% pool, min ${result.minOut.toFixed(4)} after 1% slippage).` +
      (result.needsApproval ? "\n\nToken approval needed first — two wallet confirmations." : "");
    return { pending, summary, receiveLabel: `${result.expectedOut.toFixed(4)} ${result.outSymbol}` };
  }

  async function buildCctpPending(intent: ParsedIntent): Promise<{ pending: PendingTx; summary: string }> {
    const cctpData = await buildCctpTransaction(intent, walletAddress);
    const pending: PendingTx = {
      provider: "cctp",
      cctpV2: cctpData,
      intent,
      description: cctpData.description,
      needsApproval: cctpData.needsApproval,
      approvalData: cctpData.approvalData,
    };
    const summary =
      `Bridge via **Circle CCTP v2**: ${intent.amount} USDC Pharos → ${intent.toChain}\n` +
      `Native burn & mint — you receive native USDC, fee capped at 0.1% (typically ~0.01%). ` +
      `Fast transfer: delivery is automatic, usually under a minute.` +
      (cctpData.needsApproval ? "\n\nUSDC approval needed first — two wallet confirmations." : "");
    return { pending, summary };
  }

  async function handleProviderChoice(id: string, intent: ParsedIntent, provider: "lifi" | "ccip" | "cctp") {
    const providerLabel = provider === "ccip" ? "Chainlink CCIP" : provider === "cctp" ? "Circle CCTP v2" : "Jumper (LI.FI)";
    updateMessage(id, { providerChoice: undefined, text: `Building ${providerLabel} transaction…`, isLoading: true });
    try {
      if (provider === "cctp") {
        const { pending, summary } = await buildCctpPending(intent);
        updateMessage(id, { isLoading: false, text: summary, pending });
      } else if (provider === "ccip") {
        const tokenAddress = resolveTokenAddressForChain(intent.fromToken, intent.fromChain ?? "Pharos");
        void tokenAddress; // token resolved for future approval checks
        const ccipData = await buildCcipTransaction(intent, walletAddress);
        const feeETH = (Number(ccipData.feeAmount) / 1e18).toFixed(6);
        updateMessage(id, {
          isLoading: false,
          text: `Bridge via Chainlink CCIP: ${intent.amount} ${intent.fromToken} → ${intent.toChain}\nCCIP fee: ~${feeETH} PROS`,
          pending: {
            provider: "ccip", ccip: ccipData, intent,
            description: `Bridge ${intent.amount} ${intent.fromToken} → ${intent.toChain} via CCIP`,
            needsApproval: false,
          },
        });
      } else {
        const { pending, summary } = await buildLifiPending(intent);
        updateMessage(id, { isLoading: false, text: summary, pending });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(id, { isLoading: false, isError: true, text: `Failed to build transaction: ${msg}` });
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setIsSending(true);

    addMessage({ role: "user", text });
    const history = buildChatHistory(messages);
    history.push({ role: "user", content: text });

    const thinkingId = addMessage({ role: "agent", text: "Thinking…", isLoading: true });

    try {
      const txContext = lastTxHash
        ? `sessionTx=signed,txHashPrefix=${lastTxHash.slice(0, 10)}`
        : "sessionTx=none";
      const prefsContext = getPrefsContext();

      // Intent parsing + web search + deep docs all run SERVER-SIDE via /api/agent
      // so API keys never reach the browser. Price (CoinGecko) and all tx-building
      // (LI.FI/FaroSwap/CCIP/CCTP/RPC) use public endpoints and stay client-side.
      const groqResult = await callAgent({ history, prefsContext, txContext });

      if (groqResult) {
        const complete = isCompleteIntent(groqResult);
        const ragSources = groqResult.foundInKnowledge ? groqResult.sources : undefined;

        if (!complete) {
          const effectiveQuery = groqResult.searchQuery || (groqResult.needsSearch ? text : null);

          if (!groqResult.action && groqResult.needsPrice) {
            updateMessage(thinkingId, { isLoading: false, isSearching: true });
            try {
              const price = await getTokenPrice(groqResult.needsPrice);
              const block = formatPriceBlock(groqResult.needsPrice, price);
              updateMessage(thinkingId, { isSearching: false, text: groqResult.reply + "\n\n" + block });
            } catch (priceErr) {
              const msg = priceErr instanceof Error ? priceErr.message : String(priceErr);
              console.warn("[pharos:price] fetch failed —", msg);
              updateMessage(thinkingId, {
                isSearching: false,
                text: groqResult.reply + "\n\n_Não consegui obter o preço agora / couldn't fetch the live price right now — tente em coingecko.com._",
              });
            }
          } else if (!groqResult.action && groqResult.needsDocs && groqResult.docsTarget && groqResult.docsQuery) {
            updateMessage(thinkingId, { isLoading: false, isSearching: true });
            const grounded = await callAgent({ history, prefsContext, txContext, docs: { target: groqResult.docsTarget, query: groqResult.docsQuery } });
            if (grounded && grounded.grounded) {
              updateMessage(thinkingId, { isSearching: false, text: grounded.reply, sources: grounded.foundInKnowledge ? grounded.sources : undefined });
            } else {
              updateMessage(thinkingId, { isSearching: false, text: groqResult.reply, sources: ragSources });
            }
          } else if (!groqResult.action && groqResult.needsSearch && effectiveQuery) {
            updateMessage(thinkingId, { isLoading: false, isSearching: true });
            const grounded = await callAgent({ history, prefsContext, txContext, search: effectiveQuery });
            if (grounded && grounded.grounded) {
              updateMessage(thinkingId, { isSearching: false, text: grounded.reply, sources: grounded.foundInKnowledge ? grounded.sources : undefined });
            } else {
              updateMessage(thinkingId, { isSearching: false, text: groqResult.reply, sources: ragSources });
            }
          } else {
            updateMessage(thinkingId, { isLoading: false, text: groqResult.reply, sources: ragSources });
          }
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

        const safeReply = sanitizeGroqReply(groqResult.reply);
        const intent    = groqToIntent(groqResult);

        // view_positions
        if (intent.action === "view_positions") {
          updateMessage(thinkingId, { text: safeReply + "\n\nFetching your FaroSwap V3 positions…" });
          try {
            const positions = await fetchUserPositions(walletAddress);
            const summary   = formatPositionSummary(positions);
            updateMessage(thinkingId, { isLoading: false, text: safeReply + "\n\n" + summary, positions });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            updateMessage(thinkingId, { isLoading: false, isError: true, text: `Failed to fetch positions: ${msg}` });
          }
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

        // add_liquidity
        if (intent.action === "add_liquidity") {
          updateMessage(thinkingId, { text: safeReply + "\n\nBuilding liquidity transaction…" });
          try {
            const liquidityParams: LiquidityParams = {
              feeTier:      intent.feeTier as FeeTier,
              rangeMode:    intent.rangeMode as LiquidityParams["rangeMode"],
              rangePercent: intent.rangePercent,
              minPrice:     intent.minPrice,
              maxPrice:     intent.maxPrice,
              wprosAmount:  intent.amount   > 0 ? intent.amount   : undefined,
              usdcAmount:   intent.amount2  != null && intent.amount2  > 0 ? intent.amount2  : undefined,
              userAddress:  walletAddress,
            };
            const liquidityResult = await buildLiquidityTx(liquidityParams);
            const { poolState, feeTier: ft, minPrice: lo, maxPrice: hi } = liquidityResult;
            const priceStr  = poolState.priceUSDCperWPROS.toFixed(4);
            const feeLabel  = FEE_TIERS[ft as FeeTier].label;
            const summaryText =
              `Current price: 1 WPROS = ${priceStr} USDC (~$${priceStr})\n` +
              `Fee tier: ${feeLabel}  ·  Range: ${lo.toFixed(4)} – ${hi.toFixed(4)} USDC/WPROS\n\n` +
              `WPROS required: ${liquidityResult.wprosAmount.toFixed(6)}\n` +
              `USDC required:  ${liquidityResult.usdcAmount.toFixed(6)}\n` +
              (liquidityResult.onlyToken0 ? "\nPrice is below range — only WPROS needed." : "") +
              (liquidityResult.onlyToken1 ? "\nPrice is above range — only USDC needed." : "") +
              `\n\nConfirm in your wallet to mint your LP position.`;
            updateMessage(thinkingId, { isLoading: false, text: safeReply + "\n\n" + summaryText, liquidityPending: { result: liquidityResult } });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            updateMessage(thinkingId, { isLoading: false, isError: true, text: `Failed to build liquidity tx: ${msg}` });
          }
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

        // bridge
        if (intent.action === "bridge") {
          const ccipCheck = checkCcipSupport(intent);
          const cctpCheck = checkCctpSupport(intent);
          if (groqResult.bridgeVia === "cctp" && cctpCheck.supported) {
            updateMessage(thinkingId, { text: safeReply + "\n\nBuilding Circle CCTP v2 transaction…" });
            const { pending, summary } = await buildCctpPending(intent);
            updateMessage(thinkingId, { isLoading: false, text: safeReply + "\n\n" + summary, pending });
            setIsSending(false);
            inputRef.current?.focus();
            return;
          }
          updateMessage(thinkingId, {
            isLoading: false,
            text: safeReply,
            providerChoice: {
              intent,
              ccipSupported: ccipCheck.supported, ccipNote: ccipCheck.reason,
              cctpSupported: cctpCheck.supported, cctpNote: cctpCheck.reason,
            },
          });
        } else {
          // swap — explicit provider goes direct; otherwise quote both routes
          // in parallel and let the user compare (FaroSwap only covers PROS/WPROS↔USDC).
          const pairOnFaroswap = faroswapSupportsPair(intent.fromToken, intent.toToken);
          if (groqResult.swapVia === "faroswap" && pairOnFaroswap) {
            updateMessage(thinkingId, { text: safeReply + "\n\nBuilding direct FaroSwap transaction…" });
            const { pending, summary } = await buildFaroswapPending(intent);
            updateMessage(thinkingId, { isLoading: false, text: safeReply + "\n\n" + summary, pending });
          } else if (groqResult.swapVia === "lifi" || !pairOnFaroswap) {
            updateMessage(thinkingId, { text: safeReply + "\n\nBuilding transaction with LI.FI…" });
            const { pending, summary } = await buildLifiPending(intent);
            updateMessage(thinkingId, { isLoading: false, text: safeReply + "\n\n" + summary, pending });
          } else {
            updateMessage(thinkingId, { text: safeReply + "\n\nFetching quotes from LI.FI and FaroSwap…" });
            const [lifiRes, faroRes] = await Promise.allSettled([
              buildLifiPending(intent),
              buildFaroswapPending(intent),
            ]);
            const options: SwapRouteOption[] = [];
            if (lifiRes.status === "fulfilled") options.push({ provider: "lifi", ...lifiRes.value });
            else console.warn("[pharos:swap] LI.FI quote failed:", lifiRes.reason);
            if (faroRes.status === "fulfilled") options.push({ provider: "faroswap", ...faroRes.value });
            else console.warn("[pharos:swap] FaroSwap quote failed:", faroRes.reason);

            if (options.length === 0) {
              const msg = lifiRes.status === "rejected" && lifiRes.reason instanceof Error ? lifiRes.reason.message : "no route available";
              updateMessage(thinkingId, { isLoading: false, isError: true, text: `Couldn't get a quote from either route: ${msg}` });
            } else if (options.length === 1) {
              const only = options[0];
              const note = only.provider === "faroswap"
                ? "LI.FI had no route, so I built this via **FaroSwap direct** instead.\n\n"
                : "";
              updateMessage(thinkingId, { isLoading: false, text: safeReply + "\n\n" + note + only.summary, pending: only.pending });
            } else {
              updateMessage(thinkingId, {
                isLoading: false,
                text: safeReply + "\n\nI got quotes from both routes — compare and pick one:",
                swapChoice: { options },
              });
            }
          }
        }
        setIsSending(false);
        inputRef.current?.focus();
        return;
      }

      // Groq fallback — local parser
      if (!looksLikeSwapBridge(text)) {
        updateMessage(thinkingId, {
          isLoading: false,
          text: "I'm having trouble connecting right now — please try again in a moment. I can help with swaps, bridges, liquidity, or any Pharos questions!",
        });
        setIsSending(false);
        inputRef.current?.focus();
        return;
      }

      const intent = parseIntent(text);
      if (intent.action === "bridge") {
        const ccipCheck = checkCcipSupport(intent);
        const cctpCheck = checkCctpSupport(intent);
        updateMessage(thinkingId, {
          isLoading: false,
          text: `Bridge ${intent.amount} ${intent.fromToken} from ${intent.fromChain ?? "Pharos"} → ${intent.toChain}. Choose your provider:`,
          providerChoice: {
            intent,
            ccipSupported: ccipCheck.supported, ccipNote: ccipCheck.reason,
            cctpSupported: cctpCheck.supported, cctpNote: cctpCheck.reason,
          },
        });
      } else {
        updateMessage(thinkingId, { text: "Building transaction with LI.FI…" });
        const { pending, summary } = await buildLifiPending(intent);
        updateMessage(thinkingId, { isLoading: false, text: summary, pending });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(thinkingId, { isLoading: false, isError: true, text: `Error: ${msg}` });
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function handleTxSuccess(id: string, hash: string) {
    setLastTxHash(hash);
    setMessages((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      if (m.pending && (m.pending.intent.action === "swap" || m.pending.intent.action === "bridge")) {
        recordTransaction(m.pending.intent.action, m.pending.intent.fromToken, m.pending.intent.toChain ?? undefined, m.pending.provider);
        setStats(getStats());
      }
      const successText = m.liquidityPending
        ? (() => {
            const r = m.liquidityPending.result;
            const feeLabel = FEE_TIERS[r.feeTier as FeeTier]?.label ?? "";
            const parts = [r.wprosAmount > 0 ? `${r.wprosAmount.toFixed(4)} WPROS` : "", r.usdcAmount > 0 ? `${r.usdcAmount.toFixed(4)} USDC` : ""].filter(Boolean).join(" + ");
            return `Liquidity added! ${parts} deposited into FaroSwap V3 ${feeLabel} pool. You received an LP NFT.`;
          })()
        : m.pending?.description ?? "Transaction sent!";
      return { ...m, pending: undefined, liquidityPending: undefined, text: successText, txHash: hash };
    }));
    getBalance(walletAddress).then(setBalance);

    // Conversational follow-up after success (NOT a new transaction).
    const lang = guessUserLang(messages);
    addMessage({
      role: "agent",
      text: lang === "pt"
        ? "✅ Transação confirmada com sucesso! Quer fazer mais alguma operação on-chain? Posso ajudar com swap, bridge, liquidez ou tirar dúvidas sobre a Pharos."
        : "✅ Transaction confirmed successfully! Want to do another on-chain operation? I can help with a swap, bridge, liquidity, or any questions about Pharos.",
    });
  }

  function handleSwapChoice(id: string, opt: SwapRouteOption) {
    setMessages((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      const intro = m.text.split("\n\nI got quotes from both routes")[0];
      return { ...m, swapChoice: undefined, text: intro + "\n\n" + opt.summary, pending: opt.pending };
    }));
  }

  function handleTxError(id: string, err: string) {
    addMessage({ role: "agent", text: `Transaction failed: ${err}`, isError: true });
    void id;
  }

  // ── auto-resize textarea ─────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen"
      style={{
        background: "radial-gradient(ellipse at 50% -10%, oklch(0.36 0.28 264 / 0.45) 0%, oklch(0.18 0.18 264 / 0.35) 40%, transparent 62%), radial-gradient(ellipse at top, oklch(0.18 0.18 264) 0%, oklch(0.06 0.06 262) 70%)",
      }}>

      {/* Intro brand reveal — once per session, purely visual */}
      <IntroOverlay />

      {/* Ambient + wave background — subtle, pointer-events-none */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <GlassBackground />
        <WaveBackground intensity="subtle" />
      </div>

      {/* Navbar */}
      <div className="relative z-30">
        <Navbar
          walletAddress={walletAddress}
          balance={balance}
          isConnecting={isConnecting}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          isWrongNetwork={isWrongNetwork}
          onSwitchNetwork={handleSwitchNetwork}
          stats={stats}
        />
      </div>

      {/* Wrong-network banner — blocks trading until on Pharos */}
      {isWrongNetwork && (
        <div className="relative z-20 px-4 pt-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl"
            style={{ background: "linear-gradient(135deg, oklch(0.30 0.14 60 / 0.5), oklch(0.16 0.10 40 / 0.4))", border: "1px solid oklch(0.70 0.17 60 / 0.4)", backdropFilter: "blur(20px)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg shrink-0">⚠️</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Conecte-se à rede Pharos</p>
                <p className="text-[11px]" style={{ color: "rgba(251,191,36,0.8)" }}>Sua carteira está em outra rede. Troque para a Pharos (Chain ID 1672) para negociar.</p>
              </div>
            </div>
            <button onClick={handleSwitchNetwork}
              className="shrink-0 px-4 py-2 rounded-xl font-semibold text-xs text-white transition-transform duration-150 hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, oklch(0.48 0.27 261), oklch(0.58 0.26 258))", boxShadow: "0 4px 16px -4px oklch(0.58 0.26 258 / 0.6)" }}>
              Trocar para Pharos
            </button>
          </div>
        </div>
      )}

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-3xl mx-auto px-4 py-6">

          {/* Empty state — large suggestions */}
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center pt-16 pb-8 text-center">
              <div className="animate-logo-tilt mb-6" style={{ transformStyle: "preserve-3d" }}>
                <div className="glass-panel w-24 h-24 rounded-3xl flex items-center justify-center"
                  style={{ boxShadow: "var(--shadow-glow)" }}>
                  <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="oklch(0.78 0.16 220 / 0.9)" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                  </svg>
                </div>
              </div>
              <h2 className="font-display font-bold text-white text-3xl mb-2 tracking-[-0.02em]"
                style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                Ask me anything
              </h2>
              <p className="text-sm mb-8" style={{ color: "rgba(148,163,184,0.55)" }}>
                Swap, bridge, liquidity, or any Pharos question
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              msg={msg}
              walletAddress={walletAddress}
              onTxSuccess={handleTxSuccess}
              onTxError={handleTxError}
              onProviderChoice={handleProviderChoice}
              onSwapChoice={handleSwapChoice}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input bar */}
      <div className="relative z-20 px-4 pt-3 pb-4"
        style={{
          background: "linear-gradient(180deg, oklch(0.10 0.10 262 / 0.6), oklch(0.07 0.07 262 / 0.92))",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          borderTop: "1px solid oklch(0.55 0.22 260 / 0.22)",
          boxShadow: "0 -1px 0 oklch(0.58 0.26 258 / 0.1), 0 -8px 32px oklch(0.05 0.05 262 / 0.5)",
        }}>
        <div className="max-w-3xl mx-auto">

          {/* Suggestion chips — always visible */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {SUGGESTIONS.map((s) => (
              <button key={s.text}
                onClick={() => { setInput(s.text); inputRef.current?.focus(); }}
                className="glass-panel flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
                style={{ color: "oklch(0.86 0.06 240 / 0.85)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(0.78 0.16 220 / 0.5)";
                  (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.85 0.14 220)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px) scale(1.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "";
                  (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.86 0.06 240 / 0.85)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "";
                }}>
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>

          {/* Input + send */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask me to swap, bridge, add liquidity, or anything about Pharos… (Shift+Enter for new line)"
                disabled={isSending}
                rows={1}
                className="glass-panel w-full px-4 py-3 rounded-2xl text-sm text-white outline-none transition-all duration-200 disabled:opacity-60 resize-none overflow-hidden"
                style={{
                  caretColor: "oklch(0.78 0.16 220)",
                  fontFamily: "var(--font-inter)",
                  lineHeight: "1.55",
                  minHeight: "52px",
                  maxHeight: "160px",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "oklch(0.58 0.26 258 / 0.55)";
                  e.currentTarget.style.boxShadow    = "0 0 0 3px oklch(0.58 0.26 258 / 0.12), var(--shadow-glow)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.boxShadow   = "";
                }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all duration-200 shrink-0"
              style={{
                background: "linear-gradient(135deg, oklch(0.48 0.27 261), oklch(0.58 0.26 258))",
                boxShadow: input.trim() && !isSending ? "0 6px 20px -4px oklch(0.58 0.26 258 / 0.55)" : "none",
                opacity: !input.trim() || isSending ? 0.35 : 1,
              }}
              onMouseEnter={(e) => {
                if (!input.trim() || isSending) return;
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px) scale(1.05)";
              }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
            >
              {isSending ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.903 6.557H13.5a.75.75 0 010 1.5H4.182l-1.903 6.557a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                </svg>
              )}
            </button>
          </div>

          <p className="mt-2 text-center text-[10px]" style={{ color: "rgba(71,85,105,0.45)" }}>
            Pharos Mainnet · Chain ID 1672 · Non-custodial · Your keys, your crypto
          </p>
        </div>
      </div>
    </div>
  );
}
