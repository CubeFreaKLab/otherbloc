import { useSyncExternalStore } from 'react'
import { getSession, subscribeSession } from '../services/gatewayClient'

export function useSession() { return useSyncExternalStore(subscribeSession, getSession, getSession) }
