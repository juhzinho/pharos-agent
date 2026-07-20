// Read Anvita CLI config from disk (local dev only).
// Avoids pasting short-lived gatewayAccessToken into the browser.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface LocalAnvitaConfig {
  accessToken?: string;
  gatewayAccessToken?: string;
  gatewayUrl?: string;
  serverUrl?: string;
  activeAgent?: {
    agentSmartAccount?: string;
    name?: string;
  };
}

export function readLocalCallerName(): string | undefined {
  return readLocalAnvitaConfig()?.activeAgent?.name?.trim() || undefined;
}

let cached: { mtimeMs: number; data: LocalAnvitaConfig } | null = null;

function configPath(): string {
  const override = process.env.ANVITA_CONFIG_PATH?.trim();
  if (override) return override;
  return path.join(os.homedir(), ".anvitaflow", "config.json");
}

export function isLocalConfigEnabled(): boolean {
  if (process.env.ANVITA_READ_LOCAL_CONFIG === "false") return false;
  if (process.env.ANVITA_READ_LOCAL_CONFIG === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function readLocalAnvitaConfig(): LocalAnvitaConfig | null {
  if (!isLocalConfigEnabled()) return null;

  const file = configPath();
  try {
    const stat = fs.statSync(file);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data;

    const data = JSON.parse(fs.readFileSync(file, "utf8")) as LocalAnvitaConfig;
    cached = { mtimeMs: stat.mtimeMs, data };
    return data;
  } catch {
    return null;
  }
}

export function readLocalGatewayToken(): string | undefined {
  return readLocalAnvitaConfig()?.gatewayAccessToken?.trim() || undefined;
}

export function readLocalAccessToken(): string | undefined {
  return readLocalAnvitaConfig()?.accessToken?.trim() || undefined;
}

export function readLocalCallerDid(): string | undefined {
  const ca = readLocalAnvitaConfig()?.activeAgent?.agentSmartAccount?.trim();
  if (!ca) return undefined;
  return ca.startsWith("did:") ? ca : `did:anvita:${ca}`;
}

export function gatewayTokenMeta(token: string): { expired: boolean; expiresAt?: string } {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as { exp?: number };
    if (!payload.exp) return { expired: false };
    const expMs = payload.exp * 1000;
    return {
      expired: Date.now() > expMs,
      expiresAt: new Date(expMs).toISOString(),
    };
  } catch {
    return { expired: false };
  }
}
