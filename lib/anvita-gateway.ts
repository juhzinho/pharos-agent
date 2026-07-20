// Server-side Anvita Flow client for ProsPilot Hub.
// Tokens and API keys stay on the server — never expose them to the browser.

import { randomUUID } from "node:crypto";
import {
  gatewayTokenMeta,
  isLocalConfigEnabled,
  readLocalAnvitaConfig,
  readLocalAccessToken,
  readLocalCallerDid,
  readLocalCallerName,
  readLocalGatewayToken,
} from "@/lib/anvita-local-config";
import { readAnvitaSession } from "@/lib/anvita-session";

export const PROSPILOT_DID =
  "did:anvita:0xed562ba8051f3203f637e57fbbbed0c6b41c1401";

export interface AnvitaAgentPolicy {
  agentCaDid: string;
  agentName?: string;
  userName?: string;
  capability?: string;
  strategy?: string;
  price?: string | number;
  online?: boolean;
  avatarUrl?: string;
}

export interface AnvitaConfig {
  flowUrl: string;
  gatewayUrl: string;
  agentApiKey?: string;
  flowAccessToken?: string;
  callerDid?: string;
  gatewayToken?: string;
  defaultTargetDid: string;
}

export interface AnvitaAskResult {
  text: string;
  contextId?: string;
  taskId?: string;
  targetDid: string;
  call: AnvitaCallMeta;
}

export interface AnvitaCallMeta {
  id: string;
  protocol: "A2A v0.3";
  method: "message/stream" | "message/send";
  transport: "JSONRPC + SSE" | "JSONRPC";
  gatewayUrl: string;
  callerDid: string;
  callerName?: string;
  targetDid: string;
  targetName?: string;
  verifiableCredential: boolean;
  durationMs: number;
  state: "completed" | "failed";
}

interface PolicyListData {
  total?: number;
  policies?: AnvitaAgentPolicy[];
}

interface ApiEnvelope<T> {
  code?: string;
  message?: string;
  data?: T;
}

const FALLBACK_AGENTS: AnvitaAgentPolicy[] = [
  {
    agentCaDid: PROSPILOT_DID,
    agentName: "ProsPilot",
    capability: "Pharos ecosystem Q&A, DeFi guidance",
    strategy: "free",
    price: 0,
    online: true,
  },
];

export function getAnvitaConfig(req?: Request): AnvitaConfig {
  const session = readAnvitaSession(req);
  const local = readLocalAnvitaConfig();

  return {
    flowUrl:
      process.env.ANVITA_FLOW_URL?.replace(/\/$/, "") ||
      local?.serverUrl?.replace(/\/$/, "") ||
      "https://flow.anvita.xyz",
    gatewayUrl:
      process.env.ANVITA_GATEWAY_URL?.replace(/\/$/, "") ||
      local?.gatewayUrl?.replace(/\/$/, "") ||
      "https://hub.anvita.xyz",
    agentApiKey:
      process.env.ANVITA_AGENT_API_KEY?.trim() || session.apiKey?.trim() || undefined,
    flowAccessToken:
      process.env.ANVITA_ACCESS_TOKEN?.trim() ||
      readLocalAccessToken() ||
      undefined,
    callerDid: (() => {
      const env = process.env.ANVITA_CALLER_DID?.trim();
      if (env) return env;
      if (isLocalConfigEnabled()) {
        return readLocalCallerDid() || session.callerDid?.trim();
      }
      return session.callerDid?.trim() || readLocalCallerDid();
    })(),
    gatewayToken: (() => {
      const env = process.env.ANVITA_GATEWAY_TOKEN?.trim();
      if (env) return env;
      // Local CLI config beats stale browser cookies during dev.
      if (isLocalConfigEnabled()) {
        return readLocalGatewayToken() || session.gatewayToken?.trim();
      }
      return session.gatewayToken?.trim() || readLocalGatewayToken();
    })(),
    defaultTargetDid:
      process.env.ANVITA_DEFAULT_TARGET_DID?.trim() ||
      process.env.PROSPILOT_DID?.trim() ||
      PROSPILOT_DID,
  };
}

export function validateGatewayTokenInput(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return "Token vazio.";
  try {
    const payload = JSON.parse(
      Buffer.from(trimmed.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as { iss?: string; role?: string; type?: string };

    if (payload.type === "access" || payload.type === "refresh") {
      return "Isso é accessToken/refreshToken da conta. Usa gatewayAccessToken do config.json.";
    }
    if (payload.iss !== "auth-gateway" && payload.role !== "client") {
      return "Token não parece ser gateway A2A. Copia gatewayAccessToken, não accessToken.";
    }
    const meta = gatewayTokenMeta(trimmed);
    if (meta.expired) {
      return `Gateway token expirou (${meta.expiresAt ?? "?"}). Atualiza o config.json (login Anvita no PC).`;
    }
    return null;
  } catch {
    return "Token JWT inválido.";
  }
}

function extractCaFromDid(did: string): string {
  const prefix = "did:anvita:";
  return did.startsWith(prefix) ? did.slice(prefix.length) : did;
}

function callerDidFromGatewayToken(token: string): string | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as { sub?: string };
    if (typeof payload.sub === "string" && payload.sub.startsWith("did:anvita:")) {
      return payload.sub;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

async function fetchFriendshipCredential(cfg: AnvitaConfig, targetDid: string): Promise<string | null> {
  const callerDid =
    cfg.callerDid || (cfg.gatewayToken ? callerDidFromGatewayToken(cfg.gatewayToken) : undefined);
  if (!callerDid) return null;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.agentApiKey) {
    headers["X-Agent-API-Key"] = cfg.agentApiKey;
  } else if (cfg.flowAccessToken) {
    headers.Authorization = `Bearer ${cfg.flowAccessToken}`;
  } else {
    return null;
  }

  const url = `${cfg.flowUrl.replace(/\/$/, "")}/api/v1/certificate/friendship/issue`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fromAgentCa: extractCaFromDid(callerDid),
      toAgentCa: extractCaFromDid(targetDid),
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Friendship credential HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ""}`
    );
  }

  const data = (await res.json()) as {
    code?: string;
    message?: string;
    data?: { credential?: string };
  };

  if ((data.code === "000000" || data.code === "200") && data.data?.credential) {
    return data.data.credential;
  }

  throw new Error(data.message || "Não foi possível obter credencial A2A (friendship/issue).");
}

async function buildA2AHeaders(cfg: AnvitaConfig, targetDid: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.gatewayToken}`,
    "X-Target-DID": targetDid,
  };

  try {
    const vc = await fetchFriendshipCredential(cfg, targetDid);
    if (!vc) {
      throw new Error(
        "Credencial A2A (X-A2A-VC) em falta. Faz login Anvita no PC para renovar accessToken no config.json."
      );
    }
    headers["X-A2A-VC"] = vc;
  } catch (err) {
    console.error("[anvita-vc]", err);
    throw err;
  }

  return headers;
}

function resolveCallerDid(cfg: AnvitaConfig): string {
  return (
    cfg.callerDid ||
    (cfg.gatewayToken ? callerDidFromGatewayToken(cfg.gatewayToken) : undefined) ||
    "did:anvita:unknown"
  );
}

function buildCallMeta(
  cfg: AnvitaConfig,
  targetDid: string,
  targetName: string | undefined,
  method: "message/stream" | "message/send",
  durationMs: number,
  state: "completed" | "failed"
): AnvitaCallMeta {
  return {
    id: randomUUID(),
    protocol: "A2A v0.3",
    method,
    transport: method === "message/stream" ? "JSONRPC + SSE" : "JSONRPC",
    gatewayUrl: `${cfg.gatewayUrl.replace(/\/$/, "")}/a2a/jsonrpc`,
    callerDid: resolveCallerDid(cfg),
    callerName: readLocalCallerName() || process.env.ANVITA_CALLER_NAME?.trim(),
    targetDid,
    targetName,
    verifiableCredential: true,
    durationMs,
    state,
  };
}

function isOkCode(code?: string): boolean {
  if (!code) return false;
  return code === "200" || code === "000000" || code.startsWith("2");
}

function extractTextFromParts(parts: unknown): string | undefined {
  if (!Array.isArray(parts)) return undefined;
  for (const part of parts) {
    if (
      part &&
      typeof part === "object" &&
      (part as { kind?: string }).kind === "text" &&
      typeof (part as { text?: string }).text === "string"
    ) {
      return (part as { text: string }).text;
    }
  }
  return undefined;
}

function extractTextFromA2AResult(result: unknown): string {
  if (!result || typeof result !== "object") return "";

  const r = result as Record<string, unknown>;

  if (r.kind === "message") {
    return extractTextFromParts(r.parts) || "";
  }

  if (r.kind === "task") {
    const status = r.status as { message?: { parts?: unknown }; state?: string } | undefined;
    const fromStatus = extractTextFromParts(status?.message?.parts);
    if (fromStatus) return fromStatus;

    const artifacts = r.artifacts as Array<{ parts?: unknown }> | undefined;
    if (Array.isArray(artifacts)) {
      for (const artifact of artifacts) {
        const text = extractTextFromParts(artifact?.parts);
        if (text) return text;
      }
    }

    const id = typeof r.id === "string" ? r.id : "unknown";
    return `Task ${id} state: ${status?.state ?? "unknown"}`;
  }

  return "";
}

function writeStreamDelta(str: string, state: { maxWritten: string; finalText: string }) {
  if (!str) return;
  if (str === state.maxWritten) return;

  if (str.startsWith(state.maxWritten)) {
    const delta = str.slice(state.maxWritten.length);
    if (delta) state.finalText += delta;
    state.maxWritten = str;
    return;
  }

  if (state.maxWritten.startsWith(str)) return;

  state.maxWritten += str;
  state.finalText += str;
}

async function readA2AStream(
  res: Response
): Promise<{ text: string; contextId?: string; taskId?: string }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Gateway stream returned no body.");

  const decoder = new TextDecoder();
  let buffer = "";
  let contextId: string | undefined;
  let taskId: string | undefined;
  const textState = { maxWritten: "", finalText: "" };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;

      const payloadRaw = line.slice(5).trim();
      if (!payloadRaw) continue;

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(payloadRaw) as Record<string, unknown>;
      } catch {
        continue;
      }

      const result = (payload.result ?? payload) as Record<string, unknown>;
      if (typeof result.contextId === "string") contextId = result.contextId;
      if (typeof result.taskId === "string") taskId = result.taskId;
      if (typeof result.id === "string" && result.kind === "task") taskId = result.id;

      const status = result.status as { message?: { parts?: unknown } } | undefined;
      const text = extractTextFromParts(status?.message?.parts);
      if (text) writeStreamDelta(text, textState);
    }
  }

  return {
    text: textState.finalText || textState.maxWritten,
    contextId,
    taskId,
  };
}

export async function listMarketplaceAgents(
  req?: Request,
  options?: { onlineOnly?: boolean }
): Promise<{ agents: AnvitaAgentPolicy[]; source: "api" | "fallback"; configured: boolean }> {
  const cfg = getAnvitaConfig(req);
  const onlineOnly = options?.onlineOnly ?? true;

  if (!cfg.agentApiKey || !cfg.callerDid) {
    return { agents: FALLBACK_AGENTS, source: "fallback", configured: false };
  }

  const url = `${cfg.flowUrl}/api/v1/agent/policy/query/inbound`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-API-Key": cfg.agentApiKey,
    },
    body: JSON.stringify({ agentCaDid: cfg.callerDid }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Anvita policy API HTTP ${res.status}`);
  }

  const envelope = (await res.json()) as ApiEnvelope<PolicyListData>;
  if (!isOkCode(envelope.code)) {
    throw new Error(envelope.message || `Anvita policy error (${envelope.code ?? "unknown"})`);
  }

  let policies = envelope.data?.policies ?? [];
  if (onlineOnly) {
    policies = policies.filter((p) => p.online === true);
  }

  if (policies.length === 0) {
    return { agents: FALLBACK_AGENTS, source: "fallback", configured: true };
  }

  return { agents: policies, source: "api", configured: true };
}

export async function sendAnvitaMessage(
  params: {
    message: string;
    targetDid?: string;
    targetName?: string;
    contextId?: string;
  },
  req?: Request
): Promise<AnvitaAskResult> {
  const started = Date.now();
  const cfg = getAnvitaConfig(req);
  const targetDid = params.targetDid?.trim() || cfg.defaultTargetDid;
  const message = params.message.trim();

  if (!message) throw new Error("Message is empty.");
  if (!cfg.gatewayToken) {
    throw new Error(
      "Gateway em falta. Clica «Ligar Gateway» ou faz login Anvita no PC (config.json)."
    );
  }

  const tokenErr = validateGatewayTokenInput(cfg.gatewayToken);
  if (tokenErr) throw new Error(tokenErr);

  const rpcUrl = `${cfg.gatewayUrl}/a2a/jsonrpc`;
  const outboundMessage = {
    kind: "message",
    messageId: randomUUID(),
    role: "user",
    parts: [{ kind: "text", text: message }],
    ...(params.contextId && { contextId: params.contextId }),
  };

  const streamBody = {
    jsonrpc: "2.0",
    id: randomUUID(),
    method: "message/stream",
    params: { message: outboundMessage },
  };

  const authHeaders = await buildA2AHeaders(cfg, targetDid);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...authHeaders,
  };

  let res = await fetch(rpcUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(streamBody),
    signal: AbortSignal.timeout(180_000),
  });

  if (res.status === 401) {
    throw new Error(
      "Gateway token expirado. Faz login no Anvita Flow no PC (renova config.json) e clica «Ligar Gateway»."
    );
  }

  if (res.status === 402) {
    throw new Error("Target agent requires x402 payment. ProsPilot Hub MVP supports FREE agents only.");
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (res.ok && contentType.includes("text/event-stream")) {
    const streamed = await readA2AStream(res);
    return {
      text: streamed.text || "No text returned from agent.",
      contextId: streamed.contextId ?? params.contextId,
      taskId: streamed.taskId,
      targetDid,
      call: buildCallMeta(
        cfg,
        targetDid,
        params.targetName,
        "message/stream",
        Date.now() - started,
        "completed"
      ),
    };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`A2A gateway HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`);
  }

  const sendBody = {
    jsonrpc: "2.0",
    id: randomUUID(),
    method: "message/send",
    params: { message: outboundMessage },
  };

  res = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await buildA2AHeaders(cfg, targetDid)),
    },
    body: JSON.stringify(sendBody),
    signal: AbortSignal.timeout(180_000),
  });

  if (res.status === 401) {
    throw new Error(
      "Gateway token expirado. Faz login no Anvita Flow no PC (renova config.json) e clica «Ligar Gateway»."
    );
  }
  if (res.status === 402) {
    throw new Error("Target agent requires x402 payment. ProsPilot Hub MVP supports FREE agents only.");
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`A2A gateway HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`);
  }

  const payload = (await res.json()) as {
    result?: unknown;
    error?: { message?: string };
  };

  if (payload.error) {
    throw new Error(payload.error.message || "A2A JSON-RPC error");
  }

  const result = payload.result as Record<string, unknown> | undefined;
  return {
    text: extractTextFromA2AResult(result) || "No text returned from agent.",
    contextId:
      (typeof result?.contextId === "string" ? result.contextId : undefined) ?? params.contextId,
    taskId: typeof result?.id === "string" ? result.id : undefined,
    targetDid,
    call: buildCallMeta(
      cfg,
      targetDid,
      params.targetName,
      "message/send",
      Date.now() - started,
      "completed"
    ),
  };
}
