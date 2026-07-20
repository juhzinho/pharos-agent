// Web3 intelligence briefings (Alpha Radar–style) — DeFi, L2, security, regulation, airdrops.
// Excludes NFT and DAO topics by design.

import { webSearch, formatSearchContext, type SearchResponse } from "@/lib/search";

export type Web3RadarTopic = "defi" | "layer2" | "security" | "regulation" | "airdrops";

export interface Web3RadarTopicMeta {
  id: Web3RadarTopic;
  icon: string;
  labelEn: string;
  labelPt: string;
  descEn: string;
  descPt: string;
  searchQuery: string;
}

export const WEB3_RADAR_TOPICS: Web3RadarTopicMeta[] = [
  {
    id: "defi",
    icon: "🏦",
    labelEn: "DeFi",
    labelPt: "DeFi",
    descEn: "Yields, TVL shifts, protocol launches",
    descPt: "Yields, movimentos de TVL, lançamentos",
    searchQuery: "DeFi crypto trends protocol yields TVL news July 2026 -NFT -DAO",
  },
  {
    id: "layer2",
    icon: "🔗",
    labelEn: "Layer 2",
    labelPt: "Layer 2",
    descEn: "Rollups, scaling, L2 ecosystem moves",
    descPt: "Rollups, escalabilidade, ecossistema L2",
    searchQuery: "Ethereum Layer 2 rollup scaling Base Arbitrum Optimism zkSync news July 2026 -NFT -DAO",
  },
  {
    id: "security",
    icon: "🔒",
    labelEn: "Security",
    labelPt: "Segurança",
    descEn: "Exploits, audits, vulnerability alerts",
    descPt: "Exploits, auditorias, alertas de risco",
    searchQuery: "crypto DeFi hack exploit vulnerability audit security alert July 2026 -NFT -DAO",
  },
  {
    id: "regulation",
    icon: "⚖️",
    labelEn: "Regulation",
    labelPt: "Regulação",
    descEn: "Compliance, legal frameworks, policy",
    descPt: "Compliance, marcos legais, política",
    searchQuery: "crypto regulation compliance MiCA SEC policy legal framework July 2026 -NFT -DAO",
  },
  {
    id: "airdrops",
    icon: "🎁",
    labelEn: "Airdrops",
    labelPt: "Airdrops",
    descEn: "Token distributions & farming signals",
    descPt: "Distribuições de tokens e sinais de farming",
    searchQuery: "crypto airdrop token distribution farming eligibility news July 2026 -NFT -DAO",
  },
];

const NFT_DAO_RE = /\b(nft|nfts|dao|daos|non-fungible|organiza[çc][ãa]o aut[oô]noma)\b/i;

const TOPIC_PATTERNS: Array<{ topic: Web3RadarTopic; re: RegExp }> = [
  { topic: "security", re: /\b(exploit|hack|hacked|vulnerabil|audit|seguran[çc]a|security alert|rug|drain)\b/i },
  { topic: "regulation", re: /\b(regulat|compliance|mica|sec\b|legal framework|regula[çc][ãa]o|pol[ií]tica crypto)\b/i },
  { topic: "airdrops", re: /\b(airdrop|airdrops|token distribution|distribui[çc][ãa]o de tokens|farming eligibility)\b/i },
  { topic: "layer2", re: /\b(layer\s*2|l2\b|rollup|rollups|optimistic rollup|zk\s*rollup|arbitrum|optimism|base chain|zksync)\b/i },
  { topic: "defi", re: /\b(defi|decentralized finance|finan[çc]as descentralizadas|yield|tvl|liquidity mining|protocol trend)\b/i },
];

const GENERIC_RADAR_RE =
  /\b(web3\s+(alpha|radar|briefing|intel)|alpha\s+radar|trend\s+call|briefing\s+web3|tend[êe]ncias?\s+web3|alertas?\s+de\s+risco|risk\s+alert)\b/i;

/** Detect briefing topic from natural language. Returns null for NFT/DAO-only asks. */
export function detectWeb3RadarTopic(text: string): Web3RadarTopic | null {
  const t = text.trim();
  if (!t) return null;
  if (NFT_DAO_RE.test(t) && !TOPIC_PATTERNS.some(({ re }) => re.test(t))) return null;
  for (const { topic, re } of TOPIC_PATTERNS) {
    if (re.test(t)) return topic;
  }
  if (GENERIC_RADAR_RE.test(t)) return "defi";
  return null;
}

function topicMeta(topic: Web3RadarTopic): Web3RadarTopicMeta {
  return WEB3_RADAR_TOPICS.find((x) => x.id === topic)!;
}

function filterResults(sr: SearchResponse): SearchResponse {
  const bad = (s: string) => NFT_DAO_RE.test(s);
  const results = sr.results.filter((r) => !bad(r.title) && !bad(r.content) && !bad(r.url));
  return { answer: sr.answer, results };
}

function formatSources(results: SearchResponse["results"], lang: "pt" | "en"): string {
  const lines = results.slice(0, 5).map((r, i) => {
    const title = r.title || r.url;
    return `${i + 1}. [${title}](${r.url})`;
  });
  if (lines.length === 0) return "";
  const head = lang === "pt" ? "**Fontes**" : "**Sources**";
  return `\n\n${head}\n${lines.join("\n")}`;
}

export function formatWeb3RadarBriefing(
  topic: Web3RadarTopic,
  sr: SearchResponse | null,
  lang: "pt" | "en",
): string {
  const meta = topicMeta(topic);
  const label = lang === "pt" ? meta.labelPt : meta.labelEn;
  const header =
    lang === "pt"
      ? `${meta.icon} **Briefing Web3 — ${label}**\n\n_Resumo estruturado com busca ao vivo (sem NFTs/DAOs)._`
      : `${meta.icon} **Web3 Briefing — ${label}**\n\n_Structured summary from live search (NFTs/DAOs excluded)._`;

  if (!sr || (!sr.answer && sr.results.length === 0)) {
    return (
      header +
      (lang === "pt"
        ? "\n\nNão consegui indexar feeds agora. Tente de novo em instantes ou reformule o tópico."
        : "\n\nCouldn't fetch live briefing data right now. Try again shortly or rephrase the topic.")
    );
  }

  const filtered = filterResults(sr);
  const ctx = formatSearchContext(filtered);
  const trends =
    lang === "pt"
      ? "**Tendências**\n" + (filtered.answer || ctx.split("\n").slice(0, 8).join("\n") || "—")
      : "**Trend calls**\n" + (filtered.answer || ctx.split("\n").slice(0, 8).join("\n") || "—");

  const highlights = filtered.results
    .slice(0, 4)
    .map((r) => (r.content || r.title).slice(0, 220))
    .filter(Boolean);

  const briefing =
    lang === "pt"
      ? "**Destaques**\n" + (highlights.length ? highlights.map((h) => `• ${h}`).join("\n") : "—")
      : "**Briefing**\n" + (highlights.length ? highlights.map((h) => `• ${h}`).join("\n") : "—");

  const riskBlock =
    topic === "security"
      ? lang === "pt"
        ? "\n\n**⚠️ Alertas de risco**\nPriorize revogar approvals suspeitos, pausar depósitos em protocolos afetados e confirmar contratos oficiais antes de assinar."
        : "\n\n**⚠️ Risk alerts**\nPrioritize revoking suspicious approvals, pausing deposits on affected protocols, and verifying official contracts before signing."
      : "";

  const pharosNote =
    lang === "pt"
      ? "\n\n_Para operar na Pharos (swap, stake, allowances): use os fluxos DeFi deste agente ou abra https://pharos-agent-pi.vercel.app/chat_"
      : "\n\n_To act on Pharos (swap, stake, allowances): use this agent's DeFi flows or open https://pharos-agent-pi.vercel.app/chat_";

  return [header, "", trends, "", briefing, riskBlock, formatSources(filtered.results, lang), pharosNote].join("\n");
}

export async function fetchWeb3RadarBriefing(topic: Web3RadarTopic, lang: "pt" | "en" = "en"): Promise<string> {
  const meta = topicMeta(topic);
  const sr = await webSearch(meta.searchQuery);
  return formatWeb3RadarBriefing(topic, sr, lang);
}
