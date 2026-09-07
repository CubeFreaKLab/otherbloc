import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { prepareRouteMotion } from '../utils/routeMotion'
import '../styles/route-motion.css'

export default function RouteMotion() {
  const { pathname } = useLocation(), current = useRef(pathname)
  useLayoutEffect(() => { current.current = pathname }, [pathname])
  useLayoutEffect(() => {
    const restore = () => prepareRouteMotion(current.current, window.location.pathname)
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  return null
}
