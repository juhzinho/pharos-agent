// Public Skill API — Wallet Intelligence score.
// POST { address } → 0-100 score across 6 categories (activity, gas, volume,
// token variety, protocol diversity, longevity), level badge, gas spent,
// protocols touched, monthly timeline and heuristic flags.
// Read-only: explorer API data only, no signature, zero gas. Rate-limited.

import { getWalletIntel } from "@/lib/walletIntel";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { withPaidSkill, X402_SKILL_PRICES } from "@/lib/x402";

async function handlePost(req: Request) {
  const rl = checkRateLimit(req, 6);
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
    const intel = await getWalletIntel(address);
    return Response.json({
      ...intel,
      available: true,
      safety: "read-only — no signature, zero gas, public explorer data only",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ address, available: false, error: msg }, { status: 502 });
  }
}

export const POST = withPaidSkill(handlePost, X402_SKILL_PRICES.walletScore);
