import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'

let apolloServer
let httpServer
let baseUrl

before(async () => {
  const application = await createApp()
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
    status: 'ok',
    transport: 'GraphQL',
  })
})

test('serves the GraphQL foundation query', async () => {
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
