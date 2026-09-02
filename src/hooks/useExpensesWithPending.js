import { useExpenses } from './useExpenses'
import { usePendingExpenses } from './usePendingExpenses'
import { useOfflineQueue } from './useOfflineQueue'

/**
 * Like useExpenses, but overlays locally-queued (not-yet-synced) inserts,
 * edits, and deletes so nothing done offline disappears from view — a
 * queued edit shows the new values with a "pending sync" badge, and a
 * queued delete is hidden immediately.
 */
export function useExpensesWithPending(filters) {
  const { expenses, loading, refresh } = useExpenses(filters)
  const pendingInserts = usePendingExpenses(filters)
  const queue = useOfflineQueue()

  const pendingUpdates = new Map()
  const pendingDeletes = new Set()
  for (const item of queue) {
    if (item.table !== 'expenses' || !item.match?.id) continue
    if (item.op === 'update') pendingUpdates.set(item.match.id, item)
    if (item.op === 'delete') pendingDeletes.add(item.match.id)
  }

  const serverIds = new Set(expenses.map((e) => e.id))
  const visiblePending = pendingInserts.filter((p) => !serverIds.has(p.id))

  const patched = expenses
    .filter((e) => !pendingDeletes.has(e.id))
    .map((e) => {
      const update = pendingUpdates.get(e.id)
      if (!update) return e
      return {
        ...e,
        ...update.payload,
        pending: true,
        pendingOp: 'update',
        queueId: update.id,
        status: update.status,
        errorMessage: update.errorMessage,
      }
    })

  const merged = [...visiblePending, ...patched].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    const aTime = a.queuedAt ?? a.created_at
    const bTime = b.queuedAt ?? b.created_at
    return aTime < bTime ? 1 : aTime > bTime ? -1 : 0
  })

  return { expenses: merged, loading, refresh }
}
