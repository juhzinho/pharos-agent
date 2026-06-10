export const TOKENS = {
  PROS:  { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  WPROS: { address: "0x52C48d4213107b20bC583832b0d951FB9CA8F0B0", decimals: 18 },
  USDC:  { address: "0xc879c018db60520f4355c26ed1a6d572cdac1815", decimals: 6 },
  WETH:  { address: "0x1f4b7011Ee3d53969bb67F59428a9ec0477856E9", decimals: 18 },
  LINK:  { address: "0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29", decimals: 18 },
  PGOLD: { address: "0x531f1e4A3CA96b9f42467659d8088b07FE8D2839", decimals: 18 },
  USDpm: { address: "0x16A7228ac1e772C5029d7069f3A6ECA66F894218", decimals: 18 },
};

export const CHAINS = {
  Pharos:   { id: 1672,  rpc: "https://rpc.pharos.xyz",         name: "Pharos" },
  Ethereum: { id: 1,     rpc: "https://eth.llamarpc.com",        name: "Ethereum" },
  Base:     { id: 8453,  rpc: "https://mainnet.base.org",        name: "Base" },
  Arbitrum: { id: 42161, rpc: "https://arb1.arbitrum.io/rpc",   name: "Arbitrum" },
  Polygon:  { id: 137,   rpc: "https://polygon-rpc.com",         name: "Polygon" },
  Optimism: { id: 10,    rpc: "https://mainnet.optimism.io",    name: "Optimism" },
};

// Per-chain token addresses for LI.FI cross-chain routes
export const CROSS_CHAIN_TOKENS: Partial<Record<TokenSymbol, Partial<Record<ChainName, { address: string; decimals: number }>>>> = {
  USDC: {
    Pharos:   { address: "0xc879c018db60520f4355c26ed1a6d572cdac1815", decimals: 6 },
    Ethereum: { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
    Base:     { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6 },
    Arbitrum: { address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6 },
    Polygon:  { address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", decimals: 6 },
    Optimism: { address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", decimals: 6 },
  },
};

export const CHAIN_WALLET_CONFIGS: Record<string, {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}> = {
  Pharos: {
    chainId: "0x688",
    chainName: "Pharos Mainnet",
    nativeCurrency: { name: "PROS", symbol: "PROS", decimals: 18 },
    rpcUrls: ["https://rpc.pharos.xyz"],
    blockExplorerUrls: ["https://www.pharosscan.xyz"],
  },
  Ethereum: {
    chainId: "0x1",
    chainName: "Ethereum Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://eth.llamarpc.com"],
    blockExplorerUrls: ["https://etherscan.io"],
  },
  Base: {
    chainId: "0x2105",
    chainName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"],
  },
  Arbitrum: {
    chainId: "0xa4b1",
    chainName: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://arbiscan.io"],
  },
  Polygon: {
    chainId: "0x89",
    chainName: "Polygon",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: ["https://polygon-rpc.com"],
    blockExplorerUrls: ["https://polygonscan.com"],
  },
  Optimism: {
    chainId: "0xa",
    chainName: "Optimism",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.optimism.io"],
    blockExplorerUrls: ["https://optimistic.etherscan.io"],
  },
};

// Keep for backwards compatibility
export const PHAROS_CHAIN = CHAIN_WALLET_CONFIGS.Pharos;

export type TokenSymbol = keyof typeof TOKENS;
export type ChainName = keyof typeof CHAINS;
