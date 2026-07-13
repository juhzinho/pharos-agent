// Minimal A2A v0.3 helpers for Anvita Flow / external agent gateways.

import { parseWithGroq } from "@/lib/groq";
import { getTokenPrice, formatPriceBlock } from "@/lib/prices";

const BASE = "https://pharos-agent-pi.vercel.app";

export function getAgentCard() {
  return {
    name: "Pharos Agent",
    description:
      "AI DeFi copilot for Pharos Network (chain 1672): ecosystem Q&A, prices, wallet analysis, " +
      "swap/bridge quotes, FaroSwap V3, Faroo staking. Non-custodial — on-chain actions at /chat.",
    url: `${BASE}/api/a2a`,
    provider: {
      organization: "Pharos Agent",
      url: BASE,
    },
    version: "0.3.0",
    documentationUrl: `${BASE}/api/info`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
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

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

export async function handleA2AJsonRpc(body: JsonRpcRequest): Promise<Response> {
  const id = body.id ?? null;
  const method = body.method ?? "";

  if (method === "agent/getCard" || method === "agent/getAuthenticatedExtendedCard") {
    return Response.json({ jsonrpc: "2.0", id, result: getAgentCard() });
  }

  const taskMethods = new Set([
    "message/send",
    "tasks/send",
    "tasks/create",
    "a2a.message.send",
  ]);

  if (!taskMethods.has(method)) {
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
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
    const messageId = `msg_${Date.now()}`;
    const taskId = `task_${Date.now()}`;

    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        kind: "message",
        messageId,
        taskId,
        contextId: taskId,
        role: "agent",
        parts: [{ kind: "text", text: answer }],
        status: { state: "completed" },
      },
    });
  } catch (err) {
    console.error("[a2a]", err);
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: "Internal error processing message" },
    });
  }
}
