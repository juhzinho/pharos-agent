// Simple in-memory sliding-window rate limiter for the public Skill API routes.
// Per-IP, 20 requests/minute by default. In-memory is fine for a single Next.js
// instance; swap for Redis/Upstash if deployed across multiple instances.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const hits = new Map<string, number[]>();

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function checkRateLimit(req: Request): { allowed: boolean; retryAfterSec: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = (hits.get(ip) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS) {
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
