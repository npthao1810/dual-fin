import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { readCache, writeCache } from '../lib/localCache'
import { mutateOrQueue } from '../lib/mutate'

function cacheKeyFor(householdId, month) {
  return `monthly-budget-groups:${householdId}:${month}`
}

const EMPTY_BUDGET = { daily_limit: 0, trip_limit: 0 }

export function useMonthlyBudget(month) {
  const { household } = useHousehold()
  const key = household ? cacheKeyFor(household.id, month) : null
  const cached = key ? readCache(key) : null
  const [budget, setBudget] = useState(() => cached || EMPTY_BUDGET)
  const [loading, setLoading] = useState(() => !cached)
  const loadedKeyRef = useRef(key)

  const fetchBudget = useCallback(async () => {
    if (!household || !key) return
    if (loadedKeyRef.current !== key) {
      const nextCached = readCache(key)
      setBudget(nextCached ?? EMPTY_BUDGET)
      setLoading(!nextCached)
      loadedKeyRef.current = key
    }

    const { data, error } = await supabase
      .from('monthly_budget_groups')
      .select('*')
      .eq('household_id', household.id)
      .eq('month', month)
      .maybeSingle()

    if (!error) {
      const next = data ?? EMPTY_BUDGET
      setBudget(next)
      writeCache(key, next)
    }
    setLoading(false)
  }, [household, key, month])

  useEffect(() => {
    fetchBudget()
  }, [fetchBudget])

  async function saveBudget(dailyLimit, tripLimit) {
    if (!household || !key) return null
    const next = {
      household_id: household.id,
      month,
      daily_limit: Math.max(0, Number(dailyLimit) || 0),
      trip_limit: Math.max(0, Number(tripLimit) || 0),
      updated_at: new Date().toISOString(),
    }
    const optimistic = { ...budget, ...next }
    setBudget(optimistic)
    writeCache(key, optimistic)
    const { error } = await mutateOrQueue({
      table: 'monthly_budget_groups',
      op: 'upsert',
      payload: next,
      options: { onConflict: 'household_id,month' },
    })
    if (!error) await fetchBudget()
    return error
  }

  return { budget, loading, refresh: fetchBudget, saveBudget }
}
