import { sendAnvitaMessage, PROSPILOT_DID } from "@/lib/anvita-gateway";
import { checkRateLimit, rateLimitResponse, checkSameOrigin, forbiddenResponse } from "@/lib/rate-limit";

interface AskBody {
  message?: string;
  targetDid?: string;
  targetName?: string;
  contextId?: string;
}

export async function POST(req: Request) {
  if (!checkSameOrigin(req)) return forbiddenResponse();

  const rl = checkRateLimit(req, 10);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let body: AskBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "Missing 'message'." }, { status: 400 });
  }
  if (message.length > 4000) {
    return Response.json({ error: "Message too long (max 4000 chars)." }, { status: 400 });
  }

  const targetDid =
    typeof body.targetDid === "string" && body.targetDid.trim()
      ? body.targetDid.trim()
      : PROSPILOT_DID;
  const targetName =
    typeof body.targetName === "string" && body.targetName.trim()
      ? body.targetName.trim()
      : undefined;
  const contextId =
    typeof body.contextId === "string" && body.contextId.trim()
      ? body.contextId.trim()
      : undefined;

  try {
    const result = await sendAnvitaMessage({ message, targetDid, targetName, contextId }, req);
    return Response.json(result);
  } catch (err) {
    console.error("[anvita/ask]", err);
    const msg = err instanceof Error ? err.message : "A2A request failed";
    const status = msg.includes("not configured") || msg.includes("token") ? 503 : 502;
    return Response.json({ error: msg }, { status });
  }
}
