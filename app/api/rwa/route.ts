// Live global RWA market data (scraped from rwa.xyz's public dashboard).
// Cached 30 min in lib/rwa-live; rate-limited like the other data routes.
import { NextResponse } from "next/server";
import { getRwaMarketData } from "@/lib/rwa-live";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);
  try {
    const data = await getRwaMarketData();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
