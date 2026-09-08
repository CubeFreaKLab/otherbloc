import { useCallback, useEffect, useRef, useState } from 'react'
import { gatewayRequest } from '../services/gatewayClient'
import { createId } from '../utils/createId'
import { useMotionNavigate } from './useMotionNavigate'

export function useCreatePublication({ replace = false } = {}) {
  const navigate = useMotionNavigate(), creation = useRef(null), pending = useRef(false), active = useRef(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const create = useCallback(async () => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    creation.current ??= createId()
    try {
      const { publication } = await gatewayRequest('/publications', { method: 'POST', body: { id: creation.current } })
      if (active.current) navigate('/author/publications/' + publication.id, { replace })
    } catch (error) { if (active.current) setError(error.message) }
    finally { pending.current = false; if (active.current) setBusy(false) }
  }, [navigate, replace])
  return { create, busy, error }
}
