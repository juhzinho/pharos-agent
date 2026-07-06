// Price alerts — client-side watchlist persisted in localStorage. The chat
// page polls prices every minute while open and fires a browser notification
// plus a chat message when a target is crossed. No backend: alerts only
// trigger while the app is open in a tab.

import { getTokenPrice } from "./prices";

export interface PriceAlert {
  id: string;
  symbol: string;             // "PROS", "ETH"…
  direction: "above" | "below";
  target: number;             // USD
  createdAt: number;
}

const KEY = "pharos_price_alerts";

export function listAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as PriceAlert[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: PriceAlert[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { }
}

export function addAlert(symbol: string, direction: "above" | "below", target: number): PriceAlert {
  const alert: PriceAlert = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    symbol: symbol.toUpperCase(),
    direction,
    target,
    createdAt: Date.now(),
  };
  write([...listAlerts(), alert]);
  return alert;
}

export function removeAlert(id: string) {
  write(listAlerts().filter((a) => a.id !== id));
}

export function clearAlerts() {
  write([]);
}

/** Ask for browser notification permission (no-op if already decided). */
export async function ensureNotifyPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

export interface TriggeredAlert extends PriceAlert {
  price: number; // price at trigger time
}

/**
 * Checks all alerts against live prices. Triggered alerts are removed from
 * storage and returned so the caller can announce them (chat + notification).
 */
export async function checkAlerts(): Promise<TriggeredAlert[]> {
  const alerts = listAlerts();
  if (alerts.length === 0) return [];

  const symbols = [...new Set(alerts.map((a) => a.symbol))];
  const prices = new Map<string, number>();
  await Promise.all(symbols.map(async (sym) => {
    try {
      const p = await getTokenPrice(sym);
      prices.set(sym, p.price);
    } catch { /* symbol temporarily unavailable — retry next poll */ }
  }));

  const triggered: TriggeredAlert[] = [];
  const remaining: PriceAlert[] = [];
  for (const a of alerts) {
    const price = prices.get(a.symbol);
    if (price == null) { remaining.push(a); continue; }
    const hit = a.direction === "above" ? price >= a.target : price <= a.target;
    if (hit) triggered.push({ ...a, price });
    else remaining.push(a);
  }
  if (triggered.length > 0) write(remaining);
  return triggered;
}

/** Fire a browser notification for a triggered alert (best-effort). */
export function notifyTriggered(t: TriggeredAlert, lang: "pt" | "en") {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const title = lang === "pt" ? `🔔 Alerta de preço: ${t.symbol}` : `🔔 Price alert: ${t.symbol}`;
  const body = lang === "pt"
    ? `${t.symbol} está em $${t.price.toFixed(4)} — ${t.direction === "above" ? "acima" : "abaixo"} do seu alvo de $${t.target}.`
    : `${t.symbol} is at $${t.price.toFixed(4)} — ${t.direction === "above" ? "above" : "below"} your $${t.target} target.`;
  try { new Notification(title, { body, icon: "/favicon.svg" }); } catch { }
}

// ── natural-language parsing (local fast-path, PT/EN/ES) ────────────────────

const ALERT_VERB_RE = /\b(alerta|alertas?|avisa|avise|me avisa|notifica|notifique|alert|notify|watch|aviso)\b/i;
const LIST_RE = /\b(meus alertas|listar? alertas|mis alertas|my alerts|list alerts|show alerts|ver alertas)\b/i;
const CLEAR_RE = /\b(limpar? (os )?alertas|remover? (os )?alertas|cancelar? (os )?alertas|apagar? (os )?alertas|clear alerts|remove alerts|delete alerts)\b/i;

export type AlertCommand =
  | { kind: "add"; symbol: string; direction: "above" | "below"; target: number }
  | { kind: "list" }
  | { kind: "clear" }
  | null;

/** Parses alert commands like "avisa quando o PROS passar de 0.50". */
export function parseAlertCommand(text: string): AlertCommand {
  if (LIST_RE.test(text)) return { kind: "list" };
  if (CLEAR_RE.test(text)) return { kind: "clear" };
  if (!ALERT_VERB_RE.test(text)) return null;

  const symMatch = text.match(/\b(PROS|WPROS|USDC|WETH|ETH|BTC|LINK|PGOLD)\b/i);
  const numMatch = text.match(/\$?\s*(\d+(?:[.,]\d+)?)\s*(?:d[oó]lares?|usd|\$)?/i);
  if (!symMatch || !numMatch) return null;

  const target = parseFloat(numMatch[1].replace(",", "."));
  if (!(target > 0)) return null;

  const below = /\b(cair|abaixo|below|under|drops?|menor|baixar|descer|less than|menos de|debajo)\b/i.test(text);
  const above = /\b(subir|acima|above|over|passar|maior|chegar|atingir|reach|hits?|more than|mais de|arriba)\b/i.test(text);
  const direction: "above" | "below" = below && !above ? "below" : "above";

  return { kind: "add", symbol: symMatch[1].toUpperCase(), direction, target };
}

/** Markdown list of the active alerts for the chat bubble. */
export function formatAlerts(alerts: PriceAlert[], lang: "pt" | "en"): string {
  if (alerts.length === 0) {
    return lang === "pt"
      ? "Você não tem alertas de preço ativos. Crie um assim: _\"me avisa quando o PROS passar de $0.50\"_."
      : "You have no active price alerts. Create one like: _\"alert me when PROS goes above $0.50\"_.";
  }
  const rows = alerts.map((a) =>
    `- **${a.symbol}** ${a.direction === "above" ? "≥" : "≤"} $${a.target}`,
  );
  const head = lang === "pt" ? "🔔 **Seus alertas de preço:**" : "🔔 **Your price alerts:**";
  const note = lang === "pt"
    ? "\n\n_Os alertas disparam enquanto o app estiver aberto (checagem a cada minuto)._"
    : "\n\n_Alerts fire while the app is open (checked every minute)._";
  return `${head}\n${rows.join("\n")}${note}`;
}
