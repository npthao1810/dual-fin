import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'

/** Budgets for a given month (YYYY-MM-01), joined with category info. */
export function useBudgets(month) {
  const { household } = useHousehold()
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchBudgets = useCallback(async () => {
    if (!household) return
    setLoading(true)
    const { data, error } = await supabase
      .from('budgets')
      .select('*, categories(id, name, icon, color)')
      .eq('household_id', household.id)
      .eq('month', month)

    if (!error) setBudgets(data ?? [])
    setLoading(false)
  }, [household, month])

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

  return { budgets, loading, refresh: fetchBudgets, upsertBudget }
}
