// Minimal A2A v0.3 helpers for Anvita Flow / external agent gateways.

import { randomUUID } from "node:crypto";
import { AGENT_DESCRIPTION, AGENT_NAME, AGENT_TAGLINE } from "@/lib/branding";
import { parseWithGroq } from "@/lib/groq";
import { getTokenPrice, formatPriceBlock } from "@/lib/prices";

const BASE = "https://pharos-agent-pi.vercel.app";

// Short-lived task cache for tasks/get polling (best-effort on serverless).
const TASK_TTL_MS = 15 * 60_000;
const taskCache = new Map<string, { task: A2ATask; expires: number }>();

export interface A2ATask {
  kind: "task";
  id: string;
  contextId: string;
  status: { state: "completed" | "working" | "failed"; timestamp?: string };
  artifacts: Array<{
    artifactId: string;
    name: string;
    parts: Array<{ kind: "text"; text: string }>;
  }>;
  history: Array<{
    role: "user" | "agent";
    parts: Array<{ kind: "text"; text: string }>;
    messageId: string;
    taskId: string;
    contextId: string;
  }>;
  metadata: Record<string, never>;
}

export function getAgentCard() {
  return {
    protocolVersion: "0.3.0",
    name: AGENT_NAME,
    description: AGENT_DESCRIPTION,
    url: `${BASE}/api/a2a`,
    preferredTransport: "JSONRPC",
    additionalInterfaces: [
      { url: `${BASE}/api/a2a`, transport: "JSONRPC" },
    ],
    provider: {
      organization: `${AGENT_NAME} (${AGENT_TAGLINE})`,
      url: BASE,
    },
    version: "2.1.0",
    documentationUrl: `${BASE}/api/info`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    authentication: {
      schemes: [] as string[],
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "pharos-knowledge",
        name: "Pharos ecosystem Q&A",
        description: "Answer questions about Pharos protocols, RWA, Faroo, FaroSwap, Anvita Flow",
        tags: ["pharos", "defi", "knowledge", "rwa"],
        examples: ["What is Faroo?", "Explain RealFi on Pharos"],
      },
      {
        id: "market-data",
        name: "Market data",
        description: "Token prices and RWA market aggregates",
        tags: ["price", "market"],
        examples: ["Price of PROS", "RWA market data"],
      },
      {
        id: "wallet-intel",
        name: "Wallet intelligence",
        description: "Read-only wallet profile, score, tx history when user provides 0x address",
        tags: ["wallet", "analysis"],
        examples: ["Analyze wallet 0x...", "Wallet score for 0x..."],
      },
      {
        id: "defi-guided",
        name: "DeFi guided flows",
        description: "Swap, bridge, LP, stake instructions; execution requires web app wallet",
        tags: ["swap", "bridge", "liquidity", "stake"],
        examples: ["Swap 10 PROS to USDC", "Bridge USDC to Base"],
      },
    ],
  };
}

function pruneTaskCache() {
  const now = Date.now();
  for (const [id, entry] of taskCache) {
    if (entry.expires <= now) taskCache.delete(id);
  }
}

function cacheTask(task: A2ATask) {
  pruneTaskCache();
  taskCache.set(task.id, { task, expires: Date.now() + TASK_TTL_MS });
}

export function getCachedTask(id: string): A2ATask | null {
  pruneTaskCache();
  return taskCache.get(id)?.task ?? null;
}

function extractUserText(params: unknown): string {
  if (!params || typeof params !== "object") return "";
  const p = params as Record<string, unknown>;

  const tryMessage = (msg: unknown): string => {
    if (!msg || typeof msg !== "object") return "";
    const m = msg as Record<string, unknown>;
    if (typeof m.text === "string") return m.text.trim();
    if (typeof m.content === "string") return m.content.trim();
    const parts = m.parts;
    if (Array.isArray(parts)) {
      return parts
        .map((part) => {
          if (!part || typeof part !== "object") return "";
          const pt = part as Record<string, unknown>;
          if (typeof pt.text === "string") return pt.text;
          if (pt.type === "text" && typeof pt.text === "string") return pt.text;
          return "";
        })
        .filter(Boolean)
        .join("\n")
        .trim();
    }
    return "";
  };

  return (
    tryMessage(p.message) ||
    tryMessage((p.task as Record<string, unknown> | undefined)?.message) ||
    (typeof p.text === "string" ? p.text.trim() : "") ||
    (typeof p.input === "string" ? p.input.trim() : "")
  );
}

function extractTaskId(params: unknown): string | null {
  if (!params || typeof params !== "object") return null;
  const p = params as Record<string, unknown>;
  if (typeof p.id === "string") return p.id;
  if (typeof p.taskId === "string") return p.taskId;
  return null;
}

export async function answerA2AMessage(userText: string): Promise<string> {
  const text = userText.trim();
  if (!text) {
    return "Please send a text message with your Pharos or DeFi question.";
  }
  if (text.length > 4000) {
    return "Message too long (max 4000 characters). Please shorten your question.";
  }

  const history = [{ role: "user" as const, content: text }];
  let result = await parseWithGroq(history);

  if (!result.action && result.needsPrice) {
    try {
      const p = await getTokenPrice(result.needsPrice);
      result.reply = result.reply + "\n\n" + formatPriceBlock(result.needsPrice, p);
    } catch {
      result.reply = result.reply + "\n\n_Live price unavailable — try https://pharos-agent-pi.vercel.app/chat_";
    }
  }

  let reply = result.reply.trim();

  if (result.action) {
    reply +=
      `\n\n**On-chain action:** connect your wallet at ${BASE}/chat (Pharos Mainnet, chain 1672) to review and sign.`;
  }

  return reply;
}

function buildCompletedTask(userText: string, answer: string, userMessageId?: string): A2ATask {
  const taskId = randomUUID();
  const contextId = randomUUID();
  const userMsgId = userMessageId ?? randomUUID();
  const agentMsgId = randomUUID();
  const now = new Date().toISOString();

  const task: A2ATask = {
    kind: "task",
    id: taskId,
    contextId,
    status: { state: "completed", timestamp: now },
    artifacts: [
      {
        artifactId: randomUUID(),
        name: "response",
        parts: [{ kind: "text", text: answer }],
      },
    ],
    history: [
      {
        role: "user",
        parts: [{ kind: "text", text: userText }],
        messageId: userMsgId,
        taskId,
        contextId,
      },
      {
        role: "agent",
        parts: [{ kind: "text", text: answer }],
        messageId: agentMsgId,
        taskId,
        contextId,
      },
    ],
    metadata: {},
  };

  cacheTask(task);
  return task;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

export async function handleA2AJsonRpc(body: JsonRpcRequest): Promise<Response> {
  const id = body.id ?? null;
  const method = (body.method ?? "").toLowerCase();

  if (method === "agent/getcard" || method === "agent/getauthenticatedextendedcard") {
    return Response.json({ jsonrpc: "2.0", id, result: getAgentCard() });
  }

  if (method === "tasks/get") {
    const taskId = extractTaskId(body.params);
    if (!taskId) {
      return Response.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Invalid params: missing task id" },
      });
    }
    const task = getCachedTask(taskId);
    if (!task) {
      return Response.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32001, message: "Task not found" },
      });
    }
    return Response.json({ jsonrpc: "2.0", id, result: task });
  }

  if (method === "message/stream" || method === "tasks/resubscribe") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32004, message: "Streaming not supported" },
    });
  }

  const taskMethods = new Set([
    "message/send",
    "tasks/send",
    "tasks/create",
    "a2a.message.send",
    "sendmessage",
  ]);

  if (!taskMethods.has(method)) {
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${body.method}` },
    });
  }

  const userText = extractUserText(body.params);
  if (!userText) {
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "Invalid params: missing user text in message" },
    });
  }

  try {
    const answer = await answerA2AMessage(userText);
    const userMessageId =
      body.params && typeof body.params === "object"
        ? ((body.params as Record<string, unknown>).message as Record<string, unknown> | undefined)?.messageId
        : undefined;
    const task = buildCompletedTask(
      userText,
      answer,
      typeof userMessageId === "string" ? userMessageId : undefined
    );

    return Response.json({ jsonrpc: "2.0", id, result: task });
  } catch (err) {
    console.error("[a2a]", err);
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: "Internal error processing message" },
    });
  }
}
