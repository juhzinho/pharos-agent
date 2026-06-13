// Public Skill API — live token price endpoint (CoinGecko, 60s server cache).
// GET /api/price?token=pros → { token, priceUsd, marketCap, change24h, volume24h, source, timestamp }

import { getTokenPrice, resolveCoinGeckoId, supportedPriceTokens } from "@/lib/prices";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token.trim()) {
    return Response.json(
      { error: `Missing 'token' query param. Supported: ${supportedPriceTokens().join(", ")}.` },
      { status: 400 }
    );
  }
  if (!resolveCoinGeckoId(token)) {
    return Response.json(
      { error: `Unknown token '${token}'. Supported: ${supportedPriceTokens().join(", ")}.` },
      { status: 400 }
    );
  }

  try {
    const p = await getTokenPrice(token);
    return Response.json({
      token: token.trim().toUpperCase(),
      priceUsd: p.price,
      marketCap: p.marketCap,
      change24h: p.change24h,
      volume24h: p.volume24h,
      source: "CoinGecko",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch price.";
    console.error("[api:price]", msg);
    return Response.json({ error: msg }, { status: 502 });
  }
}
