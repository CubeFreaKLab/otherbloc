import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { assertReleaseContext, createRenderClient, deployRender, preflightRender, readRenderConfig, waitForRevision } from '../scripts/release/render.mjs'

const sha = 'a'.repeat(40)
const environment = { APP_REVISION: sha, RENDER_BLUEPRINT_ID: 'exs-' + 'b'.repeat(20) }
for (const [index, key] of ['USERS', 'CONTENT', 'INTERACTIONS', 'GATEWAY'].entries()) {
  environment['RENDER_' + key + '_SERVICE_ID'] = 'srv-' + String(index).repeat(20)
  environment['RENDER_' + key + '_ORIGIN'] = 'https://otherbloc-' + key.toLowerCase() + '.onrender.com'
}
const config = readRenderConfig(environment)
const repositoryUrl = 'https://github.com/CubeFreaKLab/otherbloc'
const live = (service) => ({ id: 'dep-' + service.key.toLowerCase(), status: 'live', commit: { id: sha } })
const health = (service, overrides = {}, headers = { 'Cache-Control': 'no-store' }) => Response.json({ service: service.healthService, status: 'ok', revision: sha, ...overrides }, { headers })

function fixture(change = (value) => value) {
  const calls = []
  let tick = 0
  const request = async (path, options = {}) => {
    calls.push({ path, ...options })
    if (path.startsWith('/blueprints/')) return change({ id: config.blueprintId, autoSync: false, status: 'in_sync', repo: repositoryUrl, branch: 'main', path: 'render.yaml', resources: config.services.map(({ id, name }) => ({ id, name, type: 'web_service' })) }, 'blueprint')
    const service = config.services.find(({ id }) => path.startsWith('/services/' + id))
    assert.ok(service, 'Unexpected fixture service')
    if (options.method === 'POST') return change(live(service), 'post', service)
    if (path.includes('/deploys?')) return change([{ deploy: live(service), cursor: 'fixture-cursor' }], 'recent', service)
    if (path.includes('/deploys/')) return change(live(service), 'poll', service)
    return change({ id: service.id, name: service.name, type: 'web_service', repo: repositoryUrl, branch: 'main', autoDeploy: 'no', suspended: 'not_suspended', serviceDetails: { url: service.origin, runtime: 'node', healthCheckPath: '/health' } }, 'service', service)
  }
  const log = []
  const options = { fetcher: async (url) => {
    const service = config.services.find(({ origin }) => url === origin + '/health')
    assert.ok(service, 'Unexpected health target')
    return health(service)
  }, now: () => tick, sleep: async (ms) => { tick += ms }, log: (value) => log.push(JSON.parse(value)) }
  return { request, calls, options, log }
}

test('Render configuration requires exactly four distinct approved HTTPS targets and a full SHA', () => {
  assert.deepEqual(config.services.map(({ healthService }) => healthService), ['users-service', 'content-service', 'interactions-service', 'api-gateway'])
  for (const override of [
    { APP_REVISION: 'main' }, { GITHUB_SHA: 'b'.repeat(40) }, { RENDER_BLUEPRINT_ID: '' },
    { RENDER_USERS_SERVICE_ID: '../other' }, { RENDER_USERS_SERVICE_ID: environment.RENDER_CONTENT_SERVICE_ID },
    { RENDER_USERS_ORIGIN: environment.RENDER_CONTENT_ORIGIN }, { RENDER_USERS_ORIGIN: 'http://localhost:3001' },
    { RENDER_USERS_ORIGIN: 'https://otherbloc-users.onrender.com/' }, { RENDER_USERS_ORIGIN: 'https://user:password@otherbloc-users.onrender.com' },
    { RENDER_USERS_ORIGIN: 'https://otherbloc-users.onrender.com.attacker.test' }, { RENDER_USERS_ORIGIN: 'https://otherbloc-users.onrender.com:444' },
  ]) assert.throws(() => readRenderConfig({ ...environment, ...override }))
})

test('Render writes require the exact approved main workflow context; local preflight is separate', () => {
  const allowed = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: 'CubeFreaKLab/otherbloc', GITHUB_REF: 'refs/heads/main', GITHUB_WORKFLOW_REF: 'CubeFreaKLab/otherbloc/.github/workflows/release.yml@refs/heads/main', GITHUB_SHA: sha, RELEASE_APPROVED_SHA: sha }
  assertReleaseContext(allowed, sha)
  for (const key of Object.keys(allowed)) assert.throws(() => assertReleaseContext({ ...allowed, [key]: '' }, sha), /approved/)
  assert.throws(() => assertReleaseContext({ ...allowed, GITHUB_EVENT_NAME: 'pull_request' }, sha), /approved/)
})

test('Render preflight reads the Blueprint and every owned service before any deploy', async () => {
  const { request, calls } = fixture()
  const result = await preflightRender(config, request)
  assert.equal(result.services.length, 4)
  assert.equal(calls.length, 9)
  assert.ok(calls.every(({ method }) => method === undefined))
})

test('automatic sync, unexpected resources, service settings and active deploys fail before writes', async () => {
  for (const [kind, modify] of [
    ['blueprint', (value) => ({ ...value, autoSync: true })], ['blueprint', (value) => ({ ...value, status: 'syncing' })],
    ['blueprint', (value) => ({ ...value, resources: [...value.resources, value.resources[0]] })],
    ['blueprint', (value) => ({ ...value, resources: value.resources.map((resource) => ({ ...resource, id: 'srv-wrong' })) })],
    ['blueprint', (value) => ({ ...value, repo: 'https://github.com/someone/otherbloc' })],
    ['service', (value) => ({ ...value, autoDeploy: 'yes' })], ['service', (value) => ({ ...value, branch: 'other' })],
    ['service', (value) => ({ ...value, suspended: 'suspended' })], ['service', (value) => ({ ...value, name: 'wrong' })],
    ['service', (value) => ({ ...value, serviceDetails: { ...value.serviceDetails, url: 'https://wrong.onrender.com' } })],
    ['service', (value) => ({ ...value, serviceDetails: { ...value.serviceDetails, runtime: 'docker' } })],
    ['recent', () => [{ deploy: { status: 'queued' } }]], ['recent', () => [{ deploy: { status: 'new-unknown-status' } }]],
  ]) {
    const { request, calls, options } = fixture((value, actualKind) => actualKind === kind ? modify(value) : value)
    await assert.rejects(deployRender(config, request, options))
    assert.equal(calls.some(({ method }) => method === 'POST'), false)
  }
})

test('Render HTTP client uses a fixed API origin, private header, bounded calls and no redirects', async () => {
  const requests = []
  const request = createRenderClient('fixture-not-a-real-token', async (url, options) => { requests.push({ url, options }); return Response.json({ id: 'dep-fixture' }, { status: options.method === 'POST' ? 201 : 200 }) })
  await request('/services/' + config.services[0].id)
  await request('/services/' + config.services[0].id + '/deploys', { method: 'POST', body: { commitId: sha } })
  assert.equal(requests[0].url, 'https://api.render.com/v1/services/' + config.services[0].id)
  assert.equal(requests[0].options.headers.Authorization, 'Bearer fixture-not-a-real-token')
  assert.equal(requests[1].options.redirect, 'error')
  assert.equal(requests[1].options.signal.aborted, false)
  assert.deepEqual(JSON.parse(requests[1].options.body), { commitId: sha })
  for (const path of ['https://attacker.test', '/services/../other', '/services/srv-test?token=bad']) await assert.rejects(request(path), /Unsupported/)
  await assert.rejects(request('/services/' + config.services[0].id, { method: 'DELETE' }), /Unsupported/)
  assert.equal(requests.length, 2)
})

test('uncertain Render writes and HTTP failures are never retried or echoed with secret response bodies', async () => {
  for (const result of [() => { throw new Error('fixture-secret-network-detail') }, () => Response.json({ message: 'fixture-secret-response' }, { status: 500 }), () => new Response('fixture-secret-invalid-json', { status: 201 })]) {
    let calls = 0
    const request = createRenderClient('fixture-not-a-real-token', async () => { calls += 1; return result() })
    await assert.rejects(request('/services/' + config.services[0].id + '/deploys', { method: 'POST', body: { commitId: sha } }), (error) => !error.message.includes('fixture-secret') && /inspect|retry/.test(error.message))
    assert.equal(calls, 1)
  }
})

test('a release deploys Users, Content, Interactions then Gateway at the exact SHA and verifies each before advancing', async () => {
  const { request, calls, options, log } = fixture((value, kind) => kind === 'post' ? { id: value.id, status: 'queued' } : value)
  const result = await deployRender(config, request, options)
  assert.deepEqual(result.map(({ service }) => service), config.services.map(({ name }) => name))
  const posts = calls.filter(({ method }) => method === 'POST')
  assert.deepEqual(posts.map(({ path }) => path), config.services.map(({ id }) => '/services/' + id + '/deploys'))
  assert.ok(posts.every(({ body }) => JSON.stringify(body) === JSON.stringify({ commitId: sha })))
  assert.deepEqual(log.map(({ event }) => event), config.services.flatMap(() => ['deploy-request', 'deploy-created', 'deploy-status', 'deploy-status', 'service-verified']))
  assert.equal(log.filter(({ status }) => status === 'live').length, 4)
})

test('a partial Render failure keeps its verified predecessor and never deploys later services', async () => {
  const { request, calls, options, log } = fixture((value, kind, service) => kind === 'post' && service.key === 'CONTENT' ? { ...value, status: 'build_failed' } : value)
  await assert.rejects(deployRender(config, request, options), /build_failed/)
  assert.equal(calls.filter(({ method }) => method === 'POST').length, 2)
  assert.deepEqual(log.filter(({ event }) => event === 'service-verified').map(({ service }) => service), ['otherbloc-users'])
  assert.equal(log.filter(({ event }) => event === 'deploy-created').at(-1).deployId, 'dep-content')
})

test('wrong commits, unknown statuses, missing live commits and wrapped deploy objects cannot pass', async () => {
  for (const modify of [(value) => ({ ...value, commit: { id: 'b'.repeat(40) } }), (value) => ({ ...value, status: 'unknown' }),
    (value) => ({ ...value, commit: undefined }), (value) => ({ deploy: value }), (value) => ({ ...value, id: '../bad' })]) {
    const { request, calls, options } = fixture((value, kind) => kind === 'post' ? modify(value) : value)
    await assert.rejects(deployRender(config, request, options))
    assert.equal(calls.filter(({ method }) => method === 'POST').length, 1)
  }
})

test('a queued deployment times out without a new POST or advancing to another service', async () => {
  const { request, calls, options } = fixture((value, kind) => ['post', 'poll'].includes(kind) ? { ...value, status: 'queued' } : value)
  await assert.rejects(deployRender(config, request, { ...options, deployTimeoutMs: 21000 }), /deploy timeout/)
  assert.equal(calls.filter(({ method }) => method === 'POST').length, 1)
  assert.equal(calls.filter(({ path }) => /\/deploys\/dep-/.test(path)).length, 2)
})

test('health acceptance requires identity, current SHA, success and non-cached HTTP without a credential', async () => {
  const service = config.services[0]
  const { options } = fixture()
  let attempts = 0
  await waitForRevision(service, sha, { ...options, fetcher: async (_url, request) => {
    assert.equal(request.headers, undefined)
    assert.equal(request.redirect, 'error')
    attempts += 1
    return attempts === 1 ? health(service, { revision: 'b'.repeat(40) }) : health(service)
  } })
  assert.equal(attempts, 2)
  for (const response of [() => health(service, { service: 'wrong' }), () => health(service, { revision: null }),
    () => health(service, { status: 'down' }), () => health(service, {}, {}), () => new Response('', { status: 503 })]) {
    const { options: timing } = fixture()
    await assert.rejects(waitForRevision(service, sha, { ...timing, timeoutMs: 10000, fetcher: async () => response() }), /timeout/)
  }
})

test('unverified health or failed polling halts the release without retrying a deploy request', async () => {
  const { request, calls, options } = fixture((value, kind) => kind === 'post' ? { ...value, status: 'queued' } : value)
  await assert.rejects(deployRender(config, async (path, init) => {
    if (/\/deploys\/dep-/.test(path)) throw new Error('fixture polling unavailable')
    return request(path, init)
  }, options), /polling unavailable/)
  assert.equal(calls.filter(({ method }) => method === 'POST').length, 1)
  const other = fixture()
  await assert.rejects(deployRender(config, other.request, { ...other.options, healthTimeoutMs: 10000, fetcher: async () => health(config.services[0], { revision: null }) }), /timeout/)
  assert.equal(other.calls.filter(({ method }) => method === 'POST').length, 1)
})

test('the public Render command rejects local writes before requesting credentials or making HTTP calls', () => {
  const result = spawnSync(process.execPath, ['scripts/release-render.mjs', '--deploy'], { encoding: 'utf8', env: { ...process.env, ...environment, GITHUB_SHA: sha, GITHUB_ACTIONS: 'false', RENDER_API_KEY: '' }, timeout: 5000 })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /approved main-branch release workflow/)
  assert.doesNotMatch(result.stderr, /RENDER_API_KEY|fetch|fixture-not-a-real-token/)
})
