import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { readiness } from '../src/routes/readiness.js'

test('readiness probes only the three configured health routes, shares requests and does not expose secrets', async () => {
  let calls = 0
  const config = { ...env, usersServiceUrl: 'https://users.example', contentServiceUrl: 'https://content.example', interactionsServiceUrl: 'https://interactions.example/graphql' }
  const server = createApp({ config, fetchImpl: async (url, options) => {
    assert.equal(url.pathname, '/health'); assert.deepEqual(options.headers, { Accept: 'application/json' })
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

test('cold dependency probes have a separate bounded startup timeout', async (t) => {
  const timeouts = []
  t.mock.method(AbortSignal, 'timeout', (ms) => { timeouts.push(ms); return new AbortController().signal })
  const check = readiness({ usersServiceUrl: 'https://users.example', contentServiceUrl: 'https://content.example', interactionsServiceUrl: 'https://interactions.example' }, async () => Response.json({ status: 'ok' }))
  const response = { set() {}, status(code) { assert.equal(code, 200); return this }, json(body) { assert.deepEqual(body, { ready: true }) } }
  await check({}, response)
  assert.deepEqual(timeouts, [60000, 60000, 60000])
})

test('unready diagnostics expose only service labels and bounded categories', async () => {
  const events = []
  const check = readiness({ usersServiceUrl: 'https://users.example', contentServiceUrl: 'https://content.example', interactionsServiceUrl: 'https://interactions.example' }, async () => { throw new Error('private upstream detail') }, (event) => events.push(event))
  await check({}, { set() {}, status(code) { assert.equal(code, 503); return this }, json() {} })
  assert.deepEqual(events.map(({ service, reason }) => ({ service, reason })), ['users', 'content', 'interactions'].map((service) => ({ service, reason: 'network_error' })))
  assert.equal(JSON.stringify(events).includes('private'), false)
  for (const event of events) assert.deepEqual(Object.keys(event).sort(), ['elapsedMs', 'event', 'reason', 'service'])
})

test('a provider HTML response is diagnosed without logging its contents', async () => {
  const events = []
  const check = readiness({ usersServiceUrl: 'https://users.example', contentServiceUrl: 'https://content.example', interactionsServiceUrl: 'https://interactions.example' }, async () => new Response('<html>provider detail</html>'), (event) => events.push(event))
  await check({}, { set() {}, status(code) { assert.equal(code, 503); return this }, json() {} })
  assert.equal(events.length, 3)
  for (const event of events) { assert.equal(event.reason, 'non_json'); assert.equal(event.status, 200) }
  assert.equal(JSON.stringify(events).includes('provider detail'), false)
})

test('unready response offers only configured public Render health URLs, not secrets or private hosts', async () => {
  const check = readiness({ usersServiceUrl: 'https://otherbloc-users.onrender.com', contentServiceUrl: 'http://content.internal:3002', interactionsServiceUrl: 'https://secret:password@otherbloc-interactions.onrender.com/graphql' }, async () => Response.json({ status: 'starting' }), () => {})
  await check({}, { set() {}, status(code) { assert.equal(code, 503); return this }, json(body) {
    assert.deepEqual(body, { ready: false, wakeups: ['https://otherbloc-users.onrender.com/health'] })
  } })
})
