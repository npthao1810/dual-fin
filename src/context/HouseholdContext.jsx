import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const HouseholdContext = createContext(null)

export function HouseholdProvider({ children }) {
  const { user } = useAuth()
  const [household, setHousehold] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchHousehold = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: householdData, error: householdError } = await supabase
      .from('households')
      .select('*')
      .or(`member_1_id.eq.${user.id},member_2_id.eq.${user.id}`)
      .maybeSingle()

    if (householdError) {
      setError(householdError.message)
      setLoading(false)
      return
    }

    setHousehold(householdData)

    if (householdData) {
      const { data: categoryData } = await supabase
        .from('categories')
        .select('*')
        .eq('household_id', householdData.id)
        .order('name')
      setCategories(categoryData ?? [])
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchHousehold()
  }, [fetchHousehold])

  const value = {
    household,
    categories,
    loading,
    error,
    refresh: fetchHousehold,
  }

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}
