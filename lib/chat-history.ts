// Conversation history — persisted client-side in localStorage so chats
// survive refreshes and can be reopened from the sidebar. Only the textual
// conversation is stored: interactive cards (built transactions, wizards,
// balances) are intentionally dropped because they embed calldata and
// balances that would be stale after a reload or wallet switch.

export interface StoredMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  txHash?: string;
  isError?: boolean;
  sources?: string[];
}

export interface StoredChat {
  id: string;
  title: string;
  updatedAt: number;
  messages: StoredMessage[];
}

export interface ChatListItem {
  id: string;
  title: string;
  updatedAt: number;
}

const INDEX_KEY = "pharos_chats_index";
const CHAT_KEY = (id: string) => `pharos_chat_${id}`;
const MAX_CHATS = 30;

function readIndex(): ChatListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const list = raw ? (JSON.parse(raw) as ChatListItem[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeIndex(list: ChatListItem[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch { /* storage full/blocked — history is best-effort */ }
}

export function newChatId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Most recent first. */
export function listChats(): ChatListItem[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadChat(id: string): StoredChat | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAT_KEY(id));
    return raw ? (JSON.parse(raw) as StoredChat) : null;
  } catch {
    return null;
  }
}

export function saveChat(id: string, title: string, messages: StoredMessage[]) {
  if (typeof window === "undefined") return;
  const chat: StoredChat = { id, title, updatedAt: Date.now(), messages };
  try {
    localStorage.setItem(CHAT_KEY(id), JSON.stringify(chat));
  } catch {
    return; // quota exceeded — skip silently
  }
  const index = readIndex().filter((c) => c.id !== id);
  index.unshift({ id, title, updatedAt: chat.updatedAt });
  // Cap the history: evict the oldest chats beyond the limit.
  const trimmed = index.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
  for (const evicted of index.slice(MAX_CHATS)) {
    try { localStorage.removeItem(CHAT_KEY(evicted.id)); } catch { }
  }
  writeIndex(trimmed);
}

export function deleteChat(id: string) {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(CHAT_KEY(id)); } catch { }
  writeIndex(readIndex().filter((c) => c.id !== id));
}

/** First user message, trimmed, as the chat title. */
export function deriveTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const t = (firstUser?.text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "New chat";
  return t.length > 42 ? t.slice(0, 42).trimEnd() + "…" : t;
}
