import { readLocalGatewayToken } from "@/lib/anvita-local-config";
import { validateGatewayTokenInput } from "@/lib/anvita-gateway";
const COOKIE_GW = "anvita_gw";
const COOKIE_CALLER = "anvita_caller";
const COOKIE_API_KEY = "anvita_api_key";
const MAX_AGE_SEC = 7 * 24 * 60 * 60;

export interface AnvitaBrowserSession {
  gatewayToken?: string;
  callerDid?: string;
  apiKey?: string;
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function readAnvitaSession(req?: Request): AnvitaBrowserSession {
  if (!req) return {};
  const c = parseCookies(req.headers.get("cookie"));
  return {
    gatewayToken: c[COOKIE_GW] || undefined,
    callerDid: c[COOKIE_CALLER] || undefined,
    apiKey: c[COOKIE_API_KEY] || undefined,
  };
}

export function hasGatewayAccess(req?: Request, envToken?: string): boolean {
  const token =
    envToken?.trim() ||
    readAnvitaSession(req).gatewayToken?.trim() ||
    readLocalGatewayToken();
  if (!token) return false;
  return validateGatewayTokenInput(token) === null;
}

function cookieLine(name: string, value: string, maxAge = MAX_AGE_SEC): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function buildSessionCookies(session: AnvitaBrowserSession): string[] {
  const lines: string[] = [];
  if (session.gatewayToken?.trim()) {
    lines.push(cookieLine(COOKIE_GW, session.gatewayToken.trim()));
  }
  if (session.callerDid?.trim()) {
    lines.push(cookieLine(COOKIE_CALLER, session.callerDid.trim()));
  }
  if (session.apiKey?.trim()) {
    lines.push(cookieLine(COOKIE_API_KEY, session.apiKey.trim()));
  }
  return lines;
}

export function clearSessionCookies(): string[] {
  return [COOKIE_GW, COOKIE_CALLER, COOKIE_API_KEY].map(
    (name) => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}
