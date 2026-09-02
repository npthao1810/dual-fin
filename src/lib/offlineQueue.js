const STORAGE_KEY = 'dualfin.offlineExpenseQueue'
const QUEUE_EVENT = 'dualfin:offlinequeue'

export function getQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setQueue(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(QUEUE_EVENT))
}

/**
 * Queue a Supabase write to replay once we're back online.
 * - op: 'insert' | 'update' | 'delete' | 'upsert'
 * - match: primary-key filter for 'update'/'delete', e.g. { id }
 * - payload: row data for 'insert'/'update'/'upsert'
 * - options: passed through to .upsert(), e.g. { onConflict }
 */
export function enqueueMutation({ table, op, match = null, payload = null, options = null }) {
  const queue = getQueue()
  // Inserts keep the row's own id as the queue id, so a still-pending row
  // (an expense, say) can be found and discarded by the same id used
  // everywhere else in the UI.
  const id = op === 'insert' && payload?.id ? payload.id : crypto.randomUUID()
  const item = {
    id,
    table,
    op,
    match,
    payload,
    options,
    queuedAt: new Date().toISOString(),
    status: 'pending',
    errorMessage: null,
  }
  queue.push(item)
  setQueue(queue)
  return item
}

export function removeFromQueue(id) {
  setQueue(getQueue().filter((item) => item.id !== id))
}

export function markQueueItemError(id, message) {
  setQueue(
    getQueue().map((item) => (item.id === id ? { ...item, status: 'error', errorMessage: message } : item))
  )
}

export function subscribeToQueue(callback) {
  window.addEventListener(QUEUE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(QUEUE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
