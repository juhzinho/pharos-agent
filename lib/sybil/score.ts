import type { ReputationBundle } from "@/lib/sybil/reputation";

/** Phase 4 composite model — blends on-chain + external reputation. */
export function computeCompositeScore(
  onChainRisk: number,
  reputation: ReputationBundle,
  clusterBoost = 0,
): { compositeRisk: number; onChainWeight: number; externalWeight: number } {
  const hasExternal =
    reputation.trusta.available ||
    reputation.passport.available ||
    reputation.eth.available;

  let onChainWeight = hasExternal ? 0.5 : 0.85;
  let externalWeight = hasExternal ? 0.35 : 0;
  const humanWeight = hasExternal ? 0.15 : 0.15;

  const externalComponent = reputation.externalRiskScore;
  const humanReduction = reputation.humanTrustScore * humanWeight;

  let composite =
    onChainRisk * onChainWeight +
    externalComponent * externalWeight +
    clusterBoost * 0.1 -
    humanReduction;

  composite = Math.max(0, Math.min(100, Math.round(composite)));
  return { compositeRisk: composite, onChainWeight, externalWeight };
}

export function verdictFor(score: number): "likely_human" | "mixed" | "likely_bot" | "likely_sybil" {
  if (score >= 76) return "likely_sybil";
  if (score >= 51) return "likely_bot";
  if (score >= 26) return "mixed";
  return "likely_human";
}
