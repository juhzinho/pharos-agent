import { cached } from "@/lib/sybil/cache";

const TRUSTA_BASE = "https://openapi.trustalabs.ai/service/openapi";
const ETH_RPC = "https://eth.llamarpc.com";

export interface TrustaResult {
  available: boolean;
  sybilScore?: number;
  sybilLevel?: string;
  mediaScore?: number;
  mediaSubScores?: Record<string, number>;
  error?: string;
}

export interface PassportResult {
  available: boolean;
  score?: number;
  passing?: boolean;
  threshold?: number;
  error?: string;
}

export interface EthFootprint {
  available: boolean;
  txCount?: number;
  ageDays?: number;
  error?: string;
}

export interface HolonymResult {
  available: boolean;
  note: string;
}

export interface ReputationBundle {
  trusta: TrustaResult;
  passport: PassportResult;
  eth: EthFootprint;
  holonym: HolonymResult;
  /** 0–100 human trust boost derived from external layers (higher = more human). */
  humanTrustScore: number;
  /** 0–100 external sybil risk (higher = worse). */
  externalRiskScore: number;
}

async function trustaPost(path: string, body: Record<string, string>): Promise<unknown> {
  const key = process.env.TRUSTA_API_KEY?.trim();
  if (!key) return null;
  const res = await fetch(`${TRUSTA_BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Trusta HTTP ${res.status}`);
  return res.json();
}

export async function fetchTrustaScores(address: string): Promise<TrustaResult> {
  const chainId = process.env.TRUSTA_CHAIN_ID?.trim() || "1";
  if (!process.env.TRUSTA_API_KEY?.trim()) {
    return { available: false, error: "TRUSTA_API_KEY not configured" };
  }
  return cached(`trusta:${chainId}:${address.toLowerCase()}`, 300_000, async () => {
    try {
      const [sybilJ, mediaJ] = await Promise.all([
        trustaPost("queryRiskSummaryScore", { chainId, address }),
        trustaPost("queryMediaScore", { chainId, address }).catch(() => null),
      ]);
      const sybil = sybilJ as { data?: { sybilRiskScore?: number; sybilRiskLevel?: string }; success?: boolean };
      const media = mediaJ as { data?: { mediaScore?: number; subScore?: Record<string, number> } } | null;
      return {
        available: true,
        sybilScore: sybil?.data?.sybilRiskScore,
        sybilLevel: sybil?.data?.sybilRiskLevel,
        mediaScore: media?.data?.mediaScore,
        mediaSubScores: media?.data?.subScore,
      };
    } catch (err) {
      return { available: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export async function fetchPassportScore(address: string): Promise<PassportResult> {
  const apiKey = process.env.PASSPORT_API_KEY?.trim();
  const scorerId = process.env.PASSPORT_SCORER_ID?.trim();
  if (!apiKey || !scorerId) {
    return { available: false, error: "PASSPORT_API_KEY / PASSPORT_SCORER_ID not configured" };
  }
  return cached(`passport:${scorerId}:${address.toLowerCase()}`, 300_000, async () => {
    try {
      const res = await fetch(
        `https://api.passport.xyz/v2/stamps/${scorerId}/score/${address}`,
        { headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(12_000) },
      );
      if (!res.ok) throw new Error(`Passport HTTP ${res.status}`);
      const j = await res.json() as { score?: string; passing_score?: boolean; threshold?: string; error?: string | null };
      if (j.error) throw new Error(j.error);
      return {
        available: true,
        score: j.score != null ? parseFloat(j.score) : undefined,
        passing: j.passing_score,
        threshold: j.threshold != null ? parseFloat(j.threshold) : undefined,
      };
    } catch (err) {
      return { available: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

async function ethRpc(method: string, params: unknown[]): Promise<string | null> {
  const res = await fetch(ETH_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = await res.json();
  return typeof j?.result === "string" ? j.result : null;
}

export async function fetchEthFootprint(address: string): Promise<EthFootprint> {
  return cached(`ethfp:${address.toLowerCase()}`, 600_000, async () => {
    try {
      const countHex = await ethRpc("eth_getTransactionCount", [address, "latest"]);
      const txCount = countHex ? Number(BigInt(countHex)) : 0;

      let ageDays: number | undefined;
      const etherscanKey = process.env.ETHERSCAN_API_KEY?.trim();
      if (etherscanKey && txCount > 0) {
        const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${etherscanKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        const j = await res.json() as { result?: Array<{ timeStamp?: string }> };
        const ts = j.result?.[0]?.timeStamp;
        if (ts) {
          ageDays = Math.max(0, (Date.now() - Number(ts) * 1000) / 86_400_000);
        }
      }

      return { available: true, txCount, ageDays };
    } catch (err) {
      return { available: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export function fetchHolonymStatus(): HolonymResult {
  // Holonym proofs are on-chain / wallet UI — no public score API in this integration.
  return {
    available: false,
    note: "Holonym requires wallet-side proof verification — link users to holonym.id for identity stamps.",
  };
}

export async function fetchReputationBundle(address: string): Promise<ReputationBundle> {
  const [trusta, passport, eth] = await Promise.all([
    fetchTrustaScores(address),
    fetchPassportScore(address),
    fetchEthFootprint(address),
  ]);
  const holonym = fetchHolonymStatus();

  let humanTrustScore = 0;
  let externalRiskScore = 0;
  let layers = 0;

  if (trusta.available && trusta.sybilScore != null && trusta.sybilScore >= 0) {
    externalRiskScore += Math.min(100, trusta.sybilScore);
    layers++;
    if (trusta.sybilScore <= 60) humanTrustScore += 25;
    if (trusta.mediaScore != null && trusta.mediaScore >= 40) humanTrustScore += 15;
  }
  if (passport.available && passport.score != null) {
    layers++;
    if (passport.passing || passport.score >= 20) humanTrustScore += 30;
    else externalRiskScore += 20;
  }
  if (eth.available) {
    layers++;
    if ((eth.txCount ?? 0) >= 50) humanTrustScore += 15;
    if ((eth.ageDays ?? 0) >= 180) humanTrustScore += 15;
    if ((eth.txCount ?? 0) <= 2) externalRiskScore += 15;
  }

  if (layers === 0) {
    return { trusta, passport, eth, holonym, humanTrustScore: 0, externalRiskScore: 0 };
  }

  return {
    trusta,
    passport,
    eth,
    holonym,
    humanTrustScore: Math.min(100, humanTrustScore),
    externalRiskScore: Math.min(100, Math.round(externalRiskScore / Math.max(1, layers > 1 ? 1.5 : 1))),
  };
}
