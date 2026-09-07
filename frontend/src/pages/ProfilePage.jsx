import { useParams } from 'react-router-dom'
import ArticleCard from '../components/ArticleCard/ArticleCard'
import AuthorCard from '../components/AuthorCard/AuthorCard'
import { articles } from '../data/articles'
import { useResource } from '../hooks/useResource'
import '../styles/account.css'
import NotFoundPage from './NotFoundPage'

export default function ProfilePage() {
  const { id } = useParams()
  const { data, status, error, retry } = useResource('/users/' + encodeURIComponent(id ?? 'missing'))
  if (error?.status === 404) return <NotFoundPage resource="cuenta" />
  if (status === 'loading') return <main id="main-content" tabIndex={-1} className="page-width page-main profile-page"><h1>Perfil</h1><div className="session-state" aria-busy="true" role="status"><div className="text-skeleton" /><p>Cargando perfil…</p></div></main>
  if (status === 'error') return <main id="main-content" tabIndex={-1} className="page-width page-main profile-page"><h1>No se pudo cargar el perfil</h1><p role="alert">{error.message}</p><button className="secondary-button" onClick={retry}>Reintentar</button></main>
  const author = data.user
  const publications = articles.filter((article) => article.authorId === id)
  return (
    <main id="main-content" tabIndex={-1} className="page-width page-main profile-page">
      <AuthorCard author={author} />
      <section className="section-space" aria-labelledby="author-writing">
        <div className="section-heading">
          <h1 id="author-writing">Publicaciones de {author.name}</h1>
          <span>{publications.length} publicaciones</span>
        </div>
        <div className="article-grid article-grid--profile">
          {publications.map((article) => <ArticleCard key={article.slug} article={article} featured />)}
        </div>
        {!publications.length && <p role="status">Todavía no hay publicaciones públicas de esta cuenta.</p>}
      </section>
    </main>
  )
}
