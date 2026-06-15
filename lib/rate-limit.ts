// Simple in-memory sliding-window rate limiter for the public Skill API routes.
// Per-IP, 20 requests/minute by default. In-memory is fine for a single Next.js
// instance; swap for Redis/Upstash if deployed across multiple instances.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const hits = new Map<string, number[]>();

// ── Same-origin protection ───────────────────────────────────────────────────
// These routes spend server-side AI/paid resources, so we only allow calls that
// originate from our own site. We compare the request's Origin/Referer against:
//   • the request's OWN host (so same-origin always works on any domain, preview
//     deploy, custom domain, or localhost:<port> — no config needed),
//   • an explicit ALLOWED_ORIGIN allow-list (comma-separated),
//   • Vercel's deployment URLs (VERCEL_URL / VERCEL_PROJECT_PRODUCTION_URL),
//   • any localhost / 127.0.0.1 origin in development.
// NOTE: Origin/Referer headers can be forged by non-browser clients (curl), so
// this stops browser-based cross-site abuse and casual scraping — it is NOT a
// strong auth boundary. Rate limiting + provider spend caps remain the backstop.

function toOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function checkSameOrigin(req: Request): boolean {
  // A same-origin browser POST always sends Origin; same-origin navigations send
  // Referer. A bare server-to-server call (curl with no headers) sends neither →
  // blocked, which is exactly what we want.
  const origin = toOrigin(req.headers.get("origin")) ?? toOrigin(req.headers.get("referer"));
  if (!origin) return false;

  const allowed = new Set<string>();

  // The request's own host always counts as same-origin.
  const host = req.headers.get("host");
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }

  // Explicit allow-list, e.g. ALLOWED_ORIGIN=https://app.example.com,https://www.example.com
  for (const o of (process.env.ALLOWED_ORIGIN ?? "").split(",")) {
    const n = toOrigin(o.trim());
    if (n) allowed.add(n);
  }

  // Vercel-provided URLs are host-only (no protocol).
  for (const v of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (v) allowed.add(`https://${v}`);
  }

  // Dev convenience: any localhost / 127.0.0.1 origin (any port).
  if (process.env.NODE_ENV !== "production") {
    try {
      const h = new URL(origin).hostname;
      if (h === "localhost" || h === "127.0.0.1") return true;
    } catch {
      /* fall through */
    }
  }

  return allowed.has(origin);
}

export function forbiddenResponse(): Response {
  return Response.json(
    { error: "Forbidden: this endpoint can only be called from the official site." },
    { status: 403 }
  );
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function checkRateLimit(req: Request, maxPerMinute: number = MAX_REQUESTS): { allowed: boolean; retryAfterSec: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = (hits.get(ip) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= maxPerMinute) {
    const retryAfterSec = Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000);
    hits.set(ip, timestamps);
    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  timestamps.push(now);
  hits.set(ip, timestamps);

  // Opportunistic cleanup so the map doesn't grow unbounded
  if (hits.size > 5000) {
    for (const [key, ts] of hits) {
      if (ts.every((t) => t <= windowStart)) hits.delete(key);
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}

export function rateLimitResponse(retryAfterSec: number): Response {
  return Response.json(
    { error: "Rate limit exceeded. Max 20 requests per minute." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
