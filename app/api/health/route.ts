// Public health check for A2A gateways (Anvita Flow, external agents).
// No same-origin gate — read-only, no AI cost.

import { AGENT_DESCRIPTION, AGENT_NAME, AGENT_SKILL_ID, AGENT_DISCLAIMER } from "@/lib/branding";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { x402PublicStatus } from "@/lib/x402";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  return Response.json({
    status: "online",
    agent: AGENT_SKILL_ID,
    name: AGENT_NAME,
    disclaimer: AGENT_DISCLAIMER,
    version: "2.2",
    network: { chainId: 1672, name: "Pharos" },
    webApp: "https://pharos-agent-pi.vercel.app/chat",
    discovery: "/api/info",
    x402: x402PublicStatus(),
    timestamp: new Date().toISOString(),
  });
}
