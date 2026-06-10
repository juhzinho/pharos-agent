/**
 * FaroSwap on-chain discovery — detects pool type and reads key addresses.
 * FaroSwap uses a Uniswap V3 fork (not Algebra) with custom fee tier 100 (0.01%).
 *
 * CONFIRMED ADDRESSES (WPROS/USDC, fee=100 pool):
 *   Pool:    0x912c9ade24d44d8922f0866d8dcb079f1363f647
 *   Factory: 0x2c90ccb0b989afa2433f499698451a25744a552b
 *   NPM:     0xc0479219f4feba5a668cff71bf96f4ffe124c3ab  ("Uniswap V3 Positions NFT-V1")
 *   WETH9:   0x52c48d4213107b20bc583832b0d951fb9ca8f0b0  (= WPROS, the native wrapper)
 *
 * Add-liquidity uses standard Uniswap V3 NPM.mint(MintParams) — selector 0x88316456.
 * MintParams struct: token0, token1, fee(uint24), tickLower, tickUpper,
 *                    amount0Desired, amount1Desired, amount0Min, amount1Min,
 *                    recipient, deadline.
 */

const RPC = "https://rpc.pharos.xyz";
const POOL = "0x912c9ade24d44d8922f0866d8dcb079f1363f647";

// Selectors
const SEL = {
  slot0:        "0x3850c7bd", // AMM V3 (Uniswap V3 style)
  getReserves:  "0x0902f1ac", // AMM V2
  BASE_TOKEN:   "0x4a248d2a", // PMM (DODO) _BASE_TOKEN_()
  token0:       "0x0dfe1681",
  token1:       "0xd21220a7",
  factory:      "0xc45a0155",
  fee:          "0xddca3f43",
  // Additional V3 pool reads
  liquidity:    "0x1a686502",
  tickSpacing:  "0xd0c93a7c",
  maxLiquidity: "0x70cf754a",
  // Try to get sqrtPriceX96 and tick from slot0 result
} as const;

async function ethCall(to: string, selector: string): Promise<string | null> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to, data: selector }, "latest"],
  };
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { result?: string; error?: { message: string } };
    if (json.error || !json.result || json.result === "0x") return null;
    return json.result;
  } catch {
    return null;
  }
}

function decodeAddress(hex: string): string {
  // ABI-encoded address: 32 bytes, address in last 20
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return "0x" + clean.slice(clean.length - 40);
}

function decodeUint256(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt("0x" + clean.slice(0, 64));
}

function decodeUint24(hex: string): number {
  return Number(decodeUint256(hex));
}

function decodeInt24(hex: string): number {
  const raw = Number(decodeUint256(hex));
  // int24 sign extend: max positive 2^23 - 1 = 8388607
  return raw > 8388607 ? raw - 16777216 : raw;
}

function decodeSlot0(hex: string): {
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
} {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  // slot0 returns: sqrtPriceX96 (uint160), tick (int24), observationIndex (uint16),
  //                observationCardinality (uint16), observationCardinalityNext (uint16),
  //                feeProtocol (uint8), unlocked (bool)
  // All ABI-padded to 32 bytes each
  const words = [];
  for (let i = 0; i < clean.length; i += 64) {
    words.push(clean.slice(i, i + 64));
  }
  const sqrtPriceX96 = BigInt("0x" + words[0]);
  // tick is int24 stored in word[1], right-aligned
  const tickRaw = parseInt(words[1].slice(56), 16); // last 3 bytes = int24
  // sign extend int24
  const tick = tickRaw > 8388607 ? tickRaw - 16777216 : tickRaw;
  const observationIndex = parseInt(words[2].slice(60), 16);
  const observationCardinality = parseInt(words[3].slice(60), 16);
  const observationCardinalityNext = parseInt(words[4].slice(60), 16);
  const feeProtocol = parseInt(words[5].slice(62), 16);
  const unlocked = parseInt(words[6].slice(62), 16) === 1;
  return { sqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext, feeProtocol, unlocked };
}

function sqrtPriceToPrice(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  // price of token0 in terms of token1
  const Q96 = BigInt(2) ** BigInt(96);
  const price = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);
  return price * Math.pow(10, decimals0 - decimals1);
}

export async function discoverPool() {
  console.log("=".repeat(60));
  console.log("FaroSwap Pool Discovery");
  console.log("Pool:", POOL);
  console.log("RPC: ", RPC);
  console.log("=".repeat(60));

  // --- Pool type detection ---
  console.log("\n[1] Detecting pool type...");

  const slot0Result    = await ethCall(POOL, SEL.slot0);
  const reservesResult = await ethCall(POOL, SEL.getReserves);
  const baseTokenResult = await ethCall(POOL, SEL.BASE_TOKEN);

  console.log("  slot0()       ->", slot0Result ? slot0Result.slice(0, 66) + "..." : "null (no response)");
  console.log("  getReserves() ->", reservesResult ? reservesResult.slice(0, 66) + "..." : "null (no response)");
  console.log("  _BASE_TOKEN_()->", baseTokenResult ?? "null (no response)");

  let poolType: "AMM_V3" | "AMM_V2" | "PMM" | "UNKNOWN" = "UNKNOWN";
  if (slot0Result) poolType = "AMM_V3";
  else if (reservesResult) poolType = "AMM_V2";
  else if (baseTokenResult) poolType = "PMM";

  console.log("\n  => POOL TYPE:", poolType);

  // --- Token addresses ---
  console.log("\n[2] Reading token0 / token1...");
  const [t0Raw, t1Raw] = await Promise.all([
    ethCall(POOL, SEL.token0),
    ethCall(POOL, SEL.token1),
  ]);
  const token0 = t0Raw ? decodeAddress(t0Raw) : "FAILED";
  const token1 = t1Raw ? decodeAddress(t1Raw) : "FAILED";
  console.log("  token0 raw ->", t0Raw);
  console.log("  token1 raw ->", t1Raw);
  console.log("  token0     ->", token0);
  console.log("  token1     ->", token1);

  // Cross-check against known addresses
  const WPROS = "0x52C48d4213107b20bC583832b0d951FB9CA8F0B0".toLowerCase();
  const USDC  = "0xc879c018db60520f4355c26ed1a6d572cdac1815".toLowerCase();
  console.log("  token0 is WPROS?", token0.toLowerCase() === WPROS);
  console.log("  token0 is USDC? ", token0.toLowerCase() === USDC);
  console.log("  token1 is WPROS?", token1.toLowerCase() === WPROS);
  console.log("  token1 is USDC? ", token1.toLowerCase() === USDC);

  // --- Factory ---
  console.log("\n[3] Reading factory...");
  const factoryRaw = await ethCall(POOL, SEL.factory);
  const factory = factoryRaw ? decodeAddress(factoryRaw) : "FAILED";
  console.log("  factory raw ->", factoryRaw);
  console.log("  factory     ->", factory);

  // --- Fee tier ---
  console.log("\n[4] Reading fee tier...");
  const feeRaw = await ethCall(POOL, SEL.fee);
  const fee = feeRaw ? decodeUint24(feeRaw) : -1;
  console.log("  fee raw ->", feeRaw);
  console.log("  fee     ->", fee, fee >= 0 ? `(${fee / 10000}%)` : "");

  // --- V3-specific: liquidity, tickSpacing, slot0 decoded ---
  if (poolType === "AMM_V3" && slot0Result) {
    console.log("\n[5] AMM V3 — decoding slot0...");
    const s0 = decodeSlot0(slot0Result);
    console.log("  slot0 full raw ->", slot0Result);
    console.log("  sqrtPriceX96   ->", s0.sqrtPriceX96.toString());
    console.log("  tick           ->", s0.tick);
    console.log("  observationIndex ->", s0.observationIndex);
    console.log("  observationCardinality ->", s0.observationCardinality);
    console.log("  feeProtocol    ->", s0.feeProtocol);
    console.log("  unlocked       ->", s0.unlocked);

    // Approximate price (token0/token1)
    // WPROS=18 decimals, USDC=6 decimals
    const t0IsWPROS = token0.toLowerCase() === WPROS;
    const dec0 = t0IsWPROS ? 18 : 6;
    const dec1 = t0IsWPROS ? 6 : 18;
    if (s0.sqrtPriceX96 > 0n) {
      const price = sqrtPriceToPrice(s0.sqrtPriceX96, dec0, dec1);
      console.log(`  price (token0 in token1) -> ~${price.toFixed(6)}`);
      if (t0IsWPROS) console.log("  => ~", price.toFixed(6), "USDC per WPROS");
      else           console.log("  => ~", price.toFixed(6), "WPROS per USDC");
    }

    console.log("\n[6] AMM V3 — liquidity & tickSpacing...");
    const [liqRaw, tsRaw, maxLiqRaw] = await Promise.all([
      ethCall(POOL, SEL.liquidity),
      ethCall(POOL, SEL.tickSpacing),
      ethCall(POOL, SEL.maxLiquidity),
    ]);
    console.log("  liquidity()        raw ->", liqRaw);
    console.log("  tickSpacing()      raw ->", tsRaw);
    console.log("  maxLiquidityPerTick raw ->", maxLiqRaw);
    if (liqRaw) console.log("  liquidity  ->", decodeUint256(liqRaw).toString());
    if (tsRaw)  console.log("  tickSpacing ->", Number(decodeUint256(tsRaw)));
  }

  // --- Try to find NonfungiblePositionManager from factory ---
  // Standard V3 factories expose: nonfungiblePositionManager() or positionManager()
  // DODO forks sometimes use different patterns. We probe common selectors.
  console.log("\n[7] Probing factory for NonfungiblePositionManager...");
  if (factory !== "FAILED") {
    const npm_selectors: Record<string, string> = {
      "nonfungiblePositionManager()": "0xb8e5e646",
      "positionManager()":            "0x6a4386b3",
      "nftDescriptor()":              "0x4b4da297",
      // try fetching owner/admin to confirm it's a factory
      "owner()":                      "0x8da5cb5b",
      "feeAmountTickSpacing(uint24)": "0x22afcccb",
    };
    for (const [name, sel] of Object.entries(npm_selectors)) {
      const result = await ethCall(factory, sel);
      console.log(`  factory.${name} (${sel}) ->`, result ?? "null");
    }
  }

  // --- Summary ---
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log("Pool address :", POOL);
  console.log("Pool type    :", poolType);
  console.log("token0       :", token0);
  console.log("token1       :", token1);
  console.log("factory      :", factory);
  console.log("fee tier     :", fee >= 0 ? `${fee} (${fee / 10000}%)` : "FAILED");
  console.log("=".repeat(60));

  return { poolType, token0, token1, factory, fee };
}

// Run when executed directly
discoverPool().catch(console.error);
