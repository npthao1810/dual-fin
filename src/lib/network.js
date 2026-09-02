/** Best-effort check for "we're offline / the request never reached the server" vs a real API error. */
export function isNetworkError(error) {
  const message = (error?.message ?? '').toLowerCase()
  return message.includes('fetch') || message.includes('network') || message.includes('load failed')
}
