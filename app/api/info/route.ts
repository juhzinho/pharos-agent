// Public Skill API — discovery endpoint.
// GET → skill metadata so external agents can discover this agent's capabilities.

import { checkRateLimit, rateLimitResponse, checkSameOrigin, forbiddenResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  // Same-origin only: keep discovery metadata for our own site.
  if (!checkSameOrigin(req)) return forbiddenResponse();
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  return Response.json({
    name: "Pharos Agent API",
    description:
      "AI DeFi copilot for Pharos Network. RAG-grounded knowledge about the Pharos ecosystem " +
      "(dapps, RWA, DeFi concepts), read-only swap/bridge quotes via LI.FI, on-chain wallet " +
      "intelligence, and a plain-language transaction explainer. Non-custodial — this API never " +
      "signs or broadcasts transactions.",
    version: "2.0",
    capabilities: [
      "knowledge", "swap-quote", "bridge-quote", "token-price",
      "wallet-profile", "explain-tx", "campaigns", "news",
    ],
    endpoints: {
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
