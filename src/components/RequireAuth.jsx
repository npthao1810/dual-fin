import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useOfflineSync } from '../hooks/useOfflineSync'
import LoadingScreen from './LoadingScreen'

export default function RequireAuth({ children }) {
  const { user, loading: authLoading } = useAuth()
  const { household, loading: householdLoading, error, refresh: refreshHousehold } = useHousehold()
  useOfflineSync(refreshHousehold)

  if (authLoading) {
    return <LoadingScreen />
  }

  if (!user) return <Navigate to="/login" replace />

  if (householdLoading) {
    return <LoadingScreen />
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-orange-50 px-6 text-center text-rose-500">
        {error}
        <button
          type="button"
          onClick={() => refreshHousehold()}
          className="rounded-full bg-pink-500 px-5 py-2 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!household) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-orange-50 px-6 text-center text-stone-400">
        No household is set up for this account yet. Ask whoever set up Supabase to add you to a
        household.
      </div>
    )
  }

  return children
}
