/** Best-effort check for "we're offline / the request never reached the server" vs a real API error. */
export function isNetworkError(error) {
  const message = (error?.message ?? '').toLowerCase()
  return message.includes('fetch') || message.includes('network') || message.includes('load failed')
}

/**
 * A queued insert whose row id already exists on the server — the first send
 * got through (e.g. the response was lost, or two tabs synced at once), so the
 * row is saved and the queued copy is just a leftover.
 */
export function isDuplicateInsert(error, op) {
  if (op !== 'insert' || !error) return false
  const message = (error.message ?? '').toLowerCase()
  return error.code === '23505' && message.includes('_pkey')
}
