import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { readCache, writeCache } from '../lib/localCache'

function cacheKeyFor(householdId, month) {
  return `budgets:${householdId}:${month}`
}

/** Budgets for a given month (YYYY-MM-01), joined with category info. Cached for instant, offline-friendly reads. */
export function useBudgets(month) {
  const { household } = useHousehold()
  const key = household ? cacheKeyFor(household.id, month) : null
  const [budgets, setBudgets] = useState(() => (key && readCache(key)) || [])
  const [loading, setLoading] = useState(() => !(key && readCache(key)))
  const loadedKeyRef = useRef(key)

  const fetchBudgets = useCallback(async () => {
    if (!household || !key) return

    if (loadedKeyRef.current !== key) {
      const cached = readCache(key)
      setBudgets(cached ?? [])
      setLoading(!cached)
      loadedKeyRef.current = key
    }

    const { data, error } = await supabase
      .from('budgets')
      .select('*, categories(id, name, icon, color)')
      .eq('household_id', household.id)
      .eq('month', month)

    if (!error) {
      setBudgets(data ?? [])
      writeCache(key, data ?? [])
    }
    setLoading(false)
  }, [household, key, month])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  async function upsertBudget(categoryId, limitAmount) {
    if (!household) return
    const { error } = await supabase.from('budgets').upsert(
      {
        household_id: household.id,
        category_id: categoryId,
        month,
        limit_amount: limitAmount,
      },
      { onConflict: 'household_id,category_id,month' }
    )
    if (!error) await fetchBudgets()
    return error
  }

  async function deleteBudget(categoryId) {
    if (!household) return
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('household_id', household.id)
      .eq('category_id', categoryId)
      .eq('month', month)
    if (!error) await fetchBudgets()
    return error
  }

  return { budgets, loading, refresh: fetchBudgets, upsertBudget, deleteBudget }
}
