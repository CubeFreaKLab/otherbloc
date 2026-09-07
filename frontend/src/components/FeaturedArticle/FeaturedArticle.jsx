import { ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/formatDate'
import './FeaturedArticle.css'

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
      <Link className="featured-article__image" to={`/article/${article.slug}`} tabIndex={-1}>
        <img src={article.image} srcSet={article.imageSrcSet} sizes="(max-width: 767px) 100vw, 60vw" width={article.coverWidth ?? 1536} height={article.coverHeight ?? 1024} alt={article.imageAlt} fetchPriority="high" />
      </Link>
    </article>
  )
}
