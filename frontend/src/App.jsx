import { Outlet, ScrollRestoration, useLocation, useNavigation, useViewTransitionState } from 'react-router-dom'
import { useEffect } from 'react'
import { getSession, refreshSession } from './services/gatewayClient'
import Footer from './components/Footer/Footer'
import Header from './components/Header/Header'
import DraftRecoveryNotice from './components/DraftRecovery'
import NavigationFocus from './components/NavigationFocus'
import RouteMotion from './components/RouteMotion'
import { PublicationLoading } from './components/PublicationFeed/PublicationFeed'
import './styles/layout.css'
import './styles/pages.css'
import './styles/account.css'

export default function App({ loading = false }) {
  useEffect(() => { if (getSession().status === 'loading') refreshSession().catch(() => {}) }, [])
  const { pathname } = useLocation()
  const transitioning = useViewTransitionState(pathname)
  const navigation = useNavigation()
  const authRoute = pathname === '/login' || pathname === '/register'
  return (
    <div className={'site-shell' + (transitioning ? ' site-shell--transitioning' : '')}>
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <NavigationFocus />
      <RouteMotion />
      {!authRoute && <Header />}
      <DraftRecoveryNotice />
      {navigation.state !== 'idle' && !loading && <p className="route-pending" role="status">Abriendo la página…</p>}
      {loading ? <main id="main-content" tabIndex={-1} className="page-width page-main"><h1 className="visually-hidden">Cargando otherbloc</h1><PublicationLoading feature /></main> : <Outlet />}
      {!authRoute && <Footer />}
      <ScrollRestoration />
    </div>
  )
}
