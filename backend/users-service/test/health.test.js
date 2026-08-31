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

test('reports the users service health', async () => {
  const response = await fetch(`${baseUrl}/health`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body, {
    service: 'users-service',
    status: 'ok',
    transport: 'REST',
  })
})

test('exposes only foundation metadata at the users boundary', async () => {
  const response = await fetch(`${baseUrl}/api/users`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.status, 'foundation-ready')
  assert.deepEqual(body.capabilities, ['registration', 'authentication', 'profiles', 'roles'])
})
