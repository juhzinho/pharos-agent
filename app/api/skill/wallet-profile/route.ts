// Public Skill API — on-chain wallet intelligence profile.
// POST { address } → balances, tx count, AI-style profile (tags/risk/insight).
// Strictly read-only: public RPC data, no signature, zero gas. Open to external
// agents (rate-limited) so any ProsPilot caller can use this as a Skill.

import { getWalletAnalysis } from "@/lib/walletAnalysis";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 10);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let address: unknown;
  try {
    const body = await req.json();
    address = body?.address;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return Response.json({ error: "Missing or invalid 'address' (0x + 40 hex chars)." }, { status: 400 });
  }

  try {
    const a = await getWalletAnalysis(address);

    const tags: string[] = [];
    if (a.txCount === 0) tags.push("Fresh Wallet");
    else if (a.txCount >= 100) tags.push("Power User");
    else if (a.txCount >= 10) tags.push("Active User");
    else tags.push("Getting Started");
    if (a.totalUsd >= 10_000) tags.push("Whale");
    else if (a.totalUsd >= 1_000) tags.push("Significant Holder");
    if (a.holdings.length >= 3) tags.push("Diversified");
    if (a.holdings.some((h) => h.symbol === "USDC")) tags.push("Stablecoin Holder");
    tags.push("Pharos Native");

    const top = a.holdings[0];
    const concentrated = top && a.totalUsd > 0 && top.usdValue != null && top.usdValue / a.totalUsd > 0.8;
    const risk = concentrated ? "Concentrated" : a.holdings.length >= 3 ? "Balanced" : "Low activity";

    const summary =
      a.holdings.length === 0
        ? `Wallet ${address.slice(0, 6)}… has no balances in known Pharos tokens and ${a.txCount} outgoing transactions.`
        : `Wallet ${address.slice(0, 6)}… holds ${a.holdings.map((h) => `${h.balance.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${h.symbol}`).join(", ")} (~$${a.totalUsd.toFixed(2)}) with ${a.txCount} transactions sent on Pharos.${concentrated && top ? ` Portfolio is concentrated in ${top.symbol}.` : ""}`;

    const insight =
      a.holdings.some((h) => h.symbol === "PROS" || h.symbol === "WPROS")
        ? "Consider FaroSwap V3 WPROS/USDC liquidity or PROS staking on Pharos Port (~10% APY) for yield on idle holdings."
        : "Bridge assets to Pharos via Jumper, CCIP or CCTP to start exploring RealFi yield opportunities.";

    return Response.json({
      address,
      holdings: a.holdings.map((h) => ({
        symbol: h.symbol,
        balance: h.balance,
        usd_value: h.usdValue,
      })),
      total_usd: a.totalUsd,
      tx_count: a.txCount,
      profile: { summary, tags, risk, insight },
      available: true,
      explorer_url: a.explorer,
      safety: "read-only — no signature, zero gas, public RPC data only",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ address, available: false, error: msg }, { status: 502 });
  }
}
