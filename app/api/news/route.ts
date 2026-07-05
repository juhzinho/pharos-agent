// Live Pharos news feed — scrapes pharos.xyz/resources (static Webflow HTML).
// Parses the actual cards so every item carries its own link and image:
//   Blog: <a href="/blog/slug">…<div class="researches-title">T</div><div class="blog-time">D</div>
//   News: <div class="link-block-9 news">…<div class="text-block-20">T</div>…<a href="external-url">
// Cached for 30 minutes; falls back with 502 so the client can degrade gracefully.
import { NextResponse } from "next/server";

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

export async function GET() {
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
    return NextResponse.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
