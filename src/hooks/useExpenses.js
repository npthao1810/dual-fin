import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { readCache, writeCache } from '../lib/localCache'

function cacheKeyFor(householdId, filters) {
  return `expenses:${householdId}:${JSON.stringify(filters)}`
}

/**
 * Fetches expenses for a household with optional filters, and stays live via
 * a Supabase Realtime subscription on the expenses table. Renders instantly
 * from the last-known-good cached result for these filters, then silently
 * revalidates in the background — a spinner only shows up when there's
 * nothing cached yet for this exact query.
 */
export function useExpenses({ startDate, endDate, tripId } = {}) {
  const { household } = useHousehold()
  const key = household ? cacheKeyFor(household.id, { startDate, endDate, tripId }) : null
  const [expenses, setExpenses] = useState(() => (key && readCache(key)) || [])
  const [loading, setLoading] = useState(() => !(key && readCache(key)))
  const loadedKeyRef = useRef(key)
  const channelId = useId()

  const fetchExpenses = useCallback(async () => {
    if (!household || !key) return

    // A different query shape than what's on screen — swap to its cache
    // (or empty) immediately instead of showing stale data from before.
    if (loadedKeyRef.current !== key) {
      const cached = readCache(key)
      setExpenses(cached ?? [])
      setLoading(!cached)
      loadedKeyRef.current = key
    }

    let query = supabase
      .from('expenses')
      .select('*, categories(id, name, icon, color)')
      .eq('household_id', household.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)
    if (tripId) query = query.eq('trip_id', tripId)

    const { data, error } = await query
    if (!error) {
      setExpenses(data ?? [])
      writeCache(key, data ?? [])
    }
    setLoading(false)
  }, [household, key, startDate, endDate, tripId])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  useEffect(() => {
    if (!household) return
    const channel = supabase
      .channel(`expenses-${household.id}-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `household_id=eq.${household.id}` },
        () => fetchExpenses()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [household, fetchExpenses, channelId])

  return { expenses, loading, refresh: fetchExpenses }
}
