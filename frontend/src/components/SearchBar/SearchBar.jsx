import { MagnifyingGlass } from '@phosphor-icons/react'
import './SearchBar.css'

export default function SearchBar({ compact = false }) {
  return (
    <form className={`search-bar${compact ? ' search-bar--compact' : ''}`} role="search">
      <label htmlFor={compact ? 'site-search' : 'explore-search'}>Search publications</label>
      <div className="search-bar__control">
        <MagnifyingGlass aria-hidden="true" size={18} weight="regular" />
        <input
          id={compact ? 'site-search' : 'explore-search'}
          name="query"
          type="search"
          placeholder="Search by title, author, or topic"
        />
        {!compact && <button type="submit">Search</button>}
      </div>
    </form>
  )
}
