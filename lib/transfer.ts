// Payment agent: native PROS / ERC-20 transfers, batch sends, and ERC-20
// approvals built from natural language. The agent only BUILDS transactions —
// the user signs each one in their own wallet (non-custodial).

import { Interface } from "ethers";
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
  /** Per-recipient lines when several sends are packed into one on-chain tx */
  legs?: BuiltTx[];
}

/** Canonical Multicall3 on Pharos mainnet + Atlantic testnet */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const ADDR_RE = /0x[a-fA-F0-9]{40}/g;

const multicallIface = new Interface([
  "function aggregate3Value((address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])",
]);

function toWeiHex(amount: number, decimals: number): string {
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

function isNativeToken(sym: string, network: PharosNetworkId): boolean {
  const net = PHAROS_NETWORKS[network];
  return sym === "PROS" || sym === "PHRS" || sym === net.nativeSymbol;
}

export function extractAddresses(text: string): string[] {
  return [...new Set([...text.matchAll(ADDR_RE)].map((m) => m[0]))];
}

interface ConsolidatedTransferItem extends TransferItem {
  /** How many user-intended sends were merged (same to + token). */
  parts: number;
}

// Multiple sends to the same address + token → one on-chain tx (one wallet signature).
export function consolidateTransferItems(items: TransferItem[]): ConsolidatedTransferItem[] {
  const buckets = new Map<string, ConsolidatedTransferItem>();
  for (const item of items) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(item.to)) throw new Error(`Invalid address: ${item.to}`);
    if (!(item.amount > 0)) throw new Error(`Invalid amount: ${item.amount}`);
    const sym = item.token.toUpperCase();
    const key = `${item.to.toLowerCase()}:${sym}`;
    const prev = buckets.get(key);
    if (prev) {
      prev.amount += item.amount;
      prev.parts += 1;
    } else {
      buckets.set(key, { to: item.to, token: sym, amount: item.amount, parts: 1 });
    }
  }
  return [...buckets.values()];
}

function buildLegTx(item: ConsolidatedTransferItem, network: PharosNetworkId): BuiltTx {
  const net = PHAROS_NETWORKS[network];
  const sym = item.token.toUpperCase();
  const short = `${item.to.slice(0, 6)}…${item.to.slice(-4)}`;
  const descSuffix = item.parts > 1 ? ` (${item.parts}× combined)` : "";

  if (isNativeToken(sym, network)) {
    return {
      to: item.to,
      value: toWeiHex(item.amount, 18),
      data: "0x",
      description: `Send ${item.amount} ${net.nativeSymbol} → ${short}${descSuffix}`,
    };
  }

  if (network === "testnet") {
    throw new Error(`ERC-20 transfers are mainnet-only (testnet token addresses differ). Use ${net.nativeSymbol} on testnet.`);
  }
  const t = TOKENS[sym as TokenSymbol];
  if (!t || t.address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Unknown token '${sym}'. Supported: ${Object.keys(TOKENS).join(", ")}.`);
  }
  const amountHex = toWeiHex(item.amount, t.decimals);
  return {
    to: t.address,
    value: "0x0",
    data: encodeErc20Transfer(item.to, amountHex),
    description: `Send ${item.amount} ${sym} → ${short}${descSuffix}`,
  };
}

// Pack multiple native sends into one Multicall3 tx (one wallet popup).
function buildNativeMulticallBatch(legs: BuiltTx[]): BuiltTx {
  let totalValue = 0n;
  const calls = legs.map((leg) => {
    const value = BigInt(leg.value);
    totalValue += value;
    return [leg.to, false, value, leg.data || "0x"] as const;
  });
  const data = multicallIface.encodeFunctionData("aggregate3Value", [calls]);
  return {
    to: MULTICALL3_ADDRESS,
    value: "0x" + totalValue.toString(16),
    data,
    description: `Batch send ${legs.length} native transfers (1 signature via Multicall3)`,
  };
}

// Builds txs after consolidating same (recipient, token). Native PROS/PHRS to
// multiple different addresses → one Multicall3 batch. ERC-20 to different
// addresses still needs one signature per recipient (Multicall3 cannot pull
// tokens from the user's wallet without a separate approve).
export function buildTransferTxs(items: TransferItem[], network: PharosNetworkId): TransferBuild {
  const consolidated = consolidateTransferItems(items);
  const legs = consolidated.map((item) => buildLegTx(item, network));
  const totalByToken: Record<string, number> = {};
  for (const item of consolidated) {
    totalByToken[item.token] = (totalByToken[item.token] ?? 0) + item.amount;
  }

  if (legs.length === 1) {
    return { network, txs: legs, totalByToken };
  }

  const allNative = consolidated.every((item) => isNativeToken(item.token.toUpperCase(), network));
  if (allNative) {
    return { network, txs: [buildNativeMulticallBatch(legs)], totalByToken, legs };
  }

  return { network, txs: legs, totalByToken };
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
