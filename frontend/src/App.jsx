import { Outlet, ScrollRestoration, useLocation, useNavigation, useViewTransitionState } from 'react-router-dom'
import { useEffect, useSyncExternalStore } from 'react'
import { getSession, refreshSession, runtimeReadiness } from './services/gatewayClient'
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
  const starting = useSyncExternalStore(runtimeReadiness.subscribe, runtimeReadiness.getSnapshot)
  useEffect(() => { if (getSession().status === 'loading') refreshSession().catch(() => {}) }, [])
  const { pathname } = useLocation()
  const transitioning = useViewTransitionState(pathname)
  const navigation = useNavigation()
  const authRoute = pathname === '/login' || pathname === '/register'
  const editorRoute = /^\/author\/publications\/[^/]+$/.test(pathname)
  return (
    <div className={'site-shell' + (transitioning ? ' site-shell--transitioning' : '')}>
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <NavigationFocus />
      <RouteMotion />
      {!authRoute && !editorRoute && <Header />}
      <DraftRecoveryNotice />
      {starting && <p className="page-width" role="status">Estamos iniciando los servidores de otherbloc. La primera visita puede tardar unos minutos; la página continuará automáticamente.</p>}
      {navigation.state !== 'idle' && !loading && <p className="route-pending" role="status">Abriendo la página…</p>}
      {loading ? <main id="main-content" tabIndex={-1} className="page-width page-main"><h1 className="visually-hidden">Cargando otherbloc</h1><PublicationLoading feature /></main> : <Outlet />}
      {!authRoute && !editorRoute && <Footer />}
      <ScrollRestoration />
    </div>
  )
}
