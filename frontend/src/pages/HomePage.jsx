import { ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import ArticleCard from '../components/ArticleCard/ArticleCard'
import FeaturedArticle from '../components/FeaturedArticle/FeaturedArticle'
import { useResource } from '../hooks/useResource'
import { usePageTitle } from '../hooks/usePageTitle'
import { loadPublications } from '../services/publications'
import ContentState from '../components/ContentState/ContentState'
import { PublicationLoading } from '../components/PublicationFeed/PublicationFeed'

export default function HomePage() {
  const { data, status, error, retry } = useResource('/publications?limit=7', loadPublications)
  const articles = data?.items ?? []
  usePageTitle(articles[0]?.title ?? 'Últimas publicaciones')
  if (status !== 'success' || !articles.length) return <main id="main-content" tabIndex={-1} className="home-page page-width page-main">
    <h1 className="visually-hidden">Últimas publicaciones</h1>
    {status === 'loading' ? <PublicationLoading feature /> : <ContentState status={status === 'error' ? 'error' : 'empty'} message={error?.message ?? 'Todavía no hay publicaciones. Vuelve pronto para descubrir nuevas lecturas.'} onRetry={status === 'error' ? retry : undefined} />}
  </main>
  return (
    <main id="main-content" tabIndex={-1} className="home-page">
      <section className="page-width section-space section-space--first">
        <FeaturedArticle article={articles[0]} />
      </section>
      <section className="page-width section-space" aria-labelledby="latest-heading">
        <div className="section-heading">
          <h2 id="latest-heading">Últimas publicaciones</h2>
          <Link className="text-link" to="/explore">Explorar todas <ArrowRight aria-hidden="true" size={17} /></Link>
        </div>
        <div className="article-grid article-grid--home">
          {articles.slice(1).map((article, index) => <ArticleCard key={article.slug} article={article} featured={index === 0 || index === 5} />)}
        </div>
        {articles.some((item) => item.demo) && <p className="demo-label">Edición de muestra · Incluye publicaciones y perfiles de demostración.</p>}
      </section>
    </main>
  )
}
