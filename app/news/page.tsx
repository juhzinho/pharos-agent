"use client";

// Live updates feed — official announcements + blog posts (pharos.xyz) and
// posts from @pharos_network on X, merged into a single sorted timeline.

import { useEffect, useMemo, useState } from "react";
import PageShell from "@/components/PageShell";

interface FeedItem {
  kind: "news" | "blog" | "tweet";
  title: string;
  date: string;        // display string
  sortKey: number;     // unix ms for sorting (0 if unknown)
  url: string;
  image?: string;
}

const KIND_META = {
  news: { label: "News", color: "#00d4ff" },
  blog: { label: "Blog", color: "#a78bfa" },
  tweet: { label: "X · @pharos_network", color: "#e2e8f0" },
} as const;

function fmtTweetDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 1) return `${Math.max(1, Math.round(diffH * 60))}m ago`;
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NewsPage() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [warning, setWarning] = useState("");
  const [filter, setFilter] = useState<"all" | "news" | "blog" | "tweet">("all");

  useEffect(() => {
    const newsP = fetch("/api/news").then((r) => r.json()).catch(() => ({ error: "fetch failed" }));
    const tweetsP = fetch("/api/tweets").then((r) => r.json()).catch(() => ({ error: "fetch failed" }));

    Promise.all([newsP, tweetsP]).then(([nj, tj]) => {
      const merged: FeedItem[] = [];
      const problems: string[] = [];

      if (nj?.items) {
        for (const it of nj.items as Array<{ title: string; date: string; kind: "news" | "blog" }>) {
          const ms = Date.parse(it.date);
          merged.push({
            kind: it.kind,
            title: it.title,
            date: it.date,
            sortKey: Number.isNaN(ms) ? 0 : ms,
            url: "https://www.pharos.xyz/resources",
          });
        }
      } else problems.push("site feed");

      if (tj?.tweets) {
        for (const t of tj.tweets as Array<{ id: string; text: string; createdAt: string; url: string; isRetweet: boolean; image?: string }>) {
          if (!t.text) continue;
          merged.push({
            kind: "tweet",
            title: t.isRetweet ? t.text : t.text,
            date: fmtTweetDate(t.createdAt),
            sortKey: t.createdAt ? Date.parse(t.createdAt) : 0,
            url: t.url,
            image: t.image,
          });
        }
      } else problems.push("X feed");

      merged.sort((a, b) => b.sortKey - a.sortKey);
      setItems(merged);
      if (problems.length > 0) setWarning(`Couldn't load the ${problems.join(" and ")} right now.`);
    });
  }, []);

  const visible = useMemo(
    () => (items ?? []).filter((it) => filter === "all" || it.kind === filter),
    [items, filter],
  );

  return (
    <PageShell
      eyebrow="Updates"
      title="Latest from Pharos"
      subtitle="Official announcements, blog posts and live tweets from @pharos_network — everything in one timeline."
      accent="#a78bfa"
    >
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {([
          { id: "all", label: "All" },
          { id: "tweet", label: "X / Twitter" },
          { id: "news", label: "News" },
          { id: "blog", label: "Blog" },
        ] as const).map((f) => {
          const active = filter === f.id;
          const color = f.id === "all" ? "#00d4ff" : KIND_META[f.id].color;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: active ? `${color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? `${color}45` : "rgba(255,255,255,0.07)"}`,
                color: active ? color : "rgba(148,163,184,0.7)",
              }}>
              {f.label}
            </button>
          );
        })}
        <a href="https://x.com/pharos_network" target="_blank" rel="noopener noreferrer"
          className="ml-auto px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(226,232,240,0.7)" }}>
          Follow @pharos_network ↗
        </a>
      </div>

      {warning && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 mb-6">
          {warning} Try again in a minute or visit{" "}
          <a href="https://x.com/pharos_network" target="_blank" rel="noopener noreferrer" className="underline">x.com/pharos_network</a>.
        </div>
      )}

      {!items && (
        <div className="py-20 flex justify-center">
          <span className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: "rgba(167,139,250,0.5)", borderTopColor: "transparent" }} />
        </div>
      )}

      {/* Timeline */}
      <div className="relative pl-6">
        <span className="absolute left-[7px] top-2 bottom-2 w-px"
          style={{ background: "linear-gradient(180deg, rgba(0,212,255,0.3), rgba(167,139,250,0.15), transparent)" }} />

        <div className="space-y-3">
          {visible.map((it, i) => {
            const meta = KIND_META[it.kind];
            return (
              <a key={`${it.kind}-${i}`} href={it.url} target="_blank" rel="noopener noreferrer"
                className="group relative block p-4 rounded-2xl transition-all duration-200"
                style={{
                  background: "rgba(6,12,28,0.75)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  animation: `cardAppear 0.4s cubic-bezier(0.22,1,0.36,1) ${Math.min(i * 0.03, 0.4)}s both`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${meta.color}35`;
                  e.currentTarget.style.transform = "translateX(3px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                  e.currentTarget.style.transform = "";
                }}>
                {/* Timeline dot */}
                <span className="absolute -left-[23px] top-5 w-2.5 h-2.5 rounded-full"
                  style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}80`, border: "2px solid #060c1e" }} />

                <div className="flex items-center gap-2 mb-1.5">
                  {it.kind === "tweet" && (
                    <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="currentColor" style={{ color: meta.color }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}30`, color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.45)" }}>{it.date}</span>
                </div>

                <p className="text-sm font-medium text-white leading-relaxed group-hover:text-cyan-100 transition-colors whitespace-pre-line">
                  {it.title}
                </p>

                {it.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" loading="lazy"
                    className="mt-3 rounded-xl max-h-64 w-auto object-cover"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
                )}
              </a>
            );
          })}
        </div>
      </div>

      {items && visible.length === 0 && (
        <p className="text-sm py-16 text-center" style={{ color: "rgba(148,163,184,0.5)" }}>
          Nothing in this filter.
        </p>
      )}
    </PageShell>
  );
}
