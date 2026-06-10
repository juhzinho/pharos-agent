interface UserPrefs {
  swapCount: number;
  bridgeCount: number;
  tokenUsage: Record<string, number>;
  chainUsage: Record<string, number>;
  lastProvider: string | null;
}

const STORAGE_KEY = "pharos_agent_prefs";

function defaultPrefs(): UserPrefs {
  return { swapCount: 0, bridgeCount: 0, tokenUsage: {}, chainUsage: {}, lastProvider: null };
}

function load(): UserPrefs {
  if (typeof window === "undefined") return defaultPrefs();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultPrefs(), ...JSON.parse(raw) } : defaultPrefs();
  } catch {
    return defaultPrefs();
  }
}

function save(prefs: UserPrefs): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

function topKey(map: Record<string, number>): string | null {
  const entries = Object.entries(map);
  if (!entries.length) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export interface UserStats {
  swapCount: number;
  bridgeCount: number;
  totalCount: number;
  favoriteToken: string | null;
  favoriteChain: string | null;
  lastProvider: string | null;
}

export function getStats(): UserStats {
  const p = load();
  return {
    swapCount: p.swapCount,
    bridgeCount: p.bridgeCount,
    totalCount: p.swapCount + p.bridgeCount,
    favoriteToken: topKey(p.tokenUsage),
    favoriteChain: topKey(p.chainUsage),
    lastProvider: p.lastProvider,
  };
}

export function recordTransaction(
  action: "swap" | "bridge",
  fromToken: string,
  toChain: string | undefined,
  provider: string
): void {
  const p = load();
  if (action === "swap") p.swapCount++;
  else p.bridgeCount++;
  p.tokenUsage[fromToken] = (p.tokenUsage[fromToken] ?? 0) + 1;
  if (toChain) p.chainUsage[toChain] = (p.chainUsage[toChain] ?? 0) + 1;
  p.lastProvider = provider;
  save(p);
}

// Returns a compact string injected into Groq's system prompt so it can
// reference the user's history in its replies (e.g. "Use your usual USDC?").
export function getPrefsContext(): string {
  const s = getStats();
  if (s.totalCount === 0) return "";
  const parts: string[] = [`totalTxns=${s.totalCount}`];
  if (s.favoriteToken) parts.push(`favoriteToken=${s.favoriteToken}`);
  if (s.favoriteChain) parts.push(`favoriteChain=${s.favoriteChain}`);
  if (s.lastProvider) parts.push(`lastProvider=${s.lastProvider}`);
  return parts.join(", ");
}
