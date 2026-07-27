# Security skills — ProsPilot

Four security skills differentiate ProsPilot from generic DeFi chatbots.

## 1. Sybil & bot detection
- **Ask:** "Is 0x… a bot?" / "Sybil check"
- **Signals:** burst txs, low counterparty diversity, robotic timing, funding concentration, campaign window
- **Score:** 0–100 (higher = more bot/Sybil risk) · verdicts: likely_human / mixed / likely_bot / likely_sybil
- **Managed:** explain heuristics; live gauge → `/chat` sidebar Sybil/Bot Check (any 0x address)

## 2. Link & phishing scanner
- **Ask:** "Is this link safe? https://…"
- **Signals:** typosquat, punycode, free-host drainers, redirects, 80+ official allowlist, HTML sniff
- **Score:** 0–100 (higher = more scam risk) · Official / suspicious / likely_scam
- **Managed:** warn on lookalike domains; live scan → `/chat` Link Scanner

## 3. Pre-sign risk check
- **Ask:** "Review this calldata before I sign" + `to` + `data`
- **Signals:** unlimited approve to unknown spender, unknown selector, zero address, large native value
- **Verdict:** safe / caution / high_risk / block
- **Managed:** list risk rules; live decode → `/chat` Pre-sign Risk Check

## 4. Swap safety advisor
- **Ask:** after a swap quote, or "is this swap safe?"
- **Signals:** high slippage, min receive gap, LI.FI/FaroSwap approve step, slow routes
- **Score:** 0–100 (higher = safer)
- **Managed:** explain slippage/approve; live badge → automatic on `/chat` swap quotes

## Shared rules
- Probabilistic — not legal KYC / not proof of identity
- Never ask for seed phrase
- Prefer exact approvals over unlimited; revoke.cash for cleanup
