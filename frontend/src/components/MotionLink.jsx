import { Link, useLocation, useResolvedPath } from 'react-router-dom'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { prepareRouteMotion } from '../utils/routeMotion'

export default function MotionLink({ onClick, to, relative, viewTransition = true, ...props }) {
  const location = useLocation(), destination = useResolvedPath(to, { relative })
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const enabled = viewTransition && !reduced && typeof document.startViewTransition === 'function' && location.pathname !== destination.pathname
  function prepare(event) {
    onClick?.(event)
    const link = event.currentTarget
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || props.reloadDocument || link.hasAttribute('download') || (link.target && link.target !== '_self')) return
    const address = new URL(link.href)
    if (address.origin === window.location.origin) prepareRouteMotion(location.pathname, address.pathname)
  }
  // React Router retains native anchor/modifier semantics and handles blockers/history.
  return <Link {...props} to={to} relative={relative} onClick={prepare} viewTransition={enabled} />
}
