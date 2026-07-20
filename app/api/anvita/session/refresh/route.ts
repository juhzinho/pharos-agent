import { readLocalCallerDid, readLocalGatewayToken } from "@/lib/anvita-local-config";
import { buildSessionCookies } from "@/lib/anvita-session";
import { validateGatewayTokenInput } from "@/lib/anvita-gateway";
import { checkSameOrigin, forbiddenResponse } from "@/lib/rate-limit";

// Sync gateway token from ~/.anvitaflow/config.json (local dev).
export async function POST(req: Request) {
  if (!checkSameOrigin(req)) return forbiddenResponse();

  const gatewayToken = readLocalGatewayToken();
  if (!gatewayToken) {
    return Response.json(
      { error: "config.json não encontrado ou sem gatewayAccessToken." },
      { status: 404 }
    );
  }

  const tokenError = validateGatewayTokenInput(gatewayToken);
  if (tokenError) {
    return Response.json({ error: tokenError }, { status: 400 });
  }

  const callerDid = readLocalCallerDid();
  const cookies = buildSessionCookies({ gatewayToken, callerDid });
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const line of cookies) headers.append("Set-Cookie", line);

  return new Response(JSON.stringify({ ok: true, connected: true, source: "local-config" }), {
    headers,
  });
}
