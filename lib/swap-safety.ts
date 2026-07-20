import type { QuoteResult } from "@/lib/lifi";
import type { FaroSwapBuildResult } from "@/lib/faroswap";
import type { ParsedIntent } from "@/lib/parser";

export interface SwapSafetyWarning {
  id: string;
  severity: "low" | "medium" | "high";
  titleEn: string;
  titlePt: string;
  detailEn: string;
  detailPt: string;
}

export interface SwapSafetyReport {
  provider: "lifi" | "faroswap";
  safetyScore: number;
  slippageBps: number | null;
  priceImpactBps: number | null;
  expectedReceive: string | null;
  minReceive: string | null;
  needsApproval: boolean;
  warnings: SwapSafetyWarning[];
  verdict: "excellent" | "good" | "caution" | "risky";
}

function verdictFor(score: number): SwapSafetyReport["verdict"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "caution";
  return "risky";
}

function pushWarning(
  warnings: SwapSafetyWarning[],
  w: SwapSafetyWarning,
  scorePenalty: number,
): number {
  warnings.push(w);
  return scorePenalty;
}

export function analyzeFaroSwapSafety(
  intent: ParsedIntent,
  result: FaroSwapBuildResult,
): SwapSafetyReport {
  const warnings: SwapSafetyWarning[] = [];
  let score = 92;

  const slippageBps = 100;
  const impactBps =
    result.expectedOut > 0
      ? Math.round(((result.expectedOut - result.minOut) / result.expectedOut) * 10_000)
      : slippageBps;

  if (result.needsApproval) {
    score -= pushWarning(warnings, {
      id: "needs-approval",
      severity: "medium",
      titleEn: "Token approval required",
      titlePt: "Aprovação de token necessária",
      detailEn: "Two signatures: approve then swap. Verify spender is FaroSwap DODO approve.",
      detailPt: "Duas assinaturas: approve e swap. Confirme que o spender é o DODO approve da FaroSwap.",
    }, 8);
  }

  return {
    provider: "faroswap",
    safetyScore: Math.max(0, Math.min(100, score)),
    slippageBps,
    priceImpactBps: impactBps,
    expectedReceive: `${result.expectedOut.toFixed(6)} ${result.outSymbol}`,
    minReceive: `${result.minOut.toFixed(6)} ${result.outSymbol}`,
    needsApproval: result.needsApproval,
    warnings,
    verdict: verdictFor(Math.max(0, Math.min(100, score))),
  };
}

export function analyzeLifiSwapSafety(
  intent: ParsedIntent,
  quote: QuoteResult,
  receiveLabel: string,
  needsApproval: boolean,
): SwapSafetyReport {
  const warnings: SwapSafetyWarning[] = [];
  let score = 78;

  const toDec = quote.action.toToken.decimals;
  const toAmt = Number(quote.estimate.toAmount) / 10 ** toDec;
  const toMin = Number(quote.estimate.toAmountMin) / 10 ** toDec;
  const slippageBps =
    toAmt > 0 ? Math.round(((toAmt - toMin) / toAmt) * 10_000) : null;

  if (slippageBps != null && slippageBps > 300) {
    score -= pushWarning(warnings, {
      id: "high-slippage",
      severity: "high",
      titleEn: "High slippage tolerance",
      titlePt: "Slippage alto",
      detailEn: `Route allows ~${(slippageBps / 100).toFixed(2)}% slippage — you may receive much less than quoted.`,
      detailPt: `Rota permite ~${(slippageBps / 100).toFixed(2)}% de slippage — você pode receber bem menos que a cotação.`,
    }, 22);
  } else if (slippageBps != null && slippageBps > 150) {
    score -= pushWarning(warnings, {
      id: "moderate-slippage",
      severity: "medium",
      titleEn: "Moderate slippage",
      titlePt: "Slippage moderado",
      detailEn: `Minimum receive is ~${(slippageBps / 100).toFixed(2)}% below the quote.`,
      detailPt: `Recebimento mínimo fica ~${(slippageBps / 100).toFixed(2)}% abaixo da cotação.`,
    }, 10);
  }

  if (needsApproval) {
    score -= pushWarning(warnings, {
      id: "lifi-approval",
      severity: "medium",
      titleEn: "LI.FI approval step",
      titlePt: "Etapa de approve LI.FI",
      detailEn: "ERC-20 must be approved to the LI.FI Diamond before the swap executes.",
      detailPt: "ERC-20 precisa de approve para o LI.FI Diamond antes do swap.",
    }, 6);
  }

  const duration = quote.estimate.executionDuration;
  if (duration > 600) {
    score -= pushWarning(warnings, {
      id: "slow-route",
      severity: "low",
      titleEn: "Slow route",
      titlePt: "Rota lenta",
      detailEn: `Estimated execution ~${Math.round(duration / 60)} min — price may move before completion.`,
      detailPt: `Execução estimada ~${Math.round(duration / 60)} min — preço pode mudar antes de concluir.`,
    }, 5);
  }

  if (quote.tool && !/lifi|jumper|lifidiamond/i.test(quote.tool)) {
    score -= pushWarning(warnings, {
      id: "multi-hop",
      severity: "low",
      titleEn: "Multi-hop aggregator route",
      titlePt: "Rota agregada multi-hop",
      detailEn: `Route tool: ${quote.tool}. More hops = more contract surface.`,
      detailPt: `Ferramenta da rota: ${quote.tool}. Mais hops = mais contratos envolvidos.`,
    }, 4);
  }

  return {
    provider: "lifi",
    safetyScore: Math.max(0, Math.min(100, score)),
    slippageBps,
    priceImpactBps: slippageBps,
    expectedReceive: `${receiveLabel} ${intent.toToken}`,
    minReceive: toMin > 0 ? `${toMin.toFixed(6)} ${intent.toToken}` : null,
    needsApproval,
    warnings,
    verdict: verdictFor(Math.max(0, Math.min(100, score))),
  };
}

export function formatSwapSafetySummary(report: SwapSafetyReport, lang: "pt" | "en"): string {
  const verdict = {
    excellent: lang === "pt" ? "Excelente" : "Excellent",
    good: lang === "pt" ? "Bom" : "Good",
    caution: lang === "pt" ? "Atenção" : "Caution",
    risky: lang === "pt" ? "Arriscado" : "Risky",
  }[report.verdict];
  const head = lang === "pt"
    ? `🛡️ **Swap Safety** (${report.provider}) — score **${report.safetyScore}/100** · ${verdict}`
    : `🛡️ **Swap Safety** (${report.provider}) — score **${report.safetyScore}/100** · ${verdict}`;
  if (!report.warnings.length) return head;
  const block = report.warnings.slice(0, 4).map((w) =>
    `• **${lang === "pt" ? w.titlePt : w.titleEn}** — ${lang === "pt" ? w.detailPt : w.detailEn}`,
  ).join("\n");
  return `${head}\n\n${block}`;
}
