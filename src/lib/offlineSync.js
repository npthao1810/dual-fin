import { getQueue, removeFromQueue, markQueueItemError } from './offlineQueue'
import { runMutation } from './mutate'
import { isNetworkError } from './network'

let syncing = false

export async function syncOfflineQueue() {
  if (syncing || !navigator.onLine) return
  syncing = true
  try {
    for (const item of getQueue()) {
      if (item.status === 'error') continue

      try {
        const { error } = await runMutation(item)
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
