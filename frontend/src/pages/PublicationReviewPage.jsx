import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Link from '../components/MotionLink'
import SessionBoundary from '../components/SessionBoundary'
import EditorialDialog from '../components/EditorialDialog'
import UnsavedChanges from '../components/UnsavedChanges'
import ContentState from '../components/ContentState/ContentState'
import { PublicationLoading } from '../components/PublicationFeed/PublicationFeed'
import PublicationPreview from '../components/PublicationEditor/PublicationPreview'
import { useResource } from '../hooks/useResource'
import { usePageTitle } from '../hooks/usePageTitle'
import { changePublicationStatus, statusLabels } from '../services/publicationEditor'
import '../styles/editor.css'

const actions = {
  published: { title: '¿Aprobar esta publicación?', description: 'La versión que acabas de revisar será visible para visitantes.', label: 'Aprobar y publicar' },
  draft: { title: '¿Devolver al autor?', description: 'Volverá a ser un borrador privado. Explica qué necesita mejorar antes de enviarla otra vez.', label: 'Devolver a borrador' },
  archived: { title: '¿Archivar esta publicación?', description: 'Dejará de estar disponible para visitantes. Su autor podrá recuperarla como borrador.', label: 'Confirmar archivo' },
}

function Review({ initial, reload }) {
  const [publication, setPublication] = useState(initial), [action, setAction] = useState(null), [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(null), [notice, setNotice] = useState('')
  const pending = useRef(false)
  usePageTitle(publication.title + ' · Revisión')
  const choose = (status) => { setReason(''); setError(null); setAction(status) }
  async function confirm(event) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setBusy(true); setError(null)
    try {
      const changed = await changePublicationStatus(publication, action, reason)
      setPublication(changed); setReason(''); setAction(null)
      setNotice(changed.status === 'draft' ? 'Publicación devuelta. El autor recibirá tu observación en su espacio de publicaciones.' : 'Estado actualizado: ' + statusLabels[changed.status].toLowerCase() + '.')
    } catch (error) { setError(error) }
    finally { pending.current = false; setBusy(false) }
  }
  return <>
    <UnsavedChanges dirty={Boolean(reason.trim())} pending={busy} />
    <p className="publication-status">{statusLabels[publication.status]} · Versión {publication.version}</p>
    {notice && <p className="success-message" role="status">{notice}</p>}
    {publication.status === 'draft' ? <p>El contenido vuelve a estar bajo el control de su autor. Ya no está disponible en esta cola.</p> : <>
      <div className="form-actions"><Link className="text-link" to={'/profile/' + publication.authorId}>Ver perfil del autor</Link>{publication.status === 'published' && <Link className="text-link" to={'/article/' + publication.id}>Leer publicación pública</Link>}</div>
      <PublicationPreview publicationId={publication.id} document={publication} />
      {publication.moderationNote && <p className="moderation-note">Observación: {publication.moderationNote.reason}</p>}
      <section className="account-section"><h2>Decisión de revisión</h2><div className="form-actions">
        {publication.status === 'review' && <><button type="button" className="primary-button" disabled={busy} onClick={() => choose('published')}>Aprobar publicación</button><button type="button" className="secondary-button" disabled={busy} onClick={() => choose('draft')}>Devolver al autor</button></>}
        {publication.status === 'published' && <button type="button" className="secondary-button" disabled={busy} onClick={() => choose('archived')}>Archivar publicación</button>}
        {publication.status === 'archived' && <p>Solo su autor puede recuperar esta publicación como borrador.</p>}
      </div></section>
    </>}
    <EditorialDialog open={Boolean(action)} aria-labelledby="review-confirm-title" onCancel={(event) => { event.preventDefault(); if (!busy) { setAction(null); setReason('') } }}>
      <h2 id="review-confirm-title">{actions[action]?.title}</h2><p>{actions[action]?.description}</p>
      <form className="account-form" onSubmit={confirm} aria-busy={busy}>
        {action !== 'published' && <div className="form-field"><label htmlFor="moderation-reason">Motivo para el autor</label><textarea id="moderation-reason" rows={4} required maxLength={1000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /><small>Obligatorio. Hasta 1000 caracteres.</small></div>}
        {error && <div className="form-feedback" role="alert"><p>{error.message}</p>{error.status === 409 && <p>La publicación cambió desde que la abriste. Cancela y carga la versión actual antes de decidir.</p>}</div>}
        <div className="form-actions"><button className="secondary-button" type="button" disabled={busy} onClick={() => { setAction(null); setReason('') }}>Cancelar</button><button className="primary-button" disabled={busy || error?.status === 409 || (action !== 'published' && !reason.trim())}>{busy ? 'Procesando…' : actions[action]?.label}</button></div>
      </form>
    </EditorialDialog>
    {!action && error?.status === 409 && <div className="form-feedback" role="alert"><p>{error.message}</p><button type="button" className="secondary-button" onClick={reload}>Cargar versión actual</button></div>}
  </>
}

function ReviewLoader({ id }) {
  const { data, status, error, retry } = useResource('/publications/' + encodeURIComponent(id))
  if (status === 'loading') return <PublicationLoading feature />
  if (status === 'error') return <ContentState status="error" message={error.status === 404 ? 'No encontramos esta publicación o ya no está disponible para revisión.' : error.message} onRetry={retry} />
  return <Review initial={data.publication} reload={retry} />
}

export default function PublicationReviewPage() {
  const { id } = useParams()
  return <main id="main-content" tabIndex={-1} className="page-width account-page"><header className="account-heading"><Link className="text-link" to="/admin/publications">Cola de revisión</Link><h1>Revisar publicación</h1></header><SessionBoundary roles={['admin']}><ReviewLoader id={id} /></SessionBoundary></main>
}
