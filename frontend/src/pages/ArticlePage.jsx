import { useState } from 'react'
import { BookmarkSimple, ShareNetwork } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router-dom'
import AuthorCard from '../components/AuthorCard/AuthorCard'
import CategoryTag from '../components/CategoryTag/CategoryTag'
import { articles, authors } from '../data/articles'
import { formatDate } from '../utils/formatDate'
import NotFoundPage from './NotFoundPage'

export function ArticleBlocks({ blocks }) {
  return blocks.map((block, index) => {
    if (block.type === 'heading') return <h2 key={index} id={'section-' + index}>{block.text}</h2>
    if (block.type === 'quote') return <blockquote key={index}>{block.text}</blockquote>
    if (block.type === 'list') return <ul key={index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    if (block.type === 'image') return <figure key={index}><img src={block.url} alt={block.alt} loading="lazy" />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>
    return <p key={index} className={index === 0 ? 'article-prose__lead' : undefined}>{block.text}</p>
  })
}

export default function ArticlePage() {
  const { slug } = useParams()
  const article = articles.find((item) => item.slug === slug)
  const [shareMessage, setShareMessage] = useState('')
  if (!article) return <NotFoundPage resource="publicación" />
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: article.title, url: location.href })
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(location.href)
        setShareMessage('Enlace copiado.')
      } else setShareMessage('Copia la dirección de esta publicación desde la barra del navegador.')
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage('No se pudo compartir. Puedes copiar la dirección del navegador.')
    }
  }
  return (
    <main id="main-content" tabIndex={-1} className="article-page page-width page-main">
      <nav className="article-page__back" aria-label="Ruta de lectura"><Link to="/explore">Volver a explorar</Link></nav>
      <header className="article-page__header">
        <div>
          <CategoryTag>{article.type} · {article.category}</CategoryTag>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
          <div className="article-page__meta">
            <Link to={'/profile/' + article.authorId}>{article.author}</Link>
            <span>{article.readTime}</span>
            <time dateTime={article.date}>{formatDate(article.date)}</time>
          </div>
        </div>
        <div className="article-page__actions" aria-label="Acciones de la publicación">
          <Link to={'/login?returnTo=' + encodeURIComponent('/article/' + article.slug)}><BookmarkSimple size={19} aria-hidden="true" /> Guardar</Link>
          <button type="button" onClick={share}><ShareNetwork size={19} aria-hidden="true" /> Compartir</button>
        </div>
      </header>
      {shareMessage && <p role="status">{shareMessage}</p>}
      <img className="article-page__hero" src={article.image} alt={article.imageAlt} width="1536" height="1024" />
      <div className="article-page__body-grid">
        <article className="article-prose"><ArticleBlocks blocks={article.blocks} /></article>
        <aside className="article-page__contents">
          <h2>En esta lectura</h2>
          {article.blocks.map((block, index) => block.type === 'heading' && <a key={index} href={'#section-' + index}>{block.text}</a>)}
        </aside>
      </div>
      <AuthorCard author={authors.find((author) => author.id === article.authorId)} />
      <p className="demo-label">Publicación de demostración · {article.type}</p>
    </main>
  )
}
