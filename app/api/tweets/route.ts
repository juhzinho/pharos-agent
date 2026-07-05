// Live tweets from @pharos_network — via Twitter's public syndication
// endpoint (no API key required). Parses the embedded __NEXT_DATA__ JSON.
// Cached for 10 minutes. Every successful fetch is merged into a permanent
// on-disk archive (data/tweets-archive.json): the syndication feed only shows
// the ~20 most recent tweets, so archiving guarantees old tweets stay in our
// timeline forever even after they rotate out upstream.
import { NextResponse } from "next/server";
import { mergeIntoArchive, readArchive } from "@/lib/newsArchive";

export interface Tweet {
  id: string;
  text: string;
  createdAt: string; // ISO
  url: string;
  isRetweet: boolean;
  image?: string;
}

interface RawTweet {
  conversation_id_str?: string;
  id_str?: string;
  created_at?: string;
  full_text?: string;
  text?: string;
  retweeted_status?: unknown;
  user?: { screen_name?: string };
  entities?: {
    media?: Array<{ media_url_https?: string; type?: string }>;
    urls?: Array<{ url?: string; expanded_url?: string }>;
  };
}

function cleanText(raw: string, entities: RawTweet["entities"]): string {
  let text = raw;
  // Expand t.co links to their real targets, drop trailing media links.
  for (const u of entities?.urls ?? []) {
    if (u.url && u.expanded_url) text = text.replace(u.url, u.expanded_url);
  }
  text = text.replace(/https:\/\/t\.co\/\w+/g, "").trim();
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .trim();
}

// Last successful result — served as a fallback when the syndication endpoint
// rate-limits us (30 req/window per IP). With revalidate:600 we stay far below
// the limit in production, but this keeps the feed alive during bursts.
let lastGood: { tweets: Tweet[]; at: number } | null = null;

const SYNDICATION_URL =
  "https://syndication.twitter.com/srv/timeline-profile/screen-name/pharos_network";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Twitter's syndication endpoint sits behind Cloudflare TLS fingerprinting that
// sometimes rejects server-side runtimes (HTTP 429). When that happens we fall
// back to the r.jina.ai reader proxy asking for raw HTML — same content.
async function fetchTimelineHtml(): Promise<string> {
  const direct = await fetch(SYNDICATION_URL, {
    headers: BROWSER_HEADERS,
    next: { revalidate: 600 },
  }).catch(() => null);
  if (direct?.ok) return direct.text();

  const proxied = await fetch(`https://r.jina.ai/${SYNDICATION_URL}`, {
    headers: { "X-Return-Format": "html", "User-Agent": BROWSER_HEADERS["User-Agent"] },
    next: { revalidate: 600 },
  });
  if (!proxied.ok) throw new Error(`upstream HTTP ${direct?.status ?? "ERR"} / proxy HTTP ${proxied.status}`);
  return proxied.text();
}

export async function GET() {
  try {
    const html = await fetchTimelineHtml();

    const marker = html.indexOf("__NEXT_DATA__");
    if (marker < 0) throw new Error("no __NEXT_DATA__ found");
    const start = html.indexOf(">", marker) + 1;
    const end = html.indexOf("</script>", start);
    const data = JSON.parse(html.slice(start, end));

    const entries: Array<{ type?: string; content?: { tweet?: RawTweet } }> =
      data?.props?.pageProps?.timeline?.entries ?? [];

    const tweets: Tweet[] = [];
    for (const e of entries) {
      if (e?.type !== "tweet") continue;
      const t = e.content?.tweet;
      const id = t?.conversation_id_str ?? t?.id_str;
      const rawText = t?.full_text ?? t?.text ?? "";
      if (!id || !rawText) continue;
      const createdMs = t?.created_at ? Date.parse(t.created_at) : NaN;
      tweets.push({
        id,
        text: cleanText(rawText, t?.entities),
        createdAt: Number.isNaN(createdMs) ? "" : new Date(createdMs).toISOString(),
        url: `https://x.com/pharos_network/status/${id}`,
        isRetweet: !!t?.retweeted_status || rawText.startsWith("RT @"),
        image: t?.entities?.media?.find((m) => m.media_url_https)?.media_url_https,
      });
    }
    if (tweets.length === 0) throw new Error("no tweets parsed");

    // Merge into the permanent archive — old tweets never disappear.
    const all = await mergeIntoArchive("tweets-archive.json", tweets, (t) => t.id);
    all.sort((a, b) => Date.parse(b.createdAt || "0") - Date.parse(a.createdAt || "0"));
    lastGood = { tweets: all, at: Date.now() };
    return NextResponse.json({ tweets: all });
  } catch (err) {
    if (lastGood) {
      return NextResponse.json({ tweets: lastGood.tweets, stale: true });
    }
    // Cold start + upstream down — serve whatever the archive has.
    const archived = await readArchive<Tweet>("tweets-archive.json");
    if (archived.length > 0) {
      archived.sort((a, b) => Date.parse(b.createdAt || "0") - Date.parse(a.createdAt || "0"));
      return NextResponse.json({ tweets: archived, stale: true });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
