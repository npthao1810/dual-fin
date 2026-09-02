import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOfflineQueue } from '../hooks/useOfflineQueue'

export default function StatusBanner() {
  const isOnline = useOnlineStatus()
  const queue = useOfflineQueue()
  const pendingCount = queue.filter((item) => item.status === 'pending').length
  const errorCount = queue.filter((item) => item.status === 'error').length

  if (!isOnline) {
    return (
      <div className="bg-stone-700 px-4 py-2 text-center text-xs font-semibold text-white">
        📡 Offline — changes will sync automatically{pendingCount > 0 ? ` (${pendingCount} waiting)` : ''}
      </div>
    )
  }

  if (errorCount > 0) {
    return (
      <div className="bg-rose-500 px-4 py-2 text-center text-xs font-semibold text-white">
        ⚠️ {errorCount} change{errorCount > 1 ? 's' : ''} couldn't sync
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-stone-900">
        🔄 Syncing {pendingCount} change{pendingCount > 1 ? 's' : ''}…
      </div>
    )
  }

  return null
}
