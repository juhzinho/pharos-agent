/** Known Sybil dispensers / farm routers (curated + env extension). */
export const SYBIL_BLOCKLIST: Record<string, string> = {
  // Add known Pharos ecosystem farm dispensers as discovered — placeholder examples are generic patterns.
};

export function loadBlocklist(): Map<string, string> {
  const map = new Map<string, string>(Object.entries(SYBIL_BLOCKLIST).map(([k, v]) => [k.toLowerCase(), v]));
  const extra = process.env.SYBIL_BLOCKLIST?.split(/[,;\s]+/) ?? [];
  for (const raw of extra) {
    const a = raw.trim().toLowerCase();
    if (/^0x[a-f0-9]{40}$/.test(a)) map.set(a, "env-blocklist");
  }
  return map;
}

export function checkBlocklist(address: string, blocklist: Map<string, string>): { hit: boolean; label?: string } {
  const key = address.toLowerCase();
  const label = blocklist.get(key);
  return label ? { hit: true, label } : { hit: false };
}
