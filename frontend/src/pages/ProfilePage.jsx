import { useParams, useSearchParams } from 'react-router-dom'
import AuthorCard from '../components/AuthorCard/AuthorCard'
import PublicationFeed from '../components/PublicationFeed/PublicationFeed'
import { useResource } from '../hooks/useResource'
import { usePageTitle } from '../hooks/usePageTitle'
import { loadPublications, publicRequest } from '../services/publications'
import '../styles/account.css'
import NotFoundPage from './NotFoundPage'

export default function ProfilePage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data, status, error, retry } = useResource('/users/' + encodeURIComponent(id ?? 'missing'), publicRequest)
  const cursor = params.get('cursor')
  const publications = useResource('/publications?authorId=' + encodeURIComponent(id ?? 'missing') + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), loadPublications)
  usePageTitle(data?.user.name ? 'Publicaciones de ' + data.user.name : 'Perfil')
  if (error?.status === 404) return <NotFoundPage resource="cuenta" />
  if (status === 'loading') return <main id="main-content" tabIndex={-1} className="page-width page-main profile-page"><h1>Perfil</h1><div className="session-state" aria-busy="true" role="status"><div className="text-skeleton" /><p>Cargando perfil…</p></div></main>
  if (status === 'error') return <main id="main-content" tabIndex={-1} className="page-width page-main profile-page"><h1>No se pudo cargar el perfil</h1><p role="alert">{error.message}</p><button className="secondary-button" onClick={retry}>Reintentar</button></main>
  const author = data.user
  return (
    <main id="main-content" tabIndex={-1} className="page-width page-main profile-page">
      <AuthorCard author={author} />
      <section className="section-space" aria-labelledby="author-writing">
        <div className="section-heading">
          <h1 id="author-writing">Publicaciones de {author.name}</h1>
          {publications.data && <span>{publications.data.items.length} publicaciones{publications.data.nextCursor || cursor ? ' en esta página' : ''}</span>}
        </div>
        <PublicationFeed resource={publications} layout="profile" emptyMessage="Todavía no hay publicaciones públicas de esta cuenta." />
      </section>
    </main>
  )
}
