import { useState } from 'react'
import { BookmarkSimple, ShareNetwork } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router-dom'
import AuthorCard from '../components/AuthorCard/AuthorCard'
import CategoryTag from '../components/CategoryTag/CategoryTag'
import { useResource } from '../hooks/useResource'
import { usePageTitle } from '../hooks/usePageTitle'
import { loadPublication } from '../services/publications'
import { gatewayMediaUrl } from '../services/gatewayClient'
import ContentState from '../components/ContentState/ContentState'
import { PublicationLoading } from '../components/PublicationFeed/PublicationFeed'
import { formatDate } from '../utils/formatDate'
import NotFoundPage from './NotFoundPage'

export function ArticleBlocks({ blocks }) {
  return blocks.map((block, index) => {
    if (block.type === 'heading') { const Heading = block.level === 3 ? 'h3' : 'h2'; return <Heading key={block.id ?? index} id={'section-' + index}>{block.text}</Heading> }
    if (block.type === 'quote') return <blockquote key={block.id ?? index}>{block.text}{block.attribution && <cite>{block.attribution}</cite>}</blockquote>
    if (block.type === 'list') { const List = block.ordered ? 'ol' : 'ul'; return <List key={block.id ?? index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</List> }
    if (block.type === 'image') return <figure key={block.id ?? index}><img src={gatewayMediaUrl(block.url)} alt={block.alt} loading="lazy" />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>
    return <p key={index} className={index === 0 ? 'article-prose__lead' : undefined}>{block.text}</p>
  })
}

export default function ArticlePage() {
  const { slug } = useParams()
  const { data, status, error, retry } = useResource('/publications/' + encodeURIComponent(slug), loadPublication)
  const article = data?.publication
  usePageTitle(article?.title ?? (error?.status === 404 ? 'Publicación no encontrada' : 'Publicación'))
  const [shareMessage, setShareMessage] = useState('')
  if (error?.status === 404) return <NotFoundPage resource="publicación" />
  if (status !== 'success') return <main id="main-content" tabIndex={-1} className="page-width page-main">
    <h1 className="visually-hidden">Publicación</h1>
    {status === 'loading' ? <PublicationLoading feature /> : <ContentState status="error" message={error.message} onRetry={retry} />}
  </main>
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
            {article.authorProfile ? <Link to={'/profile/' + article.authorId}>{article.author}</Link> : <span>{article.author}</span>}
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
      <AuthorCard author={article.authorProfile} />
      {article.demo && <p className="demo-label">Publicación de demostración · {article.type}</p>}
    </main>
  )
}
