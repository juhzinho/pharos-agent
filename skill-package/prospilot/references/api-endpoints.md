# HTTP API — external web app only (NOT for Anvita sandbox)

> **Anvita Managed Service Agent:** do **NOT** call these endpoints from the sandbox.
> Use `references/anvita-managed-only.md` + Customer Service Strategy + LIVE SNAPSHOT instead.
> Calling Vercel from Anvita causes connection errors (A2A_002).

The API below powers the **standalone ProsPilot web app** (`/chat`) and third-party agents — not the Anvita hosted Skill runtime.

Base URL: `https://pharos-agent-pi.vercel.app`

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

`POST /api/agent` — full web chat only (same-origin). Not for Anvita sandbox.
