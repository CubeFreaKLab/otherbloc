import { useRef, useState } from 'react'
import { List, X } from '@phosphor-icons/react'
import { Link, useLocation } from 'react-router-dom'
import { categories, normalizeSearch } from '../../data/navigation'
import SearchBar from '../SearchBar/SearchBar'
import ThemeControl from '../ThemeControl/ThemeControl'
import './Header.css'
import { useSession } from '../../hooks/useSession'

export default function Header() {
  const { user } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const buttonRef = useRef(null)
  const location = useLocation()
  const selected = new URLSearchParams(location.search).get('category')
  const closeMenu = () => setMenuOpen(false)
  return (
    <header className="site-header" onKeyDown={(event) => {
      if (event.key === 'Escape' && menuOpen) { closeMenu(); buttonRef.current?.focus() }
    }}>
      <div className="site-header__utility page-width">
        <Link className="site-header__brand" to="/" onClick={closeMenu}>
          <img className="brand-logo" src="/brand/otherbloc-logo-black.svg" alt="otherbloc, inicio" />
        </Link>
        <div className="site-header__actions">
          <div className="site-header__search"><SearchBar compact /></div>
          <ThemeControl />
          <Link to={user ? '/account' : '/login'} onClick={closeMenu}>{user ? 'Mi cuenta' : 'Entrar'}</Link>
          <button ref={buttonRef} className="site-header__menu-button" type="button"
            aria-controls="site-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={22} aria-hidden="true" /> : <List size={22} aria-hidden="true" />}
            <span className="visually-hidden">{menuOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
          </button>
        </div>
      </div>
      <nav id="site-navigation" className={'site-header__nav page-width' + (menuOpen ? ' site-header__nav--open' : '')} aria-label="Navegación principal">
        <Link to="/" aria-current={location.pathname === '/' ? 'page' : undefined} onClick={closeMenu}>Últimas</Link>
        {categories.map((category) => {
          const value = normalizeSearch(category)
          return <Link key={category} to={'/explore?category=' + value} onClick={closeMenu}
            aria-current={location.pathname === '/explore' && selected === value ? 'page' : undefined}>{category}</Link>
        })}
        <Link className="site-header__more" to="/explore" onClick={closeMenu}
          aria-current={location.pathname === '/explore' && !selected ? 'page' : undefined}>Explorar</Link>
      </nav>
    </header>
  )
}
