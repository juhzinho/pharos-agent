export type LinkVerdict = "official" | "likely_safe" | "suspicious" | "likely_scam" | "confirmed_scam";
export type LinkSeverity = "low" | "medium" | "high" | "critical";

export interface LinkSignal {
  id: string;
  severity: LinkSeverity;
  weight: number;
  titleEn: string;
  titlePt: string;
  detailEn: string;
  detailPt: string;
}

export interface LinkScanReport {
  inputUrl: string;
  normalizedUrl: string;
  hostname: string;
  finalUrl: string | null;
  redirectChain: string[];
  riskScore: number;
  verdict: LinkVerdict;
  confidence: "low" | "medium" | "high";
  signals: LinkSignal[];
  officialMatch: string | null;
  typosquatOf: string | null;
  impersonatedBrands: string[];
  projectHint: string | null;
  discoveredOfficial: string | null;
  trustStatus: "allowlist_verified" | "search_verified" | "search_mismatch" | "unverified";
  recommendationsEn: string[];
  recommendationsPt: string[];
  scannedAt: string;
}

export interface LinkScanBatchReport {
  reports: LinkScanReport[];
  worstScore: number;
  worstVerdict: LinkVerdict;
}

export type LinkCompareVerdict = "match_official" | "likely_phishing" | "both_unverified" | "suspicious_divergence";

export interface LinkCompareReport {
  suspicious: LinkScanReport;
  official: LinkScanReport;
  suspiciousDomain: string;
  officialDomain: string;
  domainsMatch: boolean;
  riskDelta: number;
  verdict: LinkCompareVerdict;
  recommendationsEn: string[];
  recommendationsPt: string[];
}
