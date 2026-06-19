interface CacheConfig {
  ttlMs?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class PageCache {
  private static cache = new Map<string, CacheEntry<any>>();

  /**
   * Caches a promise-returning function based on its arguments.
   * If the arguments match, and the cached entry is still valid, the cached result is returned.
   * Properly preserves 'this' context when used on class or object literal methods.
   */
  static memoize<Args extends any[], Return>(
    fn: (...args: Args) => Promise<Return>,
    cacheKeyPrefix: string,
    config?: CacheConfig
  ): (...args: Args) => Promise<Return> {
    const ttlMs = config?.ttlMs ?? 300000; // Default: 5 minutes

    return function(this: any, ...args: Args): Promise<Return> {
      const key = `${cacheKeyPrefix}:${JSON.stringify(args)}`;
      const entry = PageCache.cache.get(key);

      if (entry) {
        const age = Date.now() - entry.timestamp;
        if (age < ttlMs) {
          return Promise.resolve(entry.data);
        } else {
          PageCache.cache.delete(key);
        }
      }

      // Execute original function preserving 'this' context
      return fn.apply(this, args).then((result) => {
        PageCache.cache.set(key, { data: result, timestamp: Date.now() });
        return result;
      });
    };
  }

  /**
   * Invalidates all cache entries starting with the specified prefix.
   */
  static invalidate(cacheKeyPrefix: string): void {
    for (const key of PageCache.cache.keys()) {
      if (key.startsWith(`${cacheKeyPrefix}:`)) {
        PageCache.cache.delete(key);
      }
    }
  }

  /**
   * Clears the entire cache.
   */
  static clear(): void {
    PageCache.cache.clear();
  }
}
