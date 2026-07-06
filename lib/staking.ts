// Faroo liquid staking (Pharos Mainnet) — stake PROS → stPROS and unstake
// stPROS → PROS. stPROS (0x6b0a…5ec4) is an ERC-4626 vault whose underlying
// asset is WPROS (verified on-chain: asset() = WPROS, previewDeposit 1:1 at
// launch, NAV grows with staking rewards). The agent only BUILDS transactions —
// the user signs each one in their own wallet (non-custodial).
//
// Stake flow (up to 3 txs):
//   1. WPROS.deposit()            — wrap native PROS (only the missing amount)
//   2. WPROS.approve(stPROS, x)   — only if allowance is short
//   3. stPROS.deposit(x, user)    — mint stPROS shares
// Unstake flow (2 txs):
//   1. stPROS.redeem(shares, user, user) — burn shares, receive WPROS
//   2. WPROS.withdraw(x)                 — unwrap to native PROS

export const FAROO = {
  STPROS: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
  WPROS:  "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0",
} as const;

// The vault itself has NO on-chain minimum (previewDeposit accepts 1 wei —
// verified via RPC). This is the agent's practical minimum: below it, gas
// costs would eat any staking yield.
export const MIN_STAKE_PROS = 0.1;

const RPC = "https://rpc.pharos.xyz";

const SEL = {
  BALANCE_OF:    "0x70a08231",
  ALLOWANCE:     "0xdd62ed3e",
  TOTAL_ASSETS:  "0x01e1d114",
  TOTAL_SUPPLY:  "0x18160ddd",
  PREVIEW_DEP:   "0xef8b30f7", // previewDeposit(uint256)
  PREVIEW_RED:   "0x4cdad506", // previewRedeem(uint256)
  DEPOSIT_4626:  "0x6e553f65", // deposit(uint256,address)
  REDEEM_4626:   "0xba087652", // redeem(uint256,address,address)
  WRAP:          "0xd0e30db0", // WPROS deposit() payable
  UNWRAP:        "0x2e1a7d4d", // WPROS withdraw(uint256)
  APPROVE:       "0x095ea7b3",
} as const;

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

async function nativeBalance(addr: string): Promise<bigint> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [addr, "latest"] }),
  });
  const j = await res.json();
  return j.result && j.result !== "0x" ? BigInt(j.result) : 0n;
}

function hexToBig(hex: string | null | undefined): bigint {
  return hex && hex !== "0x" ? BigInt(hex) : 0n;
}

function pad(v: string | bigint): string {
  return (typeof v === "bigint" ? v.toString(16) : v.replace(/^0x/, "").toLowerCase()).padStart(64, "0");
}

function toRaw(amount: number): bigint {
  // 18-decimal fixed point without float drift.
  const s = amount.toFixed(18);
  const [int, frac = ""] = s.split(".");
  return BigInt(int + frac.padEnd(18, "0").slice(0, 18));
}

export interface StakeStepTx {
  to: string;
  data: string;
  value: bigint;
  label: string; // button progress label
  // Final unwrap of an unstake: the WPROS actually received from redeem can
  // differ by a few wei from the preview (the vault NAV moves every block).
  // When set, the signer re-reads the live WPROS balance right before sending
  // and unwraps min(rawAmount, balance) — prevents "require(false)" reverts.
  adjustToWprosBalance?: boolean;
  rawAmount?: bigint;
}

/** Calldata for WPROS.withdraw(raw). */
export function buildUnwrapData(raw: bigint): string {
  return SEL.UNWRAP + pad(raw);
}

/** Live WPROS balance (raw 18-dec units). */
export async function getWprosBalanceRaw(addr: string): Promise<bigint> {
  return ethCall(FAROO.WPROS, SEL.BALANCE_OF + pad(addr)).then(hexToBig).catch(() => 0n);
}

export interface StakeBuild {
  kind: "stake" | "unstake";
  amount: number;        // human units (PROS for stake, stPROS for unstake)
  expectedOut: number;   // stPROS (stake) or PROS (unstake)
  nav: number;           // WPROS per stPROS share
  txs: StakeStepTx[];
  description: string;
  rescue?: boolean;      // unwrap-only build (finishing a half-done unstake)
}

export interface StakeError { error: string }

/** Current NAV of the stPROS vault (WPROS per share). */
export async function getStakeNav(): Promise<number> {
  const [assetsHex, supplyHex] = await Promise.all([
    ethCall(FAROO.STPROS, SEL.TOTAL_ASSETS),
    ethCall(FAROO.STPROS, SEL.TOTAL_SUPPLY),
  ]);
  const assets = Number(hexToBig(assetsHex)) / 1e18;
  const supply = Number(hexToBig(supplyHex)) / 1e18;
  return supply > 0 ? assets / supply : 1;
}

/**
 * Builds the stake flow for the given signer, with live balance checks.
 * Uses any WPROS the user already holds and only wraps the missing PROS.
 */
export async function buildStakeTxs(amount: number, signer: string): Promise<StakeBuild | StakeError> {
  if (!(amount > 0)) return { error: "Invalid amount." };
  if (amount < MIN_STAKE_PROS) {
    return { error: `Minimum stake is ${MIN_STAKE_PROS} PROS (you entered ${amount}).` };
  }
  const raw = toRaw(amount);
  const owner = pad(signer);

  const [native, wprosBal, allowance, previewHex, nav] = await Promise.all([
    nativeBalance(signer),
    ethCall(FAROO.WPROS, SEL.BALANCE_OF + owner).then(hexToBig).catch(() => 0n),
    ethCall(FAROO.WPROS, SEL.ALLOWANCE + owner + pad(FAROO.STPROS)).then(hexToBig).catch(() => 0n),
    ethCall(FAROO.STPROS, SEL.PREVIEW_DEP + pad(raw)).catch(() => "0x"),
    getStakeNav().catch(() => 1),
  ]);

  const needWrap = raw > wprosBal ? raw - wprosBal : 0n;
  // Keep a small native buffer for gas when wrapping.
  const gasBuffer = 5n * 10n ** 15n; // 0.005 PROS
  if (needWrap > 0n && native < needWrap + gasBuffer) {
    const have = Number(native) / 1e18;
    return {
      error:
        `Insufficient PROS: you have ${have.toFixed(6)} native PROS ` +
        `(+ ${(Number(wprosBal) / 1e18).toFixed(6)} WPROS) but staking ${amount} PROS needs ` +
        `${(Number(needWrap) / 1e18).toFixed(6)} more native PROS plus gas.`,
    };
  }

  const txs: StakeStepTx[] = [];
  if (needWrap > 0n) {
    txs.push({ to: FAROO.WPROS, data: SEL.WRAP, value: needWrap, label: "Wrapping PROS…" });
  }
  if (allowance < raw) {
    txs.push({
      to: FAROO.WPROS,
      data: SEL.APPROVE + pad(FAROO.STPROS) + pad(raw),
      value: 0n,
      label: "Approving WPROS…",
    });
  }
  txs.push({
    to: FAROO.STPROS,
    data: SEL.DEPOSIT_4626 + pad(raw) + owner,
    value: 0n,
    label: "Staking…",
  });

  const expectedOut = Number(hexToBig(previewHex)) / 1e18 || amount / nav;
  return {
    kind: "stake",
    amount,
    expectedOut,
    nav,
    txs,
    description:
      `Faroo Liquid Staking · stake ${amount} PROS\n` +
      `You receive: ~${expectedOut.toFixed(6)} stPROS (NAV ${nav.toFixed(6)} PROS/stPROS)\n` +
      `Steps: ${txs.length} tx${txs.length > 1 ? "s" : ""} — ${needWrap > 0n ? "wrap → " : ""}${allowance < raw ? "approve → " : ""}deposit`,
  };
}

/** Builds the unstake flow: redeem stPROS shares → WPROS → native PROS. */
export async function buildUnstakeTxs(amount: number, signer: string): Promise<StakeBuild | StakeError> {
  if (!(amount > 0)) return { error: "Invalid amount." };
  const raw = toRaw(amount);
  const owner = pad(signer);

  const [shares, wprosBal, previewHex, nav] = await Promise.all([
    ethCall(FAROO.STPROS, SEL.BALANCE_OF + owner).then(hexToBig).catch(() => 0n),
    getWprosBalanceRaw(signer),
    ethCall(FAROO.STPROS, SEL.PREVIEW_RED + pad(raw)).catch(() => "0x"),
    getStakeNav().catch(() => 1),
  ]);

  if (shares < raw) {
    // Rescue path: a previous unstake may have redeemed stPROS → WPROS but
    // failed on the final unwrap, leaving WPROS stranded. If the WPROS balance
    // covers the request, finish the job with a single unwrap tx.
    if (wprosBal >= raw) {
      return {
        kind: "unstake",
        amount,
        expectedOut: amount,
        nav,
        txs: [{
          to: FAROO.WPROS,
          data: buildUnwrapData(raw),
          value: 0n,
          label: "Unwrapping to PROS…",
          adjustToWprosBalance: true,
          rawAmount: raw,
        }],
        description:
          `Faroo Liquid Staking · unwrap ${amount} WPROS\n` +
          `You already redeemed this from stPROS — finishing the unstake: WPROS → native PROS.\n` +
          `Steps: 1 tx — unwrap`,
        rescue: true,
      };
    }
    return {
      error:
        `Insufficient stPROS: you have ${(Number(shares) / 1e18).toFixed(6)} ` +
        `but tried to unstake ${amount}.`,
    };
  }

  const outRaw = hexToBig(previewHex);
  const expectedOut = Number(outRaw) / 1e18 || amount * nav;

  const unwrapRaw = outRaw > 0n ? outRaw : toRaw(expectedOut);
  const txs: StakeStepTx[] = [
    {
      to: FAROO.STPROS,
      data: SEL.REDEEM_4626 + pad(raw) + owner + owner,
      value: 0n,
      label: "Unstaking…",
    },
    {
      to: FAROO.WPROS,
      data: buildUnwrapData(unwrapRaw),
      value: 0n,
      label: "Unwrapping to PROS…",
      adjustToWprosBalance: true,
      rawAmount: unwrapRaw,
    },
  ];

  return {
    kind: "unstake",
    amount,
    expectedOut,
    nav,
    txs,
    description:
      `Faroo Liquid Staking · unstake ${amount} stPROS\n` +
      `You receive: ~${expectedOut.toFixed(6)} PROS (NAV ${nav.toFixed(6)} PROS/stPROS)\n` +
      `Steps: 2 txs — redeem → unwrap`,
  };
}

/** stPROS balance of an address (human units). */
export async function getStakedBalance(addr: string): Promise<number> {
  const hex = await ethCall(FAROO.STPROS, SEL.BALANCE_OF + pad(addr)).catch(() => "0x");
  return Number(hexToBig(hex)) / 1e18;
}
