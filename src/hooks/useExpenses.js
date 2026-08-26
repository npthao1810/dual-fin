import { useCallback, useEffect, useId, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'

/**
 * Fetches expenses for a household with optional filters, and stays live via
 * a Supabase Realtime subscription on the expenses table.
 */
export function useExpenses({ startDate, endDate, tripId } = {}) {
  const { household } = useHousehold()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const channelId = useId()

  const fetchExpenses = useCallback(async () => {
    if (!household) return
    setLoading(true)
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
    if (!error) setExpenses(data ?? [])
    setLoading(false)
  }, [household, startDate, endDate, tripId])

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
