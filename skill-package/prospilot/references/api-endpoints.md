# HTTP API skills (callable without wallet)

Base URL: `https://pharos-agent-pi.vercel.app`

Health (A2A): `GET /api/health` — returns `{ status: "online", agent, webApp }`  
Discovery: `GET /api/info`

| Skill | Method | Path | Body / query |
|-------|--------|------|--------------|
| Knowledge Q&A | POST | `/api/query` | `{ "question": "..." }` |
| Swap/bridge quote | POST | `/api/quote` | `{ action, fromToken, toToken, amount, fromChain?, toChain? }` |
| Token price | GET | `/api/price?token=pros` | tokens: pros, wpros, btc, eth, weth, usdc, link |
| Wallet profile | POST | `/api/skill/wallet-profile` | `{ "address": "0x..." }` |
| Wallet score | POST | `/api/skill/wallet-score` | `{ "address": "0x..." }` |
| Explain tx | POST | `/api/skill/explain-tx` | `{ "tx_hash": "0x..." }` |
| Campaigns | GET | `/api/campaigns` | — |
| News | GET | `/api/news` | — |
| RWA market | GET | `/api/rwa` | live rwa.xyz aggregates |
| Tx history | GET | `/api/txhistory?address=0x...&limit=10` | SocialScan |
| Network charts | GET | `/api/charts` | tx/TVL/RWA series |
| Tweets | GET | `/api/tweets` | @pharos_network archive |

Rate limit: ~20 req/min/IP. Quotes are **unsigned** — never broadcast by API.

## AI agent endpoint (same-origin web app only)

`POST /api/agent` — full conversational intent parsing, RAG, web search cascade,
deep docs (Faroo, AquaFlux, Zona, Bitverse, Pharos). Not for open external
abuse; use `/api/query` for knowledge from other agents.
