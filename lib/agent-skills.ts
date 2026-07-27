// ProsPilot capability skills — mirrors SafeHands Interaction Guide scope
// (wallets … staking) excluding x402 payment intents and tx-hash forensics.

import { AGENT_INTERACTION_GUIDE, AGENT_INTERACTION_GUIDE_PT } from "@/lib/branding";

export type SkillWebAction =
  | "wallet"
  | "score"
  | "positions"
  | "swap"
  | "bridge"
  | "transfer"
  | "stake"
  | "mystake"
  | "realfi"
  | "liquidity"
  | "txhistory"
  | "rwamarket"
  | "approve"
  | "allowance"
  | "web3radar"
  | "sybil"
  | "linkscan"
  | "presign";

export interface ProsPilotSkill {
  id: string;
  nameEn: string;
  namePt: string;
  descEn: string;
  descPt: string;
  tags: string[];
  examples: string[];
  webAction?: SkillWebAction;
  starterPrompt?: { en: string; pt: string };
}

/** Ordered skill list — each maps to a working web / groq flow. */
export const PROSPILOT_SKILLS: ProsPilotSkill[] = [
  {
    id: "inspect-wallets",
    nameEn: "Wallet inspection",
    namePt: "Inspeção de carteiras",
    descEn: "Read-only holdings, USD totals, tags and activity heuristics for a connected or pasted wallet.",
    descPt: "Holdings somente leitura, total em USD, tags e heurísticas de atividade para carteira conectada ou colada.",
    tags: ["wallet", "analysis", "read-only"],
    examples: ["Analyze my wallet", "What do I hold?"],
    webAction: "wallet",
  },
  {
    id: "wallet-score",
    nameEn: "Wallet score",
    namePt: "Score da carteira",
    descEn: "0–100 Pharos wallet score with 6 categories, level badge, protocols, and activity flags.",
    descPt: "Score 0–100 da carteira Pharos com 6 categorias, badge de nível, protocolos e flags de atividade.",
    tags: ["wallet", "score", "intel", "read-only"],
    examples: ["Wallet score", "My score", "Score for 0x…"],
    webAction: "score",
  },
  {
    id: "inspect-tokens",
    nameEn: "Token inspection",
    namePt: "Inspeção de tokens",
    descEn: "Balances per token and LP / RealFi token exposure on Pharos.",
    descPt: "Saldos por token e exposição LP / RealFi na Pharos.",
    tags: ["tokens", "balance"],
    examples: ["What tokens do I hold?", "Show my balances"],
    webAction: "wallet",
    starterPrompt: { en: "Show my token balances", pt: "Mostrar meus saldos de tokens" },
  },
  {
    id: "token-prices",
    nameEn: "Token prices",
    namePt: "Preços de tokens",
    descEn: "Live USD prices for PROS, WPROS, BTC, ETH, USDC, LINK and related charts.",
    descPt: "Preços USD ao vivo de PROS, WPROS, BTC, ETH, USDC, LINK e gráficos relacionados.",
    tags: ["price", "market", "chart"],
    examples: ["Price of PROS", "Quanto vale WPROS?"],
    starterPrompt: { en: "What is the price of PROS?", pt: "Qual o preço do PROS?" },
  },
  {
    id: "price-alerts",
    nameEn: "Price alerts",
    namePt: "Alertas de preço",
    descEn: "Local browser alerts when a token goes above or below a target price.",
    descPt: "Alertas locais no browser quando um token passa acima ou abaixo de um preço-alvo.",
    tags: ["price", "alert", "notification"],
    examples: ["Alert me when PROS above 0.10", "List my price alerts"],
    starterPrompt: { en: "Alert me when PROS goes above 0.10", pt: "Alertar quando PROS passar de 0.10" },
  },
  {
    id: "inspect-contracts",
    nameEn: "Contract & calldata review",
    namePt: "Contratos e calldata",
    descEn: "Explain contract roles and decode calldata before the user signs (no tx-hash forensics).",
    descPt: "Explicar papéis de contratos e decodificar calldata antes de assinar (sem forensics de hash).",
    tags: ["contract", "calldata", "security"],
    examples: ["What does this contract do?", "Explain this calldata 0x…"],
    starterPrompt: { en: "Help me review contract calldata before I sign", pt: "Ajude a revisar calldata de contrato antes de assinar" },
  },
  {
    id: "validate-recipients",
    nameEn: "Recipient validation",
    namePt: "Validação de destinatários",
    descEn: "Check transfer destinations and batch payout addresses before sending.",
    descPt: "Verificar destinos de transferência e endereços em lote antes de enviar.",
    tags: ["transfer", "recipient", "address"],
    examples: ["Send 1 PROS to 0x…", "Pay three addresses"],
    webAction: "transfer",
  },
  {
    id: "token-approvals",
    nameEn: "Token approvals",
    namePt: "Aprovações de tokens",
    descEn: "Build ERC-20 approve transactions (exact or unlimited) for a spender contract.",
    descPt: "Montar transações approve ERC-20 (valor exato ou ilimitado) para um contrato spender.",
    tags: ["approve", "erc20", "allowance"],
    examples: ["Approve 100 USDC for LI.FI", "Unlimited WPROS approve for FaroSwap"],
    starterPrompt: { en: "Approve a token for a contract", pt: "Aprovar um token para um contrato" },
  },
  {
    id: "allowance-checks",
    nameEn: "Allowance checks",
    namePt: "Checagem de allowances",
    descEn: "Preflight spender allowance before swaps, stakes, or liquidity adds.",
    descPt: "Verificar allowance do spender antes de swap, stake ou liquidez.",
    tags: ["allowance", "preflight"],
    examples: ["Do I have enough USDC allowance?", "Check stPROS allowance"],
    starterPrompt: { en: "Check my token allowance before swapping", pt: "Verificar allowance antes de fazer swap" },
  },
  {
    id: "calldata-builder",
    nameEn: "Calldata builder",
    namePt: "Montagem de calldata",
    descEn: "Assemble unsigned transaction payloads for swaps, bridges, LP, stake, and transfers.",
    descPt: "Montar payloads de transação não assinados para swap, bridge, LP, stake e transferências.",
    tags: ["calldata", "transaction", "build"],
    examples: ["Build swap calldata for 1 PROS → USDC", "Prepare bridge tx to Base"],
    webAction: "swap",
  },
  {
    id: "transfers",
    nameEn: "Transfers",
    namePt: "Transferências",
    descEn: "Send native PROS or ERC-20 (PROS/WPROS/USDC) to one or many recipients.",
    descPt: "Enviar PROS nativo ou ERC-20 (PROS/WPROS/USDC) para um ou vários destinatários.",
    tags: ["transfer", "payment", "send"],
    examples: ["Send 0.5 PROS to 0x…", "Batch transfer USDC"],
    webAction: "transfer",
  },
  {
    id: "swaps",
    nameEn: "Swaps",
    namePt: "Swaps",
    descEn: "Token swaps on Pharos via LI.FI aggregator or direct FaroSwap routing.",
    descPt: "Trocas de tokens na Pharos via LI.FI ou FaroSwap direto.",
    tags: ["swap", "dex", "trade"],
    examples: ["Swap 10 PROS to USDC", "Trocar PROS por USDC"],
    webAction: "swap",
  },
  {
    id: "bridges",
    nameEn: "Cross-chain bridges",
    namePt: "Bridges cross-chain",
    descEn: "Bridge assets to/from Ethereum, Base, Arbitrum, Polygon via LI.FI, CCIP, or CCTP v2.",
    descPt: "Bridge de/para Ethereum, Base, Arbitrum, Polygon via LI.FI, CCIP ou CCTP v2.",
    tags: ["bridge", "cross-chain"],
    examples: ["Bridge 50 USDC to Base", "Ponte USDC para Ethereum"],
    webAction: "bridge",
  },
  {
    id: "liquidity-actions",
    nameEn: "Add & remove liquidity",
    namePt: "Adicionar e remover liquidez",
    descEn: "FaroSwap V3 WPROS/USDC liquidity: add (fee tier + range), remove %, and collect fees.",
    descPt: "Liquidez FaroSwap V3 WPROS/USDC: adicionar (fee + range), remover % e coletar fees.",
    tags: ["liquidity", "lp", "faroswap", "v3"],
    examples: ["Add liquidity", "Remove 50% of my LP", "Collect fees"],
    webAction: "liquidity",
  },
  {
    id: "lp-positions",
    nameEn: "LP positions view",
    namePt: "Posições LP",
    descEn: "List FaroSwap V3 NFT positions with ranges, fees, and remove/collect actions.",
    descPt: "Listar posições NFT FaroSwap V3 com ranges, fees e ações de remover/coletar.",
    tags: ["liquidity", "positions", "faroswap"],
    examples: ["My LP positions", "Minhas posições"],
    webAction: "positions",
  },
  {
    id: "vault-deposits",
    nameEn: "Vault deposits",
    namePt: "Depósitos em vaults",
    descEn: "Track Faroo RealFi vault shares (FRHV001/FYV001) and underlying stPROS exposure.",
    descPt: "Acompanhar shares de vaults Faroo RealFi (FRHV001/FYV001) e stPROS subjacente.",
    tags: ["vault", "realfi", "faroo", "frhv001"],
    examples: ["My Faroo vault position", "RealFi positions"],
    webAction: "realfi",
  },
  {
    id: "staking-actions",
    nameEn: "Staking actions",
    namePt: "Ações de staking",
    descEn: "Stake PROS → stPROS and unstake via Faroo liquid staking (7-day queue, 0% fee).",
    descPt: "Stake PROS → stPROS e unstake via Faroo (fila 7 dias, taxa 0%).",
    tags: ["stake", "unstake", "stpros", "faroo"],
    examples: ["Stake 1 PROS", "My staking position", "Unstake stPROS"],
    webAction: "mystake",
  },
  {
    id: "tx-history",
    nameEn: "Transaction history",
    namePt: "Histórico de transações",
    descEn: "Recent on-chain transactions for the connected wallet with explorer links.",
    descPt: "Transações recentes da carteira conectada com links do explorer.",
    tags: ["history", "transactions", "explorer"],
    examples: ["My last transactions", "Minhas transações"],
    webAction: "txhistory",
  },
  {
    id: "explain-tx",
    nameEn: "Explain transaction",
    namePt: "Explicar transação",
    descEn: "Paste a Pharos tx hash for plain-language decode: action, status, value, gas, revert reason.",
    descPt: "Cole um hash de tx Pharos para decodificação em linguagem simples: ação, status, valor, gás, revert.",
    tags: ["explain", "tx", "hash", "read-only"],
    examples: ["Explain tx 0x…", "What happened in this transaction?"],
    starterPrompt: { en: "Explain this transaction: paste 0x hash", pt: "Explicar esta transação: cole o hash 0x" },
  },
  {
    id: "rwa-market",
    nameEn: "RWA market (live)",
    namePt: "Mercado RWA (ao vivo)",
    descEn: "Live global RWA tokenization aggregates from rwa.xyz (TVL, asset classes).",
    descPt: "Agregados ao vivo do mercado global de RWA via rwa.xyz (TVL, classes de ativos).",
    tags: ["rwa", "market", "live"],
    examples: ["RWA market", "Mercado de RWA global"],
    webAction: "rwamarket",
  },
  {
    id: "ecosystem-qa",
    nameEn: "Ecosystem Q&A",
    namePt: "Q&A do ecossistema",
    descEn: "Pharos protocols, Faroo, FaroSwap, partners, chain ID/RPC/explorer, and dApp directory answers.",
    descPt: "Respostas sobre protocolos Pharos, Faroo, FaroSwap, parceiros, chain ID/RPC/explorer e diretório de dApps.",
    tags: ["knowledge", "ecosystem", "pharos", "faroo"],
    examples: ["What is Faroo?", "List Pharos DeFi protocols", "What is chain ID 1672?"],
    starterPrompt: { en: "What DeFi protocols are on Pharos?", pt: "Quais protocolos DeFi tem na Pharos?" },
  },
  {
    id: "script-generation",
    nameEn: "Developer scripts",
    namePt: "Scripts de desenvolvedor",
    descEn: "Generate Foundry cast / ethers snippets for Pharos reads (never executes; code only).",
    descPt: "Gerar snippets Foundry cast / ethers para leituras Pharos (nunca executa; só código).",
    tags: ["script", "developer", "cast", "ethers"],
    examples: ["Generate cast script to read ERC-20 balance", "Ethers snippet for Pharos RPC"],
    starterPrompt: { en: "Generate a cast script to read my USDC balance", pt: "Gerar script cast para ler meu saldo USDC" },
  },
  {
    id: "web3-defi-briefings",
    nameEn: "DeFi briefings",
    namePt: "Briefings DeFi",
    descEn: "Live Web3 DeFi trend briefings — yields, TVL shifts, protocol news (no NFTs/DAOs).",
    descPt: "Briefings ao vivo de tendências DeFi — yields, TVL, notícias de protocolos (sem NFTs/DAOs).",
    tags: ["defi", "briefing", "trends", "web3-radar"],
    examples: ["DeFi trends this week", "Briefing DeFi"],
    starterPrompt: { en: "Web3 DeFi briefing", pt: "Briefing DeFi Web3" },
  },
  {
    id: "web3-layer2-trends",
    nameEn: "Layer 2 trends",
    namePt: "Tendências Layer 2",
    descEn: "Rollup and L2 scaling trend calls from live Web3 sources.",
    descPt: "Trend calls de rollups e escalabilidade L2 com fontes ao vivo.",
    tags: ["layer2", "rollup", "scaling", "web3-radar"],
    examples: ["Layer 2 news", "L2 rollup trends"],
    starterPrompt: { en: "Layer 2 trend briefing", pt: "Briefing tendências Layer 2" },
  },
  {
    id: "web3-security-alerts",
    nameEn: "Security & risk alerts",
    namePt: "Alertas de segurança",
    descEn: "Exploit, audit, and vulnerability alerts with risk guidance.",
    descPt: "Alertas de exploits, auditorias e vulnerabilidades com orientação de risco.",
    tags: ["security", "exploit", "audit", "web3-radar"],
    examples: ["Latest DeFi hacks", "Security alerts crypto"],
    starterPrompt: { en: "Web3 security risk alerts", pt: "Alertas de risco em segurança Web3" },
  },
  {
    id: "web3-regulation-briefings",
    nameEn: "Regulation briefings",
    namePt: "Briefings de regulação",
    descEn: "Compliance and legal-policy updates for crypto markets.",
    descPt: "Atualizações de compliance e marco legal para mercados crypto.",
    tags: ["regulation", "compliance", "legal", "web3-radar"],
    examples: ["Crypto regulation news", "MiCA compliance update"],
    starterPrompt: { en: "Crypto regulation briefing", pt: "Briefing regulação crypto" },
  },
  {
    id: "web3-airdrop-intel",
    nameEn: "Airdrop intelligence",
    namePt: "Inteligência de airdrops",
    descEn: "Token distribution and farming eligibility signals from live sources.",
    descPt: "Sinais de distribuição de tokens e elegibilidade de farming com fontes ao vivo.",
    tags: ["airdrop", "farming", "distribution", "web3-radar"],
    examples: ["Latest airdrops", "Airdrop opportunities"],
    starterPrompt: { en: "Airdrop trend briefing", pt: "Briefing tendências de airdrops" },
  },
  {
    id: "sybil-bot-detection",
    nameEn: "Sybil & bot detection",
    namePt: "Detecção Sybil e bots",
    descEn: "Phases 1–4: deep on-chain, Trusta/Passport reputation, cluster graph, campaign correlation.",
    descPt: "Fases 1–4: on-chain profundo, reputação Trusta/Passport, grafo de cluster, correlação com campanhas.",
    tags: ["sybil", "bot", "anti-sybil", "airdrop-farm", "security"],
    examples: ["Is this wallet a bot?", "Check Sybil risk for 0x…", "Analyze Sybil cluster"],
    starterPrompt: { en: "Check if my wallet looks like a Sybil or bot", pt: "Verificar se minha carteira parece Sybil ou bot" },
  },
  {
    id: "link-scam-scanner",
    nameEn: "Link & phishing scanner",
    namePt: "Scanner de links e phishing",
    descEn: "Web3-wide URL analysis: 80+ official domains, typosquats, free-host drainers, HTML sniff, redirects, web reputation.",
    descPt: "Análise Web3 global: 80+ domínios oficiais, typosquats, drainers em hosts grátis, sniff HTML, redirects, reputação web.",
    tags: ["phishing", "scam", "link", "security", "drainer", "antiscam"],
    examples: ["Is this link safe?", "Check if https://… is a scam", "Verify phishing URL"],
    starterPrompt: { en: "Check if this link is safe: paste URL here", pt: "Verificar se este link é seguro: cole a URL aqui" },
  },
  {
    id: "pre-sign-risk-check",
    nameEn: "Pre-sign risk check",
    namePt: "Checagem de risco pré-assinatura",
    descEn: "Decode unsigned calldata before signing — unlimited approvals, unknown spenders, large native transfers.",
    descPt: "Decodifica calldata não assinada antes de assinar — approvals ilimitados, spenders desconhecidos, transferências grandes.",
    tags: ["security", "presign", "calldata", "approve", "transaction"],
    examples: ["Review this calldata before I sign", "Revisar transação 0x…", "Pre-sign risk check"],
    starterPrompt: { en: "Review transaction calldata before I sign", pt: "Revisar calldata da transação antes de assinar" },
  },
  {
    id: "swap-safety-advisor",
    nameEn: "Swap safety advisor",
    namePt: "Advisor de segurança de swap",
    descEn: "Slippage, min receive, approval steps, and route warnings for LI.FI and FaroSwap quotes.",
    descPt: "Slippage, recebimento mínimo, etapas de approve e avisos de rota para cotações LI.FI e FaroSwap.",
    tags: ["swap", "security", "slippage", "defi", "safety"],
    examples: ["Is this swap safe?", "Swap safety for 10 PROS to USDC"],
    webAction: "swap",
  },
];

export function skillLabel(skill: ProsPilotSkill, lang: "en" | "pt"): string {
  return lang === "pt" ? skill.namePt : skill.nameEn;
}

export function skillDesc(skill: ProsPilotSkill, lang: "en" | "pt"): string {
  return lang === "pt" ? skill.descPt : skill.descEn;
}

/** Full Interaction Guide for Anvita Console — intro + enumerated skills. */
export function formatInteractionGuide(lang: "en" | "pt" = "en"): string {
  const intro = lang === "pt" ? AGENT_INTERACTION_GUIDE_PT : AGENT_INTERACTION_GUIDE;
  const header = lang === "pt" ? "Skills ativas:" : "Active skills:";
  const lines = PROSPILOT_SKILLS.map((s) => {
    const name = skillLabel(s, lang);
    const desc = skillDesc(s, lang);
    return `• ${name} — ${desc}`;
  });
  const footer =
    lang === "pt"
      ? "Execução on-chain: https://pharos-agent-pi.vercel.app/chat (Chain 1672) — usuário assina na carteira. Sem x402 nem análise forense de hashes de tx existentes."
      : "On-chain execution: https://pharos-agent-pi.vercel.app/chat (Chain 1672) — user signs in wallet. No x402 payment intents or existing tx-hash forensics.";
  return `${intro}\n\n${header}\n${lines.join("\n")}\n\n${footer}`;
}

export function toAgentCardSkills() {
  return PROSPILOT_SKILLS.map((s) => ({
    id: s.id,
    name: s.nameEn,
    description: s.descEn,
    tags: s.tags,
    examples: s.examples,
  }));
}
