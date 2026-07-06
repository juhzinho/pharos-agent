// Wallet transaction history (SocialScan explorer API, server-side to avoid
// CORS). Rate-limited like the other data routes.
import { NextResponse } from "next/server";
import { getTxHistory } from "@/lib/tx-history";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address." }, { status: 400 });
  }
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10) || 10, 1), 25);

  try {
    const data = await getTxHistory(address, limit);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
