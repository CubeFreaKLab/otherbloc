import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Link from './MotionLink'
import './ReadingThumbnail.css'

let tabFocus = false
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (event) => { tabFocus = event.key === 'Tab' }, true)
  document.addEventListener('pointerdown', () => { tabFocus = false }, true)
}

export default function ReadingThumbnail({ article, className, sizes, featured = false }) {
  const element = useRef(null), animation = useRef(null)
  const { key } = useLocation()
  function reset() {
    const node = element.current
    if (!node) return
    const color = node.querySelector('.reading-thumbnail__color')
    color.style.clipPath = getComputedStyle(color).clipPath
    animation.current?.cancel()
    node.dataset.revealed = 'false'
  }
  useEffect(() => {
    const node = element.current
    node.dataset.revealed = 'false'
    const clear = () => { animation.current?.cancel(); node.dataset.revealed = 'false' }
    window.addEventListener('pagehide', clear)
    window.addEventListener('pageshow', clear)
    window.addEventListener('blur', clear)
    return () => { clear(); window.removeEventListener('pagehide', clear); window.removeEventListener('pageshow', clear); window.removeEventListener('blur', clear) }
  }, [key])
  function reveal(event, keyboard = false) {
    if (!keyboard && (event.pointerType === 'touch' || !matchMedia('(hover: hover) and (pointer: fine)').matches)) return
    const node = element.current, rect = node.getBoundingClientRect()
    const x = keyboard ? rect.width / 2 : Math.max(0, Math.min(rect.width, event.clientX - rect.left))
    const y = keyboard ? rect.height / 2 : Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y))
    const color = node.querySelector('.reading-thumbnail__color')
    animation.current?.cancel()
    node.dataset.revealed = 'true'
    color.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) animation.current = color.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 520, easing: 'cubic-bezier(.2,0,.15,1)', fill: 'both' })
  }
  const image = { src: article.image, srcSet: article.imageSrcSet, sizes, width: article.coverWidth ?? 1536, height: article.coverHeight ?? 1024, ...(featured ? { fetchPriority: 'high' } : { loading: 'lazy' }) }
  return <Link ref={element} className={'reading-thumbnail ' + className} to={'/article/' + article.slug} aria-label={'Leer ' + article.title}
    onPointerEnter={reveal} onPointerLeave={reset} onClick={reset} onBlur={reset}
    onFocus={(event) => { if (tabFocus && event.currentTarget.matches(':focus-visible')) reveal(event, true); tabFocus = false }}>
    <img {...image} className="reading-thumbnail__grey" data-reading-slug={article.slug} alt={article.imageAlt} />
    <img {...image} className="reading-thumbnail__color" alt="" aria-hidden="true" />
  </Link>
}
