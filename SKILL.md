---
name: pharos-agent
description: AI DeFi copilot for Pharos Network — answers any question about the Pharos ecosystem, retrieves live token prices, and builds unsigned swap/bridge quotes for PROS, USDC, WETH, LINK and more on Pharos mainnet (chain ID 1672).
---

# Pharos Agent

Pharos Agent is the dedicated AI copilot for [Pharos Network](https://pharos.xyz) — the RealFi blockchain (chain ID 1672, "Pacific Ocean" mainnet).

It provides three core services callable by any Agent:

1. **Ecosystem Knowledge** — RAG-grounded answers about the Pharos ecosystem, protocols, RWA, DeFi concepts, and on-chain data, with source citations.
2. **Live Token Prices** — Real-time price, market cap, 24h change, and volume for PROS, WPROS, USDC, WETH, LINK (via CoinGecko).
3. **Swap / Bridge Quotes** — Read-only LI.FI quotes for swapping tokens on Pharos or bridging to Ethereum, Base, Arbitrum, Polygon, Optimism. Returns unsigned transaction data — the user signs in their own wallet.

---

## Capabilities

### 1. Knowledge Query (`POST /api/query`)

Ask anything about:
- Pharos Network architecture, RWA, RealFi, consensus, tokenomics
- Ecosystem protocols: FaroSwap V3, Faroo (liquid staking / stPROS), AquaFlux (yield vaults), Zona (lending), Bitverse (DEX), R25 (RWA)
- DeFi concepts: impermanent loss, concentrated liquidity, AMM, LSTs, ERC-4626, CCIP, CCTP
- Campaigns, ecosystem portal (port.pharos.xyz), official docs

**Request:**
```json
{
  "question": "What is stPROS and how does Faroo liquid staking work?"
}
```

**Response:**
```json
{
  "answer": "stPROS is Faroo's liquid staking token...",
  "sources": [{ "name": "Faroo — Liquid Staking" }],
  "foundInKnowledge": true
}
```

---

### 2. Token Price (`GET /api/price?token=pros`)

Get live price data for supported tokens.

**Supported tokens:** `pros`, `wpros`, `btc`, `eth`, `weth`, `usdc`, `link`

**Request:**
```
GET /api/price?token=pros
```

**Response:**
```json
{
  "token": "pros",
  "priceUsd": 0.0821,
  "marketCap": 82100000,
  "change24h": 3.42,
  "volume24h": 1250000,
  "source": "CoinGecko",
  "timestamp": "2026-07-04T20:00:00.000Z"
}
```

---

### 3. Swap / Bridge Quote (`POST /api/quote`)

Get a read-only LI.FI quote for a swap on Pharos or a bridge to another chain.

**Supported actions:** `swap`, `bridge`  
**Supported tokens:** `PROS`, `WPROS`, `USDC`, `WETH`, `LINK`, `PGOLD`, `USDpm`  
**Supported chains:** `Pharos`, `Ethereum`, `Base`, `Arbitrum`, `Polygon`, `Optimism`

**Request (swap):**
```json
{
  "action": "swap",
  "fromToken": "PROS",
  "toToken": "USDC",
  "amount": 10,
  "fromChain": "Pharos"
}
```

**Request (bridge):**
```json
{
  "action": "bridge",
  "fromToken": "USDC",
  "toToken": "USDC",
  "amount": 50,
  "fromChain": "Pharos",
  "toChain": "Base"
}
```

**Response:** LI.FI quote JSON with `estimate.toAmount`, `estimate.executionDuration`, and `transactionRequest` (unsigned — user signs in their own wallet).

---

### 4. Discovery (`GET /api/info`)

Returns the full capability manifest of this agent.

```
GET /api/info
```

---

## What This Agent Does NOT Do

- **No transaction signing** — all quotes are unsigned. The end user always signs in their own wallet (MetaMask, Rabby, OKX).
- **No private key handling** — this agent is fully non-custodial by design.
- **No real-time TVL/APY data** — use defillama.com/chain/pharos for live pool metrics.
- **No on-chain state writes** — read-only for all queries.

---

## Example Tasks

- "What protocols are available on Pharos Network?"
- "How does concentrated liquidity work on FaroSwap?"
- "What is the current price of PROS?"
- "Give me a swap quote for 5 PROS to USDC on Pharos"
- "Get a bridge quote to send 100 USDC from Pharos to Base"
- "What is RWA and why does Pharos focus on it?"
- "How does stPROS staking work with Faroo?"
- "What are the FaroSwap fee tiers?"

---

## Information Required from Caller

| Task | Required Input |
|------|---------------|
| Knowledge query | Natural language question (any language) |
| Token price | Token symbol (`pros`, `usdc`, `eth`, etc.) |
| Swap quote | `fromToken`, `toToken`, `amount` |
| Bridge quote | `fromToken`, `toToken`, `amount`, `toChain` |

---

## Deliverables

- **Knowledge queries:** Markdown-formatted answer with source citations from the Pharos knowledge base
- **Token prices:** Structured JSON with price, market cap, 24h change, volume
- **Swap/Bridge quotes:** Full LI.FI quote JSON with estimated output amount and unsigned transaction data

---

## Estimated Execution Duration

- Knowledge query: 1–3 seconds
- Token price: < 1 second (60s cache)
- Swap/bridge quote: 2–5 seconds (LI.FI routing)

---

## Rate Limits

- 20 requests per minute per IP
- Max request body: 2000 characters per question

---

## Security

- Non-custodial: never touches private keys or seed phrases
- No transaction broadcasting — quotes only
- Same-origin guard on sensitive routes (AI processing stays server-side)
