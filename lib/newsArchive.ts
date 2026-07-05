// Permanent local archive for news + tweets.
// Pharos's site and the Twitter syndication feed only expose the most RECENT
// items — older ones rotate out upstream. To make sure nothing ever
// disappears from our feed, every successful fetch is merged into a JSON
// archive on disk (data/*.json). Items are deduped by a stable key and never
// deleted, so the timeline grows over time instead of shrinking.
// If the filesystem is read-only (e.g. serverless), we degrade gracefully to
// an in-memory archive for the life of the process.

import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

// In-memory mirror — survives fs failures and avoids re-reading on every hit.
const memory = new Map<string, Map<string, unknown>>();

async function loadArchive(file: string): Promise<Map<string, unknown>> {
  const cached = memory.get(file);
  if (cached) return cached;
  const map = new Map<string, unknown>();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    const arr = JSON.parse(raw) as Array<{ __key: string } & Record<string, unknown>>;
    for (const item of arr) {
      if (item && typeof item.__key === "string") map.set(item.__key, item);
    }
  } catch {
    // First run or unreadable file — start empty.
  }
  memory.set(file, map);
  return map;
}

async function saveArchive(file: string, map: Map<string, unknown>): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify([...map.values()]), "utf8");
  } catch {
    // Read-only fs — the in-memory mirror still keeps history for this process.
  }
}

/**
 * Merge fresh items into the named archive and return the FULL accumulated
 * list. `keyOf` must return a stable unique id (url, tweet id…).
 * Existing entries are updated in place (newer data wins); nothing is removed.
 */
export async function mergeIntoArchive<T extends object>(
  file: string,
  fresh: T[],
  keyOf: (item: T) => string
): Promise<T[]> {
  const map = await loadArchive(file);
  let changed = false;
  for (const item of fresh) {
    const key = keyOf(item);
    if (!key) continue;
    const prev = map.get(key) as (T & { __key: string }) | undefined;
    const next = { ...prev, ...item, __key: key };
    if (!prev || JSON.stringify(prev) !== JSON.stringify(next)) {
      map.set(key, next);
      changed = true;
    }
  }
  if (changed) await saveArchive(file, map);
  return [...map.values()].map((v) => {
    const { __key, ...rest } = v as T & { __key: string };
    void __key;
    return rest as unknown as T;
  });
}

/** Read the archive without merging (used when the upstream fetch fails). */
export async function readArchive<T>(file: string): Promise<T[]> {
  const map = await loadArchive(file);
  return [...map.values()].map((v) => {
    const { __key, ...rest } = v as Record<string, unknown> & { __key: string };
    void __key;
    return rest as unknown as T;
  });
}
