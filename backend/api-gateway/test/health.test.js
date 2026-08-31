import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'

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
  assert.deepEqual(body.services, ['users', 'content', 'interactions'])
})

test('returns a structured response for unknown routes', async () => {
  const response = await fetch(`${baseUrl}/missing`)
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(body.error, 'route_not_found')
})
