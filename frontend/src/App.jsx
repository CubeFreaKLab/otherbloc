import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { refreshSession } from './services/gatewayClient'
import Footer from './components/Footer/Footer'
import Header from './components/Header/Header'
import DraftRecoveryNotice from './components/DraftRecovery'
import NavigationFocus from './components/NavigationFocus'
import './styles/layout.css'
import './styles/pages.css'
import './styles/account.css'

export default function App() {
  useEffect(() => { refreshSession().catch(() => {}) }, [])
  const { pathname } = useLocation()
  const authRoute = pathname === '/login' || pathname === '/register'
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <NavigationFocus />
      {!authRoute && <Header />}
      <DraftRecoveryNotice />
      <Outlet />
      {!authRoute && <Footer />}
      <ScrollRestoration />
    </div>
  )
}
