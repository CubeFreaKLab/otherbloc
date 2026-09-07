import { useEffect, useState } from 'react'
import { gatewayRequest } from '../services/gatewayClient'

export function useResource(path, loader = gatewayRequest, initial = null) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState(() => initial?.path === path ? initial : { path: null, status: 'loading', data: null, error: null })
  useEffect(() => {
    if (initial?.path === path && revision === 0) { setResult(initial); return }
    const controller = new AbortController()
    setResult({ path, status: 'loading', data: null, error: null })
    loader(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setResult({ path, status: 'success', data, error: null })
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ path, status: 'error', data: null, error })
    })
    return () => controller.abort()
  }, [path, revision, loader, initial])
  return { ...(result.path === path ? result : initial?.path === path ? initial : { status: 'loading', data: null, error: null }), retry: () => setRevision((value) => value + 1) }
}
