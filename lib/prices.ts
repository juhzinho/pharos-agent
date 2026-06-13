// Live token prices via CoinGecko's free API (no key required).
// Results are cached in-memory for 60s to stay well under the free-tier rate limit.

export interface TokenPrice {
  price: number;
  marketCap: number;
  change24h: number;
  volume24h: number;
}

// User-facing token names/symbols → CoinGecko ids.
// "pharos-network" is the verified id for PROS (the bare "pharos" id is an
// unrelated dead token). WPROS/wrapped variants map to the underlying asset.
const COINGECKO_IDS: Record<string, string> = {
  pros: "pharos-network",
  wpros: "pharos-network",
  pharos: "pharos-network",
  "pharos-network": "pharos-network",
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  weth: "ethereum",
  ethereum: "ethereum",
  usdc: "usd-coin",
  "usd-coin": "usd-coin",
  link: "chainlink",
  chainlink: "chainlink",
};

const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

const cache = new Map<string, { data: TokenPrice; expires: number }>();

export function resolveCoinGeckoId(token: string): string | null {
  return COINGECKO_IDS[token.trim().toLowerCase()] ?? null;
}

export function supportedPriceTokens(): string[] {
  return ["PROS", "WPROS", "BTC", "ETH", "WETH", "USDC", "LINK"];
}

// tokenId accepts either a known symbol/name ("PROS", "preço do pros") or a raw
// CoinGecko id. Throws if the token is unknown or CoinGecko fails.
export async function getTokenPrice(tokenId: string): Promise<TokenPrice> {
  const id = resolveCoinGeckoId(tokenId);
  if (!id) {
    throw new Error(
      `Unknown token '${tokenId}'. Supported: ${supportedPriceTokens().join(", ")}.`
    );
  }

  const cached = cache.get(id);
  if (cached && Date.now() < cached.expires) return cached.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true&include_24hr_vol=true`,
      { headers: { Accept: "application/json" }, signal: controller.signal }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // On rate limit, serve stale cache if we have it rather than failing.
    if (cached) return cached.data;
    throw new Error(`CoinGecko HTTP ${res.status}`);
  }

  const data = await res.json();
  const entry = data?.[id];
  if (!entry || typeof entry.usd !== "number") {
    if (cached) return cached.data;
    throw new Error(`CoinGecko returned no price for '${id}'`);
  }

  const result: TokenPrice = {
    price: entry.usd,
    marketCap: entry.usd_market_cap ?? 0,
    change24h: entry.usd_24h_change ?? 0,
    volume24h: entry.usd_24h_vol ?? 0,
  };
  cache.set(id, { data: result, expires: Date.now() + CACHE_TTL_MS });
  return result;
}

// ── formatting helpers (used by chat UI and /api/query) ────────────────────

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

// Markdown block appended to the agent's conversational reply. Labels are kept
// language-neutral (crypto PT-BR uses the same English terms) so it reads fine
// in both PT and EN.
export function formatPriceBlock(symbol: string, p: TokenPrice): string {
  const arrow = p.change24h >= 0 ? "📈" : "📉";
  const sign = p.change24h >= 0 ? "+" : "";
  return (
    `**${symbol.toUpperCase()}** · ${fmtPrice(p.price)}\n\n` +
    `${arrow} ${sign}${p.change24h.toFixed(2)}% (24h)\n\n` +
    `Market cap: ${fmtUsd(p.marketCap)} · Volume 24h: ${fmtUsd(p.volume24h)}\n\n` +
    `_Fonte: CoinGecko_`
  );
}
