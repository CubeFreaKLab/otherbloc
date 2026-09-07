import { Outlet, ScrollRestoration, useLocation, useNavigationType } from 'react-router-dom'
import { useLayoutEffect, useRef } from 'react'
import Footer from './components/Footer/Footer'
import Header from './components/Header/Header'
import './styles/layout.css'
import './styles/pages.css'

function NavigationFocus() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef(location.pathname)
  const focusTargets = useRef(new Map())
  useLayoutEffect(() => {
    const targets = focusTargets.current
    if (previous.current !== location.pathname) {
      const previousHref = navigationType === 'POP' ? targets.get(location.key) : null
      const target = previousHref
        ? [...document.querySelectorAll('a[href]')].find((element) => element.getAttribute('href') === previousHref)
        : document.querySelector('main')
      target?.focus({ preventScroll: true })
      previous.current = location.pathname
    }
    const heading = document.querySelector('h1')?.textContent
    document.title = heading ? heading + ' — otherbloc' : 'otherbloc'
    return () => {
      const href = document.activeElement?.getAttribute('href')
      if (href) targets.set(location.key, href)
    }
  }, [location, navigationType])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  const authRoute = pathname === '/login' || pathname === '/register'
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <NavigationFocus />
      {!authRoute && <Header />}
      <Outlet />
      {!authRoute && <Footer />}
      <ScrollRestoration />
    </div>
  )
}
