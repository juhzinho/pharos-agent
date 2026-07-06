"use client";

// Language switcher (navbar) — 7 UI languages, persisted globally (lib/i18n).
// The AI agent itself already answers in any language; this controls the
// site's fixed UI strings.

import { useEffect, useRef, useState } from "react";
import { SITE_LANGS, useSiteLang } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const [lang, setLang] = useSiteLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = SITE_LANGS.find((l) => l.id === lang) ?? SITE_LANGS[0];

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(0,212,255,0.22)",
          color: "rgba(226,232,240,0.85)",
        }}
        title="Change language"
        aria-label="Change language"
      >
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M2.5 10h15M10 2.5c2.2 2 3.2 4.6 3.2 7.5s-1 5.5-3.2 7.5c-2.2-2-3.2-4.6-3.2-7.5s1-5.5 3.2-7.5z" />
        </svg>
        <span className="hidden sm:inline uppercase">{current.id}</span>
        <svg viewBox="0 0 10 6" className={`w-2 h-2 transition-transform ${open ? "rotate-180" : ""}`} fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl overflow-hidden z-50"
          style={{
            background: "rgba(6,12,28,0.97)",
            border: "1px solid rgba(0,212,255,0.22)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}>
          <div className="p-2 flex flex-col gap-0.5">
            {SITE_LANGS.map((l) => {
              const active = l.id === lang;
              return (
                <button key={l.id}
                  onClick={() => { setLang(l.id); setOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-all duration-150"
                  style={{
                    background: active ? "rgba(0,212,255,0.09)" : "transparent",
                    border: `1px solid ${active ? "rgba(0,212,255,0.25)" : "transparent"}`,
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                  <span className="text-base leading-none">{l.flag}</span>
                  <span className="flex-1 text-sm font-medium text-white">{l.label}</span>
                  {active && <span className="text-xs font-bold" style={{ color: "#00d4ff" }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
