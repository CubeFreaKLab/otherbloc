import { useEffect, useState } from 'react'
import { gatewayRequest } from '../services/gatewayClient'

export function useResource(path) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState({ path: null, status: 'loading', data: null, error: null })
  useEffect(() => {
    const controller = new AbortController()
    setResult({ path, status: 'loading', data: null, error: null })
    gatewayRequest(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setResult({ path, status: 'success', data, error: null })
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ path, status: 'error', data: null, error })
    })
    return () => controller.abort()
  }, [path, revision])
  return { ...(result.path === path ? result : { status: 'loading', data: null, error: null }), retry: () => setRevision((value) => value + 1) }
}
