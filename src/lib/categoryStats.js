import { toISODate } from './format'

const WINDOW_DAYS = 60

/** Lower-case, accent-insensitive text for matching ("Cà phê" -> "ca phe"). */
export function normalize(text) {
  // Lower-case first: "Đ" only folds to "d" once it is "đ".
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
}

/**
 * Category ids ordered by how often they were used recently. `expenses` is
 * expected newest-first, so ties keep the most recently used category first.
 * Falls back to all-time counts when nothing falls inside the recent window.
 */
export function rankCategoryIds(expenses, now = new Date()) {
  const cutoff = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - WINDOW_DAYS))
  function count(rows) {
    const counts = new Map()
    for (const e of rows) {
      if (!e.category_id) continue
      counts.set(e.category_id, (counts.get(e.category_id) ?? 0) + 1)
    }
    return counts
  }
  let counts = count(expenses.filter((e) => !e.date || e.date >= cutoff))
  if (counts.size === 0) counts = count(expenses)
  // Array.sort is stable, so equal counts keep first-seen (most recent) order.
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

/**
 * Best guess at the category for a note, from how similar notes were
 * categorised before. Returns a category id or null.
 */
export function suggestCategoryId(note, expenses) {
  const q = normalize(note)
  if (q.length < 2) return null
  const counts = new Map()
  // People repeat the lead word and vary the rest ("grab to work" / "Grab office").
  const lead = q.split(/\s+/)[0]
  for (const e of expenses) {
    if (!e.category_id || !e.note) continue
    const n = normalize(e.note)
    if (n.includes(q) || (n.length >= 3 && q.includes(n)) || (lead.length >= 3 && n.split(/\s+/)[0] === lead)) {
      counts.set(e.category_id, (counts.get(e.category_id) ?? 0) + 1)
    }
  }
  let best = null
  let bestCount = 0
  for (const [id, c] of counts) {
    if (c > bestCount) {
      best = id
      bestCount = c
    }
  }
  return best
}
