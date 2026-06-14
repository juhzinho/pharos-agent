import { BrowserProvider } from "ethers";
import { CHAIN_WALLET_CONFIGS } from "./tokens";

export interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isOKExWallet?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

// ── multi-wallet provider registry (EIP-6963 + injected) ─────────────────────

export interface WalletOption {
  id: string;       // rdns (or "injected")
  name: string;
  icon?: string;    // data URI from EIP-6963
  rdns?: string;
  provider: EIP1193Provider;
}

interface EIP6963Detail { info: { uuid: string; name: string; icon: string; rdns: string }; provider: EIP1193Provider }

const discovered = new Map<string, WalletOption>(); // keyed by rdns
let activeProvider: EIP1193Provider | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event: Event) => {
    const detail = (event as CustomEvent<EIP6963Detail>).detail;
    if (detail?.info?.rdns && detail.provider) {
      discovered.set(detail.info.rdns, {
        id: detail.info.rdns, name: detail.info.name, icon: detail.info.icon, rdns: detail.info.rdns, provider: detail.provider,
      });
    }
  });
}

function getProvider(): EIP1193Provider | undefined {
  if (activeProvider) return activeProvider;
  return typeof window !== "undefined" ? window.ethereum : undefined;
}

// The currently-selected provider (for event listeners). Falls back to injected.
export function getActiveProvider(): EIP1193Provider | undefined {
  return getProvider();
}

export function setActiveProvider(p: EIP1193Provider): void {
  activeProvider = p;
}

export function isWalletAvailable(): boolean {
  return !!getProvider() || discovered.size > 0;
}

// Keep old export name so any remaining imports don't break
export const isMetaMaskAvailable = isWalletAvailable;

export function getWalletName(p?: EIP1193Provider): string {
  const eth = p ?? getProvider();
  if (!eth) return "wallet";
  if (eth.isRabby) return "Rabby";
  if (eth.isCoinbaseWallet) return "Coinbase Wallet";
  if (eth.isBraveWallet) return "Brave Wallet";
  if (eth.isOKExWallet) return "OKX Wallet";
  if (eth.isTrust || eth.isTrustWallet) return "Trust";
  if (eth.isMetaMask) return "MetaMask";
  return "wallet";
}

function requireProvider(): EIP1193Provider {
  const p = getProvider();
  if (!p) {
    throw new Error("No wallet found. Install MetaMask, OKX Wallet, Rabby, Coinbase Wallet, or Trust and refresh.");
  }
  return p;
}

// An ethers BrowserProvider wrapping the active EIP-1193 provider.
export function getBrowserProvider(): BrowserProvider {
  return new BrowserProvider(requireProvider() as ConstructorParameters<typeof BrowserProvider>[0]);
}

// Discover available wallets via EIP-6963; falls back to legacy window.ethereum.
export async function discoverWallets(): Promise<WalletOption[]> {
  if (typeof window === "undefined") return [];
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((r) => setTimeout(r, 250));
  const list = Array.from(discovered.values());
  if (list.length === 0 && window.ethereum) {
    list.push({ id: "injected", name: getWalletName(window.ethereum), provider: window.ethereum });
  }
  return list;
}

// ── chain switching ─────────────────────────────────────────────────────────

export async function switchToChain(chainName: string): Promise<void> {
  const config = CHAIN_WALLET_CONFIGS[chainName];
  if (!config) throw new Error(`Unknown chain: ${chainName}`);

  const provider = requireProvider();
  console.log(`[pharos:wallet] switchToChain → ${chainName} (${config.chainId})`);

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: config.chainId }],
    });
    console.log(`[pharos:wallet] switched to ${chainName}`);
  } catch (err: unknown) {
    // 4902 = chain not added yet — add it, then switch
    if ((err as { code?: number })?.code === 4902) {
      console.log(`[pharos:wallet] chain not found, adding ${chainName}…`);
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [config],
      });
    } else {
      throw err;
    }
  }
}

// ── Pharos network enforcement ───────────────────────────────────────────────

export const PHAROS_CHAIN_ID_HEX = "0x688"; // 1672

export async function getCurrentChainId(): Promise<string | null> {
  if (!isWalletAvailable()) return null;
  try {
    return (await requireProvider().request({ method: "eth_chainId" })) as string;
  } catch {
    return null;
  }
}

export async function isOnPharos(): Promise<boolean> {
  const id = await getCurrentChainId();
  return !!id && id.toLowerCase() === PHAROS_CHAIN_ID_HEX;
}

// Prompt the wallet to switch to Pharos (adds it via 4902 path if missing).
export async function ensurePharosNetwork(): Promise<void> {
  await switchToChain("Pharos");
}

// ── connection persistence ───────────────────────────────────────────────────
// EIP-1193 has no real "disconnect" — we remember the user's intent locally and
// silently re-attach on reload only if the wallet still has us authorized.

const CONNECTED_KEY = "pharos-wallet-connected";

export function rememberConnection(): void {
  try { localStorage.setItem(CONNECTED_KEY, "1"); } catch { /* ignore */ }
}

export function forgetConnection(): void {
  try { localStorage.removeItem(CONNECTED_KEY); } catch { /* ignore */ }
}

export function wasConnected(): boolean {
  try { return localStorage.getItem(CONNECTED_KEY) === "1"; } catch { return false; }
}

// Reconnect without prompting: returns the authorized address, or null.
export async function silentReconnect(): Promise<string | null> {
  if (!isWalletAvailable()) return null;
  try {
    const accounts = (await requireProvider().request({ method: "eth_accounts" })) as string[];
    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch {
    return null;
  }
}

// ── connect / disconnect ──────────────────────────────────────────────────────

export async function connectWallet(chosen?: EIP1193Provider): Promise<string> {
  if (chosen) setActiveProvider(chosen);
  const provider = requireProvider();
  console.log(`[pharos:wallet] connectWallet — detected: ${getWalletName()}`);

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned from wallet");
  }

  console.log(`[pharos:wallet] connected: ${accounts[0]}`);
  await switchToChain("Pharos");
  rememberConnection();
  return accounts[0];
}

// Local disconnect — forgets the persisted intent. The app drops its state;
// the wallet itself keeps the site authorized until the user revokes it there.
export function disconnectWallet(): void {
  forgetConnection();
  console.log("[pharos:wallet] disconnected (local)");
}

// ── balance ─────────────────────────────────────────────────────────────────

export async function getBalance(address: string): Promise<string> {
  if (!isWalletAvailable()) return "0";

  const hex = (await requireProvider().request({
    method: "eth_getBalance",
    params: [address, "latest"],
  })) as string;

  const pros = Number(BigInt(hex)) / 1e18;
  return pros.toFixed(4);
}

// ── allowance check ─────────────────────────────────────────────────────────

export async function checkAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<bigint> {
  if (!isWalletAvailable()) return 0n;

  const owner = ownerAddress.slice(2).padStart(64, "0");
  const spender = spenderAddress.slice(2).padStart(64, "0");
  const data = `0xdd62ed3e${owner}${spender}`;

  const result = (await requireProvider().request({
    method: "eth_call",
    params: [{ to: tokenAddress, data }, "latest"],
  })) as string;

  // eth_call on a non-existent contract returns "0x" (empty) — treat as zero allowance
  if (!result || result === "0x") return 0n;
  return BigInt(result);
}

// ── ERC-20 balance ────────────────────────────────────────────────────────────

export async function getErc20Balance(tokenAddress: string, owner: string): Promise<bigint> {
  if (!isWalletAvailable()) return 0n;
  const data = `0x70a08231${owner.slice(2).padStart(64, "0")}`;
  const res = (await requireProvider().request({
    method: "eth_call",
    params: [{ to: tokenAddress, data }, "latest"],
  })) as string;
  return !res || res === "0x" ? 0n : BigInt(res);
}

// ── send transaction ─────────────────────────────────────────────────────────
// Uses ethers BrowserProvider + signer so it works with Rabby, MetaMask,
// Coinbase Wallet, Brave, OKX — any EIP-1193 provider.
// Handles both hex ("0x1a") and decimal ("26") value strings from LI.FI / CCIP.

export interface TxRequest {
  to: string;
  data: string;
  value: string;
  from?: string;
  gasLimit?: string;
  gasPrice?: string;
}

function parseValue(raw: string | undefined): bigint {
  if (!raw || raw === "0x" || raw === "") return 0n;
  try {
    return BigInt(raw); // handles "0x..." and decimal strings
  } catch {
    return 0n;
  }
}

export async function sendTransaction(tx: TxRequest): Promise<string> {
  requireProvider();
  console.log("[pharos:wallet] sendTransaction →", {
    to: tx.to,
    value: tx.value,
    dataBytes: tx.data ? tx.data.length / 2 - 1 : 0,
    gasLimit: tx.gasLimit,
  });

  const ethersProvider = getBrowserProvider();
  const signer = await ethersProvider.getSigner();
  console.log(`[pharos:wallet] signer: ${signer.address}`);

  const txParams: Parameters<typeof signer.sendTransaction>[0] = {
    to: tx.to,
    data: tx.data || "0x",
    value: parseValue(tx.value),
  };
  if (tx.gasLimit) txParams.gasLimit = BigInt(tx.gasLimit);

  console.log("[pharos:wallet] calling signer.sendTransaction…");
  const txResponse = await signer.sendTransaction(txParams);
  console.log(`[pharos:wallet] tx submitted ✓  hash: ${txResponse.hash}`);
  return txResponse.hash;
}

// Wait for a tx to be mined and report whether it SUCCEEDED on-chain.
// Returns true only when receipt.status === 1; false if it reverted (status 0)
// or the receipt couldn't be obtained. Never declare success without this.
export async function waitForTxSuccess(hash: string): Promise<boolean> {
  if (!isWalletAvailable()) return false;
  try {
    const provider = getBrowserProvider();
    const receipt = await provider.waitForTransaction(hash, 1);
    console.log(`[pharos:wallet] receipt for ${hash.slice(0, 10)}… status=${receipt?.status}`);
    return !!receipt && receipt.status === 1;
  } catch (err) {
    console.warn("[pharos:wallet] waitForTxSuccess error:", err);
    return false;
  }
}

// ── approve ERC-20 ──────────────────────────────────────────────────────────

function buildApprovalData(spenderAddress: string, amount: string): string {
  const spender = spenderAddress.slice(2).padStart(64, "0");
  const amt = BigInt(amount).toString(16).padStart(64, "0");
  return `0x095ea7b3${spender}${amt}`;
}

export async function sendApproval(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  amount: string
): Promise<string> {
  console.log("[pharos:wallet] sendApproval →", { tokenAddress, spenderAddress, amount });
  const data = buildApprovalData(spenderAddress, amount);
  return sendTransaction({ to: tokenAddress, data, value: "0x0", from: ownerAddress });
}

// ── utils ───────────────────────────────────────────────────────────────────

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
