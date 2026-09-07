const reading = /^\/article\/[^/]+$/
const collection = /^(\/|\/explore|\/profile\/[^/]+)$/
const accountChildren = new Set(['/account/saved', '/account/following', '/author', '/admin/users', '/admin/publications'])

function childOf(parent, child) {
  return (parent === '/account' && accountChildren.has(child)) ||
    (parent === '/author' && /^\/author\/publications\/[^/]+$/.test(child)) ||
    (parent === '/admin/publications' && /^\/admin\/publications\/[^/]+$/.test(child))
}

export function routeMotion(from, to) {
  if (from === to) return 'none'
  if ((collection.test(from) && reading.test(to)) || (reading.test(from) && collection.test(to))) return 'reading'
  if (childOf(from, to)) return 'forward'
  if (childOf(to, from)) return 'backward'
  return 'fade'
}

export function motionEnabled() {
  return typeof document.startViewTransition === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function prepareRouteMotion(from, to) {
  let mode = motionEnabled() ? routeMotion(from, to) : 'none'
  if (mode === 'reading') {
    const slug = (reading.test(to) ? to : from).slice('/article/'.length)
    const cover = [...document.querySelectorAll('img[data-reading-slug]')].find((node) => node.dataset.readingSlug === slug)
    if (!cover?.complete || !cover.naturalWidth) mode = 'fade'
  }
  document.documentElement.dataset.routeMotion = mode
  return mode !== 'none'
}
