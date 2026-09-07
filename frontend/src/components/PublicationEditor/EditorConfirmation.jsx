import { useEffect, useRef } from 'react'

export default function EditorConfirmation({ action, busy, onCancel, onConfirm }) {
  const dialog = useRef(null)
  useEffect(() => { if (action) dialog.current?.showModal(); else dialog.current?.close() }, [action])
  return <dialog ref={dialog} className="editorial-dialog" aria-labelledby="editor-confirm-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <h2 id="editor-confirm-title">{action?.title}</h2><p>{action?.message}</p>
    <div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className="primary-button" disabled={busy} onClick={onConfirm}>{busy ? 'Procesando…' : action?.label}</button></div>
  </dialog>
}
