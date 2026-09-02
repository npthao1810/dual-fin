import { useEffect } from 'react'
import { syncOfflineQueue } from '../lib/offlineSync'

/** Drives the offline queue, and optionally calls onSynced after each pass (e.g. to refresh data that has no realtime subscription). */
export function useOfflineSync(onSynced) {
  useEffect(() => {
    function runSync() {
      syncOfflineQueue().finally(() => onSynced?.())
    }

    runSync()

    function onOnline() {
      runSync()
    }
    function onVisible() {
      if (document.visibilityState === 'visible') runSync()
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
