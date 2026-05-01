const inProcessCache = new Map()

function resolveCacheKey(key, req) {
  if (typeof key === 'function') return String(key(req))
  return String(key)
}

function withCache(key, ttlMs, getData) {
  return async (req, res, next) => {
    try {
      const cacheKey = resolveCacheKey(key, req)
      const now = Date.now()
      const hit = inProcessCache.get(cacheKey)
      if (hit && now - hit.ts < ttlMs) {
        return res.json(hit.data)
      }

      const data = await getData(req)
      inProcessCache.set(cacheKey, { data, ts: now })
      return res.json(data)
    } catch (err) {
      return next(err)
    }
  }
}

function clearCacheByPrefix(prefix) {
  const normalized = String(prefix)
  for (const key of inProcessCache.keys()) {
    if (key.startsWith(normalized)) {
      inProcessCache.delete(key)
    }
  }
}

module.exports = {
  withCache,
  clearCacheByPrefix
}

