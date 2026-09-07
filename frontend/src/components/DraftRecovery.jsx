import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import Link from './MotionLink'
import { useSession } from '../hooks/useSession'
import { downloadRecovery, forgetRecovery, hasRecovery, listRecovery, recoveryRevision, subscribeRecovery } from '../services/draftRecovery'
import EditorConfirmation from './PublicationEditor/EditorConfirmation'

export function RecoveryChoice({ entry, onRestore, versioned = false }) {
  if (!entry) return null
  return <section className="recovery-choice" aria-label="Cambios recuperables"><h2>Recuperar tu trabajo</h2><p>Hay cambios de esta pestaña que no llegaron a confirmarse. Recupéralos para revisarlos o descarta la copia temporal desde el aviso superior antes de continuar.{versioned && ' La copia del servidor no se reemplaza sin comprobar su versión.'}</p><button type="button" className="secondary-button" onClick={() => { onRestore(entry.payload); forgetRecovery(entry.ownerId, entry.key) }}>Recuperar cambios de esta pestaña</button></section>
}

export default function DraftRecoveryNotice() {
  useSyncExternalStore(subscribeRecovery, recoveryRevision)
  const { user } = useSession(), location = useLocation(), [selected, setSelected] = useState(null)
  const present = hasRecovery(), entries = listRecovery(user?.id)
  const selectedEntry = entries.find((entry) => selected === JSON.stringify([entry.ownerId, entry.key]))
  useEffect(() => {
    if (!present) return
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [present])
  if (!present) return null
  return <aside className="draft-recovery page-width" aria-label="Recuperación de cambios"><h2>Tus cambios siguen en esta pestaña</h2>
    <p role="status">{user ? 'Recupéralos en su formulario o descarga una copia. No cierres ni recargues esta pestaña antes de conservarlos.' : 'La sesión se interrumpió. Vuelve a entrar con la misma cuenta para recuperar los cambios. Si entras con otra cuenta, esta copia se elimina por privacidad. No cierres ni recargues esta pestaña.'}</p>
    {!user && !['/login', '/register'].includes(location.pathname) && <Link className="text-link" to={'/login?returnTo=' + encodeURIComponent(location.pathname + location.search)}>Volver a entrar</Link>}
    {entries.map((entry) => <div className="recovery-entry" key={entry.key}><Link className="text-link" to={entry.path}>{entry.label}</Link><button className="text-button" type="button" onClick={() => downloadRecovery(entry)}>Descargar copia de {entry.label.toLowerCase()}</button><button className="text-button" type="button" onClick={() => setSelected(JSON.stringify([entry.ownerId, entry.key]))}>Descartar copia de {entry.label.toLowerCase()}</button></div>)}
    <EditorConfirmation action={selectedEntry ? { title: '¿Descartar estos cambios recuperables?', message: 'Se borrará únicamente la copia temporal de esta pestaña. No cambia lo guardado en el servidor.', label: 'Descartar copia temporal' } : null} busy={false} onCancel={() => setSelected(null)} onConfirm={() => { if (selectedEntry) forgetRecovery(selectedEntry.ownerId, selectedEntry.key); setSelected(null) }} />
  </aside>
}
