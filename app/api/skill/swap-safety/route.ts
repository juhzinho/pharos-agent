import { analyzeFaroSwapSafety, analyzeLifiSwapSafety } from "@/lib/swap-safety";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { withPaidSkill, X402_SKILL_PRICES } from "@/lib/x402";

async function handlePost(req: Request) {
  const rl = checkRateLimit(req, 20);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const b = body as {
    provider?: "lifi" | "faroswap";
    intent?: { fromToken?: string; toToken?: string; amount?: number };
    receiveLabel?: string;
    needsApproval?: boolean;
    quote?: Parameters<typeof analyzeLifiSwapSafety>[1];
    faroswap?: Parameters<typeof analyzeFaroSwapSafety>[1];
  };

  if (!b.provider || !b.intent?.fromToken || !b.intent?.toToken || b.intent.amount == null) {
    return Response.json({
      error: "Provide provider, intent { fromToken, toToken, amount }, and quote or faroswap payload.",
    }, { status: 400 });
  }

  const intent = {
    action: "swap" as const,
    fromToken: b.intent.fromToken,
    toToken: b.intent.toToken,
    amount: b.intent.amount,
    fromChain: "Pharos",
  };

  try {
    const report =
      b.provider === "faroswap" && b.faroswap
        ? analyzeFaroSwapSafety(intent, b.faroswap)
        : b.provider === "lifi" && b.quote
          ? analyzeLifiSwapSafety(intent, b.quote, b.receiveLabel ?? "0", !!b.needsApproval)
          : null;

    if (!report) {
      return Response.json({ error: "Missing quote (lifi) or faroswap result payload." }, { status: 400 });
    }

    return Response.json({ ...report, available: true, safety: "read-only — quote analysis only" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ available: false, error: msg }, { status: 502 });
  }
}

export const POST = withPaidSkill(handlePost, X402_SKILL_PRICES.swapSafety);
