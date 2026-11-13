import { toISODate } from './format'

/** Compact amount for a calendar cell: 320000 -> "320k", 1250000 -> "1.3M". */
export function compactAmount(n) {
  const v = Math.round(Number(n) || 0)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`
  return String(v)
}

/**
 * Cells for a month grid, Monday first. Leading/trailing nulls pad the weeks,
 * so the result length is always a multiple of 7.
 */
export function monthGrid(year, month) {
  const first = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const cells = Array(lead).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, month - 1, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** 'ok' | 'near' | 'over' | 'none' for a day's spend against a per-day limit. */
export function dayLevel(spent, limit) {
  if (!spent) return 'none'
  if (!limit) return 'ok'
  const ratio = spent / limit
  if (ratio > 1) return 'over'
  if (ratio >= 0.8) return 'near'
  return 'ok'
}
