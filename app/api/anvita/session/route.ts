import { getAnvitaConfig, validateGatewayTokenInput } from "@/lib/anvita-gateway";
import {
  gatewayTokenMeta,
  isLocalConfigEnabled,
  readLocalCallerName,
  readLocalGatewayToken,
} from "@/lib/anvita-local-config";
import {
  buildSessionCookies,
  clearSessionCookies,
  hasGatewayAccess,
  readAnvitaSession,
} from "@/lib/anvita-session";
import { checkSameOrigin, forbiddenResponse } from "@/lib/rate-limit";

interface SessionBody {
  gatewayToken?: string;
  callerDid?: string;
  apiKey?: string;
}

export async function GET(req: Request) {
  const cfg = getAnvitaConfig(req);
  const session = readAnvitaSession(req);
  const connected = hasGatewayAccess(req, process.env.ANVITA_GATEWAY_TOKEN);
  const rawToken =
    process.env.ANVITA_GATEWAY_TOKEN?.trim() ||
    session.gatewayToken?.trim() ||
    readLocalGatewayToken();
  const tokenError = rawToken ? validateGatewayTokenInput(rawToken) : "Token vazio.";

  return Response.json({
    connected,
    tokenExpired: Boolean(rawToken && !connected && tokenError?.includes("expirou")),
    tokenError: connected ? null : tokenError,
    source: process.env.ANVITA_GATEWAY_TOKEN?.trim()
      ? "env"
      : session.gatewayToken
        ? "browser"
        : readLocalGatewayToken()
          ? "local-config"
          : "none",
    hasCallerDid: Boolean(cfg.callerDid),
    hasApiKey: Boolean(cfg.agentApiKey),
    callerDid: cfg.callerDid ?? null,
    callerName: readLocalCallerName() || process.env.ANVITA_CALLER_NAME?.trim() || null,
    localConfig: isLocalConfigEnabled(),
    tokenExpiresAt: cfg.gatewayToken ? gatewayTokenMeta(cfg.gatewayToken).expiresAt ?? null : null,
  });
}

export async function POST(req: Request) {
  if (!checkSameOrigin(req)) return forbiddenResponse();

  let body: SessionBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const gatewayToken = typeof body.gatewayToken === "string" ? body.gatewayToken.trim() : "";
  const tokenError = validateGatewayTokenInput(gatewayToken);
  if (tokenError) {
    return Response.json({ error: tokenError }, { status: 400 });
  }

  const callerDid =
    typeof body.callerDid === "string" && body.callerDid.trim() ? body.callerDid.trim() : undefined;
  const apiKey =
    typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : undefined;

  const cookies = buildSessionCookies({ gatewayToken, callerDid, apiKey });
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const line of cookies) headers.append("Set-Cookie", line);

  return new Response(JSON.stringify({ ok: true, connected: true }), { headers });
}

export async function DELETE(req: Request) {
  if (!checkSameOrigin(req)) return forbiddenResponse();

  const headers = new Headers({ "Content-Type": "application/json" });
  for (const line of clearSessionCookies()) headers.append("Set-Cookie", line);

  return new Response(JSON.stringify({ ok: true, connected: false }), { headers });
}
