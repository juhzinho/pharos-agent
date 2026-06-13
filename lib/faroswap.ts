// FaroSwap direct swap via the DODORouteProxy (mixSwap) — no aggregator API.
//
// ALL ADDRESSES VERIFIED ON-CHAIN (June 2026), see investigation notes:
//  - DODORouteProxy 0xa5ca…f75c: identified from real user swap txs to the
//    WPROS/USDC pool (selector 0xff84aafa = mixSwap(...)); identity confirmed by
//    its "DODORouteProxy: EXPIRED" revert string and a successful eth_call
//    simulation of locally-constructed calldata (1 PROS → 0.6113 USDC, matching
//    market price).
//  - UniV3 adapter + pool + assetTo layout + directions (0 = WPROS→USDC,
//    1 = USDC→WPROS) decoded from multiple real successful mixSwap txs.
//  - DODOApprove 0xbf10…849c (the ERC20 approval target) read on-chain via
//    proxy._DODO_APPROVE_PROXY_() → approveProxy._DODO_APPROVE_().
//
// Scope: only the verified WPROS/USDC fee-100 (0.01%) pool — pairs
// {PROS, WPROS} ↔ USDC. Other pairs/pools are NOT verified and must use LI.FI.
//
// Note on amounts: this proxy clamps the user's receive amount to
// expReturnAmount (positive slippage above it is kept by the protocol), so we
// always set expReturnAmount to our quoted amount and minReturnAmount below it.

import { AbiCoder, id } from "ethers";
import { readPoolState } from "./liquidity";
import type { ParsedIntent } from "./parser";

export const FAROSWAP_DIRECT = {
  ROUTE_PROXY: "0xa5ca5fbe34e444f366b373170541ec6902b0f75c",
  ADAPTER:     "0x4fD44181839D24e7C8f4D1B9288379109Ec25FAE",
  POOL:        "0x912c9aDe24D44d8922f0866D8Dcb079f1363f647", // WPROS/USDC fee 100
  DODO_APPROVE: "0xbf105f4ffbd3825f5433d074008b9a76237d849c",
  WPROS:  "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0",
  USDC:   "0xc879c018db60520f4355c26ed1a6d572cdac1815",
  NATIVE: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  POOL_FEE: 100, // 0.01%
} as const;

const RPC = "https://rpc.pharos.xyz";
const SLIPPAGE = 0.01; // 1%
const coder = AbiCoder.defaultAbiCoder();
const MIXSWAP_SELECTOR = id(
  "mixSwap(address,address,uint256,uint256,uint256,address[],address[],address[],uint256,bytes[],bytes,uint256)"
).slice(0, 10);

export interface FaroSwapBuildResult {
  txRequest: { to: string; data: string; value: string };
  expectedOut: number;   // human units of the output token
  minOut: number;
  outSymbol: string;
  needsApproval: boolean;
  approvalData?: { tokenAddress: string; spender: string; amount: string };
  description: string;
}

// Only the on-chain-verified pair is supported.
export function faroswapSupportsPair(fromToken: string, toToken: string): boolean {
  const f = fromToken.toUpperCase();
  const t = toToken.toUpperCase();
  const isProsSide = (s: string) => s === "PROS" || s === "WPROS";
  return (isProsSide(f) && t === "USDC") || (f === "USDC" && isProsSide(t));
}

async function rpcCall(method: string, params: unknown[]): Promise<string> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "RPC error");
  return j.result;
}

function buildMixSwapCalldata(opts: {
  fromToken: string;
  toToken: string;
  amountRaw: bigint;
  expReturn: bigint;
  minReturn: bigint;
  direction: 0 | 1;
  tokenIn: string;
  tokenOut: string;
}): string {
  const F = FAROSWAP_DIRECT;
  // moreInfo = (uint256 sqrtPriceLimitX96 = 0, abi.encode(tokenIn, tokenOut, uint24 fee))
  const moreInfo = coder.encode(
    ["uint256", "bytes"],
    [0n, coder.encode(["address", "address", "uint24"], [opts.tokenIn, opts.tokenOut, F.POOL_FEE])]
  );
  const feeData = coder.encode(["address", "uint256"], ["0x0000000000000000000000000000000000000000", 0n]);
  const params = coder.encode(
    ["address", "address", "uint256", "uint256", "uint256", "address[]", "address[]", "address[]", "uint256", "bytes[]", "bytes", "uint256"],
    [
      opts.fromToken, opts.toToken, opts.amountRaw, opts.expReturn, opts.minReturn,
      [F.ADAPTER], [F.POOL], [F.ADAPTER, F.ROUTE_PROXY],
      BigInt(opts.direction), [moreInfo], feeData,
      BigInt(Math.floor(Date.now() / 1000) + 1200),
    ]
  );
  return MIXSWAP_SELECTOR + params.slice(2);
}

async function checkAllowance(token: string, owner: string): Promise<bigint> {
  const data = "0xdd62ed3e" + owner.slice(2).padStart(64, "0") + FAROSWAP_DIRECT.DODO_APPROVE.slice(2).padStart(64, "0");
  const raw = await rpcCall("eth_call", [{ to: token, data }, "latest"]);
  return !raw || raw === "0x" ? 0n : BigInt(raw);
}

// Quote PROS/WPROS → USDC precisely by simulating the actual mixSwap via
// eth_call from the WPROS contract (it always holds enough native PROS to
// satisfy the node's balance check). WPROS swaps quote identically to native
// PROS (1:1 wrap, same pool).
async function quoteProsToUsdc(amountRaw: bigint): Promise<bigint> {
  const F = FAROSWAP_DIRECT;
  const data = buildMixSwapCalldata({
    fromToken: F.NATIVE, toToken: F.USDC, amountRaw,
    expReturn: 10n ** 30n, minReturn: 1n, direction: 0,
    tokenIn: F.WPROS, tokenOut: F.USDC,
  });
  const out = await rpcCall("eth_call", [
    { from: F.WPROS, to: F.ROUTE_PROXY, data, value: "0x" + amountRaw.toString(16) },
    "latest",
  ]);
  return BigInt(out);
}

export async function buildFaroSwapSwap(
  intent: ParsedIntent,
  userAddress: string
): Promise<FaroSwapBuildResult> {
  const F = FAROSWAP_DIRECT;
  const from = intent.fromToken.toUpperCase();
  const to = intent.toToken.toUpperCase();
  if (!faroswapSupportsPair(from, to)) {
    throw new Error("FaroSwap direct supports only PROS/WPROS ↔ USDC. Use LI.FI for other pairs.");
  }
  if (!(intent.amount > 0)) throw new Error("Amount must be positive");

  const prosToUsdc = to === "USDC";

  if (prosToUsdc) {
    const amountRaw = BigInt(Math.floor(intent.amount * 1e18));
    const expectedRaw = await quoteProsToUsdc(amountRaw);
    if (expectedRaw <= 0n) throw new Error("FaroSwap quote returned zero output");
    const minRaw = (expectedRaw * BigInt(Math.floor((1 - SLIPPAGE) * 10000))) / 10000n;

    const isNative = from === "PROS";
    const fromTokenAddr = isNative ? F.NATIVE : F.WPROS;
    const data = buildMixSwapCalldata({
      fromToken: fromTokenAddr, toToken: F.USDC, amountRaw,
      expReturn: expectedRaw, minReturn: minRaw, direction: 0,
      tokenIn: F.WPROS, tokenOut: F.USDC,
    });

    let needsApproval = false;
    let approvalData: FaroSwapBuildResult["approvalData"];
    if (!isNative) {
      const allowance = await checkAllowance(F.WPROS, userAddress);
      needsApproval = allowance < amountRaw;
      if (needsApproval) {
        approvalData = { tokenAddress: F.WPROS, spender: F.DODO_APPROVE, amount: amountRaw.toString() };
      }
    }

    const expectedOut = Number(expectedRaw) / 1e6;
    return {
      txRequest: { to: F.ROUTE_PROXY, data, value: isNative ? "0x" + amountRaw.toString(16) : "0x0" },
      expectedOut,
      minOut: Number(minRaw) / 1e6,
      outSymbol: "USDC",
      needsApproval,
      approvalData,
      description: `Swap ${intent.amount} ${from} → ~${expectedOut.toFixed(4)} USDC via FaroSwap (direct, 0.01% pool)`,
    };
  }

  // USDC → PROS/WPROS (direction 1). Quote from pool spot price (the exact-amount
  // simulation needs an existing DODOApprove allowance, which a first-time user
  // doesn't have yet); the 1% slippage margin covers price impact at this
  // pool's depth, and minReturnAmount protects the user on-chain.
  const amountRaw = BigInt(Math.floor(intent.amount * 1e6));
  const pool = await readPoolState(100);
  const grossPros = (intent.amount / pool.priceUSDCperWPROS) * (1 - F.POOL_FEE / 1e6);
  const expectedRaw = BigInt(Math.floor(grossPros * 1e18));
  if (expectedRaw <= 0n) throw new Error("FaroSwap quote returned zero output");
  const minRaw = (expectedRaw * BigInt(Math.floor((1 - SLIPPAGE) * 10000))) / 10000n;

  const wantsNative = to === "PROS";
  const data = buildMixSwapCalldata({
    fromToken: F.USDC, toToken: wantsNative ? F.NATIVE : F.WPROS, amountRaw,
    expReturn: expectedRaw, minReturn: minRaw, direction: 1,
    tokenIn: F.USDC, tokenOut: F.WPROS,
  });

  const allowance = await checkAllowance(F.USDC, userAddress);
  const needsApproval = allowance < amountRaw;

  const expectedOut = grossPros;
  return {
    txRequest: { to: F.ROUTE_PROXY, data, value: "0x0" },
    expectedOut,
    minOut: Number(minRaw) / 1e18,
    outSymbol: to,
    needsApproval,
    approvalData: needsApproval
      ? { tokenAddress: F.USDC, spender: F.DODO_APPROVE, amount: amountRaw.toString() }
      : undefined,
    description: `Swap ${intent.amount} USDC → ~${expectedOut.toFixed(4)} ${to} via FaroSwap (direct, 0.01% pool)`,
  };
}
