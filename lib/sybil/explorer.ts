import { cached } from "@/lib/sybil/cache";

const API = "https://api.socialscan.io/pharos-mainnet/v1/explorer";
export const SYBIL_MAX_TX_PAGES = 20;

export interface ExplorerTx {
  hash: string;
  from_address: string;
  to_address: string | null;
  value: string;
  transaction_fee: string;
  receipt_status: number;
  block_timestamp: string;
  method_id?: string | null;
  transaction_index?: number | null;
}

export interface ExplorerTransfer {
  from_address: string;
  to_address: string;
  token_address: string;
  token_symbol?: string | null;
  symbol?: string | null;
  value: string;
  block_timestamp: string;
  transaction_hash?: string;
}

async function fetchPage<T>(path: string, page: number): Promise<{ total: number; data: T[] }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${API}${path}&limit=50&page=${page}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(14_000),
    });
    if (res.ok) {
      const j = await res.json() as { total?: number; data?: T[] };
      return { total: j.total ?? 0, data: j.data ?? [] };
    }
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    throw new Error(`Explorer API HTTP ${res.status}`);
  }
  return { total: 0, data: [] };
}

async function fetchPaged<T>(path: string, maxPages = SYBIL_MAX_TX_PAGES): Promise<{ rows: T[]; total: number }> {
  const first = await fetchPage<T>(path, 1);
  const rows: T[] = [...first.data];
  const total = first.total;
  const pagesNeeded = Math.min(maxPages, Math.ceil(total / 50));
  if (pagesNeeded > 1 && first.data.length > 0) {
    const rest = await Promise.all(
      Array.from({ length: pagesNeeded - 1 }, (_, i) =>
        fetchPage<T>(path, i + 2).catch(() => ({ total: 0, data: [] as T[] })),
      ),
    );
    for (const r of rest) rows.push(...r.data);
  }
  return { rows, total: Math.max(total, rows.length) };
}

export async function fetchWalletTxs(address: string): Promise<{ rows: ExplorerTx[]; total: number }> {
  const addr = address.toLowerCase();
  return cached(`txs:${addr}`, 120_000, () => fetchPaged<ExplorerTx>(`/address/${addr}/transactions?`));
}

export async function fetchWalletTransfers(address: string): Promise<{ rows: ExplorerTransfer[]; total: number }> {
  const addr = address.toLowerCase();
  return cached(`xfer:${addr}`, 120_000, () =>
    fetchPaged<ExplorerTransfer>(`/address/${addr}/token_transfers?`).catch(() => ({ rows: [], total: 0 })),
  );
}

/** Lightweight upstream peek: first incoming native tx funder. */
export async function fetchPrimaryFunder(address: string): Promise<string | null> {
  const { rows } = await fetchWalletTxs(address);
  const addr = address.toLowerCase();
  const incoming = rows
    .filter((t) => t.to_address?.toLowerCase() === addr && t.from_address?.toLowerCase() !== addr)
    .sort((a, b) => a.block_timestamp.localeCompare(b.block_timestamp));
  return incoming[0]?.from_address?.toLowerCase() ?? null;
}
