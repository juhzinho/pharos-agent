// Lightweight intent fast-path — skips RAG + LLM for simple capability queries.

import type { GroqResult } from "./groq";

const CHAT = "https://pharos-agent-pi.vercel.app/chat";

const DETAILED =
  /\b(explain|step\s*by\s*step|how\s+does|compare|technical|detalh|passo\s+a\s*passo|como\s+funciona|por\s+que|why\s+does|walk\s+me\s+through)\b/i;

const FAROO_Q =
  /^(?:what\s+is\s+faroo|o\s+que\s+(?:é|e)\s+faroo|qu[eé]\s+es\s+faroo|faroo\s*\??)\s*$/i;

const CAMPAIGNS_Q =
  /\b(?:list|show|active|what\s+are)\b.*\b(?:campaigns?|carnival|cyber\s*cup)\b|\b(?:campaigns?|campanhas?)\b.*\b(?:active|ativas?|list)\b/i;

const CHAIN_ID_Q = /\b(?:chain\s*id|chainid)\b.*\b(?:pharos|1672)\b|\bpharos\b.*\bchain\s*id\b/i;

const RPC_Q = /\b(?:rpc|endpoint)\b.*\bpharos\b|\bpharos\b.*\b(?:rpc|endpoint)\b/i;

const EXPLORER_Q = /\b(?:explorer|block\s*explorer|scan)\b.*\bpharos\b|\bpharos\b.*\bexplorer\b/i;

const PRICE_Q =
  /^(?:what(?:'s| is) the )?price of (?:pros|wpros)\??$|^(?:pre[cç]o|quanto\s+vale)\s+(?:do\s+)?(?:pros|wpros)\s*\??$/i;

const SWAP_Q =
  /\b(?:swap|trocar?|exchange)\b.*\b(?:pros|wpros|usdc|weth)\b|\b(?:pros|wpros|usdc)\b.*\b(?:swap|trocar?|to|para)\b/i;

const BRIDGE_Q = /\b(?:bridge|ponte)\b.*\b(?:usdc|pros|pharos|base|ethereum)\b/i;

const STAKE_Q = /\b(?:stake|staking|stak(?:e|ing))\b.*\b(?:pros|faroo)\b|\b(?:stake|staking)\b.*\bfaroo\b/i;

function wantsDetail(msg: string): boolean {
  return DETAILED.test(msg);
}

function baseResult(reply: string): GroqResult {
  return {
    action: null,
    fromToken: null,
    toToken: null,
    amount: null,
    fromChain: "Pharos",
    toChain: null,
    needsAmount: false,
    needsToken: false,
    needsSearch: false,
    searchQuery: null,
    needsDocs: false,
    docsTarget: null,
    docsQuery: null,
    needsPrice: null,
    sources: ["fast-path"],
    foundInKnowledge: true,
    reply,
    _provider: "fast-path",
  };
}

const FAROO_ANSWER =
  "Faroo is Pharos Network's liquid staking and RealFi protocol (https://app.faroo.xyz). " +
  "Stake PROS → stPROS (ERC-4626, min 0.1 PROS). Unstake: 7-day queue, 0% fee — claim at app.faroo.xyz/unstake. " +
  "stPROS: 0x6b0a44c64190279f7034b77c13a566e914fe5ec4. NOT a search engine.";

const CAMPAIGNS_ANSWER =
  "**Active campaigns (Jul 2026):**\n" +
  "• Agent Carnival — ends Jul 26 — https://port.pharos.xyz/agent-carnival\n" +
  "• Anvita Cyber Cup — ends Jul 19 — https://flow.anvita.xyz/activities/cyber-cup\n" +
  "• TopNod Cup — ends Jul 20\n" +
  "• AquaFlux — ends Jul 31 — https://app.aquaflux.pro/campaign\n\n" +
  "_Real-time: port.pharos.xyz · x.com/pharos_network_";

/**
 * Returns a canned answer for simple queries, or null to use full RAG+LLM pipeline.
 * Skipped when user asks for detail or when grounding pass (search/docs) is active.
 */
export function tryFastPathAnswer(
  userText: string,
  opts?: { skipIfGrounding?: boolean }
): GroqResult | null {
  const text = userText.trim();
  if (!text || text.length > 500) return null;
  if (opts?.skipIfGrounding) return null;
  if (wantsDetail(text)) return null;

  if (FAROO_Q.test(text)) return baseResult(FAROO_ANSWER);
  if (CAMPAIGNS_Q.test(text)) return baseResult(CAMPAIGNS_ANSWER);
  if (CHAIN_ID_Q.test(text)) return baseResult("Pharos Mainnet chain ID is **1672** (Pacific Ocean). Native gas token: PROS.");
  if (RPC_Q.test(text)) return baseResult("Pharos Mainnet RPC: **https://rpc.pharos.xyz**");
  if (EXPLORER_Q.test(text)) return baseResult("Pharos explorer: **https://pharos.socialscan.io**");
  if (PRICE_Q.test(text)) {
    return baseResult(
      "Live PROS price: check CoinGecko (**PROS Pharos**) or open " + CHAT + " for an in-app quote."
    );
  }

  if (SWAP_Q.test(text)) {
    return {
      ...baseResult(
        "To swap on Pharos: connect wallet on chain 1672, pick tokens and amount, review the quote, then sign.\n\n" +
          "Open **" + CHAT + "** to run the swap wizard."
      ),
      action: "swap",
      needsAmount: !/\d/.test(text),
    };
  }

  if (BRIDGE_Q.test(text)) {
    return {
      ...baseResult(
        "Bridge from Pharos: choose token, amount, and destination chain (Ethereum, Base, Arbitrum, etc.), then sign.\n\n" +
          "Open **" + CHAT + "** with wallet on Pharos Mainnet."
      ),
      action: "bridge",
      needsAmount: !/\d/.test(text),
    };
  }

  if (STAKE_Q.test(text)) {
    return {
      ...baseResult(
        "Stake PROS on Faroo (min 0.1 PROS) → receive stPROS. Unstake is a **7-day queue**, 0% fee.\n\n" +
          "Open **" + CHAT + "** or https://app.faroo.xyz to sign."
      ),
      action: "stake",
      needsAmount: !/\d/.test(text),
    };
  }

  return null;
}
