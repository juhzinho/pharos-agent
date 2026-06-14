import { TOKENS, CHAINS, CROSS_CHAIN_TOKENS, type TokenSymbol, type ChainName } from "./tokens";
import { type ParsedIntent } from "./parser";

export interface QuoteResult {
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    from?: string;
    gasLimit?: string;
    gasPrice?: string;
  };
  estimate: {
    toAmount: string;
    toAmountMin: string;
    executionDuration: number;
    feeCosts?: { name: string; amount: string; token: { symbol: string } }[];
    // The LI.FI Diamond/contract the source ERC-20 must be approved to.
    // Absent for native-token sources (no approval needed).
    approvalAddress?: string;
    fromAmount?: string;
  };
  action: {
    fromToken: { address: string; symbol: string; decimals: number };
    toToken: { symbol: string; decimals: number };
    fromChainId: number;
    toChainId: number;
    fromAmount?: string;
  };
  tool: string;
}

function resolveChainId(name: string): number {
  const key = (name.charAt(0).toUpperCase() + name.slice(1)) as ChainName;
  const chain = CHAINS[key];
  if (!chain) throw new Error(`Unsupported chain: ${name}`);
  return chain.id;
}

function resolveTokenForChain(symbol: string, chain: string): { address: string; decimals: number } {
  const upper = symbol.toUpperCase() as TokenSymbol;
  const chainKey = (chain.charAt(0).toUpperCase() + chain.slice(1)) as ChainName;
  const cross = CROSS_CHAIN_TOKENS[upper]?.[chainKey];
  if (cross) return cross;
  const token = TOKENS[upper];
  if (!token) throw new Error(`Unsupported token: ${symbol}`);
  return token;
}

// Exported so page.tsx can use the same chain-aware address for allowance checks
export function resolveTokenAddressForChain(symbol: string, chain: string): string {
  return resolveTokenForChain(symbol, chain).address;
}

export async function buildSwapBridge(
  intent: ParsedIntent,
  fromAddress: string
): Promise<QuoteResult> {
  const fromChain = intent.fromChain ?? "Pharos";
  const toChain = intent.action === "bridge" && intent.toChain ? intent.toChain : fromChain;

  const fromToken = resolveTokenForChain(intent.fromToken, fromChain);
  const toToken = resolveTokenForChain(intent.toToken, toChain);
  const fromChainId = resolveChainId(fromChain);
  const toChainId = resolveChainId(toChain);

  const rawAmount = BigInt(
    Math.floor(intent.amount * 10 ** fromToken.decimals)
  ).toString();

  const params = new URLSearchParams({
    fromChain: fromChainId.toString(),
    toChain: toChainId.toString(),
    fromToken: fromToken.address,
    toToken: toToken.address,
    fromAmount: rawAmount,
    fromAddress,
    order: "RECOMMENDED",
  });

  const response = await fetch(`https://li.quest/v1/quote?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  const data = await response.json().catch(() => ({}));
  console.log("[pharos:lifi-raw]", JSON.stringify(data).slice(0, 800));

  if (!response.ok) {
    throw new Error(
      data?.message || data?.errors?.[0]?.message || `LI.FI error: ${response.status}`
    );
  }

  if (!data.transactionRequest) {
    const routeLabel = `${intent.fromToken} ${fromChain} → ${toChain}`;
    throw new Error(
      `No bridge route found for ${routeLabel} via Jumper. ` +
      `The route may not be supported — try a different provider or token.`
    );
  }

  return data as QuoteResult;
}

export function formatReceiveAmount(quote: QuoteResult): string {
  const { toAmount } = quote.estimate;
  const decimals = quote.action.toToken.decimals;
  const symbol = quote.action.toToken.symbol;
  const human = Number(BigInt(toAmount)) / 10 ** decimals;
  return `${human.toFixed(decimals === 6 ? 4 : 6)} ${symbol}`;
}
