"use client";

// Campaign tracker — live campaigns from the official Pharos Port API,
// with status (active / upcoming / ended) computed client-side.

import { useEffect, useMemo, useState } from "react";
import PageShell from "@/components/PageShell";

interface Campaign {
  name: string;
  startTime: string;
  endTime: string;
  url: string;
  kind: "rewards" | "eco";
}

type Status = "active" | "upcoming" | "ended";

function statusOf(c: Campaign): Status {
  const now = Date.now();
  const start = Date.parse(c.startTime);
  const end = Date.parse(c.endTime);
  if (!Number.isNaN(start) && now < start) return "upcoming";
  if (!Number.isNaN(end) && now > end) return "ended";
  return "active";
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  active: { label: "Active", color: "#34d399" },
  upcoming: { label: "Upcoming", color: "#fbbf24" },
  ended: { label: "Ended", color: "#64748b" },
};

function fmtDate(s: string): string {
  const d = Date.parse(s);
  if (Number.isNaN(d)) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysLeft(c: Campaign): string | null {
  const end = Date.parse(c.endTime);
  if (Number.isNaN(end)) return null;
  const days = Math.ceil((end - Date.now()) / 86_400_000);
  if (days <= 0) return null;
  return days === 1 ? "1 day left" : `${days} days left`;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setCampaigns(j.campaigns ?? []);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const groups = useMemo(() => {
    const list = (campaigns ?? []).map((c) => ({ ...c, status: statusOf(c) }));
    const filtered = filter === "all" ? list : list.filter((c) => c.status === filter);
    // Active first, then upcoming, then ended
    const order: Status[] = ["active", "upcoming", "ended"];
    return filtered.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  }, [campaigns, filter]);

  const counts = useMemo(() => {
    const list = (campaigns ?? []).map(statusOf);
    return {
      all: list.length,
      active: list.filter((s) => s === "active").length,
      upcoming: list.filter((s) => s === "upcoming").length,
      ended: list.filter((s) => s === "ended").length,
    };
  }, [campaigns]);

  return (
    <PageShell
      eyebrow="Campaigns"
      title="Pharos campaign tracker"
      subtitle="Every official reward and ecosystem campaign, live from Pharos Port — so you never miss a deadline."
      accent="#fbbf24"
    >
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-7">
        {(["all", "active", "upcoming", "ended"] as const).map((f) => {
          const active = filter === f;
          const color = f === "all" ? "#00d4ff" : STATUS_META[f].color;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all"
              style={{
                background: active ? `${color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? `${color}45` : "rgba(255,255,255,0.07)"}`,
                color: active ? color : "rgba(148,163,184,0.7)",
              }}>
              {f} <span className="opacity-60 ml-1">{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-6">
          Couldn&apos;t reach the Port API: {error}. Check{" "}
          <a href="https://port.pharos.xyz" target="_blank" rel="noopener noreferrer" className="underline">port.pharos.xyz</a> directly.
        </div>
      )}

      {!campaigns && !error && (
        <div className="py-20 flex justify-center">
          <span className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: "rgba(251,191,36,0.5)", borderTopColor: "transparent" }} />
        </div>
      )}

      {campaigns && groups.length === 0 && (
        <p className="text-sm py-16 text-center" style={{ color: "rgba(148,163,184,0.5)" }}>
          No campaigns in this filter.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {groups.map((c, i) => {
          const meta = STATUS_META[c.status];
          const left = c.status === "active" ? daysLeft(c) : null;
          return (
            <a key={`${c.name}-${i}`} href={c.url} target="_blank" rel="noopener noreferrer"
              className="group p-5 rounded-2xl transition-all duration-200 relative overflow-hidden"
              style={{
                background: "rgba(6,12,28,0.75)",
                border: "1px solid rgba(255,255,255,0.07)",
                opacity: c.status === "ended" ? 0.55 : 1,
                animation: `cardAppear 0.4s cubic-bezier(0.22,1,0.36,1) ${Math.min(i * 0.05, 0.5)}s both`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${meta.color}40`;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                e.currentTarget.style.transform = "";
              }}>
              {/* Accent bar */}
              <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: meta.color, opacity: 0.7 }} />

              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                  style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}30`, color: meta.color }}>
                  {meta.label}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.55)" }}>
                  {c.kind === "rewards" ? "Rewards" : "Ecosystem"}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white mb-2 leading-snug group-hover:text-cyan-200 transition-colors">
                {c.name}
              </h3>

              <div className="flex items-center justify-between text-xs" style={{ color: "rgba(148,163,184,0.5)" }}>
                <span>{fmtDate(c.startTime)} → {fmtDate(c.endTime)}</span>
                {left && <span className="font-semibold" style={{ color: meta.color }}>{left}</span>}
              </div>
            </a>
          );
        })}
      </div>
    </PageShell>
  );
}
