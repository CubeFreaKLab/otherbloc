import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import './ScrollHeader.css'

export default function ScrollHeader({ className, keepVisible = false, onFocusCapture, ...props }) {
  const ref = useRef(null), pinned = useRef(keepVisible)
  const { key } = useLocation()
  useLayoutEffect(() => { pinned.current = keepVisible; if (keepVisible) ref.current.dataset.collapsed = 'false' }, [keepVisible])
  useLayoutEffect(() => {
    const node = ref.current
    let last = window.scrollY, distance = 0, direction = 0, frame = 0, height = 0
    node.dataset.collapsed = 'false'
    const measure = () => { height = node.offsetHeight; document.documentElement.style.setProperty('--header-height', height + 'px') }
    const observer = new ResizeObserver(measure)
    observer.observe(node); measure()
    const update = () => {
      frame = 0
      const y = Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - innerHeight))
      const delta = y - last; last = y
      if (!delta) return
      const nextDirection = Math.sign(delta)
      distance = nextDirection === direction ? distance + delta : delta
      direction = nextDirection
      const focused = node.contains(document.activeElement) && document.activeElement.matches(':focus-visible')
      if (y < height + 24 || pinned.current || focused) node.dataset.collapsed = 'false'
      else if (distance > 24) node.dataset.collapsed = 'true'
      else if (distance < -12) node.dataset.collapsed = 'false'
    }
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', scroll, { passive: true })
    return () => { window.removeEventListener('scroll', scroll); cancelAnimationFrame(frame); observer.disconnect(); document.documentElement.style.removeProperty('--header-height') }
  }, [key])
  return <header {...props} ref={ref} className={'scroll-header ' + className} onFocusCapture={(event) => { ref.current.dataset.collapsed = 'false'; onFocusCapture?.(event) }} />
}
