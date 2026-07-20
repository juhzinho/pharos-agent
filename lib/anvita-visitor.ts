export interface VisitorUser {
  id: string;
  displayName: string;
  createdAt: string;
}

const STORAGE_KEY = "anvita_hub_visitor";

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createVisitorUser(): VisitorUser {
  const id = randomId();
  return {
    id,
    displayName: `Anvita User ${id.slice(0, 4).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };
}

export function loadVisitorUser(): VisitorUser {
  if (typeof window === "undefined") return createVisitorUser();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as VisitorUser;
  } catch {
    /* ignore */
  }
  const visitor = createVisitorUser();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(visitor));
  return visitor;
}

export function saveVisitorUser(visitor: VisitorUser): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(visitor));
}

export function rotateVisitorUser(): VisitorUser {
  const visitor = createVisitorUser();
  saveVisitorUser(visitor);
  return visitor;
}
