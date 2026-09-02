import { supabase } from './supabase'
import { getQueue, removeFromQueue, markQueueItemError } from './offlineQueue'
import { isNetworkError } from './network'

let syncing = false

export async function syncOfflineQueue() {
  if (syncing || !navigator.onLine) return
  syncing = true
  try {
    for (const item of getQueue()) {
      if (item.status === 'error') continue
      const { status: _status, errorMessage: _errorMessage, queuedAt: _queuedAt, ...payload } = item

      try {
        const { error } = await supabase.from('expenses').insert(payload)
        if (error) {
          if (isNetworkError(error)) continue
          markQueueItemError(item.id, error.message)
          continue
        }
        removeFromQueue(item.id)
      } catch {
        // Genuine network failure — leave queued, retry on the next sync pass.
      }
    }
  } finally {
    syncing = false
  }
}
