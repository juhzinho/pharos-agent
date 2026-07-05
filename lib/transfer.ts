// Payment agent: native PROS / ERC-20 transfers, batch sends, and ERC-20
// approvals built from natural language. The agent only BUILDS transactions —
// the user signs each one in their own wallet (non-custodial).

import { TOKENS, PHAROS_NETWORKS, type PharosNetworkId, type TokenSymbol } from "./tokens";

export interface TransferItem {
  to: string;
  amount: number;       // human units
  token: string;        // "PROS" | ERC-20 symbol
}

export interface BuiltTx {
  to: string;
  value: string;   // hex wei
  data: string;
  description: string;
}

export interface TransferBuild {
  network: PharosNetworkId;
  txs: BuiltTx[];
  totalByToken: Record<string, number>;
}

const ADDR_RE = /0x[a-fA-F0-9]{40}/g;

function toWeiHex(amount: number, decimals: number): string {
  // Avoid float precision issues: work through a fixed-point string.
  const s = amount.toFixed(decimals);
  const [int, frac = ""] = s.split(".");
  const raw = BigInt(int + frac.padEnd(decimals, "0").slice(0, decimals));
  return "0x" + raw.toString(16);
}

function encodeErc20Transfer(to: string, amountHex: string): string {
  return (
    "0xa9059cbb" +
    to.slice(2).toLowerCase().padStart(64, "0") +
    amountHex.slice(2).padStart(64, "0")
  );
}

function encodeErc20Approve(spender: string, amountHex: string): string {
  return (
    "0x095ea7b3" +
    spender.slice(2).toLowerCase().padStart(64, "0") +
    amountHex.slice(2).padStart(64, "0")
  );
}

export function extractAddresses(text: string): string[] {
  return [...new Set([...text.matchAll(ADDR_RE)].map((m) => m[0]))];
}

// Builds one tx per transfer item. Native token (PROS on mainnet, PHRS on
// testnet) → value transfer; known ERC-20 → transfer() calldata (mainnet only,
// since testnet token addresses differ).
export function buildTransferTxs(items: TransferItem[], network: PharosNetworkId): TransferBuild {
  const net = PHAROS_NETWORKS[network];
  const txs: BuiltTx[] = [];
  const totalByToken: Record<string, number> = {};

  for (const item of items) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(item.to)) throw new Error(`Invalid address: ${item.to}`);
    if (!(item.amount > 0)) throw new Error(`Invalid amount: ${item.amount}`);
    const sym = item.token.toUpperCase();
    const isNative = sym === "PROS" || sym === "PHRS" || sym === net.nativeSymbol;

    if (isNative) {
      txs.push({
        to: item.to,
        value: toWeiHex(item.amount, 18),
        data: "0x",
        description: `Send ${item.amount} ${net.nativeSymbol} → ${item.to.slice(0, 6)}…${item.to.slice(-4)}`,
      });
    } else {
      if (network === "testnet") {
        throw new Error(`ERC-20 transfers are mainnet-only (testnet token addresses differ). Use ${net.nativeSymbol} on testnet.`);
      }
      const t = TOKENS[sym as TokenSymbol];
      if (!t || t.address === "0x0000000000000000000000000000000000000000") {
        throw new Error(`Unknown token '${sym}'. Supported: ${Object.keys(TOKENS).join(", ")}.`);
      }
      const amountHex = toWeiHex(item.amount, t.decimals);
      txs.push({
        to: t.address,
        value: "0x0",
        data: encodeErc20Transfer(item.to, amountHex),
        description: `Send ${item.amount} ${sym} → ${item.to.slice(0, 6)}…${item.to.slice(-4)}`,
      });
    }
    totalByToken[sym] = (totalByToken[sym] ?? 0) + item.amount;
  }

  return { network, txs, totalByToken };
}

export interface ApproveParams {
  token: string;     // ERC-20 symbol
  spender: string;   // 0x address
  amount: number | "unlimited";
}

export function buildApproveTx(params: ApproveParams): BuiltTx {
  const sym = params.token.toUpperCase();
  const t = TOKENS[sym as TokenSymbol];
  if (!t || t.address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Unknown ERC-20 '${sym}'. Supported: ${Object.keys(TOKENS).filter((k) => k !== "PROS").join(", ")}.`);
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(params.spender)) throw new Error(`Invalid spender address: ${params.spender}`);
  const amountHex =
    params.amount === "unlimited"
      ? "0x" + (BigInt(2) ** BigInt(256) - BigInt(1)).toString(16)
      : toWeiHex(params.amount, t.decimals);
  return {
    to: t.address,
    value: "0x0",
    data: encodeErc20Approve(params.spender, amountHex),
    description: `Approve ${params.amount === "unlimited" ? "unlimited" : params.amount} ${sym} for ${params.spender.slice(0, 6)}…${params.spender.slice(-4)}`,
  };
}
