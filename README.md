# Pharos Agent

AI DeFi copilot built for the [Pharos Network](https://pharos.xyz). Natural-language swaps, bidirectional bridging (Jumper/LI.FI + Chainlink CCIP), FaroSwap V3 concentrated liquidity, LP position tracking, deep Pharos ecosystem knowledge, live X/web search via Grok, multilingual (EN/PT and more).

## Features

- **Swap** tokens on Pharos via LI.FI routing
- **Bridge** to/from Ethereum, Base, Arbitrum, Polygon, Optimism (Jumper or Chainlink CCIP)
- **Add liquidity** to FaroSwap V3 WPROS/USDC concentrated liquidity pools
- **View positions** — your FaroSwap V3 LP NFTs with fee accrual and range status
- **Pharos ecosystem knowledge** — R25, Faroo, Zona, AquaFlux, Bitverse, Ember, Centrifuge and more
- **Live X/web search** — Grok searches @pharos_network and the web in real time
- **Multi-provider AI cascade** for maximum uptime

## Tech Stack

- **Framework**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Wallet**: ethers v6, EIP-1193 (MetaMask, Rabby, OKX Wallet)
- **Swap/Bridge**: LI.FI SDK, Chainlink CCIP
- **DEX**: FaroSwap V3 (DODO-based, Uniswap V3-compatible)
- **AI cascade**: Grok (xAI, live X search) → OpenAI (gpt-4o-mini) → GitHub Models (GPT-4o) → Cerebras → Gemini → Groq
- **Web search**: Tavily

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/pharos-agent
cd pharos-agent
npm install
```

Create `.env.local` with your own API keys (never commit this file).

**These are server-side keys** — they are used only in API routes (`app/api/*`) and the
AI cascade, which run on the server. **Do NOT prefix them with `NEXT_PUBLIC_`**: that would
inline the secret into the browser bundle and leak it to every visitor. On Vercel, add
these same names under Project → Settings → Environment Variables.

```
XAI_API_KEY=
OPENAI_API_KEY=
GITHUB_TOKEN=
CEREBRAS_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
TAVILY_API_KEY=
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Security

- **Non-custodial**: the agent never handles private keys or seed phrases
- Every transaction is proposed by the AI and signed by the user in their own wallet (MetaMask/Rabby/OKX)
- `.env.local` is git-ignored — API keys are never committed

## Pharos Network

- Chain ID: 1672 | RPC: `https://rpc.pharos.xyz`
- Explorer: [pharosscan.xyz](https://pharosscan.xyz)
- Ecosystem portal: [port.pharos.xyz](https://port.pharos.xyz)
