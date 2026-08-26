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

export function enqueueExpense(expense) {
  const queue = getQueue()
  queue.push({ ...expense, status: 'pending', errorMessage: null })
  setQueue(queue)
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
