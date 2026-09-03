import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { readCache, writeCache } from '../lib/localCache'

function cacheKeyFor(householdId) {
  return `trips:${householdId}`
}

/**
 * All trips for the household — the single source of truth every page that
 * needs a trip list (or a specific trip) reads from, instead of each page
 * running its own ad-hoc fetch. Cached for instant, offline-friendly reads;
 * combine with useRowsWithPending for locally-queued creates/edits/deletes.
 */
export function useTrips() {
  const { household } = useHousehold()
  const key = household ? cacheKeyFor(household.id) : null
  const [trips, setTrips] = useState(() => (key && readCache(key)) || [])
  const [loading, setLoading] = useState(() => !(key && readCache(key)))

  const fetchTrips = useCallback(async () => {
    if (!household || !key) return
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('household_id', household.id)
      .order('start_date', { ascending: false })

    // Keep showing cached/current trips if this fetch failed (e.g. offline).
    if (!error) {
      setTrips(data ?? [])
      writeCache(key, data ?? [])
    }
    setLoading(false)
  }, [household, key])

  useEffect(() => {
    fetchTrips()
  }, [fetchTrips])

  return { trips, loading, refresh: fetchTrips }
}
