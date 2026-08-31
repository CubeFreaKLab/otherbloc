import { useState } from 'react'
import { List, X } from '@phosphor-icons/react'
import { Link, NavLink } from 'react-router-dom'
import { categories } from '../../data/articles'
import SearchBar from '../SearchBar/SearchBar'
import './Header.css'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="site-header__utility page-width">
        <Link className="site-header__brand" to="/" onClick={closeMenu}>
          <img src="/brand/otherbloc-logo-black.svg" alt="otherbloc home" />
        </Link>
        <div className="site-header__actions">
          <div className="site-header__search">
            <SearchBar compact />
          </div>
          <NavLink to="/login">Log in</NavLink>
          <button
            className="site-header__menu-button"
            type="button"
            aria-controls="site-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={22} /> : <List size={22} />}
            <span className="visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>
      <nav
        id="site-navigation"
        className={`site-header__nav page-width${menuOpen ? ' site-header__nav--open' : ''}`}
        aria-label="Primary navigation"
      >
        {categories.map((category) => (
          <NavLink
            key={category}
            to={category === 'Latest' ? '/' : `/explore?category=${category.toLowerCase()}`}
            onClick={closeMenu}
          >
            {category}
          </NavLink>
        ))}
        <NavLink className="site-header__more" to="/explore" onClick={closeMenu}>
          More
        </NavLink>
      </nav>
    </header>
  )
}
