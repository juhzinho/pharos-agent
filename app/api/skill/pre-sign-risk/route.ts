import { analyzeUnsignedBatch, type UnsignedTxInput } from "@/lib/presign-risk";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 20);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const b = body as {
    to?: string;
    data?: string;
    value?: string;
    transactions?: UnsignedTxInput[];
  };

  const txs: UnsignedTxInput[] = Array.isArray(b.transactions) && b.transactions.length
    ? b.transactions.slice(0, 5)
    : b.to
      ? [{ to: b.to, data: b.data, value: b.value }]
      : [];

  if (!txs.length || !txs.every((t) => typeof t.to === "string" && /^0x[a-fA-F0-9]{40}$/.test(t.to))) {
    return Response.json({ error: "Provide { to, data?, value? } or { transactions: [...] } with valid 0x addresses." }, { status: 400 });
  }

  try {
    const report = analyzeUnsignedBatch(txs);
    return Response.json({
      ...report,
      available: true,
      safety: "read-only — analyzes unsigned calldata, does not sign or broadcast",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ available: false, error: msg }, { status: 502 });
  }
}
