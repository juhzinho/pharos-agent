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
