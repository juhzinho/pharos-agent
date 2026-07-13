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

  // Chat: agent welcome message (shown before the first user message)
  "chat.welcome": {
    en: "Hi! I'm **ProsPilot** — an independent, community-built DeFi copilot for the Pharos ecosystem (Chain ID 1672).\n\n_Not an official Pharos Network product._\n\nConnect your wallet and I'll help you:\n• **Swap** tokens via FaroSwap, OKX DEX or LI.FI\n• **Bridge** to Ethereum, Base, Arbitrum, Polygon via CCIP or Circle CCTP v2\n• **Add / remove liquidity** in FaroSwap V3 concentrated pools\n• **Stake PROS** → stPROS via Faroo liquid staking\n• **Answer any question** about the Pharos ecosystem, protocols, RWA, gas, contracts and more\n\nYou can write in any language. Let's go!",
    pt: "Oi! Eu sou o **ProsPilot** — copiloto DeFi com IA, feito pela comunidade para o ecossistema Pharos (Chain ID 1672).\n\n_Não é um produto oficial da Pharos Network._\n\nConecte sua carteira e eu te ajudo a:\n• **Trocar** tokens via FaroSwap, OKX DEX ou LI.FI\n• **Fazer bridge** para Ethereum, Base, Arbitrum, Polygon via CCIP ou Circle CCTP v2\n• **Adicionar / remover liquidez** nos pools concentrados do FaroSwap V3\n• **Stake de PROS** → stPROS via liquid staking da Faroo\n• **Responder qualquer pergunta** sobre o ecossistema Pharos, protocolos, RWA, gas, contratos e mais\n\nVocê pode escrever em qualquer idioma. Vamos lá!",
    es: "¡Hola! Soy **ProsPilot** — tu copiloto DeFi con IA en Pharos Network (Chain ID 1672).\n\nConecta tu cartera y te ayudo a:\n• **Intercambiar** tokens vía FaroSwap, OKX DEX o LI.FI\n• **Hacer bridge** a Ethereum, Base, Arbitrum, Polygon vía CCIP o Circle CCTP v2\n• **Añadir / retirar liquidez** en los pools concentrados de FaroSwap V3\n• **Stake de PROS** → stPROS vía liquid staking de Faroo\n• **Responder cualquier pregunta** sobre el ecosistema Pharos, protocolos, RWA, gas, contratos y más\n\nPuedes escribir en cualquier idioma. ¡Vamos!",
    ru: "Привет! Я **ProsPilot** — ваш ИИ-копилот DeFi в сети Pharos (Chain ID 1672).\n\nПодключите кошелёк, и я помогу вам:\n• **Обменивать** токены через FaroSwap, OKX DEX или LI.FI\n• **Делать бридж** в Ethereum, Base, Arbitrum, Polygon через CCIP или Circle CCTP v2\n• **Добавлять / выводить ликвидность** в концентрированных пулах FaroSwap V3\n• **Стейкать PROS** → stPROS через ликвидный стейкинг Faroo\n• **Отвечать на любые вопросы** об экосистеме Pharos, протоколах, RWA, газе, контрактах и не только\n\nПишите на любом языке. Поехали!",
    zh: "你好！我是 **ProsPilot** — 你在 Pharos 网络（Chain ID 1672）上的 AI DeFi 副驾驶。\n\n连接钱包后，我可以帮你：\n• 通过 FaroSwap、OKX DEX 或 LI.FI **兑换**代币\n• 通过 CCIP 或 Circle CCTP v2 **跨链**到 Ethereum、Base、Arbitrum、Polygon\n• 在 FaroSwap V3 集中流动性池中**添加 / 移除流动性**\n• 通过 Faroo 流动性质押 **质押 PROS** → stPROS\n• **回答任何问题**：Pharos 生态、协议、RWA、gas、合约等\n\n你可以用任何语言交流。开始吧！",
    ja: "こんにちは！私は **ProsPilot** — Pharos Network（Chain ID 1672）のAI DeFiコパイロットです。\n\nウォレットを接続すると、こんなお手伝いができます：\n• FaroSwap、OKX DEX、LI.FI でトークンを**スワップ**\n• CCIP または Circle CCTP v2 で Ethereum、Base、Arbitrum、Polygon へ**ブリッジ**\n• FaroSwap V3 の集中流動性プールに**流動性を追加 / 削除**\n• Faroo のリキッドステーキングで **PROS をステーク** → stPROS\n• Pharos エコシステム、プロトコル、RWA、ガス、コントラクトなど**どんな質問にも回答**\n\nどの言語でも話せます。始めましょう！",
    ar: "مرحباً! أنا **ProsPilot** — مساعدك الذكي في DeFi على شبكة Pharos (Chain ID 1672).\n\nاربط محفظتك وسأساعدك في:\n• **مبادلة** الرموز عبر FaroSwap أو OKX DEX أو LI.FI\n• **الجسر** إلى Ethereum وBase وArbitrum وPolygon عبر CCIP أو Circle CCTP v2\n• **إضافة / إزالة السيولة** في مجمعات FaroSwap V3 المركزة\n• **رهن PROS** → stPROS عبر الرهن السائل من Faroo\n• **الإجابة على أي سؤال** عن نظام Pharos البيئي والبروتوكولات وRWA والغاز والعقود والمزيد\n\nيمكنك الكتابة بأي لغة. هيا بنا!",
  },

  // Chat: welcome cards
  "chat.card.swap.title":   { en: "Swap tokens", pt: "Trocar tokens", es: "Intercambiar tokens", ru: "Обмен токенов", zh: "兑换代币", ja: "トークンをスワップ", ar: "مبادلة الرموز" },
  "chat.card.swap.desc":    { en: "Guided flow: pick a token from your balance, choose the amount and compare quotes.", pt: "Fluxo guiado: escolha um token do seu saldo, defina o valor e compare cotações.", es: "Flujo guiado: elige un token de tu saldo, define el monto y compara cotizaciones.", ru: "Пошаговый процесс: выберите токен из баланса, укажите сумму и сравните котировки.", zh: "引导式流程：从余额中选择代币、设置数量并比较报价。", ja: "ガイド付きフロー：残高からトークンを選び、数量を決めて見積もりを比較。", ar: "تدفق موجّه: اختر رمزاً من رصيدك وحدد المبلغ وقارن الأسعار." },
  "chat.card.bridge.title": { en: "Cross-chain bridge", pt: "Bridge entre redes", es: "Bridge entre cadenas", ru: "Кроссчейн-бридж", zh: "跨链桥", ja: "クロスチェーンブリッジ", ar: "جسر عبر السلاسل" },
  "chat.card.bridge.desc":  { en: "Move assets to Ethereum, Base, Arbitrum — routes compared for the best return.", pt: "Mova ativos para Ethereum, Base, Arbitrum — rotas comparadas para o melhor retorno.", es: "Mueve activos a Ethereum, Base, Arbitrum — rutas comparadas para el mejor retorno.", ru: "Переводите активы в Ethereum, Base, Arbitrum — маршруты сравниваются для лучшей отдачи.", zh: "将资产转移到 Ethereum、Base、Arbitrum — 自动比较路线以获得最佳回报。", ja: "Ethereum、Base、Arbitrum へ資産を移動 — 最良のレートでルートを比較。", ar: "انقل الأصول إلى Ethereum وBase وArbitrum — تُقارن المسارات لأفضل عائد." },
  "chat.card.liq.title":    { en: "FaroSwap Liquidity", pt: "Liquidez FaroSwap", es: "Liquidez FaroSwap", ru: "Ликвидность FaroSwap", zh: "FaroSwap 流动性", ja: "FaroSwap 流動性", ar: "سيولة FaroSwap" },
  "chat.card.liq.desc":     { en: "Add V3 concentrated liquidity: pick pair, fee tier, range and amount.", pt: "Adicione liquidez concentrada V3: escolha par, taxa, range e valor.", es: "Añade liquidez concentrada V3: elige par, comisión, rango y monto.", ru: "Добавьте концентрированную ликвидность V3: пара, комиссия, диапазон и сумма.", zh: "添加 V3 集中流动性：选择交易对、费率、区间和数量。", ja: "V3集中流動性を追加：ペア、手数料、レンジ、数量を選択。", ar: "أضف سيولة مركزة V3: اختر الزوج والرسوم والنطاق والمبلغ." },
  "chat.card.expert.title": { en: "Pharos Expert", pt: "Especialista Pharos", es: "Experto en Pharos", ru: "Эксперт по Pharos", zh: "Pharos 专家", ja: "Pharos エキスパート", ar: "خبير Pharos" },
  "chat.card.expert.desc":  { en: "Deep knowledge of every protocol, RWA, DeFi, architecture, and latest news.", pt: "Conhecimento profundo de todos os protocolos, RWA, DeFi, arquitetura e notícias.", es: "Conocimiento profundo de cada protocolo, RWA, DeFi, arquitectura y noticias.", ru: "Глубокие знания о каждом протоколе, RWA, DeFi, архитектуре и новостях.", zh: "深入了解每个协议、RWA、DeFi、架构和最新资讯。", ja: "全プロトコル、RWA、DeFi、アーキテクチャ、最新ニュースを熟知。", ar: "معرفة عميقة بكل بروتوكول وRWA وDeFi والبنية وآخر الأخبار." },
};

// Quick-action / suggestion-chip labels: translated by their English label so
// the arrays in the chat page stay untouched. Unknown labels pass through.
const CHIP_LABELS: Record<string, Partial<Record<SiteLang, string>>> = {
  "Swap PROS → USDC":   { pt: "Swap PROS → USDC", es: "Swap PROS → USDC", ru: "Своп PROS → USDC", zh: "PROS → USDC 兑换", ja: "PROS → USDC スワップ", ar: "مبادلة PROS → USDC" },
  "Bridge to Base":     { pt: "Bridge para Base", es: "Bridge a Base", ru: "Бридж в Base", zh: "跨链到 Base", ja: "Base へブリッジ", ar: "جسر إلى Base" },
  "Add Liquidity":      { pt: "Adicionar Liquidez", es: "Añadir Liquidez", ru: "Добавить ликвидность", zh: "添加流动性", ja: "流動性を追加", ar: "إضافة سيولة" },
  "Stake PROS":         { pt: "Stake de PROS", es: "Stake de PROS", ru: "Стейкинг PROS", zh: "质押 PROS", ja: "PROS をステーク", ar: "رهن PROS" },
  "Unstake stPROS":     { pt: "Unstake stPROS", es: "Unstake stPROS", ru: "Анстейк stPROS", zh: "解押 stPROS", ja: "stPROS をアンステーク", ar: "إلغاء رهن stPROS" },
  "My Staking":         { pt: "Meu Staking", es: "Mi Staking", ru: "Мой стейкинг", zh: "我的质押", ja: "マイステーキング", ar: "رهني" },
  "RWA Market":         { pt: "Mercado RWA", es: "Mercado RWA", ru: "Рынок RWA", zh: "RWA 市场", ja: "RWA 市場", ar: "سوق RWA" },
  "RWA Market (live)":  { pt: "Mercado RWA (ao vivo)", es: "Mercado RWA (en vivo)", ru: "Рынок RWA (live)", zh: "RWA 市场（实时）", ja: "RWA 市場（ライブ）", ar: "سوق RWA (مباشر)" },
  "My Positions":       { pt: "Minhas Posições", es: "Mis Posiciones", ru: "Мои позиции", zh: "我的仓位", ja: "マイポジション", ar: "مراكزي" },
  "My LP Positions":    { pt: "Minhas Posições LP", es: "Mis Posiciones LP", ru: "Мои LP-позиции", zh: "我的 LP 仓位", ja: "マイLPポジション", ar: "مراكز LP الخاصة بي" },
  "Wallet Analysis":    { pt: "Análise da Carteira", es: "Análisis de Cartera", ru: "Анализ кошелька", zh: "钱包分析", ja: "ウォレット分析", ar: "تحليل المحفظة" },
  "Wallet Score":       { pt: "Score da Carteira", es: "Score de Cartera", ru: "Рейтинг кошелька", zh: "钱包评分", ja: "ウォレットスコア", ar: "تقييم المحفظة" },
  "Tx History":         { pt: "Histórico de Txs", es: "Historial de Txs", ru: "История транзакций", zh: "交易历史", ja: "取引履歴", ar: "سجل المعاملات" },
  "RealFi Positions":   { pt: "Posições RealFi", es: "Posiciones RealFi", ru: "Позиции RealFi", zh: "RealFi 仓位", ja: "RealFi ポジション", ar: "مراكز RealFi" },
  "What is Pharos?":    { pt: "O que é a Pharos?", es: "¿Qué es Pharos?", ru: "Что такое Pharos?", zh: "什么是 Pharos？", ja: "Pharosとは？", ar: "ما هي Pharos؟" },
  "DeFi Protocols":     { pt: "Protocolos DeFi", es: "Protocolos DeFi", ru: "DeFi-протоколы", zh: "DeFi 协议", ja: "DeFiプロトコル", ar: "بروتوكولات DeFi" },
  "Pharos Protocols":   { pt: "Protocolos Pharos", es: "Protocolos Pharos", ru: "Протоколы Pharos", zh: "Pharos 协议", ja: "Pharosプロトコル", ar: "بروتوكولات Pharos" },
  "Swap tokens":        { pt: "Trocar tokens", es: "Intercambiar tokens", ru: "Обмен токенов", zh: "兑换代币", ja: "トークンをスワップ", ar: "مبادلة الرموز" },
  "Bridge cross-chain": { pt: "Bridge entre redes", es: "Bridge entre cadenas", ru: "Кроссчейн-бридж", zh: "跨链桥", ja: "クロスチェーンブリッジ", ar: "جسر عبر السلاسل" },
};

export function chipT(label: string, lang: SiteLang): string {
  if (lang === "en") return label;
  return CHIP_LABELS[label]?.[lang] ?? label;
}

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
