// Optional self-hosted x402 facilitator for Pharos (eip155:1672).
// Requires X402_FACILITATOR_PRIVATE_KEY (settler wallet with PROS for gas).
// Point X402_FACILITATOR_URL at https://pharos-agent-pi.vercel.app/api/x402/facilitator

import { createWalletClient, http, publicActions, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { PHAROS_CAIP2 } from "@/lib/x402";

const pharos = defineChain({
  id: 1672,
  name: "Pharos",
  nativeCurrency: { name: "PROS", symbol: "PROS", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.PHAROS_RPC?.trim() || "https://rpc.pharos.xyz"],
    },
  },
});

let cached: x402Facilitator | null = null;

export function getSelfFacilitator(): x402Facilitator | null {
  const pk = process.env.X402_FACILITATOR_PRIVATE_KEY?.trim();
  if (!pk) return null;
  if (cached) return cached;

  const key = (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`;
  const account = privateKeyToAccount(key);
  const client = createWalletClient({
    account,
    chain: pharos,
    transport: http(undefined, { timeout: 30_000 }),
  }).extend(publicActions);

  const signer = toFacilitatorEvmSigner({
    address: account.address,
    getCode: (args) => client.getCode(args),
    readContract: (args) =>
      client.readContract({ ...args, args: args.args || [] }),
    verifyTypedData: (args) => client.verifyTypedData(args as never),
    writeContract: (args) =>
      client.writeContract({ ...args, args: args.args || [] }),
    sendTransaction: (args) => client.sendTransaction(args),
    waitForTransactionReceipt: (args) => client.waitForTransactionReceipt(args),
  });

  const facilitator = new x402Facilitator();
  facilitator.register(PHAROS_CAIP2, new ExactEvmScheme(signer));
  cached = facilitator;
  return cached;
}
