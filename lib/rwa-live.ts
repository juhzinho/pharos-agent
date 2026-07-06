// Live RWA market data from rwa.xyz — the global tokenized-asset analytics
// platform. Their paid Data API needs a key, but the public dashboard embeds
// the full dataset in the page's __NEXT_DATA__ JSON, so we parse that:
// market aggregates, per-asset-class leaders, and the network league table.
// Server-side only (called from /api/rwa) with an in-memory cache.

export interface RwaAggregate {
  label: string;              // "Distributed Asset Value", "Total Stablecoin Value"…
  value: number;              // USD (or count for holders)
  isCount: boolean;
  change30d: number | null;   // fraction, e.g. 0.04 = +4%
}

export interface RwaTickerItem {
  symbol: string;
  valueUsd: number;           // total tokenized value
  change: number | null;      // fraction
}

export interface RwaTickerGroup {
  label: string;              // "Government Securities", "Stablecoins"…
  items: RwaTickerItem[];
}

export interface RwaNetworkRow {
  name: string;               // "Ethereum", "Canton"…
  valueUsd: number;
  assetCount: number;
  marketSharePct: number;     // fraction
  change7d: number | null;
}

export interface RwaMarketData {
  aggregates: RwaAggregate[];
  groups: RwaTickerGroup[];
  networks: RwaNetworkRow[];
  fetchedAt: number;
}

let cache: { data: RwaMarketData; expires: number } | null = null;
const CACHE_MS = 30 * 60 * 1000; // rwa.xyz data updates slowly — 30 min cache

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getRwaMarketData(): Promise<RwaMarketData> {
  if (cache && Date.now() < cache.expires) return cache.data;

  const res = await fetch("https://app.rwa.xyz/", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36" },
  });
  if (!res.ok) throw new Error(`rwa.xyz HTTP ${res.status}`);
  const html = await res.text();

  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("rwa.xyz page format changed (__NEXT_DATA__ not found)");
  const props = JSON.parse(m[1])?.props?.pageProps;
  if (!props) throw new Error("rwa.xyz page format changed (pageProps missing)");

  const aggregates: RwaAggregate[] = (props.aggregates ?? []).map((a: any) => ({
    label: String(a.label ?? ""),
    value: Number(a.value ?? 0),
    isCount: a.type === "count",
    change30d: a.percentChange?.value != null ? Number(a.percentChange.value) : null,
  }));

  const groups: RwaTickerGroup[] = (props.tickerGroups ?? []).map((g: any) => ({
    label: String(g.label ?? ""),
    items: (g.items ?? []).slice(0, 10).map((i: any) => ({
      symbol: String(i.symbol ?? ""),
      valueUsd: Number(i.price ?? 0),
      change: i.change != null ? Number(i.change) : null,
    })),
  }));

  // leagueTableTabs.all is an array of tabs (networks / managers / platforms /
  // asset classes) — pick the networks one.
  const tabs: any[] = Array.isArray(props.leagueTableTabs?.all) ? props.leagueTableTabs.all : [];
  const netTab = tabs.find((t) => t?.key === "parent_networks" || t?.content?.label === "Networks") ?? tabs[0];
  const netRows = netTab?.data?.rows ?? [];
  const networks: RwaNetworkRow[] = netRows.slice(0, 12).map((r: any) => ({
    name: String(r.group?.name ?? ""),
    valueUsd: Number(r.value ?? 0),
    assetCount: Number(r.asset_count ?? 0),
    marketSharePct: Number(r.market_share_pct ?? 0),
    change7d: r.value_7d_change != null ? Number(r.value_7d_change) : null,
  }));

  const data: RwaMarketData = { aggregates, groups, networks, fetchedAt: Date.now() };
  cache = { data, expires: Date.now() + CACHE_MS };
  return data;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── formatting for the chat bubble ──────────────────────────────────────────

function fmtUsd(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPct(v: number | null): string {
  if (v == null) return "";
  const pct = v * 100;
  const arrow = pct >= 0 ? "▲" : "▼";
  return ` ${arrow}${Math.abs(pct).toFixed(2)}%`;
}

export function formatRwaMarket(d: RwaMarketData, lang: "pt" | "en"): string {
  const pt = lang === "pt";
  const head = pt
    ? "🌍 **Mercado global de RWA** _(dados ao vivo do rwa.xyz)_"
    : "🌍 **Global RWA Market** _(live data from rwa.xyz)_";

  const aggLines = d.aggregates.map((a) => {
    const val = a.isCount ? a.value.toLocaleString("en-US") : fmtUsd(a.value);
    return `- **${a.label}**: ${val}${fmtPct(a.change30d)} (30d)`;
  });

  const topNets = d.networks.slice(0, 8).map((n, i) =>
    `${i + 1}. **${n.name}** — ${fmtUsd(n.valueUsd)} · ${n.assetCount} ${pt ? "ativos" : "assets"} · ${(n.marketSharePct * 100).toFixed(1)}%${fmtPct(n.change7d)} (7d)`,
  );

  const classLines = d.groups.map((g) => {
    const top = g.items.slice(0, 3).map((i) => `${i.symbol} ${fmtUsd(i.valueUsd)}`).join(" · ");
    return `- **${g.label}**: ${top}`;
  });

  const foot = pt
    ? "\n\n_Na Pharos, os protocolos RealFi (R25, pALPHA, Faroo, AquaFlux…) trazem esses mesmos tipos de ativo on-chain — pergunte \"minhas posições RealFi\" para ver as suas._"
    : "\n\n_On Pharos, the RealFi protocols (R25, pALPHA, Faroo, AquaFlux…) bring these same asset types on-chain — ask \"my RealFi positions\" to see yours._";

  return (
    `${head}\n\n` +
    `${aggLines.join("\n")}\n\n` +
    `**${pt ? "Redes líderes em RWA" : "Top RWA Networks"}:**\n${topNets.join("\n")}\n\n` +
    `**${pt ? "Líderes por classe de ativo" : "Leaders by asset class"}:**\n${classLines.join("\n")}` +
    foot
  );
}
