import { useExpenses } from './useExpenses'
import { usePendingExpenses } from './usePendingExpenses'

/** Like useExpenses, but includes locally-queued (not-yet-synced) expenses, sorted together. */
export function useExpensesWithPending(filters) {
  const { expenses, loading, refresh } = useExpenses(filters)
  const pending = usePendingExpenses(filters)

  const serverIds = new Set(expenses.map((e) => e.id))
  const visiblePending = pending.filter((p) => !serverIds.has(p.id))

  const merged = [...visiblePending, ...expenses].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    const aTime = a.pending ? a.queuedAt : a.created_at
    const bTime = b.pending ? b.queuedAt : b.created_at
    return aTime < bTime ? 1 : aTime > bTime ? -1 : 0
  })

  return { expenses: merged, loading, refresh }
}
