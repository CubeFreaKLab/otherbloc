import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import { createApp } from '../src/app.js'
import { env, validateRuntime } from '../src/config/env.js'

const secret = 'gateway-test-secret-with-at-least-thirty-two-bytes'
const internal = 'internal-test-secret-with-at-least-thirty-two-bytes'
async function listen(server) {
  server.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  return 'http://127.0.0.1:' + server.address().port
}
async function close(server) {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
const token = (expiresIn = '1m') => jwt.sign({ sid: 'session-test', kind: 'access', role: 'reader' }, secret, {
  subject: 'user-test', issuer: 'otherbloc-users', audience: 'otherbloc-platform', expiresIn,
})

test('forwards real REST and GraphQL requests with sanitized identity headers and preserves errors/cookies', async () => {
  const upstream = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Set-Cookie', ['first=1; HttpOnly', 'second=2; HttpOnly'])
    response.statusCode = request.url.includes('missing') ? 404 : 200
    response.end(JSON.stringify({ method: request.method, path: request.url, headers: request.headers, body: Buffer.concat(chunks).toString() }))
  })
  const url = await listen(upstream)
  const gateway = createApp({ config: { ...env, jwtSecret: secret, serviceAuthSecret: internal, usersServiceUrl: url, contentServiceUrl: url, interactionsServiceUrl: url + '/graphql' } }).listen()
  await new Promise((resolve) => gateway.once('listening', resolve))
  const base = 'http://127.0.0.1:' + gateway.address().port
  try {
    const response = await fetch(base + '/api/publications?category=cultura', { headers: { 'x-user-id': 'victim', 'x-user-role': 'admin', 'x-service-key': 'forged', cookie: 'private=1' } })
    const body = await response.json()
    assert.equal(body.path, '/api/publications/?category=cultura')
    assert.equal(body.headers['x-service-key'], internal)
    assert.equal(body.headers['x-user-id'], undefined)
    assert.equal(body.headers['x-user-role'], undefined)
    assert.equal(body.headers.cookie, undefined)
    assert.deepEqual(response.headers.getSetCookie(), [])
    const login = await fetch(base + '/api/users/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-otherbloc-request': '1', cookie: 'refresh=value' }, body: JSON.stringify({ email: 'demo@example.test' }) })
    const loginBody = await login.json()
    assert.equal(loginBody.path, '/api/users/login')
    assert.equal(JSON.parse(loginBody.body).email, 'demo@example.test')
    assert.equal(loginBody.headers.cookie, 'refresh=value')
    assert.equal(login.headers.getSetCookie().length, 2)
    const graph = await fetch(base + '/api/interactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '{ serviceStatus { name } }' }) })
    assert.equal((await graph.json()).path, '/graphql')
    assert.equal((await fetch(base + '/api/publications/missing')).status, 404)
    assert.equal((await fetch(base + '/api/interactions/internal')).status, 404)
  } finally { await close(gateway); await close(upstream) }
})

test('rejects missing/expired/forged tokens, wrong origins and repeated traffic', async () => {
  const app = createApp({ config: { ...env, jwtSecret: secret, serviceAuthSecret: internal, rateLimit: 5 } })
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  try {
    assert.equal((await fetch(base + '/api/users/me')).status, 401)
    assert.equal((await fetch(base + '/api/publications', { method: 'POST' })).status, 401)
    assert.equal((await fetch(base + '/api', { headers: { authorization: 'Bearer ' + token('-1s') } })).status, 401)
    assert.equal((await fetch(base + '/api', { headers: { authorization: 'Bearer invalid' } })).status, 401)
    assert.equal((await fetch(base + '/api', { headers: { origin: 'https://untrusted.example' } })).status, 403)
    assert.equal((await fetch(base + '/api', { headers: { authorization: 'Bearer ' + token() } })).status, 200)
    assert.equal((await fetch(base + '/api')).status, 429)
  } finally { await close(server) }
})

test('an unavailable upstream returns an explicit failure, never a synthetic success', async () => {
  const server = createApp({ config: { ...env, serviceAuthSecret: internal }, fetchImpl: async () => { throw new TypeError('network unavailable') } }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/publications')
    assert.equal(response.status, 502)
    assert.equal((await response.json()).error, 'service_unavailable')
  } finally { await close(server) }
})

test('runtime configuration refuses weak secrets and insecure cloud endpoints', () => {
  assert.throws(() => validateRuntime({ ...env, jwtSecret: 'short' }), /JWT_SECRET/)
  assert.throws(() => validateRuntime({ ...env, jwtSecret: secret, serviceAuthSecret: internal, nodeEnv: 'production' }), /origin|HTTPS/)
  validateRuntime({ ...env, jwtSecret: secret, serviceAuthSecret: internal })
})
