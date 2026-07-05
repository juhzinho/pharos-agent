// Live Pharos news feed — scrapes pharos.xyz/resources (static Webflow HTML).
// Cached for 30 minutes; falls back with 502 so the client can use the
// built-in knowledge timeline instead.
import { NextResponse } from "next/server";

export interface NewsItem {
  title: string;
  date: string;
  kind: "news" | "blog";
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DATE_RE =
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/;

export async function GET() {
  try {
    const res = await fetch("https://www.pharos.xyz/resources", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);
    const html = await res.text();
    const text = stripTags(html);

    // Titles on the resources page are immediately followed by their date.
    // Split on dates and take the preceding sentence-ish chunk as the title.
    const items: NewsItem[] = [];
    const re = new RegExp(DATE_RE.source, "g");
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    let section: "news" | "blog" = "news";
    while ((m = re.exec(text)) !== null && items.length < 30) {
      const chunk = text.slice(lastIndex, m.index).trim();
      lastIndex = re.lastIndex;
      if (/\bBlogs\b/.test(chunk)) section = "blog";
      // Title = tail of the chunk, cleaned of nav/section labels and "Read more".
      const title = chunk
        .replace(/^.*?(?:NEWS|Read more)\s*/s, "")
        .replace(/Read more/g, "")
        .replace(/^Blogs\s+/, "")
        .trim();
      if (title.length >= 20 && title.length <= 220) {
        items.push({ title, date: m[0], kind: section });
      }
    }
    if (items.length === 0) throw new Error("no items parsed");
    return NextResponse.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
