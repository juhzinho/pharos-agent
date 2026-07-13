# Anvita Managed Service Agent — skills-only mode

**Use this file when ProsPilot runs on Anvita Flow** (Developer Console → Managed Service Agent).

The Anvita sandbox runs **Skill docs + Customer Service Strategy only**. It does **NOT** call external servers.

---

## NEVER do this in Anvita sandbox

- ❌ `fetch` / HTTP to `pharos-agent-pi.vercel.app` (any `/api/*` path)
- ❌ `GET /api/info`, `/api/health`, `/api/a2a`, `/api/query`, `/api/price`, etc.
- ❌ Remote A2A callback to Vercel
- ❌ Claim a transaction was sent without user signing in their own wallet app
- ❌ Invent live tweets, campaigns, or news from training memory

**Why:** Outbound HTTP is blocked or fails → causes A2A_002 / "agent offline" errors. Answers must come from **this Skill package + Strategy**.

---

## ALWAYS do this instead

| User asks | Source in sandbox |
|-----------|-------------------|
| Ecosystem Q&A, Faroo, RWA, protocols | `SKILL.md` + `references/*` + Strategy knowledge |
| Active campaigns | **LIVE SNAPSHOT** in Customer Service Strategy only |
| Tweets / news / blog | **LIVE SNAPSHOT** in Strategy only |
| Token price | Text: "Check live price at CoinGecko PROS" OR snapshot if embedded; do not call API |
| Wallet analysis | User must **paste** `0x…` address; explain holdings conceptually OR say "full analysis at web app" |
| Swap / bridge / LP / transfer / stake | **Explain steps in text** → link user to open web app (browser), never invoke API |
| On-chain execution | Single line: "Open https://pharos-agent-pi.vercel.app/chat in your browser, connect wallet on chain 1672" |
| Developer scripts | Generate `cast`/`forge` snippet in chat (never execute) |

---

## Web app is optional (user's browser)

`https://pharos-agent-pi.vercel.app/chat` is for users who **open the link themselves** and connect MetaMask/Rabby.

- The Anvita Service Agent **does not call** that URL server-side.
- It only **mentions** the link when on-chain action is needed.

---

## Customer Service Strategy must include

1. Identity: ProsPilot, community-built, not official Pharos product
2. **NO EXTERNAL HTTP** rule (copy from this file)
3. **LIVE SNAPSHOT** block (campaigns, tweets, news) — from `references/live-snapshot.md`
4. On-chain redirect to `/chat` as user action, not server call

---

## Debug / Anvita On test phrases

- "What is Faroo unstaking?" → answer from Skill (7-day period)
- "List active campaigns" → answer from Strategy snapshot only
- "Swap 10 PROS to USDC" → explain + link to `/chat`, do not call API
- "What is Anvita Flow?" → `references/anvita-flow.md`

---

## External API (NOT for Anvita)

The HTTP API documented in `references/api-endpoints.md` is for the **standalone web app** and third-party integrators — **not** for this Managed Service Agent runtime.
