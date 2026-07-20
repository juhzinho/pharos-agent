"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, useSiteLang } from "@/lib/i18n";

export const SITE_NAV = [
  { key: "nav.wallet",    href: "/wallet",    icon: "◉" },
  { key: "nav.ecosystem", href: "/ecosystem", icon: "◫" },
  { key: "nav.trade",     href: "/trade",     icon: "⇈" },
  { key: "nav.campaigns", href: "/campaigns", icon: "★" },
  { key: "nav.news",      href: "/news",      icon: "▤" },
  { key: "nav.network",   href: "/network",   icon: "⬡" },
  { key: "nav.guide",     href: "/guide",     icon: "◇" },
] as const;

/** Horizontal pill strip — header / mobile. */
export function SiteNavPills({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [lang] = useSiteLang();

  return (
    <nav className={`flex items-center gap-1 overflow-x-auto ${className}`} style={{ scrollbarWidth: "none" }}>
      {SITE_NAV.map(({ key, href }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`chat-nav-pill shrink-0 ${active ? "chat-nav-pill-active" : ""}`}
          >
            {t(key, lang)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Sidebar rows — same destinations as the main navbar. */
export function SiteNavSidebar({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [lang] = useSiteLang();

  return (
    <div className={`space-y-0.5 ${className}`}>
      {SITE_NAV.map(({ key, href, icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`sidebar-item ${active ? "sidebar-item-active" : ""}`}
          >
            <span className="sidebar-item-icon w-7 h-7 rounded-lg flex items-center justify-center text-xs">{icon}</span>
            <span className="sidebar-item-text">{t(key, lang)}</span>
          </Link>
        );
      })}
    </div>
  );
}
