export const readingCoverSizes = '(max-width: 767px) calc(100vw - 2rem), (max-width: 1664px) 92vw, 1536px'
export const cardCoverSizes = '(max-width: 767px) 100vw, 50vw'
export const featuredCoverSizes = '(max-width: 767px) 100vw, 60vw'

export function fadeReadingMotion() {
  if (document.documentElement.dataset.routeMotion === 'reading') document.documentElement.dataset.routeMotion = 'fade'
}

export async function prepareReadingCover(article, sizes, signal) {
  if (document.documentElement.dataset.routeMotion !== 'reading') return
  if (!article) { fadeReadingMotion(); return }
  const image = new Image()
  image.decoding = 'async'; image.sizes = sizes
  if (article.imageSrcSet) image.srcset = article.imageSrcSet
  image.src = article.image
  let timer, abort
  // This is a maximum network/decode budget, never a minimum animation delay.
  const interrupted = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), 2000)
    abort = () => resolve(false)
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
  const decoded = await Promise.race([image.decode().then(() => true, () => false), interrupted])
  clearTimeout(timer); signal.removeEventListener('abort', abort)
  if (!decoded) { image.removeAttribute('srcset'); image.removeAttribute('src') }
  if (signal.aborted) throw signal.reason
  if (!decoded) fadeReadingMotion()
}

export async function prepareFeedReading(resource, signal, featured = false) {
  if (document.documentElement.dataset.routeMotion !== 'reading') return resource
  const slug = document.querySelector('.article-page__hero')?.dataset.readingSlug
  const article = resource.data?.items.find((item) => item.slug === slug)
  await prepareReadingCover(article, featured && resource.data?.items[0] === article ? featuredCoverSizes : cardCoverSizes, signal)
  return resource
}
