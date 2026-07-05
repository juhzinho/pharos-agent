"use client";

// Live news feed — scraped from pharos.xyz/resources via /api/news,
// rendered as a clean timeline with News / Blog filters.

import { useEffect, useMemo, useState } from "react";
import PageShell from "@/components/PageShell";

interface NewsItem {
  title: string;
  date: string;
  kind: "news" | "blog";
}

const KIND_META = {
  news: { label: "News", color: "#00d4ff" },
  blog: { label: "Blog", color: "#a78bfa" },
} as const;

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "news" | "blog">("all");

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setItems(j.items ?? []);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const visible = useMemo(
    () => (items ?? []).filter((it) => filter === "all" || it.kind === filter),
    [items, filter],
  );

  return (
    <PageShell
      eyebrow="Updates"
      title="Latest from Pharos"
      subtitle="Official announcements and blog posts, pulled live from pharos.xyz — the same feed the agent reads when you ask “any Pharos news?”."
      accent="#a78bfa"
    >
      {/* Filter pills */}
      <div className="flex gap-2 mb-8">
        {(["all", "news", "blog"] as const).map((f) => {
          const active = filter === f;
          const color = f === "all" ? "#00d4ff" : KIND_META[f].color;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all"
              style={{
                background: active ? `${color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? `${color}45` : "rgba(255,255,255,0.07)"}`,
                color: active ? color : "rgba(148,163,184,0.7)",
              }}>
              {f}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-6">
          Couldn&apos;t load the live feed: {error}. Visit{" "}
          <a href="https://www.pharos.xyz/resources" target="_blank" rel="noopener noreferrer" className="underline">pharos.xyz/resources</a>.
        </div>
      )}

      {!items && !error && (
        <div className="py-20 flex justify-center">
          <span className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: "rgba(167,139,250,0.5)", borderTopColor: "transparent" }} />
        </div>
      )}

      {/* Timeline */}
      <div className="relative pl-6">
        {/* Vertical line */}
        <span className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: "linear-gradient(180deg, rgba(0,212,255,0.3), rgba(167,139,250,0.15), transparent)" }} />

        <div className="space-y-3">
          {visible.map((it, i) => {
            const meta = KIND_META[it.kind];
            return (
              <a key={`${it.title}-${i}`} href="https://www.pharos.xyz/resources" target="_blank" rel="noopener noreferrer"
                className="group relative block p-4 rounded-2xl transition-all duration-200"
                style={{
                  background: "rgba(6,12,28,0.75)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  animation: `cardAppear 0.4s cubic-bezier(0.22,1,0.36,1) ${Math.min(i * 0.04, 0.5)}s both`,
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
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}30`, color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.45)" }}>{it.date}</span>
                </div>
                <p className="text-sm font-medium text-white leading-snug group-hover:text-cyan-100 transition-colors">
                  {it.title}
                </p>
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
