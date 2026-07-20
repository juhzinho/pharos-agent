// Public Skill API — discovery endpoint.
// GET → skill metadata so external agents can discover this agent's capabilities.

import { AGENT_DESCRIPTION, AGENT_INTERACTION_GUIDE, AGENT_NAME } from "@/lib/branding";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  // Public discovery for A2A gateways (Anvita Flow) and external agents.
  const rl = checkRateLimit(req, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  return Response.json({
    name: `${AGENT_NAME} API`,
    description: AGENT_DESCRIPTION,
    interactionGuide: AGENT_INTERACTION_GUIDE,
    version: "2.1",
    capabilities: [
      "knowledge", "swap-quote", "bridge-quote", "token-price",
      "wallet-profile", "wallet-score", "explain-tx", "campaigns", "news",
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
