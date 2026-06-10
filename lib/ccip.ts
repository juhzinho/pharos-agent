import { AbiCoder, Interface } from "ethers";
import { type ParsedIntent } from "./parser";

const CCIP_ROUTERS: Record<string, { address: string; selector: bigint }> = {
  Pharos:   { address: "0x4e52dD94e9BCfeFE3C78153bDfB0AB1d30687297", selector: 7801139999541420232n },
  Ethereum: { address: "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D", selector: 5009297550715157269n },
  Base:     { address: "0x881e3A65B4d4a04dD529061dd0071cf975F58bCD", selector: 15971525489660198786n },
  Arbitrum: { address: "0x141fa059441E0ca23ce184B6A78bafD2A517DdE8", selector: 4949039107694359620n },
  Polygon:  { address: "0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe", selector: 4051577828743386545n },
  Optimism: { address: "0x3206695CaE29952f4b0c22a169725a865bc8Ce0f", selector: 3734403246176062136n },
};

// Tokens available for CCIP when Pharos is the source chain
const CCIP_TOKENS_ON_PHAROS: Record<string, { address: string; decimals: number; lanes: string[] }> = {
  USDC:  { address: "0x7126C3FeF4e6a680eeE09Fb039B2236F638384B0", decimals: 6,  lanes: ["Ethereum"] },
  WETH:  { address: "0x1f4b7011Ee3d53969bb67F59428a9ec0477856E9", decimals: 18, lanes: ["Ethereum"] },
  WPROS: { address: "0x52C48d4213107b20bC583832b0d951FB9CA8F0B0", decimals: 18, lanes: ["Base", "Ethereum"] },
  LINK:  { address: "0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29", decimals: 18, lanes: ["Ethereum"] },
  PGOLD: { address: "0x531f1e4A3CA96b9f42467659d8088b07FE8D2839", decimals: 18, lanes: ["Arbitrum"] },
  USDpm: { address: "0x16A7228ac1e772C5029d7069f3A6ECA66F894218", decimals: 18, lanes: ["Arbitrum"] },
};

const ROUTER_ABI = [
  "function getFee(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) external view returns (uint256 fee)",
  "function ccipSend(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) external payable returns (bytes32)",
];

const routerIface = new Interface(ROUTER_ABI);
const abiCoder = AbiCoder.defaultAbiCoder();

export interface CcipRouteCheck {
  supported: boolean;
  reason?: string;
}

export function checkCcipSupport(intent: ParsedIntent): CcipRouteCheck {
  if (intent.fromChain !== "Pharos") {
    return { supported: false, reason: "CCIP from non-Pharos chains not yet supported — use Jumper" };
  }
  const token = CCIP_TOKENS_ON_PHAROS[intent.fromToken.toUpperCase()];
  if (!token) {
    return { supported: false, reason: `${intent.fromToken} is not supported by CCIP — use Jumper` };
  }
  const lane = intent.toChain ?? "";
  if (!token.lanes.includes(lane)) {
    return {
      supported: false,
      reason: `CCIP lane ${intent.fromToken}→${lane || "?"} not available (supported: ${token.lanes.join(", ")}) — use Jumper`,
    };
  }
  return { supported: true };
}

function buildExtraArgs(): string {
  // GenericExtraArgsV2: tag 0x181dcf10 + abi.encode(gasLimit=0, allowOutOfOrderExecution=false)
  const encoded = abiCoder.encode(["uint256", "bool"], [0n, false]);
  return "0x181dcf10" + encoded.slice(2);
}

export interface CcipTxData {
  routerAddress: string;
  callData: string;
  feeAmount: string;   // hex, native value to send with ccipSend
  tokenAddress: string;
  spender: string;     // router address (for ERC-20 approval)
  rawTokenAmount: string;
}

export async function buildCcipTransaction(
  intent: ParsedIntent,
  walletAddress: string
): Promise<CcipTxData> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not available");
  }

  const check = checkCcipSupport(intent);
  if (!check.supported) throw new Error(check.reason);

  const srcRouter = CCIP_ROUTERS[intent.fromChain];
  const dstRouter = CCIP_ROUTERS[intent.toChain!];
  const tokenInfo = CCIP_TOKENS_ON_PHAROS[intent.fromToken.toUpperCase()];

  const rawAmount = BigInt(Math.floor(intent.amount * 10 ** tokenInfo.decimals));

  const receiverEncoded = abiCoder.encode(["address"], [walletAddress]);
  const message = {
    receiver: receiverEncoded,
    data: "0x",
    tokenAmounts: [{ token: tokenInfo.address, amount: rawAmount }],
    feeToken: "0x0000000000000000000000000000000000000000",
    extraArgs: buildExtraArgs(),
  };

  // Get fee via eth_call on source chain router (wallet must already be on source chain)
  const getFeeData = routerIface.encodeFunctionData("getFee", [dstRouter.selector, message]);
  const feeHex = (await window.ethereum.request({
    method: "eth_call",
    params: [{ to: srcRouter.address, data: getFeeData }, "latest"],
  })) as string;
  const feeAmount = BigInt(feeHex);

  const callData = routerIface.encodeFunctionData("ccipSend", [dstRouter.selector, message]);

  return {
    routerAddress: srcRouter.address,
    callData,
    feeAmount: "0x" + feeAmount.toString(16),
    tokenAddress: tokenInfo.address,
    spender: srcRouter.address,
    rawTokenAmount: rawAmount.toString(),
  };
}
