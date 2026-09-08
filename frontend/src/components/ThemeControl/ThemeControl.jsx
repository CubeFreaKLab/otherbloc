import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Moon, Sun } from '@phosphor-icons/react'
import { readThemePreference, themeStorageKey } from '../../utils/theme'
import './ThemeControl.css'

export default function ThemeControl() {
  const [preference, setPreference] = useState(readThemePreference)
  const transitionRef = useRef(null), choice = useRef(preference)
  useEffect(() => {
    document.documentElement.dataset.theme = preference
    const synchronize = () => { const next = readThemePreference(); choice.current = next; setPreference(next) }
    window.addEventListener('storage', synchronize)
    window.addEventListener('otherbloc-theme', synchronize)
    return () => { window.removeEventListener('storage', synchronize); window.removeEventListener('otherbloc-theme', synchronize) }
  }, [preference])
  useEffect(() => () => transitionRef.current?.skipTransition(), [])
  const label = preference === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'
  function changeTheme(event) {
    const next = choice.current === 'dark' ? 'light' : 'dark'
    choice.current = next
    const root = document.documentElement, rect = event.currentTarget.getBoundingClientRect()
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const apply = () => {
      root.dataset.theme = next
      flushSync(() => setPreference(next))
      try { localStorage.setItem(themeStorageKey, next); window.dispatchEvent(new Event('otherbloc-theme')) } catch { /* Keep the choice for this visit. */ }
    }
    transitionRef.current?.skipTransition()
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return }
    root.dataset.themeTransition = 'true'
    const transition = document.startViewTransition(apply)
    transitionRef.current = transition
    transition.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 380, easing: 'cubic-bezier(.2,0,0,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {})
    transition.finished.finally(() => { if (transitionRef.current === transition) { delete root.dataset.themeTransition; transitionRef.current = null } })
  }
  return <button type="button" className="theme-control" aria-label={label} data-theme-choice={preference} onClick={changeTheme}><Moon className="theme-control__moon" size={20} aria-hidden="true" /><Sun className="theme-control__sun" size={20} aria-hidden="true" /></button>
}
