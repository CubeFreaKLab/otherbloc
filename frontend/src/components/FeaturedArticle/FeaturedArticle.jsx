import { ArrowRight } from '@phosphor-icons/react'
import ReadingThumbnail from '../ReadingThumbnail'
import Link from '../MotionLink'
import { formatDate } from '../../utils/formatDate'
import './FeaturedArticle.css'
import { featuredCoverSizes } from '../../services/readingCover'

export default function FeaturedArticle({ article }) {
  return (
    <article className="featured-article">
      <div className="featured-article__content">
        <span className="featured-article__label">Lectura destacada · {article.type}</span>
        <h1>{article.title}</h1>
        <p>{article.summary}</p>
        <div className="featured-article__meta">
          {article.authorProfile ? <Link to={`/profile/${article.authorId}`}>{article.author}</Link> : <span>{article.author}</span>}
          <span>{article.readTime}</span>
          <time dateTime={article.date}>{formatDate(article.date)}</time>
        </div>
        <Link className="text-link" to={`/article/${article.slug}`}>
          Leer publicación <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </div>
      <ReadingThumbnail article={article} className="featured-article__image" sizes={featuredCoverSizes} featured />
    </article>
  )
}
