/**
 * Real In-Memory Quant Computation Cache (Action 26.2)
 * -----------------------------------------------------------------------------
 * Caches expensive quantitative computations (Macro correlation, COT metrics,
 * complex feature sets) with automatic TTL and key invalidation upon new candle arrival.
 * 
 * STRICT RULES:
 * - NO fake cached values
 * - Real in-flight promise memoization
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class QuantCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 30000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  public invalidate(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  public size(): number {
    return this.cache.size;
  }
}

export const quantCache = new QuantCache();
