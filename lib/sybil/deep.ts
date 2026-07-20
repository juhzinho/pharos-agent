import type { SybilSignal } from "@/lib/sybil/types";
import type { WalletIntel } from "@/lib/walletIntel";
import type { ExplorerTransfer, ExplorerTx } from "@/lib/sybil/explorer";
import { checkBlocklist, loadBlocklist } from "@/lib/sybil/blocklist";

function cv(values: number[]): number | null {
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return null;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export interface DeepAnalysisResult {
  signals: SybilSignal[];
  erc20TopFunderShare: number;
  calldataFingerprint: string | null;
  calldataRepeatCount: number;
  dormancyDays: number | null;
  postDormancyBurst: number;
  gasFeeCv: number | null;
  rootFunder: string | null;
  blocklistHit: boolean;
}

export function analyzeErc20Funding(
  addr: string,
  transfers: ExplorerTransfer[],
): { signal: SybilSignal | null; topShare: number } {
  const funders = new Map<string, number>();
  let totalIn = 0;
  for (const t of transfers) {
    if (t.to_address?.toLowerCase() !== addr) continue;
    const amt = parseFloat(t.value || "0") || 0;
    if (amt <= 0) continue;
    totalIn += amt;
    const from = t.from_address?.toLowerCase() ?? "";
    if (from) funders.set(from, (funders.get(from) ?? 0) + amt);
  }
  if (totalIn <= 0 || funders.size === 0) return { signal: null, topShare: 0 };
  const top = Math.max(...funders.values());
  const topShare = top / totalIn;
  let signal: SybilSignal | null = null;
  if (topShare >= 0.8 && funders.size <= 2) {
    signal = {
      id: "erc20-centralized-funding",
      severity: "critical",
      weight: 24,
      titleEn: "Centralized ERC-20 funding",
      titlePt: "Funding ERC-20 centralizado",
      detailEn: `${(topShare * 100).toFixed(0)}% of inbound tokens from 1–2 addresses — Sybil dispenser pattern.`,
      detailPt: `${(topShare * 100).toFixed(0)}% dos tokens recebidos de 1–2 endereços — padrão dispenser Sybil.`,
    };
  }
  return { signal, topShare };
}

export function analyzeCalldataFingerprint(outgoing: ExplorerTx[]): {
  signal: SybilSignal | null;
  fingerprint: string | null;
  repeatCount: number;
} {
  const counts = new Map<string, number>();
  for (const tx of outgoing) {
    const to = tx.to_address?.toLowerCase() ?? "";
    const method = (tx.method_id ?? "0x").toLowerCase();
    if (!to || method === "0x") continue;
    const key = `${to}:${method}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, c] of counts) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  if (bestCount >= 8 && outgoing.length >= 10 && bestCount / outgoing.length >= 0.6) {
    return {
      fingerprint: best,
      repeatCount: bestCount,
      signal: {
        id: "calldata-fingerprint",
        severity: "high",
        weight: 19,
        titleEn: "Repeated calldata fingerprint",
        titlePt: "Fingerprint de calldata repetido",
        detailEn: `${bestCount} txs share contract+method \`${best}\` — scripted bot template.`,
        detailPt: `${bestCount} txs com o mesmo contrato+método \`${best}\` — template de bot scriptado.`,
      },
    };
  }
  return { fingerprint: best, repeatCount: bestCount, signal: null };
}

export function analyzeDormancySpike(outgoing: ExplorerTx[]): {
  signal: SybilSignal | null;
  dormancyDays: number | null;
  burstCount: number;
} {
  if (outgoing.length < 12) return { signal: null, dormancyDays: null, burstCount: 0 };
  const sorted = [...outgoing].sort((a, b) => a.block_timestamp.localeCompare(b.block_timestamp));
  let maxGapDays = 0;
  let gapEndIdx = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (new Date(sorted[i].block_timestamp).getTime() - new Date(sorted[i - 1].block_timestamp).getTime()) / 86_400_000;
    if (gap > maxGapDays) { maxGapDays = gap; gapEndIdx = i; }
  }
  const afterGap = sorted.length - gapEndIdx;
  if (maxGapDays >= 45 && afterGap >= 8 && afterGap / sorted.length >= 0.5) {
    return {
      dormancyDays: maxGapDays,
      burstCount: afterGap,
      signal: {
        id: "dormancy-spike",
        severity: "medium",
        weight: 14,
        titleEn: "Dormancy then activity spike",
        titlePt: "Dormência e pico de atividade",
        detailEn: `${Math.round(maxGapDays)}d idle then ${afterGap} txs — classic airdrop-season farm pattern.`,
        detailPt: `${Math.round(maxGapDays)}d parada depois ${afterGap} txs — padrão clássico de farm na season de airdrop.`,
      },
    };
  }
  return { signal: null, dormancyDays: maxGapDays, burstCount: afterGap };
}

export function analyzeGasUniformity(outgoing: ExplorerTx[]): { signal: SybilSignal | null; gasFeeCv: number | null } {
  const fees = outgoing
    .map((t) => parseFloat(t.transaction_fee || "0") || 0)
    .filter((f) => f > 0);
  const gasFeeCv = cv(fees);
  if (gasFeeCv != null && gasFeeCv < 0.08 && fees.length >= 15) {
    return {
      gasFeeCv,
      signal: {
        id: "uniform-gas",
        severity: "medium",
        weight: 11,
        titleEn: "Uniform gas fees",
        titlePt: "Taxas de gas uniformes",
        detailEn: `Gas fees vary very little (CV ${gasFeeCv.toFixed(3)}) across ${fees.length} txs — automated script.`,
        detailPt: `Taxas de gas quase idênticas (CV ${gasFeeCv.toFixed(3)}) em ${fees.length} txs — script automatizado.`,
      },
    };
  }
  return { signal: null, gasFeeCv };
}

export function analyzeBlocklistHits(
  addr: string,
  funders: string[],
  blocklist = loadBlocklist(),
): { signal: SybilSignal | null; hit: boolean } {
  const self = checkBlocklist(addr, blocklist);
  if (self.hit) {
    return {
      hit: true,
      signal: {
        id: "blocklist-hit",
        severity: "critical",
        weight: 35,
        titleEn: "Blocklisted address",
        titlePt: "Endereço na blocklist",
        detailEn: `Address matches curated Sybil blocklist (${self.label}).`,
        detailPt: `Endereço consta na blocklist Sybil curada (${self.label}).`,
      },
    };
  }
  for (const f of funders) {
    const r = checkBlocklist(f, blocklist);
    if (r.hit) {
      return {
        hit: true,
        signal: {
          id: "funder-blocklist",
          severity: "critical",
          weight: 30,
          titleEn: "Funded by blocklisted dispenser",
          titlePt: "Financiado por dispenser blocklist",
          detailEn: `Primary funder \`${f.slice(0, 10)}…\` is on Sybil blocklist (${r.label}).`,
          detailPt: `Financiador principal \`${f.slice(0, 10)}…\` está na blocklist Sybil (${r.label}).`,
        },
      };
    }
  }
  return { signal: null, hit: false };
}

export function runDeepAnalysis(
  addr: string,
  outgoing: ExplorerTx[],
  incoming: ExplorerTx[],
  transfers: ExplorerTransfer[],
  intel: WalletIntel,
  rootFunder: string | null,
): DeepAnalysisResult {
  const signals: SybilSignal[] = [];
  const erc20 = analyzeErc20Funding(addr, transfers);
  if (erc20.signal) signals.push(erc20.signal);

  const calldata = analyzeCalldataFingerprint(outgoing);
  if (calldata.signal) signals.push(calldata.signal);

  const dormancy = analyzeDormancySpike(outgoing);
  if (dormancy.signal) signals.push(dormancy.signal);

  const gas = analyzeGasUniformity(outgoing);
  if (gas.signal) signals.push(gas.signal);

  const nativeFunders = incoming.map((t) => t.from_address?.toLowerCase()).filter(Boolean) as string[];
  const erc20Funders = transfers
    .filter((t) => t.to_address?.toLowerCase() === addr)
    .map((t) => t.from_address?.toLowerCase())
    .filter(Boolean) as string[];
  const block = analyzeBlocklistHits(addr, [...nativeFunders, ...erc20Funders, rootFunder].filter(Boolean) as string[]);
  if (block.signal) signals.push(block.signal);

  return {
    signals,
    erc20TopFunderShare: erc20.topShare,
    calldataFingerprint: calldata.fingerprint,
    calldataRepeatCount: calldata.repeatCount,
    dormancyDays: dormancy.dormancyDays,
    postDormancyBurst: dormancy.burstCount,
    gasFeeCv: gas.gasFeeCv,
    rootFunder,
    blocklistHit: block.hit,
  };
}
