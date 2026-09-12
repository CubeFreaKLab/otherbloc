import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'

test('readiness probes only the three configured health routes, shares requests and does not expose secrets', async () => {
  let calls = 0
  const config = { ...env, usersServiceUrl: 'https://users.example', contentServiceUrl: 'https://content.example', interactionsServiceUrl: 'https://interactions.example/graphql' }
  const server = createApp({ config, fetchImpl: async (url, options) => {
    assert.equal(url.pathname, '/health'); assert.equal(options.headers, undefined)
    calls++; return Response.json({ status: 'ok' })
  } }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const url = 'http://localhost:' + server.address().port + '/api/ready'
    const responses = await Promise.all([fetch(url), fetch(url)])
    for (const response of responses) { assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ready: true }); assert.equal(response.headers.get('cache-control'), 'no-store') }
    assert.equal(calls, 3)
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
})

test('a sleeping dependency returns 503 without changing readiness into a write', async () => {
  const server = createApp({ fetchImpl: async () => { throw new Error('sleeping') } }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const response = await fetch('http://localhost:' + server.address().port + '/api/ready')
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { ready: false }); assert.equal(response.headers.get('retry-after'), '2')
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
})
