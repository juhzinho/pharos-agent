// Web3-wide link / phishing / scam scanner — static + redirect + HTML sniff + reputation.
// Read-only; probabilistic — always verify official channels independently.

export type { LinkCompareReport, LinkCompareVerdict, LinkScanBatchReport, LinkScanReport, LinkSeverity, LinkSignal, LinkVerdict } from "@/lib/link-scanner/types";

import {
  DRAINER_PATH_RE,
  PERMIT_SIGN_RE,
  SEED_PATH_RE,
  WEB3_BRAND_RE,
} from "@/lib/link-scanner/domains";
import {
  analyzeBrandImpersonation,
  detectImpersonatedBrands,
  detectTyposquat,
  discoverOfficialDomain,
  matchOfficial,
  normalizeHostname,
  searchWeb3Reputation,
  sniffPageContent,
} from "@/lib/link-scanner/analyze";
import type { LinkCompareReport, LinkCompareVerdict, LinkScanBatchReport, LinkScanReport, LinkSignal, LinkVerdict } from "@/lib/link-scanner/types";

const SUSPICIOUS_TLDS = new Set([
  "zip", "mov", "top", "vip", "click", "bond", "cfd", "sbs", "cam", "live", "rest", "tk", "ml", "ga", "cf", "icu", "lol", "monster",
]);

const SHORTENERS = new Set([
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "rb.gy", "short.link", "ow.ly", "is.gd", "cutt.ly", "rebrand.ly", "s.id", "v.gd",
]);

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const ETH_IN_URL_RE = /0x[a-fA-F0-9]{40}/;

function loadBlocklist(): Set<string> {
  const set = new Set<string>();
  for (const raw of (process.env.LINK_SCAM_BLOCKLIST ?? "").split(/[,;\s]+/)) {
    const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (d) set.add(d);
  }
  return set;
}

export function extractUrls(text: string): string[] {
  const raw = text.match(URL_RE) ?? [];
  return [...new Set(raw.map((u) => u.replace(/[.,;:!?)]+$/, "")))];
}

export function detectLinkScanQuery(text: string): { urls: string[] } | null {
  const trimmed = text.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) return { urls: [trimmed.replace(/[.,;:!?)]+$/, "")] };

  const urls = extractUrls(text);
  if (urls.length === 0) return null;

  const intentRe =
    /\b(scam|phish|phishing|golpe|link falso|fake link|malicious|malware|drainer|suspeito|suspicious|verificar link|check link|scan url|scan link|é seguro|e seguro|is this safe|safe link|link seguro|url segura|trust this link|confiar neste link|antiscam|anti-scam|site falso|dapp falso|fake dapp|telegram scam|discord scam)\b/i;
  if (intentRe.test(text)) return { urls };
  if (urls.length >= 1 && /\b(este link|this link|that link|esse link|o link|esta url|this url)\b/i.test(text)) return { urls };

  return null;
}

/** Two URLs + compare intent — suspicious vs official-from-Twitter. */
export function detectLinkCompareQuery(text: string): { suspicious: string; official: string } | null {
  const urls = extractUrls(text);
  if (urls.length < 2) return null;

  const compareRe =
    /\b(comparar|compare|versus|vs\.?|oficial|official|suspeito|suspicious|fake|falso|twitter|discord|link oficial|official link)\b/i;
  if (!compareRe.test(text)) return null;

  const clean = (u: string) => u.replace(/[.,;:!?)]+$/, "");

  const offLabeled = text.match(/(?:oficial|official|twitter|discord)[:\s]+(https?:\/\/\S+)/i);
  const susLabeled = text.match(/(?:suspeito|suspicious|fake|scam|falso|recebido|received|dm)[:\s]+(https?:\/\/\S+)/i);
  if (offLabeled && susLabeled) {
    return { official: clean(offLabeled[1]), suspicious: clean(susLabeled[1]) };
  }
  if (offLabeled && urls.length >= 2) {
    const official = clean(offLabeled[1]);
    const suspicious = urls.map(clean).find((u) => u !== official) ?? urls[0];
    return { suspicious, official };
  }
  if (susLabeled && urls.length >= 2) {
    const suspicious = clean(susLabeled[1]);
    const official = urls.map(clean).find((u) => u !== suspicious) ?? urls[1];
    return { suspicious, official };
  }

  // Default: first URL = suspicious (DM), second = official (from bio)
  return { suspicious: clean(urls[0]), official: clean(urls[1]) };
}

function registrableDomain(hostname: string): string {
  const parts = normalizeHostname(hostname).split(".");
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

async function resolveRedirectChain(inputUrl: string, maxHops = 10): Promise<string[]> {
  const chain: string[] = [inputUrl];
  let current = inputUrl;
  for (let i = 0; i < maxHops; i++) {
    try {
      const res = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(9000),
        headers: { "User-Agent": "ProsPilot-LinkScanner/2.0" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, current).href;
        if (chain.includes(next)) break;
        chain.push(next);
        current = next;
      } else break;
    } catch {
      break;
    }
  }
  return chain;
}

function pushUnique(signals: LinkSignal[], incoming: LinkSignal[]) {
  for (const s of incoming) {
    if (!signals.some((x) => x.id === s.id)) signals.push(s);
  }
}

function analyzeStatic(urlStr: string): {
  signals: LinkSignal[];
  hostname: string;
  normalizedUrl: string;
  officialMatch: string | null;
  typosquatOf: string | null;
  impersonatedBrands: string[];
} {
  const signals: LinkSignal[] = [];
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    signals.push({
      id: "invalid-url",
      severity: "critical",
      weight: 40,
      titleEn: "Invalid URL",
      titlePt: "URL inválida",
      detailEn: "Could not parse URL — may be malformed to hide the real destination.",
      detailPt: "Não foi possível analisar a URL — pode estar malformada para esconder o destino real.",
    });
    return { signals, hostname: "", normalizedUrl: urlStr, officialMatch: null, typosquatOf: null, impersonatedBrands: [] };
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = normalizeHostname(parsed.hostname);
  const normalizedUrl = parsed.href;
  const blocklist = loadBlocklist();
  const impersonatedBrands = detectImpersonatedBrands(hostname);

  if (blocklist.has(hostname)) {
    signals.push({
      id: "blocklist-hit",
      severity: "critical",
      weight: 50,
      titleEn: "Domain on scam blocklist",
      titlePt: "Domínio na blocklist de scam",
      detailEn: `Host \`${hostname}\` matches curated scam blocklist.`,
      detailPt: `Host \`${hostname}\` consta na blocklist curada de scam.`,
    });
  }

  const officialMatch = matchOfficial(hostname);
  pushUnique(signals, analyzeBrandImpersonation(hostname, officialMatch));

  if (officialMatch && signals.every((s) => s.weight < 25)) {
    return { signals, hostname, normalizedUrl, officialMatch, typosquatOf: null, impersonatedBrands };
  }

  if (protocol !== "https:") {
    signals.push({
      id: "no-https",
      severity: "high",
      weight: 22,
      titleEn: "Not HTTPS",
      titlePt: "Sem HTTPS",
      detailEn: "Web3 apps and wallets should use HTTPS — HTTP is a common phishing vector.",
      detailPt: "Apps Web3 e carteiras devem usar HTTPS — HTTP é vetor comum de phishing.",
    });
  }

  if (protocol === "javascript:" || protocol === "data:" || protocol === "blob:") {
    signals.push({
      id: "dangerous-scheme",
      severity: "critical",
      weight: 45,
      titleEn: "Dangerous URL scheme",
      titlePt: "Esquema de URL perigoso",
      detailEn: `${protocol}// URLs can execute code — never use for wallets.`,
      detailPt: `URLs ${protocol}// podem executar código — nunca use para carteiras.`,
    });
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    signals.push({
      id: "raw-ip",
      severity: "high",
      weight: 28,
      titleEn: "Raw IP address",
      titlePt: "Endereço IP direto",
      detailEn: "Legitimate Web3 apps use domain names, not bare IPs.",
      detailPt: "Apps Web3 legítimos usam domínios, não IPs crus.",
    });
  }

  if (parsed.username || parsed.password) {
    signals.push({
      id: "embedded-credentials",
      severity: "critical",
      weight: 35,
      titleEn: "Embedded credentials in URL (@ trick)",
      titlePt: "Credenciais embutidas na URL (truque @)",
      detailEn: "The @ trick hides the real host — classic phishing pattern.",
      detailPt: "O truque do @ esconde o host real — padrão clássico de phishing.",
    });
  }

  if (hostname.includes("xn--") || hostname.startsWith("xn--")) {
    signals.push({
      id: "punycode",
      severity: "critical",
      weight: 32,
      titleEn: "Punycode / IDN homograph domain",
      titlePt: "Domínio punycode / homógrafo IDN",
      detailEn: "IDN domains can mimic brands with lookalike characters.",
      detailPt: "Domínios IDN podem imitar marcas com caracteres parecidos.",
    });
  }

  const labels = hostname.split(".");
  const tld = labels[labels.length - 1] ?? "";
  if (SUSPICIOUS_TLDS.has(tld) && WEB3_BRAND_RE.test(hostname)) {
    signals.push({
      id: "suspicious-tld-brand",
      severity: "high",
      weight: 24,
      titleEn: "Suspicious TLD + Web3 brand keyword",
      titlePt: "TLD suspeito + marca Web3",
      detailEn: `.${tld} + brand keyword — common drainer hosting pattern.`,
      detailPt: `.${tld} + palavra de marca — padrão comum de hosting drainer.`,
    });
  }

  if (labels.length >= 4) {
    signals.push({
      id: "deep-subdomain",
      severity: "medium",
      weight: 14,
      titleEn: "Deep subdomain chain",
      titlePt: "Cadeia longa de subdomínios",
      detailEn: `${labels.length} labels — scammers nest fake dApps on free hosts.`,
      detailPt: `${labels.length} labels — golpistas aninham dApps falsos em hosts gratuitos.`,
    });
  }

  const typosquatOf = detectTyposquat(hostname);
  if (typosquatOf) {
    signals.push({
      id: "typosquat",
      severity: "critical",
      weight: 38,
      titleEn: "Typosquat of official Web3 domain",
      titlePt: "Typosquat de domínio Web3 oficial",
      detailEn: `\`${hostname}\` resembles \`${typosquatOf}\` — likely impersonation.`,
      detailPt: `\`${hostname}\` parece \`${typosquatOf}\` — provável impersonação.`,
    });
  }

  if (SHORTENERS.has(hostname) || SHORTENERS.has(labels.slice(-2).join("."))) {
    signals.push({
      id: "url-shortener",
      severity: "medium",
      weight: 16,
      titleEn: "URL shortener hides destination",
      titlePt: "Encurtador esconde destino",
      detailEn: "Expand the final URL before connecting any wallet.",
      detailPt: "Expanda a URL final antes de conectar qualquer carteira.",
    });
  }

  const fullPath = `${hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
  if (DRAINER_PATH_RE.test(fullPath)) {
    signals.push({
      id: "drainer-path",
      severity: "critical",
      weight: 30,
      titleEn: "Drainer-style path keywords",
      titlePt: "Palavras-chave drainer no path",
      detailEn: "Claim/connect/verify wallet patterns typical of drain scams.",
      detailPt: "Padrões claim/connect/verify típicos de scams drainer.",
    });
  }

  if (SEED_PATH_RE.test(fullPath)) {
    signals.push({
      id: "seed-phishing",
      severity: "critical",
      weight: 42,
      titleEn: "Seed phrase phishing path",
      titlePt: "Path de phishing de seed",
      detailEn: "Never enter seed phrases on web forms.",
      detailPt: "Nunca digite seed em formulários web.",
    });
  }

  if (PERMIT_SIGN_RE.test(fullPath)) {
    signals.push({
      id: "permit-sign-path",
      severity: "high",
      weight: 18,
      titleEn: "Permit / signature path keywords",
      titlePt: "Palavras permit/assinatura no path",
      detailEn: "URL path references broad approvals or typed signatures — verify carefully.",
      detailPt: "Path referencia approvals amplos ou assinaturas — verifique com cuidado.",
    });
  }

  if (ETH_IN_URL_RE.test(parsed.href)) {
    signals.push({
      id: "eth-address-in-url",
      severity: "medium",
      weight: 10,
      titleEn: "Wallet address embedded in URL",
      titlePt: "Endereço de carteira na URL",
      detailEn: "Tracking/personalized phishing links often embed your 0x address.",
      detailPt: "Links de phishing personalizados costumam embutir seu endereço 0x.",
    });
  }

  const port = parsed.port;
  if (port && port !== "443" && port !== "80") {
    signals.push({
      id: "nonstandard-port",
      severity: "medium",
      weight: 12,
      titleEn: "Non-standard port",
      titlePt: "Porta não padrão",
      detailEn: `Port :${port} is unusual for consumer Web3 sites.`,
      detailPt: `Porta :${port} é incomum para sites Web3.`,
    });
  }

  return { signals, hostname, normalizedUrl, officialMatch, typosquatOf, impersonatedBrands };
}

function analyzeRedirects(inputHost: string, chain: string[]): LinkSignal[] {
  const extra: LinkSignal[] = [];
  if (chain.length <= 1) return extra;

  const finalHost = (() => {
    try { return normalizeHostname(new URL(chain[chain.length - 1]).hostname); } catch { return ""; }
  })();

  if (finalHost && finalHost !== normalizeHostname(inputHost)) {
    extra.push({
      id: "redirect-mismatch",
      severity: "high",
      weight: 25,
      titleEn: "Redirect to different domain",
      titlePt: "Redirect para domínio diferente",
      detailEn: `\`${inputHost}\` → \`${finalHost}\` (${chain.length - 1} hop(s)).`,
      detailPt: `\`${inputHost}\` → \`${finalHost}\` (${chain.length - 1} hop(s)).`,
    });
  }

  if (chain.length >= 4) {
    extra.push({
      id: "long-redirect-chain",
      severity: "medium",
      weight: 15,
      titleEn: "Long redirect chain",
      titlePt: "Cadeia longa de redirects",
      detailEn: `${chain.length} URLs — obfuscates drainer destinations.`,
      detailPt: `${chain.length} URLs — ofusca destinos drainer.`,
    });
  }

  return extra;
}

function scoreToVerdict(
  score: number,
  officialMatch: string | null,
  hasBlocklist: boolean,
  trustStatus: LinkScanReport["trustStatus"],
): LinkVerdict {
  if (officialMatch && score < 15) return "official";
  if (trustStatus === "search_verified" && score < 22) return "likely_safe";
  if (hasBlocklist || score >= 85) return "confirmed_scam";
  if (score >= 55 || trustStatus === "search_mismatch") return "likely_scam";
  if (score >= 28 || trustStatus === "unverified") return "suspicious";
  return "likely_safe";
}

function buildRecommendations(
  verdict: LinkVerdict,
  hostname: string,
  officialMatch: string | null,
  brands: string[],
  trustStatus: LinkScanReport["trustStatus"],
  discoveredOfficial: string | null,
  projectHint: string | null,
  lang: "en" | "pt",
): string[] {
  if (lang === "pt") {
    const r: string[] = [];
    if (verdict === "official") r.push(`Canal Web3 oficial (${officialMatch}). Confira a barra de endereço antes de assinar.`);
    if (trustStatus === "unverified") {
      r.push("Projeto possivelmente novo — a allowlist ainda não cobre este domínio. Confirme APENAS pelo Twitter/Discord verificado (✓) do projeto.");
    }
    if (discoveredOfficial && trustStatus === "search_mismatch") {
      r.push(`Busca ao vivo sugere site oficial: \`${discoveredOfficial}\` — o link enviado parece falso.`);
    }
    if (discoveredOfficial && trustStatus === "search_verified" && projectHint) {
      r.push(`Busca corrobora \`${discoveredOfficial}\` para "${projectHint}" — ainda valide a conta verificada do anunciante.`);
    }
    if (verdict === "likely_safe") r.push("Sem sinais fortes — confirme o domínio manualmente antes de conectar carteira.");
    if (verdict === "suspicious") r.push("Não conecte carteira até confirmar via site/Twitter/Discord oficial do protocolo.");
    if (verdict === "likely_scam" || verdict === "confirmed_scam") {
      r.push("NÃO conecte carteira. Feche a aba.");
      r.push("Se já assinou: revogue em revoke.cash e mova fundos.");
    }
    if (brands.length > 0 && !officialMatch) {
      r.push(`Domínio imita \`${brands[0]}\` — use apenas o site oficial listado no Twitter/GitHub do projeto.`);
    }
    r.push("Ferramentas: revoke.cash · DeBank · Etherscan labels.");
    return r;
  }
  const r: string[] = [];
  if (verdict === "official") r.push(`Official Web3 channel (${officialMatch}). Verify the address bar before signing.`);
  if (trustStatus === "unverified") {
    r.push("Possibly a new project — not on allowlist yet. Confirm ONLY via the project's verified Twitter/Discord (✓).");
  }
  if (discoveredOfficial && trustStatus === "search_mismatch") {
    r.push(`Live search suggests official site: \`${discoveredOfficial}\` — the shared link looks fake.`);
  }
  if (discoveredOfficial && trustStatus === "search_verified" && projectHint) {
    r.push(`Search corroborates \`${discoveredOfficial}\` for "${projectHint}" — still validate the announcer's verified account.`);
  }
  if (verdict === "likely_safe") r.push("No strong flags — manually confirm the domain before connecting a wallet.");
  if (verdict === "suspicious") r.push("Do not connect until confirmed via the protocol's official site/Twitter/Discord.");
  if (verdict === "likely_scam" || verdict === "confirmed_scam") {
    r.push("Do NOT connect a wallet. Close the tab.");
    r.push("If you signed: revoke at revoke.cash and move funds.");
  }
  if (brands.length > 0 && !officialMatch) {
    r.push(`Domain impersonates \`${brands[0]}\` — use only the official site from the project's Twitter/GitHub.`);
  }
  r.push("Tools: revoke.cash · DeBank · Etherscan labels.");
  return r;
}

export async function scanLink(inputUrl: string): Promise<LinkScanReport> {
  let urlStr = inputUrl.trim();
  if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`;

  const staticA = analyzeStatic(urlStr);
  const redirectChain = await resolveRedirectChain(urlStr);
  const signals: LinkSignal[] = [...staticA.signals, ...analyzeRedirects(staticA.hostname, redirectChain)];

  const finalUrl = redirectChain[redirectChain.length - 1] ?? urlStr;
  let typosquatOf = staticA.typosquatOf;
  let impersonatedBrands = staticA.impersonatedBrands;
  let officialMatch = staticA.officialMatch;

  if (finalUrl !== urlStr) {
    const finalStatic = analyzeStatic(finalUrl);
    pushUnique(signals, finalStatic.signals);
    if (finalStatic.typosquatOf) typosquatOf = finalStatic.typosquatOf;
    if (finalStatic.impersonatedBrands.length > impersonatedBrands.length) {
      impersonatedBrands = finalStatic.impersonatedBrands;
    }
    if (!officialMatch) officialMatch = finalStatic.officialMatch;
  }

  pushUnique(signals, await searchWeb3Reputation(staticA.hostname));
  if (finalUrl !== urlStr) {
    try {
      const fh = normalizeHostname(new URL(finalUrl).hostname);
      pushUnique(signals, await searchWeb3Reputation(fh));
    } catch { /* ignore */ }
  }

  pushUnique(signals, await sniffPageContent(finalUrl, staticA.hostname));
  if (finalUrl !== urlStr) {
    try {
      const fh = normalizeHostname(new URL(finalUrl).hostname);
      pushUnique(signals, await sniffPageContent(finalUrl, fh));
    } catch { /* ignore */ }
  }

  let trustStatus: LinkScanReport["trustStatus"] = officialMatch ? "allowlist_verified" : "unverified";
  let projectHint: string | null = null;
  let discoveredOfficial: string | null = null;

  if (!officialMatch) {
    const discovery = await discoverOfficialDomain(staticA.hostname, impersonatedBrands);
    projectHint = discovery.projectHint;
    discoveredOfficial = discovery.discoveredOfficial;
    pushUnique(signals, discovery.signals);
    if (discovery.signals.some((s) => s.id === "official-domain-mismatch")) {
      trustStatus = "search_mismatch";
    } else if (discovery.signals.some((s) => s.id === "search-corroborated")) {
      trustStatus = "search_verified";
    } else if (discovery.signals.some((s) => s.id === "unverified-domain" || s.id === "unverified-new-project")) {
      trustStatus = "unverified";
    }
  } else {
    discoveredOfficial = officialMatch;
  }

  const hasBlocklist = signals.some((s) => s.id === "blocklist-hit");
  let riskScore = Math.max(0, Math.min(100, Math.round(signals.reduce((s, sig) => s + sig.weight, 0))));

  if (officialMatch && !signals.some((s) => s.weight >= 25)) {
    riskScore = Math.min(riskScore, 8);
  }

  const verdict = scoreToVerdict(riskScore, officialMatch, hasBlocklist, trustStatus);
  const confidence: LinkScanReport["confidence"] =
    signals.length >= 4 ? "high" : signals.length >= 2 ? "medium" : "low";

  return {
    inputUrl: urlStr,
    normalizedUrl: staticA.normalizedUrl,
    hostname: staticA.hostname,
    finalUrl: redirectChain.length > 1 ? finalUrl : null,
    redirectChain,
    riskScore,
    verdict,
    confidence,
    signals: signals.filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight),
    officialMatch,
    typosquatOf,
    impersonatedBrands,
    projectHint,
    discoveredOfficial,
    trustStatus,
    recommendationsEn: buildRecommendations(verdict, staticA.hostname, officialMatch, impersonatedBrands, trustStatus, discoveredOfficial, projectHint, "en"),
    recommendationsPt: buildRecommendations(verdict, staticA.hostname, officialMatch, impersonatedBrands, trustStatus, discoveredOfficial, projectHint, "pt"),
    scannedAt: new Date().toISOString(),
  };
}

export async function scanLinks(urls: string[]): Promise<LinkScanBatchReport> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(0, 5);
  const reports = await Promise.all(unique.map((u) => scanLink(u)));
  const worstScore = reports.reduce((m, r) => Math.max(m, r.riskScore), 0);
  const worst = reports.sort((a, b) => b.riskScore - a.riskScore)[0];
  return { reports, worstScore, worstVerdict: worst?.verdict ?? "likely_safe" };
}

export function formatLinkScanReport(report: LinkScanReport, lang: "pt" | "en"): string {
  const verdictLabel = {
    official: lang === "pt" ? "Oficial ✓" : "Official ✓",
    likely_safe: lang === "pt" ? "Provavelmente seguro" : "Likely safe",
    suspicious: lang === "pt" ? "Suspeito" : "Suspicious",
    likely_scam: lang === "pt" ? "Provável scam" : "Likely scam",
    confirmed_scam: lang === "pt" ? "Scam confirmado" : "Confirmed scam",
  }[report.verdict];

  const head = lang === "pt"
    ? `🔗 **Scanner Web3** — \`${report.hostname}\`\n\n**Risco:** ${report.riskScore}/100 · **Veredito:** ${verdictLabel} · **Confiança:** ${report.confidence}`
    : `🔗 **Web3 scanner** — \`${report.hostname}\`\n\n**Risk:** ${report.riskScore}/100 · **Verdict:** ${verdictLabel} · **Confidence:** ${report.confidence}`;

  if (report.officialMatch) {
    return head + (lang === "pt"
      ? `\n\n✅ **Canal oficial Web3** — \`${report.officialMatch}\``
      : `\n\n✅ **Official Web3 channel** — \`${report.officialMatch}\``);
  }

  const brandLine = report.impersonatedBrands.length
    ? `\n\n${lang === "pt" ? "**Marcas imitadas**" : "**Impersonated brands**"}: ${report.impersonatedBrands.slice(0, 4).join(", ")}`
    : "";

  const discoveryLine = report.trustStatus === "unverified"
    ? `\n\n⚠️ ${lang === "pt" ? "Projeto não listado — domínio não confirmado na allowlist" : "Unlisted project — domain not confirmed on allowlist"}`
    : report.trustStatus === "search_mismatch" && report.discoveredOfficial
      ? `\n\n🚨 ${lang === "pt" ? "Oficial provável" : "Likely official"}: \`${report.discoveredOfficial}\` ${lang === "pt" ? "≠ link enviado" : "≠ shared link"}`
      : report.discoveredOfficial && report.trustStatus === "search_verified"
        ? `\n\n✓ ${lang === "pt" ? "Corroborado na busca" : "Search corroborated"}: \`${report.discoveredOfficial}\``
        : "";

  const sigBlock = report.signals.length
    ? "\n\n" + (lang === "pt" ? "**Sinais**" : "**Signals**") + "\n" +
      report.signals.slice(0, 8).map((s) => `• **${lang === "pt" ? s.titlePt : s.titleEn}** — ${lang === "pt" ? s.detailPt : s.detailEn}`).join("\n")
    : "";

  const redirect = report.finalUrl && report.finalUrl !== report.inputUrl
    ? `\n\n${lang === "pt" ? "**Destino final**" : "**Final destination**"}: \`${report.finalUrl}\``
    : "";

  const recs = (lang === "pt" ? report.recommendationsPt : report.recommendationsEn).map((r) => `• ${r}`).join("\n");

  return head + brandLine + discoveryLine + sigBlock + redirect + `\n\n**${lang === "pt" ? "Recomendações" : "Recommendations"}**\n${recs}`;
}

export function formatLinkScanBatch(batch: LinkScanBatchReport, lang: "pt" | "en"): string {
  if (batch.reports.length === 1) return formatLinkScanReport(batch.reports[0], lang);
  const head = lang === "pt"
    ? `🔗 **Scanner Web3** — ${batch.reports.length} URLs · pior risco **${batch.worstScore}/100**`
    : `🔗 **Web3 scanner** — ${batch.reports.length} URLs · worst risk **${batch.worstScore}/100**`;
  const lines = batch.reports.map((r) => `• \`${r.hostname}\` — ${r.riskScore}/100 (${r.verdict})`).join("\n");
  const detail = formatLinkScanReport([...batch.reports].sort((a, b) => b.riskScore - a.riskScore)[0], lang);
  return head + "\n\n" + lines + "\n\n---\n\n" + detail;
}

export async function compareLinks(suspiciousUrl: string, officialUrl: string): Promise<LinkCompareReport> {
  const [suspicious, official] = await Promise.all([
    scanLink(suspiciousUrl),
    scanLink(officialUrl),
  ]);

  const suspiciousDomain = registrableDomain(suspicious.hostname);
  const officialDomain = registrableDomain(official.hostname);
  const domainsMatch = suspiciousDomain === officialDomain;
  const riskDelta = suspicious.riskScore - official.riskScore;

  let verdict: LinkCompareVerdict;
  if (domainsMatch && riskDelta <= 8) {
    verdict = "match_official";
  } else if (
    (official.trustStatus === "allowlist_verified" || official.trustStatus === "search_verified" || official.officialMatch) &&
    !domainsMatch
  ) {
    verdict = "likely_phishing";
  } else if (
    official.trustStatus === "unverified" &&
    suspicious.trustStatus === "unverified"
  ) {
    verdict = "both_unverified";
  } else {
    verdict = "suspicious_divergence";
  }

  if (suspicious.typosquatOf && !domainsMatch) verdict = "likely_phishing";
  if (riskDelta >= 35 && !domainsMatch) verdict = "likely_phishing";

  const recPt: string[] = [];
  const recEn: string[] = [];

  if (verdict === "match_official") {
    recPt.push("Os domínios coincidem — ainda confira se o link oficial veio de conta verificada (✓).");
    recEn.push("Domains match — still confirm the official link came from a verified (✓) account.");
  }
  if (verdict === "likely_phishing") {
    recPt.push("NÃO use o link suspeito. Use apenas o domínio oficial comparado.");
    recPt.push(`Oficial: \`${officialDomain}\` · Suspeito: \`${suspiciousDomain}\``);
    recEn.push("Do NOT use the suspicious link. Use only the compared official domain.");
    recEn.push(`Official: \`${officialDomain}\` · Suspicious: \`${suspiciousDomain}\``);
  }
  if (verdict === "both_unverified") {
    recPt.push("Ambos os links são projetos não listados — espere confirmação pública antes de conectar carteira.");
    recEn.push("Both links are unlisted — wait for public confirmation before connecting a wallet.");
  }
  if (verdict === "suspicious_divergence") {
    recPt.push("Domínios diferentes — trate o link recebido por DM como suspeito até prova em contrário.");
    recEn.push("Different domains — treat the DM link as suspicious until proven otherwise.");
  }
  recPt.push("Confirme sempre no perfil verificado do projeto, não em respostas de estranhos.");
  recEn.push("Always confirm on the project's verified profile, not in replies from strangers.");

  return {
    suspicious,
    official,
    suspiciousDomain,
    officialDomain,
    domainsMatch,
    riskDelta,
    verdict,
    recommendationsPt: recPt,
    recommendationsEn: recEn,
  };
}

export function formatLinkCompareReport(cmp: LinkCompareReport, lang: "pt" | "en"): string {
  const verdictLabel = {
    match_official: lang === "pt" ? "Domínios coincidem ✓" : "Domains match ✓",
    likely_phishing: lang === "pt" ? "Provável phishing" : "Likely phishing",
    both_unverified: lang === "pt" ? "Ambos não verificados" : "Both unverified",
    suspicious_divergence: lang === "pt" ? "Divergência suspeita" : "Suspicious divergence",
  }[cmp.verdict];

  const head = lang === "pt"
    ? `🔗 **Comparação de links**\n\n**Veredito:** ${verdictLabel}\n\n| | Suspeito | Oficial (Twitter) |\n|---|---|---|\n| Domínio | \`${cmp.suspiciousDomain}\` | \`${cmp.officialDomain}\` |\n| Risco | **${cmp.suspicious.riskScore}/100** | **${cmp.official.riskScore}/100** |`
    : `🔗 **Link comparison**\n\n**Verdict:** ${verdictLabel}\n\n| | Suspicious | Official (Twitter) |\n|---|---|---|\n| Domain | \`${cmp.suspiciousDomain}\` | \`${cmp.officialDomain}\` |\n| Risk | **${cmp.suspicious.riskScore}/100** | **${cmp.official.riskScore}/100** |`;

  const recs = (lang === "pt" ? cmp.recommendationsPt : cmp.recommendationsEn).map((r) => `• ${r}`).join("\n");
  return head + `\n\n**${lang === "pt" ? "Recomendações" : "Recommendations"}**\n${recs}`;
}
