import { ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import ArticleCard from '../components/ArticleCard/ArticleCard'
import FeaturedArticle from '../components/FeaturedArticle/FeaturedArticle'
import { articles } from '../data/articles'

export default function HomePage() {
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
        <p className="demo-label">Edición de muestra · Publicaciones y perfiles de demostración.</p>
      </section>
    </main>
  )
}
