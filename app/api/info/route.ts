// Public Skill API — discovery endpoint.
// GET → skill metadata so external agents can discover this agent's capabilities.

import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  return Response.json({
    name: "Pharos Agent API",
    description:
      "AI DeFi copilot for Pharos Network. RAG-grounded knowledge about the Pharos ecosystem " +
      "(dapps, RWA, DeFi concepts) plus read-only swap/bridge quotes via LI.FI. Non-custodial — " +
      "this API never signs or broadcasts transactions.",
    version: "1.0",
    capabilities: ["knowledge", "swap-quote", "bridge-quote", "token-price"],
    endpoints: {
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
    network: { name: "Pharos", chainId: 1672, explorer: "https://pharosscan.xyz" },
    supportedTokens: ["PROS", "WPROS", "USDC", "WETH", "LINK", "PGOLD", "USDpm"],
    supportedChains: ["Pharos", "Ethereum", "Base", "Arbitrum", "Polygon", "Optimism"],
    rateLimit: "20 requests/minute per IP",
  });
}
