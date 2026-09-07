import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SessionBoundary from '../components/SessionBoundary'
import ContentState from '../components/ContentState/ContentState'
import { PublicationLoading, PublicationPagination } from '../components/PublicationFeed/PublicationFeed'
import { useResource } from '../hooks/useResource'
import { gatewayRequest } from '../services/gatewayClient'
import { statusLabels } from '../services/publicationEditor'
import '../styles/editor.css'

function AuthorWorkspace() {
  const [params, setParams] = useSearchParams(), navigate = useNavigate()
  const query = new URLSearchParams()
  if (params.get('status')) query.set('status', params.get('status'))
  if (params.get('cursor')) query.set('cursor', params.get('cursor'))
  const { data, status, error, retry } = useResource('/publications/mine?' + query)
  const creation = useRef(null), pending = useRef(false)
  const [busy, setBusy] = useState(false), [createError, setCreateError] = useState('')
  async function create() {
    if (pending.current) return
    pending.current = true; setBusy(true); setCreateError('')
    creation.current ??= crypto.randomUUID()
    try {
      const { publication } = await gatewayRequest('/publications', { method: 'POST', body: { id: creation.current } })
      navigate('/author/publications/' + publication.id)
    } catch (error) { setCreateError(error.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <>
    <div className="author-toolbar"><button type="button" className="primary-button" onClick={create} disabled={busy}>{busy ? 'Creando borrador…' : 'Nueva publicación'}</button>
      <label className="form-field">Estado <select value={params.get('status') ?? ''} onChange={(event) => setParams(event.target.value ? { status: event.target.value } : {})}><option value="">Todos los estados</option>{Object.entries(statusLabels).map(([value, name]) => <option value={value} key={value}>{name}</option>)}</select></label>
    </div>
    {createError && <p className="form-feedback" role="alert">{createError}</p>}
    {status === 'loading' ? <PublicationLoading /> : status === 'error' ? <ContentState status="error" message={error.message} onRetry={retry} /> : <>
      {data.items.length ? <div className="author-publications">{data.items.map((publication) => <article className="author-publication" key={publication.id}>
        <div><span className="publication-status">{statusLabels[publication.status]}</span><h2><Link to={'/author/publications/' + publication.id}>{publication.title || 'Borrador sin título'}</Link></h2><p>{publication.type} · {publication.category}</p>{publication.moderationNote && <p className="moderation-note">Observación: {publication.moderationNote.reason}</p>}</div>
        <Link className="text-link" to={'/author/publications/' + publication.id}>{publication.status === 'draft' ? 'Editar borrador' : 'Ver publicación'}</Link>
      </article>)}</div> : <ContentState message={params.get('status') ? 'No tienes publicaciones con este estado.' : 'Tu próxima publicación empieza con una idea. Crea un borrador para comenzar.'} />}
      <PublicationPagination nextCursor={data.nextCursor} />
    </>}
  </>
}

export default function AuthorPage() {
  return <main id="main-content" tabIndex={-1} className="page-width account-page"><header className="account-heading"><Link className="text-link" to="/account">Mi cuenta</Link><h1>Mis publicaciones</h1><p>Un espacio para escribir, revisar y compartir tus ideas.</p></header><SessionBoundary roles={['author', 'admin']}><AuthorWorkspace /></SessionBoundary></main>
}
