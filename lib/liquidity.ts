/**
 * FaroSwap V3 liquidity helpers.
 * Supports all 4 fee tiers (0.01%, 0.05%, 0.30%, 1.00%) with custom price ranges.
 */

const PHAROS_RPC = "https://rpc.pharos.xyz";

// ── Constants ────────────────────────────────────────────────────────────────

export const FAROSWAP = {
  NPM:     "0xc0479219f4feba5a668cff71bf96f4ffe124c3ab",
  FACTORY: "0x2c90ccb0b989afa2433f499698451a25744a552b",
  WPROS:   "0x52C48d4213107b20bC583832b0d951FB9CA8F0B0",
  USDC:    "0xc879c018db60520f4355c26ed1a6d572cdac1815",
} as const;

export type FeeTier = 100 | 500 | 3000 | 10000;

export const FEE_TIERS: Record<FeeTier, { label: string; tickSpacing: number }> = {
  100:   { label: "0.01%", tickSpacing: 1   },
  500:   { label: "0.05%", tickSpacing: 10  },
  3000:  { label: "0.30%", tickSpacing: 60  },
  10000: { label: "1.00%", tickSpacing: 200 },
};

const MAX_TICK = 887272;

// ── RPC helpers ──────────────────────────────────────────────────────────────

async function ethCallRpc(to: string, data: string): Promise<string> {
  const res = await fetch(PHAROS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "eth_call failed");
  return j.result ?? "0x";
}

async function checkAllowanceRpc(token: string, owner: string, spender: string): Promise<bigint> {
  const ownerPad   = owner.slice(2).padStart(64, "0");
  const spenderPad = spender.slice(2).padStart(64, "0");
  const result = await ethCallRpc(token, `0xdd62ed3e${ownerPad}${spenderPad}`);
  return result === "0x" ? 0n : BigInt(result);
}

// ── Pool lookup ──────────────────────────────────────────────────────────────

export async function findPool(fee: FeeTier): Promise<string | null> {
  // factory.getPool(address,address,uint24) — selector 0x1698ee82
  const t0  = FAROSWAP.WPROS.slice(2).padStart(64, "0");
  const t1  = FAROSWAP.USDC.slice(2).padStart(64, "0");
  const f   = fee.toString(16).padStart(64, "0");
  const raw = await ethCallRpc(FAROSWAP.FACTORY, `0x1698ee82${t0}${t1}${f}`);
  if (!raw || raw === "0x") return null;
  const addr = "0x" + raw.slice(-40).toLowerCase();
  return addr === "0x0000000000000000000000000000000000000000" ? null : addr;
}

// ── Pool state ───────────────────────────────────────────────────────────────

export interface PoolState {
  sqrtPriceX96: bigint;
  currentTick: number;
  priceUSDCperWPROS: number;
  poolAddress: string;
}

export async function readPoolState(fee: FeeTier): Promise<PoolState> {
  const poolAddress = await findPool(fee);
  if (!poolAddress) {
    throw new Error(
      `No FaroSwap pool found for fee tier ${FEE_TIERS[fee].label}. ` +
      `Available: 0.01%, 0.05%, 0.30%, 1.00%.`,
    );
  }

  const raw = await ethCallRpc(poolAddress, "0x3850c7bd"); // slot0()
  if (!raw || raw === "0x") throw new Error("Failed to read pool state");

  const hex = raw.slice(2);
  const sqrtPriceX96 = BigInt("0x" + hex.slice(0, 64));

  // slot0 word 1: int24 tick (sign-extended to 256 bits)
  const tickWord = BigInt("0x" + hex.slice(64, 128));
  const SIGN = BigInt(2) ** BigInt(255);
  const MOD  = BigInt(2) ** BigInt(256);
  const currentTick = Number(tickWord >= SIGN ? tickWord - MOD : tickWord);

  const sqrtP = Number(sqrtPriceX96) / 2 ** 96;
  const priceUSDCperWPROS = sqrtP * sqrtP * 1e12; // decimal-adjust: 10^(18-6)

  return { sqrtPriceX96, currentTick, priceUSDCperWPROS, poolAddress };
}

// ── Tick / price math ────────────────────────────────────────────────────────

export function priceToTick(humanPrice: number, tickSpacing: number): number {
  // humanPrice in USDC/WPROS; raw price = humanPrice / 1e12
  const rawPrice = Math.max(humanPrice / 1e12, 1e-38);
  const tick = Math.log(rawPrice) / Math.log(1.0001);
  return Math.round(tick / tickSpacing) * tickSpacing;
}

export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick) * 1e12;
}

export function fullRangeTicks(tickSpacing: number): { lower: number; upper: number } {
  return {
    lower: -Math.floor(MAX_TICK / tickSpacing) * tickSpacing,
    upper:  Math.floor(MAX_TICK / tickSpacing) * tickSpacing,
  };
}

// ── V3 amount math ───────────────────────────────────────────────────────────

function sqrtOfTick(tick: number): number {
  return Math.sqrt(Math.pow(1.0001, tick));
}

function computeRequiredAmounts(
  wprosDesired: number | undefined,
  usdcDesired: number | undefined,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
): { wpros: number; usdc: number; onlyToken0: boolean; onlyToken1: boolean } {
  const sqrtP = Number(sqrtPriceX96) / 2 ** 96;
  const sqrtA = sqrtOfTick(tickLower);
  const sqrtB = sqrtOfTick(tickUpper);
  const currentPrice = sqrtP * sqrtP * 1e12;

  if (sqrtP <= sqrtA) {
    // Price below range: deposit only WPROS
    const wpros =
      wprosDesired && wprosDesired > 0 ? wprosDesired :
      usdcDesired  && usdcDesired  > 0 ? usdcDesired / currentPrice : 0;
    return { wpros, usdc: 0, onlyToken0: true, onlyToken1: false };
  }

  if (sqrtP >= sqrtB) {
    // Price above range: deposit only USDC
    const usdc =
      usdcDesired  && usdcDesired  > 0 ? usdcDesired :
      wprosDesired && wprosDesired > 0 ? wprosDesired * currentPrice : 0;
    return { wpros: 0, usdc, onlyToken0: false, onlyToken1: true };
  }

  // In range: both tokens — anchor on WPROS if given, else on USDC
  if (wprosDesired && wprosDesired > 0) {
    const amount0Raw = wprosDesired * 1e18;
    const L = amount0Raw * sqrtP * sqrtB / (sqrtB - sqrtP);
    const amount1Raw = L * (sqrtP - sqrtA);
    return { wpros: wprosDesired, usdc: amount1Raw / 1e6, onlyToken0: false, onlyToken1: false };
  }

  if (usdcDesired && usdcDesired > 0) {
    const amount1Raw = usdcDesired * 1e6;
    const L = amount1Raw / (sqrtP - sqrtA);
    const amount0Raw = L * (sqrtB - sqrtP) / (sqrtP * sqrtB);
    return { wpros: amount0Raw / 1e18, usdc: usdcDesired, onlyToken0: false, onlyToken1: false };
  }

  throw new Error("Provide at least one token amount");
}

// ── ABI encoding ─────────────────────────────────────────────────────────────

function padAddr(addr: string): string {
  return addr.slice(2).toLowerCase().padStart(64, "0");
}

function padUint256(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

function padInt256(value: number): string {
  if (value >= 0) return BigInt(value).toString(16).padStart(64, "0");
  return ((BigInt(2) ** BigInt(256)) + BigInt(value)).toString(16).padStart(64, "0");
}

export function buildApproveCalldata(spender: string, amount: bigint): string {
  return `0x095ea7b3${padAddr(spender)}${padUint256(amount)}`;
}

// selector = keccak256("mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))")
const MINT_SEL = "0x88316456";

function buildMintCalldata(
  fee: number,
  tickLower: number,
  tickUpper: number,
  amount0Desired: bigint,
  amount1Desired: bigint,
  recipient: string,
  deadline: bigint,
): string {
  return (
    MINT_SEL +
    padAddr(FAROSWAP.WPROS) +
    padAddr(FAROSWAP.USDC) +
    padUint256(BigInt(fee)) +
    padInt256(tickLower) +
    padInt256(tickUpper) +
    padUint256(amount0Desired) +
    padUint256(amount1Desired) +
    padUint256(0n) +
    padUint256(0n) +
    padAddr(recipient) +
    padUint256(deadline)
  );
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface LiquidityParams {
  wprosAmount?: number;
  usdcAmount?: number;
  feeTier: FeeTier;
  rangeMode: "price" | "percent" | "full";
  minPrice?: number;
  maxPrice?: number;
  rangePercent?: number;
  userAddress: string;
}

export interface LiquidityBuildResult {
  poolState: PoolState;
  feeTier: FeeTier;
  tickSpacing: number;
  tickLower: number;
  tickUpper: number;
  minPrice: number;
  maxPrice: number;
  wprosAmount: number;
  usdcAmount: number;
  wprosRaw: bigint;
  usdcRaw: bigint;
  needsApproval0: boolean;
  needsApproval1: boolean;
  mintCalldata: string;
  description: string;
  onlyToken0: boolean;
  onlyToken1: boolean;
  rangeMode: "price" | "percent" | "full";
  rangePercent?: number;
}

// ── Main builder ─────────────────────────────────────────────────────────────

export async function buildLiquidityTx(params: LiquidityParams): Promise<LiquidityBuildResult> {
  const { feeTier, rangeMode, userAddress } = params;
  const { tickSpacing } = FEE_TIERS[feeTier];

  const poolState = await readPoolState(feeTier);
  const currentPrice = poolState.priceUSDCperWPROS;

  let tickLower: number;
  let tickUpper: number;

  if (rangeMode === "full") {
    const fr = fullRangeTicks(tickSpacing);
    tickLower = fr.lower;
    tickUpper = fr.upper;
  } else if (rangeMode === "percent") {
    const pct = (params.rangePercent ?? 10) / 100;
    const lo  = currentPrice * (1 - pct);
    const hi  = currentPrice * (1 + pct);
    tickLower = priceToTick(Math.max(lo, 1e-15), tickSpacing);
    tickUpper = priceToTick(hi, tickSpacing);
  } else {
    if (!params.minPrice || !params.maxPrice)
      throw new Error("Price mode requires minPrice and maxPrice");
    tickLower = priceToTick(params.minPrice, tickSpacing);
    tickUpper = priceToTick(params.maxPrice, tickSpacing);
  }

  // Clamp to valid tick bounds
  const maxValidTick = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
  tickLower = Math.max(-maxValidTick, tickLower);
  tickUpper = Math.min( maxValidTick, tickUpper);
  if (tickLower >= tickUpper) tickUpper = tickLower + tickSpacing;

  const minPrice = tickToPrice(tickLower);
  const maxPrice = tickToPrice(tickUpper);

  const amounts = computeRequiredAmounts(
    params.wprosAmount,
    params.usdcAmount,
    poolState.sqrtPriceX96,
    tickLower,
    tickUpper,
  );

  const wprosRaw = BigInt(Math.floor(Math.max(0, amounts.wpros) * 1e18));
  const usdcRaw  = BigInt(Math.floor(Math.max(0, amounts.usdc)  * 1e6));

  const [allowance0, allowance1] = await Promise.all([
    checkAllowanceRpc(FAROSWAP.WPROS, userAddress, FAROSWAP.NPM),
    checkAllowanceRpc(FAROSWAP.USDC,  userAddress, FAROSWAP.NPM),
  ]);

  const needsApproval0 = wprosRaw > 0n && allowance0 < wprosRaw;
  const needsApproval1 = usdcRaw  > 0n && allowance1 < usdcRaw;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
  const mintCalldata = buildMintCalldata(
    feeTier, tickLower, tickUpper, wprosRaw, usdcRaw, userAddress, deadline,
  );

  const feeLabel = FEE_TIERS[feeTier].label;
  const rangeLabel =
    rangeMode === "full"    ? "full range" :
    rangeMode === "percent" ? `±${params.rangePercent ?? 10}%` :
    `${params.minPrice?.toFixed(4)} – ${params.maxPrice?.toFixed(4)} USDC/WPROS`;

  const approvalParts = [
    needsApproval0 ? "WPROS approval" : "",
    needsApproval1 ? "USDC approval"  : "",
  ].filter(Boolean).join(" + ");

  const description =
    `FaroSwap V3 · WPROS/USDC · fee ${feeLabel}\n` +
    `Range: ${rangeLabel}  (ticks ${tickLower} → ${tickUpper})\n` +
    (amounts.wpros > 0 ? `WPROS: ${amounts.wpros.toFixed(6)}\n` : "") +
    (amounts.usdc  > 0 ? `USDC:  ${amounts.usdc.toFixed(6)}\n`  : "") +
    (approvalParts ? `Needs: ${approvalParts} → Mint` : "Ready to mint");

  return {
    poolState,
    feeTier,
    tickSpacing,
    tickLower,
    tickUpper,
    minPrice,
    maxPrice,
    wprosAmount: Math.max(0, amounts.wpros),
    usdcAmount:  Math.max(0, amounts.usdc),
    wprosRaw,
    usdcRaw,
    needsApproval0,
    needsApproval1,
    mintCalldata,
    description,
    onlyToken0: amounts.onlyToken0,
    onlyToken1: amounts.onlyToken1,
    rangeMode,
    rangePercent: params.rangePercent,
  };
}

// ── Remove liquidity builders ──────────────────────────────────────────────

// selector = keccak256("decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))")
const DECREASE_LIQUIDITY_SEL = "0x0c49ccbe";

function buildDecreaseCalldata(
  tokenId: bigint,
  liquidity: bigint,
  amount0Min: bigint,
  amount1Min: bigint,
  deadline: bigint,
): string {
  return (
    DECREASE_LIQUIDITY_SEL +
    padUint256(tokenId) +
    padUint256(liquidity) +
    padUint256(amount0Min) +
    padUint256(amount1Min) +
    padUint256(deadline)
  );
}

// selector = keccak256("collect((uint256,address,uint128,uint128))")
const COLLECT_SEL = "0xfc735e99";

function buildCollectCalldata(
  tokenId: bigint,
  recipient: string,
  amount0Max: bigint,
  amount1Max: bigint,
): string {
  return (
    COLLECT_SEL +
    padUint256(tokenId) +
    padAddr(recipient) +
    padUint256(amount0Max) +
    padUint256(amount1Max)
  );
}

export interface RemoveLiquidityBuildResult {
  tokenId: bigint;
  liquidity: bigint;
  feeTier: FeeTier;
  amount0WPROS: number;
  amount1USDC: number;
  feesWPROS: number;
  feesUSDC: number;
  decreaseCalldata: string;
  collectCalldata: string;
  description: string;
}

export async function buildRemoveLiquidityTx(
  tokenId: bigint,
  liquidity: bigint,
  feeTier: FeeTier,
  userAddress: string,
  expectedAmount0: number,
  expectedAmount1: number,
  feesAmount0: number,
  feesAmount1: number,
): Promise<RemoveLiquidityBuildResult> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

  // With 1% slippage tolerance
  const amount0Min = BigInt(Math.floor(expectedAmount0 * 1e18 * 0.99));
  const amount1Min = BigInt(Math.floor(expectedAmount1 * 1e6 * 0.99));

  const decreaseCalldata = buildDecreaseCalldata(
    tokenId,
    liquidity,
    amount0Min,
    amount1Min,
    deadline,
  );

  // Collect all available tokens + fees
  const amount0Max = BigInt(Math.floor((expectedAmount0 + feesAmount0) * 1e18)) + 1n;
  const amount1Max = BigInt(Math.floor((expectedAmount1 + feesAmount1) * 1e6)) + 1n;

  const collectCalldata = buildCollectCalldata(
    tokenId,
    userAddress,
    amount0Max,
    amount1Max,
  );

  const feeLabel = FEE_TIERS[feeTier].label;
  const description =
    `FaroSwap V3 · Remove liquidity · fee ${feeLabel}\n` +
    `Token ID: ${tokenId.toString()}\n` +
    `WPROS: ${expectedAmount0.toFixed(6)} (+ ${feesAmount0.toFixed(6)} fees)\n` +
    `USDC: ${expectedAmount1.toFixed(6)} (+ ${feesAmount1.toFixed(6)} fees)`;

  return {
    tokenId,
    liquidity,
    feeTier,
    amount0WPROS: expectedAmount0,
    amount1USDC: expectedAmount1,
    feesWPROS: feesAmount0,
    feesUSDC: feesAmount1,
    decreaseCalldata,
    collectCalldata,
    description,
  };
}

