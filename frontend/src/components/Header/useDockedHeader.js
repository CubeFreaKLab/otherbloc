import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export function useDockedHeader(menuOpen, mobile) {
  const ref = useRef(null)
  const { key } = useLocation()
  useLayoutEffect(() => {
    const header = ref.current
    const bar = header.querySelector('.site-header__bar')
    const nav = header.querySelector('nav')
    let frame = 0
    const update = () => {
      frame = 0
      const y = Math.max(0, window.scrollY)
      const focused = header.contains(document.activeElement) && document.activeElement.matches(':focus-visible')
      const mode = y <= header.offsetHeight ? 'flow' : menuOpen || focused || y > header.offsetHeight + 120 ? 'docked' : 'away'
      header.dataset.mode = mode
      nav.inert = (mobile || mode !== 'flow') && !menuOpen && !(focused && nav.contains(document.activeElement))
      if (nav.inert) nav.setAttribute('aria-hidden', 'true')
      else nav.removeAttribute('aria-hidden')
    }
    const measure = () => {
      header.style.setProperty('--utility-height', bar.offsetHeight + 'px')
      document.documentElement.style.setProperty('--header-height', bar.offsetHeight + 'px')
      update()
    }
    const observer = new ResizeObserver(measure)
    observer.observe(bar)
    observer.observe(header)
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('pageshow', schedule)
    header.addEventListener('focusin', update)
    header.addEventListener('focusout', schedule)
    measure()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('pageshow', schedule)
      header.removeEventListener('focusin', update)
      header.removeEventListener('focusout', schedule)
      document.documentElement.style.removeProperty('--header-height')
    }
  }, [key, menuOpen, mobile])
  return ref
}
