import type { ProfileData } from './types';

const PREFIX = 'ghs:v1:';
const TTL = 15 * 60 * 1000;
const MAX_ENTRIES = 6;

export interface CacheHit {
  data: ProfileData;
  age: number;
  stale: boolean;
}

export function readCache(handle: string): CacheHit | null {
  try {
    const raw = localStorage.getItem(PREFIX + handle.toLowerCase());
    if (!raw) return null;

    const data = JSON.parse(raw) as ProfileData;
    if (!data?.user?.login || typeof data.fetchedAt !== 'number') return null;

    const age = Date.now() - data.fetchedAt;
    return {
      data,
      age,
      stale: age < 0 || age > TTL,
    };
  } catch {
    return null;
  }
}

export function writeCache(data: ProfileData): void {
  try {
    localStorage.setItem(
      PREFIX + data.user.login.toLowerCase(),
      JSON.stringify(data),
    );
    prune();
  } catch {
    // Private mode or quota exceeded. Caching is optional.
  }
}

function prune(): void {
  const entries: { key: string; fetchedAt: number }[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(PREFIX)) continue;

    try {
      const data = JSON.parse(localStorage.getItem(key) ?? '') as ProfileData;
      entries.push({
        key,
        fetchedAt:
          typeof data.fetchedAt === 'number' ? data.fetchedAt : 0,
      });
    } catch {
      entries.push({ key, fetchedAt: 0 });
    }
  }

  if (entries.length <= MAX_ENTRIES) return;

  entries.sort((a, b) => b.fetchedAt - a.fetchedAt);

  for (const entry of entries.slice(MAX_ENTRIES)) {
    localStorage.removeItem(entry.key);
  }
}
