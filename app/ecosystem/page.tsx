"use client";

// Ecosystem directory — all 40+ Pharos dApps, filterable by category,
// powered by the same curated data the AI agent uses.

import { useMemo, useState } from "react";
import PageShell from "@/components/PageShell";
import { ECOSYSTEM_DAPPS } from "@/lib/knowledge";

const CATEGORY_COLORS: Record<string, string> = {
  "DEX & Trading": "#00d4ff",
  "RWA": "#34d399",
  "Lending & Yield": "#a78bfa",
  "Bridges": "#818cf8",
  "Stablecoins & Payments": "#38bdf8",
  "Wallets & Custody": "#fbbf24",
  "Oracles, RPC & Infra": "#f472b6",
  "Security & Compliance": "#fb7185",
  "Identity, NFT & Community": "#6ee7b7",
};

export default function EcosystemPage() {
  const categories = Object.keys(ECOSYSTEM_DAPPS);
  const [selected, setSelected] = useState<string>("All");
  const [query, setQuery] = useState("");

  const totalCount = useMemo(
    () => categories.reduce((n, c) => n + ECOSYSTEM_DAPPS[c].length, 0),
    [categories],
  );

  const visible = useMemo(() => {
    const cats = selected === "All" ? categories : [selected];
    const q = query.trim().toLowerCase();
    return cats
      .map((cat) => ({
        cat,
        dapps: ECOSYSTEM_DAPPS[cat].filter(
          (d) => !q || d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.dapps.length > 0);
  }, [selected, query, categories]);

  return (
    <PageShell
      eyebrow="Ecosystem"
      title="Everything built on Pharos"
      subtitle={`${totalCount} curated dApps and infrastructure projects across ${categories.length} categories — the same directory the AI agent knows by heart.`}
      wide
    >
      {/* Search + filter pills */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="relative max-w-sm">
          <svg viewBox="0 0 24 24" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" fill="none"
            stroke="rgba(148,163,184,0.5)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dApps…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white outline-none transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {["All", ...categories].map((cat) => {
            const active = selected === cat;
            const color = cat === "All" ? "#00d4ff" : CATEGORY_COLORS[cat] ?? "#00d4ff";
            return (
              <button key={cat} onClick={() => setSelected(cat)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
                style={{
                  background: active ? `${color}18` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? `${color}45` : "rgba(255,255,255,0.07)"}`,
                  color: active ? color : "rgba(148,163,184,0.7)",
                }}>
                {cat}
                {cat !== "All" && (
                  <span className="ml-1.5 opacity-60">{ECOSYSTEM_DAPPS[cat].length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grouped dApp cards */}
      {visible.length === 0 ? (
        <p className="text-sm py-16 text-center" style={{ color: "rgba(148,163,184,0.5)" }}>
          No dApps match “{query}”.
        </p>
      ) : (
        <div className="space-y-10">
          {visible.map(({ cat, dapps }) => {
            const color = CATEGORY_COLORS[cat] ?? "#00d4ff";
            return (
              <section key={cat}>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}80` }} />
                  <h2 className="text-sm font-bold tracking-[-0.01em] text-white"
                    style={{ fontFamily: "var(--font-display), var(--font-inter), sans-serif" }}>
                    {cat}
                  </h2>
                  <span className="text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>{dapps.length} projects</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {dapps.map((d, i) => (
                    <a key={d.name} href={d.url} target="_blank" rel="noopener noreferrer"
                      className="group p-4 rounded-2xl transition-all duration-200"
                      style={{
                        background: "rgba(6,12,28,0.7)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        animation: `cardAppear 0.4s cubic-bezier(0.22,1,0.36,1) ${Math.min(i * 0.04, 0.4)}s both`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${color}35`;
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = `0 8px 30px ${color}12`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                        e.currentTarget.style.transform = "";
                        e.currentTarget.style.boxShadow = "";
                      }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: `${color}14`, border: `1px solid ${color}28`, color }}>
                            {d.name[0]}
                          </span>
                          <span className="text-sm font-semibold text-white tracking-[-0.01em]">{d.name}</span>
                        </div>
                        <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }}>↗</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "rgba(148,163,184,0.6)" }}>{d.desc}</p>
                    </a>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Ask-the-agent CTA */}
      <div className="mt-14 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.14)" }}>
        <div>
          <p className="text-sm font-semibold text-white mb-1">Want details on any project?</p>
          <p className="text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
            The agent knows every dApp here — ask “what is R25?” or “compare Faroswap and OKU”.
          </p>
        </div>
        <a href="/chat" className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold text-black transition-transform hover:scale-105"
          style={{ background: "linear-gradient(135deg, #00d4ff, #38bdf8)", boxShadow: "0 4px 16px rgba(0,212,255,0.3)" }}>
          Ask the Agent →
        </a>
      </div>
    </PageShell>
  );
}
