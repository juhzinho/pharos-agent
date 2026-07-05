// Read-only wallet analysis on Pharos mainnet (chainId 1672).
// Reads native PROS + balanceOf for every known ERC-20 via the public RPC
// (no key, no signing). USD values use getTokenPrice where a price feed exists.

import { TOKENS } from "./tokens";
import { getTokenPrice } from "./prices";

const RPC = "https://rpc.pharos.xyz";
const NATIVE_ADDR = "0x0000000000000000000000000000000000000000";

// CoinGecko-priceable tokens (others show no USD value).
const PRICEABLE = new Set(["PROS", "WPROS", "USDC", "WETH", "LINK"]);

export interface TokenHolding {
  symbol: string;
  address: string;
  decimals: number;
  balance: number;      // human-readable
  raw: bigint;
  usdValue: number | null;
}

export interface WalletAnalysis {
  address: string;
  holdings: TokenHolding[];   // non-zero balances, sorted by USD value desc
  totalUsd: number;
  txCount: number;            // outgoing tx count (nonce)
  explorer: string;
}

async function rpc(method: string, params: unknown[]): Promise<string> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "RPC error");
  return j.result;
}

async function nativeBalance(address: string): Promise<bigint> {
  const hex = await rpc("eth_getBalance", [address, "latest"]);
  return hex && hex !== "0x" ? BigInt(hex) : 0n;
}

async function erc20Balance(token: string, owner: string): Promise<bigint> {
  const data = `0x70a08231${owner.slice(2).padStart(64, "0")}`;
  const res = await rpc("eth_call", [{ to: token, data }, "latest"]).catch(() => "0x");
  return res && res !== "0x" ? BigInt(res) : 0n;
}

// Cheap price lookup that never throws (returns null on failure).
async function priceOf(symbol: string): Promise<number | null> {
  if (!PRICEABLE.has(symbol)) return null;
  try {
    const p = await getTokenPrice(symbol.toLowerCase());
    return p.price;
  } catch {
    return null;
  }
}

// Fast balances-only read for interactive flows (wizards): all tokens in
// parallel, no price lookups. Returns every token (including zero balances).
export async function getTokenBalancesFast(
  address: string,
): Promise<Array<{ symbol: string; balance: number }>> {
  const entries = Object.entries(TOKENS) as Array<[string, { address: string; decimals: number }]>;
  const results = await Promise.all(
    entries.map(async ([symbol, t]) => {
      const isNative = symbol === "PROS" || t.address.toLowerCase() === NATIVE_ADDR;
      const raw = await (isNative ? nativeBalance(address) : erc20Balance(t.address, address)).catch(() => 0n);
      return { symbol, balance: Number(raw) / 10 ** t.decimals };
    }),
  );
  return results;
}

export async function getWalletAnalysis(address: string): Promise<WalletAnalysis> {
  const entries = Object.entries(TOKENS) as Array<[string, { address: string; decimals: number }]>;

  const holdings: TokenHolding[] = [];
  let totalUsd = 0;

  // Read balances SEQUENTIALLY — the public Pharos RPC rate-limits bursts, so a
  // parallel Promise.all can fail mid-way. Sequential is reliable for ~7 tokens.
  for (const [symbol, t] of entries) {
    const isNative = symbol === "PROS" || t.address.toLowerCase() === NATIVE_ADDR;
    const raw = isNative ? await nativeBalance(address) : await erc20Balance(t.address, address);
    if (raw === 0n) continue;
    const balance = Number(raw) / 10 ** t.decimals;
    const price = await priceOf(symbol);
    const usdValue = price != null ? balance * price : null;
    if (usdValue != null) totalUsd += usdValue;
    holdings.push({ symbol, address: t.address, decimals: t.decimals, balance, raw, usdValue });
  }

  holdings.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

  let txCount = 0;
  try {
    const hex = await rpc("eth_getTransactionCount", [address, "latest"]);
    txCount = hex && hex !== "0x" ? Number(BigInt(hex)) : 0;
  } catch { /* non-critical */ }

  return {
    address,
    holdings,
    totalUsd,
    txCount,
    explorer: `https://pharos.socialscan.io/address/${address}`,
  };
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

// Markdown summary for the chat bubble.
export function formatWalletAnalysis(a: WalletAnalysis, lang: "pt" | "en"): string {
  const head = lang === "pt" ? "**Carteira**" : "**Wallet**";
  if (a.holdings.length === 0) {
    const empty = lang === "pt"
      ? "Nenhum saldo encontrado nos tokens conhecidos da Pharos."
      : "No balances found in the known Pharos tokens.";
    return `${head} \`${short(a.address)}\`\n\n${empty}\n\n[Pharosscan](${a.explorer})`;
  }
  const rows = a.holdings.map((h) => {
    const bal = h.balance.toLocaleString("en-US", { maximumFractionDigits: h.decimals === 6 ? 4 : 6 });
    const usd = h.usdValue != null ? ` · ${fmtUsd(h.usdValue)}` : "";
    return `- **${h.symbol}**: ${bal}${usd}`;
  });
  const total = a.totalUsd > 0 ? `\n\n${lang === "pt" ? "Total estimado" : "Estimated total"}: **${fmtUsd(a.totalUsd)}**` : "";
  const txLine = `\n${lang === "pt" ? "Transações enviadas" : "Transactions sent"}: **${a.txCount.toLocaleString("en-US")}**`;

  // Short profile summary based on activity + portfolio shape.
  const top = a.holdings[0];
  const activity =
    a.txCount === 0
      ? lang === "pt" ? "carteira nova, sem transações enviadas ainda" : "fresh wallet, no outgoing transactions yet"
      : a.txCount < 10
        ? lang === "pt" ? "usuário iniciante na rede" : "getting started on the network"
        : a.txCount < 100
          ? lang === "pt" ? "usuário ativo na Pharos" : "active Pharos user"
          : lang === "pt" ? "usuário muito ativo (power user)" : "power user";
  const concentration =
    top && a.totalUsd > 0 && top.usdValue != null && top.usdValue / a.totalUsd > 0.8
      ? lang === "pt" ? `, portfólio concentrado em ${top.symbol}` : `, portfolio concentrated in ${top.symbol}`
      : a.holdings.length >= 3
        ? lang === "pt" ? ", portfólio diversificado" : ", diversified portfolio"
        : "";
  const summary = `\n\n💡 _${lang === "pt" ? "Perfil" : "Profile"}: ${activity}${concentration}._`;

  return `${head} \`${short(a.address)}\` (Pharos)\n\n${rows.join("\n")}${total}${txLine}${summary}\n\n[${lang === "pt" ? "Ver no explorer" : "View on explorer"}](${a.explorer})`;
}
