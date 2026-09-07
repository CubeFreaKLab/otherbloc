import { useCallback } from 'react'
import { useLocation, useNavigate, useResolvedPath } from 'react-router-dom'
import { prepareRouteMotion } from '../utils/routeMotion'

export function useMotionNavigate() {
  const navigate = useNavigate(), location = useLocation(), base = useResolvedPath('.')
  return useCallback((to, options = {}) => {
    if (typeof to === 'number') return navigate(to)
    const path = typeof to === 'string' ? to : to.pathname ?? location.pathname
    const destination = new URL(path, window.location.origin + base.pathname + '/').pathname
    const enabled = prepareRouteMotion(location.pathname, destination)
    return navigate(to, { ...options, viewTransition: options.viewTransition ?? enabled })
  }, [navigate, location.pathname, base.pathname])
}
