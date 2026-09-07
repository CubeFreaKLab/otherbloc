import { useCallback, useEffect, useRef, useState } from 'react'
import { editorDocument, savePublication } from '../services/publicationEditor'
import { ApiError } from '../services/gatewayClient'

export function usePublicationEditor(initial, paused = false) {
  const [document, setDocument] = useState(() => editorDocument(initial))
  const [publication, setPublication] = useState(initial)
  const [savedKey, setSavedKey] = useState(() => JSON.stringify(editorDocument(initial)))
  const [busy, setBusy] = useState(false), [error, setError] = useState(null)
  const currentDocument = useRef(document), currentPublication = useRef(initial), saved = useRef(savedKey), pending = useRef(null)
  const dirty = JSON.stringify(document) !== savedKey

  const update = useCallback((change) => {
    const next = typeof change === 'function' ? change(currentDocument.current) : change
    currentDocument.current = next; setDocument(next)
    setError((previous) => previous?.code === 'version_conflict' ? previous : null)
  }, [])

  const save = useCallback(async function saveCurrent() {
    if (pending.current) {
      await pending.current
      return saveCurrent()
    }
    const draft = currentDocument.current, snapshot = JSON.stringify(draft), base = currentPublication.current
    if (base.status !== 'draft' || snapshot === saved.current) return base
    setBusy(true); setError(null)
    const flight = (async () => {
      try {
        const result = await savePublication(base.id, draft, base.version)
        currentPublication.current = result; setPublication(result)
        saved.current = snapshot; setSavedKey(snapshot)
        return result
      } catch (error) { setError(error); throw error }
      finally { pending.current = null; setBusy(false) }
    })()
    pending.current = flight
    return flight
  }, [])

  const accept = useCallback((value, replaceDocument = false) => {
    currentPublication.current = value; setPublication(value); setError(null)
    if (replaceDocument) {
      const next = editorDocument(value), key = JSON.stringify(next)
      currentDocument.current = next; setDocument(next); saved.current = key; setSavedKey(key)
    }
  }, [])

  const restore = useCallback(({ document: draft, baseVersion }) => {
    const base = currentPublication.current
    currentDocument.current = draft; setDocument(draft)
    if (base.version !== baseVersion) {
      // Keep the actual edit base; recovery must never silently adopt a newer server version.
      currentPublication.current = { ...base, version: baseVersion }; setPublication(currentPublication.current)
      setError(new ApiError('El servidor cambió mientras tu sesión estaba interrumpida. Tus cambios se recuperaron sin sobrescribirlo. Descarga tu copia o recupera la versión del servidor.', 409, 'version_conflict'))
    } else setError(null)
  }, [])

  useEffect(() => {
    if (!dirty || busy || error || paused || publication.status !== 'draft') return
    const timer = setTimeout(() => save().catch(() => {}), 1200)
    return () => clearTimeout(timer)
  }, [document, dirty, busy, error, paused, publication.status, save])

  return { document, publication, dirty, busy, error, update, save, accept, restore }
}
