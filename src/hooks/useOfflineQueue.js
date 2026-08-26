import { useEffect, useState } from 'react'
import { getQueue, subscribeToQueue } from '../lib/offlineQueue'

export function useOfflineQueue() {
  const [queue, setQueue] = useState(getQueue)

  useEffect(() => subscribeToQueue(() => setQueue(getQueue())), [])

  return queue
}
