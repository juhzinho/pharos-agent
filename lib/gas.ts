// Pre-signature gas estimation (Pharos Mainnet) — eth_estimateGas +
// eth_gasPrice via the public RPC so every transaction card can show the
// user an approximate network fee BEFORE they sign. Best-effort: any failure
// returns null and the card simply omits the line (the wallet still shows
// its own estimate at signing time).

const RPC = "https://rpc.pharos.xyz";

async function rpcCall(method: string, params: unknown[]): Promise<string | null> {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const j = await res.json();
    return j.error ? null : (j.result as string);
  } catch {
    return null;
  }
}

export interface GasEstimateResult {
  gasUnits: bigint;
  costPros: number; // gas × gasPrice, in native PROS
}

/**
 * Estimates the network fee for a transaction. `value` accepts hex or decimal
 * strings (LI.FI/CCIP builders emit both). Applies the +20% buffer the Pharos
 * gas model recommends so the shown number matches what wallets reserve.
 */
export async function estimateGasCost(tx: {
  from: string;
  to: string;
  data?: string;
  value?: string | bigint;
}): Promise<GasEstimateResult | null> {
  let valueHex: string | undefined;
  if (typeof tx.value === "bigint") {
    valueHex = "0x" + tx.value.toString(16);
  } else if (tx.value && tx.value !== "0x0" && tx.value !== "0") {
    valueHex = tx.value.startsWith("0x") ? tx.value : "0x" + BigInt(tx.value).toString(16);
  }

  const [gasHex, priceHex] = await Promise.all([
    rpcCall("eth_estimateGas", [{
      from: tx.from,
      to: tx.to,
      ...(tx.data && tx.data !== "0x" ? { data: tx.data } : {}),
      ...(valueHex ? { value: valueHex } : {}),
    }]),
    rpcCall("eth_gasPrice", []),
  ]);
  if (!gasHex || !priceHex) return null;

  const gasUnits = (BigInt(gasHex) * 12n) / 10n; // +20% buffer (Pharos refund model)
  const costWei = gasUnits * BigInt(priceHex);
  return { gasUnits, costPros: Number(costWei) / 1e18 };
}

/** Formats the cost for UI display, e.g. "~0.00021 PROS". */
export function formatGasCost(est: GasEstimateResult): string {
  const c = est.costPros;
  const digits = c >= 0.01 ? 4 : c >= 0.0001 ? 6 : 8;
  return `~${c.toFixed(digits)} PROS`;
}
