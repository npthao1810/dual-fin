import { useMemo } from 'react'
import { useOfflineQueue } from './useOfflineQueue'
import { useHousehold } from '../context/HouseholdContext'

/** Locally-queued (not yet synced) new expenses for this household, shaped like server rows. */
export function usePendingExpenses({ startDate, endDate, tripId } = {}) {
  const queue = useOfflineQueue()
  const { household, categories } = useHousehold()

  return useMemo(() => {
    if (!household) return []
    return queue
      .filter((item) => item.table === 'expenses' && item.op === 'insert' && item.payload)
      .filter((item) => item.payload.household_id === household.id)
      .filter((item) => !startDate || item.payload.date >= startDate)
      .filter((item) => !endDate || item.payload.date <= endDate)
      .filter((item) => (tripId ? item.payload.trip_id === tripId : true))
      .map((item) => ({
        ...item.payload,
        categories: categories.find((c) => c.id === item.payload.category_id) ?? null,
        pending: true,
        pendingOp: 'insert',
        queueId: item.id,
        queuedAt: item.queuedAt,
        status: item.status,
        errorMessage: item.errorMessage,
      }))
      .sort((a, b) => b.queuedAt.localeCompare(a.queuedAt))
  }, [queue, household, categories, startDate, endDate, tripId])
}
