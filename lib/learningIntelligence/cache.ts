type CacheEntry<T> = {
  value: T;
  createdAt: number;
  expiresAt: number;
};

export class AIResponseCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const found = this.store.get(key);
    if (!found) return null;
    if (Date.now() > found.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return found.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    const now = Date.now();
    this.store.set(key, {
      value,
      createdAt: now,
      expiresAt: now + Math.max(1, ttlMs),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.store.clear();
  }

  createKey(parts: Array<string | number | undefined | null>): string {
    return parts
      .map((part) => String(part ?? ''))
      .join(':')
      .trim();
  }
}

export const learningCache = new AIResponseCache();

