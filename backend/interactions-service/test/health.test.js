import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { readRevision, revision } from '../src/config/revision.js'

test('service revisions require full matching SHAs and never invent a local version', () => {
  const sha = 'a'.repeat(40)
  assert.equal(readRevision({}), null)
  assert.equal(readRevision({ APP_REVISION: '' }), null)
  assert.equal(readRevision({ RENDER_GIT_COMMIT: sha, APP_REVISION: sha.toUpperCase() }), sha)
  assert.equal(readRevision({ APP_REVISION: sha }), sha)
  for (const key of ['APP_REVISION', 'RENDER_GIT_COMMIT']) {
    for (const value of ['main', 'abcdef0', 'g'.repeat(40), sha + ' ', 123]) assert.throws(() => readRevision({ [key]: value }), /complete/)
  }
  assert.throws(() => readRevision({ RENDER_GIT_COMMIT: sha, APP_REVISION: 'b'.repeat(40) }), /does not match/)
})

let apolloServer
let httpServer
let baseUrl
const config = { serviceAuthSecret: 'local-test-service-key-32-characters', jwtSecret: 'local-test-jwt-key-at-least-32-characters', nodeEnv: 'test' }

before(async () => {
  const application = await createApp({ config })
  apolloServer = application.apolloServer
  httpServer = application.app.listen(0)
  await new Promise((resolve) => httpServer.once('listening', resolve))
  const { port } = httpServer.address()
  baseUrl = `http://127.0.0.1:${port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()))
  })
  await apolloServer.stop()
})

test('reports the interactions service health', async () => {
  const response = await fetch(`${baseUrl}/health`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body, {
    service: 'interactions-service',
    revision,
    status: 'ok',
    transport: 'GraphQL',
  })
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('serves the GraphQL foundation query', async () => {
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service-Key': config.serviceAuthSecret },
    body: JSON.stringify({
      query: 'query ServiceStatus { serviceStatus { service status transport } }',
    }),
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body.data.serviceStatus, {
    service: 'interactions-service',
    status: 'ok',
    transport: 'GraphQL',
  })
})

test('rejects direct GraphQL access, oversized requests and unauthenticated private state', async () => {
  const headers = { 'Content-Type': 'application/json', 'X-Service-Key': config.serviceAuthSecret }
  const direct = await fetch(baseUrl + '/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ serviceStatus { status } }' }) })
  assert.equal(direct.status, 403)
  const oversized = await fetch(baseUrl + '/graphql', { method: 'POST', headers, body: JSON.stringify({ query: 'x'.repeat(130 * 1024) }) })
  assert.equal(oversized.status, 413)
  const privateState = await fetch(baseUrl + '/graphql', { method: 'POST', headers, body: JSON.stringify({ query: '{ savedPublications(userId: "someone") { items { id } } }' }) })
  const result = await privateState.json()
  assert.equal(result.errors[0].extensions.code, 'UNAUTHENTICATED')
  assert.equal('stacktrace' in result.errors[0].extensions, false)
})

test('HTTP GraphQL rejects batching and oversized selection sets before domain work', async () => {
  const headers = { 'Content-Type': 'application/json', 'X-Service-Key': config.serviceAuthSecret }
  const bodies = [
    [{ query: '{ serviceStatus { status } }' }, { query: '{ serviceStatus { status } }' }],
    { query: '{ ' + Array.from({ length: 7 }, (_, index) => 'a' + index + ': serviceStatus { status }').join(' ') + ' }' },
    { query: '{ serviceStatus { ' + Array.from({ length: 301 }, (_, index) => 'a' + index + ': status').join(' ') + ' } }' },
  ]
  for (const body of bodies) {
    const response = await fetch(baseUrl + '/graphql', { method: 'POST', headers, body: JSON.stringify(body) })
    assert.equal(response.status, 400)
    const result = await response.json()
    assert.ok(result.errors.length)
    assert.equal(result.data, undefined)
    assert.equal(JSON.stringify(result).includes('stacktrace'), false)
  }
})
