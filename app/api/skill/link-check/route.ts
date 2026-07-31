import { compareLinks, scanLink, scanLinks } from "@/lib/link-scanner";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { withPaidSkill, X402_SKILL_PRICES } from "@/lib/x402";

async function handlePost(req: Request) {
  const rl = checkRateLimit(req, 8);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let body: {
    url?: unknown;
    urls?: unknown;
    text?: unknown;
    suspiciousUrl?: unknown;
    officialUrl?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validUrl = (u: unknown) => typeof u === "string" && u.trim().length >= 8;

  if (validUrl(body.suspiciousUrl) && validUrl(body.officialUrl)) {
    try {
      const compare = await compareLinks(body.suspiciousUrl as string, body.officialUrl as string);
      return Response.json({ ...compare, available: true, mode: "compare" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ available: false, error: msg }, { status: 502 });
    }
  }

  if (Array.isArray(body.urls)) {
    const urls = body.urls.filter(validUrl).slice(0, 5);
    if (urls.length === 0) {
      return Response.json({ error: "Provide 1–5 valid URLs in 'urls'." }, { status: 400 });
    }
    try {
      const batch = await scanLinks(urls as string[]);
      return Response.json({ ...batch, available: true, mode: "batch" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ available: false, error: msg }, { status: 502 });
    }
  }

  const single = validUrl(body.url) ? (body.url as string) : null;
  if (!single && typeof body.text === "string") {
    const { extractUrls, detectLinkCompareQuery } = await import("@/lib/link-scanner");
    const compareQ = detectLinkCompareQuery(body.text);
    if (compareQ) {
      try {
        const compare = await compareLinks(compareQ.suspicious, compareQ.official);
        return Response.json({ ...compare, available: true, mode: "compare" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return Response.json({ available: false, error: msg }, { status: 502 });
      }
    }
    const fromText = extractUrls(body.text).slice(0, 5);
    if (fromText.length >= 2) {
      try {
        const batch = await scanLinks(fromText);
        return Response.json({ ...batch, available: true, mode: "batch" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return Response.json({ available: false, error: msg }, { status: 502 });
      }
    }
    if (fromText.length === 1) {
      try {
        const report = await scanLink(fromText[0]);
        return Response.json({ ...report, available: true, mode: "single" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return Response.json({ available: false, error: msg }, { status: 502 });
      }
    }
  }

  if (!single) {
    return Response.json({
      error: "Provide 'url', 'urls', 'text', or both 'suspiciousUrl' + 'officialUrl'.",
    }, { status: 400 });
  }

  try {
    const report = await scanLink(single);
    return Response.json({ ...report, available: true, mode: "single" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ available: false, error: msg }, { status: 502 });
  }
}

export const POST = withPaidSkill(handlePost, X402_SKILL_PRICES.linkCheck);
