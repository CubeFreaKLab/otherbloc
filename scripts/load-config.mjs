export const loadGateway = 'http://127.0.0.1:3000'
export const loadRoutes = ['publications', 'profiles', 'composition', 'media']

export function parseLoadArgs(args) {
  if (!args.length) return 'load'
  if (args.length === 1 && args[0] === '--smoke') return 'smoke'
  throw new Error('Use test:load without arguments, or --smoke for a one-iteration diagnostic')
}

export function loadOptions(mode) {
  if (!['load', 'smoke'].includes(mode)) throw new Error('Unknown load mode')
  return {
    scenarios: {
      reading: mode === 'load'
        ? { executor: 'constant-vus', vus: 50, duration: '60s', gracefulStop: '10s' }
        : { executor: 'per-vu-iterations', vus: 1, iterations: 1, maxDuration: '60s' },
    },
    thresholds: {
      http_req_duration: ['p(95)<400'],
      http_req_failed: ['rate==0'],
      checks: ['rate==1'],
      ...Object.fromEntries(loadRoutes.map((route) => ['http_req_duration{name:' + route + '}', ['p(95)<400']])),
    },
    summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
    maxRedirects: 0,
  }
}

export function selectLoadDataset(feed) {
  if (!Array.isArray(feed?.items)) throw new Error('The real public feed is unavailable')
  const publications = feed.items.filter((item) => item.demo === true).map(({ id, authorId, image, status }) => {
    if (typeof id !== 'string' || typeof authorId !== 'string' || status !== 'published' || typeof image !== 'string' || !image.startsWith('/api/publications/' + encodeURIComponent(id) + '/media/') || image.includes('..') || /[?#\\]/.test(image)) {
      throw new Error('The demo dataset needs published readings with gateway-owned cover images')
    }
    return { id, authorId, image }
  }).sort((left, right) => left.id.localeCompare(right.id))
  const authorIds = [...new Set(publications.map((item) => item.authorId))].sort()
  if (publications.length !== 7 || new Set(publications.map((item) => item.id)).size !== 7 || authorIds.length !== 4) throw new Error('Run both local seeds first: expected seven demo publications and four authors')
  return { publications, authorIds }
}

export const loadReadingQuery = `query LoadReading($id: ID!) {
  publication(id: $id) {
    id title summary status demo authorId
    author { id name role demo }
    blocks { id type text items attribution }
    comments(limit: 5) { items { id text author { id name } } nextCursor }
    commentCount reactions { active count } saved followingAuthor
  }
}`
