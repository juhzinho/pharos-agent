// Wallet transaction history via the SocialScan (Hemera) public explorer API —
// the same indexer behind pharos.socialscan.io. Server-side only (called from
// /api/txhistory) to avoid CORS and keep one place to adapt if the API moves.

const API = "https://api.socialscan.io/pharos-mainnet/v1/explorer/transactions";
const EXPLORER_TX = "https://pharos.socialscan.io/tx/";

export interface TxHistoryItem {
  hash: string;
  from: string;
  to: string | null;
  toName: string | null;   // contract label when known (e.g. "WPROS")
  valuePros: number;       // native PROS moved (already human units in the API)
  method: string;          // human label derived from the selector
  timestamp: string;       // ISO
  success: boolean;
  feePros: number;
}

export interface TxHistoryResult {
  address: string;
  total: number;
  txs: TxHistoryItem[];
}

// Common selectors seen on Pharos dApps — anything unknown falls back to the
// contract name or the raw selector.
const METHOD_LABELS: Record<string, string> = {
  "0x":           "Transfer",
  "0xa9059cbb":   "Token transfer",
  "0x095ea7b3":   "Approve",
  "0xd0e30db0":   "Wrap (deposit)",
  "0x2e1a7d4d":   "Unwrap (withdraw)",
  "0x6e553f65":   "Vault deposit",
  "0xba087652":   "Vault redeem",
  "0xb6f9de95":   "Swap",
  "0x04e45aaf":   "Swap (exactInputSingle)",
  "0x5023b4df":   "Swap (exactOutputSingle)",
  "0xac9650d8":   "Multicall",
  "0x88316456":   "Add liquidity (mint)",
  "0x219f5d17":   "Increase liquidity",
  "0x0c49ccbe":   "Decrease liquidity",
  "0xfc6f7865":   "Collect fees",
  "0x42966c68":   "Burn",
  "0x23b872dd":   "TransferFrom",
};

interface RawTx {
  hash?: string;
  from_address?: string;
  to_address?: string | null;
  value?: string;
  method_id?: string;
  block_timestamp?: string;
  receipt_status?: number;
  transaction_fee?: string;
  to_addr?: { name?: string | null; contract?: { name?: string | null } | null } | null;
}

export async function getTxHistory(address: string, limit = 10): Promise<TxHistoryResult> {
  const url = `${API}?address=${address}&size=${Math.min(Math.max(limit, 1), 25)}&page=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; PharosAgent/1.0)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Explorer API HTTP ${res.status}`);
  const j = await res.json();
  const rows: RawTx[] = Array.isArray(j?.data) ? j.data : [];

  const txs: TxHistoryItem[] = rows
    .filter((r) => typeof r.hash === "string")
    .map((r) => {
      const sel = (r.method_id || "0x").toLowerCase();
      const toName = r.to_addr?.contract?.name || r.to_addr?.name || null;
      let method = METHOD_LABELS[sel];
      if (!method) method = toName ? `Call ${toName}` : `Call ${sel}`;
      return {
        hash: r.hash as string,
        from: (r.from_address || "").toLowerCase(),
        to: r.to_address ? r.to_address.toLowerCase() : null,
        toName,
        valuePros: parseFloat(r.value || "0") || 0,
        method,
        timestamp: r.block_timestamp || "",
        success: r.receipt_status === 1,
        feePros: parseFloat(r.transaction_fee || "0") || 0,
      };
    });

  return { address: address.toLowerCase(), total: Number(j?.total) || txs.length, txs };
}

// ── Chat formatting (client-safe: pure string work) ─────────────────────────

export function formatTxHistory(r: TxHistoryResult, lang: "pt" | "en"): string {
  if (r.txs.length === 0) {
    return lang === "pt"
      ? "Não encontrei transações para essa carteira na Pharos Mainnet ainda. Assim que você fizer um swap, stake ou transferência, elas aparecem aqui. 🌊"
      : "I couldn't find any transactions for this wallet on Pharos Mainnet yet. Once you swap, stake or transfer, they'll show up here. 🌊";
  }

  const dirLabel = (tx: TxHistoryItem) =>
    tx.from === r.address ? (lang === "pt" ? "enviada" : "out") : (lang === "pt" ? "recebida" : "in");

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString(lang === "pt" ? "pt-BR" : "en-US", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  };

  const rows = r.txs.map((tx) => {
    const val = tx.valuePros > 0 ? `${tx.valuePros.toLocaleString("en-US", { maximumFractionDigits: 6 })} PROS` : "—";
    const status = tx.success ? "✅" : "❌";
    const dest = tx.toName ?? (tx.to ? `${tx.to.slice(0, 6)}…${tx.to.slice(-4)}` : "—");
    return `| [\`${tx.hash.slice(0, 10)}…\`](${EXPLORER_TX}${tx.hash}) | ${fmtDate(tx.timestamp)} | ${tx.method} | ${dest} | ${val} | ${dirLabel(tx)} ${status} |`;
  }).join("\n");

  const header = lang === "pt"
    ? `📜 **Suas últimas ${r.txs.length} transações** (Pharos Mainnet · total: ${r.total.toLocaleString("en-US")})\n\n| Tx | Quando | Ação | Destino | Valor | |\n|---|---|---|---|---|---|\n`
    : `📜 **Your last ${r.txs.length} transactions** (Pharos Mainnet · total: ${r.total.toLocaleString("en-US")})\n\n| Tx | When | Action | To | Value | |\n|---|---|---|---|---|---|\n`;

  const foot = lang === "pt"
    ? `\n\nQuer que eu **explique alguma** em detalhe? É só colar o hash. 🔍`
    : `\n\nWant me to **explain any of them** in detail? Just paste the hash. 🔍`;

  return header + rows + foot;
}
