import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigation, useNavigationType } from 'react-router-dom'

const interactionEvents = ['pointerdown', 'wheel', 'touchstart', 'keydown', 'input']

function identify(element) {
  if (element?.id) return { id: element.id }
  const href = element?.getAttribute('href')
  if (!href) return null
  const matches = [...document.querySelectorAll('a[href]')].filter((node) => node.getAttribute('href') === href)
  return { href, index: matches.indexOf(element) }
}

function locate(target) {
  if (target?.id) return document.getElementById(target.id)
  if (target?.href) return [...document.querySelectorAll('a[href]')].filter((node) => node.getAttribute('href') === target.href)[target.index]
  return null
}

export default function NavigationFocus() {
  const location = useLocation(), navigationType = useNavigationType()
  const positions = useRef(new Map()), previous = useRef(location)
  const navigation = useNavigation(), pendingInteraction = useRef(null)

  useLayoutEffect(() => {
    if (navigation.state === 'idle') return
    const marker = { key: navigation.location.key, interrupted: false }
    pendingInteraction.current = marker
    const interrupt = () => { marker.interrupted = true }
    for (const name of interactionEvents) document.addEventListener(name, interrupt, { passive: true })
    return () => { for (const name of interactionEvents) document.removeEventListener(name, interrupt) }
  }, [navigation.state, navigation.location?.key])

  useLayoutEffect(() => {
    const history = positions.current, last = previous.current
    const changedPath = last.pathname !== location.pathname
    // A cancelled Back returns to the already committed entry. It is not a
    // completed history traversal and must not restore an older focus there.
    const saved = navigationType === 'POP' && last.key !== location.key ? history.get(location.key) : null
    const preserveInteraction = pendingInteraction.current?.key === location.key && pendingInteraction.current.interrupted
    previous.current = location
    let frame = 0, stopped = false, fontsReady = document.fonts.status === 'loaded', observer, resize
    const stop = () => { stopped = true; cancelAnimationFrame(frame); observer?.disconnect(); resize?.disconnect() }
    const remember = (event) => {
      const element = event?.type === 'click' ? event.target.closest('a[href], [id]') : document.activeElement
      const focus = identify(element) ?? history.get(location.key)?.focus
      history.set(location.key, { x: scrollX, y: scrollY, focus })
      if (history.size > 100) history.delete(history.keys().next().value)
    }
    const restore = () => {
      if (stopped) return
      const main = document.querySelector('main')
      if (!main) return
      let section = null
      try { if (location.hash) section = document.getElementById(decodeURIComponent(location.hash.slice(1))) } catch { /* Invalid fragments behave like a missing anchor. */ }
      if (!fontsReady || main.matches('[aria-busy="true"]') || main.querySelector('[aria-busy="true"]')) return
      const target = section ?? locate(saved?.focus) ?? main
      if (section) {
        section.scrollIntoView({ behavior: 'instant' })
        if (!section.hasAttribute('tabindex')) { section.tabIndex = -1; section.addEventListener('blur', () => section.removeAttribute('tabindex'), { once: true }) }
      } else if (saved) window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' })
      if ((changedPath || section || saved) && !document.querySelector('dialog[open]')) {
        const visible = target.getClientRects().length && !target.closest('[inert]')
        ;(visible ? target : main).focus({ preventScroll: true })
      }
      stop()
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(restore) }
    if (changedPath && !preserveInteraction) document.querySelector('main')?.focus({ preventScroll: true })
    if (!preserveInteraction && (changedPath || saved || location.hash)) {
      observer = new MutationObserver(schedule)
      observer.observe(document.getElementById('root'), { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] })
      resize = new ResizeObserver(schedule)
      resize.observe(document.body)
      document.fonts.ready.then(() => { fontsReady = true; schedule() })
      schedule()
    }
    const interact = () => stop()
    document.addEventListener('click', remember, true)
    window.addEventListener('popstate', remember)
    document.addEventListener('scrollend', remember)
    for (const name of interactionEvents) document.addEventListener(name, interact, { passive: true })
    return () => {
      stop()
      document.removeEventListener('click', remember, true)
      window.removeEventListener('popstate', remember)
      document.removeEventListener('scrollend', remember)
      for (const name of interactionEvents) document.removeEventListener(name, interact)
    }
  }, [location, navigationType])
  return null
}
