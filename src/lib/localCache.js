const PREFIX = 'dualfin.cache.'

/**
 * Small localStorage-backed cache for last-known-good server data, keyed by
 * household/user + query shape. Lets pages render real data instantly from
 * disk (stale-while-revalidate) instead of blocking on a network round trip,
 * and keeps something on screen when that round trip fails offline.
 */
export function readCache(key) {
  if (!key) return null
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeCache(key, value) {
  if (!key) return
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // ignore quota / private-browsing errors — cache is a nice-to-have
  }
}
