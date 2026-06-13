"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadThreads, getActiveId, setActiveId, createThread, deleteThread,
  THREADS_EVENT, type ThreadMeta,
} from "./threadStore";

// Visual-only thread sidebar. Persists thread metadata (id/title/createdAt) via
// threadStore — never messages or tx state. "New chat" and switching threads
// reload to the welcome state (same as a fresh load), so no stale tx can resurface.

const SIDEBAR_OPEN_KEY = "pharos-sidebar-open";

function Icon({ d, className = "w-3.5 h-3.5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function ThreadSidebar() {
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [activeId, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const refresh = useCallback(() => {
    setThreads(loadThreads());
    setActive(getActiveId());
  }, []);

  useEffect(() => {
    // Initial open state: persisted pref, else open on desktop / closed on mobile.
    const pref = localStorage.getItem(SIDEBAR_OPEN_KEY);
    setOpen(pref !== null ? pref === "1" : window.innerWidth >= 768);
    refresh();
    const onChange = () => refresh();
    window.addEventListener(THREADS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(THREADS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const toggle = () => setOpen((o) => { localStorage.setItem(SIDEBAR_OPEN_KEY, o ? "0" : "1"); return !o; });

  const handleNew = () => {
    createThread();
    window.location.reload(); // fresh welcome state — no message/tx carryover
  };

  const handleSelect = (id: string) => {
    if (id === activeId) { setOpen(false); return; }
    setActiveId(id);
    window.location.reload();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteThread(id);
    if (id === activeId) window.location.reload();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 md:hidden" style={{ background: "oklch(0.05 0.05 262 / 0.6)" }} onClick={() => setOpen(false)} />
      )}

      {/* Edge toggle tab — vertically centered, never collides with the navbar */}
      <button
        onClick={toggle}
        aria-label={open ? "Collapse sidebar" : "Open sidebar"}
        className="fixed top-1/2 -translate-y-1/2 z-50 h-12 w-6 flex items-center justify-center rounded-r-lg glass-panel transition-[left] duration-300 ease-out"
        style={{ left: open ? "18rem" : "0", color: "oklch(0.78 0.16 220 / 0.8)" }}
      >
        <Icon d={open ? "M10 4L6 8l4 4" : "M6 4l4 4-4 4"} className="w-3.5 h-3.5" />
      </button>

      {/* Sidebar panel — in-flow on desktop, overlay on mobile */}
      <aside
        className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-out z-40 max-md:fixed max-md:inset-y-0 max-md:left-0 ${open ? "w-72" : "w-0"}`}
      >
        <div className="glass-panel h-full w-72 flex flex-col" style={{ borderRight: "1px solid oklch(0.55 0.22 260 / 0.22)", borderRadius: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "oklch(0.55 0.22 260 / 0.18)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "radial-gradient(circle at 35% 35%, oklch(0.58 0.26 258 / 0.4), oklch(0.08 0.08 262 / 0.97))", border: "1px solid oklch(0.58 0.26 258 / 0.45)", boxShadow: "0 0 16px oklch(0.58 0.26 258 / 0.3)" }}>
              <svg viewBox="0 0 28 28" className="w-5 h-5" fill="none">
                <circle cx="14" cy="14" r="4" fill="oklch(0.78 0.16 220 / 0.9)" style={{ animation: "orbPulseEl 3s ease-in-out infinite" }} />
                <circle cx="14" cy="14" r="9" stroke="oklch(0.58 0.26 258 / 0.4)" strokeWidth="0.7" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate" style={{ fontFamily: "var(--font-display), sans-serif" }}>Pharos Agent</div>
              <div className="text-[10px]" style={{ color: "oklch(0.72 0.06 240 / 0.7)" }}>DeFi · RWA · TradFi</div>
            </div>
          </div>

          {/* New chat */}
          <button
            onClick={handleNew}
            className="mx-4 mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-150 hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, oklch(0.48 0.27 261), oklch(0.58 0.26 258))", boxShadow: "0 6px 20px -6px oklch(0.58 0.26 258 / 0.55)" }}
          >
            <Icon d="M8 3v10M3 8h10" className="w-4 h-4" /> New chat
          </button>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {threads.length === 0 ? (
              <p className="px-2 text-xs leading-relaxed" style={{ color: "oklch(0.72 0.06 240 / 0.55)" }}>
                No conversations yet. Threads are kept only in this browser.
              </p>
            ) : (
              <ul className="space-y-1">
                {threads.map((t) => {
                  const isActive = t.id === activeId;
                  return (
                    <li key={t.id}>
                      <div
                        onClick={() => handleSelect(t.id)}
                        className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors"
                        style={isActive
                          ? { background: "oklch(0.58 0.26 258 / 0.18)", border: "1px solid oklch(0.58 0.26 258 / 0.4)", color: "rgba(255,255,255,0.95)" }
                          : { border: "1px solid transparent", color: "oklch(0.72 0.06 240 / 0.8)" }}
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "oklch(0.20 0.14 264 / 0.5)"; }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                      >
                        <Icon d="M3 4h10v6H7l-3 2.5V10H3z" className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="truncate flex-1">{t.title}</span>
                        <button
                          onClick={(e) => handleDelete(t.id, e)}
                          aria-label="Delete conversation"
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          style={{ color: "oklch(0.72 0.06 240 / 0.6)" }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "oklch(0.62 0.24 25)")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "oklch(0.72 0.06 240 / 0.6)")}
                        >
                          <Icon d="M3 4h10M6.5 4V3h3v1M5 4l.5 9h5L11 4" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-5 py-3 text-[10px] leading-relaxed" style={{ borderColor: "oklch(0.55 0.22 260 / 0.18)", color: "oklch(0.72 0.06 240 / 0.45)" }}>
            Session only · history isn&apos;t restored when switching
          </div>
        </div>
      </aside>
    </>
  );
}
