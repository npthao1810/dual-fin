import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HouseholdProvider, useHousehold } from '../context/HouseholdContext'

function HouseholdGate({ children }) {
  const { household, loading, error } = useHousehold()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-rose-400">
        {error}
      </div>
    )
  }

  if (!household) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-slate-400">
        No household is set up for this account yet. Ask whoever set up Supabase to add you to a
        household.
      </div>
    )
  }

  return children
}

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <HouseholdProvider>
      <HouseholdGate>{children}</HouseholdGate>
    </HouseholdProvider>
  )
}
