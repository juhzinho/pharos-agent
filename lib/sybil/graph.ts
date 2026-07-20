import type { SybilSignal } from "@/lib/sybil/types";
import { fetchPrimaryFunder, fetchWalletTxs } from "@/lib/sybil/explorer";

/** Trace funding chain up to `maxHops` (Phase 2 graph). */
export async function traceFundingRoot(address: string, maxHops = 3): Promise<string[]> {
  const chain: string[] = [];
  let current = address.toLowerCase();
  const seen = new Set<string>();
  for (let i = 0; i < maxHops; i++) {
    if (seen.has(current)) break;
    seen.add(current);
    const funder = await fetchPrimaryFunder(current);
    if (!funder || funder === current) break;
    chain.push(funder);
    current = funder;
  }
  return chain;
}

export interface ClusterGraphResult {
  signals: SybilSignal[];
  sharedRootFunders: string[];
  sharedFirstContracts: string[];
  graphDensity: number;
}

export async function analyzeClusterGraph(addresses: string[]): Promise<ClusterGraphResult> {
  const signals: SybilSignal[] = [];
  const funderSets = await Promise.all(addresses.map((a) => traceFundingRoot(a, 2)));
  const rootCounts = new Map<string, number>();
  for (const chain of funderSets) {
    const root = chain[chain.length - 1] ?? chain[0];
    if (root) rootCounts.set(root, (rootCounts.get(root) ?? 0) + 1);
  }
  const sharedRootFunders = [...rootCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([addr]) => addr);

  if (sharedRootFunders.length > 0 && addresses.length >= 2) {
    const top = sharedRootFunders[0];
    const n = rootCounts.get(top) ?? 0;
    signals.push({
      id: "cluster-shared-root-funder",
      severity: "critical",
      weight: 28,
      titleEn: "Shared root funder in cluster",
      titlePt: "Financiador raiz compartilhado no cluster",
      detailEn: `${n}/${addresses.length} wallets trace to the same upstream funder \`${top.slice(0, 10)}…\`.`,
      detailPt: `${n}/${addresses.length} carteiras rastreiam o mesmo financiador upstream \`${top.slice(0, 10)}…\`.`,
    });
  }

  const firstContracts = new Map<string, number>();
  for (const addr of addresses) {
    const { rows } = await fetchWalletTxs(addr);
    const outgoing = rows
      .filter((t) => t.from_address?.toLowerCase() === addr.toLowerCase())
      .sort((a, b) => a.block_timestamp.localeCompare(b.block_timestamp));
    const first = outgoing.find((t) => t.to_address)?.to_address?.toLowerCase();
    if (first) firstContracts.set(first, (firstContracts.get(first) ?? 0) + 1);
  }
  const sharedFirstContracts = [...firstContracts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);

  if (sharedFirstContracts.length > 0 && addresses.length >= 2) {
    signals.push({
      id: "cluster-shared-first-contract",
      severity: "high",
      weight: 18,
      titleEn: "Same first contract interaction",
      titlePt: "Mesmo primeiro contrato interagido",
      detailEn: `Multiple wallets' first outgoing tx targets \`${sharedFirstContracts[0].slice(0, 10)}…\`.`,
      detailPt: `Primeira tx de saída de várias carteiras aponta para \`${sharedFirstContracts[0].slice(0, 10)}…\`.`,
    });
  }

  const edges = addresses.length * (addresses.length - 1) / 2;
  const sharedEdges = sharedRootFunders.length > 0 ? (rootCounts.get(sharedRootFunders[0]) ?? 0) : 0;
  const graphDensity = edges > 0 ? sharedEdges / addresses.length : 0;

  return { signals, sharedRootFunders, sharedFirstContracts, graphDensity };
}
