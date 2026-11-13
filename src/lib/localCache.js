const PREFIX = 'dualfin.cache.'
const INDEX_KEY = `${PREFIX}__index`

// Expense caches come in one copy per query shape — and the Home period's end
// date is "today", so every day used to add another full copy. Left alone they
// fill localStorage (~5 MB), after which every write fails and the offline data
// freezes at whatever was saved last. Cap that family and evict the stalest.
const EXPENSE_FAMILY = 'expenses:'
const MAX_EXPENSE_KEYS = 8

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

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY)) ?? {}
  } catch {
    return {}
  }
}

function touch(key) {
  try {
    const index = readIndex()
    index[key] = Date.now()
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // The index is only a recency hint — losing a write is harmless.
  }
}

function expenseKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const name = localStorage.key(i)
    if (name?.startsWith(PREFIX)) {
      const key = name.slice(PREFIX.length)
      if (key.startsWith(EXPENSE_FAMILY)) keys.push(key)
    }
  }
  return keys
}

/** Higher = fresher. Keys never seen by the index (older app versions) are ranked by their end date. */
function rank(key, index) {
  if (index[key]) return index[key]
  try {
    const filters = JSON.parse(key.slice(key.indexOf(':', EXPENSE_FAMILY.length) + 1))
    if (!filters.endDate) return Date.now() // the unfiltered "all expenses" copy
    return Date.parse(filters.endDate) || 0
  } catch {
    return 0
  }
}

function removeStalest(keys, except = null) {
  const index = readIndex()
  const candidates = keys.filter((k) => k !== except).sort((a, b) => rank(a, index) - rank(b, index))
  if (candidates.length === 0) return false
  localStorage.removeItem(PREFIX + candidates[0])
  try {
    delete index[candidates[0]]
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // stale index entries are harmless
  }
  return true
}

/** Drops the stalest expense caches beyond the cap. Cheap — run once at startup and after each expense write. */
export function pruneCache() {
  try {
    let keys = expenseKeys()
    while (keys.length > MAX_EXPENSE_KEYS && removeStalest(keys)) keys = expenseKeys()
  } catch {
    // cache is a nice-to-have
  }
}

export function writeCache(key, value) {
  if (!key) return
  let json
  try {
    json = JSON.stringify(value)
  } catch {
    return
  }
  const isExpense = key.startsWith(EXPENSE_FAMILY)

  // On a full store, make room by evicting the stalest *other* expense cache and retry.
  for (let attempt = 0; attempt <= MAX_EXPENSE_KEYS; attempt++) {
    try {
      localStorage.setItem(PREFIX + key, json)
      touch(key)
      if (isExpense) pruneCache()
      return
    } catch {
      try {
        if (!removeStalest(expenseKeys(), key)) return
      } catch {
        return
      }
    }
  }
}
