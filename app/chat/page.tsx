"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseIntent, type ParsedIntent } from "@/lib/parser";
import { type GroqResult } from "@/lib/groq";
import { buildSwapBridge, formatReceiveAmount, resolveTokenAddressForChain, type QuoteResult } from "@/lib/lifi";
// resolveTokenAddressForChain is used in handleProviderChoice
import {
  buildLiquidityTx, buildApproveCalldata, buildRemoveLiquidityTx, preflightMint, ownerOfPosition, FAROSWAP, FEE_TIERS, readPoolState,
  type LiquidityBuildResult, type LiquidityParams, type FeeTier, type RemoveLiquidityBuildResult,
} from "@/lib/liquidity";
import { fetchUserPositions, formatPositionSummary, type V3Position } from "@/lib/positions";
import { buildFaroSwapSwap, faroswapSupportsPair, type FaroSwapBuildResult } from "@/lib/faroswap";
import { checkCcipSupport, buildCcipTransaction, type CcipTxData } from "@/lib/ccip";
import { checkCctpSupport, buildCctpTransaction, type CctpTxData } from "@/lib/cctp";
import {
  connectWallet,
  getBalance,
  sendTransaction,
  waitForTxSuccess,
  sendApproval,
  checkAllowance,
  getErc20Balance,
  switchToChain,
  walletErrorMessage,
  isWalletAvailable,
  getWalletName,
  silentReconnect,
  wasConnected,
  disconnectWallet,
  getRememberedProviderId,
  subscribeAllWalletProviders,
  providerIdFor,
  rememberConnection,
  setActiveProvider,
  getAuthorizedAccount,
  restoreRememberedProvider,
  type EIP1193Provider,
  getCurrentChainId,
  discoverWallets,
  getActiveProvider,
  getBrowserProvider,
  type WalletOption,
} from "@/lib/wallet";
import { TOKENS, type TokenSymbol } from "@/lib/tokens";
import { getSelectedNetwork, onNetworkChange } from "@/lib/network";
import { getStats, recordTransaction, getPrefsContext, updateLanguage, updateConversationStyle, type UserStats } from "@/lib/memory";
import { getTokenPrice, formatPriceBlock } from "@/lib/prices";
import { getWalletAnalysis, formatWalletAnalysis, getTokenBalancesFast } from "@/lib/walletAnalysis";
import { generateScript, type ScriptOperation, type ScriptLanguage } from "@/lib/scriptgen";
import { ECOSYSTEM_DAPPS, PHAROS_PARTNERS } from "@/lib/knowledge";
import { getPriceHistory, PROS_CEX_LINKS, type ChartRange, type PricePoint } from "@/lib/prices";
import { buildTransferTxs, buildApproveTx, type TransferBuild, type BuiltTx } from "@/lib/transfer";
import { explainTx, extractTxHash, formatTxExplanation } from "@/lib/txexplain";
import { getRealFiPositions, formatRealFiPositions } from "@/lib/realfi";
import { buildStakeTxs, buildUnstakeTxs, getStakedBalance, getFarooPosition, formatFarooPosition, getStakeNav, getWprosBalanceRaw, buildUnwrapData, MIN_STAKE_PROS, type StakeBuild } from "@/lib/staking";
import { estimateGasCost, formatGasCost } from "@/lib/gas";
import { newChatId, listChats, loadChat, saveChat, deleteChat, deriveTitle, type ChatListItem, type StoredMessage } from "@/lib/chat-history";
import { parseAlertCommand, addAlert, listAlerts, clearAlerts, checkAlerts, notifyTriggered, ensureNotifyPermission, formatAlerts } from "@/lib/price-alerts";
import { formatRwaMarket, type RwaMarketData } from "@/lib/rwa-live";
import type { WalletIntel } from "@/lib/walletIntel";
import { PHAROS_NETWORKS, type PharosNetworkId } from "@/lib/tokens";
import { t, chipT, useSiteLang } from "@/lib/i18n";
import { scanWalletAllowances, formatAllowanceReport } from "@/lib/allowance-skill";
import { formatTxHistory, type TxHistoryResult } from "@/lib/tx-history";
import Link from "next/link";
import ChatHeader from "@/components/ChatHeader";
import { SiteNavSidebar } from "@/components/SiteNavLinks";
import ChatBackground from "@/components/ChatBackground";
import AgentOrb from "@/components/AgentOrb";

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

interface RemoveLiquidityPendingTx {
  result: RemoveLiquidityBuildResult;
}

interface RemovePctPending {
  position: V3Position;
}

interface AmountQueryState {
  token: string;
  balance: number;
  chain: string;
  min?: number; // minimum accepted amount (e.g. Faroo stake minimum)
}

interface TokenChoiceState {
  action: "swap" | "bridge";
  fromChain: string;
  toChain?: string;
  commonPairs: Array<{ from: string; to: string; label: string }>;
}

interface ChainChoiceState {
  action: "bridge";
  fromChain: string;
  fromToken: string;
  availableChains: string[];
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

// Guided bridge flow: deterministic wizard (token w/ balances → amount → chain)
// followed by a route comparison with the best return highlighted.
interface BridgeWizardState {
  holdings: Array<{ symbol: string; balance: number }>;
  preToken?: string;
  preAmount?: number;
  preChain?: string;
}

interface BridgeRouteOption {
  provider: "lifi" | "ccip" | "cctp";
  pending: PendingTx;
  summary: string;
  receiveLabel: string;
  receiveValue: number;  // numeric estimate for best-route ranking
  note: string;
  best?: boolean;
}

interface BridgeChoice {
  options: BridgeRouteOption[];
  unavailable?: Array<{ provider: BridgeRouteOption["provider"]; reason: string }>;
}

// Guided swap flow: from-token (balances) → amount (% picks) → to-token.
interface SwapWizardState {
  holdings: Array<{ symbol: string; balance: number }>;
  preFrom?: string;
  preAmount?: number;
  preTo?: string;
}

// Guided liquidity flow: pair → fee tier → range → amount.
interface LiquidityWizardState {
  holdings: Array<{ symbol: string; balance: number }>;
  preAmount?: number;
  preFeeTier?: number;
  preRangePercent?: number;
}

// Guided transfer flow: token (PROS/WPROS/USDC) → amount → count → addresses.
interface TransferWizardState {
  balances: Record<string, number>;
  preToken?: string;
  preAmount?: number;
  preCount?: number;
}

const TRANSFER_WIZARD_TOKENS = ["PROS", "WPROS", "USDC"] as const;
const TRANSFER_GAS_BUFFER_PROS = 0.01;

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  pending?: PendingTx;
  liquidityPending?: LiquidityPendingTx;
  removeLiquidityPending?: RemoveLiquidityPendingTx;
  removePctPending?: RemovePctPending;
  positions?: V3Position[];
  providerChoice?: ProviderChoice;
  swapChoice?: SwapChoice;
  walletChoice?: WalletOption[];
  amountQuery?: AmountQueryState;  // For balance check before amount entry
  tokenChoice?: TokenChoiceState;  // For choosing swap/bridge tokens
  chainChoice?: ChainChoiceState;  // For choosing bridge destination
  bridgeWizard?: BridgeWizardState; // Guided bridge flow (token → amount → chain)
  bridgeChoice?: BridgeChoice;      // Bridge route comparison (best return marked)
  swapWizard?: SwapWizardState;         // Guided swap flow (from → amount → to)
  liquidityWizard?: LiquidityWizardState; // Guided liquidity flow (pair → fee → range → amount)
  transferWizard?: TransferWizardState;   // Guided transfer flow (token → amount → count → addresses)
  removeMode?: boolean;
  txHash?: string;
  transferPending?: TransferBuild;     // payment agent: 1..n txs to sign sequentially
  approvePending?: BuiltTx;            // ERC-20 approval to sign
  stakePending?: StakeBuild;           // Faroo liquid staking (stake/unstake) txs
  priceChart?: { symbol: string };     // interactive price chart card
  walletIntel?: WalletIntel;           // wallet score intelligence card
  isLoading?: boolean;
  isSearching?: boolean;
  isError?: boolean;
  sources?: string[];
}

// ─── helpers ───────────────────────────────────────────────────────────────

const WALLET_STATUS_ID = "wallet-status";

const LEGACY_WALLET_CONNECT_RE =
  /^(Connected|Conectado) .+:\s*0x[a-fA-F0-9]{40}/m;

function walletStatusText(
  walletName: string,
  address: string,
  bal: string,
  lang: "pt" | "en",
  switched: boolean,
): string {
  if (switched) {
    return lang === "pt"
      ? `Carteira atual: **${walletName}** — \`${address}\`\n\nSaldo: **${bal} PROS**. Pronto para operar!`
      : `Current wallet: **${walletName}** — \`${address}\`\n\nBalance: **${bal} PROS**. Ready to trade!`;
  }
  return lang === "pt"
    ? `Conectado **${walletName}**: ${address}\n\nVocê tem **${bal} PROS**. Pronto para operar!`
    : `Connected ${walletName}: ${address}\n\nYou have **${bal} PROS**. Ready to trade!`;
}

function isLegacyWalletConnectMsg(m: Pick<Message, "id" | "role" | "text">): boolean {
  return m.id !== WALLET_STATUS_ID && m.role === "agent" && LEGACY_WALLET_CONNECT_RE.test(m.text);
}

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

// ─── Deterministic dApp directory answer ───────────────────────────────────
// "What protocols/dApps are on Pharos?" is answered instantly from the local
// directory (lib/knowledge.ts) — no LLM, no web search, so it can never dangle.

const DAPP_LIST_SUBJECT_RE =
  /\b(protocols?|protocolos?|d?apps?|aplicativos?|projects?|projetos?|ecosystem|ecossistema)\b/i;
const DAPP_LIST_INTENT_RE =
  /\b(what|which|quais?|que|list|lista|liste|show|mostr[ae]|todos?|todas?|all|available|dispon[ií]ve|exist|tem n[ao]|there (is|are)|are (on|available|in)|s[ãa]o os)\b/i;

function isDappListQuestion(text: string): boolean {
  // Avoid hijacking questions about ONE specific protocol ("what is Morpho?").
  const mentionsSpecific =
    /\b(faroswap|bitverse|morpho|termmax|faroo|ember|zona|aquaflux|asseto|agra|r25|jumper|li\.?fi|layerzero|interport|circle|cctp|ccip|grandline|pharosverse|supra|goldsky|hemera|topnod|onekey|fordefi|anchorage|zellic|hypernative|openzeppelin)\b/i.test(text);
  return !mentionsSpecific && DAPP_LIST_SUBJECT_RE.test(text) && DAPP_LIST_INTENT_RE.test(text);
}

function buildDappListReply(lang: "pt" | "en"): string {
  const intro =
    lang === "pt"
      ? "Aqui está o ecossistema da Pharos — **42 projetos ativos** no diretório oficial:"
      : "Here's the Pharos ecosystem — **42 active projects** in the official directory:";
  const outro =
    lang === "pt"
      ? "\n📂 Diretório completo e sempre atualizado: [port.pharos.xyz/ecosystem](https://port.pharos.xyz/ecosystem)\n\n💡 Eu executo swaps na **Faroswap**, bridges via **LI.FI/Jumper, CCIP e CCTP**, e gerencio liquidez V3 na Faroswap — é só pedir!"
      : "\n📂 Full, always-updated directory: [port.pharos.xyz/ecosystem](https://port.pharos.xyz/ecosystem)\n\n💡 I can execute swaps on **Faroswap**, bridges via **LI.FI/Jumper, CCIP and CCTP**, and manage V3 liquidity on Faroswap — just ask!";
  const sections = Object.entries(ECOSYSTEM_DAPPS)
    .map(([category, dapps]) => {
      const rows = dapps
        .map((d) => `- **[${d.name}](${d.url})** — ${lang === "pt" ? d.descPt : d.desc}`)
        .join("\n");
      return `**${category}**\n${rows}`;
    })
    .join("\n\n");
  return `${intro}\n\n${sections}\n${outro}`;
}

// "Who are Pharos' partners/investors?" — also answered deterministically.
const PARTNER_QUESTION_RE =
  /\b(partners?|parceir[oa]s?|parcerias?|investors?|investidor(es)?|backers?|quem (investiu|apoia|financia)|who (invested|backs|funds)|funding|vc s?\b|venture)/i;

function isPartnerQuestion(text: string): boolean {
  if (!PARTNER_QUESTION_RE.test(text)) return false;
  // Don't hijack partner questions about a specific dApp ("Bitverse partners?").
  if (/\b(faroswap|bitverse|morpho|faroo|r25|zona|ember|aquaflux|agra|asseto)\b/i.test(text)) return false;
  // Must be about Pharos/the network (explicitly or implicitly: "dele", "da rede").
  return /\bpharos\b|\b(rede|network|chain|dele|dela|deles)\b/i.test(text);
}

function buildPartnersReply(lang: "pt" | "en"): string {
  const seedLeads = PHAROS_PARTNERS.seedLeads.join(" + ");
  const seed = PHAROS_PARTNERS.seedInvestors.map((p) => `- ${p}`).join("\n");
  const seriesA = PHAROS_PARTNERS.seriesAInvestors.map((p) => `- ${p}`).join("\n");
  if (lang === "pt") {
    return (
      `Estes são os **parceiros e investidores oficiais da Pharos Network** (total captado: **$52M**):\n\n` +
      `**Seed Round — $8M (novembro 2024)**\nCo-liderado por **${seedLeads}**, com participação de:\n${seed}\n\n` +
      `**Series A — $44M (2026)**\nCo-liderado por fundos de private equity asiáticos de ponta, uma empresa listada de energia renovável e uma instituição financeira regulada de Hong Kong. Investidores estratégicos:\n${seriesA}\n\n` +
      `🎯 Objetivo: expandir a infraestrutura RWA na Ásia e globalmente — trazer **$50 trilhões** em ativos tradicionais e digitais para on-chain.\n\n` +
      `📂 Veja os parceiros no site oficial: [port.pharos.xyz/ecosystem#partners](https://port.pharos.xyz/ecosystem#partners)`
    );
  }
  return (
    `These are the **official partners and investors of Pharos Network** (total raised: **$52M**):\n\n` +
    `**Seed Round — $8M (November 2024)**\nCo-led by **${seedLeads}**, with participation from:\n${seed}\n\n` +
    `**Series A — $44M (2026)**\nCo-led by top Asian private equity funds, a listed renewable-energy company, and a Hong Kong-regulated financial institution. Strategic investors:\n${seriesA}\n\n` +
    `🎯 Goal: expand RWA infrastructure across Asia and globally — bringing **$50 trillion** in traditional + digital assets on-chain.\n\n` +
    `📂 See the partners on the official site: [port.pharos.xyz/ecosystem#partners](https://port.pharos.xyz/ecosystem#partners)`
  );
}

// ─── Live campaigns + news (deterministic, fetched from our API routes) ─────

const CAMPAIGN_QUESTION_RE =
  /\b(campanhas?|campaigns?|quests?|eventos? ativ|active events?|atividades ativ|airdrops? ativ|rewards? (ativ|dispon)|o que (ta|tá|está) rolando|what'?s (happening|live|running))\b/i;
const NEWS_QUESTION_RE =
  /\b(not[íi]cias?|news|novidades?|latest (from|on) pharos|[úu]ltimas (da|de|do) pharos|feed de not|what'?s new)\b/i;
const TWEET_QUESTION_RE =
  /\b(tweets?|twitter|x\.com|@\s*pharos|pharos_network|postou no x|posted on (x|twitter)|o que (a |)pharos postou|what did pharos post)\b/i;

async function fetchCampaignsReply(lang: "pt" | "en"): Promise<string> {
  try {
    const res = await fetch("/api/campaigns");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const campaigns: Array<{ name: string; startTime: string; endTime: string; url: string; kind: string }> = j.campaigns ?? [];
    if (campaigns.length === 0) throw new Error("empty");
    const fmt = (iso: string) => {
      if (!iso) return "?";
      return new Date(iso).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", { month: "short", day: "numeric" });
    };
    const now = Date.now();
    const rows = campaigns.map((c) => {
      const ended = c.endTime && new Date(c.endTime).getTime() < now;
      const daysLeft = c.endTime ? Math.max(0, Math.ceil((new Date(c.endTime).getTime() - now) / 86400000)) : null;
      const status = ended
        ? lang === "pt" ? "encerrada" : "ended"
        : daysLeft != null
          ? lang === "pt" ? `${daysLeft}d restantes` : `${daysLeft}d left`
          : "";
      const name = c.name.replace(/\b\w/g, (ch) => ch.toUpperCase());
      return `- **[${name}](${c.url})** · ${fmt(c.startTime)} → ${fmt(c.endTime)}${status ? ` · _${status}_` : ""}`;
    });
    const intro = lang === "pt"
      ? "📡 **Campanhas ativas na Pharos** (direto da API oficial do Port):"
      : "📡 **Active Pharos campaigns** (live from the official Port API):";
    const outro = lang === "pt"
      ? "\n\nAcompanhe tudo em [port.pharos.xyz](https://port.pharos.xyz/)"
      : "\n\nTrack everything at [port.pharos.xyz](https://port.pharos.xyz/)";
    return `${intro}\n\n${rows.join("\n")}${outro}`;
  } catch {
    return lang === "pt"
      ? "Não consegui carregar as campanhas ao vivo agora. Veja diretamente em [port.pharos.xyz](https://port.pharos.xyz/) — em julho de 2026 estão rolando: **Agent Carnival** (até 26/jul), **Anvita Cyber Cup** (até 19/jul), **TopNod Cup** (até 20/jul) e **AquaFlux Campaign** (até 31/jul)."
      : "Couldn't load live campaigns right now. Check [port.pharos.xyz](https://port.pharos.xyz/) directly — as of July 2026: **Agent Carnival** (until Jul 26), **Anvita Cyber Cup** (until Jul 19), **TopNod Cup** (until Jul 20) and **AquaFlux Campaign** (until Jul 31).";
  }
}

async function fetchTweetsReply(lang: "pt" | "en"): Promise<string> {
  try {
    const res = await fetch("/api/tweets");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const tweets: Array<{ text: string; createdAt: string; url: string; isRetweet: boolean }> = j.tweets ?? [];
    if (tweets.length === 0) throw new Error("empty");
    const fmtDate = (iso: string) => {
      if (!iso) return "";
      const d = new Date(iso);
      return d.toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", { month: "short", day: "numeric", year: "numeric" });
    };
    const rows = tweets.slice(0, 8).map((t, i) => {
      const rt = t.isRetweet ? (lang === "pt" ? " (RT)" : " (RT)") : "";
      const snippet = t.text.replace(/\n+/g, " ").slice(0, 220);
      return `${i + 1}. **[${fmtDate(t.createdAt)}]${rt}** ${snippet}${t.text.length > 220 ? "…" : ""}\n   → [${lang === "pt" ? "ver post" : "view post"}](${t.url})`;
    });
    const stale = j.stale ? (lang === "pt" ? "\n\n_⚠️ Feed em cache — pode haver posts mais novos em [x.com/pharos_network](https://x.com/pharos_network)_" : "\n\n_⚠️ Cached feed — newer posts may exist at [x.com/pharos_network](https://x.com/pharos_network)_") : "";
    const intro = lang === "pt"
      ? "🐦 **Posts recentes de @pharos_network** (ao vivo via X):"
      : "🐦 **Recent posts from @pharos_network** (live from X):";
    const outro = lang === "pt"
      ? `\n\nTodos em [x.com/pharos_network](https://x.com/pharos_network) · timeline completa em [pharos-agent/news](https://pharos-agent-pi.vercel.app/news)`
      : `\n\nFollow [x.com/pharos_network](https://x.com/pharos_network) · full timeline at [pharos-agent/news](https://pharos-agent-pi.vercel.app/news)`;
    return `${intro}\n\n${rows.join("\n\n")}${outro}${stale}`;
  } catch {
    return lang === "pt"
      ? "Não consegui carregar os tweets ao vivo agora. Veja diretamente: [x.com/pharos_network](https://x.com/pharos_network)"
      : "Couldn't load live tweets right now. Check directly: [x.com/pharos_network](https://x.com/pharos_network)";
  }
}

async function fetchNewsReply(lang: "pt" | "en"): Promise<string> {
  try {
    const res = await fetch("/api/news");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const items: Array<{ title: string; date: string; kind: string }> = j.items ?? [];
    if (items.length === 0) throw new Error("empty");
    const rows = items.slice(0, 10).map((n) => `- **${n.title}** · _${n.date}_${n.kind === "blog" ? " (blog)" : ""}`);
    const intro = lang === "pt"
      ? "📰 **Últimas notícias da Pharos** (ao vivo de pharos.xyz/resources):"
      : "📰 **Latest Pharos news** (live from pharos.xyz/resources):";
    const outro = lang === "pt"
      ? "\n\nTodas as notícias: [pharos.xyz/resources](https://www.pharos.xyz/resources)"
      : "\n\nAll news: [pharos.xyz/resources](https://www.pharos.xyz/resources)";
    return `${intro}\n\n${rows.join("\n")}${outro}`;
  } catch {
    return lang === "pt"
      ? "Não consegui carregar o feed ao vivo agora, mas as manchetes mais recentes que conheço:\n\n- **Faroo incubada a valuation de $10M + RWA Hybrid Vault** · _Jul 2, 2026_\n- **PROS Never Sleeps: Alpha Summer começou** · _Jun 10, 2026_\n- **Pacific Ocean Mainnet + USDC/CCTP ao vivo** · _Apr 28, 2026_\n- **Series A de $44M (total $52M)** · _Apr 8, 2026_\n\nTudo em [pharos.xyz/resources](https://www.pharos.xyz/resources)"
      : "Couldn't load the live feed right now, but the latest headlines I know:\n\n- **Faroo incubated at $10M valuation + RWA Hybrid Vault** · _Jul 2, 2026_\n- **PROS Never Sleeps: Alpha Summer begins** · _Jun 10, 2026_\n- **Pacific Ocean Mainnet + USDC/CCTP live** · _Apr 28, 2026_\n- **$44M Series A (total $52M)** · _Apr 8, 2026_\n\nEverything at [pharos.xyz/resources](https://www.pharos.xyz/resources)";
  }
}

// Replies where the model *promises* content ("um momento…") — these must never
// be shown as the final answer.
const DANGLING_PROMISE_RE =
  /um momento|vou procurar|vou buscar|vou verificar|deixe-me|let me (check|search|look)|one moment|searching for|procurando/i;

// Runs a grounded search with one retry. If both attempts fail and the model's
// original reply was just a promise ("vou buscar… um momento"), replaces it with
// an honest fallback instead of leaving the user with no content.
async function searchWithFallback(
  query: string,
  originalReply: string,
  base: {
    history: Array<{ role: "user" | "assistant"; content: string }>;
    prefsContext?: string;
    txContext?: string;
  },
  lang: "pt" | "en",
): Promise<{ text: string; sources?: AgentResult["sources"] }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const grounded = await callAgent({ ...base, search: query });
    if (grounded && grounded.grounded) {
      return { text: grounded.reply, sources: grounded.foundInKnowledge ? grounded.sources : undefined };
    }
  }
  if (DANGLING_PROMISE_RE.test(originalReply)) {
    return {
      text:
        lang === "pt"
          ? "Não consegui completar a busca agora (o serviço de pesquisa está indisponível). Tente perguntar de novo em alguns segundos — ou veja diretamente:\n\n- [port.pharos.xyz/ecosystem](https://port.pharos.xyz/ecosystem) — todos os dApps da Pharos\n- [docs.pharos.xyz](https://docs.pharos.xyz) — documentação oficial"
          : "I couldn't complete the search right now (the search service is unavailable). Try asking again in a few seconds — or check directly:\n\n- [port.pharos.xyz/ecosystem](https://port.pharos.xyz/ecosystem) — all Pharos dApps\n- [docs.pharos.xyz](https://docs.pharos.xyz) — official documentation",
    };
  }
  return { text: originalReply };
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
  if (r.action === "view_positions" || r.action === "view_wallet" || r.action === "remove_liquidity") return true;
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
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-3" style={{ color: "rgba(0,212,255,0.45)" }}>
        Choose bridge provider
      </p>
      <div className="flex gap-2.5 flex-wrap">
        <button onClick={() => onChoose("lifi")}
          className="flex-1 min-w-[130px] flex flex-col gap-1.5 px-3.5 py-3 rounded-xl text-left transition-all duration-200"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(99,102,241,0.2)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.08)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,102,241,0.4)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,102,241,0.2)";
            (e.currentTarget as HTMLButtonElement).style.transform = "";
          }}>
          <span className="text-sm font-semibold text-white">Jumper (LI.FI)</span>
          <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.55)" }}>Best route aggregator · multi-chain</span>
        </button>

        <button onClick={() => choice.ccipSupported && onChoose("ccip")}
          disabled={!choice.ccipSupported} title={choice.ccipNote}
          className={`flex-1 min-w-[130px] flex flex-col gap-1.5 px-3.5 py-3 rounded-xl text-left transition-all duration-200 ${!choice.ccipSupported ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${choice.ccipSupported ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)"}` }}
          onMouseEnter={(e) => {
            if (!choice.ccipSupported) return;
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.07)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,158,11,0.38)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            if (!choice.ccipSupported) return;
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,158,11,0.2)";
            (e.currentTarget as HTMLButtonElement).style.transform = "";
          }}>
          <span className={`text-sm font-semibold ${choice.ccipSupported ? "text-white" : "text-gray-500"}`}>Chainlink CCIP</span>
          <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.55)" }}>
            {choice.ccipSupported ? "Secure cross-chain messaging" : (choice.ccipNote || "Unavailable for this route")}
          </span>
        </button>

        <button onClick={() => choice.cctpSupported && onChoose("cctp")}
          disabled={!choice.cctpSupported} title={choice.cctpNote}
          className={`flex-1 min-w-[130px] flex flex-col gap-1.5 px-3.5 py-3 rounded-xl text-left transition-all duration-200 ${!choice.cctpSupported ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${choice.cctpSupported ? "rgba(16,185,129,0.22)" : "rgba(255,255,255,0.05)"}` }}
          onMouseEnter={(e) => {
            if (!choice.cctpSupported) return;
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.07)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.4)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            if (!choice.cctpSupported) return;
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.22)";
            (e.currentTarget as HTMLButtonElement).style.transform = "";
          }}>
          <span className={`text-sm font-semibold ${choice.cctpSupported ? "text-white" : "text-gray-500"}`}>Circle CCTP v2</span>
          <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.55)" }}>
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
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-3" style={{ color: "rgba(0,212,255,0.45)" }}>
        Choose swap route
      </p>
      <div className="flex gap-2.5 flex-wrap">
        {choice.options.map((opt) => {
          const meta = SWAP_ROUTE_META[opt.provider];
          return (
            <button key={opt.provider} onClick={() => onChoose(opt)}
              className="flex-1 min-w-[150px] flex flex-col gap-1.5 px-3.5 py-3 rounded-xl text-left transition-all duration-200 cursor-pointer"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(${meta.accent},0.22)` }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = `rgba(${meta.accent},0.08)`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${meta.accent},0.42)`;
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${meta.accent},0.22)`;
                (e.currentTarget as HTMLButtonElement).style.transform = "";
              }}>
              <span className="text-sm font-semibold text-white">{meta.label}</span>
              <span className="text-sm font-data font-semibold" style={{ color: `rgb(${meta.accent})` }}>receive ~{opt.receiveLabel}</span>
              <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.55)" }}>{meta.subtitle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── bridge wizard (token → amount → destination) ───────────────────────────

const BRIDGE_DEST_CHAINS = ["Ethereum", "Base", "Arbitrum", "Polygon", "Optimism"] as const;
const BRIDGE_GAS_BUFFER_PROS = 0.01;

function BridgeWizardCard({ state, lang, onSubmit }: {
  state: BridgeWizardState;
  lang: "pt" | "en";
  onSubmit: (token: string, amount: number, toChain: string) => void;
}) {
  const [token, setToken] = useState<string | null>(state.preToken ?? null);
  const [amountStr, setAmountStr] = useState(state.preAmount != null && state.preAmount > 0 ? String(state.preAmount) : "");
  const [toChain, setToChain] = useState<string | null>(state.preChain ?? null);

  const selected = state.holdings.find((h) => h.symbol === token);
  const maxAmount = selected
    ? (selected.symbol === "PROS" ? Math.max(0, selected.balance - BRIDGE_GAS_BUFFER_PROS) : selected.balance)
    : 0;
  const amount = parseFloat(amountStr.replace(",", "."));
  const amountOk = Number.isFinite(amount) && amount > 0 && amount <= maxAmount + 1e-9;
  const ready = !!token && amountOk && !!toChain;

  const t = lang === "pt"
    ? { step1: "1 · Escolha o token", step2: "2 · Quanto?", step3: "3 · Rede de destino", max: "disponível", insufficient: "Valor maior que o saldo disponível", submit: "Comparar rotas de bridge →", empty: "Nenhum token com saldo na carteira. Deposite fundos primeiro." }
    : { step1: "1 · Pick a token", step2: "2 · How much?", step3: "3 · Destination chain", max: "available", insufficient: "Amount exceeds available balance", submit: "Compare bridge routes →", empty: "No tokens with balance in this wallet. Fund it first." };

  const withBalance = state.holdings.filter((h) => h.balance > 0);

  return (
    <div className="mt-3 px-4 py-4 rounded-2xl space-y-4"
      style={{ background: "rgba(7,14,30,0.9)", border: "1px solid rgba(129,140,248,0.22)", backdropFilter: "blur(16px)" }}>
      {/* Step 1 — token with balances */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(129,140,248,0.6)" }}>{t.step1}</p>
        {withBalance.length === 0 ? (
          <p className="text-xs" style={{ color: "rgba(251,191,36,0.8)" }}>{t.empty}</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {withBalance.map((h) => {
              const active = token === h.symbol;
              return (
                <button key={h.symbol} onClick={() => { setToken(h.symbol); setAmountStr(""); }}
                  className="flex-1 min-w-[120px] flex flex-col gap-0.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer"
                  style={{
                    background: active ? "rgba(129,140,248,0.14)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? "rgba(129,140,248,0.55)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  <span className="text-sm font-semibold text-white">{h.symbol}</span>
                  <span className="text-[11px] font-data" style={{ color: active ? "rgba(165,180,252,0.9)" : "rgba(148,163,184,0.55)" }}>
                    {h.balance.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2 — amount: free input + % quick-picks */}
      {selected && (
        <div>
          <div className="flex items-baseline justify-between mb-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(129,140,248,0.6)" }}>{t.step2}</p>
            <span className="text-[11px] font-data" style={{ color: "rgba(148,163,184,0.55)" }}>
              {maxAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })} {selected.symbol} {t.max}
            </span>
          </div>
          <input
            type="text" inputMode="decimal" value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder={`0.0 ${selected.symbol}`}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none font-data"
            style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${amountStr && !amountOk ? "rgba(251,113,133,0.5)" : "rgba(255,255,255,0.1)"}` }}
          />
          {amountStr && !amountOk && (
            <p className="text-[11px] mt-1.5" style={{ color: "rgba(251,113,133,0.85)" }}>{t.insufficient}</p>
          )}
          <div className="mt-2 flex gap-2 flex-wrap">
            {[25, 50, 75, 100].map((pct) => (
              <button key={pct}
                onClick={() => setAmountStr(String(Number((maxAmount * pct / 100).toFixed(6))))}
                className="flex-1 min-w-[64px] px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
                style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.22)", color: "rgba(0,212,255,0.85)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.14)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.07)"; }}>
                {pct}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — destination chain */}
      {selected && amountOk && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(129,140,248,0.6)" }}>{t.step3}</p>
          <div className="flex gap-2 flex-wrap">
            {BRIDGE_DEST_CHAINS.map((c) => {
              const active = toChain === c;
              return (
                <button key={c} onClick={() => setToChain(c)}
                  className="flex-1 min-w-[96px] px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
                  style={{
                    background: active ? "rgba(129,140,248,0.14)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? "rgba(129,140,248,0.55)" : "rgba(255,255,255,0.08)"}`,
                    color: active ? "#c7d2fe" : "rgba(215,228,245,0.8)",
                  }}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit */}
      <button disabled={!ready}
        onClick={() => ready && onSubmit(token!, amount, toChain!)}
        className={`w-full px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${ready ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
        style={{
          background: ready ? "linear-gradient(135deg, rgba(99,102,241,0.85), rgba(0,150,220,0.85))" : "rgba(255,255,255,0.05)",
          border: "1px solid rgba(129,140,248,0.35)",
          color: "white",
        }}>
        {t.submit}
      </button>
    </div>
  );
}

// ─── transfer wizard (token → amount → count → addresses) ───────────────────

function TransferWizardCard({ state, lang, onSubmit }: {
  state: TransferWizardState;
  lang: "pt" | "en";
  onSubmit: (token: string, amount: number, recipients: string[]) => void;
}) {
  const [token, setToken] = useState<string | null>(
    state.preToken && TRANSFER_WIZARD_TOKENS.includes(state.preToken as typeof TRANSFER_WIZARD_TOKENS[number])
      ? state.preToken : null,
  );
  const [amountStr, setAmountStr] = useState(
    state.preAmount != null && state.preAmount > 0 ? String(state.preAmount) : "",
  );
  const [count, setCount] = useState<number | null>(state.preCount && state.preCount >= 1 ? state.preCount : null);
  const [addrs, setAddrs] = useState<string[]>([]);

  const bal = token ? (state.balances[token] ?? 0) : 0;
  const maxAmount = token === "PROS" ? Math.max(0, bal - TRANSFER_GAS_BUFFER_PROS) : bal;
  const amount = parseFloat(amountStr.replace(",", "."));
  const amountOk = Number.isFinite(amount) && amount > 0;
  const countOk = count != null && count >= 1 && count <= 20;
  const validAddr = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a);

  useEffect(() => {
    if (!countOk) { setAddrs([]); return; }
    setAddrs((prev) => {
      const next = [...prev];
      while (next.length < count!) next.push("");
      return next.slice(0, count!);
    });
  }, [count, countOk]);

  // Same wallet: only destino 1 filled → repeat for all. Different wallets: fill
  // in order; trailing empty slots are OK (e.g. 6 destinos when count=10).
  const resolvedRecipients = (() => {
    if (!countOk || addrs.length !== count) return null;
    const trimmed = addrs.map((a) => a.trim());
    if (trimmed.every(validAddr)) return trimmed;
    const first = trimmed[0];
    if (validAddr(first) && trimmed.slice(1).every((a) => !a)) return Array(count!).fill(first);
    let lastNonEmpty = -1;
    for (let i = trimmed.length - 1; i >= 0; i--) {
      if (trimmed[i]) { lastNonEmpty = i; break; }
    }
    if (lastNonEmpty < 0) return null;
    const used: string[] = [];
    for (let i = 0; i <= lastNonEmpty; i++) {
      const a = trimmed[i];
      if (!a || !validAddr(a)) return null;
      used.push(a);
    }
    return used.length > 0 ? used : null;
  })();
  const effectiveCount = resolvedRecipients?.length ?? 0;
  const plannedTotal = amountOk && countOk ? amount * count! : 0;
  const totalNeeded = amountOk && effectiveCount > 0 ? amount * effectiveCount : plannedTotal;
  const totalOk = amountOk && countOk && (
    effectiveCount > 0
      ? amount * effectiveCount <= maxAmount + 1e-9
      : plannedTotal <= maxAmount + 1e-9
  );
  const canShowAddresses = amountOk && countOk && plannedTotal <= maxAmount + 1e-9;
  const recipientsOk = !!resolvedRecipients;
  const addressGap = countOk && addrs.length === count && addrs.some((a) => a.trim()) && !resolvedRecipients
    && addrs.map((a) => a.trim()).some(validAddr);
  const ready = !!token && amountOk && countOk && totalOk && recipientsOk;
  const firstValid = validAddr(addrs[0]?.trim() ?? "");
  const canFillAll = countOk && firstValid && addrs.slice(1).every((a) => !a.trim());
  const partialCount = effectiveCount > 0 && count && effectiveCount < count;

  const t = lang === "pt"
    ? {
        step1: "1 · Qual token?",
        step2: "2 · Quanto enviar em cada transferência?",
        step3: "3 · Quantas transferências?",
        step4: "4 · Endereço de destino (pode ser a mesma carteira em todas)",
        step4hint: "PROS para várias carteiras = 1 assinatura. USDC/WPROS = 1 assinatura por destino.",
        max: "disponível",
        total: "total necessário",
        insufficient: "Saldo insuficiente para todas as transferências",
        invalid: "Endereço inválido (use 0x… 42 caracteres)",
        submit: "Preparar transferências →",
        custom: "Outro",
        addrPh: (n: number) => `Destino ${n} — 0x…`,
        fillAll: (n: number) => `Usar o mesmo endereço nas ${n} transferências`,
        gap: "Preencha os destinos em ordem, sem buracos no meio",
        partial: (filled: number, total: number) => `${filled} destino${filled > 1 ? "s" : ""} preenchido${filled > 1 ? "s" : ""} (de ${total})`,
      }
    : {
        step1: "1 · Which token?",
        step2: "2 · Amount per transfer?",
        step3: "3 · How many transfers?",
        step4: "4 · Recipient address (same wallet for all is OK)",
        step4hint: "PROS to multiple wallets = 1 signature. USDC/WPROS = 1 signature per recipient.",
        max: "available",
        total: "total needed",
        insufficient: "Insufficient balance for all transfers",
        invalid: "Invalid address (use 0x… 42 chars)",
        submit: "Prepare transfers →",
        custom: "Other",
        addrPh: (n: number) => `Recipient ${n} — 0x…`,
        fillAll: (n: number) => `Use same address for all ${n} transfers`,
        gap: "Fill recipients in order — no gaps in the middle",
        partial: (filled: number, total: number) => `${filled} recipient${filled > 1 ? "s" : ""} filled (of ${total})`,
      };

  return (
    <div className="mt-3 px-4 py-4 rounded-2xl space-y-4"
      style={{ background: "rgba(7,14,30,0.9)", border: "1px solid rgba(16,185,129,0.22)", backdropFilter: "blur(16px)" }}>
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(16,185,129,0.6)" }}>{t.step1}</p>
        <div className="flex gap-2 flex-wrap">
          {TRANSFER_WIZARD_TOKENS.map((sym) => {
            const active = token === sym;
            const b = state.balances[sym] ?? 0;
            return (
              <button key={sym} onClick={() => { setToken(sym); setAmountStr(""); setCount(null); }}
                className="flex-1 min-w-[100px] flex flex-col gap-0.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer"
                style={{
                  background: active ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(16,185,129,0.55)" : "rgba(255,255,255,0.08)"}`,
                }}>
                <span className="text-sm font-semibold text-white">{sym}</span>
                <span className="text-[11px] font-data" style={{ color: active ? "rgba(110,231,183,0.9)" : "rgba(148,163,184,0.55)" }}>
                  {b.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {token && (
        <div>
          <div className="flex items-baseline justify-between mb-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(16,185,129,0.6)" }}>{t.step2}</p>
            <span className="text-[11px] font-data" style={{ color: "rgba(148,163,184,0.55)" }}>
              {maxAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })} {token} {t.max}
            </span>
          </div>
          <input type="text" inputMode="decimal" value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder={`0.0 ${token}`}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none font-data"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>
      )}

      {token && amountOk && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(16,185,129,0.6)" }}>{t.step3}</p>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 10].map((n) => (
              <button key={n} onClick={() => setCount(n)}
                className="min-w-[48px] px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer"
                style={{
                  background: count === n ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${count === n ? "rgba(16,185,129,0.55)" : "rgba(255,255,255,0.08)"}`,
                  color: count === n ? "#6ee7b7" : "rgba(215,228,245,0.8)",
                }}>
                {n}
              </button>
            ))}
          </div>
          {countOk && (
            <>
              <div className="mt-2 flex gap-2 flex-wrap">
                {[25, 50, 75, 100].map((pct) => (
                  <button key={pct}
                    onClick={() => setAmountStr(String(Number((maxAmount / count! * pct / 100).toFixed(6))))}
                    className="flex-1 min-w-[64px] px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
                    style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.22)", color: "rgba(110,231,183,0.85)" }}>
                    {pct}% {lang === "pt" ? "do saldo ÷" : "balance ÷"} {count}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-2 font-data" style={{ color: totalOk ? "rgba(148,163,184,0.55)" : "rgba(251,113,133,0.85)" }}>
                {t.total}: {totalNeeded.toFixed(6)} {token}
                {partialCount && count ? ` (${t.partial(effectiveCount, count)})` : ""}
                {!totalOk && amountOk ? ` — ${t.insufficient}` : ""}
              </p>
            </>
          )}
        </div>
      )}

      {token && amountOk && countOk && canShowAddresses && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(16,185,129,0.6)" }}>{t.step4}</p>
          <p className="text-[10px] mb-2" style={{ color: "rgba(148,163,184,0.5)" }}>{t.step4hint}</p>
          {partialCount && count && (
            <p className="text-[11px] font-data" style={{ color: "rgba(110,231,183,0.85)" }}>
              {t.partial(effectiveCount, count)}
            </p>
          )}
          {addrs.map((a, i) => (
            <input key={i} type="text" value={a}
              onChange={(e) => setAddrs((prev) => { const n = [...prev]; n[i] = e.target.value.trim(); return n; })}
              placeholder={i === 0 ? t.addrPh(i + 1) : (lang === "pt" ? `Destino ${i + 1} — opcional` : `Recipient ${i + 1} — optional`)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none font-data"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${a && !validAddr(a) ? "rgba(251,113,133,0.5)" : "rgba(255,255,255,0.1)"}`,
              }}
            />
          ))}
          {addressGap && (
            <p className="text-[11px]" style={{ color: "rgba(251,113,133,0.85)" }}>{t.gap}</p>
          )}
          {canFillAll && count && (
            <button type="button"
              onClick={() => setAddrs(Array(count).fill(addrs[0].trim()))}
              className="text-[11px] font-semibold underline-offset-2 hover:underline"
              style={{ color: "rgba(110,231,183,0.9)" }}>
              {t.fillAll(count)}
            </button>
          )}
        </div>
      )}

      <button disabled={!ready}
        onClick={() => ready && onSubmit(token!, amount, resolvedRecipients!)}
        className={`w-full px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${ready ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
        style={{
          background: ready ? "linear-gradient(135deg, rgba(16,185,129,0.85), rgba(0,150,220,0.85))" : "rgba(255,255,255,0.05)",
          border: "1px solid rgba(16,185,129,0.35)",
          color: "white",
        }}>
        {t.submit}
      </button>
    </div>
  );
}

// ─── bridge route comparison ─────────────────────────────────────────────────

const BRIDGE_ROUTE_META: Record<BridgeRouteOption["provider"], { label: string; accent: string }> = {
  lifi: { label: "Jumper (LI.FI)",   accent: "99,102,241" },
  ccip: { label: "Chainlink CCIP",   accent: "245,158,11" },
  cctp: { label: "Circle CCTP v2",   accent: "16,185,129" },
};

function BridgeRouteButtons({ choice, lang, onChoose }: {
  choice: BridgeChoice; lang: "pt" | "en"; onChoose: (opt: BridgeRouteOption) => void;
}) {
  const bestLabel = lang === "pt" ? "★ Melhor retorno" : "★ Best return";
  const receiveLabel = lang === "pt" ? "você recebe" : "you receive";
  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-3" style={{ color: "rgba(0,212,255,0.45)" }}>
        {lang === "pt" ? "Escolha a rota de bridge" : "Choose bridge route"}
      </p>
      <div className="flex gap-2.5 flex-wrap">
        {choice.options.map((opt) => {
          const meta = BRIDGE_ROUTE_META[opt.provider];
          return (
            <button key={opt.provider} onClick={() => onChoose(opt)}
              className="flex-1 min-w-[170px] relative flex flex-col gap-1.5 px-3.5 py-3 rounded-xl text-left transition-all duration-200 cursor-pointer"
              style={{
                background: opt.best ? `rgba(${meta.accent},0.09)` : "rgba(255,255,255,0.03)",
                border: `1px solid rgba(${meta.accent},${opt.best ? "0.5" : "0.22"})`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = `rgba(${meta.accent},0.12)`;
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = opt.best ? `rgba(${meta.accent},0.09)` : "rgba(255,255,255,0.03)";
                (e.currentTarget as HTMLButtonElement).style.transform = "";
              }}>
              {opt.best && (
                <span className="absolute -top-2.5 right-3 text-[9px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: `rgb(${meta.accent})`, color: "#0a0f1e" }}>
                  {bestLabel}
                </span>
              )}
              <span className="text-sm font-semibold text-white">{meta.label}</span>
              <span className="text-sm font-data font-semibold" style={{ color: `rgb(${meta.accent})` }}>
                {receiveLabel} ~{opt.receiveLabel}
              </span>
              <span className="text-[11px] leading-snug" style={{ color: "rgba(148,163,184,0.55)" }}>{opt.note}</span>
            </button>
          );
        })}
        {(choice.unavailable ?? []).map((u) => {
          const meta = BRIDGE_ROUTE_META[u.provider];
          return (
            <div key={u.provider}
              className="flex-1 min-w-[170px] flex flex-col gap-1.5 px-3.5 py-3 rounded-xl text-left opacity-45 cursor-not-allowed"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-sm font-semibold text-gray-400">{meta.label}</span>
              <span className="text-[11px] leading-snug" style={{ color: "rgba(148,163,184,0.5)" }}>
                {lang === "pt" ? "Indisponível: " : "Unavailable: "}{u.reason}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── swap wizard (from-token → amount → to-token) ───────────────────────────

const ALL_TOKEN_SYMBOLS = Object.keys(TOKENS);

function SwapWizardCard({ state, lang, onSubmit }: {
  state: SwapWizardState;
  lang: "pt" | "en";
  onSubmit: (fromToken: string, amount: number, toToken: string) => void;
}) {
  const [fromToken, setFromToken] = useState<string | null>(state.preFrom ?? null);
  const [amountStr, setAmountStr] = useState(state.preAmount != null && state.preAmount > 0 ? String(state.preAmount) : "");
  const [toToken, setToToken] = useState<string | null>(state.preTo ?? null);

  const selected = state.holdings.find((h) => h.symbol === fromToken);
  const maxAmount = selected
    ? (selected.symbol === "PROS" ? Math.max(0, selected.balance - BRIDGE_GAS_BUFFER_PROS) : selected.balance)
    : 0;
  const amount = parseFloat(amountStr.replace(",", "."));
  const amountOk = Number.isFinite(amount) && amount > 0 && amount <= maxAmount + 1e-9;
  const ready = !!fromToken && amountOk && !!toToken && toToken !== fromToken;

  const t = lang === "pt"
    ? { step1: "1 · Qual token você quer trocar?", step2: "2 · Quanto?", step3: "3 · Receber em qual token?", max: "disponível", insufficient: "Valor maior que o saldo disponível", submit: "Buscar cotações →", empty: "Nenhum token com saldo na carteira. Deposite fundos primeiro." }
    : { step1: "1 · Which token do you want to swap?", step2: "2 · How much?", step3: "3 · Receive which token?", max: "available", insufficient: "Amount exceeds available balance", submit: "Fetch quotes →", empty: "No tokens with balance in this wallet. Fund it first." };

  const withBalance = state.holdings.filter((h) => h.balance > 0);

  return (
    <div className="mt-3 px-4 py-4 rounded-2xl space-y-4"
      style={{ background: "rgba(7,14,30,0.9)", border: "1px solid rgba(0,212,255,0.22)", backdropFilter: "blur(16px)" }}>
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(0,212,255,0.6)" }}>{t.step1}</p>
        {withBalance.length === 0 ? (
          <p className="text-xs" style={{ color: "rgba(251,191,36,0.8)" }}>{t.empty}</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {withBalance.map((h) => {
              const active = fromToken === h.symbol;
              return (
                <button key={h.symbol} onClick={() => { setFromToken(h.symbol); setAmountStr(""); if (toToken === h.symbol) setToToken(null); }}
                  className="flex-1 min-w-[120px] flex flex-col gap-0.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer"
                  style={{
                    background: active ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? "rgba(0,212,255,0.55)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  <span className="text-sm font-semibold text-white">{h.symbol}</span>
                  <span className="text-[11px] font-data" style={{ color: active ? "rgba(103,232,249,0.9)" : "rgba(148,163,184,0.55)" }}>
                    {h.balance.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div>
          <div className="flex items-baseline justify-between mb-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(0,212,255,0.6)" }}>{t.step2}</p>
            <span className="text-[11px] font-data" style={{ color: "rgba(148,163,184,0.55)" }}>
              {maxAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })} {selected.symbol} {t.max}
            </span>
          </div>
          <input
            type="text" inputMode="decimal" value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder={`0.0 ${selected.symbol}`}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none font-data"
            style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${amountStr && !amountOk ? "rgba(251,113,133,0.5)" : "rgba(255,255,255,0.1)"}` }}
          />
          {amountStr && !amountOk && (
            <p className="text-[11px] mt-1.5" style={{ color: "rgba(251,113,133,0.85)" }}>{t.insufficient}</p>
          )}
          <div className="mt-2 flex gap-2 flex-wrap">
            {[25, 50, 75, 100].map((pct) => (
              <button key={pct}
                onClick={() => setAmountStr(String(Number((maxAmount * pct / 100).toFixed(6))))}
                className="flex-1 min-w-[64px] px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
                style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.22)", color: "rgba(0,212,255,0.85)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.14)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.07)"; }}>
                {pct}%
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && amountOk && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(0,212,255,0.6)" }}>{t.step3}</p>
          <div className="flex gap-2 flex-wrap">
            {ALL_TOKEN_SYMBOLS.filter((s) => s !== fromToken).map((s) => {
              const active = toToken === s;
              return (
                <button key={s} onClick={() => setToToken(s)}
                  className="flex-1 min-w-[80px] px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
                  style={{
                    background: active ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? "rgba(0,212,255,0.55)" : "rgba(255,255,255,0.08)"}`,
                    color: active ? "#a5f3fc" : "rgba(215,228,245,0.8)",
                  }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button disabled={!ready}
        onClick={() => ready && onSubmit(fromToken!, amount, toToken!)}
        className={`w-full px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${ready ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
        style={{
          background: ready ? "linear-gradient(135deg, rgba(0,180,255,0.85), rgba(0,120,220,0.85))" : "rgba(255,255,255,0.05)",
          border: "1px solid rgba(0,212,255,0.35)",
          color: "white",
        }}>
        {t.submit}
      </button>
    </div>
  );
}

// ─── liquidity wizard (pair → fee tier → range → amount) ────────────────────

const LIQ_FEE_TIERS = [100, 500, 3000, 10000] as const;
const LIQ_RANGE_OPTIONS = [5, 10, 15, 30] as const;

// Uniswap V3 math (human units, USDC per WPROS): given the WPROS amount and a
// symmetric range around the current price, estimate the USDC counterpart.
function estimateUsdcCounterpart(wpros: number, price: number, range: number | "full"): number {
  if (!Number.isFinite(wpros) || wpros <= 0 || price <= 0) return 0;
  if (range === "full") return wpros * price;
  const r = Math.min(range / 100, 0.99);
  const sp  = Math.sqrt(price);
  const spl = Math.sqrt(price * (1 - r));
  const spu = Math.sqrt(price * (1 + r));
  const L = wpros * (sp * spu) / (spu - sp);
  return L * (sp - spl);
}

function LiquidityWizardCard({ state, lang, onSubmit }: {
  state: LiquidityWizardState;
  lang: "pt" | "en";
  onSubmit: (params: { feeTier: number; rangeMode: "percent" | "full"; rangePercent?: number; wprosAmount: number }) => void;
}) {
  const [feeTier, setFeeTier] = useState<number | null>(state.preFeeTier ?? null);
  const [range, setRange] = useState<number | "full" | null>(state.preRangePercent ?? null);
  const [customRangeStr, setCustomRangeStr] = useState("");
  const [amountStr, setAmountStr] = useState(state.preAmount != null && state.preAmount > 0 ? String(state.preAmount) : "");
  const [poolPrice, setPoolPrice] = useState<number | null>(null);

  // Live pool price for the selected fee tier → powers the USDC estimate.
  useEffect(() => {
    if (feeTier == null) return;
    let alive = true;
    setPoolPrice(null);
    readPoolState(feeTier as FeeTier)
      .then((s) => { if (alive) setPoolPrice(s.priceUSDCperWPROS); })
      .catch(() => { if (alive) setPoolPrice(null); });
    return () => { alive = false; };
  }, [feeTier]);

  const wpros = state.holdings.find((h) => h.symbol === "WPROS");
  const usdc  = state.holdings.find((h) => h.symbol === "USDC");
  const usdcBalance = usdc?.balance ?? 0;
  const maxAmount = wpros?.balance ?? 0;
  const amount = parseFloat(amountStr.replace(",", "."));
  const amountOk = Number.isFinite(amount) && amount > 0 && amount <= maxAmount + 1e-9;
  const ready = feeTier != null && range != null && amountOk;

  const usdcNeeded = ready && poolPrice != null
    ? estimateUsdcCounterpart(amount, poolPrice, range!)
    : null;
  const usdcShort = usdcNeeded != null && usdcNeeded > usdcBalance + 1e-9;

  const t = lang === "pt"
    ? { pair: "1 · Par de liquidez", fee: "2 · Fee tier da pool", range: "3 · Range de preço", amount: "4 · Quanto de WPROS?", max: "disponível", full: "Range completo", custom: "Outro", insufficient: "Valor maior que o saldo de WPROS", submit: "Montar posição →", noBal: "Você não tem WPROS. Faça um swap PROS → WPROS primeiro.", needs: "USDC necessário (estimado)", yourUsdc: "seu saldo", usdcShortWarn: "Saldo de USDC insuficiente para esse valor — reduza o WPROS ou compre USDC.", price: "Preço atual" }
    : { pair: "1 · Liquidity pair", fee: "2 · Pool fee tier", range: "3 · Price range", amount: "4 · How much WPROS?", max: "available", full: "Full range", custom: "Custom", insufficient: "Amount exceeds WPROS balance", submit: "Build position →", noBal: "You have no WPROS. Swap PROS → WPROS first.", needs: "USDC needed (estimated)", yourUsdc: "your balance", usdcShortWarn: "Not enough USDC for this amount — lower the WPROS or buy USDC.", price: "Current price" };

  return (
    <div className="mt-3 px-4 py-4 rounded-2xl space-y-4"
      style={{ background: "rgba(7,14,30,0.9)", border: "1px solid rgba(52,211,153,0.22)", backdropFilter: "blur(16px)" }}>
      {/* Pair — FaroSwap V3 WPROS/USDC (the pool the agent manages) */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(52,211,153,0.6)" }}>{t.pair}</p>
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.45)" }}>
            <span className="text-sm font-semibold text-white">WPROS / USDC</span>
            <span className="block text-[11px] mt-0.5" style={{ color: "rgba(110,231,183,0.7)" }}>FaroSwap V3</span>
          </div>
        </div>
      </div>

      {/* Fee tier */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(52,211,153,0.6)" }}>{t.fee}</p>
        <div className="flex gap-2 flex-wrap">
          {LIQ_FEE_TIERS.map((ft) => {
            const active = feeTier === ft;
            return (
              <button key={ft} onClick={() => setFeeTier(ft)}
                className="flex-1 min-w-[72px] px-2.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
                style={{
                  background: active ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(52,211,153,0.55)" : "rgba(255,255,255,0.08)"}`,
                  color: active ? "#6ee7b7" : "rgba(215,228,245,0.8)",
                }}>
                {FEE_TIERS[ft as FeeTier]?.label ?? `${ft / 10000}%`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Range — presets, full range, or a custom typed % */}
      {feeTier != null && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(52,211,153,0.6)" }}>{t.range}</p>
          <div className="flex gap-2 flex-wrap">
            {LIQ_RANGE_OPTIONS.map((r) => {
              const active = range === r && customRangeStr === "";
              return (
                <button key={r} onClick={() => { setRange(r); setCustomRangeStr(""); }}
                  className="flex-1 min-w-[64px] px-2.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
                  style={{
                    background: active ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? "rgba(52,211,153,0.55)" : "rgba(255,255,255,0.08)"}`,
                    color: active ? "#6ee7b7" : "rgba(215,228,245,0.8)",
                  }}>
                  ±{r}%
                </button>
              );
            })}
            <button onClick={() => { setRange("full"); setCustomRangeStr(""); }}
              className="flex-1 min-w-[90px] px-2.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
              style={{
                background: range === "full" ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${range === "full" ? "rgba(52,211,153,0.55)" : "rgba(255,255,255,0.08)"}`,
                color: range === "full" ? "#6ee7b7" : "rgba(215,228,245,0.8)",
              }}>
              {t.full}
            </button>
            {/* Custom % input */}
            <div className="flex-1 min-w-[100px] flex items-center gap-1 px-2.5 rounded-xl"
              style={{
                background: customRangeStr ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${customRangeStr ? "rgba(52,211,153,0.55)" : "rgba(255,255,255,0.08)"}`,
              }}>
              <span className="text-xs font-semibold" style={{ color: customRangeStr ? "#6ee7b7" : "rgba(148,163,184,0.55)" }}>±</span>
              <input
                type="text" inputMode="decimal" value={customRangeStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.,]/g, "");
                  setCustomRangeStr(v);
                  const n = parseFloat(v.replace(",", "."));
                  if (Number.isFinite(n) && n > 0 && n < 100) setRange(n);
                  else if (v === "") setRange(null);
                }}
                placeholder={t.custom}
                className="w-full py-2.5 text-xs font-semibold text-white outline-none bg-transparent"
              />
              <span className="text-xs font-semibold" style={{ color: customRangeStr ? "#6ee7b7" : "rgba(148,163,184,0.55)" }}>%</span>
            </div>
          </div>
        </div>
      )}

      {/* Amount */}
      {feeTier != null && range != null && (
        <div>
          <div className="flex items-baseline justify-between mb-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(52,211,153,0.6)" }}>{t.amount}</p>
            <span className="text-[11px] font-data" style={{ color: "rgba(148,163,184,0.55)" }}>
              {maxAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })} WPROS {t.max}
            </span>
          </div>
          {maxAmount <= 0 ? (
            <p className="text-xs" style={{ color: "rgba(251,191,36,0.8)" }}>{t.noBal}</p>
          ) : (
            <>
              <input
                type="text" inputMode="decimal" value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="0.0 WPROS"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none font-data"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${amountStr && !amountOk ? "rgba(251,113,133,0.5)" : "rgba(255,255,255,0.1)"}` }}
              />
              {amountStr && !amountOk && (
                <p className="text-[11px] mt-1.5" style={{ color: "rgba(251,113,133,0.85)" }}>{t.insufficient}</p>
              )}
              <div className="mt-2 flex gap-2 flex-wrap">
                {[25, 50, 75, 100].map((pct) => (
                  <button key={pct}
                    onClick={() => setAmountStr(String(Number((maxAmount * pct / 100).toFixed(6))))}
                    className="flex-1 min-w-[64px] px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
                    style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.22)", color: "rgba(110,231,183,0.85)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.14)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.07)"; }}>
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Live USDC counterpart estimate */}
              {amountOk && range != null && (
                <div className="mt-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: usdcShort ? "rgba(251,191,36,0.07)" : "rgba(52,211,153,0.06)",
                    border: `1px solid ${usdcShort ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.18)"}`,
                  }}>
                  {poolPrice == null ? (
                    <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.6)" }}>
                      {lang === "pt" ? "Calculando o USDC necessário…" : "Calculating USDC needed…"}
                    </span>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-semibold" style={{ color: usdcShort ? "rgba(251,191,36,0.9)" : "rgba(110,231,183,0.9)" }}>
                          {t.needs}
                        </span>
                        <span className="text-xs font-data font-bold" style={{ color: usdcShort ? "#fbbf24" : "#6ee7b7" }}>
                          ≈ {usdcNeeded != null ? usdcNeeded.toFixed(4) : "—"} USDC
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-1">
                        <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.5)" }}>
                          {t.price}: 1 WPROS ≈ {poolPrice.toFixed(4)} USDC
                        </span>
                        <span className="text-[10px] font-data" style={{ color: "rgba(148,163,184,0.55)" }}>
                          {t.yourUsdc}: {usdcBalance.toLocaleString("en-US", { maximumFractionDigits: 4 })} USDC
                        </span>
                      </div>
                      {usdcShort && (
                        <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "rgba(251,191,36,0.85)" }}>
                          ⚠ {t.usdcShortWarn}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <button disabled={!ready}
        onClick={() => ready && onSubmit({
          feeTier: feeTier!,
          rangeMode: range === "full" ? "full" : "percent",
          rangePercent: range === "full" ? undefined : (range as number),
          wprosAmount: amount,
        })}
        className={`w-full px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${ready ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
        style={{
          background: ready ? "linear-gradient(135deg, rgba(16,185,129,0.85), rgba(5,150,105,0.85))" : "rgba(255,255,255,0.05)",
          border: "1px solid rgba(52,211,153,0.35)",
          color: "white",
        }}>
        {t.submit}
      </button>
    </div>
  );
}

// ─── wallet choice (multi-wallet connect) ───────────────────────────────────

function WalletChoiceButtons({ options, onChoose }: { options: WalletOption[]; onChoose: (opt: WalletOption) => void }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-3" style={{ color: "rgba(0,212,255,0.45)" }}>
        Choose wallet
      </p>
      <div className="flex gap-2.5 flex-wrap">
        {options.map((opt) => (
          <button key={opt.id} onClick={() => onChoose(opt)}
            className="flex-1 min-w-[130px] flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left transition-all duration-200"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0,212,255,0.2)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.08)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.4)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.2)";
              (e.currentTarget as HTMLButtonElement).style.transform = "";
            }}>
            {opt.icon
              ? <img src={opt.icon} alt="" className="w-6 h-6 rounded-md shrink-0" />
              : <span className="w-6 h-6 rounded-md shrink-0" style={{ background: "rgba(0,212,255,0.12)" }} />}
            <span className="text-sm font-semibold text-white">{opt.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── tx button ─────────────────────────────────────────────────────────────

// ─── pre-signature gas estimate line ─────────────────────────────────────────
// Shows the approximate network fee before the user signs. Best-effort: if the
// estimate reverts (e.g. an approval step is still missing), the line is hidden
// and the wallet's own estimate at signing time is the fallback. For multi-tx
// flows only the estimable steps are summed, marked with "+" to signal "at least".

function GasEstimateLine({ txs }: { txs: Array<{ from: string; to: string; data?: string; value?: string | bigint }> }) {
  const [label, setLabel] = useState<string | null>(null);
  const key = txs.map((t) => `${t.to}:${t.data ?? ""}:${String(t.value ?? "")}`).join("|");

  useEffect(() => {
    let alive = true;
    (async () => {
      const results = await Promise.all(txs.map((t) => estimateGasCost(t).catch(() => null)));
      if (!alive) return;
      const ok = results.filter((r): r is NonNullable<typeof r> => r !== null);
      if (ok.length === 0) { setLabel(null); return; }
      const total = ok.reduce((s, r) => s + r.costPros, 0);
      const partial = ok.length < txs.length;
      setLabel(formatGasCost({ gasUnits: 0n, costPros: total }) + (partial ? "+" : ""));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!label) return null;
  return (
    <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(148,163,184,0.65)" }}>
      <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 12.5V3a1 1 0 011-1h4a1 1 0 011 1v9.5M1.5 12.5h8M8.5 5.5l2 .8a1 1 0 01.6.9v3.3a1 1 0 102 0V6l-2-2"/></svg>
      <span>Network fee: <span className="font-data font-semibold" style={{ color: "rgba(215,228,245,0.8)" }}>{label}</span></span>
    </div>
  );
}

// Extracts the estimable tx params from a built swap/bridge PendingTx.
function pendingToGasTxs(pending: PendingTx, walletAddress: string): Array<{ from: string; to: string; data?: string; value?: string | bigint }> {
  if (pending.needsApproval) return []; // main tx reverts until the approval lands
  if (pending.provider === "ccip" && pending.ccip) {
    return [{ from: walletAddress, to: pending.ccip.routerAddress, data: pending.ccip.callData, value: pending.ccip.feeAmount }];
  }
  if (pending.provider === "cctp" && pending.cctpV2) {
    return [{ from: walletAddress, to: pending.cctpV2.to, data: pending.cctpV2.data }];
  }
  if (pending.provider === "faroswap" && pending.faroswap) {
    const t = pending.faroswap.txRequest as { to?: string; data?: string; value?: string };
    if (t.to) return [{ from: walletAddress, to: t.to, data: t.data, value: t.value }];
  }
  if (pending.provider === "lifi" && pending.quote) {
    const t = pending.quote.transactionRequest as { to?: string; data?: string; value?: string };
    if (t.to) return [{ from: walletAddress, to: t.to, data: t.data, value: t.value }];
  }
  return [];
}

function TxButton({ pending, walletAddress, onSuccess, onError, onReverted }: {
  pending: PendingTx; walletAddress: string; onSuccess: (hash: string) => void; onError: (msg: string) => void; onReverted: (hash: string) => void;
}) {
  const [step, setStep] = useState<"idle"|"switching"|"approving"|"signing"|"confirming"|"done">("idle");
  const fromChain = pending.intent.fromChain ?? "Pharos";

  async function handleSign() {
    const walletName = getWalletName();
    try {
      setStep("switching");
      await switchToChain(fromChain);
      // The route/calldata was quoted for a specific from-address (receiver,
      // allowance checks). If the user switched accounts since this card was
      // built, signing it would revert (STF) or send funds to the old wallet.
      const builtFor = pending.quote?.transactionRequest?.from
        ?? (pending.faroswap?.txRequest as { from?: string } | undefined)?.from;
      if (builtFor && builtFor.toLowerCase() !== walletAddress.toLowerCase()) {
        setStep("idle");
        onError("This transaction was built for a different wallet account. Ask for the swap/bridge again and I'll rebuild it for the active wallet.");
        return;
      }
      if (pending.needsApproval && pending.approvalData) {
        setStep("approving");
        const { tokenAddress, spender, amount } = pending.approvalData;
        const approvalHash = await sendApproval(tokenAddress, walletAddress, spender, amount);
        // MUST wait for the approval to be mined before the main tx, or the
        // contract's transferFrom runs against a stale (0) allowance and reverts.
        const approved = await waitForTxSuccess(approvalHash);
        if (!approved) throw new Error("Token approval failed or was reverted on-chain. Please try again.");
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
      // Wait for the receipt and verify it actually succeeded on-chain.
      setStep("confirming");
      const ok = await waitForTxSuccess(hash);
      if (ok) {
        setStep("done");
        onSuccess(hash);
      } else {
        setStep("idle");
        onReverted(hash);
      }
    } catch (err: unknown) {
      setStep("idle");
      const msg = err instanceof Error ? err.message : String(err);
      const isRejected = /user rejected|user denied|rejected the request/i.test(msg);
      onError(isRejected ? "Transaction rejected by user." : msg);
    }
  }

  const walletLabel = getWalletName();
  const stepLabels = { idle: pending.needsApproval ? "Approve & Sign" : "Sign & Execute", switching: `Switching to ${fromChain}…`, approving: "Approving token…", signing: `Waiting for ${walletLabel}…`, confirming: "Confirming on-chain…", done: "Done!" };
  const isIdle = step === "idle";
  const isDone = step === "done";
  const gasTxs = fromChain === "Pharos" ? pendingToGasTxs(pending, walletAddress) : [];

  return (
    <>
    {gasTxs.length > 0 && <GasEstimateLine txs={gasTxs} />}
    <button onClick={handleSign} disabled={!isIdle}
      className="mt-4 w-full h-11 px-6 rounded-xl font-semibold text-sm text-black transition-all duration-200 relative overflow-hidden flex items-center justify-center gap-2"
      style={{
        background: isDone ? "linear-gradient(135deg,#10b981,#34d399)" : "linear-gradient(135deg,#00d4ff 0%,#38bdf8 60%,#0ea5e9 100%)",
        boxShadow: isIdle ? "0 4px 18px rgba(0,212,255,0.35), inset 0 1px 0 rgba(255,255,255,0.25)" : "none",
      }}
      onMouseEnter={(e) => { if (!isIdle) return; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}>
      {isIdle && <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.18) 50%,transparent 60%)", animation: "shimmer 3s ease-in-out infinite" }} />}
      {!isIdle && !isDone && <Spinner />}
      <span className="relative">{stepLabels[step]}</span>
      {isIdle && <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 relative shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>}
    </button>
    </>
  );
}

// ─── position cards ────────────────────────────────────────────────────────

// Full-range positions on FaroSwap use the extreme tick bounds
function isFullRange(p: V3Position) {
  return p.tickLower <= -887200 && p.tickUpper >= 887200;
}

// tick → USDC per WPROS (WPROS 18 dec, USDC 6 dec ⇒ ×10^12)
function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick) * 1e12;
}

function fmtPrice(v: number): string {
  if (!isFinite(v) || v === 0) return "0";
  if (v >= 1000000) return "∞";
  if (v >= 100) return v.toFixed(2);
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
}

function PositionCards({ positions, onRemove, onCollect }: { positions: V3Position[]; onRemove?: (p: V3Position) => void; onCollect?: (p: V3Position) => void }) {
  if (positions.length === 0) return null;

  const inRange  = positions.filter(p => p.liquidity > 0n && p.inRange);
  const outRange = positions.filter(p => p.liquidity > 0n && !p.inRange);
  const closed   = positions.filter(p => p.liquidity === 0n);

  function PositionCard({ p }: { p: V3Position }) {
    const hasLiq = p.liquidity > 0n;
    const hasFees = p.feesWPROS > 0.000001 || p.feesUSDC > 0.000001;
    const inR = hasLiq && p.inRange;
    const sc = !hasLiq ? "rgba(148,163,184,0.6)" : inR ? "#34d399" : "#fbbf24";
    const sl = !hasLiq ? "Closed" : inR ? "In range" : "Out of range";
    const accentBar = !hasLiq ? "rgba(100,116,139,0.35)" : inR ? "#34d399" : "#fbbf24";
    const full = isFullRange(p);
    const minPrice = full ? 0 : tickToPrice(p.tickLower);
    const maxPrice = full ? Infinity : tickToPrice(p.tickUpper);

    // Closed positions with nothing to collect → compact single row
    if (!hasLiq && !hasFees) {
      return (
        <div className="flex items-center justify-between pl-4 pr-4 py-2.5 rounded-xl"
          style={{ background: "rgba(7,14,30,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex -space-x-1.5 shrink-0">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold z-10 text-white opacity-60" style={{ background: "linear-gradient(135deg,#3b82f6,#60a5fa)", border: "1.5px solid rgba(7,14,30,1)" }}>W</div>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white opacity-60" style={{ background: "linear-gradient(135deg,#10b981,#34d399)", border: "1.5px solid rgba(7,14,30,1)" }}>U</div>
            </div>
            <span className="text-xs font-semibold truncate" style={{ color: "rgba(148,163,184,0.6)" }}>WPROS / USDC</span>
            <span className="text-[10px] font-data shrink-0" style={{ color: "rgba(100,116,139,0.5)" }}>#{String(p.tokenId)}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(100,116,139,0.55)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {(p.fee / 10000).toFixed(2)}%
            </span>
          </div>
          <a href={`https://pharos.socialscan.io/token/${FAROSWAP.NPM}/instance/${String(p.tokenId)}`} target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-medium transition-colors shrink-0" style={{ color: "rgba(0,212,255,0.35)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.75)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.35)")}>
            View NFT ↗
          </a>
        </div>
      );
    }

    return (
      <div className="rounded-2xl overflow-hidden relative transition-all duration-200"
        style={{ background: "rgba(7,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(14px)" }}>
        {/* Status accent bar on the left */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accentBar, opacity: 0.7 }} />

        {/* Header — pair, badges, status */}
        <div className="flex items-center justify-between pl-5 pr-4 pt-3.5 pb-2.5">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold z-10 text-white" style={{ background: "linear-gradient(135deg,#3b82f6,#60a5fa)", border: "2px solid rgba(7,14,30,1)" }}>W</div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#10b981,#34d399)", border: "2px solid rgba(7,14,30,1)" }}>U</div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white tracking-[-0.01em]">WPROS / USDC</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(148,163,184,0.7)", border: "1px solid rgba(255,255,255,0.09)" }}>v3</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(0,212,255,0.09)", color: "rgba(0,212,255,0.8)", border: "1px solid rgba(0,212,255,0.16)" }}>
                  {(p.fee / 10000).toFixed(2)}%
                </span>
              </div>
              <p className="text-[10px] font-data mt-1" style={{ color: "rgba(100,116,139,0.6)" }}>
                #{String(p.tokenId)}
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ color: sc, background: `${sc}12`, border: `1px solid ${sc}30` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc, boxShadow: `0 0 5px ${sc}` }} />
            {sl}
          </span>
        </div>

        {/* Price range — Uniswap style */}
        <div className="pl-5 pr-4 pb-3">
          <div className="flex items-center gap-2 text-[11px] font-data" style={{ color: "rgba(148,163,184,0.65)" }}>
            <span className="text-[9px] uppercase tracking-[0.1em] font-semibold shrink-0" style={{ color: "rgba(100,116,139,0.5)" }}>Range</span>
            {full ? (
              <span className="font-semibold" style={{ color: "rgba(148,163,184,0.8)" }}>Full range (0 ↔ ∞)</span>
            ) : (
              <>
                <span className="font-semibold text-gray-300">{fmtPrice(minPrice)}</span>
                <svg viewBox="0 0 16 8" className="w-3.5 h-2 shrink-0 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M1 4h14M12 1.5L14.5 4 12 6.5M4 1.5L1.5 4 4 6.5"/></svg>
                <span className="font-semibold text-gray-300">{fmtPrice(maxPrice)}</span>
                <span className="text-[9px]" style={{ color: "rgba(100,116,139,0.45)" }}>USDC/WPROS</span>
              </>
            )}
          </div>
        </div>

        {/* Amounts */}
        {(hasLiq || hasFees) && (
          <div className="pl-5 pr-4 pb-3 flex flex-wrap gap-2">
            {hasLiq && (
              <div className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[9px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color: "rgba(100,116,139,0.55)" }}>Liquidity</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-data" style={{ color: "rgba(148,163,184,0.6)" }}>WPROS</span>
                    <span className="text-[11px] font-data font-semibold text-gray-200">{p.amount0WPROS.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-data" style={{ color: "rgba(148,163,184,0.6)" }}>USDC</span>
                    <span className="text-[11px] font-data font-semibold text-gray-200">{p.amount1USDC.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            )}
            {hasFees && (
              <div className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.14)" }}>
                <p className="text-[9px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color: "rgba(251,191,36,0.6)" }}>Uncollected fees</p>
                <div className="space-y-1">
                  {p.feesWPROS > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-data" style={{ color: "rgba(251,191,36,0.55)" }}>WPROS</span>
                      <span className="text-[11px] font-data font-semibold" style={{ color: "rgba(251,191,36,0.9)" }}>{p.feesWPROS.toFixed(6)}</span>
                    </div>
                  )}
                  {p.feesUSDC > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-data" style={{ color: "rgba(251,191,36,0.55)" }}>USDC</span>
                      <span className="text-[11px] font-data font-semibold" style={{ color: "rgba(251,191,36,0.9)" }}>{p.feesUSDC.toFixed(6)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer: actions */}
        <div className="flex items-center justify-between gap-2 pl-5 pr-4 py-2.5 border-t" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.15)" }}>
          <a href={`https://pharos.socialscan.io/token/${FAROSWAP.NPM}/instance/${String(p.tokenId)}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-medium transition-colors shrink-0" style={{ color: "rgba(0,212,255,0.4)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.8)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.4)")}>
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 2H2.5A1.5 1.5 0 001 3.5v5A1.5 1.5 0 002.5 10h5A1.5 1.5 0 009 8.5V7M7 1h4v4M11 1L5.5 6.5"/></svg>
            View NFT
          </a>
          <div className="flex items-center gap-2">
            {/* Collect Fees — whenever there are uncollected fees */}
            {onCollect && hasFees && (
              <button onClick={() => onCollect(p)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200"
                style={{ background: "rgba(251,191,36,0.09)", border: "1px solid rgba(251,191,36,0.25)", color: "rgba(251,191,36,0.9)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,191,36,0.18)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(251,191,36,0.45)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,191,36,0.09)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(251,191,36,0.25)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "";
                }}>
                <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M7 12V2M3 6l4-4 4 4"/>
                </svg>
                Collect Fees
              </button>
            )}
            {/* Remove Liquidity — whenever the position still has liquidity */}
            {onRemove && hasLiq && (
              <button onClick={() => onRemove(p)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200"
                style={{ background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.25)", color: "rgba(248,113,113,0.9)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.18)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.45)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.09)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.25)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "";
                }}>
                <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M3 7h8"/>
                </svg>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function Group({ title, badge, color, items }: { title: string; badge: string; color: string; items: V3Position[] }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          <span className="text-[10px] uppercase tracking-[0.12em] font-bold" style={{ color }}>{title}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>{badge}</span>
          <span className="flex-1 h-px" style={{ background: `${color}12` }} />
        </div>
        <div className="flex flex-col gap-2.5">
          {items.map(p => <PositionCard key={String(p.tokenId)} p={p} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Group title="In Range" badge={`${inRange.length}`} color="rgba(52,211,153,0.85)" items={inRange} />
      <Group title="Out of Range" badge={`${outRange.length}`} color="rgba(251,191,36,0.85)" items={outRange} />
      <Group title="Closed" badge={`${closed.length}`} color="rgba(148,163,184,0.55)" items={closed} />
      {positions[0]?.currentPriceUSDC > 0 && (
        <p className="text-[10px] font-data text-right" style={{ color: "rgba(100,116,139,0.45)" }}>
          Pool price: ~{positions[0].currentPriceUSDC.toFixed(4)} USDC/WPROS
        </p>
      )}
    </div>
  );
}

// ─── liquidity tx button ───────────────────────────────────────────────────

function LiquidityTxButton({ liquidityPending, walletAddress, onSuccess, onError, onReverted }: {
  liquidityPending: LiquidityPendingTx; walletAddress: string; onSuccess: (hash: string) => void; onError: (msg: string) => void; onReverted: (hash: string) => void;
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
      const ethersProvider = getBrowserProvider();
      const signer = await ethersProvider.getSigner();

      // Re-validate for the wallet that is ACTUALLY signing (the user may have
      // switched accounts after this card was built, or the deadline expired).
      // Fresh balances, fresh allowances, calldata rebuilt for the signer.
      const signerAddr = await signer.getAddress();
      const pre = await preflightMint(result, signerAddr);
      if (!pre.ok) {
        setStep("idle");
        onError(
          `Insufficient ${pre.errorToken} in the active wallet (${signerAddr.slice(0, 6)}…${signerAddr.slice(-4)}): ` +
          `you have ${(pre.have ?? 0).toFixed(6)} but this position needs ${(pre.need ?? 0).toFixed(6)}. ` +
          `Restart the liquidity flow ("add liquidity") so I rebuild it with this wallet's balances.`
        );
        return;
      }

      if (pre.needsApproval0) {
        setStep("approving_wpros");
        const approveData = buildApproveCalldata(FAROSWAP.NPM, result.wprosRaw);
        const tx0 = await signer.sendTransaction({ to: FAROSWAP.WPROS, data: approveData });
        setStep("confirming_wpros");
        await tx0.wait(1);
      }
      if (pre.needsApproval1) {
        setStep("approving_usdc");
        const approveData = buildApproveCalldata(FAROSWAP.NPM, result.usdcRaw);
        const tx1 = await signer.sendTransaction({ to: FAROSWAP.USDC, data: approveData });
        setStep("confirming_usdc");
        await tx1.wait(1);
      }
      setStep("minting");
      const mintTx = await signer.sendTransaction({ to: FAROSWAP.NPM, data: pre.mintCalldata, value: 0n });
      const receipt = await mintTx.wait(1);
      if (receipt && receipt.status === 1) {
        setStep("done");
        onSuccess(mintTx.hash);
      } else {
        setStep("idle");
        onReverted(mintTx.hash);
      }
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
    <>
    {!needsAny && <GasEstimateLine txs={[{ from: walletAddress, to: FAROSWAP.NPM, data: result.mintCalldata }]} />}
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
    </>
  );
}

// ─── remove liquidity tx button ───────────────────────────────────────────

function RemoveLiquidityTxButton({ removeLiquidityPending, walletAddress, onSuccess, onError, onReverted }: {
  removeLiquidityPending: RemoveLiquidityPendingTx; walletAddress: string;
  onSuccess: (hash: string) => void; onError: (msg: string) => void; onReverted: (hash: string) => void;
}) {
  type Step = "idle" | "switching" | "decreasing" | "confirming_decrease" | "collecting" | "done";
  const [step, setStep] = useState<Step>("idle");
  const { result } = removeLiquidityPending;
  const isCollectOnly = result.collectOnly;

  const stepLabels: Record<Step, string> = {
    idle: isCollectOnly ? "Collect Fees" : "Remove Liquidity",
    switching: "Switching to Pharos…",
    decreasing: "Removing liquidity…",
    confirming_decrease: "Confirming removal…",
    collecting: isCollectOnly ? "Collecting fees…" : "Collecting tokens + fees…",
    done: "Done!",
  };

  async function handleRemove() {
    try {
      setStep("switching");
      await switchToChain("Pharos");
      const ethersProvider = getBrowserProvider();
      const signer = await ethersProvider.getSigner();

      // These txs use a manual gasLimit (no estimateGas safety net), so a
      // wrong-wallet signer would burn real gas on a guaranteed revert.
      // Verify the ACTIVE wallet still owns this LP NFT before sending.
      const signerAddr = (await signer.getAddress()).toLowerCase();
      const owner = (await ownerOfPosition(result.tokenId)).toLowerCase();
      if (owner && owner !== signerAddr) {
        setStep("idle");
        onError(
          `The active wallet (${signerAddr.slice(0, 6)}…${signerAddr.slice(-4)}) does not own position #${result.tokenId}. ` +
          `Switch back to the wallet that owns it, or ask "show my liquidity positions" to list this wallet's positions.`
        );
        return;
      }

      if (!isCollectOnly) {
        setStep("decreasing");
        // Manual gasLimit bypasses estimateGas which can fail on FaroSwap's modified NPM
        const tx1 = await signer.sendTransaction({
          to: FAROSWAP.NPM, data: result.decreaseCalldata, value: 0n,
          gasLimit: 350000n,
        });
        setStep("confirming_decrease");
        const receipt1 = await tx1.wait(1);
        if (!receipt1 || receipt1.status !== 1) {
          setStep("idle");
          onReverted(tx1.hash);
          return;
        }
      }

      setStep("collecting");
      // Manual gasLimit bypasses estimateGas — FaroSwap NPM's collect can fail during
      // gas estimation even when the actual tx would succeed
      const tx2 = await signer.sendTransaction({
        to: FAROSWAP.NPM, data: result.collectCalldata, value: 0n,
        gasLimit: 350000n,
      });
      const receipt2 = await tx2.wait(1);
      if (receipt2 && receipt2.status === 1) {
        setStep("done");
        onSuccess(tx2.hash);
      } else {
        setStep("idle");
        onReverted(tx2.hash);
      }
    } catch (err: unknown) {
      setStep("idle");
      const msg = err instanceof Error ? err.message : String(err);
      const isRejected = /user rejected|user denied|rejected the request/i.test(msg);
      if (isRejected) {
        onError("Transaction rejected by user.");
      } else if (/require\(false\)|execution reverted/i.test(msg)) {
        onError(
          isCollectOnly
            ? "Não foi possível coletar fees desta posição. Tente diretamente no FaroSwap: https://faroswap.xyz"
            : "Falha ao remover liquidez. Verifique a posição no Pharosscan e tente no FaroSwap diretamente."
        );
      } else {
        onError(msg);
      }
    }
  }

  const isIdle = step === "idle";
  const isDone = step === "done";
  const btnBg = isDone
    ? "linear-gradient(135deg,#0ea5e9,#38bdf8)"
    : isCollectOnly
    ? "linear-gradient(135deg,#d97706 0%,#fbbf24 50%,#b45309 100%)"
    : "linear-gradient(135deg,#ef4444 0%,#f87171 50%,#dc2626 100%)";
  const btnShadow = isIdle
    ? isCollectOnly ? "0 4px 18px rgba(251,191,36,0.32), inset 0 1px 0 rgba(255,255,255,0.2)" : "0 4px 18px rgba(239,68,68,0.32), inset 0 1px 0 rgba(255,255,255,0.2)"
    : "none";
  return (
    <>
    <GasEstimateLine txs={
      isCollectOnly
        ? [{ from: walletAddress, to: FAROSWAP.NPM, data: result.collectCalldata }]
        : [{ from: walletAddress, to: FAROSWAP.NPM, data: result.decreaseCalldata },
           { from: walletAddress, to: FAROSWAP.NPM, data: result.collectCalldata }]
    } />
    <button onClick={handleRemove} disabled={!isIdle}
      className="mt-4 w-full h-11 px-6 rounded-xl font-semibold text-sm text-black transition-all duration-200 relative overflow-hidden flex items-center justify-center gap-2"
      style={{ background: btnBg, boxShadow: btnShadow }}
      onMouseEnter={(e) => { if (!isIdle) return; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}>
      {isIdle && <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.15) 50%,transparent 60%)", animation: "shimmer 3s ease-in-out infinite" }} />}
      {!isIdle && !isDone && <Spinner />}
      <span className="relative">{stepLabels[step]}</span>
    </button>
    </>
  );
}

// ─── percentage quick-pick buttons ──────────────────────────────────────────

function PercentageButtons({ balance, onSelect, min, token }: { balance: number; onSelect: (amount: number) => void; min?: number; token?: string }) {
  const [custom, setCustom] = useState("");
  const [customErr, setCustomErr] = useState<string | null>(null);
  const percentages = [
    { label: "25%", pct: 0.25 },
    { label: "50%", pct: 0.50 },
    { label: "75%", pct: 0.75 },
    { label: "100%", pct: 1.00 },
  ];

  const submitCustom = () => {
    const amt = parseFloat(custom.replace(",", "."));
    if (!(amt > 0)) { setCustomErr("Enter a valid amount."); return; }
    if (min != null && amt < min) { setCustomErr(`Minimum: ${min} ${token ?? ""}`.trim()); return; }
    if (amt > balance) { setCustomErr(`You only have ${balance.toFixed(4)} ${token ?? ""}`.trim()); return; }
    setCustomErr(null);
    onSelect(amt);
  };

  return (
    <>
    <div className="mt-4 flex gap-2 flex-wrap">
      {percentages.map((p) => (
        <button key={p.label} onClick={() => onSelect(balance * p.pct)}
          className="flex-1 min-w-[80px] px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", color: "rgba(0,212,255,0.85)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.15)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.45)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.08)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.25)";
            (e.currentTarget as HTMLButtonElement).style.transform = "";
          }}>
          {p.label}
        </button>
      ))}
    </div>
    <div className="mt-2">
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={custom}
          onChange={(e) => { setCustom(e.target.value); setCustomErr(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitCustom(); } }}
          placeholder={min != null ? `Custom amount (min ${min})` : "Custom amount"}
          className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(0,212,255,0.2)", color: "rgba(215,228,245,0.92)" }}
        />
        <button onClick={submitCustom}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)", color: "rgba(0,212,255,0.9)" }}>
          OK
        </button>
      </div>
      {customErr && (
        <p className="mt-1.5 text-xs" style={{ color: "rgba(251,113,133,0.9)" }}>{customErr}</p>
      )}
    </div>
    </>
  );
}

// ─── remove liquidity % selector ──────────────────────────────────────────

function RemovePctSelector({ position, onSelect }: { position: V3Position; onSelect: (pct: number) => void }) {
  const [hoveredPct, setHoveredPct] = useState<number | null>(null);
  const isCollectOnly = position.liquidity === 0n;
  const hasFees = position.feesWPROS > 0.000001 || position.feesUSDC > 0.000001;
  const pcts = [
    { label: "25%", pct: 25, accent: "rgba(56,189,248,0.85)" },
    { label: "50%", pct: 50, accent: "rgba(99,102,241,0.85)" },
    { label: "75%", pct: 75, accent: "rgba(251,191,36,0.85)" },
    { label: "100%", pct: 100, accent: "rgba(239,68,68,0.85)" },
  ];
  const display = hoveredPct ?? 100;
  const previewWpros = (position.amount0WPROS * display / 100).toFixed(6);
  const previewUsdc  = (position.amount1USDC  * display / 100).toFixed(6);

  if (isCollectOnly) {
    return (
      <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: "rgba(7,14,30,0.85)", border: "1px solid rgba(251,191,36,0.2)", backdropFilter: "blur(14px)" }}>
        <div className="px-4 py-3 flex items-center gap-2.5 border-b" style={{ borderColor: "rgba(251,191,36,0.1)", background: "rgba(251,191,36,0.04)" }}>
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}>
            <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="rgba(251,191,36,0.9)" strokeWidth="1.7" strokeLinecap="round"><path d="M7 12V2M3 6l4-4 4 4"/></svg>
          </span>
          <div>
            <p className="text-xs font-bold text-white">Collect Fees</p>
            <p className="text-[10px] font-data" style={{ color: "rgba(251,191,36,0.5)" }}>
              NFT #{String(position.tokenId)} · Closed · {(position.fee / 10000).toFixed(2)}% tier
            </p>
          </div>
        </div>
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-data">
            <span style={{ color: "rgba(100,116,139,0.75)" }}>WPROS fees</span>
            <span className="text-right font-semibold" style={{ color: "rgba(251,191,36,0.9)" }}>{position.feesWPROS.toFixed(6)}</span>
            {position.feesUSDC > 0 && (<>
              <span style={{ color: "rgba(100,116,139,0.75)" }}>USDC fees</span>
              <span className="text-right font-semibold" style={{ color: "rgba(251,191,36,0.9)" }}>{position.feesUSDC.toFixed(6)}</span>
            </>)}
          </div>
          <button onClick={() => onSelect(0)}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
            style={{ background: "linear-gradient(135deg,#d97706,#fbbf24,#b45309)", boxShadow: "0 4px 16px rgba(251,191,36,0.28)", color: "#000" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}>
            Collect All Fees
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: "rgba(7,14,30,0.85)", border: "1px solid rgba(239,68,68,0.18)", backdropFilter: "blur(14px)" }}>
      <div className="px-4 py-3 flex items-center gap-2.5 border-b" style={{ borderColor: "rgba(239,68,68,0.1)", background: "rgba(239,68,68,0.04)" }}>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="rgba(248,113,113,0.9)" strokeWidth="1.7" strokeLinecap="round"><path d="M3 7h8"/></svg>
        </span>
        <div>
          <p className="text-xs font-bold text-white">Remove Liquidity</p>
          <p className="text-[10px] font-data" style={{ color: "rgba(239,68,68,0.5)" }}>
            NFT #{String(position.tokenId)} · {(position.fee / 10000).toFixed(2)}% tier · {position.inRange ? "In Range" : "Out of Range"}
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <p className="text-[10px] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: "rgba(148,163,184,0.4)" }}>
          You will receive (~{display}%)
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-data">
          <span style={{ color: "rgba(100,116,139,0.75)" }}>WPROS</span>
          <span className="text-right font-semibold text-gray-200">{previewWpros}</span>
          <span style={{ color: "rgba(100,116,139,0.75)" }}>USDC</span>
          <span className="text-right font-semibold text-gray-200">{previewUsdc}</span>
          {hasFees && (
            <span className="col-span-2 mt-1" style={{ color: "rgba(251,191,36,0.55)", fontSize: "10px" }}>
              + all uncollected fees: {position.feesWPROS.toFixed(6)} WPROS + {position.feesUSDC.toFixed(6)} USDC
            </span>
          )}
        </div>
      </div>

      {/* Pct buttons */}
      <div className="px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.1em] font-semibold mb-2.5" style={{ color: "rgba(148,163,184,0.35)" }}>
          How much to remove?
        </p>
        <div className="grid grid-cols-4 gap-2">
          {pcts.map(({ label, pct, accent }) => (
            <button key={pct}
              onClick={() => onSelect(pct)}
              onMouseEnter={(e) => {
                setHoveredPct(pct);
                (e.currentTarget as HTMLButtonElement).style.background = `${accent}22`;
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                setHoveredPct(null);
                (e.currentTarget as HTMLButtonElement).style.background = `${accent}12`;
                (e.currentTarget as HTMLButtonElement).style.transform = "";
              }}
              className="py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex flex-col items-center gap-0.5"
              style={{ background: `${accent}12`, border: `1px solid ${accent}30`, color: accent }}>
              {label}
            </button>
          ))}
        </div>

        {/* Collect fees only — keep liquidity, just claim earnings */}
        {hasFees && (
          <button onClick={() => onSelect(0)}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
            style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.22)", color: "rgba(251,191,36,0.9)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,191,36,0.14)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(251,191,36,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,191,36,0.07)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(251,191,36,0.22)";
            }}>
            <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M7 12V2M3 6l4-4 4 4"/></svg>
            Collect fees only — keep liquidity
          </button>
        )}
      </div>
    </div>
  );
}

// ─── remove position selector ────────────────────────────────────────────────

function RemovePositionSelector({ positions, onSelect }: { positions: V3Position[]; onSelect: (position: V3Position) => void }) {
  const withLiq  = positions.filter(p => p.liquidity > 0n);
  const outRange = withLiq.filter(p => !p.inRange);
  const inRange  = withLiq.filter(p => p.inRange);
  // Closed positions with uncollected fees (liquidity=0 but fees pending)
  const closed   = positions.filter(p => p.liquidity === 0n && (p.feesWPROS > 0.000001 || p.feesUSDC > 0.000001));

  function Row({ pos, label, accent }: { pos: V3Position; label: string; accent: string }) {
    const hasLiq = pos.liquidity > 0n;
    return (
      <button onClick={() => onSelect(pos)}
        className="flex items-center justify-between w-full px-3.5 py-3 rounded-xl text-left transition-all duration-200"
        style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${accent}30` }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = `${accent}10`;
          (e.currentTarget as HTMLButtonElement).style.borderColor = `${accent}55`;
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = `${accent}30`;
          (e.currentTarget as HTMLButtonElement).style.transform = "";
        }}>
        <div>
          <p className="text-sm font-semibold text-white">NFT #{String(pos.tokenId)}</p>
          <p className="text-[11px] font-data mt-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>
            {hasLiq
              ? `${(pos.fee / 10000).toFixed(2)}% · ${pos.amount0WPROS.toFixed(4)} WPROS + ${pos.amount1USDC.toFixed(4)} USDC`
              : `${(pos.fee / 10000).toFixed(2)}% · Fees: ${pos.feesWPROS.toFixed(6)} WPROS${pos.feesUSDC > 0 ? ` + ${pos.feesUSDC.toFixed(6)} USDC` : ""}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: accent, background: `${accent}15`, border: `1px solid ${accent}35` }}>{label}</span>
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 shrink-0" fill="none" stroke={accent} strokeOpacity="0.6" strokeWidth="1.7" strokeLinecap="round">
            <path d="M5 2.5h4M2 4h10M4 4l.7 7.5a1 1 0 001 .99h4.6a1 1 0 001-.99L12 4"/>
          </svg>
        </div>
      </button>
    );
  }

  function Group({ title, color, items, label, accent }: { title: string; color: string; items: V3Position[]; label: string; accent: string }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-2">
        <p className="text-[10px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color }}>{title} ({items.length})</p>
        <div className="flex flex-col gap-1.5">{items.map(p => <Row key={String(p.tokenId)} pos={p} label={label} accent={accent} />)}</div>
      </div>
    );
  }

  if (withLiq.length === 0 && closed.length === 0) {
    return (
      <div className="mt-3 px-3 py-3 rounded-xl" style={{ background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.15)" }}>
        <p className="text-sm" style={{ color: "rgba(148,163,184,0.55)" }}>Nenhuma posição ativa ou com fees pendentes encontrada.</p>
        <p className="text-xs mt-1" style={{ color: "rgba(100,116,139,0.4)" }}>Diga "adicionar liquidez" para criar uma nova posição no FaroSwap.</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-3" style={{ color: "rgba(239,68,68,0.5)" }}>
        Select position to remove
      </p>
      <Group title="Out of Range" color="rgba(251,191,36,0.7)" items={outRange} label="Out of Range" accent="rgba(251,191,36,0.8)" />
      <Group title="In Range" color="rgba(52,211,153,0.7)" items={inRange} label="In Range" accent="rgba(52,211,153,0.8)" />
      <Group title="Closed — Collect Fees" color="rgba(148,163,184,0.5)" items={closed} label="Collect Fees" accent="rgba(251,191,36,0.8)" />
    </div>
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

function LiquidityPanel({ liquidityPending, walletAddress, onSuccess, onError, onReverted }: {
  liquidityPending: LiquidityPendingTx; walletAddress: string; onSuccess: (hash: string) => void; onError: (msg: string) => void; onReverted: (hash: string) => void;
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
        <LiquidityTxButton liquidityPending={liquidityPending} walletAddress={walletAddress} onSuccess={onSuccess} onError={onError} onReverted={onReverted} />
      </div>
    </div>
  );
}

// ─── markdown style constants ──────────────────────────────────────────────

const MD_SHADOW_HEADER = "0 1px 0 rgba(56,189,248,0.4), 0 2px 0 rgba(56,189,248,0.25), 0 3px 2px rgba(0,0,0,0.6), 0 0 12px rgba(0,212,255,0.25)";
const MD_SHADOW_BOLD   = "0 0 8px rgba(0,212,255,0.2), 0 1px 0 rgba(56,189,248,0.15)";
const MD_FONT_DISPLAY  = "var(--font-display), var(--font-inter), sans-serif";

// ─── chat bubble ───────────────────────────────────────────────────────────

function ChatBubble({ msg, walletAddress, lang, onTxSuccess, onTxError, onTxReverted, onProviderChoice, onSwapChoice, onWalletChoice, onAmountPicked, onPositionSelect, onPctSelect, onBridgeWizardSubmit, onBridgeRouteChoice, onSwapWizardSubmit, onLiquidityWizardSubmit, onTransferWizardSubmit }: {
  msg: Message; walletAddress: string; lang: "pt" | "en";
  onTxSuccess: (id: string, hash: string) => void;
  onTxError: (id: string, err: string) => void;
  onTxReverted: (id: string, hash: string) => void;
  onProviderChoice: (id: string, intent: ParsedIntent, provider: "lifi" | "ccip" | "cctp") => void;
  onSwapChoice: (id: string, opt: SwapRouteOption) => void;
  onWalletChoice: (id: string, opt: WalletOption) => void;
  onAmountPicked: (amount: number, token: string) => void;
  onPositionSelect: (msgId: string, position: V3Position) => void;
  onPctSelect: (msgId: string, position: V3Position, pct: number) => void;
  onBridgeWizardSubmit: (msgId: string, token: string, amount: number, toChain: string) => void;
  onBridgeRouteChoice: (msgId: string, opt: BridgeRouteOption) => void;
  onSwapWizardSubmit: (msgId: string, fromToken: string, amount: number, toToken: string) => void;
  onLiquidityWizardSubmit: (msgId: string, params: { feeTier: number; rangeMode: "percent" | "full"; rangePercent?: number; wprosAmount: number }) => void;
  onTransferWizardSubmit: (msgId: string, token: string, amount: number, recipients: string[]) => void;
}) {
  const isUser = msg.role === "user";

  // ── Streaming reveal: when an agent message finishes loading, its text is
  // typed out progressively instead of appearing all at once. Skipped for
  // code blocks / tables (markdown flickers mid-parse) and very long texts.
  const [revealLen, setRevealLen] = useState<number | null>(null);
  const wasLoadingRef = useRef(!!(msg.isLoading || msg.isSearching));
  const revealTextRef = useRef("");

  useEffect(() => {
    const nowLoading = !!(msg.isLoading || msg.isSearching);
    if (
      !isUser && wasLoadingRef.current && !nowLoading && msg.text &&
      !msg.isError && msg.text.length <= 4000 &&
      !msg.text.includes("```") && !/\n\s*\|/.test(msg.text)
    ) {
      revealTextRef.current = msg.text;
      setRevealLen(0);
    }
    wasLoadingRef.current = nowLoading;
  }, [msg.isLoading, msg.isSearching, msg.text, msg.isError, isUser]);

  useEffect(() => {
    if (revealLen === null) return;
    const full = revealTextRef.current;
    if (revealLen >= full.length || full !== msg.text) {
      setRevealLen(null);
      return;
    }
    // ~1.2s total reveal regardless of length, in word-sized steps.
    const step = Math.max(3, Math.ceil(full.length / 50));
    const t = setTimeout(() => {
      setRevealLen((c) => (c === null ? null : Math.min(full.length, c + step)));
    }, 24);
    return () => clearTimeout(t);
  }, [revealLen, msg.text]);

  const displayText =
    revealLen !== null && revealTextRef.current === msg.text
      ? msg.text.slice(0, revealLen)
      : msg.text;

  /* ── User message ────────────────────────────────────────────────────── */
  if (isUser) {
    return (
      <div className="flex justify-end mb-6 msg-enter">
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="px-4 py-3 text-[0.9375rem] leading-[1.75] chat-user-bubble">
            {msg.text}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-7 msg-enter group">
      <div className="shrink-0 mt-0.5">
        <AgentOrb size="sm" show3d={false} />
      </div>
      <div className="flex-1 min-w-0 chat-agent-content">

        {/* Text content */}
        {(msg.text || msg.isLoading) && (
          <div className={`text-[0.9375rem] leading-[1.85] mb-1 ${msg.isError ? "p-4 rounded-2xl glass-panel" : ""}`}
            style={msg.isError ? {
              borderColor: "rgba(239,68,68,0.22)",
              background: "rgba(239,68,68,0.06)",
            } : { color: "rgba(226,232,240,0.92)" }}>
            {msg.isLoading ? (
              <div className="flex items-center gap-3 py-1" style={{ color: "rgba(148,163,184,0.55)" }}>
                <Spinner />
                <span className="text-sm">{msg.text || "Thinking…"}</span>
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="mb-3 last:mb-0 text-sm leading-[1.8]" style={{ color: "rgba(215,230,248,0.88)" }}>{children}</p>
                  ),
                  strong: ({ children }) => {
                    const text = String(children);
                    const isHead = /^[A-Z0-9 _\-&]{4,}$/.test(text);
                    return isHead ? (
                      <strong style={{
                        display: "block", fontFamily: MD_FONT_DISPLAY, fontWeight: 800,
                        fontSize: "0.68rem", letterSpacing: "0.1em",
                        color: "rgba(0,212,255,0.7)", marginBottom: "0.4rem", marginTop: "0.75rem",
                        textTransform: "uppercase",
                      }}>{children}</strong>
                    ) : (
                      <strong style={{ fontWeight: 700, color: "rgba(255,255,255,0.97)" }}>{children}</strong>
                    );
                  },
                  em: ({ children }) => <em className="italic" style={{ color: "rgba(186,207,230,0.75)" }}>{children}</em>,
                  ul: ({ children }) => <ul className="mb-3 mt-1 space-y-1.5 list-none pl-0">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-3 mt-1 pl-5 space-y-1.5 list-decimal" style={{ color: "rgba(215,228,245,0.85)" }}>{children}</ol>,
                  li: ({ children }) => (
                    <li className="flex items-start gap-2.5 text-sm leading-[1.7]" style={{ color: "rgba(215,228,245,0.85)" }}>
                      <span className="shrink-0 mt-[0.5em] w-[5px] h-[5px] rounded-full" style={{ background: "rgba(0,212,255,0.5)" }} />
                      <span>{children}</span>
                    </li>
                  ),
                  h1: ({ children }) => <h1 style={{ fontFamily: MD_FONT_DISPLAY, fontWeight: 800, fontSize: "1rem", color: "#7dd3fc", marginBottom: "0.5rem", marginTop: "1rem" }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontFamily: MD_FONT_DISPLAY, fontWeight: 700, fontSize: "0.875rem", color: "#7dd3fc", marginBottom: "0.4rem", marginTop: "0.85rem" }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontFamily: MD_FONT_DISPLAY, fontWeight: 700, fontSize: "0.8rem", color: "#93c5fd", marginBottom: "0.3rem", marginTop: "0.7rem" }}>{children}</h3>,
                  code: ({ children }) => (
                    <code className="px-1.5 py-0.5 rounded-md text-[11.5px] font-mono" style={{ background: "rgba(0,212,255,0.07)", color: "rgba(0,212,255,0.9)", border: "1px solid rgba(0,212,255,0.13)" }}>{children}</code>
                  ),
                  pre: ({ children }) => (
                    <pre className="my-3 px-4 py-3 rounded-xl overflow-x-auto text-[11.5px] font-mono leading-relaxed" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(200,218,240,0.9)" }}>{children}</pre>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-2 transition-colors" style={{ color: "rgba(56,189,248,0.85)" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#38bdf8")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(56,189,248,0.85)")}>
                      {children}
                    </a>
                  ),
                  hr: () => <hr className="my-4" style={{ borderColor: "rgba(255,255,255,0.06)" }} />,
                  blockquote: ({ children }) => (
                    <blockquote className="pl-4 my-3 italic" style={{ borderLeft: "2px solid rgba(0,212,255,0.25)", color: "rgba(148,163,184,0.7)" }}>{children}</blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3 rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                      <table className="w-full text-xs border-collapse">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-widest" style={{ background: "rgba(0,212,255,0.07)", color: "rgba(0,212,255,0.65)", borderBottom: "1px solid rgba(0,212,255,0.12)" }}>{children}</th>,
                  td: ({ children }) => <td className="px-3 py-2.5 text-sm" style={{ color: "rgba(215,228,245,0.78)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{children}</td>,
                }}
              >
                {safeText(displayText ?? "")}
              </ReactMarkdown>
            )}
          </div>
        )}

        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-2.5 mb-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(100,116,139,0.35)" }}>Sources</span>
            {msg.sources.map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.1)", color: "rgba(0,212,255,0.45)" }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Action items - only on agent messages */}
        {msg.providerChoice && walletAddress && (
          <ProviderChoiceButtons choice={msg.providerChoice} onChoose={(provider) => onProviderChoice(msg.id, msg.providerChoice!.intent, provider)} />
        )}

        {msg.swapChoice && walletAddress && (
          <SwapChoiceButtons choice={msg.swapChoice} onChoose={(opt) => onSwapChoice(msg.id, opt)} />
        )}

        {msg.bridgeWizard && walletAddress && (
          <BridgeWizardCard state={msg.bridgeWizard} lang={lang}
            onSubmit={(token, amount, toChain) => onBridgeWizardSubmit(msg.id, token, amount, toChain)} />
        )}

        {msg.bridgeChoice && walletAddress && (
          <BridgeRouteButtons choice={msg.bridgeChoice} lang={lang} onChoose={(opt) => onBridgeRouteChoice(msg.id, opt)} />
        )}

        {msg.swapWizard && walletAddress && (
          <SwapWizardCard state={msg.swapWizard} lang={lang}
            onSubmit={(from, amount, to) => onSwapWizardSubmit(msg.id, from, amount, to)} />
        )}

        {msg.liquidityWizard && walletAddress && (
          <LiquidityWizardCard state={msg.liquidityWizard} lang={lang}
            onSubmit={(params) => onLiquidityWizardSubmit(msg.id, params)} />
        )}

        {msg.transferWizard && walletAddress && (
          <TransferWizardCard state={msg.transferWizard} lang={lang}
            onSubmit={(token, amount, recipients) => onTransferWizardSubmit(msg.id, token, amount, recipients)} />
        )}

        {msg.pending && walletAddress && (
          <div className="mt-3 px-4 py-3.5 rounded-2xl" style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.14)", backdropFilter: "blur(8px)" }}>
            <p className="text-[10px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color: "rgba(0,212,255,0.45)" }}>Ready to execute</p>
            <p className="text-xs font-data leading-relaxed mb-2" style={{ color: "rgba(148,163,184,0.65)" }}>{msg.pending.description}</p>
            <TxButton pending={msg.pending} walletAddress={walletAddress} onSuccess={(hash) => onTxSuccess(msg.id, hash)} onError={(err) => onTxError(msg.id, err)} onReverted={(hash) => onTxReverted(msg.id, hash)} />
          </div>
        )}

        {msg.liquidityPending && walletAddress && (
          <LiquidityPanel liquidityPending={msg.liquidityPending} walletAddress={walletAddress} onSuccess={(hash) => onTxSuccess(msg.id, hash)} onError={(err) => onTxError(msg.id, err)} onReverted={(hash) => onTxReverted(msg.id, hash)} />
        )}

        {msg.removeLiquidityPending && walletAddress && (() => {
          const r = msg.removeLiquidityPending!.result;
          const faroswapUrl = `https://faroswap.xyz/#/pool/${String(r.tokenId)}`;
          const scanUrl = `https://pharos.socialscan.io/token/${FAROSWAP.NPM}/instance/${String(r.tokenId)}`;
          const accentCol = r.simulationFailed ? "245,158,11" : r.collectOnly ? "251,191,36" : "239,68,68";
          return (
            <div className="mt-3 rounded-2xl overflow-hidden" style={{ background: "rgba(7,14,30,0.9)", border: `1px solid rgba(${accentCol},0.22)`, backdropFilter: "blur(16px)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid rgba(${accentCol},0.1)`, background: `rgba(${accentCol},0.04)` }}>
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `rgba(${accentCol},0.1)`, border: `1px solid rgba(${accentCol},0.25)` }}>
                    {r.collectOnly ? (
                      <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke={`rgba(${accentCol},0.9)`} strokeWidth="1.7" strokeLinecap="round"><path d="M7 12V2M3 6l4-4 4 4"/></svg>
                    ) : (
                      <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke={`rgba(${accentCol},0.9)`} strokeWidth="1.7" strokeLinecap="round"><path d="M3 7h8"/></svg>
                    )}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {r.collectOnly ? "Collect Fees" : "Remove Liquidity"}
                    </p>
                    <p className="text-[10px] mt-0.5 font-data" style={{ color: `rgba(${accentCol},0.55)` }}>NFT #{String(r.tokenId)} · FaroSwap V3</p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full font-semibold" style={{ background: `rgba(${accentCol},0.1)`, color: `rgba(${accentCol},0.85)`, border: `1px solid rgba(${accentCol},0.22)` }}>
                  {(r.feeTier / 10000).toFixed(2)}% pool
                </span>
              </div>
              <div className="px-4 py-3 space-y-2.5">
                <div className="flex flex-wrap gap-2">
                  {!r.collectOnly && (
                    <div className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-[9px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color: "rgba(100,116,139,0.55)" }}>Liquidity</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-data" style={{ color: "rgba(148,163,184,0.6)" }}>WPROS</span>
                          <span className="text-[11px] font-data font-semibold text-gray-200">{r.amount0WPROS.toFixed(6)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-data" style={{ color: "rgba(148,163,184,0.6)" }}>USDC</span>
                          <span className="text-[11px] font-data font-semibold text-gray-200">{r.amount1USDC.toFixed(6)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {(r.feesWPROS > 0 || r.feesUSDC > 0) && (
                    <div className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.14)" }}>
                      <p className="text-[9px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color: "rgba(251,191,36,0.6)" }}>Fees to collect</p>
                      <div className="space-y-1">
                        {r.feesWPROS > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-data" style={{ color: "rgba(251,191,36,0.55)" }}>WPROS</span>
                            <span className="text-[11px] font-data font-semibold" style={{ color: "rgba(251,191,36,0.9)" }}>{r.feesWPROS.toFixed(6)}</span>
                          </div>
                        )}
                        {r.feesUSDC > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-data" style={{ color: "rgba(251,191,36,0.55)" }}>USDC</span>
                            <span className="text-[11px] font-data font-semibold" style={{ color: "rgba(251,191,36,0.9)" }}>{r.feesUSDC.toFixed(6)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {r.simulationFailed && (
                  <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <span style={{ color: "rgba(245,158,11,0.9)" }} className="shrink-0 text-sm mt-0.5">⚠</span>
                    <div className="space-y-2">
                      <p className="text-xs leading-relaxed font-semibold" style={{ color: "rgba(245,158,11,0.9)" }}>
                        Não é possível coletar fees via agent para esta posição. Use o FaroSwap diretamente.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <a href={faroswapUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                          style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "rgba(245,158,11,0.95)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(245,158,11,0.22)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(245,158,11,0.15)"; }}>
                          <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 7h8M8 4l3 3-3 3"/></svg>
                          Abrir no FaroSwap
                        </a>
                        <a href={scanUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200"
                          style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.18)", color: "rgba(0,212,255,0.75)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,212,255,0.12)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,212,255,0.07)"; }}>
                          View NFT
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {!r.simulationFailed && r.collectOnly && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.14)" }}>
                    <span style={{ color: "rgba(251,191,36,0.85)" }} className="shrink-0 text-xs">ℹ</span>
                    <span className="text-xs leading-relaxed" style={{ color: "rgba(251,191,36,0.75)" }}>Position is closed — only uncollected fees will be collected.</span>
                  </div>
                )}
                {!r.simulationFailed && !r.collectOnly && (r.feesWPROS > 0 || r.feesUSDC > 0) && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.14)" }}>
                    <span style={{ color: "rgba(251,191,36,0.85)" }} className="shrink-0 text-xs">★</span>
                    <span className="text-xs leading-relaxed" style={{ color: "rgba(251,191,36,0.75)" }}>Uncollected fees included automatically.</span>
                  </div>
                )}
              </div>

              {!r.simulationFailed && (
                <div className="px-4 pb-4">
                  <RemoveLiquidityTxButton
                    removeLiquidityPending={msg.removeLiquidityPending!}
                    walletAddress={walletAddress}
                    onSuccess={(hash) => onTxSuccess(msg.id, hash)}
                    onError={(err) => onTxError(msg.id, err)}
                    onReverted={(hash) => onTxReverted(msg.id, hash)}
                  />
                </div>
              )}
            </div>
          );
        })()}

        {msg.amountQuery && (
          <div className="mt-3">
            <p className="text-sm mb-2" style={{ color: "rgba(215,228,245,0.88)" }}>
              You have <span className="font-semibold text-white">{msg.amountQuery.balance.toFixed(4)} {msg.amountQuery.token}</span> on {msg.amountQuery.chain}.
              {msg.amountQuery.min != null && (
                <span className="block mt-0.5 text-xs" style={{ color: "rgba(148,197,255,0.75)" }}>
                  Minimum: {msg.amountQuery.min} {msg.amountQuery.token}
                </span>
              )}
            </p>
            <PercentageButtons balance={msg.amountQuery.balance} min={msg.amountQuery.min} token={msg.amountQuery.token} onSelect={(amount) => {
              onAmountPicked(amount, msg.amountQuery!.token);
            }} />
          </div>
        )}

        {msg.positions && !msg.removeMode && (
          <PositionCards
            positions={msg.positions}
            onRemove={(pos) => onPositionSelect(msg.id, pos)}
            onCollect={(pos) => onPctSelect(msg.id, pos, 0)}
          />
        )}

        {msg.positions && msg.removeMode && (
          <RemovePositionSelector positions={msg.positions} onSelect={(pos) => onPositionSelect(msg.id, pos)} />
        )}

        {msg.removePctPending && (
          <RemovePctSelector
            position={msg.removePctPending.position}
            onSelect={(pct) => onPctSelect(msg.id, msg.removePctPending!.position, pct)}
          />
        )}

        {msg.priceChart && <PriceChartCard symbol={msg.priceChart.symbol} />}

        {msg.walletIntel && <WalletScoreCard intel={msg.walletIntel} lang={lang} />}

        {msg.transferPending && walletAddress && (
          <TransferCard
            build={msg.transferPending}
            from={walletAddress}
            lang={/[ãõáéíóúâêôç]/i.test(msg.text) ? "pt" : "en"}
            onDone={(hash, error) => {
              if (error) onTxError(msg.id, error);
              else if (hash) onTxSuccess(msg.id, hash);
            }}
          />
        )}

        {msg.approvePending && walletAddress && (
          <ApproveCard
            tx={msg.approvePending}
            from={walletAddress}
            lang={/[ãõáéíóúâêôç]/i.test(msg.text) ? "pt" : "en"}
            onDone={(hash, error) => {
              if (error) onTxError(msg.id, error);
              else if (hash) onTxSuccess(msg.id, hash);
            }}
          />
        )}

        {msg.stakePending && walletAddress && (
          <StakeCard
            build={msg.stakePending}
            from={walletAddress}
            lang={/[ãõáéíóúâêôç]/i.test(msg.text) ? "pt" : "en"}
            onDone={(hash, error) => {
              if (error) onTxError(msg.id, error);
              else if (hash) onTxSuccess(msg.id, hash);
            }}
          />
        )}

        {msg.txHash && (
          <a href={`${PHAROS_NETWORKS[getSelectedNetwork()].explorerTx}${msg.txHash}`} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-200 text-xs font-semibold"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)", color: "rgba(52,211,153,0.85)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.14)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.08)"; }}>
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
            <span>Transação confirmada</span>
            <span className="font-data text-[10px] opacity-55">{msg.txHash.slice(0, 8)}…</span>
          </a>
        )}
      </div>
    </div>
  );
}

// ─── suggestion chips ──────────────────────────────────────────────────────

type QuickActionKind = "swap" | "bridge" | "liquidity" | "transfer" | "positions" | "wallet" | "score" | "realfi" | "stake" | "unstake" | "mystake" | "rwamarket" | "txhistory" | "approve" | "allowance";

const SUGGESTIONS: Array<{ label: string; icon: React.ReactNode; text?: string; action?: QuickActionKind }> = [
  { label: "Swap PROS → USDC", action: "swap",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 4h10M8 1.5l2.5 2.5L8 6.5M13 10H3M6 7.5L3.5 10 6 12.5" /></svg> },
  { label: "Bridge to Base", action: "bridge",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 1v12M3 4l4-3 4 3M3 10l4 3 4-3" /></svg> },
  { label: "Add Liquidity", action: "liquidity",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 1v12M1 7h12" /></svg> },
  { label: "Send tokens", action: "transfer",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 7h9M6 4l3 3-3 3M13 3v8"/></svg> },
  { label: "Stake PROS", action: "stake",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 10.5l5 2.5 5-2.5M2 7l5 2.5L12 7M7 1L2 3.5 7 6l5-2.5L7 1z"/></svg> },
  { label: "RWA Market", action: "rwamarket",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="7" cy="7" r="6"/><path d="M1 7h12M7 1c1.8 1.6 2.8 3.7 2.8 6S8.8 11.4 7 13C5.2 11.4 4.2 9.3 4.2 7S5.2 2.6 7 1z"/></svg> },
  { label: "My Positions", action: "positions",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1.5" y="4" width="11" height="8" rx="1.5"/><path d="M4 4V3a3 3 0 016 0v1"/></svg> },
  { label: "Wallet Score", action: "score",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 1l1.8 3.7 4.2.6-3 2.9.7 4.1L7 10.4 3.3 12.3l.7-4.1-3-2.9 4.2-.6L7 1z"/></svg> },
  { label: "RealFi Positions", action: "realfi",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1.5 12.5h11M2.5 12.5V6M5.5 12.5V6M8.5 12.5V6M11.5 12.5V6M1 6l6-4.5L13 6"/></svg> },
  { label: "What is Pharos?", text: "explain the Pharos Network architecture and what makes it unique",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="7" cy="7" r="6"/><path d="M7 6v4M7 4.5v.5"/></svg> },
  { label: "DeFi Protocols", text: "what DeFi protocols are available on Pharos?",
    icon: <svg viewBox="0 0 14 14" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 4h10v6H2zM5 4V2.5a2 2 0 014 0V4"/></svg> },
];

const WELCOME_CARDS: Array<{ icon: React.ReactNode; tkey: string; color: string; prompt?: string; action?: QuickActionKind }> = [
  {
    icon: <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>,
    tkey: "swap",
    action: "swap",
    color: "#00d4ff",
  },
  {
    icon: <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 2L2 6l8 4 8-4-8-4zM2 14l8 4 8-4M2 10l8 4 8-4" /></svg>,
    tkey: "bridge",
    action: "bridge",
    color: "#818cf8",
  },
  {
    icon: <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 2v18M15 5H8a3 3 0 000 6h4a3 3 0 010 6H5" /></svg>,
    tkey: "liq",
    action: "liquidity",
    color: "#34d399",
  },
  {
    icon: <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="10" cy="10" r="8"/><path d="M10 7v4l2.5 2.5"/></svg>,
    tkey: "expert",
    prompt: "what protocols are on Pharos and what can I earn?",
    color: "#f472b6",
  },
];

// ─── Wallet Score card (0-100 gauge + 6 category bars + protocols) ──────────

const LEVEL_COLORS: Record<string, string> = {
  Legend: "#f59e0b", Diamond: "#38bdf8", Gold: "#fbbf24",
  Silver: "#cbd5e1", Bronze: "#d97706", Newcomer: "#94a3b8",
};

function WalletScoreCard({ intel, lang }: { intel: WalletIntel; lang: "pt" | "en" }) {
  const color = LEVEL_COLORS[intel.level] ?? "#00d4ff";
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const dash = (intel.score / 100) * CIRC;

  const FLAG_LABELS: Record<string, { pt: string; en: string }> = {
    "high-failure-rate": { pt: "⚠ Muitas transações falhando", en: "⚠ High failure rate" },
    "whale-volume":      { pt: "🐋 Volume de whale", en: "🐋 Whale volume" },
    "defi-power-user":   { pt: "⚡ Power user DeFi", en: "⚡ DeFi power user" },
    "consistent-user":   { pt: "📅 Usuário consistente", en: "📅 Consistent user" },
    "rwa-investor":      { pt: "🏦 Investidor RWA", en: "🏦 RWA investor" },
  };

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-[#0a1322]/80 p-4">
      <div className="flex items-center gap-5 flex-wrap">
        {/* Gauge */}
        <div className="relative shrink-0" style={{ width: 116, height: 116 }}>
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
            <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${dash} ${CIRC - dash}`}
              style={{ filter: `drop-shadow(0 0 6px ${color}66)`, transition: "stroke-dasharray 0.8s ease" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white leading-none">{intel.score}</span>
            <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(148,163,184,0.6)" }}>/100</span>
          </div>
        </div>

        {/* Level + headline stats */}
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center gap-2">
            <span className="text-lg">{intel.levelEmoji}</span>
            <span className="text-base font-bold" style={{ color }}>{intel.level}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]" style={{ color: "rgba(200,215,235,0.75)" }}>
            <span>{lang === "pt" ? "Transações" : "Transactions"}: <b className="text-white">{intel.txTotal.toLocaleString("en-US")}</b></span>
            <span>{lang === "pt" ? "Gás gasto" : "Gas spent"}: <b className="text-white">{intel.gasSpentPros.toFixed(4)} PROS</b></span>
            <span>{lang === "pt" ? "Tokens únicos" : "Unique tokens"}: <b className="text-white">{intel.uniqueTokens.length}</b></span>
            <span>{lang === "pt" ? "Meses ativos" : "Active months"}: <b className="text-white">{intel.activeMonths}</b></span>
            {intel.failedTxs > 0 && (
              <span>{lang === "pt" ? "Txs falhadas" : "Failed txs"}: <b style={{ color: "#fbbf24" }}>{intel.failedTxs}</b></span>
            )}
            <span>{lang === "pt" ? "Protocolos" : "Protocols"}: <b className="text-white">{intel.protocols.length}</b></span>
          </div>
        </div>
      </div>

      {/* Category bars */}
      <div className="mt-4 flex flex-col gap-2">
        {intel.categories.map((c) => {
          const pct = (c.points / c.max) * 100;
          return (
            <div key={c.id}>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span style={{ color: "rgba(200,215,235,0.7)" }}>{lang === "pt" ? c.labelPt : c.label}</span>
                <span className="font-data" style={{ color: "rgba(148,163,184,0.6)" }}>{c.points}/{c.max} · {c.detail}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, transition: "width 0.6s ease" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Protocols + flags */}
      {(intel.protocols.length > 0 || intel.flags.length > 0) && (
        <div className="mt-3.5 flex gap-1.5 flex-wrap">
          {intel.protocols.map((p) => (
            <span key={p} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.16)", color: "rgba(125,211,252,0.85)" }}>
              {p}
            </span>
          ))}
          {intel.flags.map((f) => (
            <span key={f} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.18)", color: "rgba(110,231,183,0.85)" }}>
              {(FLAG_LABELS[f] ?? { pt: f, en: f })[lang]}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.45)" }}>
          {intel.truncated
            ? (lang === "pt" ? `Amostra: ${intel.txSampled} txs mais recentes` : `Sample: latest ${intel.txSampled} txs`)
            : (lang === "pt" ? "Histórico completo analisado" : "Full history analyzed")}
        </span>
        <a href={intel.explorer} target="_blank" rel="noopener noreferrer"
          className="text-[11px] font-semibold hover:underline" style={{ color: "rgba(0,212,255,0.75)" }}>
          {lang === "pt" ? "Ver no explorer ↗" : "View on explorer ↗"}
        </a>
      </div>
    </div>
  );
}

// ─── main chat page ────────────────────────────────────────────────────────

// ─── Price chart card (interactive: 24h / 7d / 30d + CEX links) ─────────────

function PriceChartCard({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRange>("7");
  const [points, setPoints] = useState<PricePoint[] | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<{ x: number; point: PricePoint } | null>(null);

  useEffect(() => {
    let alive = true;
    setPoints(null);
    setError(false);
    getPriceHistory(symbol, range)
      .then((p) => { if (alive) setPoints(p); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [symbol, range]);

  const W = 560;
  const H = 160;
  const PAD = 8;

  let path = "";
  let areaPath = "";
  let min = 0, max = 0, up = true;
  if (points && points.length > 1) {
    min = Math.min(...points.map((p) => p.p));
    max = Math.max(...points.map((p) => p.p));
    const span = max - min || 1;
    const step = (W - PAD * 2) / (points.length - 1);
    const coords = points.map((p, i) => ({
      x: PAD + i * step,
      y: PAD + (H - PAD * 2) * (1 - (p.p - min) / span),
    }));
    path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    areaPath = path + ` L${coords[coords.length - 1].x.toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;
    up = points[points.length - 1].p >= points[0].p;
  }

  const color = up ? "#34d399" : "#f87171";

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!points || points.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((relX - PAD) / (W - PAD * 2)) * (points.length - 1));
    const clamped = Math.max(0, Math.min(points.length - 1, idx));
    setHover({ x: PAD + clamped * ((W - PAD * 2) / (points.length - 1)), point: points[clamped] });
  }

  const fmtP = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`);

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-[#0a1322]/80 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-white/90">{symbol.toUpperCase()} · USD</div>
        <div className="flex gap-1">
          {(["1", "7", "30"] as ChartRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                range === r ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" : "text-white/50 hover:text-white/80 border border-transparent"
              }`}
            >
              {r === "1" ? "24h" : `${r}d`}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="text-xs text-white/40 py-8 text-center">Chart unavailable right now — try again shortly.</div>}
      {!error && !points && <div className="text-xs text-white/40 py-8 text-center animate-pulse">Loading chart…</div>}
      {!error && points && points.length > 1 && (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto cursor-crosshair"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#grad-${symbol})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
            {hover && (
              <>
                <line x1={hover.x} y1={PAD} x2={hover.x} y2={H - PAD} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3,3" />
                <circle
                  cx={hover.x}
                  cy={PAD + (H - PAD * 2) * (1 - (hover.point.p - min) / ((max - min) || 1))}
                  r="4"
                  fill={color}
                />
              </>
            )}
          </svg>
          {hover && (
            <div className="absolute top-1 left-2 rounded-lg bg-black/70 px-2 py-1 text-xs text-white/90 pointer-events-none">
              {fmtP(hover.point.p)} · {new Date(hover.point.t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          <div className="flex justify-between text-[11px] text-white/40 mt-1">
            <span>Low {fmtP(min)}</span>
            <span>High {fmtP(max)}</span>
          </div>
        </div>
      )}
      {symbol.toLowerCase().includes("pros") && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/5">
          <span className="text-[11px] text-white/40 uppercase tracking-wide">Trade:</span>
          {PROS_CEX_LINKS.map((l) => (
            <a
              key={l.name}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-cyan-300 hover:bg-cyan-500/15 border border-white/10 transition-colors"
            >
              {l.name} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Transfer (payment agent) card — sign 1..n txs sequentially ─────────────

function TransferCard({
  build, lang, onDone, from,
}: {
  build: TransferBuild;
  lang: "pt" | "en";
  onDone: (lastHash: string | null, error?: string) => void;
  from?: string;
}) {
  const [signing, setSigning] = useState(false);
  const [progress, setProgress] = useState(0);
  const net = PHAROS_NETWORKS[build.network];
  const displayLegs = build.legs ?? build.txs;
  const batched = !!build.legs && build.txs.length === 1;

  async function sign() {
    setSigning(true);
    let lastHash: string | null = null;
    try {
      await switchToChain(build.network === "testnet" ? "PharosTestnet" : "Pharos");
      for (let i = 0; i < build.txs.length; i++) {
        setProgress(i + 1);
        const tx = build.txs[i];
        lastHash = await sendTransaction({ to: tx.to, data: tx.data, value: tx.value });
      }
      onDone(lastHash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onDone(lastHash, msg);
    } finally {
      setSigning(false);
    }
  }

  const totals = Object.entries(build.totalByToken)
    .map(([sym, amt]) => `${amt.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${sym}`)
    .join(" + ");

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-[#0a1322]/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white/90">
          {lang === "pt" ? "💸 Pagamento" : "💸 Payment"}
          {batched
            ? (lang === "pt" ? ` (1 assinatura · ${displayLegs.length} envios)` : ` (1 signature · ${displayLegs.length} transfers)`)
            : build.txs.length > 1 ? ` (${build.txs.length} tx)` : ""}
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[11px] border ${build.network === "testnet" ? "border-amber-400/30 text-amber-300 bg-amber-500/10" : "border-cyan-400/30 text-cyan-300 bg-cyan-500/10"}`}>
          {net.label}
        </span>
      </div>
      <div className="space-y-1.5 mb-3">
        {displayLegs.map((tx, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-white/70">
            <span className="text-white/30">{i + 1}.</span>
            <span>{tx.description}</span>
            {signing && !batched && progress === i + 1 && <span className="text-cyan-300 animate-pulse">✍️</span>}
            {signing && !batched && progress > i + 1 && <span className="text-emerald-400">✓</span>}
            {signing && batched && progress < build.txs.length && i === 0 && <span className="text-cyan-300 animate-pulse">✍️</span>}
            {signing && batched && progress >= build.txs.length && <span className="text-emerald-400">✓</span>}
          </div>
        ))}
      </div>
      <div className="text-xs text-white/50 mb-3">
        {lang === "pt" ? "Total" : "Total"}: <span className="text-white/90 font-medium">{totals}</span>
      </div>
      {from && build.network === "mainnet" && (
        <div className="mb-3 -mt-1">
          <GasEstimateLine txs={build.txs.map((tx) => ({ from, to: tx.to, data: tx.data, value: tx.value }))} />
        </div>
      )}
      <button
        onClick={sign}
        disabled={signing}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {signing
          ? lang === "pt" ? `Assinando ${progress}/${build.txs.length}…` : `Signing ${progress}/${build.txs.length}…`
          : lang === "pt" ? `Assinar${build.txs.length > 1 ? ` ${build.txs.length} transações` : " e enviar"}` : `Sign${build.txs.length > 1 ? ` ${build.txs.length} transactions` : " & send"}`}
      </button>
      <p className="text-[11px] text-white/30 mt-2 text-center">
        {build.txs.length > 1
          ? (lang === "pt" ? "Você confirma cada transação na sua carteira." : "You confirm each transaction in your wallet.")
          : (lang === "pt" ? "Você confirma uma vez na sua carteira." : "You confirm once in your wallet.")}
      </p>
    </div>
  );
}

// ─── ERC-20 approval card ────────────────────────────────────────────────────

function ApproveCard({ tx, lang, onDone, from }: { tx: BuiltTx; lang: "pt" | "en"; onDone: (hash: string | null, error?: string) => void; from?: string }) {
  const [signing, setSigning] = useState(false);
  const unlimited = /unlimited/i.test(tx.description);

  async function sign() {
    setSigning(true);
    try {
      await switchToChain("Pharos");
      const hash = await sendTransaction({ to: tx.to, data: tx.data, value: tx.value });
      onDone(hash);
    } catch (err) {
      onDone(null, err instanceof Error ? err.message : String(err));
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-[#0a1322]/80 p-4">
      <div className="text-sm font-semibold text-white/90 mb-2">🔓 {lang === "pt" ? "Aprovação ERC-20" : "ERC-20 Approval"}</div>
      <div className="text-xs text-white/70 mb-2">{tx.description}</div>
      {unlimited && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 mb-3">
          {lang === "pt"
            ? "⚠️ Aprovação ILIMITADA: o contrato poderá gastar todo o seu saldo deste token. Prefira aprovar só o necessário."
            : "⚠️ UNLIMITED approval: the contract will be able to spend your entire balance of this token. Prefer approving only what you need."}
        </div>
      )}
      {from && (
        <div className="mb-3">
          <GasEstimateLine txs={[{ from, to: tx.to, data: tx.data, value: tx.value }]} />
        </div>
      )}
      <button
        onClick={sign}
        disabled={signing}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {signing ? (lang === "pt" ? "Assinando…" : "Signing…") : lang === "pt" ? "Assinar aprovação" : "Sign approval"}
      </button>
    </div>
  );
}

// ─── Faroo liquid staking card (stake PROS → stPROS / unstake) ──────────────

function StakeCard({ build, lang, onDone, from }: { build: StakeBuild; lang: "pt" | "en"; onDone: (lastHash: string | null, error?: string) => void; from?: string }) {
  const [signing, setSigning] = useState(false);
  const [progress, setProgress] = useState(0);
  const isStake = build.kind === "stake";

  async function sign() {
    setSigning(true);
    let lastHash: string | null = null;
    try {
      await switchToChain("Pharos");
      for (let i = 0; i < build.txs.length; i++) {
        setProgress(i + 1);
        const tx = build.txs[i];
        let data = tx.data;
        // Unstake's final unwrap: the WPROS received from redeem can differ by
        // a few wei from the build-time preview (vault NAV moves every block).
        // Re-read the live balance and unwrap min(planned, balance) so the
        // WPROS contract never reverts with require(false).
        if (tx.adjustToWprosBalance && from) {
          const bal = await getWprosBalanceRaw(from);
          if (bal <= 0n) {
            throw new Error("No WPROS to unwrap — the redeem step may not have settled yet. Please try again.");
          }
          const planned = tx.rawAmount ?? bal;
          data = buildUnwrapData(planned < bal ? planned : bal);
        }
        lastHash = await sendTransaction({ to: tx.to, data, value: "0x" + tx.value.toString(16) });
        // Each step depends on the previous one landing (wrap → approve → deposit).
        const ok = await waitForTxSuccess(lastHash);
        if (!ok) throw new Error(`Step ${i + 1} (${tx.label.replace(/…$/, "")}) reverted on-chain.`);
      }
      onDone(lastHash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onDone(lastHash, msg);
    } finally {
      setSigning(false);
    }
  }

  const inSym = isStake ? "PROS" : build.rescue ? "WPROS" : "stPROS";
  const outSym = isStake ? "stPROS" : "PROS";

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-[#0a1322]/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white/90">
          {isStake ? "🥩 " : "🔓 "}
          {lang === "pt" ? (isStake ? "Stake na Faroo" : "Unstake na Faroo") : (isStake ? "Faroo Staking" : "Faroo Unstaking")}
        </div>
        <span className="px-2 py-0.5 rounded-md text-[11px] border border-cyan-400/30 text-cyan-300 bg-cyan-500/10">Pharos Mainnet</span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 px-3 py-2.5 rounded-xl" style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.14)" }}>
          <p className="text-[9px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: "rgba(0,212,255,0.6)" }}>{lang === "pt" ? "Você envia" : "You send"}</p>
          <p className="text-sm font-data font-semibold text-white/90">{build.amount.toLocaleString("en-US", { maximumFractionDigits: 6 })} {inSym}</p>
        </div>
        <span className="text-white/30">→</span>
        <div className="flex-1 px-3 py-2.5 rounded-xl" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.14)" }}>
          <p className="text-[9px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: "rgba(52,211,153,0.6)" }}>
            {build.claimAfterDays
              ? (lang === "pt" ? `Você recebe (após ${build.claimAfterDays} dias)` : `You receive (after ${build.claimAfterDays} days)`)
              : (lang === "pt" ? "Você recebe" : "You receive")}
          </p>
          <p className="text-sm font-data font-semibold text-white/90">~{build.expectedOut.toLocaleString("en-US", { maximumFractionDigits: 6 })} {outSym}</p>
        </div>
      </div>
      {build.claimAfterDays && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl mb-3" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <span style={{ color: "rgba(245,158,11,0.8)" }} className="mt-0.5 shrink-0 text-sm">⏳</span>
          <span className="text-xs leading-relaxed" style={{ color: "rgba(245,158,11,0.75)" }}>
            {lang === "pt"
              ? <>A Faroo tem período de unstake de <b>{build.claimAfterDays} dias</b> (taxa 0%). Após esse prazo, resgate seus PROS em <a href="https://app.faroo.xyz/unstake" target="_blank" rel="noopener noreferrer" className="underline">app.faroo.xyz/unstake</a>.</>
              : <>Faroo has a <b>{build.claimAfterDays}-day</b> unstake period (0% fee). After it matures, claim your PROS at <a href="https://app.faroo.xyz/unstake" target="_blank" rel="noopener noreferrer" className="underline">app.faroo.xyz/unstake</a>.</>}
          </span>
        </div>
      )}
      <div className="space-y-1.5 mb-3">
        {build.txs.map((tx, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-white/70">
            <span className="text-white/30">{i + 1}.</span>
            <span>{tx.label.replace(/…$/, "")}</span>
            {signing && progress === i + 1 && <span className="text-cyan-300 animate-pulse">✍️</span>}
            {signing && progress > i + 1 && <span className="text-emerald-400">✓</span>}
          </div>
        ))}
      </div>
      <div className="text-[11px] text-white/40 mb-3">
        NAV: {build.nav.toFixed(6)} PROS/stPROS · {lang === "pt" ? "stPROS rende com as recompensas de staking da rede" : "stPROS accrues network staking rewards over time"}
      </div>
      {from && (
        <div className="mb-3">
          <GasEstimateLine txs={build.txs.map((tx) => ({ from, to: tx.to, data: tx.data, value: tx.value }))} />
        </div>
      )}
      <button
        onClick={sign}
        disabled={signing}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {signing
          ? lang === "pt" ? `Assinando ${progress}/${build.txs.length}…` : `Signing ${progress}/${build.txs.length}…`
          : lang === "pt"
          ? `${isStake ? "Fazer stake" : "Fazer unstake"}${build.txs.length > 1 ? ` (${build.txs.length} txs)` : ""}`
          : `${isStake ? "Stake" : "Unstake"}${build.txs.length > 1 ? ` (${build.txs.length} txs)` : ""}`}
      </button>
      <p className="text-[11px] text-white/30 mt-2 text-center">
        {lang === "pt" ? "Você confirma cada transação na sua carteira." : "You confirm each transaction in your wallet."}
      </p>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      text: "Hi! I'm **ProsPilot** — your AI DeFi copilot on Pharos Network (Chain ID 1672).\n\nConnect your wallet and I'll help you:\n• **Swap** tokens via FaroSwap, OKX DEX or LI.FI\n• **Bridge** to Ethereum, Base, Arbitrum, Polygon via CCIP or Circle CCTP v2\n• **Add / remove liquidity** in FaroSwap V3 concentrated pools\n• **Stake PROS** → stPROS via Faroo liquid staking\n• **Answer any question** about the Pharos ecosystem, protocols, RWA, gas, contracts and more\n\nYou can write in any language. Let's go!",
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
  const [walletPickerOptions, setWalletPickerOptions] = useState<WalletOption[] | null>(null);
  const [connectedProviderId, setConnectedProviderId] = useState<string | null>(null);
  const walletAddressRef = useRef("");
  const userConnectLockRef = useRef(false);
  const refreshOpenFlowsForRef = useRef<(addr: string) => Promise<void>>(async () => {});
  const upsertWalletStatusRef = useRef<(name: string, address: string, bal: string, switched?: boolean) => void>(() => {});
  const [selectedNetwork, setSelectedNetworkState] = useState<PharosNetworkId>("mainnet");
  const [siteLang] = useSiteLang();
  const [chatId, setChatId] = useState<string>(() => newChatId());
  const [chatList, setChatList] = useState<ChatListItem[]>([]);

  // Persist the conversation (text only — interactive cards embed wallet-
  // specific calldata that would be stale after a reload) and keep the
  // sidebar history in sync. Only chats with at least one user message are saved.
  useEffect(() => {
    setChatList(listChats());
  }, []);
  useEffect(() => {
    if (!messages.some((m) => m.role === "user")) return;
    const stored: StoredMessage[] = messages
      .filter((m) => !m.isLoading && !m.isSearching && m.text)
      .map((m) => ({
        id: m.id, role: m.role, text: m.text,
        ...(m.txHash ? { txHash: m.txHash } : {}),
        ...(m.isError ? { isError: true } : {}),
        ...(m.sources?.length ? { sources: m.sources } : {}),
      }));
    if (stored.length === 0) return;
    saveChat(chatId, deriveTitle(stored), stored);
    setChatList(listChats());
  }, [messages, chatId]);

  // Reopen a saved conversation from the sidebar (text only; any transaction
  // cards from that session are gone by design — the user just asks again).
  function handleOpenChat(id: string) {
    const chat = loadChat(id);
    if (!chat) return;
    opSeqRef.current++;
    setChatId(id);
    setInput("");
    setMessages(chat.messages.map((m) => ({ id: m.id, role: m.role, text: m.text, txHash: m.txHash, isError: m.isError, sources: m.sources })));
  }

  function handleDeleteChat(id: string) {
    deleteChat(id);
    setChatList(listChats());
    if (id === chatId) handleResetChat();
  }

  // Price-alert poller: while the app is open, check targets every minute.
  // Triggered alerts fire a browser notification + a chat message and are
  // removed from storage by checkAlerts().
  useEffect(() => {
    const interval = setInterval(async () => {
      if (listAlerts().length === 0) return;
      const triggered = await checkAlerts();
      if (triggered.length === 0) return;
      const lang = guessUserLang(messagesRef.current);
      for (const t of triggered) {
        notifyTriggered(t, lang);
        addMessage({
          role: "agent",
          text: lang === "pt"
            ? `🔔 **Alerta de preço disparado!** ${t.symbol} está em **$${t.price.toFixed(4)}** — ${t.direction === "above" ? "acima" : "abaixo"} do seu alvo de $${t.target}.`
            : `🔔 **Price alert triggered!** ${t.symbol} is at **$${t.price.toFixed(4)}** — ${t.direction === "above" ? "above" : "below"} your $${t.target} target.`,
        });
      }
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedNetworkState(getSelectedNetwork());
    return onNetworkChange(setSelectedNetworkState);
  }, []);

  // Announce network switches in the chat: the agent proactively tells the
  // user what works on the network they just switched to (skips first render).
  const prevNetworkRef = useRef<PharosNetworkId | null>(null);
  useEffect(() => {
    if (prevNetworkRef.current === null) { prevNetworkRef.current = selectedNetwork; return; }
    if (prevNetworkRef.current === selectedNetwork) return;
    prevNetworkRef.current = selectedNetwork;
    const lang = guessUserLang(messages);
    const text = selectedNetwork === "testnet"
      ? (lang === "pt"
        ? "🔄 Rede alterada para **Atlantic Testnet** 🧪\n\nO que você pode fazer comigo aqui:\n- 💸 **Enviar PHRS** para outra carteira da testnet — ex.: \"envie 0.5 PHRS para 0x…\"\n- 👛 **Análise de carteira** — saldo de PHRS + contagem de transações\n- 🔎 **Explicar transação** — cole um hash da testnet\n- 🚰 **Pegar PHRS de graça nos faucets**:\n  - Oficial: https://testnet.pharosnetwork.xyz\n  - Stakely: https://stakely.io/faucet/pharos-atlantic-testnet-phrs\n\n⚠️ Swap, bridge e liquidez ficam **desativados** na testnet — os contratos que eu uso (FaroSwap V3, LI.FI, CCIP, CCTP) só existem na mainnet.\n\nExplorer da testnet: https://atlantic.pharosscan.xyz"
        : "🔄 Network switched to **Atlantic Testnet** 🧪\n\nWhat you can do with me here:\n- 💸 **Send PHRS** to another testnet wallet — e.g. \"send 0.5 PHRS to 0x…\"\n- 👛 **Wallet analysis** — PHRS balance + transaction count\n- 🔎 **Explain a transaction** — paste a testnet hash\n- 🚰 **Grab free PHRS from the faucets**:\n  - Official: https://testnet.pharosnetwork.xyz\n  - Stakely: https://stakely.io/faucet/pharos-atlantic-testnet-phrs\n\n⚠️ Swap, bridge and liquidity are **disabled** on testnet — the contracts I use (FaroSwap V3, LI.FI, CCIP, CCTP) only exist on mainnet.\n\nTestnet explorer: https://atlantic.pharosscan.xyz")
      : (lang === "pt"
        ? "🔄 Rede alterada para **Pharos Mainnet** 🌊\n\nTudo liberado por aqui:\n- 🔁 **Swap** de tokens (FaroSwap + LI.FI)\n- 🌉 **Bridge** cross-chain (LI.FI, Chainlink CCIP, Circle CCTP)\n- 💧 **Adicionar/remover liquidez** na FaroSwap V3\n- 📊 **Minhas posições LP** + coletar taxas\n- 💸 **Enviar PROS e tokens** (inclusive em lote)\n- 👛 **Análise de carteira** e 🔎 **explicar transações**\n\nExplorer: https://pharos.socialscan.io"
        : "🔄 Network switched to **Pharos Mainnet** 🌊\n\nEverything is available here:\n- 🔁 **Swap** tokens (FaroSwap + LI.FI)\n- 🌉 **Bridge** cross-chain (LI.FI, Chainlink CCIP, Circle CCTP)\n- 💧 **Add/remove liquidity** on FaroSwap V3\n- 📊 **My LP positions** + collect fees\n- 💸 **Send PROS and tokens** (batch too)\n- 👛 **Wallet analysis** and 🔎 **transaction explainer**\n\nExplorer: https://pharos.socialscan.io");
    addMessage({ role: "agent", text });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNetwork]);

  const expectedChainHex = PHAROS_NETWORKS[selectedNetwork].chainIdHex.toLowerCase();
  const isWrongNetwork = !!walletAddress && !!chainId && chainId.toLowerCase() !== expectedChainHex;
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 1;

  // Local usage stats (this browser's localStorage — NOT on-chain data).
  // Loaded silently for agent context; no welcome toast, it annoyed users.
  useEffect(() => {
    setStats(getStats());
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
    walletAddressRef.current = walletAddress;
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    // Refetches on connect, on selected-network change, and every 5s — so the
    // balance follows the active chain quickly after a mainnet/testnet switch.
    getBalance(walletAddress).then(setBalance);
    const iv = setInterval(() => getBalance(walletAddress).then(setBalance), 5000);
    return () => clearInterval(iv);
  }, [walletAddress, selectedNetwork, chainId]);

  // Persist connection across reloads: if the user connected before and the
  // wallet still authorizes us, silently re-attach (no prompt) and read the chain.
  useEffect(() => {
    if (!isWalletAvailable() || !wasConnected()) return;
    let cancelled = false;
    (async () => {
      const addr = await silentReconnect();
      // User may have connected manually while silentReconnect was in flight —
      // never overwrite a fresher connection with a stale default provider.
      if (cancelled || !addr || walletAddressRef.current || userConnectLockRef.current) return;
      walletAddressRef.current = addr;
      setWalletAddress(addr);
      setConnectedProviderId(getRememberedProviderId());
      const bal = await getBalance(addr);
      setBalance(bal);
      setChainId(await getCurrentChainId());
      upsertWalletStatusRef.current(getWalletName(), addr, bal, true);
    })();
    return () => { cancelled = true; };
  }, []);

  function addMessage(msg: Omit<Message, "id">): string {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }

  function updateMessage(id: string, patch: Partial<Message>) {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
  }

  function upsertWalletStatusMessage(walletName: string, address: string, bal: string, switched = false) {
    const lang = siteLang === "pt" ? "pt" : "en";
    const text = walletStatusText(walletName, address, bal, lang, switched);
    setMessages((prev) => {
      const cleaned = prev.filter((m) => !isLegacyWalletConnectMsg(m));
      const idx = cleaned.findIndex((m) => m.id === WALLET_STATUS_ID);
      const msg: Message = { id: WALLET_STATUS_ID, role: "agent", text };
      if (idx >= 0) {
        const next = [...cleaned];
        next[idx] = { ...next[idx], ...msg, isError: false };
        return next;
      }
      return [...cleaned, msg];
    });
  }
  upsertWalletStatusRef.current = upsertWalletStatusMessage;

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const wallets = await discoverWallets();
      if (wallets.length === 0) {
        addMessage({
          role: "agent",
          isError: true,
          text: "No wallet detected. Install one and refresh:\n\n" +
            "- [MetaMask](https://metamask.io/download)\n" +
            "- [OKX Wallet](https://www.okx.com/web3)\n" +
            "- [Rabby](https://rabby.io)\n" +
            "- [Coinbase Wallet](https://www.coinbase.com/wallet)\n" +
            "- [Trust Wallet](https://trustwallet.com)",
        });
        return;
      }
      if (wallets.length === 1) {
        await connectTo(wallets[0]);
        return;
      }
      // Multiple wallets → open picker in navbar dropdown.
      setWalletPickerOptions(wallets);
    } catch (err: unknown) {
      addMessage({ role: "agent", text: err instanceof Error ? err.message : "Failed to detect wallets.", isError: true });
    } finally {
      setIsConnecting(false);
    }
  }

  async function connectTo(option: WalletOption) {
    setIsConnecting(true);
    userConnectLockRef.current = true;
    try {
      const address = await connectWallet(option.provider, option.id);
      const wasSwitch = !!walletAddressRef.current &&
        walletAddressRef.current.toLowerCase() !== address.toLowerCase();
      walletAddressRef.current = address;
      setConnectedProviderId(option.id);
      setWalletAddress(address);
      const bal = await getBalance(address);
      setBalance(bal);
      setChainId(await getCurrentChainId());
      upsertWalletStatusMessage(option.name, address, bal, wasSwitch);
      // If wizard cards are open from a previous account, refresh their balances.
      void refreshOpenFlowsFor(address);
    } catch (err: unknown) {
      addMessage({ role: "agent", text: err instanceof Error ? err.message : "Failed to connect wallet.", isError: true });
    } finally {
      userConnectLockRef.current = false;
      setIsConnecting(false);
    }
  }

  function handleDisconnect() {
    disconnectWallet();
    setConnectedProviderId(null);
    walletAddressRef.current = "";
    setWalletAddress("");
    setBalance("0");
    setChainId(null);
    setMessages((prev) => prev.filter((m) => m.id !== WALLET_STATUS_ID && !isLegacyWalletConnectMsg(m)));
  }

  async function handleSwitchNetwork() {
    try {
      await switchToChain(selectedNetwork === "testnet" ? "PharosTestnet" : "Pharos");
      setChainId(await getCurrentChainId());
    } catch (err: unknown) {
      const msg = walletErrorMessage(err);
      const isRejected = /user rejected|user denied|rejected/i.test(msg);
      addMessage({ role: "agent", text: isRejected ? "Você precisa aprovar a troca de rede na carteira para continuar." : `Falha ao trocar de rede: ${msg}`, isError: true });
    }
  }

  async function handlePositionSelect(msgId: string, position: V3Position) {
    // Closed position (liquidity=0): skip pct picker — go straight to collect fees
    if (position.liquidity === 0n) {
      await handlePctSelect(msgId, position, 0);
      return;
    }
    // Active position: show percentage picker
    updateMessage(msgId, {
      positions: undefined,
      removeMode: undefined,
      removePctPending: { position },
    });
  }

  // pct = 0 means "collect fees only" (no liquidity removal), even on active positions
  async function handlePctSelect(msgId: string, position: V3Position, pct: number) {
    const lang = guessUserLang(messages);
    const isCollectOnly = pct === 0 || position.liquidity === 0n;
    updateMessage(msgId, {
      removePctPending: undefined,
      text: lang === "pt"
        ? (isCollectOnly ? "Preparando coleta de fees…" : "Preparando remoção de liquidez…")
        : (isCollectOnly ? "Building collect-fees transaction…" : "Building remove liquidity transaction…"),
      isLoading: true,
    });
    try {
      const { buildRemoveLiquidityTx, FEE_TIERS: _FEE_TIERS } = await import("@/lib/liquidity");
      // Normalise fee tier — FaroSwap may use non-standard values; map closest valid tier
      const validTiers = [100, 500, 3000, 10000] as const;
      const feeTier = (validTiers.includes(position.fee as 100 | 500 | 3000 | 10000)
        ? position.fee
        : validTiers.reduce((prev, curr) => Math.abs(curr - position.fee) < Math.abs(prev - position.fee) ? curr : prev)
      ) as import("@/lib/liquidity").FeeTier;

      // Scale liquidity by percentage (0 = collect fees only)
      const scaledLiquidity = isCollectOnly ? 0n : position.liquidity * BigInt(pct) / 100n;
      const scaledWpros     = isCollectOnly ? 0  : position.amount0WPROS * pct / 100;
      const scaledUsdc      = isCollectOnly ? 0  : position.amount1USDC  * pct / 100;
      // Always collect all accrued fees regardless of removal %
      const result = await buildRemoveLiquidityTx(
        position.tokenId,
        scaledLiquidity,
        feeTier,
        walletAddress,
        scaledWpros,
        scaledUsdc,
        position.feesWPROS,
        position.feesUSDC,
        position.tokensOwed0,
        position.tokensOwed1,
      );
      const pctLabel = pct === 100 ? "all" : `${pct}%`;
      const totalWPROS = (result.amount0WPROS + result.feesWPROS).toFixed(6);
      const totalUSDC  = (result.amount1USDC  + result.feesUSDC).toFixed(6);
      const confirmText = lang === "pt"
        ? isCollectOnly
          ? `Coletando fees da posição NFT #${String(position.tokenId)}.\n\nVocê receberá:\n• **${totalWPROS} WPROS**\n• **${totalUSDC} USDC**\n\nConfirme na sua carteira.`
          : `Pronto! Removendo **${pctLabel}** da posição NFT #${String(position.tokenId)}.\n\nVocê receberá:\n• **${totalWPROS} WPROS**\n• **${totalUSDC} USDC**\n\nConfirme na sua carteira.`
        : isCollectOnly
          ? `Collecting fees from NFT #${String(position.tokenId)}.\n\nYou'll receive:\n• **${totalWPROS} WPROS**\n• **${totalUSDC} USDC**\n\nConfirm in your wallet.`
          : `Ready to remove **${pctLabel}** of NFT #${String(position.tokenId)}.\n\nYou'll receive:\n• **${totalWPROS} WPROS**\n• **${totalUSDC} USDC**\n\nConfirm in your wallet.`;
      updateMessage(msgId, { isLoading: false, text: confirmText, removeLiquidityPending: { result } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to build remove-liquidity tx: ${msg}` });
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

    // ERC-20 sources must be approved to the LI.FI Diamond first, or the bridge
    // reverts with TransferFromFailed(). Native tokens (PROS/ETH) need no approval.
    const NATIVE_ADDRS = ["0x0000000000000000000000000000000000000000", "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"];
    const fromTokenAddr = quote.action.fromToken.address;
    const approvalAddress = quote.estimate.approvalAddress;
    const fromAmount = quote.action.fromAmount ?? quote.estimate.fromAmount ?? "0";
    const isNative = !fromTokenAddr || NATIVE_ADDRS.includes(fromTokenAddr.toLowerCase());

    let needsApproval = false;
    let approvalData: ApprovalData | undefined;
    if (!isNative && approvalAddress && BigInt(fromAmount) > 0n) {
      // Pre-flight: make sure the wallet actually holds enough of the source
      // token, or transferFrom reverts on-chain with TransferFromFailed().
      const bal = await getErc20Balance(fromTokenAddr, walletAddress);
      if (bal < BigInt(fromAmount)) {
        const dec = quote.action.fromToken.decimals;
        const have = (Number(bal) / 10 ** dec).toFixed(dec === 6 ? 4 : 6);
        throw new Error(`Insufficient ${intent.fromToken} balance — you have ${have} but this needs ${intent.amount}. Fund the wallet or try a smaller amount.`);
      }
      const allowance = await checkAllowance(fromTokenAddr, walletAddress, approvalAddress);
      needsApproval = allowance < BigInt(fromAmount);
      if (needsApproval) {
        approvalData = { tokenAddress: fromTokenAddr, spender: approvalAddress, amount: fromAmount };
      }
    }

    const pending: PendingTx = {
      provider: "lifi", quote, intent, description,
      needsApproval,
      approvalData,
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

  // ── Cancellation ────────────────────────────────────────────────────────
  // opSeqRef invalidates in-flight async flows: each guided flow captures the
  // sequence at start and bails out silently if the user cancelled meanwhile.
  const opSeqRef = useRef(0);

  // Pending transfer waiting for an amount (recipient + token already known).
  const pendingTransferRef = useRef<{ to: string; token: string; network: PharosNetworkId } | null>(null);
  // Guided staking flow: when set, the next amount pick builds a Faroo card —
  // "stake" expects a PROS amount, "unstake" expects a stPROS amount.
  const pendingStakeRef = useRef<false | "stake" | "unstake">(false);
  // WPROS rescue: ask before building unwrap tx (leftover from incomplete unstake).
  const pendingWprosRescueRef = useRef<number | false>(false);

  // Live mirror of `messages` for event handlers registered with stale closures
  // (e.g. the wallet accountsChanged listener).
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  function cancelActiveFlows() {
    opSeqRef.current++;
    pendingTransferRef.current = null;
    pendingStakeRef.current = false;
    pendingWprosRescueRef.current = false;
    const lang = guessUserLang(messages);
    setMessages((prev) => prev.map((m) => {
      // Covers EVERY interactive on-chain card: wizards, provider/token/chain
      // choices, amount queries, and all built tx cards (swap/bridge, add and
      // remove liquidity, position pickers, transfers, approvals).
      const hasActive = m.isLoading || m.isSearching || m.bridgeWizard || m.bridgeChoice || m.swapWizard ||
        m.liquidityWizard || m.transferWizard || m.swapChoice || m.providerChoice || m.amountQuery || m.pending ||
        m.liquidityPending || m.removeLiquidityPending || m.removePctPending || m.positions ||
        m.transferPending || m.approvePending || m.stakePending || m.tokenChoice || m.chainChoice || m.walletChoice;
      if (!hasActive) return m;
      return {
        ...m,
        isLoading: false, isSearching: false,
        bridgeWizard: undefined, bridgeChoice: undefined, swapWizard: undefined, liquidityWizard: undefined, transferWizard: undefined,
        swapChoice: undefined, providerChoice: undefined, amountQuery: undefined, pending: undefined,
        liquidityPending: undefined, removeLiquidityPending: undefined, removePctPending: undefined,
        positions: undefined, removeMode: undefined,
        transferPending: undefined, approvePending: undefined, stakePending: undefined,
        tokenChoice: undefined, chainChoice: undefined, walletChoice: undefined,
        text: m.isLoading || m.isSearching
          ? (lang === "pt" ? "❌ Cancelado." : "❌ Cancelled.")
          : m.text,
      };
    }));
  }

  function hasCancellableFlows(msgs: Message[]): boolean {
    if (pendingStakeRef.current || pendingWprosRescueRef.current) return true;
    return msgs.some((m) =>
      m.isLoading || m.isSearching || m.bridgeWizard || m.bridgeChoice || m.swapWizard ||
      m.liquidityWizard || m.transferWizard || m.swapChoice || m.providerChoice || m.amountQuery || m.pending ||
      m.liquidityPending || m.removeLiquidityPending || m.removePctPending || m.positions ||
      m.transferPending || m.approvePending || m.stakePending || m.tokenChoice || m.chainChoice || m.walletChoice,
    );
  }

  // Abort active flows — also matches "cancelar stake" (cancel the operation, NOT unstake).
  const CANCEL_RE = /^\s*(cancela(r)?|cancel|stop|para|parar|aborta(r)?|esquece|deixa)(\s+(isso|a\s+opera[çc][ãa]o|o\s+stake|stake|unstake|a\s+transa[çc][ãa]o|tx|tudo|por\s+favor|essa))?[\s.!]*$/i;

  // When the user switches accounts in the wallet, any open wizard card still
  // shows the PREVIOUS account's balances. Re-read the new account's holdings
  // and refresh every open flow in place (bridge/swap/liquidity wizards +
  // amount queries), so all on-chain functions follow the active wallet.
  async function refreshOpenFlowsFor(newAddr: string) {
    // Built tx cards (swap/bridge/liquidity/transfer/approve) embed calldata,
    // amounts, approvals and recipients computed for the PREVIOUS wallet —
    // signing them with the new one causes on-chain reverts ("STF" etc.) or,
    // worse, mints/sends to the wrong address. They are invalidated here;
    // wizard cards (not yet built) just get their balances refreshed.
    const isStaleBuiltCard = (m: Message) =>
      !!(m.pending || m.liquidityPending || m.removeLiquidityPending ||
         m.removePctPending || m.positions || m.bridgeChoice ||
         m.transferPending || m.approvePending || m.stakePending);
    const hasOpenFlow = messagesRef.current.some(
      (m) => m.bridgeWizard || m.swapWizard || m.liquidityWizard || m.transferWizard || m.amountQuery || isStaleBuiltCard(m)
    );
    if (!hasOpenFlow) return;
    const hadBuiltCards = messagesRef.current.some(isStaleBuiltCard);
    const lang = guessUserLang(messagesRef.current);
    try {
      const network = getSelectedNetwork();
      const balances = await getTokenBalancesFast(newAddr, network);
      const holdings = balances.filter((b) => b.balance > 0.000001);
      const balFor = (sym: string) =>
        balances.find((b) => b.symbol.toUpperCase() === sym.toUpperCase())?.balance ?? 0;
      setMessages((prev) => prev.map((m) => {
        if (isStaleBuiltCard(m)) {
          return {
            ...m,
            pending: undefined,
            liquidityPending: undefined,
            removeLiquidityPending: undefined,
            removePctPending: undefined,
            positions: undefined,
            removeMode: undefined,
            bridgeChoice: undefined,
            transferPending: undefined,
            approvePending: undefined,
            stakePending: undefined,
          };
        }
        if (m.bridgeWizard) return { ...m, bridgeWizard: { ...m.bridgeWizard, holdings } };
        if (m.swapWizard) return { ...m, swapWizard: { ...m.swapWizard, holdings } };
        if (m.liquidityWizard) return { ...m, liquidityWizard: { ...m.liquidityWizard, holdings } };
        if (m.transferWizard) {
          const map: Record<string, number> = {};
          for (const sym of TRANSFER_WIZARD_TOKENS) {
            map[sym] = holdings.find((h) => h.symbol.toUpperCase() === sym)?.balance ?? 0;
          }
          return { ...m, transferWizard: { ...m.transferWizard, balances: map } };
        }
        if (m.amountQuery) return { ...m, amountQuery: { ...m.amountQuery, balance: balFor(m.amountQuery.token) } };
        return m;
      }));
      const short = `\`${newAddr.slice(0, 6)}…${newAddr.slice(-4)}\``;
      addMessage({
        role: "agent",
        text: lang === "pt"
          ? `🔄 Carteira trocada para ${short} — atualizei os saldos nos cards abertos.` +
            (hadBuiltCards ? " As transações que estavam prontas foram canceladas porque foram montadas para a carteira anterior — é só pedir de novo que eu remonto com os saldos desta carteira." : "")
          : `🔄 Wallet switched to ${short} — I refreshed the balances in the open cards.` +
            (hadBuiltCards ? " Pending transaction cards were cancelled because they were built for the previous wallet — just ask again and I'll rebuild them with this wallet's balances." : ""),
      });
    } catch {
      // Balance refresh is best-effort; the wizards re-read on next open anyway.
    }
  }
  refreshOpenFlowsForRef.current = refreshOpenFlowsFor;

  // React to account/chain changes on EVERY installed wallet (not just the
  // active one) so switching account in Rabby/MetaMask updates the navbar.
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const syncAccount = (accounts: string[], provider: EIP1193Provider) => {
      if (!walletAddressRef.current && !wasConnected()) return;

      if (!accounts?.length) {
        const active = getActiveProvider();
        if (provider !== active) return;
        disconnectWallet();
        setConnectedProviderId(null);
        walletAddressRef.current = "";
        setWalletAddress("");
        setBalance("0");
        setChainId(null);
        return;
      }

      const next = accounts[0];
      if (next.toLowerCase() === walletAddressRef.current.toLowerCase()) return;

      setActiveProvider(provider);
      const pid = providerIdFor(provider);
      rememberConnection(pid);
      setConnectedProviderId(pid);
      walletAddressRef.current = next;
      setWalletAddress(next);
      getBalance(next).then((bal) => {
        setBalance(bal);
        upsertWalletStatusRef.current(getWalletName(provider), next, bal, true);
      });
      void refreshOpenFlowsForRef.current(next);
    };

    void subscribeAllWalletProviders({
      onAccountsChanged: syncAccount,
      onChainChanged: (chainId, provider) => {
        if (provider !== getActiveProvider()) return;
        setChainId(chainId);
        if (walletAddressRef.current) getBalance(walletAddressRef.current).then(setBalance);
      },
    }).then((fn) => { cleanup = fn; });

    const onVisible = async () => {
      if (document.visibilityState !== "visible" || !walletAddressRef.current) return;
      await restoreRememberedProvider();
      const addr = await getAuthorizedAccount();
      if (addr && addr.toLowerCase() !== walletAddressRef.current.toLowerCase()) {
        walletAddressRef.current = addr;
        setWalletAddress(addr);
        const bal = await getBalance(addr);
        setBalance(bal);
        upsertWalletStatusRef.current(getWalletName(), addr, bal, true);
        void refreshOpenFlowsForRef.current(addr);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cleanup?.();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Reset the conversation to a clean slate (keeps wallet connection).
  function handleResetChat() {
    opSeqRef.current++;
    setChatId(newChatId());
    setInput("");
    setMessages([{
      id: "welcome",
      role: "agent",
      text: "Hi! I'm **ProsPilot** — your AI DeFi copilot on Pharos Network (Chain ID 1672).\n\nConnect your wallet and I'll help you:\n• **Swap** tokens via FaroSwap, OKX DEX or LI.FI\n• **Bridge** to Ethereum, Base, Arbitrum, Polygon via CCIP or Circle CCTP v2\n• **Add / remove liquidity** in FaroSwap V3 concentrated pools\n• **Stake PROS** → stPROS via Faroo liquid staking\n• **Answer any question** about the Pharos ecosystem, protocols, RWA, gas, contracts and more\n\nYou can write in any language. Let's go!",
    }]);
  }

  // DeFi contracts (FaroSwap V3, LI.FI, CCIP/CCTP) only exist on Pharos
  // Mainnet — on Atlantic Testnet those flows stop early with a clear
  // explanation of what DOES work there, so networks never get mixed up.
  function testnetGateText(lang: "pt" | "en"): string {
    return lang === "pt"
      ? "Você está na **Atlantic Testnet** 🧪\n\nOs contratos que eu uso para swap, bridge e liquidez (FaroSwap V3, LI.FI, Chainlink CCIP, Circle CCTP) só existem na **Pharos Mainnet** — então essas funções ficam desativadas aqui para não misturar as redes.\n\nO que funciona na testnet:\n- 💸 **Enviar PHRS** — ex.: \"envie 0.1 PHRS para 0x…\"\n- 👛 **Análise de carteira** — saldo de PHRS + contagem de transações\n- 🔎 **Explicar transação** — cole um hash da testnet\n- 🚰 **Faucet** — pegue PHRS de teste em https://testnet.pharosnetwork.xyz\n\nPara swap, bridge ou liquidez, troque para **Pharos Mainnet** no seletor de rede no topo. 🔄"
      : "You're on **Atlantic Testnet** 🧪\n\nThe contracts I use for swap, bridge and liquidity (FaroSwap V3, LI.FI, Chainlink CCIP, Circle CCTP) only exist on **Pharos Mainnet** — so those flows are disabled here to keep the networks from mixing.\n\nWhat works on testnet:\n- 💸 **Send PHRS** — e.g. \"send 0.1 PHRS to 0x…\"\n- 👛 **Wallet analysis** — PHRS balance + transaction count\n- 🔎 **Explain a transaction** — paste a testnet hash\n- 🚰 **Faucet** — grab test PHRS at https://testnet.pharosnetwork.xyz\n\nFor swap, bridge or liquidity, switch to **Pharos Mainnet** in the network selector at the top. 🔄";
  }

  function gateTestnetDeFi(msgId: string, lang: "pt" | "en"): boolean {
    if (selectedNetwork !== "testnet") return false;
    updateMessage(msgId, { isLoading: false, text: testnetGateText(lang) });
    return true;
  }

  // ── Guided bridge flow ─────────────────────────────────────────────────
  // Every bridge request goes through this wizard: token pick (with live
  // balances), amount (typed or 25/50/75/100%), destination chain — then a
  // route comparison with the best return highlighted.
  async function startBridgeWizard(msgId: string, pre: { token?: string; amount?: number; chain?: string }) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    if (gateTestnetDeFi(msgId, lang)) return;
    updateMessage(msgId, {
      isLoading: true,
      text: lang === "pt" ? "Lendo os saldos da sua carteira…" : "Reading your wallet balances…",
    });
    try {
      const balances = await getTokenBalancesFast(walletAddress);
      if (opSeqRef.current !== seq) return;
      const holdings = balances.filter((h) => h.balance > 0);
      updateMessage(msgId, {
        isLoading: false,
        text: lang === "pt"
          ? "Vamos fazer a bridge! Escolha o token, o valor e a rede de destino — depois eu comparo as rotas disponíveis pra você pegar o melhor retorno."
          : "Let's bridge! Pick the token, amount and destination chain — then I'll compare the available routes so you get the best return.",
        bridgeWizard: {
          holdings,
          preToken: pre.token && holdings.some((h) => h.symbol === pre.token) ? pre.token : undefined,
          preAmount: pre.amount,
          preChain: pre.chain && (BRIDGE_DEST_CHAINS as readonly string[]).includes(pre.chain) ? pre.chain : undefined,
        },
      });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to read wallet balances: ${msg}` });
    }
  }

  async function handleBridgeWizardSubmit(msgId: string, token: string, amount: number, toChain: string) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    updateMessage(msgId, {
      bridgeWizard: undefined,
      isLoading: true,
      text: lang === "pt"
        ? `Buscando as melhores rotas para ${amount} ${token} → ${toChain}…`
        : `Fetching the best routes for ${amount} ${token} → ${toChain}…`,
    });

    const intent: ParsedIntent = {
      action: "bridge",
      fromToken: token,
      toToken: token,
      amount,
      fromChain: "Pharos",
      toChain,
    };

    try {
      const ccipCheck = checkCcipSupport(intent);
      const cctpCheck = checkCctpSupport(intent);

      const [lifiRes, cctpRes, ccipRes] = await Promise.allSettled([
        buildLifiPending(intent),
        cctpCheck.supported ? buildCctpPending(intent) : Promise.reject(new Error(cctpCheck.reason ?? "unsupported")),
        ccipCheck.supported ? buildCcipTransaction(intent, walletAddress) : Promise.reject(new Error(ccipCheck.reason ?? "unsupported")),
      ]);
      if (opSeqRef.current !== seq) return;

      const options: BridgeRouteOption[] = [];
      const unavailable: NonNullable<BridgeChoice["unavailable"]> = [];
      if (!cctpCheck.supported) unavailable.push({ provider: "cctp", reason: cctpCheck.reason ?? "route not supported" });
      if (!ccipCheck.supported) unavailable.push({ provider: "ccip", reason: ccipCheck.reason ?? "route not supported" });

      if (lifiRes.status === "fulfilled") {
        const receiveValue = parseFloat(lifiRes.value.receiveLabel) || 0;
        options.push({
          provider: "lifi",
          pending: lifiRes.value.pending,
          summary: lifiRes.value.summary,
          receiveLabel: lifiRes.value.receiveLabel,
          receiveValue,
          note: lang === "pt" ? "agregador · melhor rota multi-chain" : "aggregator · best multi-chain route",
        });
      } else {
        console.warn("[pharos:bridge] LI.FI quote failed:", lifiRes.reason);
      }

      if (cctpRes.status === "fulfilled") {
        // CCTP fee is capped at 0.1% (typically ~0.01%) — estimate conservatively.
        const receiveValue = amount * 0.999;
        options.push({
          provider: "cctp",
          pending: cctpRes.value.pending,
          summary: cctpRes.value.summary,
          receiveLabel: `${receiveValue.toFixed(4)} USDC`,
          receiveValue,
          note: lang === "pt" ? "USDC nativo · taxa máx 0,1% · ~1 min" : "native USDC · max 0.1% fee · ~1 min",
        });
      } else if (cctpCheck.supported) {
        console.warn("[pharos:bridge] CCTP quote failed:", cctpRes.reason);
      }

      if (ccipRes.status === "fulfilled") {
        const ccipData = ccipRes.value;
        const feePROS = Number(ccipData.feeAmount) / 1e18;
        options.push({
          provider: "ccip",
          pending: {
            provider: "ccip", ccip: ccipData, intent,
            description: `Bridge ${amount} ${token} → ${toChain} via CCIP`,
            needsApproval: false,
          },
          summary: `Bridge via Chainlink CCIP: ${amount} ${token} → ${toChain}\nCCIP fee: ~${feePROS.toFixed(6)} PROS`,
          receiveLabel: `${amount} ${token}`,
          receiveValue: amount,
          note: lang === "pt"
            ? `1:1 · taxa de ~${feePROS.toFixed(4)} PROS paga à parte`
            : `1:1 · ~${feePROS.toFixed(4)} PROS fee paid separately`,
        });
      } else if (ccipCheck.supported) {
        console.warn("[pharos:bridge] CCIP quote failed:", ccipRes.reason);
        unavailable.push({ provider: "ccip", reason: "quote failed — try again" });
      }
      if (lifiRes.status === "rejected") {
        unavailable.push({ provider: "lifi", reason: lifiRes.reason instanceof Error ? lifiRes.reason.message : "no route" });
      }
      if (cctpCheck.supported && cctpRes.status === "rejected") {
        unavailable.push({ provider: "cctp", reason: "quote failed — try again" });
      }

      if (options.length === 0) {
        const reason = lifiRes.status === "rejected" && lifiRes.reason instanceof Error ? lifiRes.reason.message : "no route available";
        updateMessage(msgId, {
          isLoading: false, isError: true,
          text: lang === "pt"
            ? `Não encontrei nenhuma rota para ${amount} ${token} → ${toChain}: ${reason}`
            : `Couldn't find any route for ${amount} ${token} → ${toChain}: ${reason}`,
        });
        return;
      }

      // Highest estimated receive wins the "best return" badge.
      options.sort((a, b) => b.receiveValue - a.receiveValue);
      if (options.length > 1) options[0].best = true;

      updateMessage(msgId, {
        isLoading: false,
        text: lang === "pt"
          ? `Encontrei **${options.length} rota${options.length > 1 ? "s" : ""}** para ${amount} ${token} → ${toChain}. Compare o retorno estimado e escolha:`
          : `Found **${options.length} route${options.length > 1 ? "s" : ""}** for ${amount} ${token} → ${toChain}. Compare the estimated return and pick one:`,
        bridgeChoice: { options, unavailable: unavailable.length > 0 ? unavailable : undefined },
      });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to fetch bridge routes: ${msg}` });
    }
  }

  function handleBridgeRouteChoice(msgId: string, opt: BridgeRouteOption) {
    updateMessage(msgId, {
      bridgeChoice: undefined,
      text: opt.summary,
      pending: opt.pending,
    });
  }

  // ── Guided transfer flow ───────────────────────────────────────────────
  async function startTransferWizard(
    msgId: string,
    pre: { token?: string; amount?: number; count?: number } = {},
  ) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    if (selectedNetwork === "testnet") {
      updateMessage(msgId, {
        isLoading: false,
        text: lang === "pt"
          ? "Envio de USDC/WPROS no testnet não está disponível — use PHRS nativo ou troque para Mainnet."
          : "USDC/WPROS sends on testnet aren't supported — use native PHRS or switch to Mainnet.",
      });
      return;
    }
    updateMessage(msgId, {
      isLoading: true,
      text: lang === "pt" ? "Lendo saldos de PROS, WPROS e USDC…" : "Reading PROS, WPROS and USDC balances…",
    });
    try {
      const balances = await getTokenBalancesFast(walletAddress, "mainnet");
      if (opSeqRef.current !== seq) return;
      const map: Record<string, number> = {};
      for (const sym of TRANSFER_WIZARD_TOKENS) {
        map[sym] = balances.find((b) => b.symbol.toUpperCase() === sym)?.balance ?? 0;
      }
      const preToken = pre.token && TRANSFER_WIZARD_TOKENS.includes(pre.token as typeof TRANSFER_WIZARD_TOKENS[number])
        ? pre.token.toUpperCase() : undefined;
      updateMessage(msgId, {
        isLoading: false,
        text: lang === "pt"
          ? "Vamos enviar tokens! Escolha **PROS**, **WPROS** ou **USDC**, a quantidade por transferência e quantas transferências fazer — depois informe cada endereço de destino."
          : "Let's send tokens! Pick **PROS**, **WPROS** or **USDC**, the amount per transfer and how many transfers — then enter each recipient address.",
        transferWizard: {
          balances: map,
          preToken,
          preAmount: pre.amount,
          preCount: pre.count,
        },
      });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to read balances: ${msg}` });
    }
  }

  function handleTransferWizardSubmit(msgId: string, token: string, amount: number, recipients: string[]) {
    const lang = guessUserLang(messages);
    const network: PharosNetworkId = selectedNetwork === "testnet" ? "testnet" : "mainnet";
    try {
      const items = recipients.map((to) => ({ to, amount, token }));
      const build = buildTransferTxs(items, network);
      const n = recipients.length;
      const txCount = build.txs.length;
      const total = amount * n;
      const totalStr = total.toFixed(4);
      updateMessage(msgId, {
        transferWizard: undefined,
        isLoading: false,
        text: txCount === 1 && n > 1
          ? (lang === "pt"
            ? `Pronto! **${n}** envio${n > 1 ? "s" : ""} em **1 assinatura** (total **${totalStr} ${token}**). Confirme na carteira.`
            : `Ready! **${n}** transfer${n > 1 ? "s" : ""} in **1 signature** (total **${totalStr} ${token}**). Confirm in your wallet.`)
          : txCount < n
          ? (lang === "pt"
            ? `Pronto! **${n}** envios para carteiras diferentes com **${token}** — **${txCount} assinatura${txCount > 1 ? "s" : ""}** (1 por destino em tokens ERC-20). Total **${totalStr} ${token}**.`
            : `Ready! **${n}** sends to different wallets with **${token}** — **${txCount} signature${txCount > 1 ? "s" : ""}** (1 per ERC-20 recipient). Total **${totalStr} ${token}**.`)
          : (lang === "pt"
            ? `Pronto! **${txCount}** transferência${txCount > 1 ? "s" : ""} de **${amount} ${token}** cada (total **${totalStr} ${token}**). Confirme cada uma na sua carteira.`
            : `Ready! **${txCount}** transfer${txCount > 1 ? "s" : ""} of **${amount} ${token}** each (total **${totalStr} ${token}**). Confirm each one in your wallet.`),
        transferPending: build,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { transferWizard: undefined, isLoading: false, isError: true, text: msg });
    }
  }

  // ── Guided swap flow ─────────────────────────────────────────────────────
  async function startSwapWizard(msgId: string, pre: { from?: string; amount?: number; to?: string }) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    if (gateTestnetDeFi(msgId, lang)) return;
    updateMessage(msgId, {
      isLoading: true,
      text: lang === "pt" ? "Lendo os saldos da sua carteira…" : "Reading your wallet balances…",
    });
    try {
      const balances = await getTokenBalancesFast(walletAddress);
      if (opSeqRef.current !== seq) return;
      const holdings = balances.filter((h) => h.balance > 0);
      updateMessage(msgId, {
        isLoading: false,
        text: lang === "pt"
          ? "Vamos trocar! Escolha o token de origem, o valor e o token que você quer receber — depois eu comparo as cotações."
          : "Let's swap! Pick the source token, amount and the token you want to receive — then I'll compare quotes.",
        swapWizard: {
          holdings,
          preFrom: pre.from && holdings.some((h) => h.symbol === pre.from) ? pre.from : undefined,
          preAmount: pre.amount,
          preTo: pre.to && ALL_TOKEN_SYMBOLS.includes(pre.to) ? pre.to : undefined,
        },
      });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to read wallet balances: ${msg}` });
    }
  }

  // Quote comparison shared by the wizard and typed complete intents.
  async function runSwapQuotes(msgId: string, intent: ParsedIntent, prefix = "") {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    const head = prefix ? prefix + "\n\n" : "";
    updateMessage(msgId, {
      isLoading: true,
      text: head + (lang === "pt" ? "Buscando cotações na LI.FI e FaroSwap…" : "Fetching quotes from LI.FI and FaroSwap…"),
    });
    const pairOnFaroswap = faroswapSupportsPair(intent.fromToken, intent.toToken);
    const [lifiRes, faroRes] = await Promise.allSettled([
      buildLifiPending(intent),
      pairOnFaroswap ? buildFaroswapPending(intent) : Promise.reject(new Error("pair not on FaroSwap")),
    ]);
    if (opSeqRef.current !== seq) return;

    const options: SwapRouteOption[] = [];
    if (lifiRes.status === "fulfilled") options.push({ provider: "lifi", ...lifiRes.value });
    else console.warn("[pharos:swap] LI.FI quote failed:", lifiRes.reason);
    if (faroRes.status === "fulfilled") options.push({ provider: "faroswap", ...faroRes.value });
    else if (pairOnFaroswap) console.warn("[pharos:swap] FaroSwap quote failed:", faroRes.reason);

    if (options.length === 0) {
      const msg = lifiRes.status === "rejected" && lifiRes.reason instanceof Error ? lifiRes.reason.message : "no route available";
      updateMessage(msgId, { isLoading: false, isError: true, text: `Couldn't get a quote from either route: ${msg}` });
    } else if (options.length === 1) {
      const only = options[0];
      const note = only.provider === "faroswap"
        ? "LI.FI had no route, so I built this via **FaroSwap direct** instead.\n\n"
        : "";
      updateMessage(msgId, { isLoading: false, text: head + note + only.summary, pending: only.pending });
    } else {
      updateMessage(msgId, {
        isLoading: false,
        text: head + (lang === "pt" ? "Cotações das duas rotas — compare e escolha:" : "I got quotes from both routes — compare and pick one:"),
        swapChoice: { options },
      });
    }
  }

  async function handleSwapWizardSubmit(msgId: string, fromToken: string, amount: number, toToken: string) {
    const intent: ParsedIntent = {
      action: "swap", fromToken, toToken, amount, fromChain: "Pharos",
    };
    updateMessage(msgId, { swapWizard: undefined });
    try {
      await runSwapQuotes(msgId, intent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to fetch swap quotes: ${msg}` });
    }
  }

  // ── Guided liquidity flow ────────────────────────────────────────────────
  async function startLiquidityWizard(msgId: string, pre: { amount?: number; feeTier?: number; rangePercent?: number }) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    if (gateTestnetDeFi(msgId, lang)) return;
    updateMessage(msgId, {
      isLoading: true,
      text: lang === "pt" ? "Lendo os saldos da sua carteira…" : "Reading your wallet balances…",
    });
    try {
      const balances = await getTokenBalancesFast(walletAddress);
      if (opSeqRef.current !== seq) return;
      updateMessage(msgId, {
        isLoading: false,
        text: lang === "pt"
          ? "Vamos adicionar liquidez na FaroSwap V3! Escolha o fee tier, o range de preço e quanto de WPROS você quer depositar."
          : "Let's add liquidity on FaroSwap V3! Pick the fee tier, price range and how much WPROS to deposit.",
        liquidityWizard: {
          holdings: balances,
          preAmount: pre.amount,
          preFeeTier: pre.feeTier,
          preRangePercent: pre.rangePercent,
        },
      });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to read wallet balances: ${msg}` });
    }
  }

  async function handleLiquidityWizardSubmit(
    msgId: string,
    params: { feeTier: number; rangeMode: "percent" | "full"; rangePercent?: number; wprosAmount: number },
  ) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    updateMessage(msgId, {
      liquidityWizard: undefined,
      isLoading: true,
      text: lang === "pt" ? "Montando a transação de liquidez…" : "Building liquidity transaction…",
    });
    try {
      const liquidityParams: LiquidityParams = {
        feeTier: params.feeTier as FeeTier,
        rangeMode: params.rangeMode,
        rangePercent: params.rangePercent,
        wprosAmount: params.wprosAmount,
        userAddress: walletAddress,
      };
      const liquidityResult = await buildLiquidityTx(liquidityParams);
      if (opSeqRef.current !== seq) return;
      const { poolState, feeTier: ft, minPrice: lo, maxPrice: hi } = liquidityResult;
      const priceStr = poolState.priceUSDCperWPROS.toFixed(4);
      const feeLabel = FEE_TIERS[ft as FeeTier].label;
      const summaryText =
        `Current price: 1 WPROS = ${priceStr} USDC (~$${priceStr})\n` +
        `Fee tier: ${feeLabel}  ·  Range: ${lo.toFixed(4)} – ${hi.toFixed(4)} USDC/WPROS\n\n` +
        `WPROS required: ${liquidityResult.wprosAmount.toFixed(6)}\n` +
        `USDC required:  ${liquidityResult.usdcAmount.toFixed(6)}\n` +
        (liquidityResult.onlyToken0 ? "\nPrice is below range — only WPROS needed." : "") +
        (liquidityResult.onlyToken1 ? "\nPrice is above range — only USDC needed." : "") +
        `\n\nConfirm in your wallet to mint your LP position.`;
      updateMessage(msgId, { isLoading: false, text: summaryText, liquidityPending: { result: liquidityResult } });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to build liquidity tx: ${msg}` });
    }
  }

  // ── Direct read-only actions (no LLM round-trip) ─────────────────────────
  async function runViewPositions(msgId: string) {
    const seq = opSeqRef.current;
    if (gateTestnetDeFi(msgId, guessUserLang(messages))) return;
    try {
      const positions = await fetchUserPositions(walletAddress);
      if (opSeqRef.current !== seq) return;
      const summary = formatPositionSummary(positions);
      updateMessage(msgId, { isLoading: false, text: summary, positions });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to fetch positions: ${msg}` });
    }
  }

  async function runWalletAnalysisDirect(msgId: string) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    try {
      const analysis = await getWalletAnalysis(walletAddress, selectedNetwork);
      if (opSeqRef.current !== seq) return;
      updateMessage(msgId, { isLoading: false, text: formatWalletAnalysis(analysis, lang, selectedNetwork) });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to read wallet balances: ${msg}` });
    }
  }

  // ── Wallet Intelligence score (public /api/skill/wallet-score) ───────────
  async function runWalletScore(msgId: string, target: string) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    try {
      const res = await fetch("/api/skill/wallet-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: target }),
      });
      const intel = await res.json() as WalletIntel & { available?: boolean; error?: string };
      if (opSeqRef.current !== seq) return;
      if (!res.ok || intel.available === false) throw new Error(intel.error || `HTTP ${res.status}`);
      const short = `${target.slice(0, 6)}…${target.slice(-4)}`;
      updateMessage(msgId, {
        isLoading: false,
        text: lang === "pt"
          ? `🏆 **Wallet Score** de \`${short}\` — nível **${intel.level}** ${intel.levelEmoji} com **${intel.score}/100** pontos:`
          : `🏆 **Wallet Score** for \`${short}\` — level **${intel.level}** ${intel.levelEmoji} with **${intel.score}/100** points:`,
        walletIntel: intel,
      });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to compute wallet score: ${msg}` });
    }
  }

  // ── RealFi positions (9 protocols, live on-chain balances + NAV) ─────────
  async function runRealFiPositions(msgId: string, target: string) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    try {
      const positions = await getRealFiPositions(target);
      if (opSeqRef.current !== seq) return;
      updateMessage(msgId, { isLoading: false, text: formatRealFiPositions(target, positions, lang) });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to read RealFi positions: ${msg}` });
    }
  }

  // ── Live global RWA market (rwa.xyz via /api/rwa) ────────────────────────
  async function runRwaMarket(msgId: string) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    try {
      const res = await fetch("/api/rwa");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RwaMarketData = await res.json();
      if (opSeqRef.current !== seq) return;
      updateMessage(msgId, { isLoading: false, text: formatRwaMarket(data, lang) });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, {
        isLoading: false, isError: true,
        text: lang === "pt"
          ? `Não consegui puxar os dados ao vivo do rwa.xyz agora (${msg}). Tente de novo em instantes ou veja direto em https://app.rwa.xyz`
          : `Couldn't fetch live rwa.xyz data right now (${msg}). Try again shortly or check https://app.rwa.xyz directly.`,
      });
    }
  }

  // ── Wallet transaction history (SocialScan explorer, via /api/txhistory) ──
  async function runTxHistory(msgId: string) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    try {
      const res = await fetch(`/api/txhistory?address=${walletAddress}&limit=10`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TxHistoryResult = await res.json();
      if (opSeqRef.current !== seq) return;
      updateMessage(msgId, { isLoading: false, text: formatTxHistory(data, lang) });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, {
        isLoading: false, isError: true,
        text: lang === "pt"
          ? `Não consegui puxar seu histórico do explorer agora (${msg}). Tente de novo em instantes ou veja direto em https://pharos.socialscan.io/address/${walletAddress}`
          : `Couldn't fetch your history from the explorer right now (${msg}). Try again shortly or check https://pharos.socialscan.io/address/${walletAddress} directly.`,
      });
    }
  }

  // ── Guided stake flow (Faroo): balance → % pick → stake card ─────────────
  async function startStakeFlow(msgId: string) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    if (gateTestnetDeFi(msgId, lang)) return;
    try {
      const bal = parseFloat(await getBalance(walletAddress)) || 0;
      if (opSeqRef.current !== seq) return;
      if (bal < MIN_STAKE_PROS + 0.011) {
        updateMessage(msgId, {
          isLoading: false,
          text: lang === "pt"
            ? `Você não tem PROS suficiente para fazer stake — o mínimo é **${MIN_STAKE_PROS} PROS** (e precisa sobrar ~0.01 para o gas). Faça um swap ou bridge primeiro. 💧`
            : `You don't have enough PROS to stake — the minimum is **${MIN_STAKE_PROS} PROS** (plus ~0.01 kept for gas). Do a swap or bridge first. 💧`,
        });
        return;
      }
      pendingStakeRef.current = "stake";
      updateMessage(msgId, {
        isLoading: false,
        text: lang === "pt"
          ? `Vamos fazer stake na **Faroo**! Você deposita PROS e recebe **stPROS**, que rende com as recompensas de staking da rede. Quanto quer colocar? Escolha uma porcentagem ou digite o valor (mínimo: **${MIN_STAKE_PROS} PROS**).`
          : `Let's stake on **Faroo**! You deposit PROS and receive **stPROS**, which accrues the network's staking rewards. How much do you want to stake? Pick a percentage or type the amount (minimum: **${MIN_STAKE_PROS} PROS**).`,
        amountQuery: { token: "PROS", balance: bal, chain: "Pharos", min: MIN_STAKE_PROS },
      });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to read balance: ${msg}` });
    }
  }

  // Guided unstake flow: shows the user's staked stPROS and asks how much to redeem.
  async function startUnstakeFlow(msgId: string) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    if (gateTestnetDeFi(msgId, lang)) return;
    try {
      const [bal, wprosRaw, nav] = await Promise.all([
        getStakedBalance(walletAddress),
        getWprosBalanceRaw(walletAddress),
        getStakeNav().catch(() => 1),
      ]);
      if (opSeqRef.current !== seq) return;
      if (bal <= 0) {
        const wpros = Number(wprosRaw) / 1e18;
        if (wpros > 0.000001) {
          pendingWprosRescueRef.current = wpros;
          updateMessage(msgId, {
            isLoading: false,
            text: lang === "pt"
              ? `Você não tem **stPROS** livre em stake. Há **${wpros.toFixed(6)} WPROS** na carteira — provavelmente restos de um unstake incompleto.\n\nQuer converter em PROS nativo? Digite **sim** para montar a transação ou **não** / **cancelar** para ignorar.`
              : `You have no free **stPROS** staked. There is **${wpros.toFixed(6)} WPROS** in your wallet — likely leftover from an incomplete unstake.\n\nConvert to native PROS? Type **yes** to build the transaction or **no** / **cancel** to skip.`,
          });
          return;
        }
        const faroo = await getFarooPosition(walletAddress);
        if (opSeqRef.current !== seq) return;
        if (faroo.vaults.length > 0) {
          updateMessage(msgId, {
            isLoading: false,
            text: lang === "pt"
              ? `Seu **stPROS** está depositado no vault **${faroo.vaults[0].symbol}** (${faroo.vaults[0].label}) — **~${faroo.vaults[0].underlyingStPros.toFixed(4)} stPROS** — por isso não aparece como saldo livre.\n\nEnquanto o vault estiver **Locked**, o unstake pelo agente não está disponível. Acompanhe em [app.faroo.xyz](https://app.faroo.xyz).\n\nUse **My Staking** para ver o breakdown completo.`
              : `Your **stPROS** is deposited in vault **${faroo.vaults[0].symbol}** (${faroo.vaults[0].label}) — **~${faroo.vaults[0].underlyingStPros.toFixed(4)} stPROS** — so it doesn't show as free wallet balance.\n\nWhile the vault is **Locked**, unstake via the agent isn't available. Track status at [app.faroo.xyz](https://app.faroo.xyz).\n\nUse **My Staking** for the full breakdown.`,
          });
          return;
        }
        updateMessage(msgId, {
          isLoading: false,
          text: lang === "pt"
            ? "Você não tem **stPROS** em stake nesta carteira. Quer fazer stake de PROS primeiro? É só dizer \"stake\" ou clicar em **Stake PROS**. 🥩"
            : "You don't have any **stPROS** staked in this wallet. Want to stake PROS first? Just say \"stake\" or click **Stake PROS**. 🥩",
        });
        return;
      }
      pendingStakeRef.current = "unstake";
      updateMessage(msgId, {
        isLoading: false,
        text: lang === "pt"
          ? `Vamos resgatar! Você tem **${bal.toFixed(6)} stPROS** (~${(bal * nav).toFixed(6)} PROS no NAV atual). Quanto quer fazer unstake? Escolha uma porcentagem ou digite o valor.\n\n⏳ Atenção: a Faroo tem **período de unstake de 7 dias** (taxa 0%) — após o prazo, você resgata os PROS em [app.faroo.xyz/unstake](https://app.faroo.xyz/unstake).`
          : `Let's redeem! You hold **${bal.toFixed(6)} stPROS** (~${(bal * nav).toFixed(6)} PROS at the current NAV). How much do you want to unstake? Pick a percentage or type the amount.\n\n⏳ Note: Faroo has a **7-day unstake period** (0% fee) — after it matures, you claim the PROS at [app.faroo.xyz/unstake](https://app.faroo.xyz/unstake).`,
        amountQuery: { token: "stPROS", balance: bal, chain: "Pharos" },
      });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to read staked balance: ${msg}` });
    }
  }

  // "My Staking": read-only view of the user's Faroo position (stPROS, NAV, value).
  async function runMyStaking(msgId: string) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    try {
      const pos = await getFarooPosition(walletAddress);
      if (opSeqRef.current !== seq) return;
      updateMessage(msgId, { isLoading: false, text: formatFarooPosition(pos, lang) });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to read staking position: ${msg}` });
    }
  }

  // Builds and shows the Faroo stake/unstake card for the picked amount.
  async function buildStakeCardFor(amount: number, kind: "stake" | "unstake" = "stake") {
    const lang = guessUserLang(messages);
    const isStake = kind === "stake";
    const id = addMessage({
      role: "agent", isLoading: true,
      text: lang === "pt"
        ? (isStake ? "Montando a operação de staking na Faroo…" : "Montando a operação de unstake na Faroo…")
        : (isStake ? "Building the Faroo staking operation…" : "Building the Faroo unstake operation…"),
    });
    try {
      const build = isStake
        ? await buildStakeTxs(amount, walletAddress)
        : await buildUnstakeTxs(amount, walletAddress);
      if ("error" in build) {
        updateMessage(id, { isLoading: false, isError: true, text: friendlyTxError(build.error, lang) });
        return;
      }
      updateMessage(id, {
        isLoading: false,
        text: lang === "pt"
          ? `Pronto! Revise e assine para fazer ${isStake ? "stake" : "unstake"} de **${amount.toFixed(4)} ${isStake ? "PROS" : "stPROS"}** na Faroo.`
          : `Ready! Review and sign to ${isStake ? "stake" : "unstake"} **${amount.toFixed(4)} ${isStake ? "PROS" : "stPROS"}** on Faroo.`,
        stakePending: build,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(id, { isLoading: false, isError: true, text: friendlyTxError(msg, lang) });
    }
  }

  // ── Multi-wallet aggregator (2+ addresses in one message) ────────────────
  async function runMultiWallet(msgId: string, addresses: string[]) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    try {
      // Sequential — the public RPC rate-limits parallel bursts across wallets.
      const analyses = [] as Awaited<ReturnType<typeof getWalletAnalysis>>[];
      for (const addr of addresses) analyses.push(await getWalletAnalysis(addr, "mainnet"));
      if (opSeqRef.current !== seq) return;

      const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
      // Consolidated per-token totals across all wallets.
      const totals = new Map<string, number>();
      let totalUsd = 0, totalTxs = 0;
      for (const a of analyses) {
        totalUsd += a.totalUsd;
        totalTxs += a.txCount;
        for (const h of a.holdings) totals.set(h.symbol, (totals.get(h.symbol) ?? 0) + h.balance);
      }
      const richest = analyses.reduce((best, a) => (a.totalUsd > best.totalUsd ? a : best), analyses[0]);
      const mostActive = analyses.reduce((best, a) => (a.txCount > best.txCount ? a : best), analyses[0]);

      const walletRows = analyses.map((a) =>
        `| [\`${short(a.address)}\`](${a.explorer}) | ${a.holdings.length} | ${a.txCount.toLocaleString("en-US")} | $${a.totalUsd.toFixed(2)} |`).join("\n");
      const tokenRows = [...totals.entries()]
        .sort(([, x], [, y]) => y - x)
        .map(([sym, bal]) => `| **${sym}** | ${bal.toLocaleString("en-US", { maximumFractionDigits: 6 })} |`).join("\n");

      const text = lang === "pt"
        ? `👛 **Agregado de ${analyses.length} carteiras** (Pharos Mainnet)\n\n| Carteira | Tokens | Txs | Valor |\n|---|---|---|---|\n${walletRows}\n\n**Portfólio consolidado:**\n\n| Token | Total |\n|---|---|\n${tokenRows}\n\n- Valor total estimado: **$${totalUsd.toFixed(2)}**\n- Transações combinadas: **${totalTxs.toLocaleString("en-US")}**\n- Mais rica: \`${short(richest.address)}\` · Mais ativa: \`${short(mostActive.address)}\``
        : `👛 **Aggregate of ${analyses.length} wallets** (Pharos Mainnet)\n\n| Wallet | Tokens | Txs | Value |\n|---|---|---|---|\n${walletRows}\n\n**Consolidated portfolio:**\n\n| Token | Total |\n|---|---|\n${tokenRows}\n\n- Estimated total value: **$${totalUsd.toFixed(2)}**\n- Combined transactions: **${totalTxs.toLocaleString("en-US")}**\n- Richest: \`${short(richest.address)}\` · Most active: \`${short(mostActive.address)}\``;
      updateMessage(msgId, { isLoading: false, text });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Failed to aggregate wallets: ${msg}` });
    }
  }

  async function runAllowanceCheck(msgId: string) {
    const seq = opSeqRef.current;
    const lang = guessUserLang(messages);
    try {
      const rows = await scanWalletAllowances(walletAddress);
      if (opSeqRef.current !== seq) return;
      updateMessage(msgId, { isLoading: false, text: formatAllowanceReport(rows, lang) });
    } catch (err) {
      if (opSeqRef.current !== seq) return;
      const msg = err instanceof Error ? err.message : String(err);
      updateMessage(msgId, { isLoading: false, isError: true, text: `Allowance check failed: ${msg}` });
    }
  }

  function startApproveFlow(msgId: string) {
    const lang = guessUserLang(messages);
    updateMessage(msgId, {
      isLoading: false,
      text:
        lang === "pt"
          ? "Envie o approve completo — eu monto a transação para assinar:\n\n`aprovar 100 USDC para 0x…`\n`aprovar USDC ilimitado para 0x…`"
          : "Send a complete approve — I'll build the transaction to sign:\n\n`approve 100 USDC for 0x…`\n`approve unlimited USDC for 0x…`",
    });
    setInput(lang === "pt" ? "aprovar USDC para 0x" : "approve USDC for 0x");
    inputRef.current?.focus();
  }

  // Quick actions: clicking an on-chain function starts the guided flow
  // instantly — no auto-message, no LLM round-trip.
  function handleQuickAction(kind: QuickActionKind) {
    const lang = guessUserLang(messages);
    if (!walletAddress) {
      addMessage({
        role: "agent",
        text: lang === "pt"
          ? "Para fazer essa operação, conecte sua carteira primeiro. Clique em 'Conectar' no topo. 🔗"
          : "To do that, connect your wallet first — click 'Connect' at the top. 🔗",
      });
      return;
    }
    const id = addMessage({ role: "agent", text: "…", isLoading: true });
    switch (kind) {
      case "swap":      void startSwapWizard(id, {}); break;
      case "bridge":    void startBridgeWizard(id, {}); break;
      case "liquidity": void startLiquidityWizard(id, {}); break;
      case "transfer":  void startTransferWizard(id, {}); break;
      case "positions":
        updateMessage(id, { text: lang === "pt" ? "Buscando suas posições na FaroSwap V3…" : "Fetching your FaroSwap V3 positions…" });
        void runViewPositions(id);
        break;
      case "wallet":
        updateMessage(id, { text: lang === "pt" ? "Lendo os saldos da sua carteira…" : "Reading your wallet balances…" });
        void runWalletAnalysisDirect(id);
        break;
      case "score":
        updateMessage(id, { text: lang === "pt" ? "Calculando o score da sua carteira…" : "Computing your wallet score…" });
        void runWalletScore(id, walletAddress);
        break;
      case "realfi":
        updateMessage(id, { text: lang === "pt" ? "Lendo suas posições RealFi em todos os protocolos conhecidos…" : "Reading your RealFi positions across all known protocols…" });
        void runRealFiPositions(id, walletAddress);
        break;
      case "stake":
        updateMessage(id, { text: lang === "pt" ? "Lendo seu saldo de PROS…" : "Reading your PROS balance…" });
        void startStakeFlow(id);
        break;
      case "unstake":
        updateMessage(id, { text: lang === "pt" ? "Lendo seu saldo de stPROS…" : "Reading your stPROS balance…" });
        void startUnstakeFlow(id);
        break;
      case "mystake":
        updateMessage(id, { text: lang === "pt" ? "Lendo sua posição de staking na Faroo…" : "Reading your Faroo staking position…" });
        void runMyStaking(id);
        break;
      case "txhistory":
        updateMessage(id, { text: lang === "pt" ? "Buscando suas últimas transações no explorer…" : "Fetching your latest transactions from the explorer…" });
        void runTxHistory(id);
        break;
      case "rwamarket":
        updateMessage(id, { text: lang === "pt" ? "Coletando dados ao vivo do mercado global de RWA (rwa.xyz)…" : "Fetching live global RWA market data (rwa.xyz)…" });
        void runRwaMarket(id);
        break;
      case "allowance":
        updateMessage(id, { text: lang === "pt" ? "Lendo allowances on-chain…" : "Reading on-chain allowances…" });
        void runAllowanceCheck(id);
        break;
      case "approve":
        startApproveFlow(id);
        break;
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    // Wallet gate: the agent only works for connected users. The composer is
    // already replaced by a connect panel when disconnected — this is the
    // safety net for any other path that calls handleSend.
    if (!walletAddress) {
      addMessage({
        role: "agent",
        text: "🔒 **Conecte sua carteira para usar o agente.** / **Connect your wallet to use the agent.**\n\nClique em **Connect Wallet** — eu só preciso do endereço público para ler seus saldos. Nunca peço sua seed phrase e toda transação exige a sua assinatura.",
      });
      return;
    }
    setInput("");

    // Cancel: abort active flows immediately, no LLM round-trip.
    if (CANCEL_RE.test(text)) {
      addMessage({ role: "user", text });
      const hadActive = hasCancellableFlows(messagesRef.current);
      cancelActiveFlows();
      const lang = guessUserLang([...messages, { id: "x", role: "user", text }]);
      addMessage({
        role: "agent",
        text: hadActive
          ? (lang === "pt" ? "Cancelado ✅ O card e a operação foram fechados. O que você quer fazer agora?" : "Cancelled ✅ The card and pending operation were cleared. What would you like to do next?")
          : (lang === "pt" ? "Nada pendente para cancelar. Se quiser **resgatar stPROS**, diga \"unstake\" ou clique em **Unstake stPROS**." : "Nothing pending to cancel. To **redeem stPROS**, say \"unstake\" or click **Unstake stPROS**."),
      });
      inputRef.current?.focus();
      return;
    }

    setIsSending(true);

    addMessage({ role: "user", text });
    const history = buildChatHistory(messages);
    history.push({ role: "user", content: text });

    const thinkingId = addMessage({ role: "agent", text: "Thinking…", isLoading: true });

    // WPROS rescue confirmation (after unstake flow detected stranded WPROS).
    if (pendingWprosRescueRef.current) {
      const wpros = pendingWprosRescueRef.current;
      const lang: "pt" | "en" = /[ãõáéíóúâêôç]/i.test(text) ? "pt" : guessUserLang(messages);
      if (/^\s*(sim|yes|ok|confirmo?|manda|vai|claro)\s*[.!]?\s*$/i.test(text)) {
        pendingWprosRescueRef.current = false;
        updateMessage(thinkingId, { isLoading: false, text: lang === "pt" ? "Perfeito! Montando a conversão WPROS → PROS… 👇" : "Got it! Building the WPROS → PROS conversion… 👇" });
        void buildStakeCardFor(wpros, "unstake");
        setIsSending(false);
        inputRef.current?.focus();
        return;
      }
      if (/^\s*(n[aã]o|no|nao)\s*[.!]?\s*$/i.test(text)) {
        pendingWprosRescueRef.current = false;
        updateMessage(thinkingId, {
          isLoading: false,
          text: lang === "pt" ? "Ok, ignorei o WPROS por enquanto. Se mudar de ideia, diga **unstake**." : "Ok, leaving the WPROS for now. Say **unstake** if you change your mind.",
        });
        setIsSending(false);
        inputRef.current?.focus();
        return;
      }
    }

    // Guided stake/unstake flow: a typed amount (e.g. "0.25" or "0.25 pros")
    // builds the Faroo card directly, mirroring the percentage buttons.
    if (pendingStakeRef.current) {
      const kind = pendingStakeRef.current;
      const m = text.match(/^\s*([\d]+(?:[.,]\d+)?)\s*(?:st\s*pros|pros)?\s*$/i);
      if (m) {
        const amt = parseFloat(m[1].replace(",", "."));
        const lang: "pt" | "en" = /[ãõáéíóúâêôç]/i.test(text) ? "pt" : guessUserLang(messages);
        if (kind === "stake" && (!(amt > 0) || amt < MIN_STAKE_PROS)) {
          updateMessage(thinkingId, {
            isLoading: false,
            text: lang === "pt"
              ? `O mínimo de stake é **${MIN_STAKE_PROS} PROS**. Digite um valor maior ou escolha uma porcentagem acima. 🙂`
              : `The minimum stake is **${MIN_STAKE_PROS} PROS**. Type a larger amount or pick a percentage above. 🙂`,
          });
        } else if (!(amt > 0)) {
          updateMessage(thinkingId, {
            isLoading: false,
            text: lang === "pt" ? "Digite um valor válido maior que zero. 🙂" : "Please type a valid amount above zero. 🙂",
          });
        } else {
          pendingStakeRef.current = false;
          setMessages((prev) => prev.map((msg) => msg.amountQuery ? { ...msg, amountQuery: undefined } : msg));
          updateMessage(thinkingId, { isLoading: false, text: lang === "pt" ? "Perfeito! 👇" : "Perfect! 👇" });
          void buildStakeCardFor(amt, kind);
        }
        setIsSending(false);
        inputRef.current?.focus();
        return;
      }
    }

    // Deterministic fast path: ecosystem/dApp listing questions are answered
    // straight from the local directory — instant, complete, never dangles.
    const fastLang: "pt" | "en" =
      /[ãõáéíóúâêôçà]|\b(quais?|quem|lista|liste|mostr[ae]|protocolos?|projetos?|parceir|investidor|ecossistema|dispon[ií]ve|not[íi]cia|novidade|campanha|explica|essa|tem)\b/i.test(text) ? "pt" : "en";

    if (isDappListQuestion(text) || isPartnerQuestion(text)) {
      const reply = isDappListQuestion(text) ? buildDappListReply(fastLang) : buildPartnersReply(fastLang);
      updateMessage(thinkingId, { isLoading: false, text: reply });
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Live RWA market fast path: global tokenization stats from rwa.xyz.
    if (/\b(mercado\s+(de\s+)?rwa|rwa\s+market|rwa\s+global|global\s+rwa|dados\s+(de\s+)?rwa|rwa\.xyz|rwa\s+data|tokenized\s+assets?\s+market|mercado\s+de\s+tokeniza)/i.test(text)) {
      updateMessage(thinkingId, {
        isLoading: true,
        text: fastLang === "pt" ? "Coletando dados ao vivo do mercado global de RWA (rwa.xyz)…" : "Fetching live global RWA market data (rwa.xyz)…",
      });
      await runRwaMarket(thinkingId);
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Tx history fast path: list the connected wallet's recent transactions.
    if (walletAddress && /\b(minhas?\s+([úu]ltimas?\s+)?(transa[çc][õo]es|txs?)\b|meu\s+hist[óo]rico|hist[óo]rico\s+de\s+transa[çc][õo]es|my\s+(last\s+|recent\s+)?(transactions?|txs?)\b|(transaction|tx)\s+history|recent\s+activity|minha\s+atividade)/i.test(text)) {
      updateMessage(thinkingId, {
        isLoading: true,
        text: fastLang === "pt" ? "Buscando suas últimas transações no explorer…" : "Fetching your latest transactions from the explorer…",
      });
      await runTxHistory(thinkingId);
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Allowance skill fast path
    if (walletAddress && /\b(allowance|allowances|aprova[çc][ãa]o\s+de\s+gasto|spender\s+allowance|minhas?\s+allowances?)\b/i.test(text)) {
      updateMessage(thinkingId, {
        isLoading: true,
        text: fastLang === "pt" ? "Lendo allowances on-chain…" : "Reading on-chain allowances…",
      });
      await runAllowanceCheck(thinkingId);
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Faroo staking position fast path: read-only, no LLM round-trip.
    if (walletAddress && /\b(meu\s+stake\b|minha\s+posi[çc][ãa]o\s+de\s+stak|meu\s+staking|my\s+stak(?:e|ing)\b(?:\s+position)?|quanto\s+(?:eu\s+)?tenho\s+(?:de\s+|em\s+)?stak|staked\s+balance|saldo\s+de\s+stpros|meu\s+stpros|faroo\s+vault|frhv001|fyv001|pre-?mint)\b/i.test(text)) {
      updateMessage(thinkingId, {
        isLoading: true,
        text: fastLang === "pt" ? "Lendo sua posição de staking na Faroo…" : "Reading your Faroo staking position…",
      });
      await runMyStaking(thinkingId);
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Price alerts fast path: create/list/clear alerts locally, no LLM round-trip.
    const alertCmd = parseAlertCommand(text);
    if (alertCmd) {
      if (alertCmd.kind === "add") {
        const granted = await ensureNotifyPermission();
        addAlert(alertCmd.symbol, alertCmd.direction, alertCmd.target);
        const dirLabel = fastLang === "pt"
          ? (alertCmd.direction === "above" ? "passar de" : "cair abaixo de")
          : (alertCmd.direction === "above" ? "goes above" : "drops below");
        const permNote = granted
          ? ""
          : fastLang === "pt"
          ? "\n\n⚠️ _As notificações do navegador estão bloqueadas — o aviso aparecerá só aqui no chat. Permita notificações no navegador para receber o alerta mesmo em outra aba._"
          : "\n\n⚠️ _Browser notifications are blocked — the alert will only show here in the chat. Allow notifications to get alerted even from another tab._";
        updateMessage(thinkingId, {
          isLoading: false,
          text: fastLang === "pt"
            ? `🔔 Alerta criado! Eu te aviso quando **${alertCmd.symbol}** ${dirLabel} **$${alertCmd.target}**. Eu checo o preço a cada minuto enquanto o app estiver aberto.${permNote}`
            : `🔔 Alert created! I'll let you know when **${alertCmd.symbol}** ${dirLabel} **$${alertCmd.target}**. I check the price every minute while the app is open.${permNote}`,
        });
      } else if (alertCmd.kind === "list") {
        updateMessage(thinkingId, { isLoading: false, text: formatAlerts(listAlerts(), fastLang) });
      } else {
        clearAlerts();
        updateMessage(thinkingId, {
          isLoading: false,
          text: fastLang === "pt" ? "🔕 Todos os alertas de preço foram removidos." : "🔕 All price alerts cleared.",
        });
      }
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Tx explainer fast path: a full 66-char hash in the message → explain it
    // straight from the RPC (works on Mainnet + Atlantic Testnet).
    const pastedHash = extractTxHash(text);
    if (pastedHash) {
      updateMessage(thinkingId, { isLoading: true });
      try {
        // Look on the selected network first, then fall back to the other one
        // (a pasted hash may belong to either network).
        const other: PharosNetworkId = selectedNetwork === "mainnet" ? "testnet" : "mainnet";
        const explanation = await explainTx(pastedHash, selectedNetwork).catch(() => explainTx(pastedHash, other));
        updateMessage(thinkingId, { isLoading: false, text: formatTxExplanation(explanation, fastLang) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateMessage(thinkingId, { isLoading: false, isError: true, text: `RPC error: ${msg}` });
      }
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Deterministic wallet-intelligence fast paths (no LLM round-trip).
    const typedAddresses = [...new Set((text.match(/0x[a-fA-F0-9]{40}/g) ?? []).map((a) => a.toLowerCase()))];

    // Multi-wallet aggregator: 2+ addresses in one message + a wallet-ish verb.
    if (typedAddresses.length >= 2 && /\b(carteiras?|wallets?|agrega|aggregate|compar|combin|analis|analy[sz]|saldos?|balances?|total)\b/i.test(text)) {
      void runMultiWallet(thinkingId, typedAddresses);
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Wallet score: "score da carteira", "wallet score", "rank my wallet"…
    if (/\b(score|pontua[çc][aã]o|rank|n[íi]vel|level|grade|classifica[çc][aã]o)\b/i.test(text) && /\b(carteira|wallet|endere[çc]o|address|minha|my|0x)\b/i.test(text)) {
      const target = typedAddresses[0] ?? (walletAddress || null);
      if (!target) {
        updateMessage(thinkingId, {
          isLoading: false,
          text: fastLang === "pt"
            ? "Para calcular o score, conecte sua carteira ou me passe um endereço 0x… 🔗"
            : "To compute a score, connect your wallet or paste a 0x… address. 🔗",
        });
      } else {
        updateMessage(thinkingId, { text: fastLang === "pt" ? "Calculando o wallet score…" : "Computing the wallet score…" });
        await runWalletScore(thinkingId, target);
      }
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // RealFi positions: protocol names or "posições RWA/RealFi" + ownership context.
    if (/\b(realfi|rwa|p-?alpha|vrpc|termmax|jtrsy|aquaflux|zona|openfi|ember|vaults?)\b/i.test(text)
      && (/\b(posi[çc][õo]es?|positions?|minhas?|meus?|my|tenho|hold|check|verifica|mostra|show)\b/i.test(text) || typedAddresses.length > 0)) {
      const target = typedAddresses[0] ?? (walletAddress || null);
      if (!target) {
        updateMessage(thinkingId, {
          isLoading: false,
          text: fastLang === "pt"
            ? "Para ver posições RealFi, conecte sua carteira ou me passe um endereço 0x… 🔗"
            : "To view RealFi positions, connect your wallet or paste a 0x… address. 🔗",
        });
      } else {
        updateMessage(thinkingId, { text: fastLang === "pt" ? "Lendo posições RealFi em todos os protocolos conhecidos…" : "Reading RealFi positions across all known protocols…" });
        await runRealFiPositions(thinkingId, target);
      }
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // ── Transfer: wizard (guided) or fast path (complete intent) ───────
    const transferIntent =
      /\b(envi[ae]r?|manda[r]?|transfer(?:e|ir)?|send|pag(?:a|ar|ue)|pay)\b/i.test(text) &&
      !/\b(bridge|ponte|swap|troca|liquidez|liquidity|score|approve|aprova)\b/i.test(text);

    if (transferIntent) {
      const network: PharosNetworkId = /\b(testnet|atlantic)\b/i.test(text) ? "testnet"
        : /\bmainnet\b/i.test(text) ? "mainnet" : selectedNetwork;
      const nativeSym = network === "testnet" ? "PHRS" : "PROS";
      const tokenMatch = text.match(/\b(PROS|PHRS|WPROS|USDC)\b/i);
      const token = tokenMatch ? tokenMatch[1].toUpperCase() : undefined;
      const textNoAddr = text.replace(/0x[a-fA-F0-9]{40}/gi, " ");
      const amountMatch = textNoAddr.match(/(\d+(?:[.,]\d+)?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : undefined;
      const vague =
        typedAddresses.length === 0 ||
        !amount ||
        /\b(quero|want|preciso|need)\s+(enviar|mandar|send|transfer)/i.test(text) ||
        /\b(enviar|send|manda)\s+(token|tokens|pros|usdc|wpros)?\s*$/i.test(text.trim());

      if (!walletAddress) {
        updateMessage(thinkingId, {
          isLoading: false,
          text: fastLang === "pt"
            ? "Para enviar tokens, conecte sua carteira primeiro (botão 'Conectar' no topo). 🔗"
            : "To send tokens, connect your wallet first ('Connect' at the top). 🔗",
        });
      } else if (vague) {
        void startTransferWizard(thinkingId, { token, amount });
      } else if (typedAddresses.length >= 2 && amount && token) {
        try {
          const build = buildTransferTxs(
            typedAddresses.map((to) => ({ to, amount, token })),
            network,
          );
          updateMessage(thinkingId, {
            isLoading: false,
            text: fastLang === "pt"
              ? `Pronto! **${typedAddresses.length}** transferências de **${amount} ${token}** cada. Confirme na carteira.`
              : `Ready! **${typedAddresses.length}** transfers of **${amount} ${token}** each. Confirm in your wallet.`,
            transferPending: build,
          });
        } catch (err) {
          updateMessage(thinkingId, { isLoading: false, isError: true, text: err instanceof Error ? err.message : String(err) });
        }
      } else if (typedAddresses.length === 1 && amount) {
        const sendToken = token ?? nativeSym;
        const to = typedAddresses[0];
        try {
          const build = buildTransferTxs([{ to, amount, token: sendToken }], network);
          updateMessage(thinkingId, {
            isLoading: false,
            text: fastLang === "pt"
              ? `Pronto! Vou enviar **${amount} ${sendToken}** para \`${to.slice(0, 6)}…${to.slice(-4)}\`. Confirme na sua carteira.`
              : `Ready! Sending **${amount} ${sendToken}** to \`${to.slice(0, 6)}…${to.slice(-4)}\`. Confirm in your wallet.`,
            transferPending: build,
          });
        } catch (err) {
          updateMessage(thinkingId, { isLoading: false, isError: true, text: err instanceof Error ? err.message : String(err) });
        }
      } else if (typedAddresses.length === 1) {
        const sendToken = token ?? nativeSym;
        const to = typedAddresses[0];
        try {
          const balances = await getTokenBalancesFast(walletAddress, network);
          const bal = balances.find((b) => b.symbol.toUpperCase() === sendToken)?.balance ?? 0;
          pendingTransferRef.current = { to, token: sendToken, network };
          updateMessage(thinkingId, {
            isLoading: false,
            text: fastLang === "pt"
              ? `Quanto de **${sendToken}** você quer enviar para \`${to.slice(0, 6)}…${to.slice(-4)}\`? Escolha uma porcentagem ou digite o valor.`
              : `How much **${sendToken}** do you want to send to \`${to.slice(0, 6)}…${to.slice(-4)}\`? Pick a percentage or type the amount.`,
            amountQuery: { token: sendToken, balance: bal, chain: PHAROS_NETWORKS[network].label },
          });
        } catch (err) {
          updateMessage(thinkingId, { isLoading: false, isError: true, text: err instanceof Error ? err.message : String(err) });
        }
      } else {
        void startTransferWizard(thinkingId, { token, amount });
      }
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Follow-up: pending single-address transfer waiting for amount only.
    // typed just a number ("0.5" or "0.5 PROS") → build the payment directly.
    if (pendingTransferRef.current) {
      const pend = pendingTransferRef.current;
      const numOnly = text.replace(new RegExp(`\\b${pend.token}\\b`, "i"), "").trim().match(/^(\d+(?:[.,]\d+)?)$/);
      if (numOnly) {
        const amount = parseFloat(numOnly[1].replace(",", "."));
        pendingTransferRef.current = null;
        try {
          const build = buildTransferTxs([{ to: pend.to, amount, token: pend.token }], pend.network);
          updateMessage(thinkingId, {
            isLoading: false,
            text: fastLang === "pt"
              ? `Pronto! Vou enviar **${amount} ${pend.token}** para \`${pend.to.slice(0, 6)}…${pend.to.slice(-4)}\`. Confirme na sua carteira.`
              : `Ready! Sending **${amount} ${pend.token}** to \`${pend.to.slice(0, 6)}…${pend.to.slice(-4)}\`. Confirm in your wallet.`,
            transferPending: build,
          });
        } catch (err) {
          updateMessage(thinkingId, { isLoading: false, isError: true, text: err instanceof Error ? err.message : String(err) });
        }
        setIsSending(false);
        inputRef.current?.focus();
        return;
      }
      // User changed the subject — drop the pending transfer.
      pendingTransferRef.current = null;
    }

    // Live campaign tracker fast path
    if (CAMPAIGN_QUESTION_RE.test(text) && /\b(pharos|port|ativ|active|live|rolando|running)\b/i.test(text)) {
      updateMessage(thinkingId, { isLoading: false, isSearching: true });
      const reply = await fetchCampaignsReply(fastLang);
      updateMessage(thinkingId, { isSearching: false, text: reply });
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Live news feed fast path
    if (NEWS_QUESTION_RE.test(text) && /\b(pharos|rede|network)\b/i.test(text)) {
      updateMessage(thinkingId, { isLoading: false, isSearching: true });
      const reply = await fetchNewsReply(fastLang);
      updateMessage(thinkingId, { isSearching: false, text: reply });
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    // Live X/Twitter feed fast path
    if (TWEET_QUESTION_RE.test(text)) {
      updateMessage(thinkingId, { isLoading: false, isSearching: true, text: fastLang === "pt" ? "Buscando posts ao vivo de @pharos_network…" : "Fetching live posts from @pharos_network…" });
      const reply = await fetchTweetsReply(fastLang);
      updateMessage(thinkingId, { isSearching: false, text: reply });
      setIsSending(false);
      inputRef.current?.focus();
      return;
    }

    try {
      const txContext = lastTxHash
        ? `sessionTx=signed,txHashPrefix=${lastTxHash.slice(0, 10)}`
        : "sessionTx=none";
      const prefsContext = getPrefsContext();

      // Staged status: instead of a static "Thinking…", the placeholder narrates
      // progress while the model works — perceived latency drops a lot.
      const statusTimers: Array<ReturnType<typeof setTimeout>> = [];
      const stageStatus = (delayMs: number, pt: string, en: string) => {
        statusTimers.push(setTimeout(() => {
          setMessages((prev) => prev.map((m) =>
            m.id === thinkingId && m.isLoading ? { ...m, text: fastLang === "pt" ? pt : en } : m
          ));
        }, delayMs));
      };
      stageStatus(1000, "Consultando a base de conhecimento…", "Consulting the knowledge base…");
      stageStatus(3500, "Formulando a resposta…", "Composing the reply…");
      stageStatus(8000, "Quase lá — finalizando…", "Almost there — wrapping up…");

      // Intent parsing + web search + deep docs all run SERVER-SIDE via /api/agent
      // so API keys never reach the browser. Price (CoinGecko) and all tx-building
      // (LI.FI/FaroSwap/CCIP/CCTP/RPC) use public endpoints and stay client-side.
      const groqResult = await callAgent({ history, prefsContext, txContext });
      statusTimers.forEach(clearTimeout);

      if (groqResult) {
        // Persist detected language for future context
        if (groqResult.detectedLanguage) {
          updateLanguage(groqResult.detectedLanguage);
        }
        // Detect conversation style from script generation or tech terms
        if (groqResult.action === "generate_script") {
          updateConversationStyle("technical");
        }

        // generate_script (BONUS for devs): return ready-to-run code as TEXT.
        // No wallet, no execution, no keys — the app only renders the snippet.
        if (groqResult.action === "generate_script") {
          const lang = guessUserLang(messages);
          try {
            const gen = generateScript({
              operation: (groqResult.scriptOperation ?? "balance") as ScriptOperation,
              language: (groqResult.scriptLanguage ?? "javascript") as ScriptLanguage,
              params: groqResult.scriptParams ?? undefined,
            });
            // No transaction here, so skip the execution-claim sanitizer (it would
            // wrongly swap a code intro for a "choose a provider" message).
            const intro = (groqResult.reply || "").trim() ||
              (lang === "pt" ? "Aqui está um script pronto pra rodar:" : "Here's a ready-to-run script:");
            const runLabel = lang === "pt" ? "Como rodar" : "How to run";
            const safetyNote =
              lang === "pt"
                ? "_Gerado como texto — o app não executa nada nem toca na sua chave. A chave fica só no seu terminal._"
                : "_Generated as text — the app runs nothing and never touches your key. Your key stays in your own terminal._";
            const body =
              `${intro}\n\n` +
              "```" + gen.lang + "\n" + gen.code + "```\n\n" +
              `**${runLabel}:** ${gen.howToRun}\n\n` +
              safetyNote;
            updateMessage(thinkingId, { isLoading: false, text: body });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("[pharos:scriptgen] failed —", msg);
            updateMessage(thinkingId, {
              isLoading: false,
              text:
                lang === "pt"
                  ? "Não consegui gerar o script agora. Me diga a operação (saldo, deploy, transfer, airdrop…) e a linguagem (ethers/viem/web3.py/Foundry)."
                  : "Couldn't generate the script just now. Tell me the operation (balance, deploy, transfer, airdrop…) and language (ethers/viem/web3.py/Foundry).",
            });
          }
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

        // ── Payment agent: transfer PROS/ERC-20 (single or batch) ──────────
        if (groqResult.action === "transfer") {
          const lang = guessUserLang(messages);
          if (!walletAddress) {
            updateMessage(thinkingId, {
              isLoading: false,
              text: lang === "pt"
                ? "Para enviar tokens, conecte sua carteira primeiro (botão 'Conectar' no topo). 🔗"
                : "To send tokens, connect your wallet first ('Connect' at the top). 🔗",
            });
          } else if (!groqResult.transfers || groqResult.transfers.length === 0) {
            void startTransferWizard(thinkingId, {});
          } else {
            try {
              const network: PharosNetworkId = /\b(testnet|atlantic)\b/i.test(text)
                ? "testnet"
                : /\bmainnet\b/i.test(text)
                ? "mainnet"
                : selectedNetwork;
              const build = buildTransferTxs(groqResult.transfers, network);
              updateMessage(thinkingId, {
                isLoading: false,
                text: sanitizeGroqReply(groqResult.reply),
                transferPending: build,
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              updateMessage(thinkingId, { isLoading: false, isError: true, text: msg });
            }
          }
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

        // ── ERC-20 approval via natural language ───────────────────────────
        if (groqResult.action === "approve") {
          const lang = guessUserLang(messages);
          if (!walletAddress) {
            updateMessage(thinkingId, {
              isLoading: false,
              text: lang === "pt"
                ? "Para aprovar tokens, conecte sua carteira primeiro (botão 'Conectar' no topo). 🔗"
                : "To approve tokens, connect your wallet first ('Connect' at the top). 🔗",
            });
          } else if (!groqResult.approveToken || !groqResult.approveSpender || groqResult.approveAmount == null) {
            updateMessage(thinkingId, { isLoading: false, text: groqResult.reply });
          } else {
            try {
              const tx = buildApproveTx({
                token: groqResult.approveToken,
                spender: groqResult.approveSpender,
                amount: groqResult.approveAmount,
              });
              updateMessage(thinkingId, { isLoading: false, text: sanitizeGroqReply(groqResult.reply), approvePending: tx });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              updateMessage(thinkingId, { isLoading: false, isError: true, text: msg });
            }
          }
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

        // ── Faroo liquid staking: stake PROS → stPROS / unstake ────────────
        if (groqResult.action === "stake" || groqResult.action === "unstake") {
          const lang = guessUserLang(messages);
          const isStake = groqResult.action === "stake";
          if (!walletAddress) {
            updateMessage(thinkingId, {
              isLoading: false,
              text: lang === "pt"
                ? "Para fazer stake, conecte sua carteira primeiro (botão 'Conectar' no topo). 🔗"
                : "To stake, connect your wallet first ('Connect' at the top). 🔗",
            });
          } else if (gateTestnetDeFi(thinkingId, lang)) {
            // Faroo contracts are mainnet-only; the gate already replied.
          } else if (groqResult.amount == null || groqResult.amount <= 0) {
            // No amount given → start the guided flow (balance + % buttons + custom input).
            if (isStake) await startStakeFlow(thinkingId);
            else await startUnstakeFlow(thinkingId);
          } else {
            updateMessage(thinkingId, {
              isLoading: true,
              text: lang === "pt" ? "Montando a operação de staking na Faroo…" : "Building the Faroo staking operation…",
            });
            try {
              const build = isStake
                ? await buildStakeTxs(groqResult.amount, walletAddress)
                : await buildUnstakeTxs(groqResult.amount, walletAddress);
              if ("error" in build) {
                updateMessage(thinkingId, { isLoading: false, isError: true, text: friendlyTxError(build.error, lang) });
              } else {
                const intro = sanitizeGroqReply(groqResult.reply) || (lang === "pt"
                  ? `Pronto! Revise e assine para ${isStake ? "fazer stake de" : "resgatar"} ${build.amount} ${isStake ? "PROS" : "stPROS"} na Faroo.`
                  : `Ready! Review and sign to ${isStake ? "stake" : "unstake"} ${build.amount} ${isStake ? "PROS" : "stPROS"} on Faroo.`);
                updateMessage(thinkingId, { isLoading: false, text: intro, stakePending: build });
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              updateMessage(thinkingId, { isLoading: false, isError: true, text: friendlyTxError(msg, lang) });
            }
          }
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

        // ── Tx explainer (when the LLM caught the hash instead of the fast path)
        if (groqResult.action === "explain_tx" && groqResult.txHash) {
          const lang = guessUserLang(messages);
          try {
            const other: PharosNetworkId = selectedNetwork === "mainnet" ? "testnet" : "mainnet";
            const explanation = await explainTx(groqResult.txHash, selectedNetwork).catch(() => explainTx(groqResult.txHash!, other));
            updateMessage(thinkingId, { isLoading: false, text: formatTxExplanation(explanation, lang) });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            updateMessage(thinkingId, { isLoading: false, isError: true, text: `RPC error: ${msg}` });
          }
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

        const complete = isCompleteIntent(groqResult);
        const ragSources = groqResult.foundInKnowledge ? groqResult.sources : undefined;

        if (!complete) {
          const effectiveQuery = groqResult.searchQuery || (groqResult.needsSearch ? text : null);

          // On-chain actions are always guided: never a dangling "confirm in
          // your wallet" reply without an actual card. Bridge/swap/liquidity
          // wizards show live balances, % quick-picks and all options.
          if (groqResult.action === "bridge" && walletAddress) {
            await startBridgeWizard(thinkingId, {
              token: groqResult.fromToken || undefined,
              amount: groqResult.amount != null && groqResult.amount > 0 ? groqResult.amount : undefined,
              chain: groqResult.toChain || undefined,
            });
            setIsSending(false);
            inputRef.current?.focus();
            return;
          }
          if (groqResult.action === "swap" && walletAddress) {
            await startSwapWizard(thinkingId, {
              from: groqResult.fromToken || undefined,
              amount: groqResult.amount != null && groqResult.amount > 0 ? groqResult.amount : undefined,
              to: groqResult.toToken || undefined,
            });
            setIsSending(false);
            inputRef.current?.focus();
            return;
          }
          if (groqResult.action === "add_liquidity" && walletAddress) {
            await startLiquidityWizard(thinkingId, {
              amount: groqResult.amount != null && groqResult.amount > 0 ? groqResult.amount : undefined,
              feeTier: groqResult.feeTier ?? undefined,
              rangePercent: groqResult.rangePercent ?? undefined,
            });
            setIsSending(false);
            inputRef.current?.focus();
            return;
          }

          if (!groqResult.action && groqResult.needsPrice) {
            updateMessage(thinkingId, { isLoading: false, isSearching: true });
            try {
              const price = await getTokenPrice(groqResult.needsPrice);
              const block = formatPriceBlock(groqResult.needsPrice, price);
              updateMessage(thinkingId, {
                isSearching: false,
                text: groqResult.reply + "\n\n" + block,
                priceChart: { symbol: groqResult.needsPrice },
              });
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
            } else if (DANGLING_PROMISE_RE.test(groqResult.reply)) {
              // Docs lookup failed and the reply is just a promise — search instead.
              const result = await searchWithFallback(groqResult.docsQuery, groqResult.reply, { history, prefsContext, txContext }, guessUserLang(messages));
              updateMessage(thinkingId, { isSearching: false, text: result.text, sources: result.sources });
            } else {
              updateMessage(thinkingId, { isSearching: false, text: groqResult.reply, sources: ragSources });
            }
          } else if (!groqResult.action && groqResult.needsSearch && effectiveQuery) {
            updateMessage(thinkingId, { isLoading: false, isSearching: true });
            const result = await searchWithFallback(effectiveQuery, groqResult.reply, { history, prefsContext, txContext }, guessUserLang(messages));
            updateMessage(thinkingId, { isSearching: false, text: result.text, sources: result.sources ?? (result.text === groqResult.reply ? ragSources : undefined) });
          } else if ((groqResult.action === "swap" || groqResult.action === "add_liquidity") && groqResult.needsAmount && walletAddress) {
            // Balance check before asking for amount
            try {
              const fromToken = groqResult.fromToken || "PROS";
              const analysis = await getWalletAnalysis(walletAddress);
              const fromChain = groqResult.fromChain || "Pharos";
              
              // Find the token balance in holdings
              const tokenHolding = analysis.holdings.find(h => h.symbol === fromToken);
              const balance = tokenHolding?.balance ?? 0;
              
              updateMessage(thinkingId, {
                isLoading: false,
                text: groqResult.reply,
                amountQuery: { token: fromToken, balance, chain: fromChain },
              });
            } catch (err) {
              console.warn("[pharos:balance] failed to fetch balance:", err);
              updateMessage(thinkingId, { isLoading: false, text: groqResult.reply, sources: ragSources });
            }
          } else if (!groqResult.action && DANGLING_PROMISE_RE.test(groqResult.reply)) {
            // The model promised to search but didn't set needsSearch — the reply
            // would dangle with no content. Force a grounded search so the user
            // actually gets an answer.
            updateMessage(thinkingId, { isLoading: false, isSearching: true });
            const result = await searchWithFallback(text, groqResult.reply, { history, prefsContext, txContext }, guessUserLang(messages));
            updateMessage(thinkingId, { isSearching: false, text: result.text, sources: result.sources });
          } else {
            updateMessage(thinkingId, { isLoading: false, text: groqResult.reply, sources: ragSources });
          }
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

        const safeReply = sanitizeGroqReply(groqResult.reply);

        // view_wallet (read-only wallet analysis — needs the connected address)
        if (groqResult.action === "view_wallet") {
          const lang = guessUserLang(messages);
          // Address priority: an explicit 0x… address in THIS message wins (public
          // read, no connection needed); otherwise the connected wallet. Read fresh
          // from the raw message each time — never a cached/previous address.
          const typedAddress = text.match(/0x[a-fA-F0-9]{40}/)?.[0] ?? null;
          const target = typedAddress ?? (walletAddress || null);
          if (!target) {
            updateMessage(thinkingId, {
              isLoading: false,
              text: lang === "pt"
                ? "Para analisar uma carteira, conecte a sua (botão 'Conectar' no topo) ou me passe um endereço 0x… 🔗"
                : "To analyze a wallet, connect yours ('Connect' at the top) or paste a 0x… address. 🔗",
            });
            setIsSending(false);
            inputRef.current?.focus();
            return;
          }
          updateMessage(thinkingId, { text: safeReply + "\n\nReading Pharos balances…" });
          try {
            const analysis = await getWalletAnalysis(target, selectedNetwork);
            let body = safeReply + "\n\n" + formatWalletAnalysis(analysis, lang, selectedNetwork);
            if (
              typedAddress &&
              walletAddress &&
              typedAddress.toLowerCase() !== walletAddress.toLowerCase()
            ) {
              const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
              body += lang === "pt"
                ? `\n\n_Nota: você colou \`${short(typedAddress)}\` — isso é só leitura. A carteira **conectada** no topo (para assinar txs) continua sendo \`${short(walletAddress)}\`. Para trocar, use **Conectar** e escolha a carteira certa._`
                : `\n\n_Note: you pasted \`${short(typedAddress)}\` — that's read-only. The **connected** wallet in the header (for signing txs) is still \`${short(walletAddress)}\`. To switch, use **Connect** and pick the right wallet._`;
            }
            updateMessage(thinkingId, { isLoading: false, text: body });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            updateMessage(thinkingId, { isLoading: false, isError: true, text: `Failed to read wallet balances: ${msg}` });
          }
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

        const intent    = groqToIntent(groqResult);

        // Gate: every on-chain action needs a connected wallet. Don't build a tx
        // (or fetch positions) without one — ask the user to connect first.
        const needsWallet = intent.action === "swap" || intent.action === "bridge" || intent.action === "add_liquidity" || intent.action === "remove_liquidity" || intent.action === "view_positions";
        if (needsWallet && !walletAddress) {
          const lang = guessUserLang(messages);
          updateMessage(thinkingId, {
            isLoading: false,
            text: lang === "pt"
              ? "Para fazer essa operação, conecte sua carteira primeiro. Clique em 'Conectar' no topo. 🔗"
              : "To do that, connect your wallet first — click 'Connect' at the top. 🔗",
          });
          setIsSending(false);
          inputRef.current?.focus();
          return;
        }

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

        // remove_liquidity
        if (intent.action === "remove_liquidity") {
          updateMessage(thinkingId, { text: safeReply + "\n\nFetching your FaroSwap V3 positions…" });
          try {
            const positions = await fetchUserPositions(walletAddress);
            if (positions.length === 0) {
              updateMessage(thinkingId, { isLoading: false, text: "You have no LP positions to remove yet." });
            } else {
              updateMessage(thinkingId, {
                isLoading: false,
                text: safeReply,
              });
              // Show a message with position selector for the user to pick which one to remove
              addMessage({
                role: "agent",
                text: "Which position would you like to remove?",
                positions,
                removeMode: true,
              });
            }
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

        // bridge — always the guided wizard (prefilled with what the user said),
        // so token/amount/destination are confirmed against live balances and
        // routes are compared for the best return.
        if (intent.action === "bridge") {
          await startBridgeWizard(thinkingId, {
            token: intent.fromToken || undefined,
            amount: intent.amount > 0 ? intent.amount : undefined,
            chain: intent.toChain || undefined,
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
            await runSwapQuotes(thinkingId, intent, safeReply);
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

      // Same wallet gate for the local-parser fallback path.
      if (!walletAddress) {
        const lang = guessUserLang(messages);
        updateMessage(thinkingId, {
          isLoading: false,
          text: lang === "pt"
            ? "Para fazer essa operação, conecte sua carteira primeiro. Clique em 'Conectar' no topo. 🔗"
            : "To do that, connect your wallet first — click 'Connect' at the top. 🔗",
        });
        setIsSending(false);
        inputRef.current?.focus();
        return;
      }

      if (intent.action === "bridge") {
        await startBridgeWizard(thinkingId, {
          token: intent.fromToken || undefined,
          amount: intent.amount > 0 ? intent.amount : undefined,
          chain: intent.toChain || undefined,
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
        : m.removeLiquidityPending
        ? (() => {
            const r = m.removeLiquidityPending.result;
            const wpros = (r.amount0WPROS + r.feesWPROS).toFixed(4);
            const usdc  = (r.amount1USDC  + r.feesUSDC).toFixed(4);
            return `Liquidity removed! Received ${wpros} WPROS + ${usdc} USDC from NFT #${String(r.tokenId)}.`;
          })()
        : m.transferPending
        ? (() => {
            const totals = Object.entries(m.transferPending.totalByToken)
              .map(([sym, amt]) => `${amt.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${sym}`)
              .join(" + ");
            const n = m.transferPending.txs.length;
            return n > 1 ? `Payment sent! ${totals} delivered across ${n} transfers.` : `Payment sent! ${totals} delivered.`;
          })()
        : m.approvePending
        ? `Approval confirmed! ${m.approvePending.description}`
        : m.stakePending
        ? (m.stakePending.kind === "stake"
            ? `Staked! ${m.stakePending.amount} PROS deposited into Faroo — you received ~${m.stakePending.expectedOut.toFixed(6)} stPROS, which accrues staking rewards over time.`
            : m.stakePending.rescue
            ? `Unwrapped! ${m.stakePending.amount} WPROS converted to native PROS in your wallet.`
            : `Unstake requested! ${m.stakePending.amount} stPROS redeemed — ~${m.stakePending.expectedOut.toFixed(6)} PROS enters Faroo's ${m.stakePending.claimAfterDays ?? 7}-day unstake period. Claim it on [app.faroo.xyz/unstake](https://app.faroo.xyz/unstake) once it matures.`)
        : m.pending?.description ?? "Transaction sent!";
      return {
        ...m,
        pending: undefined,
        liquidityPending: undefined,
        removeLiquidityPending: undefined,
        transferPending: undefined,
        approvePending: undefined,
        stakePending: undefined,
        text: successText,
        txHash: hash,
      };
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

  // Translate raw EVM revert reasons into actionable, human explanations.
  // Covers every on-chain flow (swap, bridge, liquidity, transfer, approve).
  function friendlyTxError(err: string, lang: "pt" | "en"): string {
    const pt = lang === "pt";
    if (/\bSTF\b|safeTransferFrom|TRANSFER_FROM_FAILED/i.test(err)) {
      return pt
        ? "❌ **A transação falharia (STF — transferência de token recusada).** Isso acontece quando a carteira ativa não tem saldo ou aprovação suficiente do token — geralmente porque a transação foi montada para outra carteira. Peça a operação de novo que eu remonto tudo com os saldos da carteira atual."
        : "❌ **The transaction would fail (STF — token transfer refused).** This happens when the active wallet lacks the token balance or approval — usually because the transaction was built for a different wallet. Ask for the operation again and I'll rebuild it with the current wallet's balances.";
    }
    if (/price slippage check|slippage/i.test(err)) {
      return pt
        ? "❌ **Falha por slippage:** o preço da pool se moveu desde que a transação foi montada. Peça a operação de novo que eu recalculo com o preço atual."
        : "❌ **Slippage check failed:** the pool price moved since the transaction was built. Ask again and I'll rebuild it with the current price.";
    }
    if (/transaction too old|expired|deadline/i.test(err)) {
      return pt
        ? "❌ **Transação expirada:** o card ficou aberto por mais de 30 minutos e o prazo on-chain venceu. Peça a operação de novo que eu monto uma nova."
        : "❌ **Transaction expired:** the card sat open for more than 30 minutes and the on-chain deadline passed. Ask again and I'll build a fresh one.";
    }
    if (/insufficient funds/i.test(err)) {
      return pt
        ? "❌ **Saldo de PROS insuficiente para o gas.** A carteira ativa não tem PROS nativo suficiente para pagar a taxa da transação."
        : "❌ **Insufficient PROS for gas.** The active wallet doesn't have enough native PROS to pay the transaction fee.";
    }
    if (/insufficient (?!funds)/i.test(err)) {
      return pt
        ? `❌ **Saldo insuficiente na carteira ativa.**\n\n${err}`
        : `❌ **Insufficient balance in the active wallet.**\n\n${err}`;
    }
    if (/nonce/i.test(err)) {
      return pt
        ? "❌ **Conflito de nonce na carteira.** Há outra transação pendente ou o nonce está fora de ordem — verifique a atividade na sua carteira e tente novamente."
        : "❌ **Wallet nonce conflict.** Another transaction is pending or the nonce is out of order — check your wallet activity and try again.";
    }
    return pt ? `Transação falhou: ${err}` : `Transaction failed: ${err}`;
  }

  function handleTxError(id: string, err: string) {
    const lang = guessUserLang(messages);
    addMessage({ role: "agent", text: friendlyTxError(err, lang), isError: true });
    void id;
  }

  // Tx mined but REVERTED on-chain (receipt.status === 0). Replace the pending
  // card with an honest failure + Pharosscan link. NOT a success.
  function handleTxReverted(id: string, hash: string) {
    const lang = guessUserLang(messages);
    const link = `${PHAROS_NETWORKS[selectedNetwork].explorerTx}${hash}`;
    updateMessage(id, {
      pending: undefined,
      liquidityPending: undefined,
      removeLiquidityPending: undefined,
      transferPending: undefined,
      approvePending: undefined,
      stakePending: undefined,
      isError: true,
      text: lang === "pt"
        ? `❌ A transação falhou (revertida on-chain). Veja no [Pharosscan](${link}). Quer tentar de novo?`
        : `❌ The transaction failed (reverted on-chain). View on [Pharosscan](${link}). Want to try again?`,
    });
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
    <div className="flex h-screen chat-layout overflow-hidden">

      {/* ── Sidebar (ChatGPT-style) ──────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-[260px] shrink-0 chat-sidebar-gpt py-4 px-3 overflow-hidden">

        <Link href="/" className="flex items-center gap-2 px-2 mb-4 shrink-0 group">
          <div className="w-8 h-8 rounded-lg chat-orb-mini flex items-center justify-center">
            <img src="/pharos-logo.svg" alt="" className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold text-white font-display group-hover:text-[var(--accent-soft)] transition-colors">ProsPilot</span>
        </Link>

        <button onClick={handleResetChat} className="sidebar-new-chat mb-4 shrink-0">
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4v12M4 10h12" strokeLinecap="round"/></svg>
          {t("chat.newChat", siteLang)}
        </button>

        <div className="flex-1 overflow-y-auto space-y-5 pr-0.5">
          {/* DeFi */}
          <div>
            <p className="sidebar-section-label">{siteLang === "pt" ? "DeFi" : "DeFi"}</p>
            <div className="space-y-0.5">
              {([
                { label: "Swap tokens", icon: "⇄", action: "swap" as const },
                { label: "Bridge cross-chain", icon: "⤡", action: "bridge" as const },
                { label: "Add Liquidity", icon: "+", action: "liquidity" as const },
                { label: "Send tokens", icon: "→", action: "transfer" as const },
                { label: "Approve token", icon: "✓", action: "approve" as const },
                { label: "Check allowance", icon: "🔐", action: "allowance" as const },
              ]).map((item) => (
                <button key={item.label} onClick={() => handleQuickAction(item.action)} className="sidebar-item">
                  <span className="sidebar-item-icon w-7 h-7 rounded-lg flex items-center justify-center text-xs">{item.icon}</span>
                  <span className="sidebar-item-text">{chipT(item.label, siteLang)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stake */}
          <div>
            <p className="sidebar-section-label">{siteLang === "pt" ? "Staking" : "Staking"}</p>
            <div className="space-y-0.5">
              {([
                { label: "Stake PROS", icon: "◆", action: "stake" as const },
                { label: "Unstake stPROS", icon: "↩", action: "unstake" as const },
                { label: "My Staking", icon: "◉", action: "mystake" as const },
                { label: "My LP Positions", icon: "◈", action: "positions" as const },
              ]).map((item) => (
                <button key={item.label} onClick={() => handleQuickAction(item.action)} className="sidebar-item">
                  <span className="sidebar-item-icon w-7 h-7 rounded-lg flex items-center justify-center text-xs">{item.icon}</span>
                  <span className="sidebar-item-text">{chipT(item.label, siteLang)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Intel */}
          <div>
            <p className="sidebar-section-label">{siteLang === "pt" ? "Inteligência" : "Intelligence"}</p>
            <div className="space-y-0.5">
              {([
                { label: "Wallet Analysis", icon: "◎", action: "wallet" as const },
                { label: "Wallet Score", icon: "★", action: "score" as const },
                { label: "Tx History", icon: "≡", action: "txhistory" as const },
                { label: "RealFi Positions", icon: "▣", action: "realfi" as const },
                { label: "RWA Market (live)", icon: "◐", action: "rwamarket" as const },
              ]).map((item) => (
                <button key={item.label} onClick={() => handleQuickAction(item.action)} className="sidebar-item">
                  <span className="sidebar-item-icon w-7 h-7 rounded-lg flex items-center justify-center text-xs">{item.icon}</span>
                  <span className="sidebar-item-text">{chipT(item.label, siteLang)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Site pages — campaigns, news, ecosystem… */}
          <div>
            <p className="sidebar-section-label">{siteLang === "pt" ? "Explorar Pharos" : "Explore Pharos"}</p>
            <SiteNavSidebar />
          </div>

          {chatList.length > 0 && (
            <div>
              <p className="sidebar-section-label">{siteLang === "pt" ? "Histórico" : "History"}</p>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {chatList.map((c) => (
                  <div key={c.id} className={`group sidebar-item cursor-pointer ${c.id === chatId ? "sidebar-item-active" : ""}`}
                    onClick={() => handleOpenChat(c.id)}>
                    <span className="sidebar-item-text flex-1 min-w-0 truncate">{c.title}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(c.id); }}
                      className="opacity-0 group-hover:opacity-100 shrink-0 text-gray-500 hover:text-red-400 transition-opacity">
                      <svg viewBox="0 0 14 14" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3.5h10M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M3.5 3.5l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 pt-3 mt-2 border-t border-white/[0.06] px-1">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] mb-1">
            <span>Pharos Mainnet</span>
            <span className="flex items-center gap-1 text-emerald-400"><span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"/> Live</span>
          </div>
          <p className="text-[10px] font-data text-[var(--accent-soft)]">Chain ID 1672 · PROS</p>
        </div>
      </aside>

      {/* ── Main panel ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        <ChatBackground />

        <ChatHeader
          walletAddress={walletAddress}
          balance={balance}
          isConnecting={isConnecting}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          isWrongNetwork={isWrongNetwork}
          onSwitchNetwork={handleSwitchNetwork}
          network={selectedNetwork}
          walletPicker={walletPickerOptions ? {
            options: walletPickerOptions,
            onChoose: (opt) => { connectTo(opt); setWalletPickerOptions(null); },
            onClose: () => setWalletPickerOptions(null),
          } : null}
        />

        {isWrongNetwork && (
          <div className="relative z-20 px-4 py-2 shrink-0">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl glass-panel border-amber-500/25">
              <p className="text-xs text-amber-200/90">{t("wallet.wrongNetwork", siteLang)} — Chain {PHAROS_NETWORKS[selectedNetwork].chainId}</p>
              <button onClick={handleSwitchNetwork} className="btn-navy-warn text-xs px-3 py-1.5 rounded-lg shrink-0">{t("wallet.switch", siteLang)}</button>
            </div>
          </div>
        )}

        {/* Mobile nav strip */}
        <div className="lg:hidden flex items-center gap-2 px-4 py-2 relative z-20 shrink-0">
          <Link href="/" className="sidebar-item text-xs px-3 py-1.5"><span className="sidebar-item-text">⌂ {t("chat.home", siteLang)}</span></Link>
          <button onClick={handleResetChat} className="sidebar-item text-xs px-3 py-1.5"><span className="sidebar-item-text">+ {t("chat.newChat", siteLang)}</span></button>
        </div>

        <main className="flex-1 overflow-y-auto scroll-smooth relative z-10">
          <div className={`max-w-3xl mx-auto px-4 sm:px-6 ${hasMessages ? "py-8" : "py-6 flex flex-col justify-center min-h-full"}`}>

          {/* Empty state — welcome */}
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center pb-8 text-center select-none">
              <div className="chat-welcome-orb-scene mb-8">
                <AgentOrb size="lg" show3d />
              </div>

              <h2 className="font-display font-bold mb-2 tracking-[-0.03em] text-gradient-hero"
                style={{ fontSize: "clamp(1.75rem, 4vw, 2.25rem)" }}>
                {siteLang === "pt" ? "Como posso ajudar?" : "How can I help you today?"}
              </h2>
              <p className="text-sm mb-8 max-w-md leading-relaxed text-[var(--text-muted)]">
                {siteLang === "pt"
                  ? "Seu copiloto DeFi na Pharos — swap, bridge, liquidez e muito mais."
                  : "Your DeFi copilot on Pharos — swap, bridge, liquidity, and more."}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
                {WELCOME_CARDS.map((card, i) => (
                  <button
                    key={card.tkey}
                    onClick={() => {
                      if (card.action) handleQuickAction(card.action);
                      else if (card.prompt) { setInput(card.prompt); inputRef.current?.focus(); }
                    }}
                    className="text-left p-4 rounded-xl chat-welcome-card"
                    style={{ animation: `cardAppear 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 0.06}s both` }}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${card.color}12`, border: `1px solid ${card.color}22`, color: card.color }}>
                        {card.icon}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="font-semibold text-[13px] text-white mb-0.5 tracking-[-0.01em]">{t(`chat.card.${card.tkey}.title`, siteLang)}</p>
                        <p className="text-[11px] leading-relaxed" style={{ color: "rgba(148,163,184,0.48)" }}>{t(`chat.card.${card.tkey}.desc`, siteLang)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              msg={msg.id === "welcome" ? { ...msg, text: t("chat.welcome", siteLang) } : msg}
              walletAddress={walletAddress}
              lang={guessUserLang(messages)}
              onTxSuccess={handleTxSuccess}
              onTxError={handleTxError}
              onTxReverted={handleTxReverted}
              onProviderChoice={handleProviderChoice}
              onSwapChoice={handleSwapChoice}
              onWalletChoice={(id, opt) => { void id; connectTo(opt); }}
              onAmountPicked={(amount, token) => {
                // Gas buffer: leave ~0.01 for gas when using 100% of native balance
                const isNative = token === "PROS" || token === "PHRS";
                const amountQuery = messages.find(m => m.amountQuery?.token === token)?.amountQuery;
                const isMax = amountQuery && Math.abs(amount - amountQuery.balance) < 0.0001;
                const finalAmount = (isNative && isMax) ? Math.max(0, amount - 0.01) : amount;

                // Guided stake/unstake flow? Build the Faroo card straight away.
                if (pendingStakeRef.current === "stake" && token === "PROS") {
                  pendingStakeRef.current = false;
                  setMessages((prev) => prev.map((m) => m.amountQuery ? { ...m, amountQuery: undefined } : m));
                  void buildStakeCardFor(finalAmount, "stake");
                  return;
                }
                if (pendingStakeRef.current === "unstake" && token === "stPROS") {
                  pendingStakeRef.current = false;
                  setMessages((prev) => prev.map((m) => m.amountQuery ? { ...m, amountQuery: undefined } : m));
                  void buildStakeCardFor(amount, "unstake");
                  return;
                }

                // Pending transfer? Build the payment card straight away.
                const pend = pendingTransferRef.current;
                if (pend && pend.token === token) {
                  pendingTransferRef.current = null;
                  const lang = guessUserLang(messages);
                  setMessages((prev) => prev.map((m) => m.amountQuery ? { ...m, amountQuery: undefined } : m));
                  try {
                    const build = buildTransferTxs([{ to: pend.to, amount: finalAmount, token }], pend.network);
                    addMessage({
                      role: "agent",
                      text: lang === "pt"
                        ? `Pronto! Vou enviar **${finalAmount.toFixed(4)} ${token}** para \`${pend.to.slice(0, 6)}…${pend.to.slice(-4)}\`. Confirme na sua carteira.`
                        : `Ready! Sending **${finalAmount.toFixed(4)} ${token}** to \`${pend.to.slice(0, 6)}…${pend.to.slice(-4)}\`. Confirm in your wallet.`,
                      transferPending: build,
                    });
                  } catch (err) {
                    addMessage({ role: "agent", isError: true, text: err instanceof Error ? err.message : String(err) });
                  }
                  return;
                }

                setInput(`${finalAmount.toFixed(4)} ${token}`);
                inputRef.current?.focus();
              }}
              onPositionSelect={handlePositionSelect}
              onPctSelect={handlePctSelect}
              onBridgeWizardSubmit={handleBridgeWizardSubmit}
              onBridgeRouteChoice={handleBridgeRouteChoice}
              onSwapWizardSubmit={handleSwapWizardSubmit}
              onLiquidityWizardSubmit={handleLiquidityWizardSubmit}
              onTransferWizardSubmit={handleTransferWizardSubmit}
            />
          ))}
          <div ref={bottomRef} />
            </div>
          </main>

          {/* ── Input (ChatGPT-style) ──────────────────────────────────── */}
          <div className="shrink-0 relative z-20 chat-input-area px-4 sm:px-6 pt-2 pb-5">
            <div className="max-w-3xl mx-auto">

              {!hasMessages && walletAddress && (
                <div className="flex gap-2 flex-wrap justify-center mb-3">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.label}
                      onClick={() => {
                        if (s.action) handleQuickAction(s.action);
                        else if (s.text) { setInput(s.text); inputRef.current?.focus(); }
                      }}
                      className="chat-suggestion-chip flex items-center gap-1.5">
                      {s.icon}
                      {chipT(s.label, siteLang)}
                    </button>
                  ))}
                </div>
              )}

              {!walletAddress ? (
                <div className="chat-input-box px-5 py-5 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-11 h-11 rounded-xl chat-orb-mini flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 20 20" className="w-5 h-5 text-[var(--accent-soft)]" fill="currentColor">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-sm font-semibold text-white">{t("gate.title", siteLang)}</p>
                    <p className="text-xs mt-0.5 text-[var(--text-muted)]">{t("gate.subtitle", siteLang)}</p>
                  </div>
                  <button onClick={handleConnect} disabled={isConnecting} className="btn-primary text-sm px-5 py-2.5 rounded-xl shrink-0">
                    {isConnecting ? t("wallet.connecting", siteLang) : t("wallet.connect", siteLang)}
                  </button>
                </div>
              ) : (
              <div className="chat-input-box flex gap-2 items-end px-4 py-3">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder={t("chat.placeholder", siteLang)}
                      disabled={isSending}
                      rows={1}
                      className="flex-1 text-[0.9375rem] text-white outline-none disabled:opacity-60 resize-none overflow-hidden bg-transparent leading-relaxed"
                      style={{ caretColor: "var(--accent)", minHeight: "28px", maxHeight: "180px" }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isSending}
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 chat-send-btn disabled:opacity-40"
                    >
                      {isSending ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                          <path d="M3.105 2.289a.75.75 0 00-.826.95l1.903 6.557H13.5a.75.75 0 010 1.5H4.182l-1.903 6.557a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                        </svg>
                      )}
                    </button>
              </div>
              )}

              <p className="mt-2.5 text-center text-[10px] text-[var(--text-dim)]">
                {t("chat.footer", siteLang)}
              </p>
            </div>
          </div>

      </div>{/* end main panel */}
    </div>
  );
}
