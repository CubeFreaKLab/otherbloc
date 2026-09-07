import { useSearchParams } from 'react-router-dom'
import ArticleCard from '../ArticleCard/ArticleCard'
import ContentState from '../ContentState/ContentState'
import './PublicationFeed.css'

export function PublicationLoading({ feature = false }) {
  return <div className={'publication-loading' + (feature ? ' publication-loading--feature' : '')} role="status" aria-busy="true">
    <span className="visually-hidden">Cargando publicaciones</span>
    <div className="publication-loading__image" aria-hidden="true" />
    <div className="publication-loading__text" aria-hidden="true"><span /><span /><span /></div>
  </div>
}

export function PublicationPagination({ nextCursor }) {
  const [params, setParams] = useSearchParams()
  if (!nextCursor && !params.has('cursor')) return null
  const change = (cursor) => {
    const next = new URLSearchParams(params)
    if (cursor) next.set('cursor', cursor)
    else next.delete('cursor')
    setParams(next)
    document.querySelector('main')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  return <nav className="publication-pagination" aria-label="Páginas de publicaciones">
    {params.has('cursor') && <button type="button" className="secondary-button" onClick={() => change(null)}>Volver al inicio</button>}
    {nextCursor && <button type="button" className="secondary-button" onClick={() => change(nextCursor)}>Siguiente página</button>}
  </nav>
}

export default function PublicationFeed({ resource, layout = 'explore', emptyMessage }) {
  const { data, status, error, retry } = resource
  if (status === 'loading') return <PublicationLoading />
  if (status === 'error') return <ContentState status="error" message={error.message} onRetry={retry} />
  return <>
    {data.items.length ? <div className={'article-grid article-grid--' + layout}>
      {data.items.map((article, index) => <ArticleCard key={article.id} article={article} featured={layout === 'profile' || index === 0} />)}
    </div> : <ContentState message={data.nextCursor ? 'No hay coincidencias en este tramo de resultados. Continúa a la siguiente página.' : emptyMessage} />}
    <PublicationPagination nextCursor={data.nextCursor} />
    {data.items.some((item) => item.demo) && <p className="demo-label">Edición de muestra · Incluye contenido de demostración.</p>}
  </>
}
