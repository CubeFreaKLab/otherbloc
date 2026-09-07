import { useEffect, useRef, useState } from 'react'
import { Monitor, Moon, Sun } from '@phosphor-icons/react'
import { readThemePreference, resolveTheme, themeStorageKey } from '../../utils/theme'
import './ThemeControl.css'

const labels = { light: 'Claro', dark: 'Oscuro', system: 'Sistema' }
const icons = { light: Sun, dark: Moon, system: Monitor }

export default function ThemeControl() {
  const [preference, setPreference] = useState(() => readThemePreference())
  const transitionRef = useRef(null)
  const Icon = icons[preference]

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { document.documentElement.dataset.theme = resolveTheme(preference, media.matches) }
    apply()
    media.addEventListener('change', apply)
    const synchronize = (event) => {
      if (event.key === themeStorageKey || event.key === null) setPreference(readThemePreference())
    }
    window.addEventListener('storage', synchronize)
    return () => {
      media.removeEventListener('change', apply)
      window.removeEventListener('storage', synchronize)
    }
  }, [preference])

  function changeTheme(event) {
    const next = event.target.value
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.x + rect.width / 2
    const y = rect.y + rect.height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const root = document.documentElement
    const resolved = resolveTheme(next, matchMedia('(prefers-color-scheme: dark)').matches)
    const changed = root.dataset.theme !== resolved
    const apply = () => {
      root.dataset.theme = resolved
      setPreference(next)
      try { localStorage.setItem(themeStorageKey, next) } catch { /* Keep the choice for this visit. */ }
    }
    transitionRef.current?.skipTransition()
    if (!changed || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return }
    root.dataset.themeTransition = 'true'
    const transition = document.startViewTransition(apply)
    transitionRef.current = transition
    transition.ready.then(() => root.animate({
      clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
    }, { duration: 380, easing: 'cubic-bezier(.2,0,0,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {})
    transition.finished.finally(() => {
      if (transitionRef.current === transition) { delete root.dataset.themeTransition; transitionRef.current = null }
    })
  }

  return (
    <label className="theme-control">
      <Icon size={18} aria-hidden="true" />
      <span className="visually-hidden">Tema de color</span>
      <select value={preference} onChange={changeTheme}>
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  )
}
