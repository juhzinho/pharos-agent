// A2A v0.3 JSON-RPC endpoint for Anvita Flow and external agent gateways.
// Discovery card: /.well-known/agent-card.json

import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getAgentCard, handleA2AJsonRpc } from "@/lib/a2a";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Payment",
};

function withCors(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

export async function GET() {
  return Response.json(getAgentCard(), {
    headers: { ...CORS, "Cache-Control": "public, max-age=300" },
  });
}

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } },
      { status: 400 }
    );
  }

  return withCors(await handleA2AJsonRpc(body as { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown }));
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
