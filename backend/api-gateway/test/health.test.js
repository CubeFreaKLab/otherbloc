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

let server
let baseUrl

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()
  baseUrl = `http://127.0.0.1:${port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

test('reports gateway health and registered service boundaries', async () => {
  const response = await fetch(`${baseUrl}/health`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.service, 'api-gateway')
  assert.equal(body.revision, revision)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(body.services, ['users', 'content', 'interactions'])
})

test('returns a structured response for unknown routes', async () => {
  const response = await fetch(`${baseUrl}/missing`)
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(body.error, 'route_not_found')
})
