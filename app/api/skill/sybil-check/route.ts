import { runSybilAnalysis, runSybilClusterAnalysis } from "@/lib/sybil-detector";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { withPaidSkill, X402_SKILL_PRICES } from "@/lib/x402";

async function handlePost(req: Request) {
  const rl = checkRateLimit(req, 5);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let body: { address?: unknown; addresses?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validAddr = (a: unknown) => typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);

  if (Array.isArray(body.addresses)) {
    const addresses = body.addresses.filter(validAddr).slice(0, 10);
    if (addresses.length < 2) {
      return Response.json({ error: "Provide 2–10 valid 'addresses' for cluster analysis." }, { status: 400 });
    }
    try {
      const cluster = await runSybilClusterAnalysis(addresses);
      return Response.json({ ...cluster, available: true, mode: "cluster" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ available: false, error: msg }, { status: 502 });
    }
  }

  if (!validAddr(body.address)) {
    return Response.json({ error: "Missing or invalid 'address' (0x + 40 hex chars)." }, { status: 400 });
  }

  try {
    const report = await runSybilAnalysis(body.address as string);
    return Response.json({ ...report, available: true, mode: "single" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ address: body.address, available: false, error: msg }, { status: 502 });
  }
}

export const POST = withPaidSkill(handlePost, X402_SKILL_PRICES.sybilCheck);
