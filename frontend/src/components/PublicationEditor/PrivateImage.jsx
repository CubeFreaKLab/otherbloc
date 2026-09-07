import { useEffect, useState } from 'react'
import { gatewayRequest } from '../../services/gatewayClient'

export default function PrivateImage({ path, alt, className }) {
  const [state, setState] = useState({ path: null, url: null, error: null })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    let objectUrl
    gatewayRequest(path.slice(4), { signal: controller.signal, responseType: 'blob' }).then((blob) => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setState({ path, url: objectUrl, error: null })
    }).catch((error) => { if (!controller.signal.aborted) setState({ path, url: null, error: error.message }) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path, revision])
  if (!path) return null
  if (state.path === path && state.url) return <img className={className} src={state.url} alt={alt} />
  if (state.path === path && state.error) return <div className="editor-image-state"><p role="alert">{state.error}</p><button type="button" className="text-button" onClick={() => { setState({ path: null, url: null, error: null }); setRevision((value) => value + 1) }}>Reintentar imagen</button></div>
  return <div className="editor-image-state" role="status" aria-busy="true">Cargando imagen…</div>
}
