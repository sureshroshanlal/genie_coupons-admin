export const memoryCacheStore = (() => {
  const store = new Map(); // key -> { value: any, expiresAt: number }

  function now() {
    return Date.now();
  }

  function isExpired(entry) {
    return entry && entry.expiresAt > 0 && entry.expiresAt <= now();
  }

  async function get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      store.delete(key);
      return null;
    }
    return entry.value;
  }

  async function set(key, value, ttlSeconds = 0) {
    const ttlMs = Number(ttlSeconds) > 0 ? Number(ttlSeconds) * 1000 : 0;
    const expiresAt = ttlMs > 0 ? now() + ttlMs : 0;
    store.set(key, { value, expiresAt });
    return true;
  }

  async function del(key) {
    store.delete(key);
  }

  async function flush() {
    store.clear();
  }

  return { get, set, del, flush };
})();
