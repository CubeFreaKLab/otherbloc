import { useCallback, useEffect, useRef, useState } from 'react'
import { editorDocument, savePublication } from '../services/publicationEditor'

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

  useEffect(() => {
    if (!dirty || busy || error || paused || publication.status !== 'draft') return
    const timer = setTimeout(() => save().catch(() => {}), 1200)
    return () => clearTimeout(timer)
  }, [document, dirty, busy, error, paused, publication.status, save])

  return { document, publication, dirty, busy, error, update, save, accept }
}
