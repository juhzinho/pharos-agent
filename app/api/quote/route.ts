// Public Skill API — read-only quote endpoint.
// POST { action: "swap"|"bridge", fromToken, toToken, amount, fromChain?, toChain?, fromAddress? }
// Returns the LI.FI quote JSON (route, estimate, fees). No signing, no execution.

import { buildSwapBridge } from "@/lib/lifi";
import type { ParsedIntent } from "@/lib/parser";
import { checkRateLimit, rateLimitResponse, checkSameOrigin, forbiddenResponse } from "@/lib/rate-limit";

// Placeholder sender for anonymous quotes — LI.FI requires a fromAddress to
// build the route, but the quote is informational only.
const QUOTE_PLACEHOLDER_ADDRESS = "0x000000000000000000000000000000000000dEaD";

const SUPPORTED_TOKENS = ["PROS", "WPROS", "USDC", "WETH", "LINK", "PGOLD", "USDPM"];
const SUPPORTED_CHAINS = ["Pharos", "Ethereum", "Base", "Arbitrum", "Polygon", "Optimism"];

export async function POST(req: Request) {
  // Same-origin only: this route spends server-side resources.
  if (!checkSameOrigin(req)) return forbiddenResponse();
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action;
  const fromToken = body.fromToken;
  const toToken = body.toToken;
  const amount = body.amount;
  const fromChain = (body.fromChain as string) || "Pharos";
  const toChain = (body.toChain as string) || (action === "bridge" ? undefined : fromChain);
  const fromAddress =
    typeof body.fromAddress === "string" && /^0x[0-9a-fA-F]{40}$/.test(body.fromAddress)
      ? body.fromAddress
      : QUOTE_PLACEHOLDER_ADDRESS;

  if (action !== "swap" && action !== "bridge") {
    return Response.json({ error: "'action' must be 'swap' or 'bridge'." }, { status: 400 });
  }
  if (typeof fromToken !== "string" || typeof toToken !== "string") {
    return Response.json({ error: "'fromToken' and 'toToken' (strings) are required." }, { status: 400 });
  }
  if (!SUPPORTED_TOKENS.includes(fromToken.toUpperCase()) || !SUPPORTED_TOKENS.includes(toToken.toUpperCase())) {
    return Response.json({ error: `Unsupported token. Supported: ${SUPPORTED_TOKENS.join(", ")}.` }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "'amount' must be a positive number." }, { status: 400 });
  }
  if (action === "bridge" && !toChain) {
    return Response.json({ error: "'toChain' is required for bridge quotes." }, { status: 400 });
  }
  for (const chain of [fromChain, toChain].filter(Boolean) as string[]) {
    if (!SUPPORTED_CHAINS.some((c) => c.toLowerCase() === chain.toLowerCase())) {
      return Response.json({ error: `Unsupported chain '${chain}'. Supported: ${SUPPORTED_CHAINS.join(", ")}.` }, { status: 400 });
    }
  }

  const intent: ParsedIntent = {
    action,
    fromToken: fromToken.toUpperCase(),
    toToken: toToken.toUpperCase(),
    amount,
    fromChain,
    toChain,
  };

  try {
    const quote = await buildSwapBridge(intent, fromAddress);
    return Response.json({
      action,
      tool: quote.tool,
      estimate: quote.estimate,
      route: quote.action,
      // Calldata is included so external agents can present it to THEIR user for
      // signing — this API never signs or broadcasts anything.
      transactionRequest: quote.transactionRequest,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch quote.";
    console.error("[api:quote]", msg);
    return Response.json({ error: msg }, { status: 502 });
  }
}
