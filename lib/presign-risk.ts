import { decodeSelectorLabel } from "@/lib/txexplain";
import { FAROSWAP_DIRECT } from "@/lib/faroswap";
import { FAROSWAP } from "@/lib/liquidity";
import { FAROO } from "@/lib/staking";

const LIFI_DIAMOND = "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae";
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const ZERO = "0x0000000000000000000000000000000000000000";
const MAX_UINT = (1n << 256n) - 1n;

const KNOWN_SPENDERS: Record<string, { label: string; trust: "high" | "medium" }> = {
  [LIFI_DIAMOND.toLowerCase()]: { label: "LI.FI Diamond", trust: "high" },
  [FAROSWAP.NPM.toLowerCase()]: { label: "FaroSwap NPM", trust: "high" },
  [FAROSWAP_DIRECT.DODO_APPROVE.toLowerCase()]: { label: "FaroSwap DODO Approve", trust: "high" },
  [FAROSWAP_DIRECT.ROUTE_PROXY.toLowerCase()]: { label: "FaroSwap Route Proxy", trust: "high" },
  [FAROO.STPROS.toLowerCase()]: { label: "Faroo stPROS vault", trust: "high" },
  [MULTICALL3.toLowerCase()]: { label: "Multicall3", trust: "medium" },
};

export interface PreSignCheck {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  pass: boolean;
  titleEn: string;
  titlePt: string;
  detailEn: string;
  detailPt: string;
  weight: number;
}

export type PreSignVerdict = "safe" | "caution" | "high_risk" | "block";

export interface PreSignRiskReport {
  riskScore: number;
  severity: "low" | "medium" | "high" | "critical";
  verdict: PreSignVerdict;
  actionLabel: string | null;
  selector: string | null;
  to: string;
  valuePros: number;
  checks: PreSignCheck[];
  recommendationsEn: string[];
  recommendationsPt: string[];
}

export interface UnsignedTxInput {
  to: string;
  data?: string;
  value?: string;
  description?: string;
}

function parsePros(value?: string): number {
  if (!value || value === "0x" || value === "0x0") return 0;
  try {
    return Number(BigInt(value)) / 1e18;
  } catch {
    return 0;
  }
}

function decodeApprove(data: string): { spender: string; amount: bigint } | null {
  if (!data.toLowerCase().startsWith("0x095ea7b3") || data.length < 138) return null;
  const body = data.slice(10);
  const spender = "0x" + body.slice(24, 64);
  const amount = BigInt("0x" + body.slice(64, 128));
  return { spender, amount };
}

function decodeTransferRecipient(data: string): string | null {
  if (!data.toLowerCase().startsWith("0xa9059cbb") || data.length < 74) return null;
  return "0x" + data.slice(34, 74);
}

function severityFor(score: number): PreSignRiskReport["severity"] {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function verdictFor(score: number, checks: PreSignCheck[]): PreSignVerdict {
  if (checks.some((c) => !c.pass && c.severity === "critical")) return "block";
  if (score >= 55) return "high_risk";
  if (score >= 25) return "caution";
  return "safe";
}

function buildRecommendations(
  verdict: PreSignVerdict,
  checks: PreSignCheck[],
  lang: "en" | "pt",
): string[] {
  const r: string[] = [];
  if (verdict === "block") {
    r.push(lang === "pt" ? "Não assine — risco crítico detectado." : "Do not sign — critical risk detected.");
  } else if (verdict === "high_risk") {
    r.push(lang === "pt" ? "Revise spender, valor e contrato antes de assinar." : "Review spender, amount, and contract before signing.");
  } else if (verdict === "caution") {
    r.push(lang === "pt" ? "Confirme endereços na UI da carteira e no explorer." : "Confirm addresses in wallet UI and explorer.");
  } else {
    r.push(lang === "pt" ? "Parâmetros parecem normais — ainda confirme na carteira." : "Parameters look normal — still confirm in wallet.");
  }
  if (checks.some((c) => c.id === "unlimited-approve")) {
    r.push(lang === "pt" ? "Prefira approve com valor exato; revogue depois em revoke.cash." : "Prefer exact approve amounts; revoke later on revoke.cash.");
  }
  if (checks.some((c) => c.id === "unknown-selector")) {
    r.push(lang === "pt" ? "Simule no explorer ou peça explicação da dApp antes de assinar." : "Simulate on explorer or ask the dApp to explain before signing.");
  }
  return r;
}

export function analyzeUnsignedTx(tx: UnsignedTxInput): PreSignRiskReport {
  const to = tx.to?.trim() ?? "";
  const data = (tx.data ?? "0x").trim();
  const valuePros = parsePros(tx.value);
  const checks: PreSignCheck[] = [];
  let risk = 0;

  const decoded = decodeSelectorLabel(data);
  const actionLabel = decoded?.label ?? null;
  const selector = decoded?.selector ?? null;

  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
    checks.push({
      id: "invalid-to",
      severity: "critical",
      pass: false,
      weight: 80,
      titleEn: "Invalid recipient contract",
      titlePt: "Contrato destino inválido",
      detailEn: "Transaction `to` is not a valid address.",
      detailPt: "O campo `to` não é um endereço válido.",
    });
    risk += 80;
  } else if (to.toLowerCase() === ZERO) {
    checks.push({
      id: "zero-to",
      severity: "critical",
      pass: false,
      weight: 90,
      titleEn: "Zero address target",
      titlePt: "Destino endereço zero",
      detailEn: "Sending to 0x0 will burn funds or fail.",
      detailPt: "Enviar para 0x0 queima fundos ou falha.",
    });
    risk += 90;
  } else {
    checks.push({
      id: "valid-to",
      severity: "low",
      pass: true,
      weight: 0,
      titleEn: "Valid target address",
      titlePt: "Endereço destino válido",
      detailEn: to,
      detailPt: to,
    });
  }

  if (valuePros > 100) {
    checks.push({
      id: "large-native",
      severity: "high",
      pass: false,
      weight: 25,
      titleEn: "Large native transfer",
      titlePt: "Transferência nativa grande",
      detailEn: `${valuePros.toFixed(4)} PROS in value field — double-check amount.`,
      detailPt: `${valuePros.toFixed(4)} PROS no campo value — confira o valor.`,
    });
    risk += 25;
  } else if (valuePros > 0) {
    checks.push({
      id: "native-value",
      severity: "low",
      pass: true,
      weight: 0,
      titleEn: "Native PROS attached",
      titlePt: "PROS nativo anexado",
      detailEn: `${valuePros.toFixed(6)} PROS`,
      detailPt: `${valuePros.toFixed(6)} PROS`,
    });
  }

  if (!data || data === "0x") {
    if (valuePros > 0) {
      checks.push({
        id: "plain-transfer",
        severity: "medium",
        pass: true,
        weight: 5,
        titleEn: "Plain native transfer",
        titlePt: "Transferência nativa simples",
        detailEn: "No contract call — sending PROS directly.",
        detailPt: "Sem chamada de contrato — envio direto de PROS.",
      });
      risk += 5;
    }
  } else if (!decoded || decoded.label === "Unknown contract call") {
    checks.push({
      id: "unknown-selector",
      severity: "high",
      pass: false,
      weight: 28,
      titleEn: "Unknown function selector",
      titlePt: "Seletor de função desconhecido",
      detailEn: selector ? `Selector ${selector} not in Pharos allowlist.` : "Calldata too short to decode.",
      detailPt: selector ? `Seletor ${selector} fora da allowlist Pharos.` : "Calldata curto demais para decodificar.",
    });
    risk += 28;
  } else {
    checks.push({
      id: "known-selector",
      severity: "low",
      pass: true,
      weight: 0,
      titleEn: "Recognized action",
      titlePt: "Ação reconhecida",
      detailEn: actionLabel ?? "",
      detailPt: actionLabel ?? "",
    });
  }

  const approve = decodeApprove(data);
  if (approve) {
    const spenderInfo = KNOWN_SPENDERS[approve.spender.toLowerCase()];
    const unlimited = approve.amount >= MAX_UINT - 1_000_000n;
    if (unlimited && !spenderInfo) {
      checks.push({
        id: "unlimited-approve",
        severity: "critical",
        pass: false,
        weight: 45,
        titleEn: "Unlimited approval to unknown spender",
        titlePt: "Approve ilimitado para spender desconhecido",
        detailEn: `Spender ${approve.spender.slice(0, 10)}… can drain all tokens.`,
        detailPt: `Spender ${approve.spender.slice(0, 10)}… pode drenar todos os tokens.`,
      });
      risk += 45;
    } else if (unlimited && spenderInfo) {
      checks.push({
        id: "unlimited-known",
        severity: "medium",
        pass: true,
        weight: 12,
        titleEn: "Unlimited approve to known protocol",
        titlePt: "Approve ilimitado para protocolo conhecido",
        detailEn: `${spenderInfo.label} — still revoke when done.`,
        detailPt: `${spenderInfo.label} — revogue quando terminar.`,
      });
      risk += 12;
    } else if (spenderInfo) {
      checks.push({
        id: "exact-known-approve",
        severity: "low",
        pass: true,
        weight: 0,
        titleEn: "Approve to known spender",
        titlePt: "Approve para spender conhecido",
        detailEn: spenderInfo.label,
        detailPt: spenderInfo.label,
      });
    } else {
      checks.push({
        id: "unknown-spender",
        severity: "high",
        pass: false,
        weight: 30,
        titleEn: "Approve to unknown spender",
        titlePt: "Approve para spender desconhecido",
        detailEn: `Verify ${approve.spender} on explorer before signing.`,
        detailPt: `Verifique ${approve.spender} no explorer antes de assinar.`,
      });
      risk += 30;
    }
  }

  const recipient = decodeTransferRecipient(data);
  if (recipient?.toLowerCase() === ZERO) {
    checks.push({
      id: "transfer-zero",
      severity: "critical",
      pass: false,
      weight: 50,
      titleEn: "ERC-20 transfer to zero address",
      titlePt: "Transfer ERC-20 para endereço zero",
      detailEn: "Tokens would be burned.",
      detailPt: "Tokens seriam queimados.",
    });
    risk += 50;
  }

  const riskScore = Math.max(0, Math.min(100, risk));
  const severity = severityFor(riskScore);
  const verdict = verdictFor(riskScore, checks);

  return {
    riskScore,
    severity,
    verdict,
    actionLabel,
    selector,
    to,
    valuePros,
    checks,
    recommendationsEn: buildRecommendations(verdict, checks, "en"),
    recommendationsPt: buildRecommendations(verdict, checks, "pt"),
  };
}

export function analyzeUnsignedBatch(txs: UnsignedTxInput[]): PreSignRiskReport {
  if (txs.length === 1) return analyzeUnsignedTx(txs[0]);
  const reports = txs.map(analyzeUnsignedTx);
  const riskScore = Math.min(100, Math.round(reports.reduce((s, r) => s + r.riskScore, 0) / txs.length + (txs.length - 1) * 5));
  const checks = reports.flatMap((r) => r.checks);
  const worst = reports.sort((a, b) => b.riskScore - a.riskScore)[0];
  const severity = severityFor(riskScore);
  const verdict = verdictFor(riskScore, checks);
  return {
    ...worst,
    riskScore,
    severity,
    verdict,
    checks: checks.sort((a, b) => b.weight - a.weight).slice(0, 12),
    recommendationsEn: buildRecommendations(verdict, checks, "en"),
    recommendationsPt: buildRecommendations(verdict, checks, "pt"),
  };
}

export function detectPresignQuery(text: string): { transactions: UnsignedTxInput[] } | null {
  const intentRe =
    /\b(revisar|review|calldata|antes de assinar|before i sign|pre-?sign|risco da tx|tx risk|analisar transa|checar transa|check tx|unsigned|n[aã]o assinad)\b/i;
  const dataLabeled = text.match(/(?:data|calldata|dados)[:\s=]+(0x[a-fA-F0-9]+)/i)?.[1];
  const dataBare = [...text.matchAll(/(0x[a-fA-F0-9]{10,})/gi)].map((m) => m[1]);
  const calldata = dataLabeled ?? dataBare.find((d) => d.length >= 10 && !/^0x[a-fA-F0-9]{64}$/.test(d));
  const toLabeled = text.match(/(?:\bto\b|para|contrato|contract)[:\s=]+(0x[a-fA-F0-9]{40})/i)?.[1];
  const addrs = [...new Set((text.match(/0x[a-fA-F0-9]{40}/gi) ?? []))];
  const to = toLabeled ?? addrs[0];
  const valueMatch = text.match(/(?:value|valor)[:\s=]+(0x[a-fA-F0-9]+|\d+(?:\.\d+)?)/i);

  if (calldata && to) {
    return {
      transactions: [{
        to,
        data: calldata,
        value: valueMatch?.[1]?.startsWith("0x") ? valueMatch[1] : undefined,
      }],
    };
  }

  if (intentRe.test(text) && to && !calldata) {
    return { transactions: [{ to, data: "0x" }] };
  }

  return null;
}

export function formatPreSignReport(report: PreSignRiskReport, lang: "pt" | "en"): string {
  const verdictLabel = {
    safe: lang === "pt" ? "Seguro" : "Safe",
    caution: lang === "pt" ? "Atenção" : "Caution",
    high_risk: lang === "pt" ? "Alto risco" : "High risk",
    block: lang === "pt" ? "Não assinar" : "Do not sign",
  }[report.verdict];
  const head = lang === "pt"
    ? `🔍 **Pre-sign Risk Check** — risco **${report.riskScore}/100** · **${verdictLabel}**`
    : `🔍 **Pre-sign Risk Check** — risk **${report.riskScore}/100** · **${verdictLabel}**`;
  const action = report.actionLabel
    ? (lang === "pt" ? `\n\n**Ação:** ${report.actionLabel}` : `\n\n**Action:** ${report.actionLabel}`)
    : "";
  const fails = report.checks.filter((c) => !c.pass && c.weight > 0);
  const block = fails.length
    ? "\n\n" + fails.map((c) =>
      `• **${lang === "pt" ? c.titlePt : c.titleEn}** — ${lang === "pt" ? c.detailPt : c.detailEn}`,
    ).join("\n")
    : "";
  const recs = (lang === "pt" ? report.recommendationsPt : report.recommendationsEn)
    .map((r) => `• ${r}`).join("\n");
  return head + action + block + (recs ? `\n\n**${lang === "pt" ? "Recomendações" : "Recommendations"}**\n${recs}` : "");
}
