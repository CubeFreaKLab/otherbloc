import { useSearchParams } from 'react-router-dom'
import ArticleCard from '../components/ArticleCard/ArticleCard'
import SearchBar from '../components/SearchBar/SearchBar'
import ContentState from '../components/ContentState/ContentState'
import { articles, categories, filterArticles, normalizeSearch, publicationTypes } from '../data/articles'

export default function ExplorePage() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const type = params.get('type') ?? ''
  const filtered = filterArticles(articles, { category, type, query: params.get('q') ?? '' })
  const update = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { preventScrollReset: true })
  }
  return (
    <main id="main-content" tabIndex={-1} className="page-width page-main">
      <header className="page-intro">
        <h1>Otras miradas. Nuevas lecturas.</h1>
        <p>Encuentra artículos, opiniones e historias de voces independientes.</p>
      </header>
      <SearchBar />
      <div className="category-filter" aria-label="Filtrar por categoría">
        {['Todas', ...categories].map((label) => {
          const value = label === 'Todas' ? '' : normalizeSearch(label)
          return <button key={label} type="button" className={category === value ? 'is-active' : ''}
            aria-pressed={category === value} onClick={() => update('category', value)}>{label}</button>
        })}
      </div>
      <div className="explore-toolbar">
        <label>Tipo de publicación <select value={type} onChange={(event) => update('type', event.target.value)}>
          <option value="">Todos los tipos</option>
          {publicationTypes.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <p role="status">{filtered.length} {filtered.length === 1 ? 'publicación' : 'publicaciones'}</p>
        {(category || type || params.get('q')) && <button type="button" className="text-link" onClick={() => setParams({})}>Limpiar filtros</button>}
      </div>
      {filtered.length ? <div className="article-grid article-grid--explore">
        {filtered.map((article, index) => <ArticleCard key={article.slug} article={article} featured={index === 0} />)}
      </div> : <ContentState message="No encontramos publicaciones con estos filtros. Prueba otra búsqueda o limpia los filtros." />}
      <p className="demo-label">Edición de muestra · Contenido de demostración.</p>
    </main>
  )
}
