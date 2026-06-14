// Server-side AI endpoint for the in-app chat.
// Keeps ALL secret keys (AI cascade, embeddings, Tavily) on the server — the
// browser never sees them. The client posts the conversation and gets back the
// full GroqResult it needs to build transactions.
//
// Modes (one round-trip each, mirroring the chat's two-step UX):
//  • default    → parse intent only (returns needsSearch/needsDocs/needsPrice flags)
//  • search:Q   → run Tavily web search server-side, re-ground, return grounded result
//  • docs:{...} → query deep docs server-side, re-ground, return grounded result

import { parseWithGroq, type GroqResult } from "@/lib/groq";
import { webSearch, formatSearchContext } from "@/lib/search";
import { queryDocs, formatDocsContext } from "@/lib/docs";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type ChatTurn = { role: "user" | "assistant"; content: string };

interface AgentBody {
  history?: ChatTurn[];
  prefsContext?: string;
  txContext?: string;
  search?: string;                       // run a web search, then re-ground
  docs?: { target: string; query: string }; // query deep docs, then re-ground
}

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let body: AgentBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const history = body.history;
  if (!Array.isArray(history) || history.length === 0) {
    return Response.json({ error: "Missing 'history' (non-empty array)." }, { status: 400 });
  }
  // Light guard against abuse: cap turns + size.
  const safeHistory = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (safeHistory.length === 0) {
    return Response.json({ error: "No valid messages in 'history'." }, { status: 400 });
  }

  try {
    let result: GroqResult;
    let grounded = false;

    if (typeof body.search === "string" && body.search.trim()) {
      // Web-search grounding (Tavily runs here, server-side).
      const sr = await webSearch(body.search.trim()).catch(() => null);
      if (sr) {
        result = await parseWithGroq(safeHistory, body.prefsContext, body.txContext, formatSearchContext(sr));
        grounded = true;
      } else {
        result = await parseWithGroq(safeHistory, body.prefsContext, body.txContext);
      }
    } else if (body.docs && typeof body.docs.target === "string" && typeof body.docs.query === "string") {
      // Deep-docs grounding (?ask= endpoints run here, server-side).
      const dr = await queryDocs(body.docs.target, body.docs.query).catch(() => null);
      if (dr) {
        result = await parseWithGroq(safeHistory, body.prefsContext, body.txContext, undefined, formatDocsContext(dr));
        grounded = true;
      } else {
        result = await parseWithGroq(safeHistory, body.prefsContext, body.txContext);
      }
    } else {
      // First pass: parse intent only.
      result = await parseWithGroq(safeHistory, body.prefsContext, body.txContext);
    }

    return Response.json({ ...result, grounded });
  } catch (err) {
    console.error("[api:agent]", err);
    return Response.json({ error: "Internal error processing the message." }, { status: 500 });
  }
}
