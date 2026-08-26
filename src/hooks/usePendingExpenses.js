import { useMemo } from 'react'
import { useOfflineQueue } from './useOfflineQueue'
import { useHousehold } from '../context/HouseholdContext'

export function usePendingExpenses({ startDate, endDate, tripId } = {}) {
  const queue = useOfflineQueue()
  const { household, categories } = useHousehold()

  return useMemo(() => {
    if (!household) return []
    return queue
      .filter((item) => item.household_id === household.id)
      .filter((item) => !startDate || item.date >= startDate)
      .filter((item) => !endDate || item.date <= endDate)
      .filter((item) => (tripId ? item.trip_id === tripId : true))
      .map((item) => ({
        ...item,
        categories: categories.find((c) => c.id === item.category_id) ?? null,
        pending: true,
      }))
      .sort((a, b) => b.queuedAt.localeCompare(a.queuedAt))
  }, [queue, household, categories, startDate, endDate, tripId])
}
