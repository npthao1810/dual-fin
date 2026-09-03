import { useOfflineQueue } from './useOfflineQueue'

/**
 * Overlays locally-queued (not-yet-synced) inserts/updates/deletes for one
 * table onto a base list of server rows, keyed by `id` — the generic version
 * of the pending-expense overlay, for anything without expenses' extra
 * filtering/sorting/category-joining needs (trips, categories, ...).
 *
 * `scope` narrows which queued inserts belong on this list, e.g. { household_id }.
 */
export function useRowsWithPending(baseRows, table, scope = null) {
  const queue = useOfflineQueue()

  const pendingInserts = queue
    .filter((item) => item.table === table && item.op === 'insert' && item.payload)
    .filter((item) => !scope || Object.entries(scope).every(([key, value]) => item.payload[key] === value))
    .map((item) => ({
      ...item.payload,
      pending: true,
      pendingOp: 'insert',
      queueId: item.id,
      queuedAt: item.queuedAt,
      status: item.status,
      errorMessage: item.errorMessage,
    }))

  const pendingUpdates = new Map()
  const pendingDeletes = new Set()
  for (const item of queue) {
    if (item.table !== table || !item.match?.id) continue
    if (item.op === 'update') pendingUpdates.set(item.match.id, item)
    if (item.op === 'delete') pendingDeletes.add(item.match.id)
  }

  const serverIds = new Set(baseRows.map((r) => r.id))
  const visibleInserts = pendingInserts.filter((r) => !serverIds.has(r.id))

  const patched = baseRows
    .filter((r) => !pendingDeletes.has(r.id))
    .map((r) => {
      const update = pendingUpdates.get(r.id)
      if (!update) return r
      return {
        ...r,
        ...update.payload,
        pending: true,
        pendingOp: 'update',
        queueId: update.id,
        status: update.status,
        errorMessage: update.errorMessage,
      }
    })

  return [...visibleInserts, ...patched]
}
