// Live Pharos news feed — scrapes pharos.xyz/resources (static Webflow HTML).
// Parses the actual cards so every item carries its own link and image:
//   Blog: <a href="/blog/slug">…<div class="researches-title">T</div><div class="blog-time">D</div>
//   News: <div class="link-block-9 news">…<div class="text-block-20">T</div>…<a href="external-url">
// Cached for 30 minutes. Every successful scrape is merged into a permanent
// on-disk archive (data/news-archive.json) so items that rotate off the
// upstream page NEVER disappear from our feed.
import { NextResponse } from "next/server";
import { mergeIntoArchive, readArchive } from "@/lib/newsArchive";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export interface NewsItem {
  title: string;
  date: string;
  kind: "news" | "blog";
  url: string;
  image?: string;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BLOG_RE =
  /<a href="(\/blog\/[^"]+)"[^>]*>[\s\S]{0,120}?<div class="blog-item blog">\s*<img src="([^"]+)"[\s\S]*?class="researches-title">([\s\S]*?)<\/div>\s*<div class="blog-time">([^<]+)<\/div>/g;

const NEWS_RE =
  /class="link-block-9 news">\s*<img src="([^"]+)"[\s\S]*?class="text-block-20">([\s\S]*?)<\/div>\s*<div class="blog-time">([^<]+)<\/div>[\s\S]*?<a href="([^"]+)"[^>]*class="blog-more-text/g;

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 30);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);
  try {
    const res = await fetch("https://www.pharos.xyz/resources", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);
    const html = await res.text();

    const items: NewsItem[] = [];
    const seen = new Set<string>();

    for (const m of html.matchAll(NEWS_RE)) {
      const [, image, rawTitle, date, url] = m;
      const title = decode(rawTitle.replace(/<[^>]*>/g, ""));
      if (!title || seen.has(title)) continue;
      seen.add(title);
      items.push({
        title,
        date: date.trim(),
        kind: "news",
        url: url.startsWith("http") ? url : `https://www.pharos.xyz${url}`,
        image,
      });
    }

    for (const m of html.matchAll(BLOG_RE)) {
      const [, path, image, rawTitle, date] = m;
      const title = decode(rawTitle.replace(/<[^>]*>/g, ""));
      if (!title || seen.has(title)) continue;
      seen.add(title);
      items.push({
        title,
        date: date.trim(),
        kind: "blog",
        url: `https://www.pharos.xyz${path}`,
        image,
      });
    }

    if (items.length === 0) throw new Error("no items parsed");

    // Merge into the permanent archive — returns fresh + all historical items.
    const all = await mergeIntoArchive("news-archive.json", items, (i) => i.url);
    all.sort((a, b) => Date.parse(b.date || "0") - Date.parse(a.date || "0"));
    return NextResponse.json({ items: all });
  } catch (err) {
    // Upstream failed — serve the archive so the feed never goes empty.
    const archived = await readArchive<NewsItem>("news-archive.json");
    if (archived.length > 0) {
      archived.sort((a, b) => Date.parse(b.date || "0") - Date.parse(a.date || "0"));
      return NextResponse.json({ items: archived, stale: true });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
