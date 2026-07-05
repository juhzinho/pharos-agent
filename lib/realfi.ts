// RealFi positions tracker (Pharos Mainnet) — reads live on-chain balances for
// every known RealFi / RWA / DeFi protocol token, straight from the public RPC
// (read-only, no key). For ERC-4626 vaults it also reads NAV (totalAssets /
// totalSupply) so positions show their real underlying value, and yield above
// par where the vault is USDC-backed.

const RPC = "https://rpc.pharos.xyz";

const SEL_BALANCE_OF   = "0x70a08231";
const SEL_TOTAL_ASSETS = "0x01e1d114";
const SEL_TOTAL_SUPPLY = "0x18160ddd";

interface RealFiToken {
  symbol: string;
  address: string;
  decimals: number;
  /** ERC-4626 vault share backed by USDC — NAV is read on-chain. */
  vault?: boolean;
  note?: string;
}

export interface RealFiProtocol {
  name: string;
  type: string;
  url: string;
  tokens: RealFiToken[];
}

// Contract addresses + decimals verified in the community RealFi skill research.
// IMPORTANT: pALPHA-family and VRPC vault tokens use 6 decimals, NOT 18.
export const REALFI_PROTOCOLS: RealFiProtocol[] = [
  {
    name: "pAlpha Vault (Ember)", type: "RWA High Yield · ERC-4626", url: "https://ember.so/earn/pALPHA",
    tokens: [
      { symbol: "pALPHA",   address: "0xe47e9ba4ea2320a6ed87246d02fd5c38485ed7d1", decimals: 6, vault: true },
      { symbol: "S-pALPHA", address: "0x5ed00449a0d0b6a9f26fd6af05832808a8b96bbe", decimals: 6, note: "senior tranche" },
      { symbol: "P-pALPHA", address: "0x34fd642fa9fdc6ce4013d4f3cde575c6dac904f9", decimals: 6, note: "principal tranche" },
      { symbol: "AQ-pALPHA", address: "0xe150a72352a189dce0d671c08f721b458104a2af", decimals: 6, note: "AquaFlux tranche" },
      { symbol: "SS-pAlpha", address: "0xbf5761dc90a87976300d3ddce40b9cba66b66041", decimals: 18, note: "surplus yield" },
    ],
  },
  {
    name: "AquaFlux", type: "Fixed-rate Lending / Tri-Token", url: "https://app.aquaflux.pro",
    tokens: [
      { symbol: "aqLP",   address: "0x99848bb3843a1cfbf2a03cffef146ae6f216d343", decimals: 18, note: "LP token" },
      { symbol: "P-CBT",  address: "0x0881e99c766006e0d158e7979dda67ea5e2359f6", decimals: 6, note: "principal" },
      { symbol: "C-CBT",  address: "0x50d10327b6ca6dcdb8a3505f65ba8c0c97b6c7d8", decimals: 6, note: "coupon" },
      { symbol: "S-CBT",  address: "0x22db220cbb04ad850bbf0639b96b2670ccf67446", decimals: 6, note: "senior/shield" },
      { symbol: "SS-CBT", address: "0x2f47d679635d36a26d2c4e996a5643c991e26bac", decimals: 18, note: "surplus" },
    ],
  },
  {
    name: "Zona Pharos", type: "Lending / Staking", url: "https://port.pharos.xyz",
    tokens: [
      { symbol: "zProsUSDC",  address: "0x843913de261a1712d3ae8d4bc751e705bb0823b8", decimals: 6,  note: "staked USDC" },
      { symbol: "zProsWPROS", address: "0x7e23c96d7fbcd538272390ec5f8766032d4d96fd", decimals: 18, note: "staked WPROS" },
      { symbol: "debtProsUSDC", address: "0x8809bd2389e9e16c30b0e9ae24df0682c3290d45", decimals: 6, note: "⚠ USDC debt (borrowed)" },
    ],
  },
  {
    name: "OpenFi", type: "Lending", url: "https://port.pharos.xyz",
    tokens: [
      { symbol: "bUSDC", address: "0x9dcf4b664fd2c8f0f5147ea469afe1cbc9e69d96", decimals: 6, note: "supplied USDC" },
    ],
  },
  {
    name: "R25 VRPC Vaults", type: "RWA Consumer Credit · ERC-4626", url: "https://app.r25.xyz",
    tokens: [
      { symbol: "VRPCW", address: "0x1c2bc8b553d9a7e61f7531a3a4bf2162f4569268", decimals: 6, vault: true, note: "weekly" },
      { symbol: "VRPCS", address: "0xee26bb0989691735c997dfdc49a4a607f75e190b", decimals: 6, vault: true, note: "semi-yearly" },
      { symbol: "VRPCQ", address: "0x94f7ebc6ae0819a4b4e231ae6ddaaf9bfd2a1a86", decimals: 6, vault: true, note: "quarterly" },
    ],
  },
  {
    name: "TermMax", type: "Fixed-rate Lending · ERC-4626", url: "https://app.termmax.ts.finance/earn/pharos",
    tokens: [
      { symbol: "tmPHRC", address: "0xd04d1a8bd7944e06e25192aad833700115c88480", decimals: 6, vault: true },
    ],
  },
  {
    name: "Janus Henderson / Anemoy", type: "Tokenized Treasury Fund", url: "https://port.pharos.xyz",
    tokens: [
      { symbol: "JTRSY", address: "0xc18e6f730896971a79d748e8dea61067a9bc6040", decimals: 6, note: "US Treasury fund" },
    ],
  },
];

export interface RealFiPosition {
  protocol: string;
  protocolType: string;
  url: string;
  symbol: string;
  balance: number;
  note?: string;
  nav?: number;           // USDC per share (ERC-4626 vaults)
  underlyingUsdc?: number; // balance × nav
  yieldAbovePar?: number;  // (nav - 1) × 100 %
}

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "RPC error");
  return j.result as string;
}

function hexToBig(hex: string | null | undefined): bigint {
  return hex && hex !== "0x" ? BigInt(hex) : 0n;
}

export async function getRealFiPositions(address: string): Promise<RealFiPosition[]> {
  const owner = address.slice(2).padStart(64, "0");
  const allTokens = REALFI_PROTOCOLS.flatMap((p) =>
    p.tokens.map((t) => ({ ...t, protocol: p.name, protocolType: p.type, url: p.url })));

  const results = await Promise.all(allTokens.map(async (t) => {
    const raw = await ethCall(t.address, `${SEL_BALANCE_OF}${owner}`).catch(() => "0x");
    const balance = Number(hexToBig(raw)) / 10 ** t.decimals;
    if (balance <= 0) return null;

    const pos: RealFiPosition = {
      protocol: t.protocol, protocolType: t.protocolType, url: t.url,
      symbol: t.symbol, balance, note: t.note,
    };

    if (t.vault) {
      try {
        const [assetsHex, supplyHex] = await Promise.all([
          ethCall(t.address, SEL_TOTAL_ASSETS),
          ethCall(t.address, SEL_TOTAL_SUPPLY),
        ]);
        const assets = Number(hexToBig(assetsHex)) / 1e6;         // underlying USDC (6 dec)
        const supply = Number(hexToBig(supplyHex)) / 10 ** t.decimals;
        if (supply > 0 && assets > 0) {
          pos.nav = assets / supply;
          pos.underlyingUsdc = balance * pos.nav;
          pos.yieldAbovePar = (pos.nav - 1) * 100;
        }
      } catch { /* NAV optional */ }
    }
    return pos;
  }));

  return results.filter((p): p is RealFiPosition => p !== null);
}

// Markdown report for the chat bubble.
export function formatRealFiPositions(address: string, positions: RealFiPosition[], lang: "pt" | "en"): string {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const head = lang === "pt"
    ? `🏦 **Posições RealFi** \`${short}\` (Pharos Mainnet)`
    : `🏦 **RealFi Positions** \`${short}\` (Pharos Mainnet)`;

  if (positions.length === 0) {
    const list = REALFI_PROTOCOLS.map((p) => `- [${p.name}](${p.url}) — ${p.type}`).join("\n");
    return lang === "pt"
      ? `${head}\n\nNenhuma posição encontrada nos ${REALFI_PROTOCOLS.length} protocolos RealFi conhecidos.\n\nOnde começar a ganhar yield na Pharos:\n${list}`
      : `${head}\n\nNo positions found across the ${REALFI_PROTOCOLS.length} known RealFi protocols.\n\nWhere to start earning yield on Pharos:\n${list}`;
  }

  const byProtocol = new Map<string, RealFiPosition[]>();
  for (const p of positions) {
    const cur = byProtocol.get(p.protocol) ?? [];
    cur.push(p);
    byProtocol.set(p.protocol, cur);
  }

  const sections: string[] = [];
  let totalUsdc = 0;
  for (const [protocol, list] of byProtocol) {
    const first = list[0];
    const rows = list.map((p) => {
      const bal = p.balance.toLocaleString("en-US", { maximumFractionDigits: 6 });
      const extra: string[] = [];
      if (p.note) extra.push(p.note);
      if (p.underlyingUsdc != null) {
        extra.push(`≈ ${p.underlyingUsdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`);
        totalUsdc += p.underlyingUsdc;
      }
      if (p.yieldAbovePar != null && p.yieldAbovePar > 0.005) {
        extra.push(lang === "pt" ? `yield acima do par: +${p.yieldAbovePar.toFixed(2)}%` : `yield above par: +${p.yieldAbovePar.toFixed(2)}%`);
      }
      return `  - **${p.symbol}**: ${bal}${extra.length ? ` _(${extra.join(" · ")})_` : ""}`;
    });
    sections.push(`**[${protocol}](${first.url})** — ${first.protocolType}\n${rows.join("\n")}`);
  }

  const total = totalUsdc > 0
    ? `\n\n${lang === "pt" ? "Valor estimado em vaults" : "Estimated vault value"}: **≈ $${totalUsdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC**`
    : "";
  const foot = `\n\n[${lang === "pt" ? "Ver no explorer" : "View on explorer"}](https://pharos.socialscan.io/address/${address})`;

  return `${head}\n\n${sections.join("\n\n")}${total}${foot}`;
}
