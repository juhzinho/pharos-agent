export interface ParsedIntent {
  action: "swap" | "bridge";
  fromToken: string;
  toToken: string;
  amount: number;
  toChain?: string;
}

const SYSTEM_PROMPT = `You are a DeFi agent for Pharos Network. Parse the user's request into a JSON action.
Supported actions: swap (same chain) and bridge (cross-chain).
Available tokens: PROS (native), WPROS, USDC.
Available destination chains for bridge: Base, Ethereum, Polygon, Arbitrum.
Return ONLY valid JSON with no markdown, no code blocks, no explanation.
Format: { "action": "swap"|"bridge", "fromToken": "PROS"|"USDC"|"WPROS", "toToken": "...", "amount": number, "toChain": "Base"|"Ethereum"|"Polygon"|"Arbitrum" }
The toChain field is required only for bridge actions.
If the request is unclear or not a swap/bridge, return: { "error": "brief explanation" }`;

export async function parseIntent(userMessage: string): Promise<ParsedIntent> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === "PASTE_YOUR_KEY_HERE") {
    throw new Error("Gemini API key not configured. Add NEXT_PUBLIC_GEMINI_API_KEY to .env.local");
  }

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
  });

  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body }
    );
    if (response.ok) break;
    const err = await response.json().catch(() => ({}));
    const msg: string = err?.error?.message ?? "";
    if (response.status === 503 || msg.toLowerCase().includes("high demand")) {
      if (attempt < 2) { await new Promise((r) => setTimeout(r, 2000)); continue; }
    }
    throw new Error(msg || `Gemini API error: ${response.status}`);
  }
  if (!response!.ok) {
    throw new Error(`Gemini API error: ${response!.status}`);
  }

  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/```[a-z]*\n?/gi, "").trim();

  let parsed: ParsedIntent & { error?: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse Gemini response: ${raw}`);
  }

  if (parsed.error) throw new Error(parsed.error);
  if (!parsed.action || !parsed.fromToken || !parsed.toToken || parsed.amount == null) {
    throw new Error("Incomplete intent returned by Gemini");
  }

  return parsed;
}
