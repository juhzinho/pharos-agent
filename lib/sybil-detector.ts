// Sybil & bot detection — Phases 1–4 (on-chain + reputation + cluster + campaign).
// Read-only; probabilistic scoring, not proof of identity.

import { getWalletIntel, type WalletIntel } from "@/lib/walletIntel";
import { analyzeCampaignCorrelation } from "@/lib/sybil/campaign";
import { runDeepAnalysis } from "@/lib/sybil/deep";
import { fetchPrimaryFunder, fetchWalletTransfers, fetchWalletTxs, type ExplorerTx } from "@/lib/sybil/explorer";
import { analyzeClusterGraph, traceFundingRoot } from "@/lib/sybil/graph";
import { fetchReputationBundle } from "@/lib/sybil/reputation";
import { computeCompositeScore, verdictFor } from "@/lib/sybil/score";
import type {
  SybilConfidence,
  SybilMetrics,
  SybilPhases,
  SybilSignal,
  SybilSeverity,
  SybilVerdict,
} from "@/lib/sybil/types";

export type { SybilConfidence, SybilMetrics, SybilPhases, SybilSignal, SybilSeverity, SybilVerdict };

export interface SybilReputationSummary {
  trustaAvailable: boolean;
  trustaSybilScore: number | null;
  trustaLevel: string | null;
  passportAvailable: boolean;
  passportScore: number | null;
  passportPassing: boolean | null;
  ethTxCount: number | null;
  ethAgeDays: number | null;
  humanTrustScore: number;
  externalRiskScore: number;
}

export interface SybilReport {
  address: string;
  /** Composite risk (Phases 1–4) — primary score for UI. */
  riskScore: number;
  onChainRisk: number;
  compositeRisk: number;
  verdict: SybilVerdict;
  confidence: SybilConfidence;
  signals: SybilSignal[];
  metrics: SybilMetrics;
  recommendationsEn: string[];
  recommendationsPt: string[];
  truncated: boolean;
  explorer: string;
  rootFunder: string | null;
  fundingChain: string[];
  activeCampaigns: string[];
  phases: SybilPhases;
  reputation: SybilReputationSummary;
}

export interface SybilClusterReport {
  addresses: string[];
  clusterRisk: number;
  verdict: SybilVerdict;
  sharedSignals: SybilSignal[];
  wallets: SybilReport[];
  clusterNotesEn: string[];
  clusterNotesPt: string[];
  sharedRootFunders: string[];
  graphDensity: number;
}

function cv(values: number[]): number | null {
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return null;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function walletAgeDays(firstTxAt: string | null): number | null {
  if (!firstTxAt) return null;
  const first = new Date(firstTxAt).getTime();
  if (!Number.isFinite(first)) return null;
  return Math.max(0, (Date.now() - first) / 86_400_000);
}

function confidenceFor(sampled: number, signalCount: number): SybilConfidence {
  if (sampled >= 100 && signalCount >= 3) return "high";
  if (sampled >= 30 && signalCount >= 2) return "medium";
  return "low";
}

function pushSignal(signals: SybilSignal[], signal: SybilSignal | null) {
  if (signal) signals.push(signal);
}

function analyzeTiming(outgoing: ExplorerTx[]): { signal: SybilSignal | null; intervalCv: number | null; maxSameMinute: number } {
  const sorted = [...outgoing]
    .filter((t) => t.block_timestamp)
    .sort((a, b) => a.block_timestamp.localeCompare(b.block_timestamp));

  const minuteBuckets = new Map<string, number>();
  for (const t of sorted) {
    const key = t.block_timestamp.slice(0, 16);
    minuteBuckets.set(key, (minuteBuckets.get(key) ?? 0) + 1);
  }
  const maxSameMinute = minuteBuckets.size ? Math.max(...minuteBuckets.values()) : 0;

  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const dt = (new Date(sorted[i].block_timestamp).getTime() - new Date(sorted[i - 1].block_timestamp).getTime()) / 1000;
    if (dt >= 0 && dt < 86400 * 30) intervals.push(dt);
  }
  const intervalCv = cv(intervals);

  let signal: SybilSignal | null = null;
  if (intervalCv != null && intervalCv < 0.18 && intervals.length >= 12) {
    signal = {
      id: "robotic-timing",
      severity: "high",
      weight: 22,
      titleEn: "Robotic transaction timing",
      titlePt: "Timing robótico de transações",
      detailEn: `Inter-transaction intervals are unusually regular (CV ${intervalCv.toFixed(2)}) — typical of scripted bots.`,
      detailPt: `Intervalos entre transações muito regulares (CV ${intervalCv.toFixed(2)}) — típico de bots scriptados.`,
    };
  } else if (maxSameMinute >= 6 && sorted.length >= 10) {
    signal = {
      id: "burst-activity",
      severity: "high",
      weight: 18,
      titleEn: "Burst activity in short window",
      titlePt: "Rajada de atividade em janela curta",
      detailEn: `${maxSameMinute} outgoing txs within the same minute — common in farm scripts.`,
      detailPt: `${maxSameMinute} txs de saída no mesmo minuto — comum em scripts de farm.`,
    };
  }

  return { signal, intervalCv, maxSameMinute };
}

function analyzeFunding(incoming: ExplorerTx[]): { signal: SybilSignal | null; topFunderShare: number } {
  const funders = new Map<string, number>();
  let totalIn = 0;
  for (const tx of incoming) {
    const v = parseFloat(tx.value || "0") || 0;
    if (v <= 0) continue;
    totalIn += v;
    const from = tx.from_address?.toLowerCase() ?? "";
    if (from) funders.set(from, (funders.get(from) ?? 0) + v);
  }
  if (totalIn <= 0 || funders.size === 0) return { signal: null, topFunderShare: 0 };

  const top = Math.max(...funders.values());
  const topFunderShare = top / totalIn;

  let signal: SybilSignal | null = null;
  if (topFunderShare >= 0.85 && funders.size <= 2 && incoming.length >= 5) {
    signal = {
      id: "centralized-funding",
      severity: "critical",
      weight: 28,
      titleEn: "Centralized funding source",
      titlePt: "Fonte de funding centralizada",
      detailEn: `${(topFunderShare * 100).toFixed(0)}% of incoming PROS from 1–2 addresses — classic Sybil dispenser pattern.`,
      detailPt: `${(topFunderShare * 100).toFixed(0)}% dos PROS recebidos de 1–2 endereços — padrão clássico de dispenser Sybil.`,
    };
  } else if (topFunderShare >= 0.65 && incoming.length >= 8) {
    signal = {
      id: "funding-concentration",
      severity: "high",
      weight: 16,
      titleEn: "Concentrated inbound funding",
      titlePt: "Funding inbound concentrado",
      detailEn: `${(topFunderShare * 100).toFixed(0)}% of PROS inflows from a single funder.`,
      detailPt: `${(topFunderShare * 100).toFixed(0)}% dos PROS recebidos de um único financiador.`,
    };
  }

  return { signal, topFunderShare };
}

function analyzeCounterparties(outgoing: ExplorerTx[]): { signal: SybilSignal | null; uniqueCounterparties: number } {
  const targets = new Set<string>();
  for (const tx of outgoing) {
    const to = tx.to_address?.toLowerCase();
    if (to) targets.add(to);
  }
  const uniqueCounterparties = targets.size;
  const ratio = outgoing.length > 0 ? uniqueCounterparties / outgoing.length : 1;

  let signal: SybilSignal | null = null;
  if (outgoing.length >= 20 && ratio < 0.12) {
    signal = {
      id: "low-counterparty-diversity",
      severity: "medium",
      weight: 14,
      titleEn: "Low counterparty diversity",
      titlePt: "Baixa diversidade de contrapartes",
      detailEn: `Only ${uniqueCounterparties} unique destinations across ${outgoing.length} outgoing txs — repetitive routing.`,
      detailPt: `Apenas ${uniqueCounterparties} destinos únicos em ${outgoing.length} txs de saída — roteamento repetitivo.`,
    };
  }

  return { signal, uniqueCounterparties };
}

function analyzeActivityMix(intel: WalletIntel): { signals: SybilSignal[]; approvalShare: number; swapShare: number } {
  const signals: SybilSignal[] = [];
  const total =
    intel.activity.swaps + intel.activity.bridges + intel.activity.liquidity +
    intel.activity.approvals + intel.activity.transfers + intel.activity.wraps + intel.activity.contractCalls;
  const approvalShare = total > 0 ? intel.activity.approvals / total : 0;
  const swapShare = total > 0 ? intel.activity.swaps / total : 0;

  if (total >= 15 && approvalShare >= 0.7 && intel.protocols.length <= 1) {
    signals.push({
      id: "approval-farm",
      severity: "high",
      weight: 20,
      titleEn: "Approval-only farm pattern",
      titlePt: "Padrão de farm só com approvals",
      detailEn: `${(approvalShare * 100).toFixed(0)}% of activity is approvals with minimal protocol usage — typical airdrop farming.`,
      detailPt: `${(approvalShare * 100).toFixed(0)}% da atividade são approvals com pouco uso de protocolo — típico de farm de airdrop.`,
    });
  }

  if (intel.txTotal >= 25 && intel.protocols.length === 0 && intel.activity.swaps + intel.activity.liquidity === 0) {
    signals.push({
      id: "no-organic-defi",
      severity: "medium",
      weight: 15,
      titleEn: "No organic DeFi footprint",
      titlePt: "Sem pegada DeFi orgânica",
      detailEn: "Many transactions but zero detected swaps, liquidity, or known protocol interactions.",
      detailPt: "Muitas transações mas zero swaps, liquidez ou interações com protocolos conhecidos.",
    });
  }

  if (total >= 10 && swapShare >= 0.8 && intel.activeMonths <= 1 && intel.txTotal >= 30) {
    signals.push({
      id: "swap-bot",
      severity: "medium",
      weight: 12,
      titleEn: "Swap-heavy bot profile",
      titlePt: "Perfil bot com foco em swaps",
      detailEn: "Very high swap ratio on a young wallet — possible volume bot or wash pattern.",
      detailPt: "Taxa de swap muito alta em carteira jovem — possível bot de volume ou wash trading.",
    });
  }

  return { signals, approvalShare, swapShare };
}

function analyzeShellWallet(intel: WalletIntel, ageDays: number | null): SybilSignal | null {
  const holdingValue = intel.holdings.reduce((s, h) => s + h.balance, 0);
  if (intel.txTotal >= 20 && intel.protocols.length === 0 && holdingValue < 0.05 && intel.gasSpentPros < 0.001) {
    return {
      id: "empty-shell",
      severity: "high",
      weight: 18,
      titleEn: "Empty shell wallet",
      titlePt: "Carteira shell vazia",
      detailEn: "High tx count but near-zero holdings and minimal gas — likely disposable Sybil wallet.",
      detailPt: "Muito histórico mas saldo ~zero e gás mínimo — provável carteira Sybil descartável.",
    };
  }
  if (ageDays != null && ageDays <= 7 && intel.txTotal >= 40) {
    return {
      id: "fresh-burst",
      severity: "high",
      weight: 20,
      titleEn: "Fresh wallet activity burst",
      titlePt: "Rajada em carteira nova",
      detailEn: `Wallet age ~${Math.round(ageDays)} days with ${intel.txTotal} txs — suspicious Sybil sprint.`,
      detailPt: `Carteira com ~${Math.round(ageDays)} dias e ${intel.txTotal} txs — sprint Sybil suspeito.`,
    };
  }
  return null;
}

function analyzeRoundTrip(intel: WalletIntel): SybilSignal | null {
  if (intel.nativeIn <= 0 || intel.nativeOut <= 0) return null;
  const net = Math.abs(intel.nativeIn - intel.nativeOut);
  const gross = intel.nativeIn + intel.nativeOut;
  if (gross >= 10 && net / gross < 0.05 && intel.txTotal >= 15) {
    return {
      id: "round-trip",
      severity: "medium",
      weight: 12,
      titleEn: "Round-trip PROS flow",
      titlePt: "Fluxo PROS ida-e-volta",
      detailEn: "Inbound and outbound PROS nearly cancel out — possible wash or relay between Sybil wallets.",
      detailPt: "PROS entrando e saindo quase se cancelam — possível wash ou relay entre carteiras Sybil.",
    };
  }
  return null;
}

function analyzeFailures(intel: WalletIntel, outgoingCount: number): SybilSignal | null {
  if (outgoingCount < 10) return null;
  const rate = intel.failedTxs / outgoingCount;
  if (rate >= 0.35) {
    return {
      id: "probe-failures",
      severity: "medium",
      weight: 10,
      titleEn: "High failed-tx probing",
      titlePt: "Muitas txs falhadas (probing)",
      detailEn: `${(rate * 100).toFixed(0)}% of outgoing txs failed — bots often probe contracts until one succeeds.`,
      detailPt: `${(rate * 100).toFixed(0)}% das txs de saída falharam — bots costumam sondar contratos até funcionar.`,
    };
  }
  return null;
}

function humanBonus(intel: WalletIntel): { bonus: number; signals: SybilSignal[] } {
  const signals: SybilSignal[] = [];
  let bonus = 0;

  if (intel.protocols.length >= 3) {
    bonus += 12;
    signals.push({
      id: "multi-protocol",
      severity: "low",
      weight: -12,
      titleEn: "Multi-protocol usage (human signal)",
      titlePt: "Uso multi-protocolo (sinal humano)",
      detailEn: `Interacted with ${intel.protocols.length} protocols — organic DeFi behavior.`,
      detailPt: `Interagiu com ${intel.protocols.length} protocolos — comportamento DeFi orgânico.`,
    });
  }
  if (intel.activeMonths >= 4) {
    bonus += 10;
    signals.push({
      id: "long-activity",
      severity: "low",
      weight: -10,
      titleEn: "Sustained activity over months",
      titlePt: "Atividade sustentada por meses",
      detailEn: `${intel.activeMonths} active months — Sybil farms rarely maintain long horizons.`,
      detailPt: `${intel.activeMonths} meses ativos — farms Sybil raramente mantêm horizonte longo.`,
    });
  }
  if (intel.flags.includes("rwa-investor") || intel.flags.includes("defi-power-user")) {
    bonus += 8;
    signals.push({
      id: "power-user",
      severity: "low",
      weight: -8,
      titleEn: "Power-user / RWA profile",
      titlePt: "Perfil power-user / RWA",
      detailEn: "RealFi or deep DeFi usage detected — lowers bot probability.",
      detailPt: "Uso RealFi ou DeFi profundo detectado — reduz probabilidade de bot.",
    });
  }
  if (intel.gasSpentPros >= 0.5 && intel.txTotal >= 50) {
    bonus += 6;
    signals.push({
      id: "meaningful-gas",
      severity: "low",
      weight: -6,
      titleEn: "Meaningful gas spend",
      titlePt: "Gasto de gás relevante",
      detailEn: `${intel.gasSpentPros.toFixed(3)} PROS in gas — costly for disposable Sybil wallets.`,
      detailPt: `${intel.gasSpentPros.toFixed(3)} PROS em gás — caro para carteiras Sybil descartáveis.`,
    });
  }

  return { bonus, signals };
}

function buildRecommendations(
  verdict: SybilVerdict,
  signals: SybilSignal[],
  reputation: SybilReputationSummary,
  lang: "en" | "pt",
): string[] {
  const has = (id: string) => signals.some((s) => s.id === id);
  if (lang === "pt") {
    const r: string[] = [];
    if (verdict === "likely_human") r.push("Perfil compatível com uso orgânico — ainda assim, nunca confie só em heurísticas on-chain.");
    if (verdict === "mixed") r.push("Sinais mistos: exija prova adicional (PoH, Gitcoin Passport, Trusta MEDIA) antes de recompensas.");
    if (verdict === "likely_bot" || verdict === "likely_sybil") {
      r.push("Evite elegibilidade automática para airdrops/campanhas até revisão manual.");
      r.push("Compare funding sources e timing com outras carteiras do mesmo cluster.");
    }
    if (has("centralized-funding") || has("funding-concentration") || has("erc20-centralized-funding")) {
      r.push("Rastreie o financiador upstream — frequentemente é um dispenser Sybil.");
    }
    if (has("blocklist-hit") || has("funder-blocklist")) r.push("Endereço ou funder na blocklist curada — trate como alto risco imediato.");
    if (has("approval-farm")) r.push("Revogue approvals não usados (revoke.cash) se esta for sua carteira.");
    if (has("robotic-timing") || has("burst-activity") || has("calldata-fingerprint")) {
      r.push("Automatização detectada: valide se é MEV bot legítimo ou farm script.");
    }
    if (has("campaign-farm-window")) r.push("Atividade coincide com campanhas Pharos ativas — correlacionar com outras carteiras do cluster.");
    if (reputation.passportPassing) r.push("Gitcoin Passport aprovado — sinal humano forte para elegibilidade.");
    return r;
  }
  const r: string[] = [];
  if (verdict === "likely_human") r.push("Profile looks organic — never rely on on-chain heuristics alone.");
  if (verdict === "mixed") r.push("Mixed signals: require extra proof (PoH, Gitcoin Passport, Trusta MEDIA) before rewards.");
  if (verdict === "likely_bot" || verdict === "likely_sybil") {
    r.push("Avoid automatic airdrop/campaign eligibility until manual review.");
    r.push("Compare funding sources and timing against other wallets in the same cluster.");
  }
  if (has("centralized-funding") || has("funding-concentration") || has("erc20-centralized-funding")) {
    r.push("Trace the upstream funder — often a Sybil dispenser.");
  }
  if (has("blocklist-hit") || has("funder-blocklist")) r.push("Address or funder on curated blocklist — treat as immediate high risk.");
  if (has("approval-farm")) r.push("Revoke unused approvals (revoke.cash) if this is your wallet.");
  if (has("robotic-timing") || has("burst-activity") || has("calldata-fingerprint")) {
    r.push("Automation detected: validate whether it's a legitimate MEV bot or farm script.");
  }
  if (has("campaign-farm-window")) r.push("Activity overlaps active Pharos campaigns — correlate with other cluster wallets.");
  if (reputation.passportPassing) r.push("Gitcoin Passport passing — strong human signal for eligibility.");
  return r;
}

function summarizeReputation(rep: Awaited<ReturnType<typeof fetchReputationBundle>>): SybilReputationSummary {
  return {
    trustaAvailable: rep.trusta.available,
    trustaSybilScore: rep.trusta.sybilScore ?? null,
    trustaLevel: rep.trusta.sybilLevel ?? null,
    passportAvailable: rep.passport.available,
    passportScore: rep.passport.score ?? null,
    passportPassing: rep.passport.passing ?? null,
    ethTxCount: rep.eth.txCount ?? null,
    ethAgeDays: rep.eth.ageDays ?? null,
    humanTrustScore: rep.humanTrustScore,
    externalRiskScore: rep.externalRiskScore,
  };
}

export async function runSybilAnalysis(address: string): Promise<SybilReport> {
  const addr = address.toLowerCase();
  const [intel, txFeed, transferFeed, rootFunder, fundingChain, reputationBundle] = await Promise.all([
    getWalletIntel(address),
    fetchWalletTxs(address),
    fetchWalletTransfers(address),
    fetchPrimaryFunder(addr),
    traceFundingRoot(addr, 3),
    fetchReputationBundle(address),
  ]);

  const txs = txFeed.rows;
  const outgoing = txs.filter((t) => t.from_address?.toLowerCase() === addr);
  const incoming = txs.filter((t) => t.to_address?.toLowerCase() === addr && t.from_address?.toLowerCase() !== addr);

  const signals: SybilSignal[] = [];
  const timing = analyzeTiming(outgoing);
  pushSignal(signals, timing.signal);

  const funding = analyzeFunding(incoming);
  pushSignal(signals, funding.signal);

  const counter = analyzeCounterparties(outgoing);
  pushSignal(signals, counter.signal);

  const mix = analyzeActivityMix(intel);
  signals.push(...mix.signals);

  const ageDays = walletAgeDays(intel.firstTxAt);
  pushSignal(signals, analyzeShellWallet(intel, ageDays));
  pushSignal(signals, analyzeRoundTrip(intel));
  pushSignal(signals, analyzeFailures(intel, outgoing.length));

  const human = humanBonus(intel);
  signals.push(...human.signals);

  const deep = runDeepAnalysis(addr, outgoing, incoming, transferFeed.rows, intel, rootFunder);
  signals.push(...deep.signals);

  const campaign = await analyzeCampaignCorrelation(intel.lastTxAt, intel.firstTxAt, intel.txTotal);
  pushSignal(signals, campaign.signal);

  const onChainRaw = signals.reduce((s, sig) => s + sig.weight, 0);
  const onChainRisk = Math.max(0, Math.min(100, Math.round(onChainRaw)));

  const reputation = summarizeReputation(reputationBundle);
  const { compositeRisk } = computeCompositeScore(onChainRisk, reputationBundle);
  const verdict = verdictFor(compositeRisk);
  const confidence = confidenceFor(txs.length, signals.filter((s) => s.weight > 0).length);

  const positiveSignals = signals.filter((s) => s.weight > 0);
  const negativeSignals = signals.filter((s) => s.weight < 0);

  const phases: SybilPhases = {
    phase2Deep: true,
    phase3Reputation: reputation.trustaAvailable || reputation.passportAvailable || reputation.ethTxCount != null,
    phase4Graph: false,
    phase4Campaign: campaign.activeCampaigns.length > 0 || campaign.signal != null,
  };

  return {
    address,
    riskScore: compositeRisk,
    onChainRisk,
    compositeRisk,
    verdict,
    confidence,
    signals: [...positiveSignals.sort((a, b) => b.weight - a.weight), ...negativeSignals],
    metrics: {
      txTotal: intel.txTotal,
      txSampled: txs.length,
      outgoingTxs: outgoing.length,
      uniqueCounterparties: counter.uniqueCounterparties,
      topFunderShare: funding.topFunderShare,
      erc20TopFunderShare: deep.erc20TopFunderShare,
      intervalCv: timing.intervalCv,
      maxTxsSameMinute: timing.maxSameMinute,
      approvalShare: mix.approvalShare,
      swapShare: mix.swapShare,
      protocolCount: intel.protocols.length,
      activeMonths: intel.activeMonths,
      walletAgeDays: ageDays,
      holdingsCount: intel.holdings.length,
      failedRate: outgoing.length > 0 ? intel.failedTxs / outgoing.length : 0,
      humanBonus: human.bonus,
      onChainRisk,
      compositeRisk,
      trustaSybilScore: reputation.trustaSybilScore,
      passportScore: reputation.passportScore,
      ethTxCount: reputation.ethTxCount,
    },
    recommendationsEn: buildRecommendations(verdict, signals, reputation, "en"),
    recommendationsPt: buildRecommendations(verdict, signals, reputation, "pt"),
    truncated: intel.truncated || txFeed.total > txs.length,
    explorer: intel.explorer,
    rootFunder,
    fundingChain,
    activeCampaigns: campaign.activeCampaigns,
    phases,
    reputation,
  };
}

export async function runSybilClusterAnalysis(addresses: string[]): Promise<SybilClusterReport> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))].slice(0, 10);
  const [wallets, graph] = await Promise.all([
    Promise.all(unique.map((a) => runSybilAnalysis(a))),
    analyzeClusterGraph(unique),
  ]);

  const clusterSignals: SybilSignal[] = [...graph.signals];
  const notesEn: string[] = [];
  const notesPt: string[] = [];

  const ages = wallets.map((w) => w.metrics.walletAgeDays).filter((d): d is number => d != null);
  if (ages.length >= 2) {
    const span = Math.max(...ages) - Math.min(...ages);
    if (span <= 3 && wallets.every((w) => w.metrics.txTotal >= 15)) {
      clusterSignals.push({
        id: "cluster-synchronized-age",
        severity: "high",
        weight: 20,
        titleEn: "Synchronized wallet ages",
        titlePt: "Idades de carteira sincronizadas",
        detailEn: "Wallets created within a few days and all active — coordinated Sybil batch.",
        detailPt: "Carteiras criadas em poucos dias e todas ativas — lote Sybil coordenado.",
      });
    }
  }

  const txCounts = wallets.map((w) => w.metrics.txTotal);
  if (txCounts.length >= 3) {
    const mean = txCounts.reduce((a, b) => a + b, 0) / txCounts.length;
    const variance = txCounts.reduce((s, v) => s + (v - mean) ** 2, 0) / txCounts.length;
    const txCv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    if (txCv < 0.15 && mean >= 20) {
      clusterSignals.push({
        id: "cluster-uniform-volume",
        severity: "medium",
        weight: 15,
        titleEn: "Uniform transaction counts",
        titlePt: "Contagens de tx uniformes",
        detailEn: "Very similar tx volumes across wallets — template farm behavior.",
        detailPt: "Volumes de tx muito similares entre carteiras — comportamento de farm template.",
      });
    }
  }

  const highRisk = wallets.filter((w) => w.riskScore >= 51).length;
  if (highRisk >= 2 && unique.length >= 2) {
    notesEn.push(`${highRisk}/${unique.length} wallets flagged as bot/Sybil likely.`);
    notesPt.push(`${highRisk}/${unique.length} carteiras marcadas como bot/Sybil provável.`);
  }

  if (graph.sharedRootFunders.length > 0) {
    notesEn.push(`Shared root funder detected: ${graph.sharedRootFunders[0].slice(0, 10)}…`);
    notesPt.push(`Financiador raiz compartilhado: ${graph.sharedRootFunders[0].slice(0, 10)}…`);
  }

  const avgComposite = wallets.reduce((s, w) => s + w.compositeRisk, 0) / wallets.length;
  const graphBoost = clusterSignals.reduce((s, sig) => s + sig.weight, 0) / Math.max(1, wallets.length);
  const clusterRisk = Math.min(100, Math.round(avgComposite + graphBoost * 0.35));

  for (const w of wallets) {
    w.phases.phase4Graph = true;
  }

  return {
    addresses: unique,
    clusterRisk,
    verdict: verdictFor(clusterRisk),
    sharedSignals: clusterSignals,
    wallets,
    clusterNotesEn: notesEn,
    clusterNotesPt: notesPt,
    sharedRootFunders: graph.sharedRootFunders,
    graphDensity: graph.graphDensity,
  };
}

export function formatSybilIntro(report: SybilReport, lang: "pt" | "en"): string {
  const short = `${report.address.slice(0, 6)}…${report.address.slice(-4)}`;
  return lang === "pt"
    ? `🛡️ **Análise Sybil/Bot (Fases 1–4)** — \`${short}\``
    : `🛡️ **Sybil/Bot Analysis (Phases 1–4)** — \`${short}\``;
}

export function formatSybilReport(report: SybilReport, lang: "pt" | "en"): string {
  const verdictLabel = {
    likely_human: lang === "pt" ? "Provável humano" : "Likely human",
    mixed: lang === "pt" ? "Sinais mistos" : "Mixed signals",
    likely_bot: lang === "pt" ? "Provável bot" : "Likely bot",
    likely_sybil: lang === "pt" ? "Provável Sybil" : "Likely Sybil",
  }[report.verdict];

  const conf = lang === "pt"
    ? { low: "baixa", medium: "média", high: "alta" }[report.confidence]
    : report.confidence;

  const short = `${report.address.slice(0, 6)}…${report.address.slice(-4)}`;
  const scoreLine = lang === "pt"
    ? `**Risco composto:** ${report.compositeRisk}/100 · **On-chain:** ${report.onChainRisk}/100 · **Veredito:** ${verdictLabel} · **Confiança:** ${conf}`
    : `**Composite risk:** ${report.compositeRisk}/100 · **On-chain:** ${report.onChainRisk}/100 · **Verdict:** ${verdictLabel} · **Confidence:** ${conf}`;

  const head = lang === "pt"
    ? `🛡️ **Análise Sybil/Bot (Fases 1–4)** — \`${short}\`\n\n${scoreLine}`
    : `🛡️ **Sybil/Bot Analysis (Phases 1–4)** — \`${short}\`\n\n${scoreLine}`;

  const riskSignals = report.signals.filter((s) => s.weight > 0);
  const humanSignals = report.signals.filter((s) => s.weight < 0);

  const riskBlock = riskSignals.length
    ? (lang === "pt" ? "**Sinais de risco**" : "**Risk signals**") + "\n" +
      riskSignals.map((s) => `• **${lang === "pt" ? s.titlePt : s.titleEn}** — ${lang === "pt" ? s.detailPt : s.detailEn}`).join("\n")
    : lang === "pt" ? "_Nenhum sinal de risco forte detectado._" : "_No strong risk signals detected._";

  const humanBlock = humanSignals.length
    ? "\n\n" + (lang === "pt" ? "**Sinais humanos**" : "**Human signals**") + "\n" +
      humanSignals.map((s) => `• ${lang === "pt" ? s.titlePt : s.titleEn}`).join("\n")
    : "";

  const rep = report.reputation;
  let repBlock = "";
  if (rep.trustaAvailable || rep.passportAvailable || rep.ethTxCount != null) {
    const parts: string[] = [];
    if (rep.trustaAvailable && rep.trustaSybilScore != null) {
      parts.push(lang === "pt"
        ? `Trusta Sybil: ${rep.trustaSybilScore}/100${rep.trustaLevel ? ` (${rep.trustaLevel})` : ""}`
        : `Trusta Sybil: ${rep.trustaSybilScore}/100${rep.trustaLevel ? ` (${rep.trustaLevel})` : ""}`);
    }
    if (rep.passportAvailable && rep.passportScore != null) {
      parts.push(lang === "pt"
        ? `Passport: ${rep.passportScore}${rep.passportPassing ? " ✓" : ""}`
        : `Passport: ${rep.passportScore}${rep.passportPassing ? " ✓" : ""}`);
    }
    if (rep.ethTxCount != null) {
      parts.push(lang === "pt" ? `ETH txs: ${rep.ethTxCount}` : `ETH txs: ${rep.ethTxCount}`);
    }
    if (parts.length) {
      repBlock = "\n\n" + (lang === "pt" ? "**Reputação externa**" : "**External reputation**") + "\n" + parts.map((p) => `• ${p}`).join("\n");
    }
  }

  if (report.rootFunder) {
    repBlock += `\n• ${lang === "pt" ? "Funder raiz" : "Root funder"}: \`${report.rootFunder.slice(0, 10)}…\``;
  }

  const recs = (lang === "pt" ? report.recommendationsPt : report.recommendationsEn)
    .map((r) => `• ${r}`).join("\n");
  const recBlock = recs ? `\n\n${lang === "pt" ? "**Recomendações**" : "**Recommendations**"}\n${recs}` : "";

  const trunc = report.truncated
    ? (lang === "pt" ? "\n\n_Amostra parcial do histórico — risco real pode ser maior._" : "\n\n_Partial history sample — true risk may be higher._")
    : "";

  return head + "\n\n" + riskBlock + humanBlock + repBlock + recBlock + trunc;
}

export function formatSybilClusterReport(cluster: SybilClusterReport, lang: "pt" | "en"): string {
  const head = lang === "pt"
    ? `🛡️ **Análise de cluster Sybil (Fase 4)** — ${cluster.addresses.length} carteiras · risco **${cluster.clusterRisk}/100**`
    : `🛡️ **Sybil cluster analysis (Phase 4)** — ${cluster.addresses.length} wallets · risk **${cluster.clusterRisk}/100**`;

  const shared = cluster.sharedSignals.length
    ? "\n\n" + (lang === "pt" ? "**Sinais de cluster**" : "**Cluster signals**") + "\n" +
      cluster.sharedSignals.map((s) => `• **${lang === "pt" ? s.titlePt : s.titleEn}** — ${lang === "pt" ? s.detailPt : s.detailEn}`).join("\n")
    : "";

  const walletLines = cluster.wallets.map((w) => {
    const v = lang === "pt"
      ? { likely_human: "humano", mixed: "misto", likely_bot: "bot", likely_sybil: "sybil" }[w.verdict]
      : w.verdict.replace("likely_", "");
    return `• \`${w.address.slice(0, 8)}…\` — ${w.compositeRisk}/100 on-chain ${w.onChainRisk} (${v})`;
  }).join("\n");

  const notes = (lang === "pt" ? cluster.clusterNotesPt : cluster.clusterNotesEn).join("\n");

  return [head, shared, "\n\n" + (lang === "pt" ? "**Por carteira**" : "**Per wallet**") + "\n" + walletLines, notes ? "\n\n" + notes : ""].join("");
}

export function detectSybilQuery(text: string): { mode: "single" | "cluster"; addresses: string[] } | null {
  const addresses = [...new Set((text.match(/0x[a-fA-F0-9]{40}/gi) ?? []).map((a) => a.toLowerCase()))];
  const sybilRe =
    /\b(sybil|anti-?sybil|bot\b|bots\b|farm\s*wallet|carteira\s*bot|detect\s*bot|é\s*bot|is\s*this\s*a\s*bot|airdrop\s*farm|wallet\s*farm|script\s*wallet|carteira\s*descart[aá]vel)\b/i;
  const checkRe =
    /\b(checar|verificar|check|analis|analy[sz]|scan|detect).{0,40}\b(bot|sybil|farm)\b/i;
  if (!sybilRe.test(text) && !checkRe.test(text)) return null;
  if (addresses.length >= 2) return { mode: "cluster", addresses };
  if (addresses.length === 1) return { mode: "single", addresses };
  return { mode: "single", addresses: [] };
}
