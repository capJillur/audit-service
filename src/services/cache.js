/**
 * Minimal in-memory TTL cache. Good enough for a single-instance deployment;
 * swap `get`/`set`/`delete` for a Redis client if you scale horizontally.
 */
class TtlCache {
  constructor({ ttlSeconds, maxEntries = 1000 } = {}) {
    this.ttlMs = ttlSeconds * 1000;
    this.maxEntries = maxEntries;
    this.store = new Map(); // key -> { value, expiresAt }
  }

  _isExpired(entry) {
    return entry.expiresAt <= Date.now();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlSecondsOverride) {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      // Evict the oldest entry (Map preserves insertion order)
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }
    const ttlMs = ttlSecondsOverride !== undefined ? ttlSecondsOverride * 1000 : this.ttlMs;
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  get size() {
    return this.store.size;
  }
}

module.exports = TtlCache;
