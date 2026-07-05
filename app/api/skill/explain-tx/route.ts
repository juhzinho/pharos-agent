// Public Skill API — plain-language transaction explainer.
// POST { tx_hash } → decoded action, status, value, gas, block + explanation.
// Read-only (public RPC). Checks Pharos Mainnet first, then Atlantic Testnet.

import { explainTx } from "@/lib/txexplain";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 15);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let txHash: unknown;
  try {
    const body = await req.json();
    txHash = body?.tx_hash ?? body?.txHash ?? body?.hash;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof txHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return Response.json({ error: "Missing or invalid 'tx_hash' (0x + 64 hex chars)." }, { status: 400 });
  }

  try {
    const e = await explainTx(txHash, "mainnet");
    if (!e.found) {
      return Response.json({
        tx_hash: txHash,
        available: false,
        error: "Transaction not found on Pharos Mainnet or Atlantic Testnet.",
        explorer_url: e.explorerUrl,
      }, { status: 404 });
    }

    const steps: string[] = [`Sent from ${e.from}`];
    if (e.to) steps.push(`${e.action === "Contract deployment" ? "Deployed at" : "Interacted with"} ${e.to}`);
    if (e.valuePros > 0) steps.push(`Transferred ${e.valuePros} ${e.network === "testnet" ? "PHRS" : "PROS"}`);
    steps.push(`Status: ${e.status === "success" ? "completed successfully" : e.status === "failed" ? "reverted on-chain (only gas spent)" : "still pending"}`);

    return Response.json({
      tx_hash: txHash,
      network: e.network === "testnet" ? "Pharos Atlantic Testnet" : "Pharos Mainnet",
      from_addr: e.from,
      to_addr: e.to,
      value_pros: e.valuePros,
      gas_used: e.gasUsed,
      gas_cost_pros: e.gasCostPros,
      status: e.status,
      block_number: e.blockNumber,
      selector: e.selector,
      explanation: {
        summary: `${e.action}${e.status === "failed" ? " — the transaction reverted, no value moved" : ""}.`,
        category: e.action,
        plain_steps: steps,
      },
      available: true,
      explorer_url: e.explorerUrl,
      safety: "read-only — no signature, zero gas, public RPC data only",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ tx_hash: txHash, available: false, error: msg }, { status: 502 });
  }
}
