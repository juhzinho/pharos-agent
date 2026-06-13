// Circle CCTP v2 — direct USDC bridge FROM Pharos (no aggregator fee).
//
// ALL FACTS REVERSE-ENGINEERED FROM REAL TRANSACTIONS (June 2026):
//  - Canonical CCTP v2 contracts exist ON Pharos at the same CREATE2 addresses
//    as Base/Arbitrum/Optimism/Ethereum/Polygon (code + localDomain() verified
//    per chain via RPC):
//      TokenMessengerV2:     0x28b5a0e9c621a5badaa536219b3a228c8168cf5d
//      MessageTransmitterV2: 0x81d40f21f12a8f0e3252bccb954d722d4c464b64
//      TokenMinterV2 (Pharos): 0xfd78ee919681417d192449715b2594ab58f5d002
//  - Pharos burnLimitsPerMessage(USDC 0xc879…1815) = 10,000,000 USDC.
//  - Real users already burn FROM Pharos: e.g. tx 0x9e38401f…f25f4bf0 called
//    depositForBurn (selector 0x8e0250ee) directly on the TokenMessenger,
//    10 USDC → domain 6 (Base), maxFee 500, minFinalityThreshold 1000.
//  - The user's own InterPort Base→Pharos transfer (tx pair in repo history)
//    was delivered on Pharos by Circle's relayer calling receiveMessage —
//    fast transfers (minFinalityThreshold 1000) are auto-delivered.
//
// Domain IDs verified by calling localDomain() on each chain's canonical
// MessageTransmitterV2: Pharos=31, Ethereum=0, Optimism=2, Arbitrum=3,
// Base=6, Polygon=7.
//
// Scope: USDC FROM Pharos only (the direction proven by real burns + the
// on-chain burn limit). Bridges TO Pharos go via LI.FI/CCIP or app.interport.fi.

import { AbiCoder, id } from "ethers";
import type { ParsedIntent } from "./parser";

export const CCTP_V2 = {
  TOKEN_MESSENGER:     "0x28b5a0e9c621a5badaa536219b3a228c8168cf5d",
  MESSAGE_TRANSMITTER: "0x81d40f21f12a8f0e3252bccb954d722d4c464b64",
  USDC_PHAROS:         "0xc879c018db60520f4355c26ed1a6d572cdac1815",
} as const;

// Verified via localDomain() on each chain's canonical transmitter.
export const CCTP_DOMAINS: Record<string, number> = {
  Ethereum: 0,
  Optimism: 2,
  Arbitrum: 3,
  Base: 6,
  Polygon: 7,
};

const PHAROS_RPC = "https://rpc.pharos.xyz";
// Fast-transfer params observed in real txs: minFinalityThreshold=1000,
// maxFee ≈ 0.5–1.3 bps. We cap at 10 bps — the actual charged fee is Circle's
// real fee at delivery time; maxFee is only an upper bound.
const MIN_FINALITY_FAST = 1000;
const MAX_FEE_BPS = 10n;

const coder = AbiCoder.defaultAbiCoder();
const DEPOSIT_FOR_BURN_SELECTOR = id(
  "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)"
).slice(0, 10);

export interface CctpRouteCheck {
  supported: boolean;
  reason?: string;
}

export function checkCctpSupport(intent: ParsedIntent): CctpRouteCheck {
  if (intent.fromToken.toUpperCase() !== "USDC") {
    return { supported: false, reason: "CCTP v2 bridges USDC only" };
  }
  if ((intent.fromChain ?? "Pharos") !== "Pharos") {
    return { supported: false, reason: "Direct CCTP v2 is implemented from Pharos only" };
  }
  const dst = intent.toChain ?? "";
  if (!(dst in CCTP_DOMAINS)) {
    return {
      supported: false,
      reason: `CCTP v2 destinations: ${Object.keys(CCTP_DOMAINS).join(", ")}`,
    };
  }
  return { supported: true };
}

export interface CctpTxData {
  to: string;            // TokenMessengerV2
  data: string;          // depositForBurn calldata
  amountRaw: bigint;
  maxFeeRaw: bigint;
  destinationDomain: number;
  needsApproval: boolean;
  approvalData?: { tokenAddress: string; spender: string; amount: string };
  description: string;
}

async function checkAllowance(owner: string): Promise<bigint> {
  const data =
    "0xdd62ed3e" +
    owner.slice(2).padStart(64, "0") +
    CCTP_V2.TOKEN_MESSENGER.slice(2).padStart(64, "0");
  const res = await fetch(PHAROS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "eth_call",
      params: [{ to: CCTP_V2.USDC_PHAROS, data }, "latest"],
    }),
  });
  const j = await res.json();
  return !j.result || j.result === "0x" ? 0n : BigInt(j.result);
}

export async function buildCctpTransaction(
  intent: ParsedIntent,
  userAddress: string
): Promise<CctpTxData> {
  const check = checkCctpSupport(intent);
  if (!check.supported) throw new Error(check.reason);
  if (!(intent.amount > 0)) throw new Error("Amount must be positive");

  const destinationDomain = CCTP_DOMAINS[intent.toChain!];
  const amountRaw = BigInt(Math.floor(intent.amount * 1e6));
  const maxFeeRaw = (amountRaw * MAX_FEE_BPS) / 10000n + 1n;
  // mintRecipient: the user's own wallet on the destination, as bytes32
  const mintRecipient = "0x" + userAddress.slice(2).toLowerCase().padStart(64, "0");
  const destinationCaller = "0x" + "0".repeat(64); // anyone may deliver

  const data =
    DEPOSIT_FOR_BURN_SELECTOR +
    coder
      .encode(
        ["uint256", "uint32", "bytes32", "address", "bytes32", "uint256", "uint32"],
        [amountRaw, destinationDomain, mintRecipient, CCTP_V2.USDC_PHAROS, destinationCaller, maxFeeRaw, MIN_FINALITY_FAST]
      )
      .slice(2);

  const allowance = await checkAllowance(userAddress);
  const needsApproval = allowance < amountRaw;

  return {
    to: CCTP_V2.TOKEN_MESSENGER,
    data,
    amountRaw,
    maxFeeRaw,
    destinationDomain,
    needsApproval,
    approvalData: needsApproval
      ? { tokenAddress: CCTP_V2.USDC_PHAROS, spender: CCTP_V2.TOKEN_MESSENGER, amount: amountRaw.toString() }
      : undefined,
    description:
      `Bridge ${intent.amount} USDC Pharos → ${intent.toChain} via Circle CCTP v2 ` +
      `(native burn & mint, fast transfer, fee ≤ 0.1%)`,
  };
}
