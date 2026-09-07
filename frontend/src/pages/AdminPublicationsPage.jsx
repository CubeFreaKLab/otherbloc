import { Link, useSearchParams } from 'react-router-dom'
import SessionBoundary from '../components/SessionBoundary'
import ContentState from '../components/ContentState/ContentState'
import { PublicationLoading, PublicationPagination } from '../components/PublicationFeed/PublicationFeed'
import { useResource } from '../hooks/useResource'
import { statusLabels } from '../services/publicationEditor'
import '../styles/editor.css'

function ModerationQueue() {
  const [params, setParams] = useSearchParams()
  const selected = params.get('status') || 'review'
  const query = new URLSearchParams({ status: selected })
  if (params.has('cursor')) query.set('cursor', params.get('cursor'))
  const { data, status, error, retry } = useResource('/publications/moderation?' + query)
  return <>
    <div className="author-toolbar"><p>Revisa el contenido antes de aprobarlo. Solo su autor puede editarlo.</p><label className="form-field">Estado <select value={selected} onChange={(event) => setParams({ status: event.target.value })}>{['review', 'published', 'archived'].map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label></div>
    {status === 'loading' ? <PublicationLoading /> : status === 'error' ? <ContentState status="error" message={error.message} onRetry={retry} /> : <>
      {data.items.length ? <div className="author-publications">{data.items.map((publication) => <article className="author-publication" key={publication.id}>
        <div><span className="publication-status">{statusLabels[publication.status]}</span><h2><Link to={'/admin/publications/' + publication.id}>{publication.title}</Link></h2><p>{publication.type} · {publication.category}</p></div>
        <Link className="text-link" to={'/admin/publications/' + publication.id}>Revisar publicación</Link>
      </article>)}</div> : <ContentState message="No hay publicaciones en esta cola." />}
      <PublicationPagination nextCursor={data.nextCursor} />
    </>}
  </>
}

export default function AdminPublicationsPage() {
  return <main id="main-content" tabIndex={-1} className="page-width account-page"><header className="account-heading"><Link className="text-link" to="/account">Mi cuenta</Link><h1>Revisión de publicaciones</h1><span className="eyebrow">Administración</span></header><SessionBoundary roles={['admin']}><ModerationQueue /></SessionBoundary></main>
}
