// CORE_KNOWLEDGE: ~600 tokens — included in every prompt.
// DETAILED_KNOWLEDGE: per-dapp sections, injected only when the user's message mentions that dapp.

export const CORE_KNOWLEDGE = `
=== PHAROS CORE KNOWLEDGE ===

NETWORK: Chain ID 1672 | RPC https://rpc.pharos.xyz | WSS wss://rpc.pharos.xyz | Explorer https://pharos.socialscan.io (also pharosscan.xyz)
MAINNET: "Pacific Ocean" launched April 28, 2026 | 30,000 TPS, 2 Gigagas/s, block <1s | Dual VM (EVM + WASM) | AsyncBFT + speculative parallel execution → sub-second finality | Founded by ex-Ant Group leadership | ~$52M raised ($8M seed: Hack VC, Faction VC + $44M Series A)
TESTNET: Atlantic Testnet | Chain ID 688689 | RPC https://atlantic.dplabs-internal.com | Explorer https://atlantic.pharosscan.xyz | Symbol PHRS | Rate limit: 500 req/5min
NATIVE TOKEN: PROS (gas + governance + staking) | No inflation for first 6 months post-mainnet, then 5% annual to validators/delegators
TOKENS (Mainnet addresses):
  WPROS (Wrapped PROS): 0x52c48d4213107b20bc583832b0d951fb9ca8f0b0 (18 dec) | ETH: 0xB197E02499e6502733C6bCE2eb39013C39A03147 | Base: 0x8B7DdE054BE9D180c1Be7FaE0874697374A49832
  USDC (Circle): 0xc879c018db60520f4355c26ed1a6d572cdac1815 (6 dec)
  WETH: 0x1f4b7011Ee3d53969bb67F59428a9ec0477856E9 (18 dec)
  LINK: 0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29 (18 dec) | ETH LINK: 0x514910771AF9Ca656af840dff83E8264EcF986CA
DOCS: docs.pharos.xyz | pharos.xyz | port.pharos.xyz | x.com/pharos_network (390.6K followers) | github.com/PharosNetwork | pharos.xyz/agent-center | pharos.xyz/devhub
PHAROS PORT (port.pharos.xyz): Official RealFi hub — campaigns/rewards, PROS staking (~10% APY), bridge/swap, Harbor (curated RWA), AI Agent Carnival, full ecosystem directory.
COMMUNITY (July 2026): 312K members | 390.6K Twitter followers | 174M wallet addresses | 3B testnet users | 93,552 mainnet unique addresses | 2.7M mainnet txs | 431K daily active txs

TVL LEADERS: R25 ~$93M | Centrifuge ~$15M | Ember ~$13M | FaroSwap ~$695K

ECOSYSTEM (42 active projects on port.pharos.xyz/ecosystem — one-line summaries):
Lending: Zona (app.zona.finance) lend/borrow RWAs+crypto | Morpho institutional RWA markets | TermMax fixed-rate ERC-4626 | Avalon Finance lending | OKU aggregator (0% fees)
Perp: Bitverse (app.bitverse.zone) perp DEX + US stock futures, AI-powered
DEX: FaroSwap primary DEX (DODO) V3+V2+PMM | Agra onchain credit/bonds trading | ZentraFi AMM+launchpad | GoctoFun bonding-curve | OKX DEX | Fly DEX
Staking: Faroo (app.faroo.xyz) stake PROS→stPROS earns staking+RWA yield simultaneously | Pre-mint LIVE July 2026 | FIRST Pharos Incubator project
RWA: R25 tokenized vaults (VRPCW/VRPCS/VRPCQ) USDC ERC-4626 | Centrifuge credit/debt (DROP/TIN) | Ember pAlpha yield vault | AquaFlux (app.aquaflux.pro) tri-token P/C/S | Agra RWA bonds | Asseto tokenized finance
Wallets: Topnod native wallet | OKX Wallet | OneKey | KuCoin Wallet | AlchemyPay fiat on/off-ramp | Fordefi (institutional MPC) | Safe MultiSig | Anchorage (custody)
Infra: CCIP 6-token bridge | LI.FI/Jumper aggregator | LayerZero V2 | InterPort bridge | Stargate (USDC/rUSD) | Circle CCTP v2 | Fiamma BTC bridge | Primus zkTLS | Babylon stBTC | EigenLayer stETH | Goldsky indexer | Hemera indexer | Supra Oracle | ZAN/Alchemy/Nirvana RPC
Security: Hypernative | Zellic | ExVul | OpenZeppelin | TRM (KYT) | Trusta Labs
Identity/NFT: PNS (.pharos domains) | ZNS Connect | Grandline NFT | Pharosverse navigator

CANONICAL CONTRACTS (Pacific Mainnet):
  Create2Deployer: 0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2
  MultiCall3: 0xcA11bde05977b3631167028862bE2a173976CA11
  GnosisSafe v1.3.0: 0x69f4D1788e39c87893C980c06EdF4b7f686e2938
  Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3
  ERC-4337 EntryPoint v0.7: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
  ERC-4337 EntryPoint v0.6: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
  CreateX: 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed

KEY CONTRACTS:
FaroSwap NonfungiblePositionManager: 0xc0479219f4feba5a668cff71bf96f4ffe124c3ab
FaroSwap DODORouteProxy (swap router): 0xa5ca5fbe34e444f366b373170541ec6902b0f75c
FaroSwap DODOApprove (ERC20 approval target): 0xbf105f4ffbd3825f5433d074008b9a76237d849c
FaroSwap WPROS/USDC 0.01% pool: 0x912c9ade24d44d8922f0866d8dcb079f1363f647
Fee tiers: 0.01%(100 PPM) | 0.05%(500) | 0.30%(3000) | 1.00%(10000)
CCIP Router (Pharos): 0x4e52dD94e9BCfeFE3C78153bDfB0AB1d30687297 | Chain Selector: 7801139999541420232
CCIP tokens: USDC, WETH, WPROS, LINK, PGOLD, USDpm | Chains: Ethereum, Base, Arbitrum, Polygon, Jovay (NOT Optimism)
CCTP v2 TokenMessengerV2: 0x28b5a0e9c621a5badaa536219b3a228c8168cf5d | MessageTransmitterV2: 0x81d40f21f12a8f0e3252bccb954d722d4c464b64
CCTP Domain IDs: Pharos=31, Ethereum=0, Optimism=2, Arbitrum=3, Base=6, Polygon=7
Ember pAlpha vault: 0xe47e9ba4ea2320a6ed87246d02fd5c38485ed7d1

GAS MODEL: EIP-1559 compatible | Base fee burned | Priority fee to validator (batched at epoch) | ALWAYS set gas limit 20% above estimated gas (refund mechanism requires buffer) | Use estimateGas() + 1.2x multiplier

AGENT ACTIONS: swap (LI.FI or FaroSwap direct) | bridge (LI.FI, CCIP, or CCTP v2) | add_liquidity (FaroSwap V3 WPROS/USDC) | remove_liquidity (FaroSwap V3) | view_positions | view_wallet | stake PROS → stPROS (Faroo liquid staking, ERC-4626) | unstake stPROS → PROS | live global RWA market data (rwa.xyz: aggregates, top networks, leaders by asset class — user asks "rwa market" / "mercado rwa")
AGENT CANNOT: deposit RWA vaults (FRHV001/FYV001, R25, pALPHA…) | vote
Bridge providers the agent EXECUTES: Jumper (LI.FI), Chainlink CCIP, Circle CCTP v2 (USDC burn&mint). Stargate and InterPort are external apps only.
SECURITY: Never handle private keys/seed phrases. Non-custodial — user signs in own wallet. Only PROPOSE transactions, never claim execution.

ARCHITECTURE:
L1-Base: data availability + hardware acceleration
L1-Core: high-performance globally distributed nodes, 30,000 TPS, sub-second finality, AsyncBFT consensus
L1-Extension: SPNs (Special Processing Networks) for custom computation (HFT, ZKML, AI) + native restaking + cross-SPN interoperability
Dual VM: EVM (Ethereum-compatible) + WASM (for high-performance apps) running simultaneously
Parallel execution: speculative execution of multiple transactions simultaneously → near-zero state contention → 2 Gigagas/s throughput
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
Faroo (app.faroo.xyz | docs.faroo.xyz): Liquid staking PROS → stPROS (LST + ERC-4626 compatible). FIRST project selected by Pharos $10M Incubator (July 2, 2026).
stPROS simultaneously accrues: (1) Pharos staking rewards + (2) RWA yield — usable in DeFi while earning both.
Architecture: stPROS issued at the Bifrost L1 runtime level (native security). Cross-chain via SLPx contracts.
Governance: Polkadot shared security + Bifrost OpenGov. RSP: revenue-share program for integrators.
PRE-MINT (app.faroo.xyz/pre-mint — LIVE July 3, 2026):
  First RWA Hybrid Vault on Pharos — deposit stPROS to unlock rewards tied to real-world asset performance.
  Principal protected design | Phase 1 cap: 1,000,000 stPROS | $4,000 USDC reward pool + extra $PROS airdrop for participants
  Rewards: staking rewards + RWA yield exposure + PROS airdrop incentives
MAINNET CONTRACTS (Pharos Pacific, chain 1672 — verified on pharos.socialscan.io):
  stPROS "Faroo Staked PROS": 0x6b0a44c64190279f7034b77c13a566e914fe5ec4 (ERC-4626, 18 dec, underlying = WPROS 0x52c4…f0b0; NAV in PROS grows with staking rewards)
  FRHV001 "Faroo RWA Hybrid Vault 001" (Pre-mint vault): 0x36f3d19dda7ed1428e3014ae6f2a75d70393b7e6 (ERC-4626 over stPROS, 24 dec)
  FYV001 "Faroo Yield Vault 001": 0xc775dfaa7565f2aca5ddf5dd6837ceb846de591b (ERC-4626 over stPROS, 24 dec)
  Flow: stake PROS → receive stPROS → optionally deposit stPROS into FRHV001 (pre-mint, RWA yield) or FYV001.
  Testnet (Atlantic 688689) stPROS: 0xc9A0B63d91c2A808dD631d031f037944fedDaA12 (Bifrost SLPx docs).
The agent's "RealFi Positions" feature tracks Faroo balances (stPROS, FRHV001, FYV001) live on-chain with NAV.
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

  // ════════ NEW: Pharos docs (enriched July 2026) ════════
  pharos_network_full: `
PHAROS NETWORK — Complete Reference:
Pacific Mainnet: Chain ID 1672 | RPC https://rpc.pharos.xyz | WSS wss://rpc.pharos.xyz | Explorer https://pharos.socialscan.io | Also: https://pharosscan.xyz | Coin: PROS
Atlantic Testnet: Chain ID 688689 | RPC https://atlantic.dplabs-internal.com | Explorer https://atlantic.pharosscan.xyz | Coin: PHRS | Rate limit: 500 req/5min

ARCHITECTURE LAYERS:
• L1-Base: data availability + hardware acceleration (foundation layer)
• L1-Core: high-performance globally distributed blockchain — AsyncBFT consensus, 30,000 TPS, 2 Gigagas/s, <1s block time, sub-second deterministic finality
• L1-Extension: SPNs (Special Processing Networks) for heterogeneous computation (HFT, ZKML, AI models) + Native Restaking (shared security, rewards, slashing) + Cross-SPN Interoperation

DUAL VM: EVM (Ethereum-compatible, full Solidity/tooling support) + WASM running simultaneously. Chain ID 1672 is fully EVM-compatible — MetaMask, Rabby, ethers.js, Foundry, Hardhat all work.

PARALLEL EXECUTION: Multiple transactions processed simultaneously (unlike sequential EVM). Combines AsyncBFT + speculative parallel execution to achieve 2 Gigagas/s throughput. Solves the "Bottleneck Effect" (isolated optimizations don't help — Pharos optimizes consensus + execution + storage together).

ECOSYSTEM ARCHITECTURE:
• Transaction Layer: secure cross-chain interoperability protocol
• Consensus Layer: Adaptive Restaking Interaction Protocol (integrates Babylon stBTC, EigenLayer stETH for shared security)
• Data Layer: Decentralized Data Exchange Protocol (synchronizes with external data centers for AI, FHE use cases)

FUNDING: $52M total ($8M seed: Hack VC, Faction VC; $44M Series A). Founded by ex-Ant Group (Alipay) leadership. Mainnet launched April 28, 2026.
`,

  ccip_full: `
CHAINLINK CCIP ON PHAROS (live Feb 2026):
Router Contract: 0x4e52dD94e9BCfeFE3C78153bDfB0AB1d30687297
Chain Selector: 7801139999541420232
Supported lanes from Pharos: Pharos ↔ Ethereum | Pharos ↔ Jovay | Pharos ↔ Polygon | Pharos ↔ Base | Pharos ↔ Arbitrum
Bridgeable tokens: USDC, WETH, WPROS, LINK, PGOLD, USDpm (6 tokens total)
NOT supported via CCIP: Optimism (use Jumper/LI.FI instead for Optimism)
Use cases: cross-chain token transfers, on-chain messaging between smart contracts, omnichain applications
Integration: use the Router contract to initiate cross-chain messages; ensure correct chain selectors on both sides
Full config: https://docs.chain.link/ccip/directory/mainnet/chain/pharos-mainnet
`,

  cctp_full: `
CIRCLE CCTP v2 ON PHAROS (verified June 2026):
Mechanism: native USDC burn & mint — Circle burns on source, mints native USDC on destination. No wrapped tokens, no aggregator fee, 1:1 transfer.
Contract addresses (same canonical addresses on every chain):
  TokenMessengerV2: 0x28b5a0e9c621a5badaa536219b3a228c8168cf5d
  MessageTransmitterV2: 0x81d40f21f12a8f0e3252bccb954d722d4c464b64
  TokenMinterV2 (Pharos): 0xfd78ee919681417d192449715b2594ab58f5d002
USDC on Pharos: 0xc879c018db60520f4355c26ed1a6d572cdac1815
Domain IDs: Pharos=31, Ethereum=0, Optimism=2, Arbitrum=3, Base=6, Polygon=7
Burn limit: 10,000,000 USDC per message
Fast transfers (minFinalityThreshold=1000): delivered by Circle relayers in under a minute; fees ~0.005–0.013%
The agent EXECUTES CCTP v2 directly: approve + depositForBurn — say 'bridge X USDC to Base via circle/cctp'
`,

  layerzero_full: `
LAYERZERO V2 ON PHAROS:
LayerZero is an omnichain messaging protocol used by Stargate and other cross-chain apps.
Pharos is supported on LayerZero (chainKey "pharos", chainId 1672).
Stargate (stargate.finance): built on LayerZero. Tokens bridgeable from Pharos: USDC, rUSD, wsrUSD. PROS/WPROS and WETH are NOT bridgeable via Stargate from Pharos.
IMPORTANT: Stargate is an external UI only — this agent cannot execute Stargate/LayerZero transactions. Use stargate.finance directly. For agent-executed bridges: use Jumper (LI.FI) or Chainlink CCIP instead.
`,

  canonical_contracts_full: `
CANONICAL CONTRACTS — Pacific Mainnet:
Create2Deployer: 0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2
Foundry Deterministic Deploy: 0x4e59b44847b379578588920ca78fbf26c0b4956c
MultiCall3 (batch calls): 0xcA11bde05977b3631167028862bE2a173976CA11
GnosisSafe v1.3.0 (multisig): 0x69f4D1788e39c87893C980c06EdF4b7f686e2938
GnosisSafeL2 v1.3.0: 0xfb1bffC9d739B8D520DaF37dF666da4C687191EA
SafeSingletonFactory: 0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7
CreateX (CREATE/CREATE2/CREATE3 factory): 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed
MultiSendCallOnly v1.3.0: 0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B
MultiSend v1.3.0: 0x998739BFdAAdde7C933B942a68053933098f9EDa
Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3
ERC-4337 EntryPoint v0.7: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
ERC-4337 SenderCreator v0.7: 0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C
ERC-4337 EntryPoint v0.6: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
ERC-4337 SenderCreator v0.6: 0x7fc98430eAEdbb6070B35B39D798725049088348

Atlantic Testnet canonical contracts: same addresses as mainnet for Create2Deployer, MultiCall3, GnosisSafe, Permit2, ERC-4337 EntryPoint — see docs.pharos.xyz for testnet token registry.
`,

  x402_protocol: `
x402 PROTOCOL ON PHAROS:
x402 is the micropayment protocol powering per-call billing on Anvita Flow. Named after HTTP 402 "Payment Required".
How it works: enables AI agents and services to charge per API call using USDC or PROS automatically, without subscriptions or credit cards.
On Pharos: x402 is the settlement layer for Anvita Flow Service Agents — each call is billed and settled automatically.
Developer use: integrate x402 into any HTTP endpoint to gate it behind a payment wall that accepts crypto micropayments (as small as $0.001).
Resources: docs.pharos.xyz/developer-guide/x402
`,

  anvita_flow_full: `
ANVITA FLOW:
AI agent infrastructure for Pharos. Converts Pharos Skills into hosted, discoverable, callable Service Agents.
Core concepts:
• Skill: packaged set of on-chain capabilities using the Pharos Skill Engine
• Service Agent: hosted runtime wrapping a Skill — has identity, callable by other agents
• Steward Agent: user's personal AI (Anvita On) — finds and calls Service Agents
• Agent Card: public profile of a Service Agent (name, capabilities, pricing)
• Marketplace: registry of all published Service Agents
• x402 Protocol: micropayment billing per call
• Developer Console: https://flow.anvita.xyz/service-agents

Call flow: User → Anvita On → Steward Agent → Marketplace search → Service Agent → Skill execution → Result → Settlement via x402.

To publish a Service Agent:
1. Create SKILL.md with frontmatter (name + description)
2. Package as zip: pharos-agent/ folder at zip root with SKILL.md inside
3. Upload to Developer Console
4. Configure Agent Card (name, capabilities, example tasks, pricing)
5. Debug → Publish → Live in Marketplace
`,

  pharos_skill_engine: `
PHAROS SKILL ENGINE:
Open-source toolkit (github.com/PharosNetwork/pharos-skill-engine) for building on-chain AI agent skills on Pharos.
Uses Claude Code (AI CLI) + Foundry (cast/forge) for contract interaction.
Key files: SKILL.md (instructions), assets/networks.json (RPC config), assets/tokens.json (token addresses), references/ (protocol instruction docs).
Skills can: deploy contracts, call contract functions, read on-chain state, query events, send transactions.
Tutorial: Piggy Bank (SimpleVault) — lock PHRS for time, deposit, withdraw after lock period.
Available on GitHub: github.com/PharosNetwork/pharos-skill-engine
`,

  validator_info: `
PHAROS VALIDATOR INFO:
Hardware requirements (minimum): CPU 32 cores (AMD Milan EPYC / Intel Xeon Platinum, 2.8GHz+) | RAM 256 GB | Storage 5 TB SSD (350 MiB/s bandwidth, 30000 IOPS) | Network 0.5 Gbps | ulimit -n ≥ 10,000,000
Node versions (July 2026): Spec v14, Binary b5f7821d | Docker: public.ecr.aws/k2g7b7g1/pharos:pharos_community_v0.14.1_b5f7821d_0619
Validator behavior rules: no prolonged offline | no consensus inactivity | no equivocation (double voting) — violations → block proposals rejected + loss of fee rewards
Staking: PROS is staked for security. 0% inflation for first 6 months post-mainnet, then 5% annual to node operators + delegators.
Restaking: integrates Babylon (stBTC) + EigenLayer (stETH) for additional shared security.
Governance: no automated slashing currently — malicious behavior triggers governance procedures.
`,

  gas_model_full: `
PHAROS GAS MODEL:
EIP-1559 compatible: base fee (burned) + priority fee (to validator). Base fee recalculated per epoch.
Transaction fee charged at inclusion time by gas_limit (not actual gas used).
Key difference from Ethereum: priority fees are NOT settled per-transaction — they are accumulated and credited to validators in a batch at epoch boundaries (because parallel execution prevents real-time per-tx settlement).
CRITICAL: Always set gas limit 20% ABOVE estimated gas. Reason: gas refunds (e.g. from SSTORE clearing) are applied AFTER execution — if gas limit = gas used exactly, refund cannot be processed and tx FAILS with out-of-gas.
Example: forge estimateGas shows 100,000 → set gasLimit: 120,000.
ethers.js: const gas = await contract.estimateGas.fn(); const gasLimit = gas * 12n / 10n;
Fully aligned with Ethereum EVM opcode gas table.
`,

  // ════════ DeFi education ════════
  amm: `
AMM (Automated Market Maker): a DEX that prices trades with a math formula and a pool of two tokens instead of an order book. Anyone can trade against the pool 24/7; liquidity providers (LPs) supply the tokens.
Constant-product AMM (Uniswap V2 style): x * y = k. The product of the two reserves stays constant, so buying token X raises its price along a curve. Larger trades move price more (price impact).
PMM (Proactive Market Maker, DODO/FaroSwap): uses an oracle price to concentrate liquidity near the market price — better for stablecoins/pegged pairs, less slippage.
On Pharos: FaroSwap (DODO-based) offers AMM V3 (concentrated), V2 (constant-product), and PMM pools. The agent can swap via FaroSwap or add WPROS/USDC V3 liquidity.
`,
  liquidity_pools: `
Liquidity pool: a smart contract holding a pair of tokens that traders swap against. LPs deposit both tokens and receive LP tokens (or an LP NFT in V3) representing their share. They earn a cut of every swap fee proportional to their share.
Risks for LPs: impermanent loss (price divergence), smart-contract risk, and earning fees only while in range (V3). Rewards: trading fees + sometimes liquidity-mining incentives.
TVL (Total Value Locked): the dollar value of assets deposited in a protocol/pool — a rough measure of size and liquidity depth.
On Pharos: FaroSwap WPROS/USDC pools issue ERC-721 LP NFTs; the agent supports adding concentrated liquidity with a chosen fee tier and range.
`,
  impermanent_loss: `
Impermanent Loss (IL): the opportunity cost an LP suffers when the pooled tokens' relative price changes versus simply holding them. As one token rises, the AMM sells it for the other, so the LP ends up with less of the winner. It's "impermanent" because it reverses if prices return; it becomes permanent if you withdraw after divergence.
Magnitude: a 2x price change ≈ ~5.7% loss vs holding; 4x ≈ ~20%. Fees earned can offset IL — pools are profitable when fee income exceeds IL.
V3 concentrated liquidity amplifies BOTH fee income and IL within the chosen range. Stable/pegged pairs (USDC pairs) have minimal IL.
`,
  yield_farming: `
Yield farming: deploying capital across DeFi to maximize return — providing liquidity, lending, staking, or stacking incentive tokens ("liquidity mining" emissions).
Real yield vs emissions: "real yield" comes from actual protocol revenue (swap fees, lending interest, RWA coupons) and is sustainable; emissions yield comes from a protocol printing its own token and can be inflationary/temporary.
APR vs APY: APR is the simple annual rate; APY compounds it (10% APR compounded monthly ≈ 10.47% APY). Always check whether a quoted yield is real or emission-based, and whether it's APR or APY.
On Pharos (RealFi): much of the yield is real-world yield from RWA vaults (R25, Ember) and staking (Faroo stPROS), not just token emissions.
`,
  staking_concepts: `
Staking: locking tokens to help secure a Proof-of-Stake network (or a protocol) in exchange for rewards. Validators/delegators earn issuance + fees; misbehavior can be "slashed".
Liquid staking (LST): you stake but receive a liquid token (e.g. stPROS, stETH) you can still use in DeFi, so you earn staking rewards AND keep capital productive. The LST accrues value or rebases over time.
Restaking: re-using staked assets (or LSTs) to secure additional services for extra yield and extra risk — e.g. EigenLayer (stETH), Babylon (Bitcoin staking, stBTC).
On Pharos: Faroo issues stPROS (stake PROS → earn staking + RWA yield simultaneously); Pharos integrates Babylon and EigenLayer for restaking-based security.
`,
  lending_borrowing: `
DeFi lending: suppliers deposit assets into a pool to earn interest; borrowers take loans against collateral they lock. Rates float with utilization (more borrowing → higher rates).
Overcollateralization: you must deposit more value than you borrow (crypto is volatile). LTV (Loan-to-Value) = borrowed / collateral value; each asset has a max LTV.
Health factor: a measure of how safe a position is. If collateral value falls (or debt grows) past the liquidation threshold, the position is liquidated — collateral is sold (usually with a penalty) to repay lenders.
On Pharos: Zona offers lending/borrowing on RWAs + crypto (WBTC, WETH, WPROS, sUSDe, tokenized treasuries/equities); Morpho provides institutional RWA lending markets.
`,
  liquidations: `
Liquidation: when a borrower's collateral value drops below the required threshold, liquidators repay part of the debt and seize collateral at a discount (liquidation penalty/bonus). This keeps lending protocols solvent.
Avoiding it: keep a healthy buffer (low LTV / high health factor), monitor volatile collateral, and add collateral or repay before the threshold.
Liquidation threshold vs max LTV: you can borrow up to max LTV, but liquidation triggers at a higher threshold — the gap is your safety margin.
Oracles matter: liquidations rely on price oracles; bad/late prices can cause unfair liquidations, which is why robust oracles are critical (especially for RWA collateral on Pharos).
`,
  stablecoins: `
Stablecoins aim to hold a steady value (usually $1). Three main designs:
1) Fiat-backed (USDC, USDT, USDpm): each token redeemable 1:1 for fiat/cash-equivalents held in reserve. Most trusted; depends on the issuer and audits.
2) Crypto-backed (DAI, sUSDe-style): overcollateralized by crypto in smart contracts; decentralized but capital-inefficient and exposed to collateral volatility.
3) Algorithmic: maintain the peg via supply mechanisms/incentives, often undercollateralized — historically fragile (e.g. UST collapse).
Depeg risk: a stablecoin can temporarily trade off $1 if reserves, liquidity, or confidence wobble.
On Pharos: USDC (0xc879…1815) is the main DeFi stablecoin and the asset Circle CCTP v2 bridges natively; USDpm is a CCIP-bridgeable stable.
`,
  dex_cex: `
CEX (Centralized Exchange, e.g. Binance/OKX/Bitget): a company custodies your funds and runs an order-book matching engine. Fast and liquid, but custodial ("not your keys, not your coins") and requires trust/KYC.
DEX (Decentralized Exchange, e.g. FaroSwap): trades settle on-chain via smart contracts; you keep custody and sign each trade in your own wallet. Non-custodial and permissionless, but you pay gas and face slippage.
Aggregators (LI.FI/Jumper, DODO): route a trade across many DEXs/bridges to find the best price/route. The Pharos agent uses LI.FI for best-route swaps/bridges and can also route directly through FaroSwap.
`,
  mev_slippage: `
Slippage: the difference between the expected and actual execution price, caused by price movement and limited liquidity between quote and execution. You set a slippage tolerance (e.g. 0.5–1%); the trade reverts if it would exceed it (protects you).
Price impact: how much YOUR trade itself moves the pool price — bigger trades in thin pools = more impact.
MEV (Maximal Extractable Value): profit bots/validators extract by reordering, inserting, or front-running transactions. "Sandwich attacks" front-run and back-run a victim swap to skim value. Tight slippage limits, private mempools, and PMM/oracle pricing reduce MEV harm.
On Pharos: parallel execution + sub-second finality reduce the time window for some MEV; the agent sets a slippage floor (minReturn) on swaps.
`,
  concentrated_liquidity_v3: `
Concentrated liquidity (Uniswap V3 / FaroSwap V3): instead of spreading liquidity across all prices (0→∞), an LP picks a price RANGE. Capital is concentrated there, so within range you earn far more fees per dollar; outside the range your position earns nothing and sits entirely in one token.
Ticks: prices are discretized into ticks; the chosen fee tier sets the tick spacing (e.g. 0.30% → spacing 60). Tighter ranges = higher capital efficiency but more management and more IL.
Positions are ERC-721 NFTs (not fungible LP tokens), each with its own range and fees.
On Pharos: FaroSwap WPROS/USDC V3 — fee tiers 0.01%/0.05%/0.30%/1.00%; the agent can mint a position with full-range, ±% , or explicit min/max price.
`,
  governance_dao: `
Governance token: grants voting power over a protocol's parameters, treasury, and upgrades (e.g. fee switches, new markets). Value comes from control + potential fee rights, not a claim on cash flows by default.
DAO (Decentralized Autonomous Organization): a community that governs a protocol/treasury via on-chain proposals and token-weighted (or delegated) voting. Mechanisms include timelocks, quorums, and delegation.
Tradeoffs: token-weighted voting can concentrate power with whales; low participation is common; delegation and reputation systems try to fix this.
On Pharos: PROS is the governance token; staking inflation rewards node operators + delegators, and the foundation coordinates ecosystem direction.
`,
  wrapped_tokens: `
Wrapped token: an ERC-20 representation of an asset that isn't natively an ERC-20, so it can be used in DeFi. WETH wraps native ETH; WPROS (0x52c4…f0b0, 18 dec) wraps native PROS 1:1 so it can enter AMM pools and contracts that expect ERC-20s.
Wrap/unwrap is 1:1 and reversible by depositing/withdrawing from the wrapper contract.
Bridged/wrapped cross-chain assets (e.g. USDC.e, wBTC) represent an asset locked on another chain — trust depends on the bridge's security model.
On Pharos: liquidity pools and the V3 position manager use WPROS, not native PROS; the agent handles wrapping where needed and quotes PROS↔USDC swaps directly.
`,

  // ════════ RWA (Real World Assets) ════════
  rwa_tokenization: `
Tokenization: representing ownership/rights of a real-world asset as on-chain tokens. A legal structure (SPV, trust, or fund) holds the off-chain asset; tokens are claims on it, enforced by legal agreements + smart contracts.
Why: 24/7 settlement, fractional ownership, global access, composability (use the token as collateral, in vaults, in pools), transparency, and faster/cheaper transfer than TradFi rails.
Lifecycle: originate/custody the asset → issue tokens → distribute → service (coupons, redemptions, reporting) → redeem/burn. Off-chain enforceability and trusted custodians/oracles are essential.
On Pharos (RealFi): the chain is purpose-built for institutional RWA settlement at scale — R25 vaults, Centrifuge credit, Ember, Asseto, Agra tokenize real assets on-chain.
`,
  rwa_assets: `
Common tokenized RWAs:
• Tokenized treasuries / T-bills: on-chain shares of short-term government debt — low-risk dollar yield (the most adopted RWA category; cf. Ondo OUSG/USDY, BlackRock BUIDL, Franklin BENJI).
• Tokenized equities/ETFs: on-chain exposure to stocks/indices (NVDA, TSLA, S&P 500) — tradeable 24/7 (e.g. via Bitverse stock futures, Zona collateral).
• Real estate: fractional property/REIT exposure on-chain.
• Private credit: tokenized loans/receivables/trade finance — higher yield, higher risk (e.g. Centrifuge DROP senior / TIN junior tranches).
• Commodities/gold: tokenized gold (PGOLD on Pharos via CCIP).
Each carries its own risk, liquidity, and redemption profile.
`,
  rwa_yield_oracles: `
RWA yield sources: real-world cash flows — treasury/bond coupons, loan interest, trade-finance fees, rental income, dividends. Unlike emissions, this is "real yield" backed by off-chain economic activity.
Oracles for RWA: because the asset and its price/NAV live off-chain, protocols rely on oracles and attestations (NAV feeds, proof-of-reserves, auditor sign-offs) to price collateral and trigger redemptions/liquidations. Oracle quality is a core risk.
Risks unique to RWA: counterparty/default (off-chain borrower fails), redemption windows (not always instant — weekly/quarterly), regulatory/legal enforceability, custody, and oracle/NAV accuracy. RWAs are generally NOT FDIC insured.
On Pharos: R25 vaults pay yield from fixed income + credit facilities; redemption windows vary by vault (VRPCW weekly, VRPCQ quarterly, VRPCS semi-annual).
`,
  erc4626_vaults: `
ERC-4626 (Tokenized Vault Standard): a standard interface for yield-bearing vaults. You deposit an underlying asset (e.g. USDC) and receive vault "shares"; as the vault earns yield, each share becomes redeemable for more underlying. Standardizing deposit/withdraw/convert makes vaults composable across DeFi.
Share price = total assets / total shares; it appreciates with yield (no rebasing needed).
Why it matters for RWA: it cleanly wraps off-chain yield (treasuries, credit) into a single transferable, composable token.
On Pharos: R25 RWA vaults, Ember's pAlpha vault (0xe47e…d7d1), TermMax fixed-rate vaults, and stPROS are ERC-4626-style. (Note: the agent can quote/explain these but does not yet execute RWA-vault deposits.)
`,
  institutional_defi: `
Institutional DeFi / RealFi: bringing regulated, real-world finance on-chain with the controls institutions need — compliance, auditability, permissioning, and reliable settlement — rather than replacing TradFi.
Key requirements: KYC/AML where required, transfer restrictions/whitelists for securities, qualified custody, transparent reserves, and robust oracles. Some assets use permissioned tokens (only approved addresses can hold them).
Regulatory considerations: tokenized securities are still securities; jurisdiction, investor accreditation, and disclosure rules apply. This is why RWA issuers use legal wrappers (SPVs/funds).
On Pharos: positioned as RealFi infrastructure — modular architecture with native compliance support, designed to "align blockchain with existing financial frameworks," partnering with Centrifuge, Morpho, and institutional issuers.
`,

  // ════════ TradFi bridge concepts ════════
  tradfi_instruments: `
Core TradFi instruments (useful for understanding RWAs):
• Bond: a loan to a government/company that pays periodic interest (the "coupon") and returns principal at maturity. Price moves inversely to interest rates.
• Coupon: the interest payment a bond makes (e.g. a 5% coupon on $1,000 pays $50/yr).
• Yield: the return on an investment relative to its price (a bond's yield rises as its price falls). "T-bill yield" is the return on short-term government debt.
• Money markets: where short-term, low-risk debt (T-bills, commercial paper, repo) trades — the bedrock of "risk-free" dollar yield that tokenized-treasury RWAs bring on-chain.
• Securities: tradable financial assets (stocks, bonds) — regulated instruments.
`,
  tradfi_settlement: `
Settlement & custody (what RWAs improve):
• Settlement: finalizing a trade by transferring the asset and payment. TradFi equities settle T+2 (two business days), some markets T+1; tokenized assets can settle T+0 / near-instant and 24/7 on-chain — freeing up capital and reducing counterparty risk.
• Custody: who holds the asset. Custodial = a third party (bank/broker/CEX) controls it; non-custodial/self-custody = you hold the keys. RWAs use qualified custodians off-chain plus on-chain token custody.
• Clearing/counterparty risk: the risk the other side fails before settlement; instant atomic on-chain settlement minimizes it.
On Pharos: sub-second finality + 30,000 TPS target institutional-grade, near-instant settlement for RWAs.
`,
  market_makers_liquidity: `
Liquidity & market making:
• Liquidity: how easily an asset can be traded without moving its price. Deep liquidity = tight spreads, low slippage.
• Market maker (MM): a participant that continuously quotes buy (bid) and sell (ask) prices, profiting from the spread and providing liquidity. In TradFi these are firms; in DeFi, AMM LPs and PMM algorithms play this role.
• Bid-ask spread: the gap between the best buy and sell price — narrower with more competition/liquidity.
• Order book vs AMM: CEXs/TradFi match discrete bids/asks in an order book; AMMs price continuously off a pooled curve. PMMs (DODO/FaroSwap) blend oracle pricing to mimic tight MM spreads on-chain.
`,

  // ════════ Crypto fundamentals ════════
  blockchain_basics: `
Blockchain: a shared, append-only ledger replicated across many computers (nodes). Transactions are grouped into blocks, each cryptographically linked (hashed) to the previous one, making history tamper-evident and immutable.
Decentralization: no single party controls it; consensus rules decide valid state. This gives censorship-resistance and permissionless access, at the cost of throughput vs a central database.
Keys & addresses: a private key controls an address; signatures prove ownership without revealing the key. Anyone can read the chain; only key-holders can move their assets.
On Pharos: an EVM-compatible L1 (chain ID 1672) optimized with parallel execution for high throughput and sub-second finality — built for financial-grade settlement.
`,
  consensus: `
Consensus: how decentralized nodes agree on the next valid block.
• Proof of Work (PoW, e.g. Bitcoin): miners spend energy solving puzzles; secure but slow and energy-intensive.
• Proof of Stake (PoS, most modern L1s): validators lock (stake) tokens and are chosen to propose/attest blocks; honest behavior earns rewards, cheating is slashed. Energy-light and fast, security scales with staked value.
Finality: when a block is irreversible. PoW gives probabilistic finality (wait for confirmations); modern PoS chains offer fast deterministic finality.
On Pharos: PoS-based with sub-second finality; PROS is staked for security (0% inflation for 6 months post-mainnet, then 5% annual to validators/delegators), with Babylon/EigenLayer restaking for added security.
`,
  l1_l2_rollups: `
L1 vs L2:
• L1 (Layer 1): a base blockchain that settles its own transactions (Ethereum, Pharos, Bitcoin).
• L2 (Layer 2): a chain that executes transactions off the L1 but posts data/proofs back to it for security, increasing throughput and lowering fees.
Rollups (the main L2 type) batch many transactions into one L1 posting:
• Optimistic rollups assume validity and allow a challenge/fraud-proof window (withdrawals take longer).
• ZK rollups post validity proofs (zk-SNARKs/STARKs) — faster finality, cheaper verification, more complex tech.
On Pharos: Pharos is a high-performance L1 (not an L2) that pursues L2-like throughput natively via parallel execution + a modular Base/Core/Extension design, targeting institutional RWA settlement.
`,
  gas_evm_contracts: `
Gas: the fee paid to execute a transaction, compensating validators for computation/storage. More complex operations cost more gas; you pay in the native token (PROS on Pharos). Keep a small native balance for gas.
EVM (Ethereum Virtual Machine): the runtime that executes smart contracts; "EVM-compatible" chains (like Pharos) run the same bytecode and tooling (Solidity, MetaMask, ethers, Foundry), so apps port easily.
Smart contract: self-executing code deployed on-chain that anyone can call; it enforces rules without intermediaries (a DEX, vault, or lending market is a set of contracts). Immutable once deployed unless built upgradeable.
On Pharos: fully EVM-compatible (chain ID 1672), so standard Ethereum wallets/tools work; parallel execution keeps gas low and throughput high.
`,
  erc_standards: `
Key ERC token standards:
• ERC-20: fungible tokens — interchangeable units (USDC, WPROS, PROS-as-ERC20). The backbone of DeFi (transfer/approve/allowance).
• ERC-721: non-fungible tokens (NFTs) — unique items; FaroSwap V3 LP positions are ERC-721 (each has its own range/fees).
• ERC-1155: multi-token standard — one contract managing many fungible AND non-fungible token types (efficient for games/batches).
• ERC-4626: tokenized vault standard — standardizes yield-bearing vault deposits/withdrawals (R25, Ember, stPROS).
"approve/allowance": ERC-20s require you to approve a spender (e.g. a router) before it can move your tokens — hence the extra approval step before a swap/bridge.
`,
  wallets_keys: `
Wallets:
• Non-custodial (MetaMask, Rabby, OKX): YOU hold the private key/seed phrase and sign every transaction. "Not your keys, not your coins." The Pharos agent is non-custodial — it only proposes transactions you sign yourself.
• Custodial (a CEX account): a third party holds your keys; convenient but you trust them.
Private key: the secret that controls an address — never share it. Seed phrase (12/24 words): a human-readable backup that regenerates all your keys — anyone with it controls all your funds.
SECURITY: never enter your seed phrase or private key into any website, DM, or "support" agent. No legitimate app or agent will ever ask for it. The Pharos agent will NEVER ask for keys/seed phrases.
`,
  cross_chain_messaging: `
Moving value/data between chains:
• Bridges: lock-and-mint or burn-and-mint assets across chains. Trust models vary (validators, light clients, native rails) — bridges are a major security surface; prefer audited, native ones.
• Chainlink CCIP: a secure cross-chain messaging/token protocol; Pharos-native for USDC, WETH, WPROS, LINK, PGOLD, USDpm to Ethereum/Base/Arbitrum/Polygon.
• Circle CCTP v2: native USDC burn-and-mint (no wrapped IOU, no aggregator fee) — the agent bridges USDC FROM Pharos to Ethereum/Base/Arbitrum/Optimism/Polygon directly.
• LayerZero / OFT: a generic cross-chain messaging layer; Stargate is the main bridge app on it (supports Pharos for USDC/rUSD/wsrUSD, used via stargate.finance).
On Pharos the agent executes bridges via Jumper (LI.FI), Chainlink CCIP, and Circle CCTP v2.
`,

  // ════════ Pharos RealFi synthesis ════════
  realfi_vision: `
RealFi on Pharos — how it ties together: Pharos is a Layer-1 built to bring real-world finance on-chain ("RealFi"), connecting TradFi assets with DeFi liquidity. The thesis: tokenize real yield (treasuries, credit, equities), settle it instantly and 24/7, and make it composable across DeFi — with the throughput, latency, and compliance institutions require.
The stack in practice: RWAs are tokenized (R25, Centrifuge, Ember, Asseto) → used as collateral or yield (Zona lending, Faroo stPROS, AquaFlux tri-token) → traded/provided as liquidity (FaroSwap) → moved across chains (CCIP, CCTP, LayerZero/Stargate) → all settled on a parallel-execution EVM L1 with sub-second finality.
Why a purpose-built chain: general L1s aren't optimized for institutional RWA settlement (throughput, finality, compliance, oracle reliability). Pharos targets exactly that — "infrastructure bridging traditional financial assets and on-chain liquidity."
`,

  // ════════ Official pharos.xyz homepage facts ════════
  pharos_tech: `
Pharos official technical specs (pharos.xyz):
Performance: 30,000 TPS, 2 Gigagas/second throughput, block time under 1 second, designed to scale toward 1 billion concurrent users.
Dual VM: Pharos runs BOTH the EVM and a WASM (WebAssembly) VM — it is NOT EVM-only — so developers can build with Solidity or WASM-based languages.
Consensus: AsyncBFT combined with speculative parallel execution, delivering sub-second deterministic finality.
Storage engine: a Delta-Encoded Multi-Version Merkle Tree plus a Log-Structured Versioned Page Store, cutting storage overhead by ~80%, with multi-stage pipelining for CPU/IO efficiency.
Founded by former Ant Group leadership.
`,
  pharos_compliance: `
Pharos "compliance by design" (pharos.xyz): KYC/AML is built into the PROTOCOL layer via zero-knowledge modules — zk-KYC, programmable AML, and digital identity native to the chain. Privacy is preserved (zk proofs validate eligibility without exposing user data), so Pharos stays compliance-ready for regulated institutions while remaining open and composable.
This underpins the RealFi thesis: tokenized real-world assets and institutional capital need native, programmable compliance rather than bolted-on, off-chain KYC.
`,
  pharos_spn: `
SPN — Special Processing Networks (pharos.xyz + docs.pharos.xyz): application-specific networks within the Pharos system, each with its OWN execution engine, validator set, restaking-based incentives, and governance. SPNs are tightly integrated with the Pharos mainnet yet operate independently (similar to app-specific chains/rollups), so demanding apps get tailored performance.
Native cross-SPN AND cross-chain communication runs with ATOMIC execution — a transaction spanning multiple SPNs/chains either fully succeeds or fully reverts. Restaking aligns each SPN's security with the mainnet.

HOW SPNs WORK (staking & restaking): validators stake PROS on the Primary Network; each staked token generates a certificate (stP) which can be RESTAKED into an SPN for additional rewards. SPNs set their own validator requirements, hardware needs, and soft/hard caps on stP. The Primary Network automatically initiates SPN creation once conditions are met. SPNs use validators' EXCESS compute power.

CROSS-SPN INTEROPERABILITY PROTOCOL: transactions are initiated in one SPN, relayed via the Primary Network Mailbox, verified, then executed in the destination SPN — enabling atomic cross-SPN interactions.

SPN SYSTEM CONTRACTS (core components):
• SPN Manager — manages SPN creation, destruction, message communication, and asset transfer
• Registry — SPN registration and management on the Primary Network
• Mailbox — records all SPN messages and events for cross-SPN communication
• Bridge — manages asset transfers between SPNs and the Primary Network
• SPN Network Hub — facilitates message and event communication across all SPNs
• SPN Adapter — handles incoming messages from the Primary Network within each SPN

CONFIRMED SPN USE CASES (official docs):
• High-Frequency Trading (HFT): dedicated execution environments with custom execution engine + independent validator set — removes shared congestion for latency-sensitive workloads
• AI & ZKML: run AI models and zero-knowledge machine learning on-chain; lightweight SPNs with specialised hardware (TEEs) for secure AI inference and confidential computation; non-blockchain application support; Decentralised Data Exchange Protocol
• AIoT & Private Networks: AI+IoT private networks and multi-party privacy-enhancing computation using validators' excess compute
• RWA & Compliance (PayFi): integrated ZK-KYC and AML modules at the protocol layer → compliance-ready SPNs for regulated finance while preserving composability; PayFi and monthly payment support
• MEV Optimisation: lightweight SPNs with specialised hardware + TEE for transaction confidentiality, configurable consensus per SPN
`,
  pharos_positioning: `
Pharos official positioning (pharos.xyz): "RealFi, Accessible to All — Inclusive Financial Layer 1 for Real Value and Institutional-Grade Assets." It frames itself as a "Borderless Digital Financial City" where tokenized assets flow like commerce and stablecoins settle like currency.
Core use cases: tokenized financial products; instant payments (cross-border settlement in under 1 second); compliant finance (zk-KYC/AML); infrastructure assets (energy, commodities, real estate); and stablecoins backed by verified RWA collateral.
`,
  pharos_metrics: `
Pharos metrics & backing (pharos.xyz official): an $8M seed round led by Hack VC and Faction VC alongside global investors. (Earlier/other sources also cite a $44M Series A, for roughly $52M total raised.)
Traction figures highlighted on the site: 174M wallet addresses, 3B cumulative testnet users, and 1.5M community followers.
Strategic partner: Ant Digital Technologies — together incubating an approximately $1.5 BILLION RWA exchange pipeline. Pharos was founded by former Ant Group leadership.
`,
  pharos_site: `
Official Pharos site map (pharos.xyz — for navigation & citations):
• Agent Center (pharos.xyz/agent-center) — explore & install Skills for on-chain agents.
• Developer Center (pharos.xyz/devhub) · RealFi Alliance (pharos.xyz/realfi-alliance) · Research (pharos.xyz/research) · Blog/News (pharos.xyz/resources) · Ecosystem (pharos.xyz/ecosystem) · Community (pharos.xyz/community).
Other official domains: Testnet testnet.pharosnetwork.xyz · Careers career.pharosnetwork.xyz · Docs docs.pharosnetwork.xyz · Dev portal buildonpharos.com · GitHub github.com/PharosNetwork · Ecosystem hub port.pharos.xyz.
`,

  // ════════ Campaigns, airdrop, identity, programs ════════
  airdrop: `
PROS airdrop & claim: ~6% of the PROS supply is allocated to the community airdrop (part of the 21% Ecosystem+Community bucket). Eligibility comes from testnet/mainnet activity, campaign points, and ecosystem participation.
Where to check/claim: the official Pharos Port (port.pharos.xyz) campaigns/rewards area and pharos.xyz — claims and snapshots are announced via x.com/pharos_network and the blog (pharos.xyz/resources).
SECURITY: only ever claim from official Pharos domains. The agent never asks for seed phrases/keys; any "airdrop" site requesting them is a scam. For exact eligibility/claim status, check the official site (it changes over time).
`,
  campaigns: `
Pharos campaigns & points: Pharos runs activity campaigns that reward users with points/rewards for on-chain actions (swaps, liquidity, bridging, using ecosystem dapps) — managed through Pharos Port (port.pharos.xyz).
Named/seasonal campaigns the community references include "World Cup", "TopNod", and "Alpha Summer" — promotional seasons with quests, leaderboards and reward pools. Details and active quests change frequently.
For current campaigns, eligibility and how to participate, check port.pharos.xyz/ecosystem and x.com/pharos_network (search live for the latest if asked about an ongoing one).
`,
  pns: `
PNS — Pharos Name Service: human-readable names for Pharos addresses (e.g. a "yourname.pharos"-style identity), similar to ENS on Ethereum. It maps a memorable name to a wallet address so you can send/receive and be identified without raw 0x… hex.
Use cases: simpler payments, on-chain identity/profile, and integration across Pharos dapps and agents. Register/manage names via the PNS app in the Pharos ecosystem (see port.pharos.xyz/ecosystem for the current link).
`,
  agent_center: `
PHAROS AGENT CENTER (pharos.xyz/agent-center) — "One skill. Full on-chain power":
Install: npx skills add https://github.com/PharosNetwork/pharos-skill-engine (npm/pnpm/bun) | License: MIT-0 (free to use/modify/redistribute, no attribution)
PHAROS SKILL ENGINE — 11 CAPABILITIES:
  1. Check Balance — native + ERC-20 balances via JSON-RPC
  2. Check Transaction Status — confirmation status + execution result by tx hash
  3. Read Contract — read-only contract calls (no transaction)
  4. Send Transaction — signed transfers + contract invocations
  5. Gas Estimation — simulate transactions to estimate gas / reduce failure risk
  6. Deploy Contract — deploy via compiled bytecode + ABI
  7. Verify Contract — verify source code on explorer
  8. Quick Deploy ERC20 — configurable ERC-20 token with standard params
  9. Batch Transfer — airdrop tokens to multiple addresses in one workflow
  10. Wallet Asset Aggregation — consolidated portfolio view across contracts
  11. Contract Script Generator — auto-generate ethers.js/web3.js scripts
SKILL STORAGE PATHS: OpenClaw ~/.openclaw/skills/ | Claude Code ~/.claude/skills/ | Codex ~/.codex/skills/ (verify with "openclaw skills list" or /skills)
FLOW: user writes natural prompt → agent auto-detects which skill to invoke → skill executes specialized logic and returns results.
The vision: composable AI agents that read state and propose/execute on-chain actions on Pharos. This Pharos Agent follows the same direction (RAG knowledge + swap/bridge/liquidity skills, non-custodial).
`,
  research: `
Pharos Research (pharos.xyz/research): the official research hub publishing deep dives on RealFi, RWA tokenization, the Pharos architecture (parallel execution, AsyncBFT, SPNs), and ecosystem analysis. Pair it with docs.pharosnetwork.xyz for technical specs and pharos.xyz/resources for blog/news.
For specific or recent reports, point users to pharos.xyz/research (and search live if they ask about a particular paper/topic).
`,
  dapps_extra: `
More Pharos ecosystem dapps (categories; check port.pharos.xyz/ecosystem for live details/links):
• TermMax: fixed-rate, fixed-term lending/yield using ERC-4626-style vaults — predictable rates vs floating money markets.
• Ember pAlpha vault: Ember's actively-managed USDC ERC-4626 yield vault (0xe47e9ba4ea2320a6ed87246d02fd5c38485ed7d1) — the team allocates across Pharos DeFi for risk-adjusted yield.
• Kun: a stablecoin/yield protocol in the Pharos ecosystem (CDP/stable-asset style). Verify current mechanics on its app.
• Pizza Zone / PROS Pixel: community / GameFi-style apps (mini-games, points, social/NFT mechanics) — fun engagement that often ties into campaigns.
New dapps launch frequently; for anything not in this directory, search and point to port.pharos.xyz/ecosystem rather than guessing specifics.
`,
  dapp_profiles_trading: `
DAPP PROFILES — DEX, TRADING & LENDING ON PHAROS (what each is, mechanism, role):

AGRA (bonds.agra.gg): exchange for ON-CHAIN CREDIT and tokenized bonds. Mechanism: tokenized debt instruments (bonds, credit notes) are listed and traded on-chain; investors buy exposure to fixed-income cash flows, issuers get financing. Role on Pharos: the bond-market leg of RealFi — where tokenized credit meets secondary-market liquidity, complementing AquaFlux (structuring) and R25 (origination).

OKU (oku.trade): professional DEX trading front-end + aggregator built by GFX Labs, live on 35+ chains including Pharos. Mechanism: routes orders across 14 swap routers and 11 bridge routers to find the best price, charging 0% platform fees; adds pro tools on top of AMM liquidity — limit orders, TWAP-style analytics, full order history and position charts. Role on Pharos: an advanced-trader interface to Pharos liquidity (including FaroSwap pools) with cross-chain routing built in.

MORPHO (morpho.org): major lending protocol (multi-billion TVL across chains). Mechanism: Morpho Blue creates ISOLATED lending markets (one collateral / one loan asset / one oracle / one LLTV each), and MetaMorpho vaults curate deposits across those markets; the original innovation was P2P matching that pairs lenders and borrowers directly to tighten the rate spread vs pooled models like Aave/Compound. Role on Pharos: institutional-grade credit rails for RWA collateral — isolated markets suit tokenized assets because risk stays compartmentalized per market.

TERMMAX (app.termmax.ts.finance/earn/pharos): FIXED-RATE, FIXED-TERM lending & borrowing by Term Structure Labs. Mechanism: markets have a maturity date; lenders lock a known APY to maturity (like buying a zero-coupon bond), borrowers lock a known cost; on Pharos it exposes an ERC-4626 vault (tmPHRC, 0xd04d1a8bd7944e06e25192aad833700115c88480) whose share price accrues the fixed yield. Role on Pharos: predictable TradFi-style yield curves on-chain — the fixed-income counterpart to floating-rate money markets. The agent tracks tmPHRC in RealFi Positions.

LI.FI (li.fi): bridge & DEX AGGREGATION protocol (not a bridge itself). Mechanism: one API/SDK quotes routes across dozens of bridges and DEXes, picks the best path (cost/speed/security), and returns a single transaction for the user to sign. Role on Pharos: powers the agent's swap and bridge execution and the Jumper interface — it's how Pharos connects to Ethereum, Base, Arbitrum, Polygon liquidity.

JUMPER (jumper.exchange): the consumer cross-chain app built ON LI.FI. Mechanism: same routing engine as LI.FI with a retail UI — pick token/chain, get the best bridge+swap combo in one click. Role on Pharos: easiest manual on/off-ramp between Pharos and other EVM chains; the agent quotes the same routes programmatically.
`,
  dapp_profiles_rwa_payments: `
DAPP PROFILES — RWA & PAYMENTS ON PHAROS:

ASSETO (asseto.finance): next-generation on-chain RWA asset platform ("RWA tokenized fintech"). Mechanism: originates and tokenizes real-world assets into compliant on-chain products with institutional custody and reporting; investors subscribe on-chain and hold transferable asset tokens. Role on Pharos: broadens the RWA menu beyond energy (R25) and credit (AquaFlux) — part of the RealFi Alliance pipeline feeding assets into Pharos vaults and lending markets.

CIRCLE (circle.com): issuer of USDC, live NATIVELY on Pharos (0xc879c018db60520f4355c26ed1a6d572cdac1815, 6 decimals). Mechanism: CCTP v2 (Cross-Chain Transfer Protocol) moves USDC across chains by BURNING on the source chain and MINTING on the destination — no wrapped IOUs, no bridge liquidity risk. Role on Pharos: the settlement dollar of RealFi; the agent executes CCTP v2 transfers directly.

ALCHEMY PAY (alchemypay.org): fiat↔crypto payment gateway. Mechanism: connects card networks, local payment methods (PIX, bank transfers, wallets in 170+ countries) to on-chain settlement — users buy crypto with fiat (on-ramp) or cash out (off-ramp); also offers crypto card issuing. Role on Pharos: the fiat entrance for users entering the Pharos ecosystem without going through a CEX.
`,
  dapp_profiles_wallets: `
DAPP PROFILES — WALLETS & CUSTODY ON PHAROS:

OKX WALLET (web3.okx.com): multi-chain self-custody wallet (extension + mobile) from OKX. Mechanism: EIP-6963 provider, built-in DEX aggregator, NFT marketplace and dApp browser; supports 100+ chains. Role on Pharos: one of the main wallets for connecting to Pharos dApps and the agent (detected automatically via EIP-6963).

TOPNOD (topnod.com): self-custody wallet focused on RWA & digital assets, connected to the Ant Digital/ZAN ecosystem. Mechanism: non-custodial key management with an interface designed around holding and tracking tokenized real-world assets. Role on Pharos: RWA-native wallet — ran the "TopNod Cup" campaign with Pharos (June–July 2026).

ONEKEY (onekey.so): fully OPEN-SOURCE wallet — hardware devices + software apps. Mechanism: keys stay in the secure element of the hardware device (or encrypted locally in software); all code is auditable on GitHub. Role on Pharos: security-first self-custody option for PROS and Pharos assets.

KUCOIN WALLET (kucoin.com/web3): Web3 self-custody wallet by the KuCoin exchange. Mechanism: standard EVM wallet with multi-chain support, dApp browser, integrated swaps. Role on Pharos: retail gateway — KuCoin also lists PROS spot, so users move between CEX and Pharos DeFi easily.

FORDEFI (fordefi.com): INSTITUTIONAL MPC wallet platform. Mechanism: private keys are split via multi-party computation (no single point of compromise), with a programmable policy engine (spending limits, address allowlists, approval quorums) and transaction simulation before signing. Role on Pharos: how funds/desks/DAOs custody and operate on Pharos safely (officially documented in docs.pharos.xyz).

SAFE (app.safe.global): the industry-standard SMART-CONTRACT MULTISIG (formerly Gnosis Safe). Mechanism: a contract account that requires M-of-N owner signatures per transaction; supports modules, spending policies, and account abstraction. Role on Pharos: treasury-grade custody for teams/DAOs on Pharos (officially documented in docs.pharos.xyz).

ANCHORAGE DIGITAL (anchorage.com): US federally chartered crypto BANK. Mechanism: regulated qualified custody with segregated cold storage, plus institutional staking and trading services. Role on Pharos: the compliance-grade custodian for institutions holding PROS/RWA positions — key for RealFi's institutional adoption story.
`,
  dapp_profiles_infra: `
DAPP PROFILES — ORACLES, RPC & INFRA ON PHAROS:

SUPRA (supra.com): oracle network. Mechanism: DORA (Distributed Oracle Agreement) aggregates price data from many sources with fast finality; also provides on-chain VRF (verifiable randomness). Role on Pharos: price feeds for DeFi protocols (officially documented in docs.pharos.xyz/tooling-and-infrastructure/oracles/supra).

ZAN (zan.top): Web3 infra brand of Ant Digital Technologies (Ant Group). Mechanism: managed RPC nodes for 28+ chains including Pharos, plus smart-contract audit services (AI Scan + expert audit), ZK acceleration hardware, and KYC/identity tooling; agent-ready skills via x402 pay-per-call. Role on Pharos: enterprise-grade RPC provider (docs.pharos.xyz/tooling-and-infrastructure/rpc/zan) and part of the compliance/tokenization stack for RWA issuers.

ALCHEMY (alchemy.com): leading Web3 developer platform. Mechanism: managed nodes + enhanced APIs (getAssetTransfers, NFT API, webhooks), SDKs, and reliability layers on top of raw RPC. Role on Pharos: official RPC/dev infrastructure option (docs.pharos.xyz/tooling-and-infrastructure/rpc/alchemy) for teams building Pharos dApps.

NIRVANA LABS (nirvanalabs.io): Web3 infrastructure specializing in DEDICATED bare-metal nodes. Mechanism: single-tenant RPC nodes (no shared rate limits) tuned for latency-sensitive workloads. Role on Pharos: high-performance RPC option for trading bots, indexers and demanding dApps (documented in docs.pharos.xyz).

HEMERA (thehemera.com): ACCOUNT-CENTRIC indexing network — the team behind SocialScan. Mechanism: indexes chain data organized around accounts/entities rather than blocks, powering rich profiles, token histories and social-style exploration. Role on Pharos: runs pharos.socialscan.io, the main Pharos explorer — the same data source the agent uses for wallet analysis.

GOLDSKY (goldsky.com): real-time blockchain data pipelines. Mechanism: managed subgraphs (GraphQL indexes of contract events) + "Mirror" pipelines that stream on-chain data straight into your own database. Role on Pharos: how dApp teams index Pharos events without running infra (docs.pharos.xyz/tooling-and-infrastructure/indexing/goldsky).
`,
  dapp_profiles_security: `
DAPP PROFILES — SECURITY & COMPLIANCE ON PHAROS:

HYPERNATIVE (hypernative.io): real-time on-chain THREAT DETECTION. Mechanism: monitors mempools, contracts and protocol state with ML models; flags exploits/attacks minutes before or as they happen and can trigger automated defenses (pausing contracts, pulling liquidity). Role on Pharos: protocol-level security monitoring for Pharos DeFi/RWA protocols.

ZELLIC (zellic.io): elite smart-contract AUDIT firm (roots in CTF team perfect blue). Mechanism: manual expert code review + formal analysis of contracts before deployment. Role on Pharos: audits ecosystem protocols — a quality signal users should look for before depositing.

EXVUL (exvul.com): smart-contract audits & penetration testing. Mechanism: code review plus offensive-security testing of the full stack (contracts, frontends, infra). Role on Pharos: another audit option in the ecosystem's security supply chain.

OPENZEPPELIN (openzeppelin.com): the standard library of secure smart contracts (ERC-20/721/4626 implementations, AccessControl, upgrades) + Defender platform. Mechanism: battle-tested reusable contract code and operational tooling (monitoring, automated ops, access management). Role on Pharos: most Pharos contracts are built on OpenZeppelin libraries — foundational security infrastructure.

TRM LABS (trmlabs.com): blockchain intelligence & COMPLIANCE (KYT — Know Your Transaction). Mechanism: traces funds across chains, screens addresses against sanctions/illicit-activity risk, scores transactions for AML programs. Role on Pharos: the transaction-monitoring layer institutions need to operate RWA/RealFi compliantly.

TRUSTA LABS (trustalabs.ai): Web3 AI security & data analytics. Mechanism: on-chain behavior analysis — MEDIA reputation scores for wallets, Sybil-attack detection (used by major airdrops), attestation infrastructure. Role on Pharos: wallet-reputation and anti-Sybil layer, relevant for fair airdrops and campaign integrity.
`,
  dapp_profiles_identity: `
DAPP PROFILES — IDENTITY, NFT & COMMUNITY ON PHAROS:

PNS — PHAROS NAME SERVICE (pharosname.com): the official .pharos domain service. Mechanism: ENS-style on-chain registry — a readable name (alice.pharos) resolves to your address; names are NFTs you own and can transfer. Role on Pharos: human-readable identity for payments — instead of 0x… addresses, send to a name.

ZNS CONNECT (zns.bio): multi-chain Web3 identity layer. Mechanism: domain names deployable across many chains with a unified profile (socials, wallets, badges) attached. Role on Pharos: cross-chain identity option alongside PNS.

GRANDLINE (app.grandline.world): Pharos-native NFT LAUNCH & TRADING platform. Mechanism: launchpad for NFT collections (mint pages, allowlists) + secondary marketplace; LP-position NFTs and RWA-linked NFTs can also trade here. Role on Pharos: THE native NFT venue of the ecosystem.

PHAROSVERSE (pharosverse.xyz): community-built ecosystem NAVIGATOR. Mechanism: aggregates projects, insights, campaign guides and community content about Pharos in one dashboard. Role on Pharos: discovery layer — where newcomers map what exists in the ecosystem.
`,
  pharos_port: `
PHAROS PORT (port.pharos.xyz) — Official All-in-One RealFi Entry Hub:
• Bridge & Swap: cross-chain transfers and token swaps powered by LI.FI, CCIP, CCTP
• PROS Staking: stake native PROS, earn staking rewards (10% APY target via PoS + Foundation subsidies)
• Harbor: curated RWA marketplace — browse, deposit, and track real-world asset vaults (R25, Centrifuge, Ember, AquaFlux, etc.)
• Campaigns & Rewards: active quests, points leaderboard, airdrop tracking, AI Agent Carnival participation
• Portfolio: unified view of wallet balances, positions, LP tokens, and vault shares across all Pharos protocols
• Ecosystem Directory: full list of projects building on Pharos (DEXes, lending, RWA, wallets, infra, AI agents)
• AI Agent Carnival: create/manage agents, add friends, transfer, climb leaderboard (July 2026)
• Connect wallets: MetaMask, OKX Wallet, Rabby, Safe, and EIP-6963 compatible wallets

HARBOR — LIVE RWA PRODUCTS (data from official Port API, July 2026):
  • pAlpha (Ember): 14% APY | $51.3M TVL | min $0.10 | Fixed Income & Credit | deposit at port.pharos.xyz/deposit
  • VRPC-Weekly (R25): 8% APY | $2.15M TVL | min $1 | Fixed Income & Credit | weekly redemption
  • VRPC-SemiYearly (R25): 15% APY | $10.2M TVL | min $100 | Fixed Income & Credit | semi-annual redemption
  • tulPRWA (Tulipa Capital): target 14% APY | $567K TVL | min $1 | Real Estate

ACTIVE CAMPAIGNS ON PORT (July 2026):
  • Agent Carnival (June 26 – July 26): port.pharos.xyz/agent-carnival
  • Anvita Cyber Cup (June 20 – July 19): flow.anvita.xyz/activities/cyber-cup
  • TopNod Cup (June 11 – July 20): via TopNod app
  • AquaFlux Campaign (May 19 – July 31): app.aquaflux.pro/campaign
`,
  pharos_foundation: `
PHAROS FOUNDATION (pharosfoundation.xyz) — launched November 24, 2025:
• Non-profit, Asia-led, compliance-ready NEUTRAL governance body stewarding the RealFi and open finance ecosystem on Pharos
• FOUR PILLARS: (1) Ecosystem Support — grants + technical programs for developers | (2) Technology Development — frameworks and documentation | (3) Governance & Transparency — clear reporting, funding oversight | (4) Education — open finance research, collaboration with TradFi institutions
• OPERATING LIMITS: does NOT provide investment advice, does NOT comment on token price, does NOT favor any single protocol
• Publishes transparency reports (grants issued, governance decisions, fund deployment) + a public "Foundation Charter" (mandate, governance model, operating limits)
• Oversees $PROS tokenomics and inflation schedule (no inflation for 6 months post-mainnet, then ~5% annual)
• Coordinates RealFi Alliance membership and ecosystem incubation ($10M Incubation Fund)
• Leadership: Wish Wu (Co-Founder & CEO of Pharos Network) emphasized foundation neutrality as key to ecosystem integrity
• Partners/investors around the ecosystem: Dragon Draper, Lightspeed, Hack VC, Faction VC, Sumitomo Corporation, Flow Traders, SNZ, GCL New Energy (~$1B valuation investment March 2026)
• Foundation also supports community programs: Lighthouse Keeper, Storyteller Program, Pharos Meetups
`,
  devhub_tools: `
PHAROS DEVELOPER HUB (pharos.xyz/devhub) — Build Tools & Templates:
Stats: 60+ Projects | 1,000+ Developers | Gas Price 1 Gwei | Growing tx count
Block Explorers: Hemera SocialScan (social-layer explorer)
RPC Providers: ZAN RPC | Alchemy RPC | Nirvana RPC
Indexers: Goldsky Indexer (subgraph-compatible)
Oracles: Supra Oracle | Chainlink Oracle (Data Streams)
Cross-Chain: Chainlink CCIP | LayerZero | Circle CCTP
Wallets/Multisig: Safe MultiSig (gnosis-safe fork) | Fordefi Wallet (institutional)
Templates: dApp templates, DeFi protocols, more — production-ready
GitHub: github.com/PharosNetwork — 22 repos including:
  • examples (Python, Apache-2.0) — Pharos code examples
  • PharosCubenet (C++) — core network implementation
  • PharosTumbler (C++) — consensus mechanism
  • pharos-cargo-stylus (Rust) — Stylus smart contracts on Pharos
  • pharos-stylus-sdk-rs (Rust) — Rust smart contracts on Pharos
  • pharos-skill-engine (Go Template) — official skill engine
  • contracts (Solidity) — official smart contract deployments
  • safe-wallet-monorepo (TypeScript) — Safe{Wallet} fork for Pharos
Harbor Program (builders.harbor): guides builder journey on Pharos to ship projects — start building to unlock Harbor tier
Technical Articles available at devhub: DTVM SmartCogent (AI multi-agent), DTVM Engine (deterministic high-perf execution), DTVM Stack overview
`,
  realfi_alliance_full: `
REALFI ALLIANCE (pharos.xyz/realfi-alliance) — Strategic initiative to standardize institutional RWA execution onchain:
Mission: Synchronize asset issuers, infrastructure providers, and builders into a unified execution framework. Move beyond tokenization toward institutionalization of real-world assets.
Pillars: Standardization (reduce institutional friction) | Utility (composable assets) | Readiness (align infra with demand)
Members by category:
CORE INFRASTRUCTURE & INTEROPERABILITY: Chainlink | Alchemy | LayerZero
ASSET ISSUANCE & MANAGEMENT: Centrifuge (credit/debt) | Asseto (tokenized finance) | Yield Network
REALFI APPLICATIONS & YIELD: Ember Protocol (pAlpha vault) | Faroo (stPROS/RWA) | R25 (tokenized vaults) | AquaFlux (tri-token)
INSTITUTIONAL ACCESS & RESEARCH: Anchorage Digital (institutional custody) | TopNod (native wallet) | Dune (on-chain analytics) | Fourpillars | Web3Caff
LIQUIDITY & CONNECTIVITY: LiFi (cross-chain aggregator) | Agra (RWA bonds) | Amber Group (market making)
CREDIT, ASSETS & APPS: Pleasing Market | Yuzu Money
SETTLE AND PAYMENT: KUN
AGENT BANKING INFRASTRUCTURE: Vishwa Finance
NEW BATCH (July 2026): Avalon Finance | TermMax (fixed-rate) | Primus Labs (zkTLS) | Tulipa Capital
New members expand: Morpho (lending), TermMax (fixed-rate ERC-4626), Primus (zkTLS data verification), Tulipa (institutional)
`,
  agent_carnival: `
AI AGENT CARNIVAL — Pharos × Anvita Flow Hackathon (pharos.xyz/agent-carnival):
Period: June 8 – July 24, 2026 | Theme: "Create Like a PRO" | Prize pool: 50,000 PROS total
PHASES:
  Pre-Season (May 25 – June 8): Skill creation in Discord community | 5,000 PROS for 10 Discord winners
  Phase 1 – Skill Hackathon (June 8 – June 22): Build standardized Skill modules (SKILL.md format) | Submission by June 15, judging June 16-22 | 20,000 PROS for 40 winners
  Phase 2 – Agent Arena (June 22 – July 24): Build complete Agents from Phase 1 Skills | Submission by July 6 | 25,000 PROS | Only Phase 1 winners' agents qualify
WHAT TO BUILD:
  Skill: reusable module (data fetching, content generation, on-chain actions, payments) — must be submitted via DoraHacks
  Agent: full intelligent assistant built from Skills, deployed on Pharos via Anvita Flow
KEY FACTS:
  • Open to all developers globally, no Web3 experience required
  • Phase 2 Agents MUST use Skills from Phase 1 winners (own or others from Skill Hub)
  • Prizes distributed in PROS to registered wallet after winner announcement
  • Submissions at DoraHacks platform
  • Anvita Flow: converts Skills into deployable Agents with one click
  • Phase 1 winners announced June 17-22, Phase 2 on July 24
CURRENT STATUS (July 2026): AI Agent Carnival is LIVE on port.pharos.xyz/agent-carnival. Users can create agents, add friends, transfer assets, and compete on leaderboard.
`,
  pharos_incubator: `
PHAROS INCUBATOR / ECOSYSTEM PROGRAM (pharos.xyz/ecosystem):
• $10M fund offering comprehensive support for projects building on Pharos blockchain
• Partners: Dragon Draper, Lightspeed (top-tier VCs as co-sponsors)
• Innovation paths: RWA/Payments | DeFi | Innovative Infrastructure
• Benefits: Capital (up to $10M fund access) | Technology (direct core team mentorship) | Go-to-Market (launch + user growth support) | Fundraising (next round connections) | Financial & Legal (Web3 legal/finance expert advice)
• Application process: Submit application → Internal review → Approval → Milestone setting (measurable milestones for fund utilization)
• Program launched February 2026 with mandate to bridge RWA with on-chain finance and empower early-stage RWA/DeFi teams
• First incubation project: Faroo (@Farooxyz) — announced June 29 / July 2, 2026, backed at a confirmed $10M valuation, with full investment + resource support
• Faroo simultaneously launched its RWA Hybrid Vault: stake PROS → lock staked PROS to earn native staking rewards + returns tied to enterprise RWA partners' performance
• Apply at: pharos.xyz/ecosystem
`,
  pharos_community: `
PHAROS COMMUNITY (pharos.xyz/community | community.pharos.xyz):
Stats (July 2026): 312,000+ community members | 93,552 unique addresses | 2.7M total on-chain transactions | 431,039 daily active transactions
Channels: X (@pharos_network, 390.6K followers) | Discord | Telegram | LinkedIn
Programs:
  • Lighthouse Keeper Program — dedicated community contributors/moderators earning rewards
  • Storyteller Program — content creators and educators for Pharos ecosystem
  • Pharos Meetups — IRL global community events
  • Harbor — builders program for developers to ship projects
Learning: Pharos Tech and Vision guide | Developer docs | Community Roles | Testnet Tutorial
Philosophy: "Sailors" = community members | "GOCTO" = community greeting (Go Conquer The Ocean) | #TheAlphaSummer = Summer 2026 campaign
Alpha Summer announcement: Pharos testnet turned 1 year old June 26, 2026 | 125,000 PROS total for Alpha Summer activities
`,
  pharos_latest: `
PHAROS LATEST NEWS (July 2026):
• AI Agent Carnival "Create Like a PRO" (June 8 – July 21, 2026): 150,000 PROS total prize pool — 100,000 PROS for developers (Skill Hackathon, Agent Invocation Race, Steward Agent First-Deployment, Caller Invocation Race) + 50,000 PROS for users (Social & Transfer Track, Top Transfer / Top Connector leaderboards, Anniversary Co-Creation). Phase 1 (dev hackathon) ends July 6; Phase 2 (user engagement) June 23–July 21. Skill uploads open July 8, 7PM HKT; Service Agent submission deadline July 10, 6PM HKT.
• AI Agent Carnival LIVE (July 3): Create agents, add friends, transfer assets, climb leaderboard at port.pharos.xyz/agent-carnival. No coding required — anyone can run an agent.
• Live TVL by protocol (July 2026, DefiLlama/AprScope): R25 ~$92M | Centrifuge ~$15M (private credit, ~3.6% APY USDC pool) | Ember ~$7-13M | FaroSwap ~$689K | Bitverse DEX ~$125K | Zona ~$9K | OpenFi early stage.
• Leadership quote (July 2): Wish Wu, Co-founder & CEO — "Faroo proves that real-world assets and on-chain staking can be deeply integrated at the same protocol layer."
• Tech naming: deep-parallel execution engine is called SALI; stack = SALI + modular SPNs + ZK-KYC/AML + AsyncBFT + x402 agent payments + dual VM (EVM+WASM).
• Faroo Pre-mint LIVE (July 3): First RWA Hybrid Vault on Pharos. Deposit stPROS to earn rewards tied to real-world asset performance (principal protected). Phase 1 cap: 1,000,000 stPROS. Extra $PROS airdrop for participants. app.faroo.xyz/pre-mint
• Faroo selected as FIRST Pharos Incubator project (July 2, 2026)
• RealFi Alliance Batch 4 (July 1): Avalon Finance, TermMax, Primus Labs, Tulipa Capital join alliance
• Pharos Pacific Ocean Mainnet launched April 28, 2026
• $44M Series A announced April 8, 2026 (total $52M raised)
• USDC + CCTP integration launched April 28, 2026
• GCL New Energy strategic investment at ~$1B valuation (March 14, 2026)
• Faroo backed at confirmed $10M valuation by the Pharos Incubator; RWA Hybrid Vault live (July 2, 2026)
• Top news: "PROS Never Sleeps: The Pharos Alpha Summer Begins" (June 10) | "The RealFi Inflection" (May 6) | "Architecting Global RealFi: Pharos Mainnet Officially Integrates USDC and CCTP" (April 28)

FULL NEWS TIMELINE (pharos.xyz/resources):
  2026-04-28: Pacific Ocean Mainnet launch (RWA distribution, less liquidity fragmentation) + USDC/CCTP integration live
  2026-04-20: RealFi Access Program introduced | $PROS Tokenomics published (long-term alignment, scarcity)
  2026-04-15: Joint research with University of Hong Kong SCF FinTech Academy — prediction markets + AI decision-making
  2026-04-08: $44M Series A announced (total $52M)
  2026-03-27: Circle partnership — USDC + CCTP on mainnet (RealFi settlement layer)
  2026-03-14: GCL New Energy strategic investment (~$1B valuation)
  2026-03-13: RealFi Alliance expanded (RWA transparency gap)
  2026-02-23: RealFi Alliance formed (institutional RWA execution standard)
  2026-02-18: Centrifuge partnership (institutional asset distribution)
  2026-02-03: $10M+ RealFi Incubator launched with Dragon Draper + Lightspeed
  2025-11-24: Pharos Foundation launched
  2025-10-27: Chainlink CCIP adopted as canonical cross-chain infra + Data Streams for RWA markets
  2025-10-21: AtlanticOcean Testnet launched
  2025-09-29: Concero integration (cross-chain composability for RWAs)
  2024-11-08: $8M seed round (Lightspeed Faction + Hack VC)
`,
  pharos_team: `
PHAROS FOUNDING TEAM:
• Alex Zhang — Co-founder & CEO: ex-CTO of AntChain (Ant Group's blockchain division) | ex-CEO of ZAN (Ant's blockchain services) | Built infrastructure for Alipay | Asia's largest BaaS platform builder
• Team background: pioneers from Ant Financial, Microsoft Research, PayPal, and Stanford University
• Deep expertise in: blockchain infrastructure, formal verification, ZK systems, high-performance computing
• Built: Alipay payment infra, Asia's largest BaaS (Blockchain-as-a-Service) platform at Ant Group
• Security focus (July 2, 2026 post): "Nearly 40% of industry's $16B+ in hack losses didn't come from smart contract exploits, but from compromised private keys" — Pharos focus on key infrastructure
`,
  pharos_brand: `
PHAROS BRAND KIT (pharos.xyz/brandkit):
Tagline: "Fastest EVM Layer-1 | Unify Web2 and Web3 at Internet Scale"
Full description: "Inclusive financial Layer 1 for RealFi, where real value and institutional-grade assets circulate onchain and are composable with decentralized assets, becoming the new infrastructure of global finance for all."
Typography: PP Neue Montreal (primary, sizes 12-48) | Helvetica Neue (secondary)
Colors: Blue #0113B7 (RGB 1,19,183) | Black #0B0B0B | Dark gray #343434 | Light gray #DFE3E5 | White #FFFFFF
Investor backing: Sumitomo Corporation, Flow Traders, SNZ, Hack VC, Faction VC | Total: $8M seed + $44M Series A = $52M raised | Incubating $1.5B RWA exchange pipeline with Ant Digital Technologies
`,
  pharos_research: `
PHAROS RESEARCH CENTER (pharos.xyz/research) — Published reports and analyses:
Pharos-specific:
  • "Decoding Pharos: 5 Questions #2 — Asset Uniqueness of Pharos as L1" (June 29, 2026)
  • "Decoding Pharos: 5 Questions #1 — Technological Advancement" (May 28, 2026)
  • "Analysis of Pharos 10% Yield-PoS Rewards and Foundation Subsidies" (May 22, 2026)
  • "Speed is Only the Baseline: Why Institutional Assets Choose Pharos" (Feb 27, 2026)
RWA/DeFi Research Topics Covered:
  • On-Chain Fixed-Income Products and pre-deposit DeFi
  • On-Chain Structuring: from asset mapping to yield stratification
  • "Perps for Everything: Ultimate RWA Liquidity Solution"
  • RWA and DeFi Integration — Asset Restructuring and Market Evolution
  • Pre-IPO Tokenization: new liquidity exits for PE/VCs
  • Tokenized US equity — turning point of RWA regulatory
  • Mainland vs Hong Kong: China's Dual-Chain Move
  • Convergence and Divergence in crypto regulation
  • Security: public blockchain security architecture
  • AI & Crypto: power reshuffle or resource harvesting
  • The October 11 USDe depeg — $19B financial engineering case study
  • Google & Visa join x402: redefining AI agent payments
Notable: Pharos research covers both Pharos-specific topics AND broader DeFi/RWA/TradFi education for users
`,
  pharos_lending_extra: `
ADDITIONAL LENDING & DeFi PROTOCOLS ON PHAROS (July 2026):
• Morpho: institutional RWA markets — peer-to-peer orderbook-style lending matching, Compound/Aave-style pools
• TermMax: fixed-rate ERC-4626 vaults — predictable yield for lenders, fixed cost for borrowers; new RealFi Alliance member
• Avalon Finance: lending protocol — new RealFi Alliance member (July 2026)
• Primus Labs: zkTLS data verification — verify off-chain data for on-chain use (proof of TLS/web2 state)
• Tulipa Capital: institutional capital infrastructure — new RealFi Alliance member
• BTC Integration: Babylon stBTC | Fiamma BTC bridge — bringing Bitcoin liquidity to Pharos
• EigenLayer: stETH restaking on Pharos
• Pizza Zone, Pros Pixel (GameFi): casual web3 gaming on Pharos testnet
`,
  port_ecosystem_directory: `
OFFICIAL PHAROS ECOSYSTEM DIRECTORY (port.pharos.xyz/ecosystem — 42 active projects, July 2026):

DEX / TRADING:
• Faroswap (faroswap.xyz) — Pharos-native DEX fueling RWA-Fi with precision & depth [the agent can swap + manage V3 liquidity here]
• Bitverse (bitverse.zone) — all-in-one RWA perp DEX: real-world assets + U.S. stock futures, AI-powered trading
• Agra (bonds.agra.gg) — exchange for onchain credit: trading and financing tokenized credit
• OKU (oku.trade) — DeFi aggregator on 35+ chains, 0% fees, 14 swap + 11 bridge routers

RWA:
• R25 (r25.xyz) — RWA tokenization protocol using IoT + AI: solar and EV assets → investable on-chain products (~$93M TVL, largest on Pharos)
• AquaFlux (aquaflux.pro) — RWA yield & liquidity via tri-token model (P/C/S), customizing risk and return
• Asseto (asseto.finance) — RWA tokenized fintech, next-generation on-chain asset platform
• Zona (zona.finance) — deposit RWAs and unlock idle liquidity (lend/borrow)

LENDING / YIELD:
• Morpho (morpho.org) — lending combining Compound/Aave-style pools with P2P orderbook matching
• TermMax (app.termmax.ts.finance) — fixed-rate digital asset lending & borrowing
• Faroo (app.faroo.xyz) — liquid staking: PROS → stPROS, staking + RWA yields simultaneously
• Ember (ember.so) — unified vault platform tokenising any yield or fund strategy

BRIDGES:
• LI.FI (li.fi) — bridge aggregation protocol with DEX connectivity [agent executes via this]
• Jumper (jumper.exchange) — LI.FI-powered cross-chain swap/bridge interface
• LayerZero (layerzero.network) — omnichain interoperability protocol
• InterPort (interport.fi) — fast cross-chain swaps & bridge at best rates
• Chainlink (chain.link) — CCIP bridge + oracle infrastructure [agent executes CCIP]

STABLECOIN / PAYMENTS:
• Circle (circle.com) — USDC issuer; native USDC + CCTP v2 on Pharos [agent executes CCTP]
• Alchemy Pay (alchemypay.org) — fiat↔crypto on/off ramp

WALLETS / CUSTODY:
• OKX Wallet (web3.okx.com) — the crypto wallet for everything onchain
• TopNod (topnod.com) — simple, secure self-custody wallet for RWA and digital assets
• OneKey (onekey.so) — open-source crypto wallet
• KuCoin Wallet (kucoin.com/web3) — find on-chain alpha
• Fordefi (fordefi.com) — institutional MPC wallet & security platform
• Safe (app.safe.global) — smart contract multisig wallet
• Anchorage (anchorage.com) — institutional custody, staking, governance, trading

ORACLES / INFRA / RPC:
• Supra (supra.com) — all-in-one MultiVM L1 oracle for super dApps
• ZAN (zan.top) — plug-and-play Web3 tools & RPC services
• Alchemy (alchemy.com) — web3 development platform
• Nirvana (nirvanalabs.io) — Web3 infrastructure for blockchain apps
• Hemera (thehemera.com) — account-centric indexing network / block explorer
• GoldSky (goldsky.com) — fastest, most scalable blockchain indexing

SECURITY / COMPLIANCE:
• Hypernative (hypernative.io) — real-time threat detection & prevention
• Zellic (zellic.io) — blockchain security audits
• ExVul (exvul.com) — smart contract audits, pen testing, consulting
• OpenZeppelin (openzeppelin.com) — crypto cybersecurity technology
• TRM (trmlabs.com) — crypto compliance & risk management (KYT)
• Trusta Labs (trustalabs.ai) — Web3 security infrastructure & data analytics

IDENTITY / NFT / COMMUNITY:
• PNS (pharosname.com) — official .pharos domain name service
• ZNS Connect (zns.bio) — Web3 identity layer, multi-chain domains
• Grandline (app.grandline.world) — native NFT launch & trading platform
• Pharosverse (pharosverse.xyz) — ecosystem navigator: insights, projects, community

Live directory: port.pharos.xyz/ecosystem (new dApps launch frequently)
`,
  pharos_partners: `
OFFICIAL PHAROS PARTNERS & INVESTORS (port.pharos.xyz/ecosystem#partners):

SEED ROUND — $8M (November 2024), co-led by Lightspeed Faction + Hack VC:
• Lightspeed Faction (co-lead) | Hack VC (co-lead) | SNZ Capital (strategic anchor)
• Dispersion Capital | Chorus One Ventures | Generative Ventures | Hash Global
• Legend Star | Reforge | MH Ventures | Zion

SERIES A — $44M (2026), total raised $52M:
• Co-led by top Asian private equity funds, a listed renewable-energy company, and a Hong Kong-compliant financial institution (undisclosed)
• Strategic investors: Sumitomo Corporation (Fortune 500, via subsidiaries) | SNZ | Chainlink | Flow Traders

Partners displayed on Pharos Port: Dispersion Capital, ChorusOne, Faction, Generative Ventures, Hash Global, Legend Star, Reforge, Zion.
Purpose: expand RWA infrastructure across Asia and globally — goal of bringing $50 trillion in traditional + digital assets on-chain.
`,

  // ═══ CRYPTO ENCYCLOPEDIA — deep educational sections ═══

  intro_crypto: `
CRYPTOCURRENCY BASICS:
A cryptocurrency is a digital asset secured by cryptography and recorded on a blockchain — a public, append-only ledger replicated across thousands of independent computers. No bank or government controls it; consensus rules do.
KEY PROPERTIES: scarce by code (e.g. Bitcoin's 21M cap) | permissionless (anyone can transact) | borderless | censorship-resistant | self-custodied (your keys = your coins).
COIN vs TOKEN: a coin is native to its own chain (BTC, ETH, PROS); a token is issued via smart contract on an existing chain (USDC, LINK are ERC-20 tokens).
HOW A TRANSACTION WORKS: you sign a message with your private key → broadcast to the network → validators/miners include it in a block → after enough confirmations it is final. On Pharos finality is sub-second; on Bitcoin ~60 min (6 blocks).
MARKET BASICS: price is set purely by supply/demand on exchanges. Market cap = price × circulating supply. FDV (fully diluted valuation) = price × max supply. High FDV/mcap ratio means heavy future unlocks.
VOLATILITY: crypto is far more volatile than stocks — position sizing and never investing more than you can lose are rule #1.
`,

  crypto_history: `
CRYPTO TIMELINE (context for "how did we get here"):
2008-09: Satoshi Nakamoto publishes Bitcoin whitepaper; genesis block Jan 2009 — first decentralized digital money.
2015: Ethereum launches — programmable smart contracts, birth of tokens and dApps.
2017: ICO boom; ERC-20 explosion; CryptoKitties (first NFT mania).
2020: "DeFi Summer" — Compound liquidity mining, Uniswap AMM dominance, yield farming born.
2021: NFT boom (Bored Apes, art), L1 wars (Solana, Avalanche), all-time highs.
2022: Terra/LUNA collapse ($40B), Celsius/3AC insolvencies, FTX fraud — the case FOR self-custody and DeFi transparency.
2023: L2 rollup era (Arbitrum, Optimism, Base); real-yield narrative replaces emissions farming.
2024: US spot Bitcoin & Ethereum ETFs approved — institutional entry; restaking (EigenLayer) hype.
2025-26: RWA/tokenization era — treasuries, private credit, funds on-chain; AI agents transacting on-chain (x402); Pharos launches as the RealFi-native L1 (Pacific Ocean mainnet, April 28 2026).
LESSON PATTERN: every cycle, hype → crash → the real infrastructure survives and compounds. RWAs + AI agents are the current infrastructure buildout.
`,

  perp_dex: `
PERPETUAL FUTURES (PERPS) & PERP DEXs:
A perpetual future is a derivative that tracks an asset's price with NO expiry date. You trade with leverage (e.g. 10x) without owning the asset.
FUNDING RATE: the mechanism that pins the perp price to spot. When perp > spot, longs pay shorts (positive funding); when perp < spot, shorts pay longs. Paid every 1-8h. Persistent positive funding = crowded longs.
LIQUIDATION: with leverage, your margin is collateral. If price moves against you past the maintenance margin, the position is force-closed (liquidated) and you lose the margin. Liquidation price ≈ entry ± (1/leverage) adjusted for fees.
PERP DEX MODELS:
• Order book (dYdX, Hyperliquid): CEX-like matching, best for pros; needs high throughput.
• Oracle/pool-based (GMX-style): traders bet against an LP pool (GLP model); zero price impact but oracle-dependent.
• vAMM (Perpetual Protocol): virtual liquidity curve, no real counterparty pool.
ON PHAROS: Bitverse (app.bitverse.zone) is the perp DEX — crypto perps PLUS tokenized US stock futures (AAPL, TSLA…), AI-assisted trading. Pharos's parallel execution suits perp order flow.
RISKS: leverage amplifies both ways; funding costs bleed positions; oracle wicks can liquidate; always use stop-losses and isolated margin when learning.
`,

  derivatives_options: `
CRYPTO DERIVATIVES BEYOND PERPS:
FUTURES (dated): obligation to buy/sell at a set date. Basis = future price − spot; annualized basis is the "cash-and-carry" yield.
OPTIONS: right (not obligation) to buy (call) or sell (put) at a strike price. Buyers pay premium (defined risk); sellers collect premium (defined reward, tail risk). Greeks: delta (direction), theta (time decay), vega (volatility), gamma.
STRUCTURED PRODUCTS ON-CHAIN:
• Covered call vaults (Ribbon/Thetanuts style): sell upside for weekly premium.
• Principal-protected notes: majority in fixed income + small options kicker.
• Tranching (senior/junior): split one cash flow into safe + risky slices — EXACTLY what AquaFlux does on Pharos with the tri-token model: P (Principal, protected), C (Coupon, yield), S (Shield/Senior, first-loss protection seller).
• Fixed vs variable yield splitting (Pendle PT/YT style): principal token redeems 1:1 at maturity (fixed rate), yield token captures the floating yield. TermMax on Pharos offers fixed-rate lending in this spirit.
WHY IT MATTERS: derivatives let you hedge (protect a portfolio without selling), earn income (sell volatility) and express views efficiently — but complexity = risk. Understand the payoff diagram before depositing.
`,

  nfts_full: `
NFTs (NON-FUNGIBLE TOKENS) — BEYOND ART:
An NFT is a unique on-chain token (ERC-721: one-of-one; ERC-1155: semi-fungible batches). "Non-fungible" = not interchangeable, unlike ERC-20s.
REAL UTILITY TODAY:
• DeFi positions: Uniswap V3 / FaroSwap V3 LP positions ARE NFTs — each has its own price range, liquidity and fees (that's why your Pharos LP shows as an NFT).
• Identity & naming: ENS / PNS (.pharos domains) are NFTs mapping names to addresses.
• RWA deeds: tokenized invoices, real estate titles, fund shares can be NFTs with legal wrappers.
• Access & tickets: memberships, event passes, game items.
• Credentials: soulbound tokens (non-transferable) for reputation/KYC attestations.
MARKET MECHANICS: floor price (cheapest listed), royalties (creator % on resale, now often optional), marketplaces (OpenSea, Blur). NFT-Fi: borrowing against NFTs, fractionalization (splitting one NFT into ERC-20 shares).
ON PHAROS: Grandline (NFT badges/collections), Pharosverse, PNS domains, and every FaroSwap V3 LP position (Position Manager 0xc0479219f4feba5a668cff71bf96f4ffe124c3ab).
RISKS: illiquidity (no buyer = no price), wash trading inflating volumes, IP ambiguity. Value only what has cash flow, utility or provable scarcity + demand.
`,

  crypto_networks: `
MAJOR NETWORKS COMPARED (mental map):
BITCOIN: digital gold; PoW; ~7 TPS; 10-min blocks; no smart contracts natively; highest security/decentralization; Lightning for payments.
ETHEREUM: smart-contract settlement layer; PoS; ~15 TPS L1 (rollups scale it); richest DeFi/NFT ecosystem; EIP-1559 fee burn.
L2 ROLLUPS (Arbitrum, Optimism, Base): inherit Ethereum security, 10-100x cheaper; Base (Coinbase) leads consumer adoption.
SOLANA: monolithic high-performance L1; ~65k TPS theoretical; sub-second; single global state; strength: consumer apps, memecoins, DePIN; tradeoff: hardware-heavy validators.
BNB CHAIN: Binance-aligned EVM chain; cheap, huge retail user base.
POLYGON: PoS sidechain + zkEVM; enterprise partnerships.
AVALANCHE: subnets (app-specific chains); TradFi experiments (Evergreen).
TRON: dominant for USDT payments in emerging markets.
PHAROS: RealFi-native L1 — 30,000 TPS, 2 Gigagas/s, sub-second finality via AsyncBFT + speculative parallel execution, dual VM (EVM+WASM), modular SPNs, protocol-level compliance (ZK-KYC/AML), native AI-agent rails (x402). Positioning: where institutional RWAs + AI agents live, vs. general-purpose chains.
HOW TO EVALUATE ANY CHAIN: security budget, decentralization (validator count/stake distribution), real TPS under load, finality time, fees, developer activity, TVL quality (sticky vs mercenary), and the one killer use case.
`,

  scalability_deep: `
BLOCKCHAIN SCALABILITY — THE FULL PICTURE:
THE TRILEMMA: decentralization vs security vs scalability — improving one usually costs another.
SCALING STRATEGIES:
• Vertical (bigger blocks/faster hardware): Solana, BNB — simple but raises node requirements.
• Rollups (L2): execute off-chain, post data+proofs to L1. Optimistic (fraud proofs, 7-day exits) vs ZK (validity proofs, instant finality). Data availability is the bottleneck → EIP-4844 blobs, Celestia, EigenDA.
• Sharding: split state across parallel chains (Ethereum danksharding roadmap, NEAR).
• Parallel execution: run non-conflicting txs simultaneously instead of sequentially — Solana (Sealevel), Aptos/Sui (Move + object model), Monad, and PHAROS (speculative parallel execution + SALI engine → 2 Gigagas/s). The insight: most txs don't touch the same state, so serialize only conflicts.
• Modular vs monolithic: monolithic = one chain does execution+consensus+DA (Solana); modular = specialized layers (Ethereum+rollups+DA layers; Pharos's L1-Base/L1-Core/L1-Extension with SPNs is a modular design INSIDE one L1).
• App-specific chains: Cosmos zones, Avalanche subnets, Pharos SPNs (Special Processing Networks for HFT/ZKML/AI with native restaking security).
METRICS THAT MATTER: sustained (not peak) TPS, time-to-finality, cost per tx under load, state growth (can nodes keep up?), MEV resistance.
`,

  tokenomics_value: `
TOKENOMICS & VALUE ACCRUAL (do tokens "pay dividends"?):
SUPPLY SIDE: max supply, circulating supply, emission schedule, unlock cliffs (check vesting! big unlocks = sell pressure), inflation rate. PROS: no inflation first 6 months post-mainnet, then 5%/yr to validators/delegators.
DEMAND SIDE / VALUE ACCRUAL MECHANISMS:
• Gas: every tx burns/pays the native token (ETH, PROS).
• Staking yield: lock tokens to secure the network, earn emissions + fees (~10% APY for PROS on Pharos Port). This is the closest thing to a crypto "dividend" — but funded by inflation unless fees exceed emissions.
• Real yield: protocols distributing actual fee revenue (GMX model) — sustainable "dividends".
• Buyback & burn: protocol revenue buys and destroys tokens (deflationary, like stock buybacks).
• Fee switch: governance can turn on revenue sharing to stakers (Uniswap debate).
• Governance rights: voting power over treasuries/parameters.
APR vs APY: APR = simple annual rate; APY = compounded. APY = (1 + APR/n)^n − 1 where n = compounds/year. 10% APR compounded daily ≈ 10.52% APY. Farming UIs love showing APY of volatile emissions — always ask WHERE the yield comes from: fees (real), emissions (dilution), or someone's loss (unsustainable).
RED FLAGS: yield paid in the same token being farmed, >90% insider allocation, no revenue, unlock cliff <6 months away.
`,

  defi_agents_ai: `
AI AGENTS × DEFI (the agent economy):
WHAT: autonomous software that reads on-chain data, reasons with LLMs, and executes (or proposes) transactions. Levels: (1) copilots that PROPOSE txs for human signature — like this Pharos Agent, non-custodial; (2) constrained agents with session keys/spending caps; (3) fully autonomous agents with own wallets.
KEY INFRASTRUCTURE:
• x402 protocol: HTTP 402 "Payment Required" revived — agents pay per API call in stablecoins, enabling machine-to-machine commerce. Native on Pharos.
• Agent marketplaces: Anvita Flow on Pharos — Service Agents publish Skills, Steward Agents discover and invoke them, payments via x402.
• Account abstraction (ERC-4337): smart accounts with session keys, spending limits, batched txs — the safety rails for agent autonomy. EntryPoint deployed on Pharos.
• Intents: user states the GOAL ("best yield on 1000 USDC"), solvers compete to fulfill it.
WHAT AGENTS DO TODAY: portfolio rebalancing, yield routing, DCA execution, liquidation protection, cross-chain arbitrage, wallet intelligence (like this agent's score/RealFi trackers).
RISKS: prompt injection, oracle manipulation feeding bad data, runaway approvals — mitigate with allowance caps, simulation before signing, human confirmation for value transfers.
PHAROS ANGLE: the chain is explicitly agent-native — AI Agent Carnival (150,000 PROS prize pool, June 8–July 21 2026), Agent Center, sub-second finality suits machine-speed commerce.
`,

  crypto_security_risk: `
CRYPTO SECURITY & RISK HYGIENE (protect yourself):
SELF-CUSTODY RULES: seed phrase on paper/steel, NEVER digital/photo/cloud; hardware wallet for >$1k; separate hot wallet for daily use and cold wallet for savings; verify addresses character-by-character (clipboard malware swaps them).
APPROVAL HYGIENE: every ERC-20 "approve" lets a contract spend that token. Prefer exact-amount approvals over infinite; periodically revoke unused allowances (revoke.cash). This agent always shows what you're approving.
COMMON ATTACKS: phishing sites (always check URL; bookmark official links) | fake airdrops asking you to "claim" (signing drains you) | address poisoning (dust txs from lookalike addresses) | rug pulls (dev holds mint/LP keys) | honeypots (can buy, can't sell) | social engineering ("support" DMs — real support never DMs first).
EVALUATING A PROTOCOL: audits (who? recent? scope?), time in production, TVL trend, admin keys (multisig? timelock?), oracle design, insurance funds. On Pharos: Zellic, OpenZeppelin, ExVul, Hypernative provide security; TRM does KYT screening.
SMART CONTRACT RISK LAYERS: code bugs → economic design flaws → oracle manipulation → governance capture → bridge risk (historically the biggest hacks: Ronin $624M, Wormhole $326M).
GOLDEN RULES: if the yield looks too good, you are the yield | never sign what you don't understand | test with small amounts first | diversify across protocols AND chains.
`,

  market_structure_trading: `
CRYPTO MARKET STRUCTURE & TRADING CONCEPTS:
MARKET PHASES: bull/bear cycles historically ~4 years around Bitcoin halvings (supply issuance halves; last: April 2024). Altseason = capital rotating from BTC into alts (watch BTC dominance falling).
ORDER TYPES: market (instant, pays spread), limit (set your price), stop-loss (sell if price falls to X), take-profit. On DEXs: slippage tolerance replaces the order book spread.
SPOT vs MARGIN vs PERPS: spot = own the asset; margin = borrowed spot; perps = leveraged synthetic exposure with funding costs.
READING MARKETS: market cap ranks (large >$10B, mid $1-10B, small <$1B — smaller = more volatile); volume confirms moves; TVL/mcap for DeFi valuation; funding rates show positioning; stablecoin supply growth = dry powder entering.
CEX vs DEX EXECUTION: CEXs (Binance, Coinbase, Bitget — PROS listed on Bitget/UEX) offer deep books and fiat ramps but custody risk ("not your keys"); DEXs offer self-custody and any token, but watch slippage/MEV. Aggregators (LI.FI/Jumper — used by this agent) route across venues for best price.
DCA (dollar-cost averaging): fixed buys on schedule — removes timing emotion; historically effective for volatile assets.
TAX/RECORD NOTE: most jurisdictions tax crypto trades; keep records (explorers + portfolio tools help).
`,

  airdrops_points: `
AIRDROPS & POINTS PROGRAMS:
WHAT: protocols distribute free tokens to early users — retroactive rewards (Uniswap's 400 UNI, Arbitrum, Jupiter) or announced points campaigns that convert to tokens.
POINTS META: protocols award points for usage (volume, TVL days, referrals) with the airdrop conversion undisclosed — keeps engagement while delaying tokenomics. Farm only where you'd use the product anyway; points can be devalued or never convert.
SYBIL RISK: farming with many wallets gets filtered (clustering analysis) — organic, sustained usage on one wallet beats 100 empty ones.
ON PHAROS: campaigns run at port.pharos.xyz (World Cup, Alpha Summer, AI Agent Carnival with 150,000 PROS pool). This agent's Campaigns page tracks live ones. Testnet participation (3B+ testnet users pre-mainnet) is the classic eligibility pattern — but Pharos has NOT announced a retroactive testnet airdrop; be wary of fake "PROS claim" sites (scam pattern).
CLAIM SAFETY: real airdrops never ask your seed phrase; check claims are on the official domain; simulation-check the claim tx.
`,

  restaking_lrt: `
RESTAKING & LIQUID RESTAKING:
STAKING RECAP: lock native tokens with validators to secure PoS; earn emissions+fees; slashing penalizes misbehavior. Liquid staking (Lido stETH, Bifrost) gives you a receipt token that stays usable in DeFi.
RESTAKING (EigenLayer model): re-use staked ETH's economic security to secure ADDITIONAL services (AVSs: oracles, bridges, DA layers) for extra yield — extra slashing risk stacked on top.
LRTs: liquid restaking tokens (ether.fi eETH etc.) = receipt for restaked positions; yield stacking with layered risk. Depeg risk if mass exits.
ON PHAROS: EigenLayer stETH and Babylon stBTC integrate as infra; Pharos SPNs use NATIVE RESTAKING — PROS stake secures Special Processing Networks. Faroo (first Pharos Incubator project, $10M valuation) launches stPROS liquid staking via Bifrost SLPx: stake PROS → stPROS earns staking yield + RWA Hybrid Vault returns simultaneously — the "dual yield" model.
EVALUATING YIELD STACKS: each layer adds smart-contract + slashing + liquidity risk. 3% extra APY rarely compensates a new bridge + a new protocol + lockups. Map every layer before depositing.
`,

  fixed_income_onchain: `
BONDS & ON-CHAIN FIXED INCOME:
TRADFI BONDS: loan instruments — issuer pays coupons + principal at maturity. Price moves inversely to rates; credit risk priced in spread over treasuries. Money markets = short-term (<1yr) low-risk paper.
ON-CHAIN VERSIONS:
• Tokenized treasuries: T-bill funds as tokens (BUIDL, Ondo, Janus Henderson JTRSY on Pharos ~$13.6M) — "risk-free rate" on-chain, NAV via oracle.
• Private credit: loans to real businesses tokenized (Centrifuge DROP/TIN on Pharos ~$15M TVL; R25 VRPC vaults ~$92M: consumer credit in Mexico/Thailand/Philippines/Indonesia/Pakistan, up to 15% APY, weekly/quarterly/semi-yearly duration tranches).
• Corporate bond tokens: AquaFlux CBT series (P/C/S/SS-CBT, expiry 12MAR2026).
• Fixed-rate DeFi: TermMax on Pharos; Pendle-style principal/yield splitting.
KEY CONCEPTS: NAV (net asset value per share — vault share value; pALPHA NAV ~1.027 USDC), duration (rate sensitivity), redemption windows (RWA vaults often have T+N exits, NOT instant), yield above par ((NAV−1)×100%).
RISK LADDER (safest→riskiest): tokenized T-bills → senior private credit tranches → junior tranches → unsecured DeFi lending. Always check: who originates the loans? who audits NAV? what's the exit liquidity?
`,

  ecosystem_analysis: `
HOW TO ANALYZE A CRYPTO ECOSYSTEM (framework):
1. TVL QUALITY: total value locked, but ask — is it sticky (RWAs, staking) or mercenary (points farming)? Pharos TVL is RWA-heavy (R25 ~$92M, Centrifuge ~$15M, Ember ~$7-13M) = stickier than farm TVL.
2. ACTIVITY: daily active addresses, tx count, gas paid (real demand), unique contract deployers (builder growth). Pharos: 431K daily txs, 93K+ mainnet addresses (July 2026), 4.3B testnet txs / 209M wallets pre-launch.
3. DEVELOPER STACK: docs quality, RPC/indexer/oracle availability (Pharos: ZAN, Alchemy, Goldsky, Hemera, Supra), grants (Pharos Incubator $10M, RealFi Alliance).
4. LIQUIDITY VENUES: DEX depth (FaroSwap), CEX listings (Bitget, UEX for PROS), bridges (CCIP, CCTP, LayerZero, LI.FI, Stargate = 6+ routes in/out of Pharos).
5. INSTITUTIONAL RAILS: custody (Anchorage, Fordefi), compliance (TRM, ZK-KYC), fiat ramps (AlchemyPay) — Pharos's differentiator.
6. NARRATIVE FIT: does the chain own a category? Pharos = RealFi (RWA × compliance × AI agents). Chains that own a narrative attract its capital cycle.
7. TOKEN HEALTH: float vs FDV, unlock schedule, staking ratio, burn rate.
`,
};

// Structured dApp directory (source: api.pharosnetwork.xyz/omni_port/ecosystem, July 2026).
// Used to build a deterministic client-side answer for "what dApps/protocols are on Pharos?"
// — no LLM involved, so the answer never dangles.
export interface EcosystemDapp {
  name: string;
  url: string;
  desc: string;   // English
  descPt: string; // Portuguese
}

// Structured partners/investors list (source: port.pharos.xyz/ecosystem#partners
// + official seed/Series A announcements). Used for deterministic answers.
export const PHAROS_PARTNERS = {
  seedLeads: ["Lightspeed Faction", "Hack VC"],
  seedInvestors: ["SNZ Capital (strategic anchor)", "Dispersion Capital", "Chorus One Ventures", "Generative Ventures", "Hash Global", "Legend Star", "Reforge", "MH Ventures", "Zion"],
  seriesAInvestors: ["Sumitomo Corporation (Fortune 500)", "SNZ", "Chainlink", "Flow Traders"],
} as const;

export const ECOSYSTEM_DAPPS: Record<string, EcosystemDapp[]> = {
  "DEX & Trading": [
    { name: "Faroswap", url: "https://faroswap.xyz", desc: "Pharos-native DEX fueling RWA-Fi (swaps + V3 liquidity)", descPt: "DEX nativa da Pharos para RWA-Fi (swaps + liquidez V3)" },
    { name: "Bitverse", url: "https://www.bitverse.zone", desc: "RWA perp DEX with U.S. stock futures, AI-powered", descPt: "Perp DEX de RWA com futuros de ações dos EUA, com IA" },
    { name: "Agra", url: "https://bonds.agra.gg/", desc: "Exchange for onchain credit and tokenized bonds", descPt: "Exchange de crédito onchain e títulos tokenizados" },
    { name: "OKU", url: "https://oku.trade/", desc: "DeFi aggregator on 35+ chains, 0% fees", descPt: "Agregador DeFi em 35+ chains, 0% de taxas" },
  ],
  "RWA": [
    { name: "R25", url: "https://www.r25.xyz/", desc: "Tokenizes solar & EV assets via IoT + AI (~$93M TVL, #1 on Pharos)", descPt: "Tokeniza ativos solares e de VE com IoT + IA (~$93M TVL, nº 1 da Pharos)" },
    { name: "AquaFlux", url: "https://www.aquaflux.pro", desc: "RWA yield & liquidity via tri-token model (P/C/S)", descPt: "Yield e liquidez de RWA com modelo tri-token (P/C/S)" },
    { name: "Asseto", url: "https://asseto.finance/", desc: "Next-generation on-chain RWA asset platform", descPt: "Plataforma on-chain de ativos RWA de nova geração" },
    { name: "Zona", url: "https://www.zona.finance/", desc: "Deposit RWAs and unlock idle liquidity", descPt: "Deposite RWAs e desbloqueie liquidez parada" },
  ],
  "Lending & Yield": [
    { name: "Morpho", url: "https://morpho.org/", desc: "Lending: pooled + P2P orderbook-style matching", descPt: "Lending: pools + matching P2P estilo orderbook" },
    { name: "TermMax", url: "https://app.termmax.ts.finance/earn", desc: "Fixed-rate lending & borrowing", descPt: "Empréstimos com taxa fixa" },
    { name: "Faroo", url: "https://app.faroo.xyz/", desc: "Liquid staking: PROS → stPROS with staking + RWA yield", descPt: "Liquid staking: PROS → stPROS com yield de staking + RWA" },
    { name: "Ember", url: "https://ember.so/earn", desc: "Unified vault platform tokenising yield strategies", descPt: "Plataforma de vaults que tokeniza estratégias de yield" },
  ],
  "Bridges": [
    { name: "LI.FI", url: "https://li.fi/", desc: "Bridge aggregation protocol", descPt: "Protocolo agregador de bridges" },
    { name: "Jumper", url: "https://jumper.exchange", desc: "LI.FI-powered cross-chain swap & bridge UI", descPt: "Interface cross-chain de swap e bridge (LI.FI)" },
    { name: "Chainlink CCIP", url: "https://chain.link/", desc: "Cross-chain bridge + oracle infrastructure", descPt: "Bridge cross-chain + infraestrutura de oráculos" },
    { name: "LayerZero", url: "https://layerzero.network/", desc: "Omnichain interoperability protocol", descPt: "Protocolo de interoperabilidade omnichain" },
    { name: "InterPort", url: "https://interport.fi/", desc: "Fast cross-chain swaps & bridge", descPt: "Swaps e bridge cross-chain rápidos" },
  ],
  "Stablecoins & Payments": [
    { name: "Circle", url: "https://www.circle.com/", desc: "USDC issuer — native USDC + CCTP v2 on Pharos", descPt: "Emissor do USDC — USDC nativo + CCTP v2 na Pharos" },
    { name: "Alchemy Pay", url: "https://alchemypay.org/", desc: "Fiat ↔ crypto on/off ramp", descPt: "On/off ramp fiat ↔ cripto" },
  ],
  "Wallets & Custody": [
    { name: "OKX Wallet", url: "https://web3.okx.com/", desc: "The crypto wallet for everything onchain", descPt: "Carteira cripto para tudo onchain" },
    { name: "TopNod", url: "https://topnod.com/", desc: "Self-custody wallet for RWA & digital assets", descPt: "Carteira self-custody para RWA e ativos digitais" },
    { name: "OneKey", url: "https://onekey.so/", desc: "Open-source crypto wallet", descPt: "Carteira cripto open-source" },
    { name: "KuCoin Wallet", url: "https://www.kucoin.com/web3", desc: "Web3 wallet by KuCoin", descPt: "Carteira Web3 da KuCoin" },
    { name: "Fordefi", url: "https://fordefi.com/", desc: "Institutional MPC wallet & security platform", descPt: "Carteira MPC institucional e plataforma de segurança" },
    { name: "Safe", url: "https://app.safe.global/", desc: "Smart contract multisig wallet", descPt: "Carteira multisig de smart contract" },
    { name: "Anchorage", url: "https://www.anchorage.com/", desc: "Institutional custody, staking & trading", descPt: "Custódia institucional, staking e trading" },
  ],
  "Oracles, RPC & Infra": [
    { name: "Supra", url: "https://supra.com/", desc: "Oracle infrastructure", descPt: "Infraestrutura de oráculos" },
    { name: "ZAN", url: "https://zan.top/", desc: "Web3 tools & RPC services", descPt: "Ferramentas Web3 e serviços RPC" },
    { name: "Alchemy", url: "https://www.alchemy.com/", desc: "Web3 development platform", descPt: "Plataforma de desenvolvimento Web3" },
    { name: "Nirvana", url: "https://nirvanalabs.io/", desc: "Web3 infrastructure for blockchain apps", descPt: "Infraestrutura Web3 para apps blockchain" },
    { name: "Hemera", url: "https://www.thehemera.com/", desc: "Account-centric indexing network", descPt: "Rede de indexação centrada em contas" },
    { name: "GoldSky", url: "https://goldsky.com/", desc: "Scalable blockchain indexing", descPt: "Indexação blockchain escalável" },
  ],
  "Security & Compliance": [
    { name: "Hypernative", url: "https://www.hypernative.io/", desc: "Real-time threat detection & prevention", descPt: "Detecção e prevenção de ameaças em tempo real" },
    { name: "Zellic", url: "https://www.zellic.io/", desc: "Blockchain security audits", descPt: "Auditorias de segurança blockchain" },
    { name: "ExVul", url: "https://exvul.com/", desc: "Smart contract audits & pen testing", descPt: "Auditorias de contratos e pen testing" },
    { name: "OpenZeppelin", url: "https://www.openzeppelin.com/", desc: "Crypto cybersecurity technology", descPt: "Tecnologia de cibersegurança cripto" },
    { name: "TRM", url: "https://www.trmlabs.com/", desc: "Crypto compliance & risk management (KYT)", descPt: "Compliance cripto e gestão de risco (KYT)" },
    { name: "Trusta Labs", url: "https://www.trustalabs.ai/", desc: "Web3 security & data analytics", descPt: "Segurança Web3 e análise de dados" },
  ],
  "Identity, NFT & Community": [
    { name: "PNS", url: "https://pharosname.com", desc: "Official .pharos domain name service", descPt: "Serviço oficial de domínios .pharos" },
    { name: "ZNS Connect", url: "https://zns.bio/", desc: "Web3 identity layer, multi-chain domains", descPt: "Camada de identidade Web3, domínios multi-chain" },
    { name: "Grandline", url: "https://app.grandline.world", desc: "Native NFT launch & trading platform", descPt: "Plataforma nativa de lançamento e trading de NFTs" },
    { name: "Pharosverse", url: "https://pharosverse.xyz", desc: "Ecosystem navigator: insights, projects, community", descPt: "Navegador do ecossistema: insights, projetos, comunidade" },
  ],
};

// Keyword → section mapping. Only the first 2 matches are used per query to cap token usage.
const DAPP_KEYWORDS: Array<{ keys: string[]; section: string }> = [
  { keys: ["defi protocols", "protocols on pharos", "protocols are", "quais protocolos", "que protocolos", "dapps", "dapp list", "lista de dapps", "ecosystem list", "all projects", "todos os projetos", "port.pharos.xyz/ecosystem", "o que tem na pharos", "what's on pharos", "available on pharos", "projects on pharos"], section: "port_ecosystem_directory" },
  { keys: ["partner", "parceiro", "parceria", "investor", "investidor", "backer", "vc fund", "venture", "hack vc", "lightspeed", "snz", "dispersion capital", "chorus one", "hash global", "legend star", "reforge", "mh ventures", "sumitomo", "flow traders", "quem investiu", "who invested", "funding round"], section: "pharos_partners" },
  { keys: ["r25", "vrpcw", "vrpcs", "vrpcq"], section: "r25" },
  { keys: ["agra", "oku", "oku.trade", "morpho", "termmax", "term max", "fixed rate lending", "taxa fixa", "jumper", "li.fi", "lifi", "tokenized bond", "onchain credit"], section: "dapp_profiles_trading" },
  { keys: ["asseto", "alchemy pay", "alchemypay", "on-ramp", "off-ramp", "onramp", "offramp", "comprar cripto com fiat"], section: "dapp_profiles_rwa_payments" },
  { keys: ["okx wallet", "topnod", "top nod", "onekey", "one key", "kucoin wallet", "fordefi", "safe wallet", "gnosis", "anchorage", "custódia institucional", "institutional custody", "mpc wallet"], section: "dapp_profiles_wallets" },
  { keys: ["supra", "zan.top", "zan rpc", "alchemy", "nirvana", "hemera", "goldsky", "gold sky", "subgraph", "indexer", "rpc provider", "provedor rpc"], section: "dapp_profiles_infra" },
  { keys: ["hypernative", "zellic", "exvul", "openzeppelin", "open zeppelin", "trm labs", "trusta", "audit", "auditoria", "kyt", "threat detection"], section: "dapp_profiles_security" },
  { keys: ["pns", "pharos name", ".pharos domain", "dominio .pharos", "zns", "grandline", "grand line", "pharosverse", "nft marketplace", "marketplace de nft"], section: "dapp_profiles_identity" },
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

  // ── Educational sections (DeFi / RWA / TradFi / crypto fundamentals) ──
  { keys: ["amm", "automated market maker", "constant product", "x*y=k", "pmm", "market maker math", "formador de mercado"], section: "amm" },
  { keys: ["liquidity pool", "pool de liquidez", "lp token", "tvl", "provide liquidity", "fornecer liquidez"], section: "liquidity_pools" },
  { keys: ["impermanent loss", "perda impermanente", "il "], section: "impermanent_loss" },
  { keys: ["yield farming", "liquidity mining", "real yield", "rendimento", "apr", "apy", "farming"], section: "yield_farming" },
  { keys: ["staking", "liquid staking", "lst", "restaking", "delegator", "validator", "slashing"], section: "staking_concepts" },
  { keys: ["lending", "borrow", "emprestimo", "empréstimo", "collateral", "colateral", "ltv", "health factor", "loan"], section: "lending_borrowing" },
  { keys: ["liquidation", "liquidação", "liquidacao", "liquidated", "liquidation threshold"], section: "liquidations" },
  { keys: ["stablecoin", "stable coin", "fiat-backed", "algorithmic stable", "depeg", "peg"], section: "stablecoins" },
  { keys: ["dex", "cex", "centralized exchange", "decentralized exchange", "aggregator", "agregador", "custodial"], section: "dex_cex" },
  { keys: ["mev", "sandwich", "front-run", "frontrun", "price impact", "slippage explained"], section: "mev_slippage" },
  { keys: ["concentrated liquidity", "liquidez concentrada", "tick", "v3 range", "price range", "uniswap v3"], section: "concentrated_liquidity_v3" },
  { keys: ["governance", "governança", "governanca", "dao", "voting", "proposal", "governance token"], section: "governance_dao" },
  { keys: ["wrapped", "wrapped token", "weth", "wpros", "wrap", "unwrap", "token embrulhado"], section: "wrapped_tokens" },
  { keys: ["tokenization", "tokenização", "tokenizacao", "tokenize", "tokenized asset", "spv"], section: "rwa_tokenization" },
  { keys: ["tokenized treasur", "t-bill", "tbill", "tokenized equit", "tokenized stock", "real estate token", "private credit", "drop token", "tin token", "bond token"], section: "rwa_assets" },
  { keys: ["rwa yield", "oracle", "oráculo", "oraculo", "nav", "proof of reserve", "redemption window", "counterparty"], section: "rwa_yield_oracles" },
  { keys: ["erc-4626", "erc4626", "vault standard", "tokenized vault", "share token", "cofre"], section: "erc4626_vaults" },
  { keys: ["institutional defi", "realfi", "real fi", "compliance", "kyc", "aml", "permissioned", "regulator"], section: "institutional_defi" },
  { keys: ["bond", "coupon", "cupom", "money market", "securities", "treasury yield", "tradfi instrument"], section: "tradfi_instruments" },
  { keys: ["settlement", "liquidação t+", "t+0", "t+2", "t+1", "custody", "custódia", "custodia", "clearing"], section: "tradfi_settlement" },
  { keys: ["market maker", "bid-ask", "spread", "order book", "livro de ofertas", "liquidity depth"], section: "market_makers_liquidity" },
  { keys: ["blockchain basics", "o que é blockchain", "what is blockchain", "ledger", "immutable", "decentralization"], section: "blockchain_basics" },
  { keys: ["consensus", "consenso", "proof of work", "proof of stake", "pow", "pos", "finality", "finalidade"], section: "consensus" },
  { keys: ["layer 1", "layer 2", "l1 vs l2", "l2", "rollup", "optimistic rollup", "zk rollup", "zk-rollup"], section: "l1_l2_rollups" },
  { keys: ["gas", "gas fee", "evm", "smart contract", "contrato inteligente", "solidity"], section: "gas_evm_contracts" },
  { keys: ["erc-20", "erc20", "erc-721", "erc721", "erc-1155", "erc1155", "nft standard", "token standard", "approve", "allowance"], section: "erc_standards" },
  { keys: ["wallet", "carteira", "private key", "chave privada", "seed phrase", "frase semente", "non-custodial", "metamask", "rabby"], section: "wallets_keys" },
  { keys: ["cross-chain", "cross chain", "bridge", "ponte", "layerzero", "layer zero", "oft", "cross-chain messaging"], section: "cross_chain_messaging" },
  { keys: ["realfi vision", "real world finance", "how does pharos", "por que pharos", "why pharos", "pharos vision", "pharos thesis"], section: "realfi_vision" },

  // ── Official pharos.xyz facts ──
  { keys: ["gigagas", "2 gigagas", "dual vm", "wasm", "webassembly", "asyncbft", "async bft", "speculative", "merkle tree", "page store", "storage overhead", "block time", "tps", "throughput", "1 billion users", "specs", "especificaç"], section: "pharos_tech" },
  { keys: ["zk-kyc", "zk kyc", "compliance by design", "programmable aml", "digital id", "digital identity", "compliance layer", "compliant chain"], section: "pharos_compliance" },
  { keys: ["spn", "special processing network", "appchain", "app-specific network", "cross-spn", "atomic execution"], section: "pharos_spn" },
  { keys: ["borderless", "digital financial city", "inclusive financial", "institutional-grade", "accessible to all", "instant payment", "cross-border", "use cases", "positioning"], section: "pharos_positioning" },
  { keys: ["hack vc", "faction vc", "ant digital", "ant group", "1.5 billion", "rwa exchange", "wallet addresses", "174m", "community followers", "backing", "investors", "raised", "seed round"], section: "pharos_metrics" },
  { keys: ["agent center", "developer center", "devhub", "realfi alliance", "research center", "site map", "career", "testnet site", "pharos.xyz/"], section: "pharos_site" },

  // ── Campaigns, airdrop, identity, programs ──
  { keys: ["airdrop", "claim", "snapshot", "eligib", "elegív", "elegiv", "reivindicar"], section: "airdrop" },
  { keys: ["campaign", "campanha", "world cup", "topnod", "alpha summer", "quest", "points", "pontos", "leaderboard", "rewards", "recompensa"], section: "campaigns" },
  { keys: ["pns", "name service", "pharos name", "nome pharos", ".pharos", "domain", "domínio", "ens"], section: "pns" },
  { keys: ["agent center", "install skill", "skills", "on-chain agent", "ai agent", "agentes"], section: "agent_center" },
  { keys: ["agent carnival", "ai agent carnival", "hackathon", "dorahacks", "fase 1", "fase 2", "phase 1", "phase 2", "skill hackathon", "agent arena", "50000 pros", "50k pros", "prize pool"], section: "agent_carnival" },
  { keys: ["incubator", "incubadora", "10m fund", "$10m", "dragon draper", "lightspeed", "grant", "aplicar", "milestone"], section: "pharos_incubator" },
  { keys: ["pharos port", "port.pharos.xyz", "harbor", "staking pros", "campaigns", "rewards", "port hub", "realfi hub", "portfolio", "port pharos", "palpha apy", "vrpc", "tulprwa", "melhor apy", "best apy", "rwa yield products", "onde render", "where to earn"], section: "pharos_port" },
  { keys: ["dtvm", "smartcogent", "stylus", "cargo-stylus", "concero", "gcl", "hku", "hong kong university", "scf fintech", "realfi access program", "news timeline", "linha do tempo", "noticias da pharos", "pharos news"], section: "pharos_latest" },
  { keys: ["pharos foundation", "pharosfoundation", "governance grant", "foundation grant", "community grant"], section: "pharos_foundation" },
  { keys: ["devhub", "developer hub", "dev hub", "hemera", "zan rpc", "nirvana rpc", "goldsky", "supra oracle", "fordefi", "build tools", "templates dapp", "1 gwei gas price"], section: "devhub_tools" },
  { keys: ["realfi alliance", "realfi member", "alliance member", "ember protocol", "aquaflux", "agra", "asseto", "centrifuge", "vishwa", "kun", "termmax", "avalon finance", "primus labs", "tulipa capital"], section: "realfi_alliance_full" },
  { keys: ["community member", "lighthouse keeper", "storyteller program", "pharos meetups", "312k", "community stats", "sailor", "gocto"], section: "pharos_community" },
  { keys: ["alpha summer", "pros never sleeps", "mainnet arc", "atlantic testnet anniversary", "ai agent carnival live", "faroo pre-mint", "stipros pre-mint", "rwa hybrid vault", "pre-mint"], section: "pharos_latest" },
  { keys: ["alex zhang", "ant group", "antchain", "ant digital", "founder", "fundador", "cto ant", "microsoft research", "paypal founder"], section: "pharos_team" },
  { keys: ["brand", "logo", "typography", "pp neue montreal", "helvetica neue", "color palette", "rgb 1 19 183", "0113b7", "brand kit"], section: "pharos_brand" },
  { keys: ["research report", "relatorio", "relatório", "rwa report", "tradfi", "5 questions", "decoding pharos", "yield 10%", "pos rewards", "onchain fixed income", "perps for everything"], section: "pharos_research" },
  { keys: ["morpho", "termmax", "fixed rate", "avalon finance", "avalonfinance", "tulipa", "primus"], section: "pharos_lending_extra" },
  { keys: ["research", "pesquisa", "deep dive", "whitepaper", "paper", "report"], section: "research" },
  { keys: ["kun", "termmax", "term max", "palpha", "pizza zone", "pros pixel", "pixel", "gamefi", "fixed-rate", "fixed rate"], section: "dapps_extra" },

  // ── New enriched sections from Pharos docs ──
  { keys: ["atlantic testnet", "testnet", "chain id 688689", "688689", "phrs faucet", "dplabs", "atlantic.dplabs"], section: "pharos_network_full" },
  { keys: ["l1-base", "l1-core", "l1-extension", "asyncbft", "speculative parallel", "dual vm", "wasm", "parallel execution", "modular l1", "pharos architecture"], section: "pharos_network_full" },
  { keys: ["ccip router", "chain selector", "7801139999541420232", "0x4e52", "jovay", "ccip lane", "chainlink ccip config"], section: "ccip_full" },
  { keys: ["tokenmessengerv2", "messagetransmitterv2", "cctp domain", "cctp v2", "burn limit", "domain id 31", "pharos=31"], section: "cctp_full" },
  { keys: ["layerzero", "layer zero", "stargate", "rusd", "wsrusd", "layerzero v2", "oft"], section: "layerzero_full" },
  { keys: ["canonical contract", "create2deployer", "multicall3", "gnosis safe", "permit2", "entrypoint", "erc-4337", "account abstraction", "createx"], section: "canonical_contracts_full" },
  { keys: ["x402", "http 402", "payment required", "micropayment", "per-call billing", "per call billing"], section: "x402_protocol" },
  { keys: ["anvita flow", "anvita on", "steward agent", "service agent", "flow.anvita", "agent card", "marketplace agent"], section: "anvita_flow_full" },
  { keys: ["skill engine", "pharos skill", "pharos-skill-engine", "skill.md", "skill package", "piggy bank tutorial", "simplev ault", "cast forge"], section: "pharos_skill_engine" },
  { keys: ["validator", "validador", "hardware requirement", "cpu 32 cores", "256 gb", "node version", "ulimit", "equivocation", "double voting", "epoch reward"], section: "validator_info" },
  { keys: ["gas model", "gas refund", "eip-1559", "base fee burned", "priority fee", "gas limit buffer", "out of gas", "gas 20%"], section: "gas_model_full" },

  // ── Crypto encyclopedia (broad educational coverage) ──
  { keys: ["o que é cripto", "o que e cripto", "what is crypto", "criptomoeda", "cryptocurrency", "digital asset", "ativo digital", "coin vs token", "market cap", "fdv", "circulating supply", "bitcoin", "satoshi"], section: "intro_crypto" },
  { keys: ["história do bitcoin", "historia da cripto", "crypto history", "defi summer", "ico boom", "ftx", "luna", "terra collapse", "halving", "etf bitcoin", "ciclos de mercado", "market cycle"], section: "crypto_history" },
  { keys: ["perp", "perpetual", "perpétuo", "perpetuo", "funding rate", "taxa de funding", "leverage", "alavancagem", "futuros", "futures", "long", "short", "margem", "margin trading", "perpdex", "perp dex"], section: "perp_dex" },
  { keys: ["option", "opções", "opcoes", "call", "put", "strike", "premium", "covered call", "structured product", "produto estruturado", "tranche", "pendle", "principal token", "yield token", "hedge", "derivativo", "derivative"], section: "derivatives_options" },
  { keys: ["nft", "non-fungible", "não fungível", "erc-721", "erc721", "colecionável", "collectible", "floor price", "royalt", "opensea", "soulbound", "nft-fi", "fractionaliz"], section: "nfts_full" },
  { keys: ["solana", "ethereum vs", "vs ethereum", "bnb chain", "avalanche", "polygon", "tron", "compare chains", "comparar redes", "qual rede", "which chain", "melhor blockchain", "best blockchain", "redes blockchain", "networks compared"], section: "crypto_networks" },
  { keys: ["escalabilidade", "scalability", "trilemma", "trilema", "sharding", "danksharding", "data availability", "celestia", "monad", "sealevel", "modular vs monolithic", "throughput", "tps comparison"], section: "scalability_deep" },
  { keys: ["tokenomics", "value accrual", "dividendo", "dividend", "buyback", "burn", "fee switch", "real yield", "emissão", "emissions", "unlock", "vesting", "apr vs apy", "apy vs apr", "juros compostos", "compound interest"], section: "tokenomics_value" },
  { keys: ["ai agent", "agente de ia", "agente defi", "defi agent", "autonomous agent", "agent economy", "intents", "session key", "account abstraction", "erc-4337", "machine-to-machine", "agentes autônomos"], section: "defi_agents_ai" },
  { keys: ["segurança", "seguranca", "security", "scam", "golpe", "phishing", "rug pull", "honeypot", "revoke", "allowance", "hack", "seed phrase segura", "hardware wallet", "ledger", "trezor", "proteger", "protect my"], section: "crypto_security_risk" },
  { keys: ["trading", "trade", "order book", "limit order", "stop loss", "take profit", "dca", "dollar cost", "bull market", "bear market", "altseason", "btc dominance", "análise de mercado", "market analysis", "volume"], section: "market_structure_trading" },
  { keys: ["airdrop", "points program", "programa de pontos", "farm points", "sybil", "retroactive", "retroativo", "elegibilidade"], section: "airdrops_points" },
  { keys: ["restaking", "restake", "eigenlayer", "lrt", "liquid restaking", "avs", "stpros", "st pros", "dual yield", "babylon", "stbtc", "liquid staking token"], section: "restaking_lrt" },
  { keys: ["bond", "título", "titulo", "renda fixa", "fixed income", "treasury", "tesouro", "t-bill", "coupon", "cupom", "nav", "private credit", "crédito privado", "credito privado", "money market", "duration"], section: "fixed_income_onchain" },
  { keys: ["ecossistema", "ecosystem analysis", "analisar ecossistema", "tvl quality", "avaliar rede", "evaluate chain", "métricas de rede", "network metrics", "adoption", "adoção"], section: "ecosystem_analysis" },
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
