---
name: pharos-agent
description: >-
  Complete AI DeFi copilot for Pharos Network (chain 1672): swap, bridge, FaroSwap V3
  liquidity, Faroo staking, wallet intelligence, RealFi positions, RWA market data,
  ecosystem knowledge (RAG + web search), tx history, price alerts, payments, and
  developer script generation. Non-custodial — users sign in their own wallet.
---

# Pharos Agent — Complete Skill Package

**Web app:** https://pharos-agent-pi.vercel.app/chat  
**API base:** https://pharos-agent-pi.vercel.app  
**Network:** Pharos Mainnet · Chain ID **1672** · PROS native gas  
**Security:** Never request seed phrases or private keys. Never claim a tx executed without a hash.

Deep references: `references/on-chain-actions.md`, `references/api-endpoints.md`, `references/live-snapshot.md`  
Assets: `assets/tokens.json`, `assets/networks.json`, `assets/contracts.json`

---

## Client interaction flow (all skills)

1. **Detect intent** from natural language (30+ languages). Infer context from prior turns.
2. **Clarify** with at most **one** question if a required field is missing (amount, token, chain, address, tx hash).
3. **Route** to the skill below — API call for read-only data; web wallet flow for on-chain actions.
4. **Preflight** on-chain builds: balance, allowance, ownership, gas estimate when applicable.
5. **Deliver** markdown answer + structured data. For txs: "Review and sign in your wallet" — never say "done/sent" before signature.
6. **Cancel:** user says `cancel` / `cancelar` → abort all pending wizards and unsigned cards.

---

## Complete skill catalog

### A — Knowledge & discovery

| # | Skill | Triggers | Execution | Delivery |
|---|-------|----------|-----------|----------|
| A1 | **Ecosystem Q&A** | "what is Faroo", "explain RWA", any Pharos question | `POST /api/query` or web `/api/agent` + RAG | Markdown + `sources[]` citations |
| A2 | **dApp directory** | "list dapps", "42 protocols", partners | Local knowledge fast-path | Numbered list with links |
| A3 | **Live web search** | news, recent events, TVL updates | Tavily → Google → Brave → DuckDuckGo cascade | Summary + source links |
| A4 | **Deep protocol docs** | technical Faroo/AquaFlux/Zona/Bitverse | `?ask=` doc endpoints via agent | Precise technical answer |
| A5 | **Explain transaction** | paste `0x` + 64 hex hash | `POST /api/skill/explain-tx` | Plain-language steps + explorer link |
| A6 | **Campaigns tracker** | "active campaigns", "rewards" | `GET /api/campaigns` | Table with dates + URLs |
| A7 | **Pharos news** | "latest news", "announcements" | `GET /api/news` | Headlines + dates |
| A8 | **X / Twitter feed** | "what did Pharos post" | **MUST** `GET /api/tweets` — never invent tweets from memory | Dated tweet list with live URLs |
| A9 | **Network charts** | "tx volume", "network stats" | `GET /api/charts` | Time series + RWA harbor TVL |
| A10 | **Global RWA market** | "RWA market", "mercado rwa" | `GET /api/rwa` | rwa.xyz live aggregates |
| A11 | **Developer scripts** | "generate cast script", "ethers snippet" | Agent `generate_script` action | Code block (never executes) |

### B — Market data

| # | Skill | Triggers | Execution | Delivery |
|---|-------|----------|-----------|----------|
| B1 | **Live token price** | "price of PROS", "quanto vale" | `GET /api/price?token=` | USD price, 24h %, mcap, volume |
| B2 | **Price chart UI** | after price query in web app | CoinGecko + interactive chart card | Chart + CEX links |
| B3 | **Price alerts** | "alert me when PROS above 0.10" | Client localStorage + 60s poll | Browser notification + chat msg |

Supported price tokens: `pros`, `wpros`, `btc`, `eth`, `weth`, `usdc`, `link`.

### C — Wallet intelligence (read-only)

| # | Skill | Triggers | Execution | Delivery |
|---|-------|----------|-----------|----------|
| C1 | **Wallet profile** | "analyze my wallet", holdings | `POST /api/skill/wallet-profile` | Holdings table, USD total, tags |
| C2 | **Wallet score** | "wallet score", "my score" | `POST /api/skill/wallet-score` | 0–100 gauge, 6 categories, badges |
| C3 | **Wallet analysis** | "what do I hold", view_wallet | On-chain read via web | Portfolio + tx count |
| C4 | **Multi-wallet aggregate** | 2+ addresses in one message | Sequential RPC reads | Consolidated table |
| C5 | **RealFi positions** | "RealFi", "my vaults" | ERC-4626 reads (Faroo, Ember, R25…) | Per-protocol NAV table |
| C6 | **Transaction history** | "my last txs", "minhas transações" | `GET /api/txhistory?address=` | Last 10 txs + explorer links |
| C7 | **LP positions view** | "my positions", "my LP" | FaroSwap V3 NFT indexer | Position cards with fees |

### D — Swap

| # | Skill | Triggers | Inputs | Execution |
|---|-------|----------|--------|-----------|
| D1 | **Swap quote (API)** | external agent needs quote | fromToken, toToken, amount | `POST /api/quote` action=swap |
| D2 | **Swap execute (web)** | "swap 10 PROS to USDC" | amount, tokens; wallet connected | Guided wizard → LI.FI or FaroSwap direct → sign |
| D3 | **Swap route choice** | compare providers | — | Side-by-side quotes, best return marked |
| D4 | **FaroSwap direct** | "swap via faroswap" | PROS/WPROS ↔ USDC only | Direct pool routing |

Tokens: PROS, WPROS, USDC, WETH, LINK, PGOLD, USDpm.

### E — Bridge

| # | Skill | Triggers | Inputs | Execution |
|---|-------|----------|--------|-----------|
| E1 | **Bridge quote (API)** | quote only | token, amount, toChain | `POST /api/quote` action=bridge |
| E2 | **Bridge execute (web)** | "bridge USDC to Base" | token, amount, dest chain | Wizard → provider pick |
| E3 | **Jumper / LI.FI** | default aggregator | — | Multi-hop routes |
| E4 | **Chainlink CCIP** | "via ccip", "chainlink" | — | CCIP Router 0x8078… |
| E5 | **Circle CCTP v2** | "cctp", "circle", USDC | USDC from Pharos only | Native burn/mint, domain 31 |

Chains: Ethereum, Base, Arbitrum, Polygon, Optimism.  
**Not supported in-app:** Stargate (use stargate.finance externally).

### F — Liquidity (FaroSwap V3)

| # | Skill | Triggers | Inputs | Execution |
|---|-------|----------|--------|-----------|
| F1 | **Add liquidity** | "add liquidity", "add pool" | fee tier, range, WPROS amount | Multi-tx: wrap/approve/mint NFT |
| F2 | **Remove liquidity** | "remove liquidity", "exit pool" | pick NFT, % 25–100 | Decrease + collect (+ burn if 100%) |
| F3 | **Preflight checks** | — | — | Balance, allowance, position ownership rebuild |

Pair: **WPROS / USDC** only. Fee tiers: 0.01%, 0.05%, 0.30%, 1.00%.

### G — Faroo liquid staking

| # | Skill | Triggers | Inputs | Execution |
|---|-------|----------|--------|-----------|
| G1 | **Stake PROS → stPROS** | "stake", quick action | min **0.1 PROS**; % or custom amount | 1–3 txs: wrap, approve, deposit |
| G2 | **Unstake stPROS** | "unstake" | stPROS amount | **1 tx:** redeem request |
| G3 | **Claim PROS after unstake** | after 7 days | — | User claims at **app.faroo.xyz/unstake** (not instant in agent) |
| G4 | **My staking** | "my stake", "meu staking" | wallet | stPROS balance, NAV, PROS value |

**Unstake period: 7 days, 0% fee** (Faroo). Agent must warn user PROS is not immediate.

Contracts: stPROS `0x6b0a…5ec4`, WPROS `0x52c4…f0b0` — see `assets/contracts.json`.

### H — Payments & approvals

| # | Skill | Triggers | Inputs | Execution |
|---|-------|----------|--------|-----------|
| H1 | **Transfer / pay** | "send 1 PROS to 0x…" | to, amount, token | Build + sequential sign |
| H2 | **Batch transfer** | multiple recipients | transfers[] | One card, multiple txs |
| H3 | **ERC-20 approve** | "approve USDC for 0x…" | token, spender, amount/unlimited | Single approve tx + risk note |

### I — UX & session (web app)

| # | Skill | Description |
|---|-------|-------------|
| I1 | **Wallet gate** | Chat locked until wallet connected |
| I2 | **Multilingual UI** | EN, PT, ES, RU, ZH, JA, AR site strings |
| I3 | **Chat history** | localStorage conversations sidebar |
| I4 | **Gas estimation** | ~PROS fee shown before every tx card |
| I5 | **Account switch refresh** | Invalidates stale cards on wallet change |
| I6 | **Streaming-style replies** | Progressive text + staged "Thinking" status |
| I7 | **PWA** | Installable via manifest + service worker |

---

## Detailed execution instructions

### Read-only API pattern

```http
GET  https://pharos-agent-pi.vercel.app/api/info
POST https://pharos-agent-pi.vercel.app/api/query
     Content-Type: application/json
     {"question":"How does Faroo unstaking work?"}
```

Full endpoint list: `references/api-endpoints.md`.

### On-chain pattern (web)

1. User opens `/chat` and connects wallet on Pharos Mainnet (1672).
2. User triggers skill via natural language or sidebar quick action.
3. Agent builds unsigned calldata (+ value) with live balance checks.
4. User signs in MetaMask/Rabby/OKX; agent waits for receipt between multi-step flows.
5. Success message includes explorer link; never invent tx hash.

### Quote-only pattern (API integrators)

```json
POST /api/quote
{
  "action": "bridge",
  "fromToken": "USDC",
  "toToken": "USDC",
  "amount": 100,
  "fromChain": "Pharos",
  "toChain": "Base"
}
```

Returns LI.FI quote JSON with `transactionRequest` — **unsigned**.

---

## Delivery standards and output format

| Output type | Format |
|-------------|--------|
| Knowledge | Markdown paragraphs, optional tables, `sources` when grounded |
| Prices | `SYMBOL $X.XX (+Y.Y%) · MCap · Vol · timestamp` |
| Quotes | Input/output amounts, route, ETA, **unsigned** disclaimer |
| Wallet intel | Tables: symbol, balance, USD; score gauge 0–100 |
| On-chain cards | Amount in/out, step list, gas line, purple/blue action button |
| Errors | Friendly revert translation (PT/EN); suggest fix or explorer |
| Unstake | **Always** mention 7-day Faroo period + claim URL |

**Languages:** Match user (PT-BR default for Portuguese). Agent LLM supports 30+ languages.

---

## Example tasks (copy for Agent Card)

- Swap 5 PROS to USDC on Pharos  
- Bridge 100 USDC from Pharos to Base via CCTP  
- Add liquidity WPROS/USDC 0.30% full range  
- Remove 50% of my FaroSwap LP position  
- Stake 1 PROS on Faroo  
- Unstake 0.5 stPROS (7-day period)  
- What is the price of PROS?  
- Analyze wallet 0x…  
- Explain tx 0x…  
- Show my last 10 transactions  
- RWA global market data  
- List all Pharos DeFi protocols  
- Generate Foundry script to read ERC-20 balance  

---

## What this agent cannot do

- Sign or broadcast transactions server-side  
- Access private keys / seed phrases  
- Deposit into Faroo pre-mint vault (FRHV001) or Ember/R25 vaults — redirect to dApp  
- Execute Stargate / LayerZero bridges in-app  
- Guarantee instant unstake (Faroo 7-day queue)  
- Track bridge tx status in real time — use explorer  

---

## Verification script

```bash
node scripts/verify-service.mjs https://pharos-agent-pi.vercel.app
```

---

## Rate limits & SLA

- ~20 requests/min/IP on public API routes  
- Knowledge: 1–5 s · Quotes: 2–8 s · Wallet reads: 2–10 s  
- Uptime target: Vercel serverless (production deployment)
