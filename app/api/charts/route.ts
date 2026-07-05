// Network metrics aggregator — mirrors pharos.socialscan.io/charts.
// Sources:
//   • SocialScan explorer API (public, no key): daily transaction / address /
//     block / token stats via /v1/explorer/chart-data/daily
//   • DefiLlama: Pharos chain DeFi TVL history
//   • Pharos Port API: RWA products (harbor) — current TVL per asset
// Cached for 30 minutes.
import { NextResponse } from "next/server";

export interface SeriesPoint { date: string; value: number }
export interface ChartSeries {
  id: string;
  title: string;
  unit?: string;         // e.g. "PROS", "Gwei", "USD", "s"
  points: SeriesPoint[];
}
export interface ChartsPayload {
  series: ChartSeries[];
  rwa: { name: string; tvl: number; apy: string; assetClass: string }[];
  rwaTotal: number;
  updatedAt: number;
}

const SOCIALSCAN = "https://api.socialscan.io/pharos-mainnet/v1/explorer/chart-data/daily";

// metric key on SocialScan → chart definition (transform normalizes raw values)
const METRICS: Array<{ key: string; id: string; title: string; unit?: string; transform?: (v: number) => number }> = [
  { key: "transaction.cnt", id: "daily_txns", title: "Daily Transactions" },
  { key: "transaction.txn_error_cnt", id: "failed_txns", title: "Failed Transactions" },
  { key: "transaction.avg_transaction_fee", id: "avg_txn_fee", title: "Avg Transaction Fee", unit: "PROS", transform: (v) => v / 1e18 },
  { key: "transaction.avg_gas_price", id: "avg_gas_price", title: "Avg Gas Price", unit: "Gwei", transform: (v) => v / 1e9 },
  { key: "address.active_address_cnt", id: "active_addresses", title: "Active Addresses" },
  { key: "address.new_address_cnt", id: "new_addresses", title: "New Addresses" },
  { key: "address.total_address_cnt", id: "total_addresses", title: "Total Addresses" },
  { key: "block.cnt", id: "daily_blocks", title: "Daily Blocks" },
  { key: "block.block_interval", id: "block_time", title: "Avg Block Time", unit: "s" },
  { key: "block.avg_size", id: "avg_block_size", title: "Avg Block Size", unit: "bytes" },
  { key: "block.avg_txn_cnt", id: "txns_per_block", title: "Avg Txns per Block" },
  { key: "token.erc20_total_transfer_cnt", id: "erc20_transfers", title: "ERC-20 Transfers" },
  { key: "token.erc721_total_transfer_cnt", id: "erc721_transfers", title: "ERC-721 Transfers" },
];

let cache: { data: ChartsPayload; at: number } | null = null;
const TTL = 30 * 60 * 1000;

async function fetchSocialScan(): Promise<ChartSeries[]> {
  const metrics = METRICS.map((m) => m.key).join(",");
  const res = await fetch(`${SOCIALSCAN}?metrics=${encodeURIComponent(metrics)}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`SocialScan HTTP ${res.status}`);
  const j = (await res.json()) as { data?: Array<Record<string, number | string>> };
  const rows = (j.data ?? []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return METRICS.map((m) => ({
    id: m.id,
    title: m.title,
    unit: m.unit,
    points: rows
      .filter((r) => r[m.key] != null)
      .map((r) => ({
        date: String(r.date),
        value: m.transform ? m.transform(Number(r[m.key])) : Number(r[m.key]),
      })),
  })).filter((s) => s.points.length > 0);
}

async function fetchDefiTvl(): Promise<ChartSeries | null> {
  try {
    const res = await fetch("https://api.llama.fi/v2/historicalChainTvl/Pharos", {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Array<{ date: number; tvl: number }>;
    if (!Array.isArray(j) || j.length === 0) return null;
    return {
      id: "defi_tvl",
      title: "DeFi TVL",
      unit: "USD",
      points: j.map((p) => ({
        date: new Date(p.date * 1000).toISOString().slice(0, 10),
        value: p.tvl,
      })),
    };
  } catch {
    return null;
  }
}

async function fetchRwa(): Promise<{ items: ChartsPayload["rwa"]; total: number }> {
  try {
    const res = await fetch("https://api.pharosnetwork.xyz/omni_port/harbor/summary", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://port.pharos.xyz/",
        Origin: "https://port.pharos.xyz",
      },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return { items: [], total: 0 };
    const j = (await res.json()) as {
      data?: Array<{ name?: string; tvl?: number; apy?: string; assetClass?: string }>;
    };
    const items = (j.data ?? []).map((a) => ({
      name: a.name ?? "?",
      tvl: Number(a.tvl ?? 0),
      apy: a.apy ?? "—",
      assetClass: (a.assetClass ?? "").split("·")[0].trim() || "RWA",
    }));
    return { items, total: items.reduce((n, a) => n + a.tvl, 0) };
  } catch {
    return { items: [], total: 0 };
  }
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json(cache.data);
  }
  try {
    const [socialscan, tvl, rwa] = await Promise.all([
      fetchSocialScan().catch(() => [] as ChartSeries[]),
      fetchDefiTvl(),
      fetchRwa(),
    ]);
    const series: ChartSeries[] = [...(tvl ? [tvl] : []), ...socialscan];
    if (series.length === 0) throw new Error("no chart data available");

    const data: ChartsPayload = { series, rwa: rwa.items, rwaTotal: rwa.total, updatedAt: Date.now() };
    cache = { data, at: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    if (cache) return NextResponse.json(cache.data); // stale-but-usable
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
