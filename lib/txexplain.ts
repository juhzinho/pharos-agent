// Transaction explainer: paste a tx hash → plain-language summary.
// Reads the tx + receipt from the Pharos RPC (mainnet or Atlantic testnet)
// and decodes well-known function selectors deterministically.

import { PHAROS_NETWORKS, type PharosNetworkId } from "./tokens";

export interface TxExplanation {
  hash: string;
  network: PharosNetworkId;
  found: boolean;
  status: "success" | "failed" | "pending" | "unknown";
  from: string;
  to: string | null;
  valuePros: number;
  gasUsed: number | null;
  gasCostPros: number | null;
  blockNumber: number | null;
  action: string;        // decoded human description (EN, translated in UI)
  selector: string | null;
  explorerUrl: string;
}

const KNOWN_SELECTORS: Record<string, string> = {
  "0xa9059cbb": "ERC-20 token transfer",
  "0x095ea7b3": "ERC-20 approval (allow a contract to spend tokens)",
  "0x23b872dd": "ERC-20 transferFrom (move tokens on behalf of an owner)",
  "0xd0e30db0": "Wrap native token (deposit → WPROS)",
  "0x2e1a7d4d": "Unwrap WPROS (withdraw → native PROS)",
  "0xfc6f7865": "Collect fees from a V3 liquidity position",
  "0x0c49ccbe": "Decrease liquidity in a V3 position",
  "0x219f5d17": "Increase liquidity in a V3 position",
  "0x88316456": "Mint a new V3 liquidity position (NFT)",
  "0xac9650d8": "Multicall (batched contract calls)",
  "0x5ae401dc": "Multicall with deadline (swap router)",
  "0x04e45aaf": "Swap exact input, single pool (V3)",
  "0xb858183f": "Swap exact input, multi-hop path (V3)",
  "0x42842e0e": "NFT safeTransferFrom",
  "0x23a69e75": "Burn a V3 position NFT",
  "0x49404b7c": "Unwrap WETH9 (router sweep)",
  "0x12210e8a": "Refund native token (router)",
  "0x472b43f3": "Swap exact tokens for tokens (V2 style)",
  "0x38ed1739": "Swap exact tokens for tokens (V2 router)",
  "0x7ff36ab5": "Swap exact native for tokens (V2 router)",
  "0x96f25cbe": "DODO mixSwap (FaroSwap route)",
};

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "RPC error");
  return j.result;
}

export function extractTxHash(text: string): string | null {
  const m = text.match(/0x[a-fA-F0-9]{64}/);
  return m ? m[0] : null;
}

interface RpcTx {
  from: string;
  to: string | null;
  value: string;
  input?: string;
  data?: string;
  blockNumber: string | null;
  gasPrice?: string;
}

interface RpcReceipt {
  status: string;
  gasUsed: string;
  effectiveGasPrice?: string;
  blockNumber: string;
}

// Tries the requested network first, then the other one (users often paste a
// testnet hash while on mainnet and vice versa).
export async function explainTx(hash: string, preferred: PharosNetworkId): Promise<TxExplanation> {
  const order: PharosNetworkId[] = preferred === "mainnet" ? ["mainnet", "testnet"] : ["testnet", "mainnet"];

  for (const netId of order) {
    const net = PHAROS_NETWORKS[netId];
    let tx: RpcTx | null = null;
    try {
      tx = (await rpc(net.rpc, "eth_getTransactionByHash", [hash])) as RpcTx | null;
    } catch {
      continue;
    }
    if (!tx) continue;

    let receipt: RpcReceipt | null = null;
    try {
      receipt = (await rpc(net.rpc, "eth_getTransactionReceipt", [hash])) as RpcReceipt | null;
    } catch {
      receipt = null;
    }

    const input = tx.input ?? tx.data ?? "0x";
    const selector = input.length >= 10 ? input.slice(0, 10).toLowerCase() : null;
    const valuePros = tx.value && tx.value !== "0x" ? Number(BigInt(tx.value)) / 1e18 : 0;

    let action: string;
    if (!tx.to) action = "Contract deployment";
    else if (input === "0x" || input.length <= 2) action = `Native ${net.nativeSymbol} transfer`;
    else if (selector && KNOWN_SELECTORS[selector]) action = KNOWN_SELECTORS[selector];
    else action = "Smart contract interaction";

    const gasUsed = receipt ? Number(BigInt(receipt.gasUsed)) : null;
    const gasPrice = receipt?.effectiveGasPrice ?? tx.gasPrice;
    const gasCostPros = gasUsed != null && gasPrice ? (gasUsed * Number(BigInt(gasPrice))) / 1e18 : null;

    return {
      hash,
      network: netId,
      found: true,
      status: !receipt ? "pending" : receipt.status === "0x1" ? "success" : "failed",
      from: tx.from,
      to: tx.to,
      valuePros,
      gasUsed,
      gasCostPros,
      blockNumber: receipt ? Number(BigInt(receipt.blockNumber)) : tx.blockNumber ? Number(BigInt(tx.blockNumber)) : null,
      action,
      selector,
      explorerUrl: net.explorerTx + hash,
    };
  }

  return {
    hash,
    network: preferred,
    found: false,
    status: "unknown",
    from: "",
    to: null,
    valuePros: 0,
    gasUsed: null,
    gasCostPros: null,
    blockNumber: null,
    action: "not found",
    selector: null,
    explorerUrl: PHAROS_NETWORKS[preferred].explorerTx + hash,
  };
}

// Markdown summary for the chat (PT/EN).
export function formatTxExplanation(e: TxExplanation, lang: "pt" | "en"): string {
  const net = PHAROS_NETWORKS[e.network];
  if (!e.found) {
    return lang === "pt"
      ? `Não encontrei a transação \`${e.hash.slice(0, 10)}…\` nem na Mainnet nem na Atlantic Testnet. Confira se o hash está completo (66 caracteres) e se a transação já foi enviada.\n\n[Procurar no explorer](${e.explorerUrl})`
      : `I couldn't find transaction \`${e.hash.slice(0, 10)}…\` on Mainnet or Atlantic Testnet. Check that the hash is complete (66 chars) and the transaction was actually broadcast.\n\n[Search on the explorer](${e.explorerUrl})`;
  }

  const statusIcon = e.status === "success" ? "✅" : e.status === "failed" ? "❌" : "⏳";
  const statusLabel =
    lang === "pt"
      ? e.status === "success" ? "Sucesso" : e.status === "failed" ? "Falhou (revertida)" : "Pendente"
      : e.status === "success" ? "Success" : e.status === "failed" ? "Failed (reverted)" : "Pending";

  const ACTION_PT: Record<string, string> = {
    "Contract deployment": "Deploy de contrato",
    "Smart contract interaction": "Interação com smart contract",
    "ERC-20 token transfer": "Transferência de token ERC-20",
    "ERC-20 approval (allow a contract to spend tokens)": "Aprovação ERC-20 (permite que um contrato gaste seus tokens)",
    "ERC-20 transferFrom (move tokens on behalf of an owner)": "transferFrom ERC-20 (move tokens em nome do dono)",
    "Wrap native token (deposit → WPROS)": "Wrap do token nativo (deposit → WPROS)",
    "Unwrap WPROS (withdraw → native PROS)": "Unwrap de WPROS (withdraw → PROS nativo)",
    "Collect fees from a V3 liquidity position": "Coleta de taxas de uma posição de liquidez V3",
    "Decrease liquidity in a V3 position": "Remoção de liquidez de uma posição V3",
    "Increase liquidity in a V3 position": "Adição de liquidez em uma posição V3",
    "Mint a new V3 liquidity position (NFT)": "Criação de nova posição de liquidez V3 (NFT)",
    "Multicall (batched contract calls)": "Multicall (chamadas agrupadas)",
    "Multicall with deadline (swap router)": "Multicall com deadline (router de swap)",
    "Swap exact input, single pool (V3)": "Swap (pool única V3)",
    "Swap exact input, multi-hop path (V3)": "Swap (rota multi-hop V3)",
    "DODO mixSwap (FaroSwap route)": "Swap via FaroSwap (DODO mixSwap)",
  };
  const natRe = new RegExp(`^Native (\\w+) transfer$`);
  let actionLabel = e.action;
  if (lang === "pt") {
    const nat = e.action.match(natRe);
    actionLabel = nat ? `Transferência nativa de ${nat[1]}` : ACTION_PT[e.action] ?? e.action;
  }

  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const rows: string[] = [];
  rows.push(`${statusIcon} **${statusLabel}** · ${net.label}`);
  rows.push("");
  rows.push(lang === "pt" ? `**O que aconteceu:** ${actionLabel}` : `**What happened:** ${actionLabel}`);
  rows.push("");
  rows.push(`- ${lang === "pt" ? "De" : "From"}: \`${short(e.from)}\``);
  if (e.to) rows.push(`- ${lang === "pt" ? "Para" : "To"}: \`${short(e.to)}\``);
  if (e.valuePros > 0) rows.push(`- ${lang === "pt" ? "Valor" : "Value"}: **${e.valuePros.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${net.nativeSymbol}**`);
  if (e.blockNumber != null) rows.push(`- ${lang === "pt" ? "Bloco" : "Block"}: ${e.blockNumber.toLocaleString("en-US")}`);
  if (e.gasUsed != null) {
    const cost = e.gasCostPros != null ? ` (~${e.gasCostPros.toFixed(6)} ${net.nativeSymbol})` : "";
    rows.push(`- Gas: ${e.gasUsed.toLocaleString("en-US")}${cost}`);
  }
  if (e.status === "failed") {
    rows.push("");
    rows.push(
      lang === "pt"
        ? "_A transação foi incluída no bloco mas **reverteu** — nenhum valor foi movido (só o gas foi gasto). Causas comuns: slippage, allowance insuficiente ou condição do contrato não atendida._"
        : "_The transaction was included in a block but **reverted** — no value moved (only gas was spent). Common causes: slippage, insufficient allowance, or an unmet contract condition._"
    );
  }
  rows.push("");
  rows.push(`[${lang === "pt" ? "Ver no explorer" : "View on explorer"}](${e.explorerUrl})`);
  return rows.join("\n");
}
