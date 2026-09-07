import { useLoaderData, useSearchParams } from 'react-router-dom'
import SearchBar from '../components/SearchBar/SearchBar'
import PublicationFeed from '../components/PublicationFeed/PublicationFeed'
import { useResource } from '../hooks/useResource'
import { loadPublications, publicationQuery, publicRequest } from '../services/publications'
import { routeResource } from '../services/routeResource'
import { prepareFeedReading } from '../services/readingCover'

export const loader = async ({ request }) => prepareFeedReading(await routeResource(publicationQuery(new URL(request.url).searchParams), loadPublications, request.signal), request.signal)

export default function ExplorePage() {
  const [params, setParams] = useSearchParams()
  const initial = useLoaderData()
  const category = params.get('category') ?? ''
  const type = params.get('type') ?? ''
  const resource = useResource(publicationQuery(params), loadPublications, initial)
  const options = useResource('/publications/options', publicRequest)
  const categories = options.data?.categories ?? [], publicationTypes = options.data?.types ?? []
  const update = (key, value) => {
    const next = new URLSearchParams(params)
    next.delete('cursor')
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
          const value = label === 'Todas' ? '' : label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
          return <button key={label} type="button" className={category === value ? 'is-active' : ''}
            aria-pressed={category === value} onClick={() => update('category', value)}>{label}</button>
        })}
      </div>
      <div className="explore-toolbar">
        <label>Tipo de publicación <select value={type} onChange={(event) => update('type', event.target.value)}>
          <option value="">Todos los tipos</option>
          {publicationTypes.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        {resource.status === 'success' && <p role="status">{resource.data.items.length} {resource.data.items.length === 1 ? 'publicación' : 'publicaciones'}{resource.data.nextCursor || params.has('cursor') ? ' en esta página' : ''}</p>}
        {(category || type || params.get('q')) && <button type="button" className="text-link" onClick={() => setParams({})}>Limpiar filtros</button>}
      </div>
      {options.status === 'error' && <p role="alert">No se pudieron cargar los filtros. <button className="text-link" onClick={options.retry}>Reintentar filtros</button></p>}
      <PublicationFeed resource={resource} emptyMessage="No encontramos publicaciones con estos filtros. Prueba otra búsqueda o limpia los filtros." />
    </main>
  )
}
