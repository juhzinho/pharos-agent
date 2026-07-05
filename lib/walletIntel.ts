// Wallet Intelligence engine (Pharos Mainnet) — a superset of the community
// "wallet-score" + "volume-gas-tracker" skills:
//   • 6 scoring categories (vs 4): activity, gas, volume, token variety,
//     protocol diversity, longevity
//   • gas spent in PROS, native volume, unique tokens (discovered on-chain,
//     not from a fixed list), known-protocol detection, monthly timeline,
//     failed-tx counting and heuristic flags.
// Server-side only (SocialScan explorer API; avoids browser CORS).

const API = "https://api.socialscan.io/pharos-mainnet/v1/explorer";
const MAX_PAGES = 8; // 8 × 50 = up to 400 rows per feed — fast yet representative

// ── Known protocol registry (from the RealFi skill research) ────────────────
const PROTOCOL_ADDRESSES: Record<string, string> = {
  "0xc0479219f4feba5a668cff71bf96f4ffe124c3ab": "FaroSwap V3",
  "0x2c90ccb0b989afa2433f499698451a25744a552b": "FaroSwap V3",
  "0x75f21a97bd89a9a5683a9f46b5d5b4a080708dea": "Pharos DexRouter",
  "0xe47e9ba4ea2320a6ed87246d02fd5c38485ed7d1": "pAlpha Vault (Ember)",
  "0x5ed00449a0d0b6a9f26fd6af05832808a8b96bbe": "pAlpha Vault (Ember)",
  "0x34fd642fa9fdc6ce4013d4f3cde575c6dac904f9": "pAlpha Vault (Ember)",
  "0xe150a72352a189dce0d671c08f721b458104a2af": "pAlpha Vault (Ember)",
  "0xbf5761dc90a87976300d3ddce40b9cba66b66041": "pAlpha Vault (Ember)",
  "0x99848bb3843a1cfbf2a03cffef146ae6f216d343": "AquaFlux",
  "0x0881e99c766006e0d158e7979dda67ea5e2359f6": "AquaFlux",
  "0x50d10327b6ca6dcdb8a3505f65ba8c0c97b6c7d8": "AquaFlux",
  "0x22db220cbb04ad850bbf0639b96b2670ccf67446": "AquaFlux",
  "0x2f47d679635d36a26d2c4e996a5643c991e26bac": "AquaFlux",
  "0x843913de261a1712d3ae8d4bc751e705bb0823b8": "Zona Pharos",
  "0x7e23c96d7fbcd538272390ec5f8766032d4d96fd": "Zona Pharos",
  "0x8809bd2389e9e16c30b0e9ae24df0682c3290d45": "Zona Pharos",
  "0x9dcf4b664fd2c8f0f5147ea469afe1cbc9e69d96": "OpenFi",
  "0x1c2bc8b553d9a7e61f7531a3a4bf2162f4569268": "R25 VRPC",
  "0xee26bb0989691735c997dfdc49a4a607f75e190b": "R25 VRPC",
  "0x94f7ebc6ae0819a4b4e231ae6ddaaf9bfd2a1a86": "R25 VRPC",
  "0x32ec8cb08930131516ac5a2af18e715097a6564c": "R25 VRPC",
  "0xd04d1a8bd7944e06e25192aad833700115c88480": "TermMax",
  "0xc18e6f730896971a79d748e8dea61067a9bc6040": "Janus Henderson (JTRSY)",
  "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0": "WPROS",
  "0xc879c018db60520f4355c26ed1a6d572cdac1815": "USDC",
  "0x7126c3fef4e6a680eee09fb039b2236f638384b0": "USDC.e Bridge",
};

export interface ScoreCategory {
  id: string;
  label: string;
  labelPt: string;
  points: number;
  max: number;
  detail: string;
}

export interface WalletIntel {
  address: string;
  score: number;          // 0..100
  level: string;
  levelEmoji: string;
  categories: ScoreCategory[];
  txTotal: number;        // total txs known to the explorer
  txSampled: number;      // rows actually analyzed
  failedTxs: number;
  gasSpentPros: number;
  gasSpentUsd: number | null;
  nativeVolumePros: number;
  tokenTransferCount: number;
  uniqueTokens: Array<{ symbol: string; address: string; transfers: number }>;
  protocols: string[];
  firstTxAt: string | null;
  lastTxAt: string | null;
  activeMonths: number;
  monthly: Array<{ month: string; txs: number }>;
  flags: string[];
  truncated: boolean;     // true when the wallet has more history than sampled
  explorer: string;
}

interface TxRow {
  hash: string;
  from_address: string;
  to_address: string | null;
  value: string;
  transaction_fee: string;
  transaction_fee_usd?: string | null;
  receipt_status: number;
  block_timestamp: string;
  method?: string | null;
}

interface TransferRow {
  from_address: string;
  to_address: string;
  token_address: string;
  token_symbol?: string | null;
  symbol?: string | null;
  value: string;
  block_timestamp: string;
}

async function fetchPaged<T>(path: string): Promise<{ rows: T[]; total: number }> {
  const rows: T[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${API}${path}&limit=50&page=${page}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500)); page--; continue; }
      throw new Error(`Explorer API HTTP ${res.status}`);
    }
    const j = await res.json() as { total?: number; data?: T[] };
    total = j.total ?? total;
    const batch = j.data ?? [];
    rows.push(...batch);
    if (batch.length === 0 || rows.length >= total) break;
  }
  return { rows, total };
}

function levelFor(score: number): { level: string; emoji: string } {
  if (score >= 95) return { level: "Legend",   emoji: "👑" };
  if (score >= 80) return { level: "Diamond",  emoji: "💎" };
  if (score >= 60) return { level: "Gold",     emoji: "🥇" };
  if (score >= 40) return { level: "Silver",   emoji: "🥈" };
  if (score >= 20) return { level: "Bronze",   emoji: "🥉" };
  return { level: "Newcomer", emoji: "🐣" };
}

function tier(value: number, thresholds: Array<[number, number]>): number {
  let pts = 0;
  for (const [min, p] of thresholds) if (value >= min) pts = p;
  return pts;
}

export async function getWalletIntel(address: string): Promise<WalletIntel> {
  const addr = address.toLowerCase();

  const [txFeed, transferFeed] = await Promise.all([
    fetchPaged<TxRow>(`/address/${addr}/transactions?`),
    fetchPaged<TransferRow>(`/address/${addr}/token_transfers?`).catch(() => ({ rows: [] as TransferRow[], total: 0 })),
  ]);

  const txs = txFeed.rows;
  const txTotal = Math.max(txFeed.total, txs.length);
  const truncated = txTotal > txs.length || transferFeed.total > transferFeed.rows.length;

  // ── Gas + native volume + failures (outgoing txs only for gas) ───────────
  let gasSpentPros = 0;
  let gasSpentUsd = 0;
  let hasUsdFees = false;
  let nativeVolumePros = 0;
  let failedTxs = 0;
  const monthCounts = new Map<string, number>();
  let firstTs: string | null = null;
  let lastTs: string | null = null;

  for (const tx of txs) {
    const outgoing = tx.from_address?.toLowerCase() === addr;
    if (outgoing) {
      gasSpentPros += parseFloat(tx.transaction_fee || "0") || 0;
      if (tx.transaction_fee_usd) { gasSpentUsd += parseFloat(tx.transaction_fee_usd) || 0; hasUsdFees = true; }
      if (tx.receipt_status === 0) failedTxs++;
    }
    nativeVolumePros += parseFloat(tx.value || "0") || 0;
    const ts = tx.block_timestamp;
    if (ts) {
      if (!firstTs || ts < firstTs) firstTs = ts;
      if (!lastTs || ts > lastTs) lastTs = ts;
      const month = ts.slice(0, 7); // YYYY-MM
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    }
  }

  // ── Token discovery from transfers (not a fixed token list) ──────────────
  const tokenMap = new Map<string, { symbol: string; transfers: number }>();
  for (const t of transferFeed.rows) {
    const key = t.token_address?.toLowerCase();
    if (!key) continue;
    const symbol = t.token_symbol || t.symbol || key.slice(0, 8);
    const cur = tokenMap.get(key);
    if (cur) cur.transfers++;
    else tokenMap.set(key, { symbol, transfers: 1 });
  }
  const uniqueTokens = [...tokenMap.entries()]
    .map(([tokenAddress, v]) => ({ symbol: v.symbol, address: tokenAddress, transfers: v.transfers }))
    .sort((a, b) => b.transfers - a.transfers);

  // ── Protocol detection ────────────────────────────────────────────────────
  const protocolSet = new Set<string>();
  for (const tx of txs) {
    const to = tx.to_address?.toLowerCase();
    if (to && PROTOCOL_ADDRESSES[to]) protocolSet.add(PROTOCOL_ADDRESSES[to]);
  }
  for (const t of transferFeed.rows) {
    const token = t.token_address?.toLowerCase();
    if (token && PROTOCOL_ADDRESSES[token]) protocolSet.add(PROTOCOL_ADDRESSES[token]);
  }
  // WPROS/USDC interactions are tokens, not protocols — keep only real dApps for diversity
  const protocols = [...protocolSet].filter((p) => !["WPROS", "USDC", "USDC.e Bridge"].includes(p));

  const monthly = [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, txs: count }));
  const activeMonths = monthly.length;

  // ── Scoring (100 pts across 6 categories) ────────────────────────────────
  const categories: ScoreCategory[] = [
    {
      id: "activity", label: "Activity", labelPt: "Atividade", max: 20,
      points: tier(txTotal, [[1, 4], [10, 8], [50, 12], [200, 16], [1000, 20]]),
      detail: `${txTotal.toLocaleString("en-US")} txs`,
    },
    {
      id: "gas", label: "Gas spent", labelPt: "Gás gasto", max: 15,
      points: tier(gasSpentPros, [[0.0001, 3], [0.01, 6], [0.1, 9], [1, 12], [10, 15]]),
      detail: `${gasSpentPros.toFixed(4)} PROS`,
    },
    {
      id: "volume", label: "Volume", labelPt: "Volume", max: 20,
      points: Math.min(20,
        tier(nativeVolumePros, [[0.01, 2], [1, 5], [10, 8], [100, 10]]) +
        tier(transferFeed.total || transferFeed.rows.length, [[1, 2], [10, 5], [50, 8], [200, 10]])),
      detail: `${nativeVolumePros.toFixed(2)} PROS + ${(transferFeed.total || transferFeed.rows.length).toLocaleString("en-US")} token transfers`,
    },
    {
      id: "tokens", label: "Token variety", labelPt: "Variedade de tokens", max: 15,
      points: tier(uniqueTokens.length, [[1, 3], [2, 6], [3, 9], [5, 12], [8, 15]]),
      detail: `${uniqueTokens.length} unique tokens`,
    },
    {
      id: "protocols", label: "Protocol diversity", labelPt: "Diversidade de protocolos", max: 20,
      points: tier(protocols.length, [[1, 5], [2, 10], [3, 14], [5, 17], [7, 20]]),
      detail: protocols.length ? protocols.join(", ") : "none detected",
    },
    {
      id: "longevity", label: "Longevity", labelPt: "Longevidade", max: 10,
      points: tier(activeMonths, [[1, 2], [2, 4], [3, 6], [6, 8], [9, 10]]),
      detail: `${activeMonths} active month${activeMonths === 1 ? "" : "s"}`,
    },
  ];

  const score = Math.min(100, categories.reduce((s, c) => s + c.points, 0));
  const { level, emoji } = levelFor(score);

  // ── Heuristic flags ───────────────────────────────────────────────────────
  const flags: string[] = [];
  const outgoingCount = txs.filter((t) => t.from_address?.toLowerCase() === addr).length;
  if (outgoingCount > 0 && failedTxs / outgoingCount > 0.2) flags.push("high-failure-rate");
  if (nativeVolumePros >= 1000) flags.push("whale-volume");
  if (protocols.length >= 5) flags.push("defi-power-user");
  if (activeMonths >= 4) flags.push("consistent-user");
  const rwaProtocols = ["pAlpha Vault (Ember)", "R25 VRPC", "Janus Henderson (JTRSY)", "AquaFlux", "TermMax"];
  if (protocols.some((p) => rwaProtocols.includes(p))) flags.push("rwa-investor");

  return {
    address,
    score, level, levelEmoji: emoji,
    categories,
    txTotal, txSampled: txs.length, failedTxs,
    gasSpentPros,
    gasSpentUsd: hasUsdFees ? gasSpentUsd : null,
    nativeVolumePros,
    tokenTransferCount: transferFeed.total || transferFeed.rows.length,
    uniqueTokens: uniqueTokens.slice(0, 15),
    protocols,
    firstTxAt: firstTs, lastTxAt: lastTs,
    activeMonths, monthly,
    flags,
    truncated,
    explorer: `https://pharos.socialscan.io/address/${address}`,
  };
}
