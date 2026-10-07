export interface CacheEntry<T> {
  savedAt: string;
  data: T;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function cacheKey(parts: string[]): string {
  return `vibecheck:${fnv1a(parts.map((p) => p.trim()).join("\u0000"))}`;
}

export function readCached<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.savedAt !== "string" || parsed.data === undefined) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCached<T>(key: string, data: T): CacheEntry<T> {
  const entry: CacheEntry<T> = { savedAt: new Date().toISOString(), data };
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // fail open to live calls when storage is unavailable (private mode / quota)
    }
  }
  return entry;
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? iso : date.toLocaleString();
}
