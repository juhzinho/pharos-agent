// Live campaign tracker — proxies the official Pharos Port API (server-side,
// because api.pharosnetwork.xyz requires a Referer header and blocks CORS).
import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export interface Campaign {
  name: string;
  startTime: string;
  endTime: string;
  url: string;
  kind: "rewards" | "eco";
}

interface RawActivity {
  name?: string;
  start_time?: string;
  end_time?: string;
  url?: string;
}

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);
  try {
    const res = await fetch("https://api.pharosnetwork.xyz/omni_port/activities", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://port.pharos.xyz/",
        Origin: "https://port.pharos.xyz",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);
    const j = await res.json();
    const campaigns: Campaign[] = [];
    for (const kind of ["rewards", "eco"] as const) {
      for (const it of (j?.data?.[kind] ?? []) as RawActivity[]) {
        if (!it?.name) continue;
        campaigns.push({
          name: it.name,
          startTime: it.start_time ?? "",
          endTime: it.end_time ?? "",
          url: it.url ?? "https://port.pharos.xyz/",
          kind,
        });
      }
    }
    return NextResponse.json({ campaigns });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
