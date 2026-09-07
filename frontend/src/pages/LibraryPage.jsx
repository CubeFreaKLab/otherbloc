import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SessionBoundary from '../components/SessionBoundary'
import ContentState from '../components/ContentState/ContentState'
import { PublicationLoading, PublicationPagination } from '../components/PublicationFeed/PublicationFeed'
import { SaveControl } from '../components/Interactions/InteractionControls'
import { useResource } from '../hooks/useResource'
import { useSession } from '../hooks/useSession'
import { followWriter, loadFollowingAuthors, loadSavedPublications } from '../services/interactionQueries'
import '../styles/account.css'

function RemoveFollow({ authorId, name, onRemove }) {
  const pending = useRef(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function remove() {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { if (!await followWriter(authorId, false)) onRemove() }
    catch (error) { setError(error.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className="interaction-control"><button type="button" className="interaction-button" disabled={busy} aria-label={name ? 'Dejar de seguir a ' + name : 'Quitar seguimiento no disponible'} onClick={remove}>{busy ? 'Quitando…' : 'Dejar de seguir'}</button>{error && <p className="form-feedback" role="alert">{error}</p>}</div>
}

function LibraryResults({ data, kind }) {
  const [removed, setRemoved] = useState([]), [notice, setNotice] = useState('')
  const items = data.items.filter((item) => !removed.includes(item.id))
  function remove(id) {
    setRemoved((current) => [...current, id])
    setNotice(kind === 'saved' ? 'Se quitó la publicación de tus guardadas.' : 'Dejaste de seguir esta cuenta.')
  }
  return <>
    {notice && <p className="success-message" role="status">{notice}</p>}
    {items.length ? <div className="library-list">{items.map((item) => <article className="library-item" key={item.id}>
      {kind === 'saved' ? <>
        {item.publication ? <><span className="library-item__meta">{item.publication.type} · {item.publication.category}</span><h2><Link to={'/article/' + item.publication.slug}>{item.publication.title}</Link></h2><p>{item.publication.summary}</p><span className="library-item__meta">{item.publication.author}</span></> : <><h2>Publicación no disponible</h2><p>Este contenido ya no es público. Puedes quitarlo de tus guardadas.</p></>}
        <SaveControl publicationId={item.publicationId} initialSaved onChange={(active) => { if (!active) remove(item.id) }} />
      </> : <>
        {item.author ? <><h2><Link to={'/profile/' + item.author.id}>{item.author.name}</Link></h2>{item.author.biography && <p>{item.author.biography}</p>}{!['author', 'admin'].includes(item.author.role) && <p className="library-item__meta">Esta cuenta ya no tiene acceso de autor.</p>}</> : <><h2>Cuenta no disponible</h2><p>Su perfil ya no es público. Puedes quitar este seguimiento.</p></>}
        <RemoveFollow authorId={item.authorId} name={item.author?.name} onRemove={() => remove(item.id)} />
      </>}
    </article>)}</div> : <ContentState message={data.nextCursor ? 'No quedan elementos en esta página. Puedes continuar a la siguiente.' : kind === 'saved' ? 'Todavía no tienes publicaciones guardadas aquí. Guarda una lectura para volver a ella cuando quieras.' : 'No hay autores seguidos aquí. Encuentra una voz que te interese y síguela desde su perfil o una publicación.'} />}
    <PublicationPagination nextCursor={data.nextCursor} />
  </>
}

function LibraryContent({ kind, viewer }) {
  const [params] = useSearchParams()
  const query = new URLSearchParams({ viewer })
  if (params.get('cursor')) query.set('cursor', params.get('cursor'))
  const path = '/library/' + kind + '?' + query
  const { data, status, error, retry } = useResource(path, kind === 'saved' ? loadSavedPublications : loadFollowingAuthors)
  if (status === 'loading') return <PublicationLoading />
  if (status === 'error') return <ContentState status="error" message={error.message} onRetry={retry} />
  return <LibraryResults key={path} data={data} kind={kind} />
}

function LibraryPage({ kind }) {
  const { user } = useSession()
  return <main id="main-content" className="account-page page-width" tabIndex={-1}><header className="account-heading"><div className="library-heading__top"><Link className="text-link" to="/account">Mi cuenta</Link><span className="eyebrow">Tu biblioteca personal</span></div><h1>{kind === 'saved' ? 'Publicaciones guardadas' : 'Autores que sigues'}</h1><p>{kind === 'saved' ? 'Lecturas a las que quieres volver. Esta lista solo la ves tú.' : 'Las voces que elegiste seguir. Esta lista solo la ves tú.'}</p><Link className="text-link" to="/explore">Explorar publicaciones</Link></header><SessionBoundary>{user && <LibraryContent key={user.id + ':' + kind} kind={kind} viewer={user.id} />}</SessionBoundary></main>
}

export function SavedPublicationsPage() { return <LibraryPage kind="saved" /> }
export function FollowingAuthorsPage() { return <LibraryPage kind="following" /> }
