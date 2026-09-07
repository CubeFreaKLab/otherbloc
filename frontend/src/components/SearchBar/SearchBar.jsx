import { MagnifyingGlass } from '@phosphor-icons/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './SearchBar.css'

export default function SearchBar({ compact = false }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const id = compact ? 'site-search' : 'explore-search'
  function search(event) {
    event.preventDefault()
    const query = new FormData(event.currentTarget).get('query').trim()
    const next = new URLSearchParams(compact ? '' : params)
    next.delete('cursor')
    if (query) next.set('q', query)
    else next.delete('q')
    navigate('/explore' + (next.size ? '?' + next : ''))
  }
  return (
    <form className={'search-bar' + (compact ? ' search-bar--compact' : '')} role="search" onSubmit={search}>
      <label htmlFor={id}>Buscar publicaciones</label>
      <div className="search-bar__control">
        <MagnifyingGlass aria-hidden="true" size={18} />
        <input key={params.get('q') ?? ''} id={id} name="query" type="search"
          defaultValue={params.get('q') ?? ''} maxLength={80} placeholder="Título, autor o tema" />
        {!compact && <button type="submit">Buscar</button>}
      </div>
    </form>
  )
}
