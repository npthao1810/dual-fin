import { useState } from 'react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { removeFromQueue, retryQueueItems } from '../lib/offlineQueue'
import { syncOfflineQueue } from '../lib/offlineSync'
import BottomSheet from './BottomSheet'

const TABLE_LABELS = {
  expenses: 'Expense',
  categories: 'Category',
  trips: 'Trip',
  households: 'Settings',
  budgets: 'Budget',
}

const OP_LABELS = { insert: 'added', update: 'edited', upsert: 'saved', delete: 'deleted' }

function describe(item) {
  const what = TABLE_LABELS[item.table] ?? item.table
  const detail = item.payload?.note || item.payload?.name || ''
  return `${what} ${OP_LABELS[item.op] ?? item.op}${detail ? ` · ${detail}` : ''}`
}

export default function StatusBanner() {
  const isOnline = useOnlineStatus()
  const queue = useOfflineQueue()
  const [open, setOpen] = useState(false)
  const pendingCount = queue.filter((item) => item.status === 'pending').length
  const failed = queue.filter((item) => item.status === 'error')
  const errorCount = failed.length

  // Leaving the sheet open on an empty list would pop it back up the next time something fails.
  function closeIfLast() {
    if (errorCount <= 1) setOpen(false)
  }

  function discard(id) {
    removeFromQueue(id)
    closeIfLast()
  }

  function retry(id) {
    if (id == null) setOpen(false)
    else closeIfLast()
    retryQueueItems(id)
    syncOfflineQueue()
  }

  if (!isOnline) {
    return (
      <div className="bg-stone-700 px-4 py-2 text-center text-xs font-semibold text-white">
        📡 Offline — changes will sync automatically{pendingCount > 0 ? ` (${pendingCount} waiting)` : ''}
      </div>
    )
  }

  if (errorCount > 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full bg-rose-500 px-4 py-2 text-center text-xs font-semibold text-white"
        >
          ⚠️ {errorCount} change{errorCount > 1 ? 's' : ''} couldn't sync — tap to review
        </button>
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Changes that couldn't sync">
          <ul className="space-y-2">
            {failed.map((item) => (
              <li key={item.id} className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
                <p className="text-sm font-semibold text-stone-700">{describe(item)}</p>
                <p className="mt-0.5 break-words text-xs text-rose-500">{item.errorMessage}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => retry(item.id)}
                    className="rounded-full bg-pink-500 px-3 py-1 text-xs font-bold text-white"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => discard(item.id)}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-bold text-stone-500"
                  >
                    Discard
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {errorCount > 1 && (
            <button
              type="button"
              onClick={() => retry(null)}
              className="mt-3 w-full rounded-full bg-stone-800 py-2.5 text-sm font-bold text-white"
            >
              Retry all
            </button>
          )}
        </BottomSheet>
      </>
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
