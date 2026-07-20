import { fetchWeb3RadarBriefing, WEB3_RADAR_TOPICS, type Web3RadarTopic } from "@/lib/web3-radar";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const VALID = new Set(WEB3_RADAR_TOPICS.map((t) => t.id));

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 20);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  const topic = new URL(req.url).searchParams.get("topic") as Web3RadarTopic | null;
  const lang = new URL(req.url).searchParams.get("lang") === "pt" ? "pt" : "en";

  if (!topic || !VALID.has(topic)) {
    return Response.json(
      { error: "Missing or invalid topic.", topics: WEB3_RADAR_TOPICS.map((t) => t.id) },
      { status: 400 },
    );
  }

  try {
    const text = await fetchWeb3RadarBriefing(topic, lang);
    return Response.json({ topic, lang, text });
  } catch (err) {
    console.error("[web3-radar]", err);
    return Response.json({ error: "Briefing fetch failed." }, { status: 502 });
  }
}
