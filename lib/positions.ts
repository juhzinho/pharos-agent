/**
 * FaroSwap V3 position reader.
 * Reads the user's Uniswap V3 NFT positions from the NonfungiblePositionManager,
 * filters to the WPROS/USDC pool, and computes approximate token amounts.
 */

import { FAROSWAP, readPoolState } from "./liquidity";

const PHAROS_RPC = "https://rpc.pharos.xyz";

// ── RPC helper ────────────────────────────────────────────────────────────────

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(PHAROS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "eth_call failed");
  return j.result ?? "0x";
}

// ── ABI decode helpers ────────────────────────────────────────────────────────

function word(hex: string, index: number): string {
  // hex is without 0x prefix; each word is 64 chars
  return hex.slice(index * 64, (index + 1) * 64);
}

function decodeUint(hex: string, index: number): bigint {
  const w = word(hex, index);
  return w ? BigInt("0x" + w) : 0n;
}

function decodeAddr(hex: string, index: number): string {
  const w = word(hex, index);
  return "0x" + w.slice(24).toLowerCase(); // last 20 bytes
}

function decodeInt24(hex: string, index: number): number {
  // int24 is sign-extended to 256 bits in ABI encoding
  const w = BigInt("0x" + word(hex, index));
  const SIGN = BigInt(2) ** BigInt(255);
  const MOD  = BigInt(2) ** BigInt(256);
  return Number(w >= SIGN ? w - MOD : w);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface V3Position {
  tokenId: bigint;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint; // uncollected WPROS fees (raw, 18 dec)
  tokensOwed1: bigint; // uncollected USDC fees (raw, 6 dec)
  // Derived
  feesWPROS: number;   // tokensOwed0 in human-readable WPROS
  feesUSDC: number;    // tokensOwed1 in human-readable USDC
  // Approximate in-range token amounts (from liquidity math)
  amount0WPROS: number;
  amount1USDC: number;
  currentPriceUSDC: number;
  inRange: boolean;
}

// ── Liquidity → token amounts (Uniswap V3 math) ──────────────────────────────

function sqrtFromTick(tick: number): number {
  // sqrt(1.0001^tick) — using natural log shortcut
  return Math.sqrt(Math.pow(1.0001, tick));
}

function computeAmounts(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
): { amount0: number; amount1: number } {
  if (liquidity === 0n) return { amount0: 0, amount1: 0 };

  const Q96 = Number(BigInt(2) ** BigInt(96));
  const sqrtP = Number(sqrtPriceX96) / Q96;
  const sqrtA = sqrtFromTick(tickLower);
  const sqrtB = sqrtFromTick(tickUpper);
  const L     = Number(liquidity);

  // current tick derived from sqrtP (price of token1/token0 in raw units)
  // tick = 2 * log_1.0001(sqrtP) — we compare sqrtP vs sqrtA, sqrtB
  let amount0 = 0;
  let amount1 = 0;

  if (sqrtP <= sqrtA) {
    // price below range: all token0
    amount0 = L * (1 / sqrtA - 1 / sqrtB);
  } else if (sqrtP >= sqrtB) {
    // price above range: all token1
    amount1 = L * (sqrtB - sqrtA);
  } else {
    // in range: both tokens
    amount0 = L * (1 / sqrtP - 1 / sqrtB);
    amount1 = L * (sqrtP - sqrtA);
  }

  // Adjust for decimals: WPROS=18 dec (token0), USDC=6 dec (token1)
  // Raw amounts are in token-base units, so divide by 10^18 and 10^6
  return {
    amount0: amount0 / 1e18,
    amount1: amount1 / 1e6,
  };
}

// ── Main reader ───────────────────────────────────────────────────────────────

export async function fetchUserPositions(userAddress: string): Promise<V3Position[]> {
  const NPM   = FAROSWAP.NPM;
  const WPROS = FAROSWAP.WPROS.toLowerCase();
  const USDC  = FAROSWAP.USDC.toLowerCase();
  const user  = userAddress.slice(2).padStart(64, "0");

  // 1. balanceOf(userAddress)
  const balRaw = await ethCall(NPM, `0x70a08231${user}`);
  if (!balRaw || balRaw === "0x") return [];
  const balance = Number(BigInt(balRaw));
  if (balance === 0) return [];

  // 2. Read current sqrtPriceX96 from the 0.01% pool (reference price for all WPROS/USDC positions)
  let sqrtPriceX96 = 0n;
  let currentPriceUSDC = 0;
  try {
    const ps = await readPoolState(100);
    sqrtPriceX96 = ps.sqrtPriceX96;
    currentPriceUSDC = ps.priceUSDCperWPROS;
  } catch {
    // Non-fatal: amounts will show 0 if price unavailable
  }

  // 3. tokenOfOwnerByIndex for each index (parallel)
  const indexCalls = Array.from({ length: balance }, (_, i) => {
    const idx = i.toString(16).padStart(64, "0");
    return ethCall(NPM, `0x2f745c59${user}${idx}`);
  });
  const tokenIdRaws = await Promise.all(indexCalls);
  const tokenIds = tokenIdRaws
    .filter((r) => r && r !== "0x")
    .map((r) => BigInt(r));

  // 4. positions(tokenId) for each tokenId (parallel)
  //    Returns: nonce(0), operator(1), token0(2), token1(3), fee(4),
  //             tickLower(5), tickUpper(6), liquidity(7),
  //             feeGrowthInside0LastX128(8), feeGrowthInside1LastX128(9),
  //             tokensOwed0(10), tokensOwed1(11)
  const posCalls = tokenIds.map((id) => {
    const idHex = id.toString(16).padStart(64, "0");
    return ethCall(NPM, `0x99fbab88${idHex}`);
  });
  const posRaws = await Promise.all(posCalls);

  const positions: V3Position[] = [];

  for (let i = 0; i < tokenIds.length; i++) {
    const raw = posRaws[i];
    if (!raw || raw === "0x") continue;
    const hex = raw.slice(2); // strip 0x

    const token0  = decodeAddr(hex, 2);
    const token1  = decodeAddr(hex, 3);

    // Filter: only WPROS/USDC positions
    if (token0 !== WPROS || token1 !== USDC) continue;

    const fee        = Number(decodeUint(hex, 4));
    const tickLower  = decodeInt24(hex, 5);
    const tickUpper  = decodeInt24(hex, 6);
    const liquidity  = decodeUint(hex, 7);
    const tokensOwed0 = decodeUint(hex, 10);
    const tokensOwed1 = decodeUint(hex, 11);

    const feesWPROS = Number(tokensOwed0) / 1e18;
    const feesUSDC  = Number(tokensOwed1) / 1e6;

    const { amount0, amount1 } = computeAmounts(
      liquidity,
      sqrtPriceX96,
      tickLower,
      tickUpper,
    );

    // Determine if position is in range
    // Current tick: tick ≈ log_1.0001(sqrtP^2) = 2*log_1.0001(sqrtP)
    const sqrtP = sqrtPriceX96 > 0n
      ? Number(sqrtPriceX96) / 2 ** 96
      : 0;
    const currentTick = sqrtP > 0
      ? Math.round(Math.log(sqrtP * sqrtP) / Math.log(1.0001))
      : 0;
    const inRange = liquidity > 0n && currentTick >= tickLower && currentTick < tickUpper;

    positions.push({
      tokenId: tokenIds[i],
      fee,
      tickLower,
      tickUpper,
      liquidity,
      tokensOwed0,
      tokensOwed1,
      feesWPROS,
      feesUSDC,
      amount0WPROS: amount0,
      amount1USDC:  amount1,
      currentPriceUSDC,
      inRange,
    });
  }

  return positions;
}

// ── Formatter for chat display ────────────────────────────────────────────────

export function formatPositionSummary(positions: V3Position[]): string {
  if (positions.length === 0) {
    return "You don't have any WPROS/USDC liquidity positions in FaroSwap V3 yet.\n\nSay \"add 5 WPROS and 3 USDC to FaroSwap\" to create one.";
  }

  const lines: string[] = [
    `Found ${positions.length} FaroSwap V3 position${positions.length > 1 ? "s" : ""}:\n`,
  ];

  for (const p of positions) {
    const rangeLabel = p.inRange ? "In range" : "Out of range";
    const hasLiquidity = p.liquidity > 0n;
    lines.push(`NFT #${p.tokenId}  (${rangeLabel})`);
    lines.push(`  Pair:      WPROS / USDC`);
    lines.push(`  Fee tier:  ${(p.fee / 10000).toFixed(2)}%`);
    lines.push(`  Range:     tick ${p.tickLower} → ${p.tickUpper}`);
    if (hasLiquidity) {
      lines.push(`  ~WPROS:    ${p.amount0WPROS.toFixed(6)}`);
      lines.push(`  ~USDC:     ${p.amount1USDC.toFixed(6)}`);
    } else {
      lines.push(`  Liquidity: 0 (closed)`);
    }
    if (p.feesWPROS > 0 || p.feesUSDC > 0) {
      lines.push(`  Fees due:  ${p.feesWPROS.toFixed(6)} WPROS + ${p.feesUSDC.toFixed(6)} USDC`);
    }
    lines.push("");
  }

  const price = positions[0]?.currentPriceUSDC ?? 0;
  if (price > 0) lines.push(`Pool price: ~${price.toFixed(4)} USDC/WPROS`);

  return lines.join("\n").trim();
}
