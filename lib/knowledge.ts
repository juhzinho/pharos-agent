// CORE_KNOWLEDGE: ~600 tokens — included in every prompt.
// DETAILED_KNOWLEDGE: per-dapp sections, injected only when the user's message mentions that dapp.

export const CORE_KNOWLEDGE = `
=== PHAROS CORE KNOWLEDGE ===

NETWORK: Chain ID 1672 | RPC https://rpc.pharos.xyz | Explorer pharosscan.xyz
MAINNET: "Pacific Ocean" launched April 28, 2026 | 30,000 TPS | Sub-second finality | $52M funded
TOKENS: PROS (native gas+governance) | WPROS: 0x52c48d4213107b20bc583832b0d951fb9ca8f0b0 (18 dec) | USDC: 0xc879c018db60520f4355c26ed1a6d572cdac1815 (6 dec)
DOCS: docs.pharosnetwork.xyz | pharos.xyz | port.pharos.xyz/ecosystem | x.com/pharos_network | buildonpharos.com (dev portal) | github.com/PharosNetwork (official org)

PHAROS PORT (port.pharos.xyz): Official RealFi hub — campaigns/rewards, PROS staking, bridge/swap, Harbor (curated RWA), full ecosystem directory.

TVL LEADERS: R25 ~$93M | Centrifuge ~$15M | Ember ~$13M | FaroSwap ~$695K

ECOSYSTEM (one-line summaries):
Lending: Zona (app.zona.finance) lend/borrow RWAs+crypto | Morpho institutional RWA markets | TermMax fixed-rate ERC-4626
Perp: Bitverse (app.bitverse.zone) perp DEX + US stock futures, AI-powered
DEX: FaroSwap primary DEX (DODO) V3+V2+PMM | ZentraFi AMM+launchpad | GoctoFun bonding-curve | OKX DEX | Fly DEX
Staking: Faroo (app.faroo.xyz) stake PROS→stPROS earns staking+RWA yield simultaneously
RWA: R25 tokenized vaults (VRPCW/VRPCS/VRPCQ) USDC ERC-4626 | Centrifuge credit/debt (DROP/TIN) | Ember pAlpha yield vault | AquaFlux (app.aquaflux.pro) tri-token P/C/S | Agra RWA bonds | Asseto tokenized finance
Wallets: Topnod native wallet | OKX Wallet | AlchemyPay fiat on/off-ramp
Infra: CCIP 6-token bridge (no Optimism) | LI.FI/Jumper aggregator | LayerZero V2 | Stargate (stargate.finance, external UI) | Circle CCTP | Fiamma BTC bridge | Primus zkTLS | Babylon stBTC | EigenLayer stETH

KEY CONTRACTS:
FaroSwap NonfungiblePositionManager: 0xc0479219f4feba5a668cff71bf96f4ffe124c3ab
Fee tiers: 0.01%(100 PPM) | 0.05%(500) | 0.30%(3000) | 1.00%(10000)
CCIP tokens: USDC, WETH, WPROS, LINK, PGOLD, USDpm | Chains: Ethereum, Base, Arbitrum, Polygon (NOT Optimism)
Ember pAlpha vault: 0xe47e9ba4ea2320a6ed87246d02fd5c38485ed7d1

AGENT ACTIONS: swap (LI.FI) | bridge (LI.FI or CCIP) | add_liquidity (FaroSwap V3 WPROS/USDC only) | view_positions
AGENT CANNOT: deposit RWA vaults | remove liquidity | collect fees | vote | claim staking rewards
Bridge providers the agent EXECUTES: Jumper (LI.FI), Chainlink CCIP, and Circle CCTP v2 (USDC from Pharos to Ethereum/Base/Arbitrum/Optimism/Polygon — native burn&mint, no aggregator fee). Stargate (stargate.finance) and InterPort (app.interport.fi) support Pharos but only as external apps — the agent cannot build their transactions.
SECURITY: Never handle private keys/seed phrases. Non-custodial — user signs in own wallet. Only PROPOSE transactions, never claim execution.
=== END CORE KNOWLEDGE ===
`;

// Per-dapp detail sections — injected only when relevant keywords match the user's message.
export const DETAILED_KNOWLEDGE: Record<string, string> = {
  r25: `
R25 (~$93M TVL, largest Pharos protocol): Tokenized RWA vaults, USDC-denominated, ERC-4626 standard.
Vaults: VRPCW (weekly redemption, most liquid) | VRPCS (semi-annual redemption, higher yield) | VRPCQ (quarterly, intermediate).
Deposit USDC → receive vault shares that appreciate as real-world yield accrues from fixed income + credit facilities.
Risks: counterparty (off-chain default), redemption windows (not instant), regulatory, smart contract, oracle. Not FDIC insured.
`,
  faroo: `
Faroo (app.faroo.xyz | docs.faroo.xyz): Liquid staking PROS → stPROS (LST + ERC-4626 compatible).
stPROS simultaneously accrues: (1) Pharos staking rewards + (2) RWA yield — usable in DeFi while earning both.
Architecture: stPROS issued at the Bifrost L1 runtime level (native security). Cross-chain via SLPx contracts.
Governance: Polkadot shared security + Bifrost OpenGov. RSP: revenue-share program for integrators.
`,
  zona: `
Zona (app.zona.finance | docs.zona.finance): Lending + borrowing for RWAs and crypto.
LEND: supply assets → earn yield from borrower demand + underlying RWA yield.
BORROW: deposit collateral → borrow other assets while keeping ownership.
Crypto collateral supported: WBTC, WETH, WPROS, sUSDe, sUSDai, wstPROS.
RWA collateral: tokenized treasuries/T-bills, equities/ETFs (NVDA, TSLA, S&P 500), gold, commodities, real-estate funds.
Zona Points leaderboard for early users. Deep docs: docs.zona.finance
`,
  aquaflux: `
AquaFlux (app.aquaflux.pro | docs.aquaflux.pro): "LEGO factory for RWAs." Tri-Token model:
P (Principal): the base principal of the RWA position.
C (Coupon): the yield/interest stream — tradeable separately from the principal.
S (Shield): downside protection / insurance layer.
One RWA splits into 3 composable tokens so users can customize risk/return on-chain.
Deep docs: docs.aquaflux.pro
`,
  bitverse: `
Bitverse (app.bitverse.zone | wiki.bitverse.zone): All-in-one RWA Perp DEX, AI-powered.
Trades: crypto perpetuals AND US stock futures (RWAs) on-chain in one platform.
Features: Wallet SDK (Flutter integration), Deeplink integration, NFT query.
Affiliate program: bitverse.zone/affiliate. Deep docs: wiki.bitverse.zone
`,
  faroswap: `
FaroSwap (primary Pharos DEX, DODO-based):
Pool types: AMM V3 (concentrated liquidity, Uniswap V3-style) | AMM V2 (constant-product) | PMM (stablecoins/pegged assets).
WPROS/USDC V3 tick spacings: 0.01% fee → ts 1 | 0.05% → ts 10 | 0.30% → ts 60 | 1.00% → ts 200.
NonfungiblePositionManager: 0xc0479219f4feba5a668cff71bf96f4ffe124c3ab. Positions are ERC-721 NFTs.
Swap routing (on-chain verified): DODORouteProxy 0xa5ca5fbe34e444f366b373170541ec6902b0f75c (mixSwap), UniV3 adapter 0x4fd44181839d24e7c8f4d1b9288379109ec25fae, DODOApprove (ERC20 approval target) 0xbf105f4ffbd3825f5433d074008b9a76237d849c. WPROS/USDC 0.01% pool: 0x912c9ade24d44d8922f0866d8dcb079f1363f647.
Agent supports: swap via LI.FI routing (default) or direct FaroSwap pool (PROS/WPROS ↔ USDC only) + add concentrated liquidity to V3 WPROS/USDC pools.
`,
  stargate: `
Stargate (stargate.finance | docs.stargate.finance): the main bridge app built on LayerZero. 100+ chains (113 in the official LayerZero Value Transfer API), unified liquidity pools, lock+mint / burn+redeem mechanics, ~0.06% fee, instant guaranteed finality.
PHAROS SUPPORT (verified June 2026 via LayerZero VT API): Pharos is a supported chain (chainKey "pharos", chainId 1672). Tokens bridgeable from Pharos via Stargate: USDC (0xC879C018dB60520F4355C26eD1a6D572cdAC1815), rUSD, wsrUSD. PROS/WPROS and WETH are NOT bridgeable via Stargate from Pharos.
HOW TO USE: visit stargate.finance directly — it's an external UI. This agent CANNOT execute Stargate bridges: the LayerZero quote API requires a partner API key, and LI.FI does not route through Stargate on Pharos. The agent executes bridges only via Jumper (LI.FI) and Chainlink CCIP.
When a user mentions Stargate or LayerZero bridging: confirm Pharos is supported for USDC/rUSD/wsrUSD at stargate.finance, and offer Jumper (LI.FI) or CCIP if they want the agent to build the transaction instead.
`,
  interport: `
InterPort (interport.fi | app.interport.fi | docs.interport.fi): cross-chain bridge aggregator using Chainlink CCIP + Circle CCTP v1/v2 + LayerZero OFT.
PHAROS SUPPORT (verified from a real April 2026 transaction): InterPort DOES deliver to Pharos via Circle CCTP v2 — its docs' supported-chains list is outdated. InterPort's router (0x674cb5133a2deaa4abe86ed56cb7555960966320, same address on Base AND Pharos) wraps Circle's CCTP v2 TokenMessenger. Users can bridge USDC to/from Pharos at app.interport.fi.
InterPort's API/SDK is whitelist-only (no public API), so this agent cannot build InterPort transactions — but it CAN execute the same underlying rail directly: Circle CCTP v2 (USDC from Pharos), with no aggregator fee.
`,
  cctp: `
Circle CCTP v2 on Pharos (verified on-chain June 2026): native USDC burn & mint — the canonical Circle rail, no aggregator fee, no wrapped tokens.
Contracts (same canonical addresses on every supported chain): TokenMessengerV2 0x28b5a0e9c621a5badaa536219b3a228c8168cf5d | MessageTransmitterV2 0x81d40f21f12a8f0e3252bccb954d722d4c464b64 | Pharos TokenMinterV2 0xfd78ee919681417d192449715b2594ab58f5d002.
USDC on Pharos for CCTP: 0xc879c018db60520f4355c26ed1a6d572cdac1815 (the main DeFi USDC). Burn limit: 10,000,000 USDC per message.
Domain IDs (verified via localDomain()): Pharos=31, Ethereum=0, Optimism=2, Arbitrum=3, Base=6, Polygon=7.
Fast transfers (minFinalityThreshold=1000): delivered automatically by Circle relayers, typically under a minute; observed fees ~0.005–0.013% of the amount.
THIS AGENT EXECUTES CCTP v2 directly: bridge USDC from Pharos to Ethereum/Base/Arbitrum/Optimism/Polygon via approve + depositForBurn — say 'bridge X USDC to Base via circle/cctp'.
`,
  ember: `
Ember (~$13M TVL): Capital allocator / yield optimizer — actively managed DeFi strategy.
pAlpha vault: ERC-4626, USDC-based. Vault address: 0xe47e9ba4ea2320a6ed87246d02fd5c38485ed7d1.
Ember team actively allocates capital across Pharos DeFi for best risk-adjusted yield.
`,
  centrifuge: `
Centrifuge (~$15M TVL): Leading multi-chain RWA protocol, official Pharos partner.
Tokenizes real-world credit/debt: trade finance, consumer loans, mortgages, structured credit.
DROP token: senior tranche (lower risk/yield). TIN token: junior tranche (higher risk/yield, first-loss).
`,
  rwa: `
RWA (Real World Assets): Tokenizing traditional assets — bonds, credit, real estate, treasuries, receivables — as on-chain tokens.
Benefits: real-world yield in DeFi, 24/7 global access, composability for traditionally illiquid assets.
Pharos RealFi: 30,000 TPS + SPN architecture designed for institutional RWA settlement at scale.
RWA risks: counterparty (off-chain default), liquidity (redemption windows), regulatory, smart contract, oracle. Not FDIC insured.
Global RWA leaders: Ondo Finance (OUSG/USDY) | Centrifuge (credit) | Maple Finance (undercollateralized) | MakerDAO/Sky | BlackRock BUIDL | Franklin Templeton BENJI.
`,
  defi: `
Slippage: price diff between expected and actual execution. Higher for large trades or thin liquidity.
Impermanent Loss (IL): LP value diverges from holding when prices change. V3 concentrates both IL and fee income.
Yield farming: deploying capital to earn fees, emissions, or real yield (like RWA vaults).
Gas fees: PROS pays for Pharos transactions. Keep a small PROS balance for gas on swaps/bridges/LP.
ERC-4626: tokenized vault standard — deposit tokens → receive share tokens that appreciate with yield.
APY vs APR: APR = simple annual rate; APY = compounded. 10% APR monthly ≈ 10.47% APY.
Concentrated liquidity (V3): LPs set a price range — capital efficient, earns more fees, earns nothing outside range.
LST (Liquid Staking Token): staked position usable in DeFi simultaneously, e.g. stPROS from Faroo.
`,
  ccip: `
Chainlink CCIP (live Feb 2026): Pharos-native secure cross-chain protocol.
Bridgeable tokens: USDC, WETH, WPROS, LINK, PGOLD, USDpm (6 tokens only).
Supported destination chains from Pharos: Ethereum, Base, Arbitrum, Polygon. NOT Optimism.
Jumper (LI.FI): supports all major tokens including Optimism. Use for Optimism bridges.
`,
  github: `
Official Pharos GitHub org: github.com/PharosNetwork (NOTE: "pharos-labs" on GitHub is a DIFFERENT unrelated org — lighting products. The official org is "PharosNetwork").
Key repos:
pharos-skill-engine: the official Claude Code skill toolkit for Pharos (cast/forge based, networks.json + tokens.json configs) — the foundation for AI agent skills on Pharos.
examples: official Pharos code examples for developers | contracts: Pharos smart contracts | ops: operations tooling | resources: official resources.
safe-wallet-monorepo + safe-client-gateway: Safe (multisig) wallet integration for Pharos.
PharosTumbler, PharosCubenet: infrastructure projects.
Developer portal: buildonpharos.com.
`,
  exchanges: `
PROS exchange listings (Bitget Academy, April 2026):
PROS listed on Bitget spot trading April 28, 2026 (PROS/USDT pair) — Bitget calls itself the world's largest Universal Exchange (UEX). Also listed on Binance Alpha, OKX, and 13+ other major exchanges.
Bitget's framing: "Pharos is a Layer-1 designed to modernize global capital flows by connecting traditional finance with decentralized infrastructure."
PROS token utility: transactions/gas, staking, governance, ecosystem incentives (rewards for developers, users, liquidity providers).
Key partnerships highlighted: Morpho (native lending), Bitverse (high-speed PerpDEX trading).
Institutional positioning: transparency, auditability, compliance — "align blockchain with existing financial frameworks rather than replace them."
`,
  architecture: `
Pharos architecture & history (research articles — Gate Learn / Medium deep dives):
Total funding: $52M ($8M seed + $44M Series A) as of April 2026.
Core innovation: parallel execution mechanism — multiple transactions processed simultaneously. EVM-compatible, modular framework, parallel transaction processing for massive volume.
Modular architecture layers: Base, Core, Extension.
Native compliance support built into the architecture.
Positioning: "RealFi infrastructure bridging traditional financial assets and on-chain liquidity."
Testnet history: AtlanticOcean Testnet (Oct 2025) preceded the Pacific Ocean mainnet (April 28, 2026) — ocean naming convention for network releases.
Priorities vs general-purpose chains: high throughput, low latency, financial-grade capabilities, institutional asset security.
`,
  pros: `
PROS tokenomics:
Allocation: Ecosystem+Community 21% (incl. 6% airdrop) | Team+Investors 40% (12-mo cliff, 36-mo vest) | Foundation+Treasuries 25% | Node+Liquidity 14%.
Staking inflation: 0% for first 6 months post-mainnet, then 5% annual to node operators + delegators.
Listed on: Binance Alpha, OKX, Bitget, 13+ exchanges.
Restaking: integrates Babylon (stBTC) + EigenLayer (stETH) for additional network security.
`,
};

// Keyword → section mapping. Only the first 2 matches are used per query to cap token usage.
const DAPP_KEYWORDS: Array<{ keys: string[]; section: string }> = [
  { keys: ["r25", "vrpcw", "vrpcs", "vrpcq"], section: "r25" },
  { keys: ["faroo", "stpros", "st pros", "bifrost", "slpx"], section: "faroo" },
  { keys: ["zona", "colateral", "collateral", "susde", "wstpros", "sUSDai", "zona lending"], section: "zona" },
  { keys: ["aquaflux", "aqua flux", "p token", "c token", "s token", "tri-token", "coupon token"], section: "aquaflux" },
  { keys: ["bitverse", "bit verse", "us stock", "ações eua", "perpetual dex"], section: "bitverse" },
  { keys: ["faroswap", "faro swap", "tick spacing", "fee tier", "v3 pool", "lp nft", "dodo route", "mixswap"], section: "faroswap" },
  { keys: ["interport", "inter port"], section: "interport" },
  { keys: ["cctp", "circle", "burn and mint", "usdc nativo", "native usdc"], section: "cctp" },
  { keys: ["stargate", "star gate", "layerzero", "layer zero", "oft", "rusd", "wsrusd"], section: "stargate" },
  { keys: ["ember", "palpha", "p alpha", "palpha vault", "yield optimizer"], section: "ember" },
  { keys: ["centrifuge", "drop token", "tin token"], section: "centrifuge" },
  { keys: ["rwa", "real world asset", "ativo real", "realfi", "tokenized asset"], section: "rwa" },
  { keys: ["impermanent loss", "slippage explained", "erc-4626", "erc4626", "yield farming", "liquid staking token", "lst token", "apy vs apr"], section: "defi" },
  { keys: ["ccip", "chainlink ccip", "pgold", "usdpm"], section: "ccip" },
  { keys: ["pros token", "tokenomics", "token allocation", "pros vesting", "staking inflation"], section: "pros" },
  { keys: ["github", "skill engine", "pharos-skill-engine", "safe wallet", "multisig", "code example", "repositor", "buildonpharos", "dev portal"], section: "github" },
  { keys: ["bitget", "exchange", "listing", "listed", "pros/usdt", "spot trading", "uex"], section: "exchanges" },
  { keys: ["parallel execution", "modular", "base layer", "core layer", "extension layer", "atlantic", "testnet", "funding", "series a", "seed round", "compliance", "arquitetura", "architecture"], section: "architecture" },
];

export function getDetailedSection(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  const matched: string[] = [];
  for (const { keys, section } of DAPP_KEYWORDS) {
    if (keys.some((k) => lower.includes(k)) && !matched.includes(section)) {
      matched.push(section);
    }
    if (matched.length >= 2) break;
  }
  if (matched.length === 0) return "";
  return (
    "\n── DETAILED CONTEXT (retrieved for this question) ──────────────────\n" +
    matched.map((s) => (DETAILED_KNOWLEDGE[s] ?? "").trim()).join("\n") +
    "\n"
  );
}

// Kept for any legacy imports
export const PHAROS_KNOWLEDGE = CORE_KNOWLEDGE;
