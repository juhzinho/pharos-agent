// Multi-provider AI cascade: Grok → GitHub Models → Cerebras → Gemini → Groq
// Each provider gets PROVIDER_RETRIES attempts before the cascade moves on.
// callAI() returns the raw text content from whichever provider answered.

const PROVIDER_RETRIES = 2;
const PROVIDER_RETRY_DELAY_MS = 800;
const REQUEST_TIMEOUT_MS = 20_000;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface AIResult {
  text: string;
  provider: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Provider 1: Grok (xAI) with Live Search ──────────────────────────────

const GROK_MODELS = ["grok-4-latest", "grok-3-latest", "grok-beta"] as const;

async function callGrok(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_XAI_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_XAI_API_KEY not configured");

  for (const model of GROK_MODELS) {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        "https://api.x.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            max_tokens: 1000,
            response_format: { type: "json_object" },
            search_parameters: {
              mode: "auto",
              return_citations: true,
              sources: [
                { type: "x", x_handles: ["pharos_network"] },
                { type: "web" },
              ],
            },
            messages: [{ role: "system", content: systemPrompt }, ...messages],
          }),
        },
        REQUEST_TIMEOUT_MS
      );
    } catch (err) {
      throw err;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg: string = err?.error?.message ?? `xAI HTTP ${res.status}`;
      if (/model not found|does not exist|invalid model/i.test(msg) && model !== GROK_MODELS[GROK_MODELS.length - 1]) {
        console.warn(`[pharos:ai] Grok model ${model} unavailable, trying next`);
        continue;
      }
      throw new Error(msg);
    }

    const data = await res.json();
    let content: string = data?.choices?.[0]?.message?.content ?? "";

    // Citations appear at top-level or inside the message object depending on API version
    const rawCitations: Array<{ url?: string; title?: string }> =
      data?.citations ?? data?.choices?.[0]?.message?.citations ?? [];
    const hasCitations = rawCitations.length > 0;

    console.log("[pharos:ai] grok live search citations:", rawCitations.length);

    if (hasCitations && content) {
      // Inject citation links into the reply field of the JSON response
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.reply === "string") {
          const lines = rawCitations
            .filter((c) => c.url)
            .slice(0, 6)
            .map((c) => `- [${c.title ?? c.url}](${c.url})`)
            .join("\n");
          if (lines) {
            parsed.reply = parsed.reply.trimEnd() + "\n\n---\n**Fontes:**\n" + lines;
          }
          content = JSON.stringify(parsed);
        }
      } catch { /* leave content unchanged if JSON parse fails */ }
    }

    return content;
  }

  throw new Error("All Grok models exhausted");
}

// ── Provider 2: OpenAI (gpt-4o-mini) ─────────────────────────────────────

async function callOpenAI(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_OPENAI_API_KEY not configured");

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    },
    REQUEST_TIMEOUT_MS
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI HTTP ${res.status}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ── Provider 3: GitHub Models (GPT-4o) ────────────────────────────────────

async function callGitHub(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_GITHUB_TOKEN not configured");

  const res = await fetchWithTimeout(
    "https://models.inference.ai.azure.com/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    },
    REQUEST_TIMEOUT_MS
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `GitHub Models HTTP ${res.status}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ── Provider 4: Cerebras (Llama-3.3-70b) ─────────────────────────────────

const CEREBRAS_MODELS = ["llama3.3-70b", "llama3.1-70b"] as const;

async function callCerebras(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_CEREBRAS_API_KEY not configured");

  for (const model of CEREBRAS_MODELS) {
    const res = await fetchWithTimeout(
      "https://api.cerebras.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 1000,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        }),
      },
      REQUEST_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg: string = err?.error?.message ?? `Cerebras HTTP ${res.status}`;
      if (res.status === 404 && model !== CEREBRAS_MODELS[CEREBRAS_MODELS.length - 1]) {
        console.warn(`[pharos:ai] Cerebras model ${model} not found, trying next`);
        continue;
      }
      throw new Error(msg);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }

  throw new Error("All Cerebras models exhausted");
}

// ── Provider 5: Gemini (gemini-2.5-flash) ────────────────────────────────

// Gemini requires strict user/model alternation, starting with "user".
// Merge consecutive same-role messages and drop a leading non-user message.
function toGeminiContents(
  messages: ChatMessage[]
): Array<{ role: "user" | "model"; parts: [{ text: string }] }> {
  const out: Array<{ role: "user" | "model"; parts: [{ text: string }] }> = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : ("user" as const);
    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += "\n" + m.content;
    } else {
      out.push({ role, parts: [{ text: m.content }] });
    }
  }
  // Must start with user
  if (out.length > 0 && out[0].role !== "user") out.shift();
  return out;
}

async function callGemini(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_GEMINI_API_KEY not configured");

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: toGeminiContents(messages),
        generationConfig: { temperature: 0.1, maxOutputTokens: 1000, responseMimeType: "application/json" },
      }),
    },
    REQUEST_TIMEOUT_MS
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini HTTP ${res.status}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── Provider 6: Groq (llama-3.3-70b-versatile) ───────────────────────────

async function callGroq(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
  if (!apiKey || apiKey === "PASTE_GROQ_KEY_HERE") throw new Error("NEXT_PUBLIC_GROQ_API_KEY not configured");

  const res = await fetchWithTimeout(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    },
    REQUEST_TIMEOUT_MS
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Groq HTTP ${res.status}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ── Cascade ────────────────────────────────────────────────────────────────

type ProviderFn = (messages: ChatMessage[], systemPrompt: string) => Promise<string>;

const PROVIDERS: Array<{ name: string; fn: ProviderFn }> = [
  { name: "Grok (xAI)",                         fn: callGrok     },
  { name: "OpenAI (gpt-4o-mini)",               fn: callOpenAI   },
  { name: "GitHub Models (GPT-4o)",              fn: callGitHub   },
  { name: "Cerebras (llama-3.3-70b)",            fn: callCerebras },
  { name: "Gemini (gemini-2.5-flash)",           fn: callGemini   },
  { name: "Groq (llama-3.3-70b-versatile)",      fn: callGroq     },
];

// In-memory rate-limit tracker: providerName → timestamp when block expires
const RATE_LIMITED_UNTIL: Map<string, number> = new Map();
const RATE_LIMIT_TTL_MS = 3_600_000; // 1 hour

function isRateLimited(name: string): boolean {
  const until = RATE_LIMITED_UNTIL.get(name);
  if (!until) return false;
  if (Date.now() >= until) { RATE_LIMITED_UNTIL.delete(name); return false; }
  return true;
}

function markRateLimited(name: string): void {
  RATE_LIMITED_UNTIL.set(name, Date.now() + RATE_LIMIT_TTL_MS);
  console.warn(`[pharos:ai] ${name} rate-limited — skipping for 1 hour`);
}

function isRateLimitError(msg: string): boolean {
  return /\b429\b|rate.?limit|quota.?exceeded|too.?many.?request|daily.?limit/i.test(msg);
}

export async function callAI(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<AIResult> {
  const providerErrors: string[] = [];

  for (const provider of PROVIDERS) {
    if (isRateLimited(provider.name)) {
      providerErrors.push(`${provider.name}: skipped (rate-limited)`);
      console.log(`[pharos:ai] skipping ${provider.name} — still rate-limited`);
      continue;
    }

    let lastErr = "";

    for (let attempt = 0; attempt <= PROVIDER_RETRIES; attempt++) {
      if (attempt > 0) await sleep(PROVIDER_RETRY_DELAY_MS);

      try {
        const text = await provider.fn(messages, systemPrompt);
        if (!text) {
          lastErr = "empty response";
          continue;
        }
        console.log("[pharos:ai] answered by:", provider.name);
        console.log("[pharos:ai] raw:", text.slice(0, 200));
        return { text, provider: provider.name };
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
    }

    if (isRateLimitError(lastErr)) {
      markRateLimited(provider.name);
    }

    console.warn(`[pharos:ai] ${provider.name} failed — ${lastErr} — trying next provider`);
    providerErrors.push(`${provider.name}: ${lastErr}`);
  }

  throw new Error(`All AI providers exhausted. Errors: ${providerErrors.join(" | ")}`);
}
