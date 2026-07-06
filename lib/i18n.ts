// Site-wide UI language (7 languages). Persisted in localStorage and broadcast
// via a window event so every component stays in sync — same pattern as
// lib/network.ts. The AI agent itself already answers in ANY language the user
// writes; this controls the fixed UI strings (navbar, buttons, placeholders).

export type SiteLang = "en" | "pt" | "es" | "ru" | "zh" | "ja" | "ar";

export const SITE_LANGS: Array<{ id: SiteLang; label: string; flag: string }> = [
  { id: "en", label: "English",   flag: "🇺🇸" },
  { id: "pt", label: "Português", flag: "🇧🇷" },
  { id: "es", label: "Español",   flag: "🇪🇸" },
  { id: "ru", label: "Русский",   flag: "🇷🇺" },
  { id: "zh", label: "中文",       flag: "🇨🇳" },
  { id: "ja", label: "日本語",     flag: "🇯🇵" },
  { id: "ar", label: "العربية",   flag: "🇸🇦" },
];

const KEY = "pharos:site-lang";
export const LANG_EVENT = "pharos:lang-changed";

const VALID = new Set<string>(SITE_LANGS.map((l) => l.id));

export function getSiteLang(): SiteLang {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(KEY);
  if (v && VALID.has(v)) return v as SiteLang;
  // First visit: match the browser language when we support it.
  const nav = (window.navigator.language || "en").slice(0, 2).toLowerCase();
  return VALID.has(nav) ? (nav as SiteLang) : "en";
}

export function setSiteLang(lang: SiteLang): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: lang }));
}

export function onSiteLangChange(cb: (lang: SiteLang) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as SiteLang);
  window.addEventListener(LANG_EVENT, handler);
  return () => window.removeEventListener(LANG_EVENT, handler);
}

// ── UI dictionary ────────────────────────────────────────────────────────────

type Dict = Record<string, Record<SiteLang, string>>;

export const UI: Dict = {
  // Navbar
  "nav.chat":      { en: "Chat",      pt: "Chat",       es: "Chat",       ru: "Чат",        zh: "聊天",     ja: "チャット",   ar: "الدردشة" },
  "nav.wallet":    { en: "Wallet",    pt: "Carteira",   es: "Cartera",    ru: "Кошелёк",    zh: "钱包",     ja: "ウォレット", ar: "المحفظة" },
  "nav.ecosystem": { en: "Ecosystem", pt: "Ecossistema",es: "Ecosistema", ru: "Экосистема", zh: "生态系统", ja: "エコシステム", ar: "النظام البيئي" },
  "nav.trade":     { en: "Trade",     pt: "Trade",      es: "Trading",    ru: "Торговля",   zh: "交易",     ja: "取引",       ar: "التداول" },
  "nav.campaigns": { en: "Campaigns", pt: "Campanhas",  es: "Campañas",   ru: "Кампании",   zh: "活动",     ja: "キャンペーン", ar: "الحملات" },
  "nav.news":      { en: "News",      pt: "Notícias",   es: "Noticias",   ru: "Новости",    zh: "新闻",     ja: "ニュース",   ar: "الأخبار" },
  "nav.network":   { en: "Network",   pt: "Rede",       es: "Red",        ru: "Сеть",       zh: "网络",     ja: "ネットワーク", ar: "الشبكة" },
  "nav.guide":     { en: "Guide",     pt: "Guia",       es: "Guía",       ru: "Гид",        zh: "指南",     ja: "ガイド",     ar: "الدليل" },

  // Wallet buttons
  "wallet.connect":      { en: "Connect Wallet", pt: "Conectar Carteira", es: "Conectar Cartera", ru: "Подключить кошелёк", zh: "连接钱包", ja: "ウォレット接続", ar: "ربط المحفظة" },
  "wallet.connecting":   { en: "Connecting…",    pt: "Conectando…",       es: "Conectando…",      ru: "Подключение…",       zh: "连接中…",  ja: "接続中…",       ar: "جارٍ الاتصال…" },
  "wallet.launch":       { en: "Launch App →",   pt: "Abrir App →",       es: "Abrir App →",      ru: "Открыть →",          zh: "启动应用 →", ja: "アプリを開く →", ar: "فتح التطبيق ←" },
  "wallet.choose":       { en: "Choose wallet",  pt: "Escolha a carteira", es: "Elige la cartera", ru: "Выберите кошелёк",  zh: "选择钱包",  ja: "ウォレットを選択", ar: "اختر المحفظة" },
  "wallet.wrongNetwork": { en: "Wrong network",  pt: "Rede errada",       es: "Red incorrecta",   ru: "Неверная сеть",      zh: "网络错误",  ja: "ネットワーク違い", ar: "شبكة خاطئة" },
  "wallet.switch":       { en: "Switch to Pharos", pt: "Mudar para Pharos", es: "Cambiar a Pharos", ru: "Перейти на Pharos", zh: "切换到 Pharos", ja: "Pharosに切替", ar: "التبديل إلى Pharos" },

  // Chat: wallet gate
  "gate.title": {
    en: "Connect your wallet to use the agent",
    pt: "Conecte sua carteira para usar o agente",
    es: "Conecta tu cartera para usar el agente",
    ru: "Подключите кошелёк, чтобы использовать агента",
    zh: "连接钱包以使用智能助手",
    ja: "エージェントを使うにはウォレットを接続してください",
    ar: "اربط محفظتك لاستخدام الوكيل",
  },
  "gate.subtitle": {
    en: "I only read your public address — I never ask for your seed phrase",
    pt: "Só leio seu endereço público — nunca peço a seed phrase",
    es: "Solo leo tu dirección pública — nunca pido tu frase semilla",
    ru: "Я читаю только ваш публичный адрес — никогда не спрашиваю seed-фразу",
    zh: "只读取您的公开地址 — 绝不索要助记词",
    ja: "公開アドレスのみ読み取ります — シードフレーズは絶対に要求しません",
    ar: "أقرأ عنوانك العام فقط — لا أطلب عبارة الاسترداد أبدًا",
  },

  // Chat: composer
  "chat.placeholder": {
    en: "Swap, bridge, add liquidity, or ask anything about Pharos…",
    pt: "Swap, bridge, add liquidity, ou pergunte qualquer coisa sobre Pharos…",
    es: "Swap, bridge, liquidez, o pregunta lo que sea sobre Pharos…",
    ru: "Свап, бридж, ликвидность — или спросите что угодно о Pharos…",
    zh: "兑换、跨链、添加流动性，或询问关于 Pharos 的任何问题…",
    ja: "スワップ、ブリッジ、流動性追加、Pharosについて何でも質問…",
    ar: "مبادلة، جسر، إضافة سيولة، أو اسأل أي شيء عن Pharos…",
  },
  "chat.footer": {
    en: "Pharos Mainnet · Chain ID 1672 · Non-custodial · Shift+Enter new line",
    pt: "Pharos Mainnet · Chain ID 1672 · Non-custodial · Shift+Enter nova linha",
    es: "Pharos Mainnet · Chain ID 1672 · Sin custodia · Shift+Enter nueva línea",
    ru: "Pharos Mainnet · Chain ID 1672 · Некастодиальный · Shift+Enter — новая строка",
    zh: "Pharos 主网 · Chain ID 1672 · 非托管 · Shift+Enter 换行",
    ja: "Pharos メインネット · Chain ID 1672 · ノンカストディアル · Shift+Enterで改行",
    ar: "شبكة Pharos الرئيسية · Chain ID 1672 · غير وصائي · Shift+Enter سطر جديد",
  },
  "chat.home":    { en: "Home",     pt: "Início",       es: "Inicio",       ru: "Главная",   zh: "首页",   ja: "ホーム",     ar: "الرئيسية" },
  "chat.newChat": { en: "New chat", pt: "Novo chat",    es: "Nuevo chat",   ru: "Новый чат", zh: "新对话", ja: "新しいチャット", ar: "محادثة جديدة" },
};

export function t(key: string, lang: SiteLang): string {
  return UI[key]?.[lang] ?? UI[key]?.en ?? key;
}

// React hook — lives here so components only need one import.
import { useEffect, useState } from "react";

export function useSiteLang(): [SiteLang, (l: SiteLang) => void] {
  const [lang, setLang] = useState<SiteLang>("en");
  useEffect(() => {
    setLang(getSiteLang());
    return onSiteLangChange(setLang);
  }, []);
  return [lang, setSiteLang];
}
