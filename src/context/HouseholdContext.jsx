import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { readCache, writeCache } from '../lib/localCache'
import { isNetworkError } from '../lib/network'

const HouseholdContext = createContext(null)

function cacheKeyFor(userId) {
  return `household:${userId}`
}

export function HouseholdProvider({ children }) {
  const { user } = useAuth()
  const [household, setHousehold] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Tracks whether *this* user already has real data on screen, so a
  // background revalidation never yanks the UI back to a spinner or an
  // error page — it just quietly succeeds or quietly fails.
  const hasLoadedRef = useRef(false)

  const fetchHousehold = useCallback(async () => {
    if (!user) return
    const key = cacheKeyFor(user.id)

    if (!hasLoadedRef.current) {
      const cached = readCache(key)
      if (cached) {
        setHousehold(cached.household)
        setCategories(cached.categories ?? [])
        setLoading(false)
        hasLoadedRef.current = true
      } else {
        setLoading(true)
      }
    }
    setError(null)

    const { data: householdData, error: householdError } = await supabase
      .from('households')
      .select('*')
      .or(`member_1_id.eq.${user.id},member_2_id.eq.${user.id}`)
      .maybeSingle()

    if (householdError) {
      setLoading(false)
      // Only block the UI on a real (non-network) error, and only when we
      // have nothing cached to show instead.
      if (!isNetworkError(householdError) && !hasLoadedRef.current) {
        setError(householdError.message)
      }
      return
    }

    let categoryData = []
    if (householdData) {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('household_id', householdData.id)
        .order('name')
      categoryData = data ?? []
    }

    setHousehold(householdData)
    setCategories(categoryData)
    setLoading(false)
    hasLoadedRef.current = true
    writeCache(key, { household: householdData, categories: categoryData })
  }, [user])

  useEffect(() => {
    hasLoadedRef.current = false
    if (!user) {
      setHousehold(null)
      setCategories([])
      setError(null)
      setLoading(true)
      return
    }
    fetchHousehold()
  }, [user, fetchHousehold])

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
