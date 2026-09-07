import { useId } from 'react'
import EditorialDialog from '../EditorialDialog'

export default function EditorConfirmation({ action, busy, onCancel, onConfirm }) {
  const titleId = useId()
  return <EditorialDialog open={Boolean(action)} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <h2 id={titleId}>{action?.title}</h2><p>{action?.message}</p>
    <div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className="primary-button" disabled={busy} onClick={onConfirm}>{busy ? 'Procesando…' : action?.label}</button></div>
  </EditorialDialog>
}
