// Metadata-only thread store for the visual sidebar.
// SAFETY: this persists ONLY {id, title, createdAt} per thread to localStorage.
// It NEVER stores message arrays or pending-tx state, so there is no risk of a
// stale "Sign & Execute" button reloading for an expired quote.

export interface ThreadMeta {
  id: string;
  title: string;
  createdAt: number;
}

const THREADS_KEY = "pharos-threads";
const ACTIVE_KEY = "pharos-active-thread";
export const THREADS_EVENT = "pharos-threads-changed";

function emit() {
  window.dispatchEvent(new Event(THREADS_EVENT));
}

function readRaw(): ThreadMeta[] {
  try {
    const arr = JSON.parse(localStorage.getItem(THREADS_KEY) ?? "[]");
    return Array.isArray(arr)
      ? arr.filter((t): t is ThreadMeta => t && typeof t.id === "string" && typeof t.title === "string")
      : [];
  } catch {
    return [];
  }
}

export function loadThreads(): ThreadMeta[] {
  if (typeof window === "undefined") return [];
  return readRaw().sort((a, b) => b.createdAt - a.createdAt);
}

export function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
  emit();
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function createThread(): ThreadMeta {
  const t: ThreadMeta = { id: makeId(), title: "New chat", createdAt: Date.now() };
  const list = readRaw();
  list.push(t);
  localStorage.setItem(THREADS_KEY, JSON.stringify(list));
  localStorage.setItem(ACTIVE_KEY, t.id);
  emit();
  return t;
}

export function deleteThread(id: string): void {
  const list = readRaw().filter((t) => t.id !== id);
  localStorage.setItem(THREADS_KEY, JSON.stringify(list));
  if (getActiveId() === id) localStorage.removeItem(ACTIVE_KEY);
  emit();
}

// Make sure there's always exactly one active thread for this session.
export function ensureActiveThread(): void {
  if (typeof window === "undefined") return;
  const active = getActiveId();
  const list = readRaw();
  if (active && list.some((t) => t.id === active)) return;
  if (list.length > 0) {
    localStorage.setItem(ACTIVE_KEY, list.sort((a, b) => b.createdAt - a.createdAt)[0].id);
    emit();
    return;
  }
  createThread();
}

// Auto-title the active thread from its first user message. Only overwrites the
// default "New chat" placeholder, so later messages don't keep renaming it.
export function updateActiveTitle(firstUserMessage: string): void {
  if (typeof window === "undefined") return;
  const active = getActiveId();
  if (!active) return;
  const clean = firstUserMessage.trim();
  if (!clean) return;
  const list = readRaw();
  let changed = false;
  for (const t of list) {
    if (t.id === active && (t.title === "New chat" || !t.title)) {
      t.title = clean.slice(0, 40) + (clean.length > 40 ? "…" : "");
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(THREADS_KEY, JSON.stringify(list));
    emit();
  }
}
