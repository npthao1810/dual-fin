import { useEffect } from 'react'
import { syncOfflineQueue } from '../lib/offlineSync'

export function useOfflineSync() {
  useEffect(() => {
    syncOfflineQueue()

    function onOnline() {
      syncOfflineQueue()
    }
    function onVisible() {
      if (document.visibilityState === 'visible') syncOfflineQueue()
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
