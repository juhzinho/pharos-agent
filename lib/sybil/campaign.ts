import type { SybilSignal } from "@/lib/sybil/types";
import { cached } from "@/lib/sybil/cache";

interface Campaign {
  name: string;
  startTime: string;
  endTime: string;
}

async function fetchCampaigns(): Promise<Campaign[]> {
  return cached("pharos-campaigns", 300_000, async () => {
    const res = await fetch("https://api.pharosnetwork.xyz/omni_port/activities", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://port.pharos.xyz/",
        Origin: "https://port.pharos.xyz",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const out: Campaign[] = [];
    for (const kind of ["rewards", "eco"] as const) {
      for (const it of (j?.data?.[kind] ?? []) as Array<{ name?: string; start_time?: string; end_time?: string }>) {
        if (it?.name && it.start_time && it.end_time) {
          out.push({ name: it.name, startTime: it.start_time, endTime: it.end_time });
        }
      }
    }
    return out;
  });
}

/** Phase 4: correlate activity burst with active Pharos campaign windows. */
export async function analyzeCampaignCorrelation(
  lastTxAt: string | null,
  firstTxAt: string | null,
  txTotal: number,
): Promise<{ signal: SybilSignal | null; activeCampaigns: string[] }> {
  const campaigns = await fetchCampaigns();
  const now = Date.now();
  const active = campaigns.filter((c) => {
    const s = new Date(c.startTime).getTime();
    const e = new Date(c.endTime).getTime();
    return Number.isFinite(s) && Number.isFinite(e) && now >= s && now <= e;
  });
  const activeNames = active.map((c) => c.name);
  if (!lastTxAt || active.length === 0 || txTotal < 20) {
    return { signal: null, activeCampaigns: activeNames };
  }

  const walletAgeDays = firstTxAt
    ? (new Date(lastTxAt).getTime() - new Date(firstTxAt).getTime()) / 86_400_000
    : null;

  if (walletAgeDays != null && walletAgeDays <= 14 && txTotal >= 30 && active.length > 0) {
    return {
      activeCampaigns: activeNames,
      signal: {
        id: "campaign-farm-window",
        severity: "medium",
        weight: 13,
        titleEn: "Campaign-window farm profile",
        titlePt: "Perfil farm na janela de campanha",
        detailEn: `Young wallet (${Math.round(walletAgeDays)}d span) with ${txTotal} txs during active campaigns: ${activeNames.slice(0, 2).join(", ")}.`,
        detailPt: `Carteira jovem (${Math.round(walletAgeDays)}d) com ${txTotal} txs durante campanhas ativas: ${activeNames.slice(0, 2).join(", ")}.`,
      },
    };
  }

  return { signal: null, activeCampaigns: activeNames };
}
