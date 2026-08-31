import { BookmarkSimple, ShareNetwork } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router-dom'
import AuthorCard from '../components/AuthorCard/AuthorCard'
import CategoryTag from '../components/CategoryTag/CategoryTag'
import { articles } from '../data/articles'
import { formatDate } from '../utils/formatDate'

export default function ArticlePage() {
  const { slug } = useParams()
  const article = articles.find((item) => item.slug === slug) ?? articles[1]

  return (
    <main className="article-page page-width page-main">
      <nav className="article-page__back" aria-label="Article breadcrumb">
        <Link to="/explore">Back to explore</Link>
      </nav>
      <header className="article-page__header">
        <div>
          <CategoryTag>{article.category}</CategoryTag>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
          <div className="article-page__meta">
            <span>{article.author}</span>
            <span>{article.readTime}</span>
            <time dateTime={article.date}>{formatDate(article.date)}</time>
          </div>
        </div>
        <div className="article-page__actions" aria-label="Article actions">
          <button type="button"><BookmarkSimple size={19} /> Save</button>
          <button type="button"><ShareNetwork size={19} /> Share</button>
        </div>
      </header>

      <img className="article-page__hero" src={article.image} alt={article.imageAlt} />

      <div className="article-page__body-grid">
        <article className="article-prose">
          <p className="article-prose__lead">
            Distributed systems are everywhere. That does not mean they need to be complex. The essential work is deciding where separation creates clarity and where it only creates distance.
          </p>
          <h2 id="introduction">Start with the boundaries</h2>
          <p>
            A service boundary should express a stable responsibility. When the boundary is clear, teams can reason about data, failure, and change without carrying the entire system in their heads.
          </p>
          <p>
            The useful question is not how many services a product has. It is whether each service can be understood, tested, and operated on its own terms.
          </p>
          <h2 id="core-concepts">Keep communication explicit</h2>
          <p>
            APIs are contracts. They reveal dependencies and make the cost of coordination visible. A good contract stays small, names its failures, and does not expose internal implementation details.
          </p>
          <blockquote>
            Architecture is useful when it makes responsibility easier to see.
          </blockquote>
          <h2 id="final-thoughts">Choose the simplest credible structure</h2>
          <p>
            Begin with the architecture the project actually needs. Add complexity only when a measured constraint demands it, and document every decision that changes how the system is understood.
          </p>
        </article>
        <aside className="article-page__contents">
          <h2>On this page</h2>
          <a href="#introduction">Start with the boundaries</a>
          <a href="#core-concepts">Keep communication explicit</a>
          <a href="#final-thoughts">Choose the simplest structure</a>
        </aside>
      </div>

      <AuthorCard />
    </main>
  )
}
