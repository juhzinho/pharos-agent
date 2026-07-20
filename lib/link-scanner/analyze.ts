import {
  FREE_HOST_SUFFIXES,
  HOMOGLYPH_MAP,
  OFFICIAL_WEB3_SUFFIXES,
  SCAM_HOST_FRAGMENTS,
  TYPO_SQUAT_TARGETS,
  WEB3_BRAND_RE,
} from "@/lib/link-scanner/domains";
import type { LinkSignal } from "@/lib/link-scanner/types";

export function normalizeHostname(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

export function matchOfficial(hostname: string): string | null {
  const h = normalizeHostname(hostname);
  for (const suffix of OFFICIAL_WEB3_SUFFIXES) {
    if (h === suffix || h.endsWith(`.${suffix}`)) return suffix;
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function foldHomoglyphs(s: string): string {
  let out = s.toLowerCase();
  for (const [from, to] of Object.entries(HOMOGLYPH_MAP)) {
    out = out.split(from).join(to);
  }
  return out.replace(/[^a-z0-9.-]/g, "");
}

export function detectTyposquat(hostname: string): string | null {
  const h = normalizeHostname(hostname);
  if (matchOfficial(h)) return null;

  const registrable = h.split(".").slice(-2).join(".");
  const folded = foldHomoglyphs(registrable);

  for (const target of TYPO_SQUAT_TARGETS) {
    const targetBase = target.split(".").slice(-2).join(".");
    const dist = levenshtein(folded, foldHomoglyphs(targetBase));
    if (dist > 0 && dist <= 2 && folded.length >= targetBase.length - 2) return target;

    const brand = target.split(".")[0];
    const firstLabel = h.split(".")[0] ?? "";
    if (firstLabel.includes(brand) && h !== target && !h.endsWith(`.${target}`)) {
      if (/[-_]|\d/.test(firstLabel) || firstLabel.length > brand.length + 2) return target;
    }
    if (h.includes(`${brand}.`) && !h.endsWith(target) && !h.endsWith(`.${targetBase}`)) {
      if (/\b(secure|login|app|claim|verify|support|web3|connect|wallet)\b/.test(firstLabel)) return target;
    }
  }
  return null;
}

export function detectImpersonatedBrands(hostname: string): string[] {
  const h = hostname.toLowerCase();
  const hits: string[] = [];
  const re = new RegExp(WEB3_BRAND_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(h)) !== null) {
    if (m[0] && !hits.includes(m[0].toLowerCase())) hits.push(m[0].toLowerCase());
  }
  return hits;
}

export function isFreeHostAbuse(hostname: string): string | null {
  const h = normalizeHostname(hostname);
  for (const suffix of FREE_HOST_SUFFIXES) {
    if (h === suffix || h.endsWith(`.${suffix}`)) return suffix;
  }
  return null;
}

export function hasNonAsciiHostname(hostname: string): boolean {
  return /[^\x00-\x7F]/.test(hostname);
}

export function analyzeBrandImpersonation(hostname: string, officialMatch: string | null): LinkSignal[] {
  const signals: LinkSignal[] = [];
  if (officialMatch) return signals;

  const brands = detectImpersonatedBrands(hostname);
  if (brands.length >= 2) {
    signals.push({
      id: "multi-brand-host",
      severity: "critical",
      weight: 34,
      titleEn: "Multiple Web3 brands in one domain",
      titlePt: "Várias marcas Web3 num domínio",
      detailEn: `Host references ${brands.slice(0, 3).join(", ")} — classic multi-brand drainer landing.`,
      detailPt: `Host referencia ${brands.slice(0, 3).join(", ")} — landing drainer multi-marca clássico.`,
    });
  } else if (brands.length === 1) {
    signals.push({
      id: "brand-in-unofficial-host",
      severity: "high",
      weight: 26,
      titleEn: "Web3 brand on unofficial domain",
      titlePt: "Marca Web3 em domínio não oficial",
      detailEn: `Impersonates \`${brands[0]}\` but domain is not on the Web3 official allowlist.`,
      detailPt: `Imita \`${brands[0]}\` mas o domínio não está na allowlist Web3 oficial.`,
    });
  }

  for (const frag of SCAM_HOST_FRAGMENTS) {
    if (hostname.toLowerCase().includes(frag)) {
      signals.push({
        id: "known-scam-fragment",
        severity: "critical",
        weight: 36,
        titleEn: "Known scam hostname pattern",
        titlePt: "Padrão conhecido de hostname scam",
        detailEn: `Matches curated drainer fragment \`${frag}\`.`,
        detailPt: `Corresponde ao fragmento drainer curado \`${frag}\`.`,
      });
      break;
    }
  }

  const freeHost = isFreeHostAbuse(hostname);
  if (freeHost && brands.length > 0) {
    signals.push({
      id: "free-host-brand-abuse",
      severity: "critical",
      weight: 32,
      titleEn: "Free host + brand impersonation",
      titlePt: "Host gratuito + impersonação de marca",
      detailEn: `Hosted on \`.${freeHost}\` while mimicking \`${brands[0]}\` — extremely common drainer setup.`,
      detailPt: `Hospedado em \`.${freeHost}\` imitando \`${brands[0]}\` — setup drainer muito comum.`,
    });
  }

  if (hasNonAsciiHostname(hostname)) {
    signals.push({
      id: "non-ascii-host",
      severity: "critical",
      weight: 30,
      titleEn: "Non-ASCII characters in domain",
      titlePt: "Caracteres não-ASCII no domínio",
      detailEn: "Homograph attack — domain uses lookalike Unicode characters.",
      detailPt: "Ataque homógrafo — domínio usa caracteres Unicode parecidos.",
    });
  }

  return signals;
}

export async function sniffPageContent(url: string, hostname: string): Promise<LinkSignal[]> {
  const signals: LinkSignal[] = [];
  if (matchOfficial(hostname)) return signals;

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProsPilot-LinkScanner/2.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return signals;

    const reader = res.body?.getReader();
    if (!reader) return signals;
    let html = "";
    const dec = new TextDecoder();
    while (html.length < 12_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});

    const lower = html.toLowerCase();

    if (/<input[^>]+type=["']?(password|text)["']?[^>]*(seed|mnemonic|recovery|phrase|private)/i.test(html)) {
      signals.push({
        id: "html-seed-form",
        severity: "critical",
        weight: 45,
        titleEn: "Seed phrase input on page",
        titlePt: "Campo de seed phrase na página",
        detailEn: "HTML contains seed/recovery input — legitimate wallets never ask this in browsers.",
        detailPt: "HTML contém input de seed/recovery — carteiras legítimas nunca pedem isto no browser.",
      });
    }

    if (/\b(walletconnect|web3modal|connect wallet|connect your wallet|sign transaction|approve unlimited)\b/i.test(lower)) {
      signals.push({
        id: "html-wallet-connect",
        severity: "high",
        weight: 22,
        titleEn: "WalletConnect / connect UI detected",
        titlePt: "WalletConnect / UI de connect detectado",
        detailEn: "Page prompts wallet connection on an unofficial domain — verify before signing.",
        detailPt: "Página pede conexão de carteira em domínio não oficial — verifique antes de assinar.",
      });
    }

    const titleMatch = html.match(/<title[^>]*>([^<]{0,120})<\/title>/i);
    const title = titleMatch?.[1]?.toLowerCase() ?? "";
    const brands = detectImpersonatedBrands(title);
    if (brands.length > 0) {
      signals.push({
        id: "html-title-brand-spoof",
        severity: "high",
        weight: 24,
        titleEn: "Page title spoofs Web3 brand",
        titlePt: "Título da página imita marca Web3",
        detailEn: `Title references \`${brands[0]}\` but host is unofficial.`,
        detailPt: `Título referencia \`${brands[0]}\` mas o host não é oficial.`,
      });
    }

    if (/\b(approve all|setapprovalforall|permit2|increase allowance|unlimited approval)\b/i.test(lower)) {
      signals.push({
        id: "html-approval-language",
        severity: "high",
        weight: 20,
        titleEn: "Unlimited approval language on page",
        titlePt: "Linguagem de approval ilimitado na página",
        detailEn: "Page content pushes broad token approvals — common drainer tactic.",
        detailPt: "Conteúdo empurra approvals amplos de tokens — tática drainer comum.",
      });
    }
  } catch {
    /* optional */
  }

  return signals;
}

const SCAM_LABEL_NOISE =
  /\b(claim|airdrop|app|web3|connect|official|login|verify|secure|wallet|dapp|nft|token|free|mint|reward|eligible|whitelist|support|sync|restore|import)\b/gi;

/** Guess project name from hostname — works for day-0 launches not yet on allowlist. */
export function extractProjectHint(hostname: string): string | null {
  const label = (hostname.split(".")[0] ?? "").toLowerCase();
  if (!label || label.length < 3) return null;
  let hint = label.replace(SCAM_LABEL_NOISE, " ").replace(/[-_]+/g, " ").trim();
  if (hint.length < 3) hint = label.replace(/[-_\d]+/g, " ").trim();
  return hint.length >= 3 ? hint : label.length >= 4 ? label : null;
}

function registrableDomain(hostname: string): string {
  const parts = normalizeHostname(hostname).split(".");
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

function extractDomainsFromText(text: string): string[] {
  const found: string[] = [];
  const re = /https?:\/\/(?:www\.)?([a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const host = normalizeHostname(m[1].split("/")[0] ?? "");
    if (host && !found.includes(host)) found.push(host);
  }
  return found;
}

function rankOfficialCandidates(domains: string[], excludeHost: string): string[] {
  const counts = new Map<string, number>();
  const exclude = registrableDomain(excludeHost);
  for (const d of domains) {
    const reg = registrableDomain(d);
    if (!reg || reg === exclude) continue;
    if (matchOfficial(reg)) {
      counts.set(reg, (counts.get(reg) ?? 0) + 3);
      continue;
    }
    counts.set(reg, (counts.get(reg) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
}

/** Live search — find announced official domain for new/unlisted projects. */
export async function discoverOfficialDomain(
  hostname: string,
  brands: string[],
): Promise<{ projectHint: string | null; discoveredOfficial: string | null; signals: LinkSignal[] }> {
  const signals: LinkSignal[] = [];
  if (matchOfficial(hostname)) {
    return { projectHint: null, discoveredOfficial: matchOfficial(hostname), signals };
  }

  const projectHint = brands[0] ?? extractProjectHint(hostname);
  if (!projectHint) {
    signals.push({
      id: "unverified-domain",
      severity: "medium",
      weight: 18,
      titleEn: "Unverified domain (not on allowlist)",
      titlePt: "Domínio não verificado (fora da allowlist)",
      detailEn: "This domain is not on the curated Web3 allowlist — could be a new project OR a day-0 phishing clone.",
      detailPt: "Este domínio não está na allowlist Web3 — pode ser projeto novo OU clone phishing do dia do launch.",
    });
    return { projectHint: null, discoveredOfficial: null, signals };
  }

  const { webSearch } = await import("@/lib/search");
  const queries = [
    `"${projectHint}" official website crypto twitter`,
    `"${projectHint}" launch official app domain`,
    `${projectHint} protocol official site`,
  ];

  const allDomains: string[] = [];
  let answerBlob = "";

  for (const q of queries) {
    try {
      const res = await webSearch(q);
      if (!res) continue;
      answerBlob += ` ${res.answer}`;
      for (const r of res.results) {
        allDomains.push(...extractDomainsFromText(r.url));
        allDomains.push(...extractDomainsFromText(r.content));
      }
    } catch { /* optional */ }
  }

  const candidates = rankOfficialCandidates(allDomains, hostname);
  const scannedReg = registrableDomain(hostname);
  const top = candidates[0] ?? null;

  if (top && top !== scannedReg) {
    const mentionsTop = answerBlob.toLowerCase().includes(top.split(".")[0]);
    if (candidates.filter((c) => c === top).length >= 1 && (mentionsTop || candidates.length >= 2)) {
      signals.push({
        id: "official-domain-mismatch",
        severity: "high",
        weight: 30,
        titleEn: "Live search points to a different official domain",
        titlePt: "Busca ao vivo aponta outro domínio oficial",
        detailEn: `For "${projectHint}", public sources reference \`${top}\` — not \`${scannedReg}\`. Common on launch-day phishing.`,
        detailPt: `Para "${projectHint}", fontes públicas referem \`${top}\` — não \`${scannedReg}\`. Comum em phishing no dia do launch.`,
      });
      return { projectHint, discoveredOfficial: top, signals };
    }
  }

  if (!top) {
    signals.push({
      id: "unverified-new-project",
      severity: "medium",
      weight: 20,
      titleEn: "Day-0 / unlisted project — cannot confirm official domain",
      titlePt: "Projeto novo/não listado — domínio oficial incerto",
      detailEn: `"${projectHint}" is not on the allowlist and live search found no clear official domain yet. Verify ONLY via the project's verified Twitter/Discord before connecting a wallet.`,
      detailPt: `"${projectHint}" não está na allowlist e a busca não encontrou domínio oficial claro. Verifique APENAS pelo Twitter/Discord verificado do projeto antes de conectar carteira.`,
    });
  } else if (top === scannedReg) {
    signals.push({
      id: "search-corroborated",
      severity: "low",
      weight: -10,
      titleEn: "Corroborated by live search (unlisted project)",
      titlePt: "Corroborado por busca ao vivo (projeto não listado)",
      detailEn: `Public sources also reference \`${top}\` for "${projectHint}" — still verify the announcer's verified social account.`,
      detailPt: `Fontes públicas também referem \`${top}\` para "${projectHint}" — ainda confirme a conta social verificada do anunciante.`,
    });
  }

  return { projectHint, discoveredOfficial: top, signals };
}

export async function searchWeb3Reputation(hostname: string): Promise<LinkSignal[]> {
  const signals: LinkSignal[] = [];
  const { webSearch } = await import("@/lib/search");

  const queries = [
    `"${hostname}" crypto phishing scam drainer`,
    `"${hostname}" fake wallet connect site`,
    `"${hostname}" scam site:reddit.com OR site:twitter.com`,
  ];

  for (const q of queries) {
    try {
      const res = await webSearch(q);
      if (!res) continue;
      const blob = `${res.answer} ${res.results.map((r) => `${r.title} ${r.content}`).join(" ")}`.toLowerCase();
      const host = hostname.toLowerCase();
      if (!blob.includes(host.slice(0, Math.min(10, host.length)))) continue;
      if (/\b(scam|phish|drainer|malicious|fraud|fake|warning|do not use|avoid|reported)\b/.test(blob)) {
        signals.push({
          id: "web-reputation",
          severity: "high",
          weight: 22,
          titleEn: "Negative Web3 web reputation",
          titlePt: "Reputação Web3 negativa na web",
          detailEn: "Public sources flag this domain in scam/phishing/drainer context.",
          detailPt: "Fontes públicas marcam este domínio em contexto scam/phishing/drainer.",
        });
        break;
      }
    } catch { /* optional */ }
  }

  return signals;
}
