import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { findRecovery, recoveryRevision, registerRecovery, subscribeRecovery } from '../services/draftRecovery'

export function useDraftRecovery({ ownerId, key, path, label, read }) {
  const latest = useRef(read)
  useLayoutEffect(() => { latest.current = read })
  useEffect(() => registerRecovery({ ownerId, key, path, label, read: () => latest.current() }), [ownerId, key, path, label])
  useSyncExternalStore(subscribeRecovery, recoveryRevision)
  return findRecovery(ownerId, key)
}
