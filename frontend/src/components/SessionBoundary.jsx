import { useLocation } from 'react-router-dom'
import Link from './MotionLink'
import { useSession } from '../hooks/useSession'
import { refreshSession } from '../services/gatewayClient'

export default function SessionBoundary({ children, roles }) {
  const { user, status, error } = useSession()
  const location = useLocation()
  if (status === 'loading') return <section className="session-state" aria-busy="true" aria-live="polite"><div className="text-skeleton" /><div className="text-skeleton" /><p>Comprobando tu sesión…</p></section>
  if (status === 'error') return <section className="session-state"><h2>No pudimos comprobar tu sesión</h2><p role="alert">{error}</p><button className="secondary-button" onClick={() => refreshSession().catch(() => {})}>Reintentar</button></section>
  if (!user) return <section className="session-state"><h2>Este espacio es tuyo</h2><p>Inicia sesión para acceder a tu cuenta.</p><Link className="primary-button button-link" to={'/login?returnTo=' + encodeURIComponent(location.pathname + location.search)}>Iniciar sesión</Link></section>
  if (roles && !roles.includes(user.role)) return <section className="session-state"><h2>Acceso no permitido</h2><p>Tu cuenta no tiene permiso para entrar en esta sección.</p><Link className="text-link" to="/account">Volver a mi cuenta</Link></section>
  return children
}
