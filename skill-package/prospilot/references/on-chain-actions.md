# On-chain actions (web app — wallet required)

These skills run in the hosted chat at `https://pharos-agent-pi.vercel.app/chat`.
The user **must connect a wallet** (MetaMask, Rabby, OKX). The agent builds unsigned
transactions; the user signs each step. Mainnet only unless noted.

## 1. Swap

- **Providers:** LI.FI / Jumper (default), direct FaroSwap pool (PROS/WPROS ↔ USDC only)
- **Tokens:** PROS, WPROS, USDC, WETH, LINK, PGOLD, USDpm
- **Flow:** guided wizard OR natural language → quote comparison → sign
- **Gas:** estimated before signature

## 2. Bridge

- **Providers:** Jumper (LI.FI), Chainlink CCIP, Circle CCTP v2 (USDC from Pharos only)
- **Destinations:** Ethereum, Base, Arbitrum, Polygon, Optimism
- **CCTP:** native USDC burn/mint, no aggregator fee; Pharos domain ID 31
- **Flow:** token → amount → destination chain → route pick → sign

## 3. Add liquidity (FaroSwap V3)

- **Pair:** WPROS / USDC only
- **Fee tiers:** 0.01% (100), 0.05% (500), 0.30% (3000), 1.00% (10000) ppm
- **Range:** full range, ±X%, or custom min/max price
- **Output:** LP position NFT (ERC-721)
- **Steps:** may include WPROS wrap + USDC approvals + mint

## 4. Remove liquidity (FaroSwap V3)

- **Flow:** list user LP NFTs → pick position → 25/50/75/100% or collect fees only
- **Preflight:** ownership + liquidity checks before building calldata

## 5. View LP positions

- Read-only: shows FaroSwap V3 WPROS/USDC positions, fees, range, NFT tokenId

## 6. Stake PROS (Faroo liquid staking)

- **Min:** 0.1 PROS (+ ~0.01 PROS gas buffer)
- **Output:** stPROS (ERC-4626)
- **Steps:** wrap PROS → approve WPROS → deposit (1–3 txs)
- **Contracts:** see `assets/contracts.json` → Faroo

## 7. Unstake stPROS (Faroo)

- **Important:** `redeem()` registers a **7-day withdrawal request** (0% fee)
- **PROS is NOT instant** — claim at https://app.faroo.xyz/unstake after maturity
- **Flow:** single redeem tx in agent; user claims on Faroo site later

## 8. My staking / staking position

- Read-only: stPROS balance, NAV, estimated PROS value

## 9. Transfer / payment agent

- Send PROS or ERC-20 to one or many addresses in one prompt
- Batch: "send 1 PROS to 0xA and 2 PROS to 0xB"
- Multi-step signing for multiple recipients

## 10. ERC-20 approve

- Approve spender for fixed amount or unlimited (warn user on unlimited)

## 11. RealFi positions

- Reads ERC-4626 vaults: Faroo (stPROS, FRHV001, FYV001), Ember, R25, etc.
- Shows NAV and underlying value per protocol

## 12. Wallet analysis (view_wallet)

- Holdings, USD estimate, tx count, activity summary on Pharos mainnet

## 13. Multi-wallet aggregate

- User pastes 2+ addresses → consolidated portfolio table

## 14. Script generation (developers)

- Generates ethers v6 / viem / web3.py / Foundry snippets
- **Text only** — does not execute or handle keys

## 15. Cancel active flows

- User says "cancel" → aborts all pending wizards and unsigned cards

## Limitations

- Cannot deposit into RWA vaults (FRHV001 pre-mint UI, R25, pALPHA) — point user to dApp
- Cannot execute Stargate bridges (external: stargate.finance)
- Testnet DeFi gated off for swap/bridge/liquidity/stake on mainnet-only contracts
