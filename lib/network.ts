// Global network selection (Pharos Mainnet ⇄ Atlantic Testnet).
// Persisted in localStorage and broadcast via a window event so every
// component (navbar switcher, chat page, cards) stays in sync.

import type { PharosNetworkId } from "./tokens";

const KEY = "pharos:selected-network";
export const NETWORK_EVENT = "pharos:network-changed";

export function getSelectedNetwork(): PharosNetworkId {
  if (typeof window === "undefined") return "mainnet";
  const v = window.localStorage.getItem(KEY);
  return v === "testnet" ? "testnet" : "mainnet";
}

export function setSelectedNetwork(id: PharosNetworkId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, id);
  window.dispatchEvent(new CustomEvent(NETWORK_EVENT, { detail: id }));
}

export function onNetworkChange(cb: (id: PharosNetworkId) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as PharosNetworkId);
  window.addEventListener(NETWORK_EVENT, handler);
  return () => window.removeEventListener(NETWORK_EVENT, handler);
}
