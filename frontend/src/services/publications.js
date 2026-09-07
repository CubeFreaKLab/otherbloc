import { gatewayMediaUrl, gatewayRequest } from './gatewayClient'

export const publicRequest = (path, options = {}) => gatewayRequest(path, { ...options, anonymous: true })

export function publicationQuery(params, extra = {}) {
  const query = new URLSearchParams()
  for (const key of ['category', 'type', 'q', 'cursor']) if (params?.get(key)) query.set(key, params.get(key))
  for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value)
  return '/publications?' + query
}

async function hydrate(items, options) {
  if (!items.length) return []
  const ids = [...new Set(items.map((item) => item.authorId))]
  const profiles = await publicRequest('/users/profiles?ids=' + ids.map(encodeURIComponent).join(','), options)
  const byId = new Map(profiles.items.map((user) => [user.id, user]))
  return items.map((item) => ({ ...item, authorProfile: byId.get(item.authorId) ?? null, author: byId.get(item.authorId)?.name ?? 'Cuenta no disponible',
    readTime: item.readingMinutes + ' min de lectura', image: gatewayMediaUrl(item.image),
    imageSrcSet: item.coverWidth ? [...[640, 960].filter((width) => width < item.coverWidth).map((width) => gatewayMediaUrl(item.image) + '?width=' + width + ' ' + width + 'w'), gatewayMediaUrl(item.image) + ' ' + item.coverWidth + 'w'].join(', ') : undefined,
  }))
}

export async function loadPublications(path, options) {
  const result = await publicRequest(path, options)
  return { ...result, items: await hydrate(result.items, options) }
}

export async function loadPublication(path, options) {
  const result = await publicRequest(path, options)
  return { publication: (await hydrate([result.publication], options))[0] }
}
