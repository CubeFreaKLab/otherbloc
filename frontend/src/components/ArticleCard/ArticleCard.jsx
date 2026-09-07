import { ArrowRight } from '@phosphor-icons/react'
import { useViewTransitionState } from 'react-router-dom'
import Link from '../MotionLink'
import { formatDate } from '../../utils/formatDate'
import CategoryTag from '../CategoryTag/CategoryTag'
import './ArticleCard.css'
import { cardCoverSizes } from '../../services/readingCover'

export default function ArticleCard({ article, featured = false }) {
  const transitioning = useViewTransitionState('/article/' + article.slug)
  return (
    <article className={`article-card${featured ? ' article-card--featured' : ''}`}>
      <Link className="article-card__image-link" to={`/article/${article.slug}`} tabIndex={-1}>
        <img className={transitioning ? 'reading-cover-transition' : undefined} data-reading-slug={article.slug} src={article.image} srcSet={article.imageSrcSet} sizes={cardCoverSizes} width={article.coverWidth ?? 1536} height={article.coverHeight ?? 1024} alt={article.imageAlt} loading="lazy" />
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
          {article.authorProfile ? <Link to={`/profile/${article.authorId}`}>{article.author}</Link> : <span>{article.author}</span>}
          <time dateTime={article.date}>{formatDate(article.date)}</time>
        </div>
        <Link className="text-link article-card__read" to={`/article/${article.slug}`}>
          Leer publicación <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>
    </article>
  )
}
