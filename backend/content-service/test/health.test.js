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

test('reports the content service health', async () => {
  const response = await fetch(`${baseUrl}/health`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body, {
    service: 'content-service',
    revision,
    status: 'ok',
    transport: 'REST',
  })
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('requires an internal key at the content boundary', async () => {
  const response = await fetch(`${baseUrl}/api/publications`)
  const body = await response.json()

  assert.equal(response.status, 403)
  assert.equal(body.error, 'service_access_required')
})
