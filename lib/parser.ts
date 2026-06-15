export interface ParsedIntent {
  action: "swap" | "bridge" | "add_liquidity" | "remove_liquidity" | "view_positions";
  fromToken: string;
  toToken: string;
  amount: number;
  amount2?: number;
  fromChain: string;
  toChain?: string;
  // Liquidity-specific
  feeTier?: number;
  rangeMode?: "price" | "percent" | "full";
  minPrice?: number;
  maxPrice?: number;
  rangePercent?: number;
  // Remove liquidity specific
  positionId?: string;
  removeLiquidityPercent?: number;
  // Language detection
  detectedLanguage?: "en" | "pt-br" | "es" | "ja" | "zh-cn" | "hi" | "uk";
}

const KNOWN_TOKENS = ["WPROS", "PROS", "USDC", "WETH", "LINK", "PGOLD", "USDpm"];

const CHAIN_ALIASES: Record<string, string> = {
  pharos:   "Pharos",
  base:     "Base",
  ethereum: "Ethereum",
  eth:      "Ethereum",
  arbitrum: "Arbitrum",
  arb:      "Arbitrum",
  polygon:  "Polygon",
  matic:    "Polygon",
  optimism: "Optimism",
  op:       "Optimism",
};

const HELP = "I couldn't understand. Try: 'swap 0.5 PROS to USDC' or 'bridge 10 USDC to Base'";

function firstMatchIndex(str: string, token: string): number {
  const m = str.match(new RegExp(`\\b${token}\\b`));
  return m?.index ?? Infinity;
}

function resolveChainAlias(word: string): string | undefined {
  return CHAIN_ALIASES[word.toLowerCase()];
}

export function parseIntent(input: string): ParsedIntent {
  const lower = input.toLowerCase();
  const upper = input.toUpperCase();

  // Detect bridge keywords (EN + PT)
  const hasBridgeKeyword = /\b(bridge|ponte|manda|envia|transfere)\b/.test(lower);

  // Detect "from X" / "de X" / "da X" for source chain
  const fromMatch = lower.match(/\b(?:from|de|da)\s+(\w+)/);
  const fromChainResolved = fromMatch ? resolveChainAlias(fromMatch[1]) : undefined;

  // Detect "to X" / "para X" / "pra X" / "pro X" for destination chain
  const toMatch = lower.match(/\b(?:to|para|pra|pro)\s+(\w+)/);
  const toChainResolved = toMatch ? resolveChainAlias(toMatch[1]) : undefined;

  // Fallback: scan all chain names in the string (excluding Pharos so it doesn't self-match)
  let scannedChain: string | undefined;
  for (const [alias, name] of Object.entries(CHAIN_ALIASES)) {
    if (name !== "Pharos" && new RegExp(`\\b${alias}\\b`).test(lower)) {
      scannedChain = name;
      break;
    }
  }

  const fromChain = fromChainResolved ?? "Pharos";
  let toChain = toChainResolved ?? scannedChain;
  if (toChain === fromChain) toChain = undefined;

  const action: "swap" | "bridge" =
    hasBridgeKeyword || (!!toChain && toChain !== fromChain) ? "bridge" : "swap";

  // Amount
  const amountMatch = input.match(/\d+(\.\d+)?/);
  if (!amountMatch) throw new Error(HELP);
  const amount = parseFloat(amountMatch[0]);

  // Tokens
  const found = KNOWN_TOKENS.filter((t) =>
    new RegExp(`\\b${t}\\b`).test(upper)
  ).sort((a, b) => firstMatchIndex(upper, a) - firstMatchIndex(upper, b));

  // For bridge with single token: token is bridged to same token on destination chain
  if (action === "bridge" && found.length === 1) {
    if (!toChain) {
      throw new Error(
        HELP + "\n\nFor bridge, specify a destination chain: Base, Ethereum, Polygon, Arbitrum, or Optimism."
      );
    }
    return { action, fromToken: found[0], toToken: found[0], amount, fromChain, toChain };
  }

  if (found.length < 2) throw new Error(HELP);

  const result: ParsedIntent = {
    action,
    fromToken: found[0],
    toToken: found[1],
    amount,
    fromChain,
  };

  if (action === "bridge") {
    if (!toChain) {
      throw new Error(
        HELP + "\n\nFor bridge, specify a destination chain: Base, Ethereum, Polygon, Arbitrum, or Optimism."
      );
    }
    result.toChain = toChain;
  }

  return result;
}
