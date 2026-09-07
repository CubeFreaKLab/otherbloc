import { useParams } from 'react-router-dom'
import ArticleCard from '../components/ArticleCard/ArticleCard'
import AuthorCard from '../components/AuthorCard/AuthorCard'
import { articles, authors } from '../data/articles'
import NotFoundPage from './NotFoundPage'

export default function ProfilePage() {
  const { id } = useParams()
  const author = authors.find((item) => item.id === id)
  if (!author) return <NotFoundPage resource="cuenta" />
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
      </section>
    </main>
  )
}
