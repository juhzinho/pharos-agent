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
  | "liquidity";

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
    descEn: "Read-only holdings, USD totals, wallet score, tags and activity heuristics.",
    descPt: "Holdings somente leitura, total em USD, score, tags e heurísticas de atividade.",
    tags: ["wallet", "analysis", "read-only"],
    examples: ["Analyze my wallet", "Wallet score for 0x…"],
    webAction: "wallet",
  },
  {
    id: "inspect-tokens",
    nameEn: "Token inspection",
    namePt: "Inspeção de tokens",
    descEn: "Balances per token, live prices, and LP / RealFi token exposure on Pharos.",
    descPt: "Saldos por token, preços ao vivo e exposição LP / RealFi na Pharos.",
    tags: ["tokens", "balance", "price"],
    examples: ["Price of PROS", "What tokens do I hold?"],
    webAction: "positions",
    starterPrompt: { en: "Show my token balances", pt: "Mostrar meus saldos de tokens" },
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
    examples: ["Approve 100 USDC for 0x…", "Unlimited USDC approve for FaroSwap"],
    starterPrompt: { en: "Approve USDC for a contract", pt: "Aprovar USDC para um contrato" },
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
