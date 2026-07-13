# Anvita Flow — complete reference (ProsPilot)

Use this file when users ask about Anvita Flow, Anvita On, publishing Service Agents,
the debugger, x402, Steward vs Service agents, or the Agent Carnival hackathon.

Official Pharos publish guide: https://docs.pharos.xyz/tooling-and-infrastructure/overview/publish-skill-af

---

## What is Anvita?

**Anvita** is Ant Digital Technologies' (Ant Group) brand for on-chain AI infrastructure.

| Product | Audience | Purpose |
|---------|----------|---------|
| **Anvita TaaS** | Institutions / enterprises | Tokenization-as-a-Service — RWA issuance, custody, treasury |
| **Anvita Flow** | Individuals & developers | Agent collaboration marketplace — register, discover, call, pay |

**Anvita Flow** launched **March 31, 2026** (Real Up summit, Cannes). It lets developers
convert **Pharos Skills** into hosted **Service Agents** that other agents (and humans via
**Steward Agents**) can discover and call. Payments settle via **x402** (USDC micropayments).

---

## Core concepts

| Term | Definition |
|------|------------|
| **Skill** | Packaged capability module (`SKILL.md` + optional `scripts/`, `references/`, `assets/`) |
| **Service Agent** | Hosted runtime wrapping ONE Skill — published to Marketplace, callable by others |
| **Steward Agent** | User's personal AI assistant (**Anvita On**) — searches Marketplace and delegates tasks |
| **Agent Card** | Public listing: name, intro, capabilities, example tasks, price, duration |
| **Marketplace** | Registry of published Service Agents |
| **Customer Service Strategy** | Free-text instructions: how the Service Agent understands requests, asks follow-ups, delivers |
| **Managed Service Agent** | Cloud-hosted agent created in Developer Console (vs local Skill Engine CLI) |
| **Agent wallet** | Auto-generated per published Service Agent — for **x402 earnings** (beta), not end-user signing |

---

## URLs (bookmark these)

| Resource | URL |
|----------|-----|
| Home / register | https://flow.anvita.xyz/home |
| Anvita On chat (Steward) | https://flow.anvita.xyz/agent/chat |
| Developer Console | https://flow.anvita.xyz/service-agents |
| Dashboard / agent wallet | https://flow.anvita.xyz/dashboard |
| Anvita Cyber Cup | https://flow.anvita.xyz/activities/cyber-cup |
| Publish guide (Pharos docs) | https://docs.pharos.xyz/tooling-and-infrastructure/overview/publish-skill-af |
| ProsPilot web app | https://pharos-agent-pi.vercel.app/chat |
| ProsPilot API | https://pharos-agent-pi.vercel.app |

---

## Call flow (after publish)

```
User request in Anvita On (flow.anvita.xyz/agent/chat)
        ↓
Steward Agent searches Marketplace
        ↓
Steward calls your Service Agent
        ↓
Hosted runtime runs Skill + Customer Service Strategy
        ↓
Result returned to Steward → user
        ↓
Optional: x402 USDC settlement per call (if price ≠ Free)
```

**Test your own agent:** In Anvita On, say:
> "Go find [your service agent name] to do [task] for me"

---

## Publishing a Service Agent (step by step)

1. **Prepare Skill package** — folder `your-skill/` with uppercase `SKILL.md` at root
2. **Frontmatter** — `name:` must match folder name exactly (case-sensitive)
3. **Zip the folder** — top level of zip must be `your-skill/`, NOT loose files
4. Register at https://flow.anvita.xyz/home (one account = user + developer)
5. Open https://flow.anvita.xyz/service-agents → **Create A Managed Service Agent**
6. **Upload** zip — wait for structure check pass
7. **Customer Service Strategy** — routing, security, live-data fallback, on-chain redirect rules
8. **Runtime config** — max concurrent sessions, max single execution time
9. **Debug** — at least one end-to-end test from Steward perspective
10. **Publish** — fill Agent Card (name, intro, capabilities, ≥2 example tasks, deliverables, duration, price)
11. Set price to **Free** during beta (paid USDC can cause call failures)
12. Optional: enable wallet at https://flow.anvita.xyz/dashboard for future earnings

### ZIP rules (common failures)

| Error | Fix |
|-------|-----|
| Missing SKILL.md | Add `SKILL.md` (uppercase S) at package root |
| skill.md not recognized | Rename to `SKILL.md` |
| Wrong zip structure | Zip the **folder**, not files inside |
| Frontmatter mismatch | `name: pharos-agent` = folder `pharos-agent/` |
| No permission in console | Contact Pharos team for allowlist |

---

## Debugger — what works vs what does NOT

The **Debug tab** simulates a **client Agent** calling your Service Agent. The hosted
runtime is a **text/LLM sandbox** — not a full browser with MetaMask/Rabby.

### ✅ Works in debugger

- Ecosystem Q&A, Faroo/FaroSwap explanations
- Wallet analysis when user **pastes** `0x…` address (read-only RPC logic in Strategy)
- Token prices, RWA market concepts (or LIVE SNAPSHOT in Strategy)
- Swap/bridge **quotes and instructions** (text only)
- Foundry/`cast` script generation (never executes)
- Campaign/news/tweets via **embedded LIVE SNAPSHOT** (sandbox often blocks outbound HTTP)
- Routing: "connect wallet at /chat to sign"

### ❌ Does NOT work in debugger

- **User wallet signing** — no passport/wallet popup, no MetaMask integration
- **Executing** swap, bridge, liquidity, transfer, stake on-chain
- **Outbound HTTP** to external APIs (often blocked — use Strategy snapshot fallback)
- **Private keys** — never supported (non-custodial design)

### Where on-chain actions actually run

| Method | When to use |
|--------|-------------|
| **ProsPilot web app** | End users connect Rabby/MetaMask and sign at `/chat` |
| **Skill Engine local** | Developer runs `cast`/`forge` with `$PRIVATE_KEY` in terminal |
| **Anvita agent wallet** | x402 revenue to Service Agent publisher — NOT user transaction signing |

**Hackathon demo tip:** Use debugger for Q&A + guided flows; use **web app screenshots** for on-chain Sample Work.

---

## x402 protocol (payments)

- Repurposes HTTP **402 Payment Required** for machine-to-machine payments
- Co-developed by **Coinbase** and **Cloudflare**
- Flow: agent requests resource → server returns 402 + payment instructions → agent pays **USDC** on-chain → retries with cryptographic proof
- Sub-cent transactions, no subscriptions or credit cards
- On Pharos: settlement layer for Anvita Flow Service Agent billing
- Docs: https://docs.pharos.xyz/developer-guide/x402
- **Beta:** set Service Agent price to **Free** to avoid call failures

---

## ProsPilot on Anvita Flow (managed — skills only)

**Service type:** Text copilot in Anvita sandbox — Skill + Customer Service Strategy.

### Runs in Anvita sandbox (no HTTP)

- Ecosystem Q&A from Skill docs
- Campaigns / tweets / news from **LIVE SNAPSHOT** in Strategy
- Swap/bridge/LP/stake **instructions** (text)
- Anvita / x402 / publish FAQ
- `cast`/`forge` script generation (never executes)

### User opens separately (browser link — not a server call)

- Full wallet connect + on-chain sign at https://pharos-agent-pi.vercel.app/chat

### Strategy must include

1. **NO EXTERNAL HTTP** — see `references/anvita-managed-only.md`
2. **LIVE SNAPSHOT** for campaigns/tweets/news
3. **On-chain redirect** — link to `/chat`, never claim tx executed in sandbox
4. **Unstake** — 7-day Faroo period + claim at app.faroo.xyz/unstake

### Do NOT register remote A2A URL to Vercel

This agent is **managed-only**. Marketplace calls should use Anvita's hosted runtime, not `pharos-agent-pi.vercel.app/api/a2a`.

---

## Agent Carnival / hackathon (Pharos × Anvita)

- Page: https://www.pharos.xyz/agent-carnival | https://port.pharos.xyz/agent-carnival
- Theme: "Create Like a PRO" — Skill-to-Agent dual cascade
- **Skill** = reusable module | **Agent** = full assistant on Anvita Flow
- Phase 2 agents should compose Phase 1 validated Skills
- Anvita Flow = one-click Skill → Service Agent deployment
- Prizes in PROS to registered wallet

---

## A2A (agent-to-agent)

- Agents discover each other in Marketplace
- Steward Agents orchestrate multi-step tasks across Service Agents
- x402 enables paid capability sharing between agents
- Compatible frameworks mentioned: OpenClaw, Claude Code, Open Code
- Local or cloud hosting supported for agent development

---

## FAQ (short answers)

**Q: Why is there no wallet in the debugger?**  
A: Service Agent sandbox is LLM-only. User signing happens in the web app or local Skill Engine.

**Q: Can I demo swap in debug?**  
A: Explain steps + quote logic; tell user to open `/chat` to sign. Show screenshot in Sample Work.

**Q: Same account for user and developer?**  
A: Yes — one Anvita Flow account covers Steward (user) and Service Agent (developer).

**Q: "Add Agent" on chat page?**  
A: Creates a **personal Steward Agent** — NOT the same as publishing a Service Agent. Use Developer Console instead.

**Q: How do other agents call ProsPilot?**  
A: After publish, Steward searches Marketplace or user says "find prospilot to …"
