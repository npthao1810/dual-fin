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
  // Token refreshes hand out a new user object for the same person — only a
  // different id should restart the household load.
  const userId = user?.id
  // Start from the cached household so the very first render is already real —
  // no loader frame while an effect catches up. Only a real household counts.
  const [initial] = useState(() => {
    const cached = userId ? readCache(cacheKeyFor(userId)) : null
    return cached?.household ? cached : null
  })
  const [household, setHousehold] = useState(initial?.household ?? null)
  const [categories, setCategories] = useState(initial?.categories ?? [])
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState(null)
  // Tracks whether *this* user already has real data on screen, so a
  // background revalidation never yanks the UI back to a spinner or an
  // error page — it just quietly succeeds or quietly fails.
  const hasLoadedRef = useRef(!!initial)

  const fetchHousehold = useCallback(async () => {
    if (!userId) return
    const key = cacheKeyFor(userId)

    if (!hasLoadedRef.current) {
      const cached = readCache(key)
      // Only a real household counts as "already loaded". A cached null would
      // flash the "no household" screen until the network answer arrives.
      if (cached?.household) {
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
      .or(`member_1_id.eq.${userId},member_2_id.eq.${userId}`)
      .maybeSingle()

    if (householdError) {
      setLoading(false)
      // With nothing cached to show, any failure must surface as an error —
      // otherwise the page falls through to "no household" even though we
      // simply never reached the server.
      if (!hasLoadedRef.current) {
        setError(
          isNetworkError(householdError)
            ? "Can't reach the server. Check your connection and try again."
            : householdError.message
        )
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
    // Never cache "no household" — see the cache read above.
    if (householdData) writeCache(key, { household: householdData, categories: categoryData })
  }, [userId])

  useEffect(() => {
    hasLoadedRef.current = false
    if (!userId) {
      setHousehold(null)
      setCategories([])
      setError(null)
      setLoading(true)
      return
    }
    fetchHousehold()
  }, [userId, fetchHousehold])

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
