// CORE_KNOWLEDGE: ~600 tokens — included in every prompt.
// DETAILED_KNOWLEDGE: per-dapp sections, injected only when the user's message mentions that dapp.

export const CORE_KNOWLEDGE = `
=== PHAROS CORE KNOWLEDGE ===

NETWORK: Chain ID 1672 | RPC https://rpc.pharos.xyz | Explorer pharosscan.xyz
MAINNET: "Pacific Ocean" launched April 28, 2026 | 30,000 TPS | Sub-second finality | $52M funded
TOKENS: PROS (native gas+governance) | WPROS: 0x52c48d4213107b20bc583832b0d951fb9ca8f0b0 (18 dec) | USDC: 0xc879c018db60520f4355c26ed1a6d572cdac1815 (6 dec)
DOCS: docs.pharosnetwork.xyz | pharos.xyz | port.pharos.xyz/ecosystem | x.com/pharos_network

PHAROS PORT (port.pharos.xyz): Official RealFi hub — campaigns/rewards, PROS staking, bridge/swap, Harbor (curated RWA), full ecosystem directory.

TVL LEADERS: R25 ~$93M | Centrifuge ~$15M | Ember ~$13M | FaroSwap ~$695K

ECOSYSTEM (one-line summaries):
Lending: Zona (app.zona.finance) lend/borrow RWAs+crypto | Morpho institutional RWA markets | TermMax fixed-rate ERC-4626
Perp: Bitverse (app.bitverse.zone) perp DEX + US stock futures, AI-powered
DEX: FaroSwap primary DEX (DODO) V3+V2+PMM | ZentraFi AMM+launchpad | GoctoFun bonding-curve | OKX DEX | Fly DEX
Staking: Faroo (app.faroo.xyz) stake PROS→stPROS earns staking+RWA yield simultaneously
RWA: R25 tokenized vaults (VRPCW/VRPCS/VRPCQ) USDC ERC-4626 | Centrifuge credit/debt (DROP/TIN) | Ember pAlpha yield vault | AquaFlux (app.aquaflux.pro) tri-token P/C/S | Agra RWA bonds | Asseto tokenized finance
Wallets: Topnod native wallet | OKX Wallet | AlchemyPay fiat on/off-ramp
Infra: CCIP 6-token bridge (no Optimism) | LI.FI/Jumper aggregator | LayerZero V2 | Circle CCTP | Fiamma BTC bridge | Primus zkTLS | Babylon stBTC | EigenLayer stETH

KEY CONTRACTS:
FaroSwap NonfungiblePositionManager: 0xc0479219f4feba5a668cff71bf96f4ffe124c3ab
Fee tiers: 0.01%(100 PPM) | 0.05%(500) | 0.30%(3000) | 1.00%(10000)
CCIP tokens: USDC, WETH, WPROS, LINK, PGOLD, USDpm | Chains: Ethereum, Base, Arbitrum, Polygon (NOT Optimism)
Ember pAlpha vault: 0xe47e9ba4ea2320a6ed87246d02fd5c38485ed7d1

AGENT ACTIONS: swap (LI.FI) | bridge (LI.FI or CCIP) | add_liquidity (FaroSwap V3 WPROS/USDC only) | view_positions
AGENT CANNOT: deposit RWA vaults | remove liquidity | collect fees | vote | claim staking rewards
Bridge providers: ONLY Jumper (LI.FI) and Chainlink CCIP — never mention others.
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
Agent supports: swap via LI.FI routing + add concentrated liquidity to V3 WPROS/USDC pools.
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
  { keys: ["faroswap", "faro swap", "tick spacing", "fee tier", "v3 pool", "lp nft"], section: "faroswap" },
  { keys: ["ember", "palpha", "p alpha", "palpha vault", "yield optimizer"], section: "ember" },
  { keys: ["centrifuge", "drop token", "tin token"], section: "centrifuge" },
  { keys: ["rwa", "real world asset", "ativo real", "realfi", "tokenized asset"], section: "rwa" },
  { keys: ["impermanent loss", "slippage explained", "erc-4626", "erc4626", "yield farming", "liquid staking token", "lst token", "apy vs apr"], section: "defi" },
  { keys: ["ccip", "chainlink ccip", "pgold", "usdpm"], section: "ccip" },
  { keys: ["pros token", "tokenomics", "token allocation", "pros vesting", "staking inflation"], section: "pros" },
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
