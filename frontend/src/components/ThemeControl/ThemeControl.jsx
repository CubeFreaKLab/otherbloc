import { useEffect, useState } from 'react'
import { Moon, Sun } from '@phosphor-icons/react'
import { readThemePreference, themeStorageKey } from '../../utils/theme'
import './ThemeControl.css'

export default function ThemeControl() {
  const [preference, setPreference] = useState(readThemePreference)
  useEffect(() => {
    document.documentElement.dataset.theme = preference
    const synchronize = () => setPreference(readThemePreference())
    window.addEventListener('storage', synchronize)
    window.addEventListener('otherbloc-theme', synchronize)
    return () => { window.removeEventListener('storage', synchronize); window.removeEventListener('otherbloc-theme', synchronize) }
  }, [preference])
  const label = preference === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'
  return <button type="button" className="theme-control" aria-label={label} title={label} data-theme-choice={preference} onClick={() => {
    const next = preference === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    setPreference(next)
    try { localStorage.setItem(themeStorageKey, next); window.dispatchEvent(new Event('otherbloc-theme')) } catch { /* Keep the choice for this visit. */ }
  }}><Moon className="theme-control__moon" size={20} aria-hidden="true" /><Sun className="theme-control__sun" size={20} aria-hidden="true" /></button>
}
