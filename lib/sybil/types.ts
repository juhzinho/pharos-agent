export type SybilSeverity = "low" | "medium" | "high" | "critical";
export type SybilVerdict = "likely_human" | "mixed" | "likely_bot" | "likely_sybil";
export type SybilConfidence = "low" | "medium" | "high";

export interface SybilSignal {
  id: string;
  severity: SybilSeverity;
  weight: number;
  titleEn: string;
  titlePt: string;
  detailEn: string;
  detailPt: string;
}

export interface SybilMetrics {
  txTotal: number;
  txSampled: number;
  outgoingTxs: number;
  uniqueCounterparties: number;
  topFunderShare: number;
  erc20TopFunderShare: number;
  intervalCv: number | null;
  maxTxsSameMinute: number;
  approvalShare: number;
  swapShare: number;
  protocolCount: number;
  activeMonths: number;
  walletAgeDays: number | null;
  holdingsCount: number;
  failedRate: number;
  humanBonus: number;
  onChainRisk: number;
  compositeRisk: number;
  trustaSybilScore: number | null;
  passportScore: number | null;
  ethTxCount: number | null;
}

export interface SybilPhases {
  phase2Deep: boolean;
  phase3Reputation: boolean;
  phase4Graph: boolean;
  phase4Campaign: boolean;
}
