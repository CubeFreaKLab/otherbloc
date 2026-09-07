import { ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/formatDate'
import CategoryTag from '../CategoryTag/CategoryTag'
import './ArticleCard.css'

export default function ArticleCard({ article, featured = false }) {
  return (
    <article className={`article-card${featured ? ' article-card--featured' : ''}`}>
      <Link className="article-card__image-link" to={`/article/${article.slug}`} tabIndex={-1}>
        <img src={article.image} srcSet={article.image.replace('.webp', '-640.webp') + ' 640w, ' + article.image.replace('.webp', '-960.webp') + ' 960w, ' + article.image + ' 1536w'} sizes="(max-width: 767px) 100vw, 50vw" width="1536" height="1024" alt={article.imageAlt} loading="lazy" />
      </Link>
      <div className="article-card__content">
        <div className="article-card__topline">
          <CategoryTag>{article.type} · {article.category}</CategoryTag>
          <span>{article.readTime}</span>
        </div>
        <h3>
          <Link to={`/article/${article.slug}`}>{article.title}</Link>
        </h3>
        {featured && <p>{article.summary}</p>}
        <div className="article-card__meta">
          <Link to={`/profile/${article.authorId}`}>{article.author}</Link>
          <time dateTime={article.date}>{formatDate(article.date)}</time>
        </div>
        <Link className="text-link article-card__read" to={`/article/${article.slug}`}>
          Leer publicación <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>
    </article>
  )
}
