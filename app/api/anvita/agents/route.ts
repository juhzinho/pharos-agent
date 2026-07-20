import { listMarketplaceAgents, PROSPILOT_DID } from "@/lib/anvita-gateway";
import { hasGatewayAccess } from "@/lib/anvita-session";

export async function GET(req: Request) {
  try {
    const { agents, source, configured } = await listMarketplaceAgents(req, { onlineOnly: true });
    return Response.json({
      agents,
      source,
      configured,
      gatewayConnected: hasGatewayAccess(req, process.env.ANVITA_GATEWAY_TOKEN),
      defaultDid: PROSPILOT_DID,
    });
  } catch (err) {
    console.error("[anvita/agents]", err);
    return Response.json(
      {
        agents: [
          {
            agentCaDid: PROSPILOT_DID,
            agentName: "ProsPilot",
            capability: "Pharos ecosystem Q&A, DeFi guidance",
            strategy: "free",
            price: 0,
            online: true,
          },
        ],
        source: "fallback",
        configured: false,
        gatewayConnected: hasGatewayAccess(req, process.env.ANVITA_GATEWAY_TOKEN),
        defaultDid: PROSPILOT_DID,
        error: err instanceof Error ? err.message : "Failed to load agents",
      },
      { status: 200 }
    );
  }
}
