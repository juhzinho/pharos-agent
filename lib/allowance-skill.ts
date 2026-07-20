// Read ERC-20 allowances on Pharos Mainnet (server-side RPC).

import { FAROO } from "@/lib/staking";
import { FAROSWAP } from "@/lib/liquidity";
import { FAROSWAP_DIRECT } from "@/lib/faroswap";
import { TOKENS } from "@/lib/tokens";

const RPC = "https://rpc.pharos.xyz";
const LIFI_DIAMOND = "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae";

const SEL_ALLOWANCE = "0xdd62ed3e";

async function ethCall(to: string, data: string): Promise<bigint> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  const j = await res.json();
  const hex = j.result as string;
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function pad(addr: string): string {
  return addr.slice(2).toLowerCase().padStart(64, "0");
}

export async function readAllowance(token: string, owner: string, spender: string): Promise<bigint> {
  const data = SEL_ALLOWANCE + pad(owner) + pad(spender);
  return ethCall(token, data);
}

export interface AllowanceRow {
  token: string;
  spender: string;
  spenderLabel: string;
  allowance: number;
}

/** Common DeFi spenders on Pharos for the connected wallet. */
export async function scanWalletAllowances(owner: string): Promise<AllowanceRow[]> {
  const checks: Array<{ token: string; symbol: string; spender: string; label: string; decimals: number }> = [
    { token: TOKENS.USDC.address, symbol: "USDC", spender: LIFI_DIAMOND, label: "LI.FI", decimals: 6 },
    { token: TOKENS.USDC.address, symbol: "USDC", spender: FAROSWAP.NPM, label: "FaroSwap NPM", decimals: 6 },
    { token: TOKENS.USDC.address, symbol: "USDC", spender: FAROSWAP_DIRECT.DODO_APPROVE, label: "FaroSwap DODO", decimals: 6 },
    { token: TOKENS.WPROS.address, symbol: "WPROS", spender: FAROSWAP.NPM, label: "FaroSwap NPM", decimals: 18 },
    { token: TOKENS.WPROS.address, symbol: "WPROS", spender: FAROSWAP_DIRECT.DODO_APPROVE, label: "FaroSwap DODO", decimals: 18 },
    { token: TOKENS.WPROS.address, symbol: "WPROS", spender: FAROO.STPROS, label: "Faroo stPROS", decimals: 18 },
  ];

  const rows: AllowanceRow[] = [];
  for (const c of checks) {
    const raw = await readAllowance(c.token, owner, c.spender);
    const human = Number(raw) / 10 ** c.decimals;
    if (human > 0.000001 || raw > 0n) {
      rows.push({
        token: c.symbol,
        spender: c.spender,
        spenderLabel: c.label,
        allowance: human,
      });
    }
  }
  return rows;
}

export function formatAllowanceReport(rows: AllowanceRow[], lang: "pt" | "en"): string {
  if (rows.length === 0) {
    return lang === "pt"
      ? "Nenhuma **allowance** ativa encontrada nos spenders comuns (LI.FI, FaroSwap, Faroo stPROS). Se quiser aprovar um token, diga **approve** ou clique em **Approve token** na sidebar."
      : "No active **allowances** found for common spenders (LI.FI, FaroSwap, Faroo stPROS). To approve a token, say **approve** or click **Approve token** in the sidebar.";
  }
  const header = lang === "pt" ? "🔐 **Allowances ativas na sua carteira**" : "🔐 **Active allowances in your wallet**";
  const lines = rows.map(
    (r) =>
      `| **${r.token}** → ${r.spenderLabel} | ${r.allowance >= 1e12 ? (lang === "pt" ? "ilimitado" : "unlimited") : r.allowance.toFixed(6)} |`,
  );
  return [header, "", "| | |", "|---|---|", ...lines].join("\n");
}
