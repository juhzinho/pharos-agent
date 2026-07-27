# ProsPilot — Comparative (Anvita Flow marketplace)

Package version: **v3.0-security** · Build date: **2026-07-26**

## 1. Package evolution (before → after)

| Area | Old zip (v2.7-ultra) | New zip (v3.0-security) |
|------|----------------------|-------------------------|
| Skill count in catalog | ~12 DeFi-only | **21** (DeFi + intel + security) |
| Sybil / bot | ❌ | ✅ Phases 1–4 (web live) |
| Link / phishing | ❌ | ✅ Web3 allowlist + rescan |
| Pre-sign risk | ❌ | ✅ Calldata decode before sign |
| Swap safety | ❌ | ✅ Slippage / min receive / approve |
| Web3 briefings | Partial | ✅ DeFi · L2 · Security · Reg · Airdrops |
| Faroo anti-hallucination | ✅ | ✅ Strengthened |
| Managed = no HTTP | ✅ | ✅ |
| Interaction Guide | 12 lines | Full 21-skill list |

## 2. ProsPilot vs typical marketplace agents

| Capability | Generic LLM agent | DeFi-only agent | **ProsPilot** |
|------------|-------------------|-----------------|---------------|
| Pharos chain knowledge (1672) | Weak | Medium | **Strong** |
| Guided swap / bridge / stake | ❌ or vague | ✅ | ✅ + dual route (LI.FI + FaroSwap) |
| Faroo staking accuracy | Often wrong (search engine) | Maybe | **Hard-locked** |
| Sybil / farm detection | ❌ | Rare | ✅ |
| Phishing link scan | ❌ | Rare | ✅ |
| Pre-sign calldata risk | ❌ | Rare | ✅ |
| Swap safety score | ❌ | Rare | ✅ |
| Non-custodial (user signs) | Varies | ✅ | ✅ |
| Anvita Managed skills-only | Varies | Varies | ✅ |
| NFT / DAO spam | Often | Often | **Excluded** by design |

## 3. Positioning statement (Agent Card)

> ProsPilot is the Pharos DeFi copilot with a **security layer**: Sybil/bot heuristics, phishing link scanning, pre-sign calldata checks, and swap safety scoring — plus swap, bridge, LP, and Faroo staking. Community-built. Non-custodial. Chain 1672.

## 4. Why this zip for Anvita

1. **Steward-ready Q&A** — Faroo, campaigns, chain ID, RPC from Skill/Strategy (no HTTP timeout).
2. **Conversion to web** — security + DeFi actions deep-link to `/chat` where wallet exists.
3. **Marketplace differentiation** — security stack is the comparative advantage vs copycat Pharos bots.
4. **Compliance** — disclaimer + no seed phrases + Free beta pricing recommended.

## 5. Upload checklist

1. Paste Strategy from `references/anvita-strategy-complete.txt`
2. Paste Interaction Guide from package root `../interaction-guide.txt` (or Console skills list)
3. Upload **`prospilot.zip`** (folder `prospilot/` with `SKILL.md`)
4. Debug: `What is Faroo?` → staking answer
5. Debug: `Is this link safe?` → phishing guidance + `/chat`
6. Publish · Price **Free** (beta)
