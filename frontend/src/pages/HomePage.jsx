import { ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import ArticleCard from '../components/ArticleCard/ArticleCard'
import FeaturedArticle from '../components/FeaturedArticle/FeaturedArticle'
import { articles } from '../data/articles'

export default function HomePage() {
  return (
    <main>
      <section className="masthead page-width" aria-label="otherbloc">
        <img src="/brand/otherbloc-logo-black.svg" alt="otherbloc" />
        <p>Digital publishing platform</p>
      </section>

      <section className="page-width section-space section-space--first">
        <FeaturedArticle article={articles[0]} />
      </section>

      <section className="page-width section-space" aria-labelledby="latest-heading">
        <div className="section-heading">
          <h2 id="latest-heading">Latest articles</h2>
          <Link className="text-link" to="/explore">
            View all <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
        <div className="article-grid article-grid--home">
          {articles.slice(1, 4).map((article, index) => (
            <ArticleCard key={article.slug} article={article} featured={index === 0} />
          ))}
        </div>
      </section>

      <section className="newsletter page-width section-space" aria-labelledby="newsletter-heading">
        <div>
          <h2 id="newsletter-heading">Thoughtful reads. Straight to your inbox.</h2>
          <p>A concise selection from otherbloc, sent twice a month.</p>
        </div>
        <form className="newsletter__form">
          <label htmlFor="newsletter-email">Email address</label>
          <div>
            <input id="newsletter-email" type="email" placeholder="you@example.com" />
            <button type="submit">Subscribe</button>
          </div>
        </form>
      </section>
    </main>
  )
}
