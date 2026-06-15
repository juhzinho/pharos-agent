// Public Skill API — knowledge endpoint.
// POST { question: string } → { answer, sources: [{ name }], foundInKnowledge, provider }
// Runs the RAG retrieval + multi-provider AI cascade entirely server-side,
// using non-public env keys (OPENAI_API_KEY, GEMINI_API_KEY, …).

import { parseWithGroq, type GroqResult } from "@/lib/groq";
import { webSearch, formatSearchContext } from "@/lib/search";
import { queryDocs, formatDocsContext } from "@/lib/docs";
import { getTokenPrice, formatPriceBlock } from "@/lib/prices";
import { checkRateLimit, rateLimitResponse, checkSameOrigin, forbiddenResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Same-origin only: this route spends server-side AI credits.
  if (!checkSameOrigin(req)) return forbiddenResponse();
  const rl = checkRateLimit(req, 15);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let question: unknown;
  try {
    const body = await req.json();
    question = body?.question;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "Missing 'question' (string) in body." }, { status: 400 });
  }
  if (question.length > 2000) {
    return Response.json({ error: "'question' too long (max 2000 chars)." }, { status: 400 });
  }

  try {
    const history: Array<{ role: "user"; content: string }> = [{ role: "user", content: question.trim() }];
    let result: GroqResult = await parseWithGroq(history);

    // Same follow-up loops as the chat UI: if the model asked for live data
    // (price/search/docs), fetch it so the answer is grounded instead of a
    // dangling "let me check…".
    if (!result.action && result.needsPrice) {
      try {
        const p = await getTokenPrice(result.needsPrice);
        result.reply = result.reply + "\n\n" + formatPriceBlock(result.needsPrice, p);
      } catch {
        result.reply = result.reply + "\n\n_Live price unavailable right now — try coingecko.com._";
      }
    } else if (!result.action && result.needsDocs && result.docsTarget && result.docsQuery) {
      const dr = await queryDocs(result.docsTarget, result.docsQuery).catch(() => null);
      if (dr) result = await parseWithGroq(history, undefined, undefined, undefined, formatDocsContext(dr));
    } else if (!result.action && result.needsSearch && result.searchQuery) {
      const sr = await webSearch(result.searchQuery).catch(() => null);
      if (sr) result = await parseWithGroq(history, undefined, undefined, formatSearchContext(sr));
    }

    return Response.json({
      answer: result.reply,
      sources: (result.sources ?? []).map((name) => ({ name })),
      foundInKnowledge: result.foundInKnowledge === true,
      // The proposed on-chain action, if the question was an intent (read-only — nothing is executed)
      action: result.action,
      provider: result._provider ?? null,
    });
  } catch (err) {
    console.error("[api:query]", err);
    return Response.json({ error: "Internal error answering the question." }, { status: 500 });
  }
}
