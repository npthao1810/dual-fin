import { supabase } from './supabase'
import { enqueueMutation } from './offlineQueue'
import { isNetworkError } from './network'

/** Executes one queued (or live) mutation against Supabase. */
export async function runMutation({ table, op, match, payload, options }) {
  const query = supabase.from(table)
  if (op === 'insert') return query.insert(payload)
  if (op === 'update') return query.update(payload).match(match)
  if (op === 'delete') return query.delete().match(match)
  if (op === 'upsert') return query.upsert(payload, options ?? undefined)
  throw new Error(`Unknown mutation op: ${op}`)
}

/**
 * Run a Supabase write, falling back to the offline queue when there's no
 * network — either because we already know we're offline, or the request
 * itself fails with a network-shaped error. Queued mutations replay
 * automatically once the connection comes back (see offlineSync.js), so
 * nothing typed offline is silently lost.
 */
export async function mutateOrQueue(mutation) {
  if (!navigator.onLine) {
    enqueueMutation(mutation)
    return { queued: true, error: null }
  }

  try {
    const { error } = await runMutation(mutation)
    if (error) {
      if (isNetworkError(error)) {
        enqueueMutation(mutation)
        return { queued: true, error: null }
      }
      return { queued: false, error }
    }
    return { queued: false, error: null }
  } catch {
    enqueueMutation(mutation)
    return { queued: true, error: null }
  }
}
