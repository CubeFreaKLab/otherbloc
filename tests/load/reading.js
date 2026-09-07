import http from 'k6/http'
import { check, sleep } from 'k6'
import execution from 'k6/execution'
import { loadGateway, loadOptions, loadReadingQuery } from '../../scripts/load-config.mjs'

export const options = loadOptions(__ENV.OTHERBLOC_LOAD_MODE)
const dataset = JSON.parse(open(__ENV.OTHERBLOC_LOAD_DATASET))
http.setResponseCallback(http.expectedStatuses(200))

function parameters(name, responseType = 'text') {
  return { tags: { name }, timeout: '10s', responseType, headers: { 'Content-Type': 'application/json', 'X-Otherbloc-Request': '1' } }
}
function json(response) {
  try { return response.json() } catch { return null }
}

export default function reading() {
  const item = dataset.publications[(execution.vu.idInTest - 1 + execution.vu.iterationInScenario) % dataset.publications.length]
  const feed = http.get(loadGateway + '/api/publications?limit=12', parameters('publications'))
  const feedBody = json(feed)
  check(feed, {
    'feed returns 200': (response) => response.status === 200,
    'feed contains the seven public demos': () => Array.isArray(feedBody?.items) && dataset.publications.every((entry) => feedBody.items.some((value) => value.id === entry.id && value.status === 'published' && value.demo === true)),
  })

  const profiles = http.get(loadGateway + '/api/users/profiles?ids=' + encodeURIComponent(dataset.authorIds.join(',')), parameters('profiles'))
  const profilesBody = json(profiles)
  check(profiles, {
    'profiles return 200': (response) => response.status === 200,
    'profiles contain the four actual authors': () => Array.isArray(profilesBody?.items) && dataset.authorIds.every((id) => profilesBody.items.some((author) => author.id === id && author.demo === true && ['author', 'admin'].includes(author.role))),
  })

  const composition = http.post(loadGateway + '/api/interactions', JSON.stringify({ query: loadReadingQuery, variables: { id: item.id } }), parameters('composition'))
  const composedBody = json(composition), publication = composedBody?.data?.publication
  check(composition, {
    'composition returns 200 without GraphQL errors': (response) => response.status === 200 && composedBody && !composedBody.errors,
    'composition has real content, author and interactions': () => publication?.id === item.id && publication.status === 'published' && publication.demo === true && publication.author?.id === item.authorId && publication.blocks?.length > 0 && Array.isArray(publication.comments?.items) && Number.isInteger(publication.commentCount) && Number.isInteger(publication.reactions?.count) && publication.saved === false && publication.followingAuthor === false,
  })

  const media = http.get(loadGateway + item.image + '?width=640', parameters('media', 'binary'))
  check(media, {
    'media returns 200': (response) => response.status === 200,
    'media contains actual WebP bytes': (response) => response.headers['Content-Type']?.startsWith('image/webp') && response.body?.byteLength > 0,
  })
  // Closed workload: one second of reader think time, outside all HTTP duration metrics.
  sleep(1)
}

export function handleSummary(data) {
  const raw = JSON.stringify(data, null, 2) + '\n'
  const compact = data.metrics ? {
    durationMs: data.state?.testRunDurationMs,
    metrics: Object.fromEntries(Object.entries(data.metrics).filter(([name]) => /^http_req_duration(?:$|\{name:)|^(?:http_reqs|http_req_failed|checks|iterations|vus|vus_max)$/.test(name))),
  } : data
  return { [__ENV.OTHERBLOC_LOAD_SUMMARY]: raw, stdout: JSON.stringify(compact, null, 2) + '\n' }
}
