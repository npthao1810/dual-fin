import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

/**
 * The session supabase-js persisted last time, read synchronously. Lets the app
 * start as "signed in" immediately instead of waiting on the library — which,
 * when the access token has expired, first does a network refresh. The real
 * session still arrives via onAuthStateChange and replaces (or clears) this.
 */
function readStoredSession() {
  try {
    const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
    const raw = localStorage.getItem(`sb-${ref}-auth-token`)
    const stored = raw ? JSON.parse(raw) : null
    return stored?.user?.id && stored?.refresh_token ? stored : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession)
  // With a stored session there's nothing to wait for — render from cache now.
  const [loading, setLoading] = useState(() => !readStoredSession())

  useEffect(() => {
    // onAuthStateChange fires an INITIAL_SESSION event as soon as it resolves
    // the current session — internally the exact same lookup getSession()
    // does — so a separate getSession() call here was just duplicating that
    // work on every mount for no benefit.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
