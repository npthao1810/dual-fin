import { useCallback, useState } from 'react'

/**
 * useState that survives navigating away and back (and a page reload) within
 * the same browser session, but starts fresh the next time the app is opened.
 * Falls back to plain state when sessionStorage is unavailable.
 */
export function useSessionState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw != null) return JSON.parse(raw)
    } catch {
      // ignore unreadable or unavailable storage
    }
    return initial
  })

  const set = useCallback(
    (next) => {
      setValue(next)
      try {
        sessionStorage.setItem(key, JSON.stringify(next))
      } catch {
        // ignore quota / private-mode errors
      }
    },
    [key]
  )

  return [value, set]
}
