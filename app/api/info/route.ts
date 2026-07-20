// Public Skill API — discovery endpoint.
// GET → skill metadata so external agents can discover this agent's capabilities.

import { toAgentCardSkills } from "@/lib/agent-skills";
import { AGENT_DESCRIPTION, AGENT_NAME } from "@/lib/branding";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  // Public discovery for A2A gateways (Anvita Flow) and external agents.
  const rl = checkRateLimit(req, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  return Response.json({
    name: `${AGENT_NAME} API`,
    description: AGENT_DESCRIPTION,
    skills: toAgentCardSkills(),
    version: "2.1",
    capabilities: [
      "knowledge", "swap-quote", "bridge-quote", "token-price",
      "wallet-profile", "wallet-score", "explain-tx", "campaigns", "news", "web3-radar", "sybil-check", "link-check", "pre-sign-risk", "swap-safety",
    ],
    endpoints: {
      walletScore: {
        method: "POST",
        path: "/api/skill/wallet-score",
        body: { address: "string — 0x + 40 hex chars" },
        returns: {
          score: "number 0-100 across 6 categories",
          level: "'Newcomer'…'Legend' with emoji badge",
          categories: "[{id, label, points, max, detail}]",
          gasSpentPros: "number", protocols: "string[]", monthly: "[{month, txs}]",
          flags: "string[] — heuristic badges (whale-volume, rwa-investor…)",
        },
        safety: "read-only — no signature, zero gas",
      },
      walletProfile: {
        method: "POST",
        path: "/api/skill/wallet-profile",
        body: { address: "string — 0x + 40 hex chars" },
        returns: {
          holdings: "[{symbol, balance, usd_value}]",
          total_usd: "number",
          tx_count: "number",
          profile: "{summary, tags[], risk, insight}",
          explorer_url: "string",
        },
        safety: "read-only — no signature, zero gas",
      },
      explainTx: {
        method: "POST",
        path: "/api/skill/explain-tx",
        body: { tx_hash: "string — 0x + 64 hex chars" },
        returns: {
          status: "'success' | 'failed' | 'pending'",
          explanation: "{summary, category, plain_steps[]}",
          value_pros: "number", gas_used: "number", block_number: "number",
          network: "'Pharos Mainnet' | 'Pharos Atlantic Testnet' (auto-detected)",
        },
        safety: "read-only — no signature, zero gas",
      },
      campaigns: {
        method: "GET",
        path: "/api/campaigns",
        returns: { campaigns: "[{name, startTime, endTime, url, kind}] — live from official Port API" },
      },
      news: {
        method: "GET",
        path: "/api/news",
        returns: { items: "[{title, date, kind}] — live from pharos.xyz/resources" },
      },
      web3Radar: {
        method: "GET",
        path: "/api/web3-radar?topic=defi|layer2|security|regulation|airdrops&lang=en|pt",
        returns: { text: "string — structured Web3 briefing (NFTs/DAOs excluded)" },
        safety: "read-only — live web search, no signature",
      },
      sybilCheck: {
        method: "POST",
        path: "/api/skill/sybil-check",
        body: { address: "string — single wallet", addresses: "string[] — 2–10 wallets for cluster mode" },
        returns: {
          riskScore: "0–100 composite (Phases 1–4)",
          onChainRisk: "0–100 on-chain heuristics only",
          compositeRisk: "same as riskScore",
          verdict: "likely_human | mixed | likely_bot | likely_sybil",
          signals: "weighted heuristics (timing, funding, ERC-20, calldata, blocklist, campaign)",
          reputation: "Trusta + Gitcoin Passport + ETH footprint (optional API keys)",
          cluster: "sharedRootFunders, graphDensity when addresses[] mode",
        },
        env: "TRUSTA_API_KEY, PASSPORT_API_KEY, PASSPORT_SCORER_ID, ETHERSCAN_API_KEY, SYBIL_BLOCKLIST",
        safety: "read-only — explorer + optional reputation APIs, probabilistic not proof",
      },
      linkCheck: {
        method: "POST",
        path: "/api/skill/link-check",
        body: { url: "string — single URL", urls: "string[] — up to 5", text: "string — extract URLs", suspiciousUrl: "string — DM/suspicious link", officialUrl: "string — official from Twitter/Discord" },
        returns: {
          riskScore: "0–100 (higher = more likely scam/phishing)",
          verdict: "official | likely_safe | suspicious | likely_scam | confirmed_scam",
          mode: "single | batch | compare",
          compareVerdict: "match_official | likely_phishing | both_unverified | suspicious_divergence",
          signals: "typosquat, punycode, homographs, free-host drainers, HTML sniff, redirects, 80+ official Web3 allowlist",
          redirectChain: "follows up to 8 hops",
          officialMatch: "Pharos + major DeFi allowlist match if official",
        },
        env: "LINK_SCAM_BLOCKLIST (optional extra domains)",
        safety: "read-only — URL heuristics + optional web search, not a guarantee",
      },
      preSignRisk: {
        method: "POST",
        path: "/api/skill/pre-sign-risk",
        body: { to: "string", data: "string (optional calldata)", value: "string (optional hex wei)", transactions: "UnsignedTxInput[] (batch)" },
        returns: {
          riskScore: "0–100 (higher = more dangerous)",
          verdict: "safe | caution | high_risk | block",
          checks: "selector decode, unlimited approve, unknown spender, large native value",
        },
        safety: "read-only — unsigned calldata analysis only",
      },
      swapSafety: {
        method: "POST",
        path: "/api/skill/swap-safety",
        body: { provider: "lifi | faroswap", intent: "{ fromToken, toToken, amount }", quote: "LI.FI QuoteResult", faroswap: "FaroSwapBuildResult" },
        returns: {
          safetyScore: "0–100 (higher = safer)",
          slippageBps: "basis points",
          warnings: "approval, slippage, slow route",
          verdict: "excellent | good | caution | risky",
        },
        safety: "read-only — quote analysis only",
      },
      query: {
        method: "POST",
        path: "/api/query",
        body: { question: "string" },
        returns: { answer: "string", sources: "[{name}]", foundInKnowledge: "boolean" },
      },
      quote: {
        method: "POST",
        path: "/api/quote",
        body: {
          action: "'swap' | 'bridge'",
          fromToken: "string",
          toToken: "string",
          amount: "number",
          fromChain: "string? (default Pharos)",
          toChain: "string? (required for bridge)",
        },
        returns: "LI.FI quote JSON (estimate, route, transactionRequest) — read-only",
      },
      price: {
        method: "GET",
        path: "/api/price?token=pros",
        returns: { token: "string", priceUsd: "number", marketCap: "number", change24h: "number", volume24h: "number", source: "CoinGecko", timestamp: "ISO string" },
        supportedTokens: ["PROS", "WPROS", "BTC", "ETH", "WETH", "USDC", "LINK"],
      },
      info: { method: "GET", path: "/api/info" },
    },
    network: { name: "Pharos", chainId: 1672, explorer: "https://pharos.socialscan.io" },
    supportedTokens: ["PROS", "WPROS", "USDC", "WETH", "LINK", "PGOLD", "USDpm"],
    supportedChains: ["Pharos", "Ethereum", "Base", "Arbitrum", "Polygon", "Optimism"],
    rateLimit: "20 requests/minute per IP",
  });
}
