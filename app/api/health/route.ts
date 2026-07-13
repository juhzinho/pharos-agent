// Public health check for A2A gateways (Anvita Flow, external agents).
// No same-origin gate — read-only, no AI cost.

import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  return Response.json({
    status: "online",
    agent: "pharos-agent",
    version: "2.1",
    network: { chainId: 1672, name: "Pharos" },
    webApp: "https://pharos-agent-pi.vercel.app/chat",
    discovery: "/api/info",
    timestamp: new Date().toISOString(),
  });
}
