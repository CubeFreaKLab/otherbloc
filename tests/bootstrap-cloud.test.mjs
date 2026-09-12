import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { parseBootstrapArgs, readBootstrapConfig, validateBootstrapCredentials, runCloudBootstrap } from '../scripts/bootstrap-cloud-config.mjs'
import { demoAccounts, seedDemoUsers, seedDemoPublications } from '../scripts/seed-demo.mjs'
import { ciEnvironment } from '../scripts/ci-config.mjs'
import { articles } from '../frontend/src/data/articles.js'

const revision = 'a'.repeat(40), checkout = { revision, clean: true }
const source = { NODE_ENV: 'production', BOOTSTRAP_REVISION: revision, FIREBASE_PROJECT_ID: 'otherbloc-fixture', FIREBASE_STORAGE_BUCKET: 'otherbloc-fixture.firebasestorage.app',
  RENDER_BLUEPRINT_ID: 'exs-' + 'b'.repeat(20), SEED_READER_EMAIL: 'reader@example.test', SEED_AUTHOR_EMAIL: 'author@example.test',
  SEED_ADMIN_EMAIL: 'admin@example.test', SEED_PASSWORD: 'Only a synthetic test password 2026' }
for (const [index, key] of ['USERS', 'CONTENT', 'INTERACTIONS', 'GATEWAY'].entries()) {
  source['RENDER_' + key + '_SERVICE_ID'] = 'srv-' + String(index).repeat(20)
  source['RENDER_' + key + '_ORIGIN'] = 'https://fixture-' + key.toLowerCase() + '.onrender.com'
}
const options = { mode: 'apply', stage: 'users', confirmProject: source.FIREBASE_PROJECT_ID }
const configuration = (changes = {}, changedOptions = options, changedCheckout = checkout) => readBootstrapConfig({ ...source, ...changes }, changedOptions, changedCheckout)
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

test('Cloudinary bootstrap selects an explicit cloud destination without requiring Firebase Storage', () => {
  const changes = { MEDIA_STORAGE_PROVIDER: 'cloudinary', FIREBASE_STORAGE_BUCKET: '', CLOUDINARY_CLOUD_NAME: 'fixture-cloud' }
  const config = configuration(changes, { mode: 'plan', stage: 'users' })
  assert.equal(config.provider, 'cloudinary')
  assert.equal(config.cloudName, 'fixture-cloud')
  for (const invalid of [{ CLOUDINARY_CLOUD_NAME: '' }, { CLOUDINARY_CLOUD_NAME: 'https://example.test' },
    { FIREBASE_STORAGE_BUCKET: source.FIREBASE_STORAGE_BUCKET }, { MEDIA_STORAGE_PROVIDER: 'unknown' }]) {
    assert.throws(() => configuration({ ...changes, ...invalid }))
  }
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const credential = { ...source, ...changes, FIREBASE_CLIENT_EMAIL: 'fixture-owner@otherbloc-fixture.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: privateKey, CLOUDINARY_API_KEY: '123456789', CLOUDINARY_API_SECRET: 'synthetic-secret' }
  assert.doesNotThrow(() => validateBootstrapCredentials(credential, config))
  for (const key of ['CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    assert.throws(() => validateBootstrapCredentials({ ...credential, [key]: '' }, config), /Cloudinary credentials/)
  }
  const isolated = ciEnvironment(credential, '/temporary', 'fixture-run')
  assert.equal(isolated.CLOUDINARY_API_SECRET, undefined)
  assert.equal(isolated.MEDIA_STORAGE_PROVIDER, undefined)
})

test('bootstrap requires explicit mode, stage and project confirmation without reset or deployment flags', () => {
  assert.deepEqual(parseBootstrapArgs(['--stage=users', '--apply', '--confirm-project=otherbloc-fixture']), options)
  assert.deepEqual(parseBootstrapArgs(['--plan', '--stage=content']), { mode: 'plan', stage: 'content' })
  for (const args of [[], ['--apply'], ['--apply', '--stage=all'], ['--apply', '--stage=users'], ['--plan', '--apply'],
    ['--plan', '--stage=users', '--reset'], ['--plan', '--stage=users', '--confirm-project=x'], ['--plan', '--stage=users', '--stage=content'],
    ['--apply', '--stage=users', '--confirm-project=x', '--confirm-project=y']]) assert.throws(() => parseBootstrapArgs(args))
})

test('cloud bootstrap fails closed on emulator, stale/dirty checkout, wrong project or unexpected targets', () => {
  assert.equal(configuration().gateway, source.RENDER_GATEWAY_ORIGIN)
  for (const changes of [{ NODE_ENV: 'development' }, { CI: 'true' }, { GITHUB_ACTIONS: 'true' }, { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
    { FIREBASE_EMULATOR_HUB: '127.0.0.1:4400' }, { FIREBASE_PROJECT_ID: 'demo-otherbloc' }, { FIREBASE_STORAGE_BUCKET: 'another.appspot.com' },
    { GOOGLE_APPLICATION_CREDENTIALS: 'fixture.json' }, { FIREBASE_CONFIG: '{}' }, { DOTENV_CONFIG_PATH: 'fixture.env' },
    { RENDER_API_KEY: 'fixture' }, { GITHUB_TOKEN: 'fixture' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { APP_REVISION: 'b'.repeat(40) },
    { BOOTSTRAP_REVISION: 'short' }, { RENDER_GATEWAY_ORIGIN: 'http://127.0.0.1:3000' }, { RENDER_USERS_ORIGIN: source.RENDER_CONTENT_ORIGIN }]) assert.throws(() => configuration(changes))
  assert.throws(() => configuration({}, options, { revision, clean: false }))
  assert.throws(() => configuration({}, { ...options, confirmProject: 'another-project' }))
  assert.equal(configuration({ FIREBASE_STORAGE_BUCKET: source.FIREBASE_PROJECT_ID + '.appspot.com' }).projectId, source.FIREBASE_PROJECT_ID)
  assert.equal(configuration({}, { mode: 'plan', stage: 'users' }).mode, 'plan')
})

test('apply credential checks validate project-bound RSA input and all demo identities without echoing values', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const credential = { ...source, FIREBASE_CLIENT_EMAIL: 'fixture-owner@otherbloc-fixture.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY: privateKey }
  assert.doesNotThrow(() => validateBootstrapCredentials(credential, configuration()))
  assert.doesNotThrow(() => validateBootstrapCredentials({ ...credential, FIREBASE_PRIVATE_KEY: privateKey.replaceAll('\n', '\\n') }, configuration()))
  for (const changes of [{ FIREBASE_CLIENT_EMAIL: 'fixture-owner@wrong-project.iam.gserviceaccount.com' }, { FIREBASE_PRIVATE_KEY: 'secret-invalid-fixture' },
    { SEED_PASSWORD: 'short' }, { SEED_ADMIN_EMAIL: source.SEED_READER_EMAIL }]) {
    assert.throws(() => validateBootstrapCredentials({ ...credential, ...changes }, configuration()), (error) => !error.message.includes('secret-invalid-fixture') && !error.message.includes(privateKey))
  }
})

test('all four exact health checks precede the selected owner write, and failures do not retry or advance', async () => {
  const events = [], config = configuration(), operations = { log: () => {}, checkHealth: async (service, sha) => { assert.equal(sha, revision); events.push(service.key) },
    users: async () => { events.push('write-users') }, content: async () => { events.push('write-content') } }
  await runCloudBootstrap(config, operations)
  assert.deepEqual(events, ['USERS', 'CONTENT', 'INTERACTIONS', 'GATEWAY', 'write-users'])
  events.length = 0
  await assert.rejects(runCloudBootstrap(config, { ...operations, checkHealth: async () => { events.push('failed-health'); throw new Error('offline') } }))
  assert.deepEqual(events, ['failed-health'])
  events.length = 0
  await runCloudBootstrap({ ...config, stage: 'content' }, operations)
  assert.equal(events.at(-1), 'write-content')
  await assert.rejects(runCloudBootstrap({ ...config, mode: 'plan' }, operations), /validated apply/)
})

test('cloud CLI rejects incomplete flags and retains local seed and CI-isolation guards', async () => {
  const missing = spawnSync(process.execPath, ['scripts/bootstrap-cloud.mjs', '--apply'], { encoding: 'utf8' })
  assert.equal(missing.status, 1)
  assert.doesNotMatch(missing.stdout, /Starting approved/)
  for (const name of ['seed-users.mjs', 'seed-content.mjs']) {
    const code = await readFile(new URL('../scripts/' + name, import.meta.url), 'utf8')
    assert.match(code, /FIREBASE_PROJECT_ID !== 'demo-otherbloc'/)
    assert.match(code, /NODE_ENV === 'production'/)
    assert.match(code, /setupLocal/)
  }
  const isolated = ciEnvironment({ BOOTSTRAP_REVISION: revision }, '/temporary', 'fixture-run')
  assert.equal(isolated.BOOTSTRAP_REVISION, undefined)
})

test('demo users validate every account before writes, preserve roles and stop at a collision', async () => {
  const accounts = demoAccounts(source), writes = [], logs = []
  assert.equal(accounts.length, 6)
  assert.deepEqual(accounts.map(({ role }) => role), ['reader', 'author', 'author', 'author', 'author', 'admin'])
  const service = { seed: async (input) => { writes.push(input); return { created: writes.length === 1 } } }
  await assert.rejects(seedDemoUsers(service, { ...source, SEED_ADMIN_EMAIL: 'invalid' }, (value) => logs.push(value)))
  assert.equal(writes.length, 0)
  await seedDemoUsers(service, source, (value) => logs.push(value))
  assert.equal(writes.length, 6)
  assert.equal(writes[5].id, 'demo-admin')
  assert.ok(logs.some((line) => line.includes('kept existing')))
  assert.ok(logs.every((line) => !line.includes(source.SEED_PASSWORD) && !line.includes('@')))
  writes.length = 0
  await assert.rejects(seedDemoUsers({ seed: async () => { writes.push('collision'); throw new Error('conflict') } }, source, () => {}))
  assert.deepEqual(writes, ['collision'])
})

function publicationFixture({ created = true, failAt, wrongIdentity = false, logoutFails = false } = {}) {
  const calls = [], logs = [], article = articles[0], accounts = demoAccounts(source)
  const service = { seedDraft: async (id, identity) => { calls.push(['draft', id, identity.role]); return { created, publication: { version: 1, status: 'draft' } } },
    prepareSeedImages: async () => { calls.push(['prepare-images']) } }
  const fetcher = async (url, settings) => {
    assert.ok(url.startsWith(source.RENDER_GATEWAY_ORIGIN + '/api/'))
    assert.equal(settings.redirect, 'error')
    assert.ok(settings.signal instanceof AbortSignal)
    const path = new URL(url).pathname
    calls.push([settings.method, path, settings])
    if (path.endsWith('/logout')) return logoutFails ? json({}, 503) : new Response(null, { status: 204 })
    if (path === failAt) return json({ message: 'must-not-appear-in-log', token: 'fixture-hidden-token' }, 503)
    if (path.endsWith('/login')) {
      const { email } = JSON.parse(settings.body), account = accounts.find((entry) => entry.email === email)
      return json({ user: { id: wrongIdentity ? 'unexpected-account' : account.id, name: account.name, role: account.role }, accessToken: 'synthetic-' + account.id })
    }
    if (path.endsWith('/assets')) return json({ asset: { id: 'fixture-asset' } })
    if (settings.method === 'PUT') return json({ publication: { version: 2 } })
    if (settings.method === 'PATCH') return json({ publication: { version: JSON.parse(settings.body).status === 'review' ? 3 : 4 } })
    return json({ publication: { status: 'published', title: article.title } })
  }
  return { calls, logs, article, run: (extras = {}) => seedDemoPublications({ service, source, gateway: source.RENDER_GATEWAY_ORIGIN, fetcher,
    publications: [article], readAsset: async () => Buffer.from('synthetic-image-fixture'), log: (value) => logs.push(value), ...extras }) }
}

test('demo content uses owner draft then gateway image, versioned edit, author review, admin publish and public read', async () => {
  const fixture = publicationFixture()
  await fixture.run()
  const changes = fixture.calls.filter(([method]) => ['PUT', 'PATCH'].includes(method))
  assert.deepEqual(changes.map(([method, , { headers }]) => [method, headers['If-Match']]), [['PUT', '"1"'], ['PATCH', '"2"'], ['PATCH', '"3"']])
  assert.equal(changes[1][2].headers.Authorization, 'Bearer synthetic-' + fixture.article.authorId)
  assert.equal(changes[2][2].headers.Authorization, 'Bearer synthetic-demo-admin')
  assert.ok(JSON.parse(changes[0][2].body).blocks.every(({ id }) => /^[a-f0-9-]{36}$/.test(id)))
  assert.equal(fixture.calls.filter(([, path]) => path === '/api/users/logout').length, 2)
  assert.ok(fixture.logs.some((line) => line.includes('published and read')))
})

test('existing demo content is preserved, with image preparation only when explicitly requested locally', async () => {
  const fixture = publicationFixture({ created: false })
  await fixture.run()
  assert.ok(!fixture.calls.some(([method]) => ['PUT', 'PATCH', 'prepare-images'].includes(method)))
  assert.ok(!fixture.calls.some(([, path]) => path?.endsWith('/assets')))
  await fixture.run({ prepareImages: true })
  assert.equal(fixture.calls.filter(([method]) => method === 'prepare-images').length, 1)
})

test('failed content requests are not retried or echoed, and acquired sessions are closed', async () => {
  const fixture = publicationFixture({ failAt: '/api/publications/' + articles[0].slug + '/assets' })
  await assert.rejects(fixture.run(), (error) => error.message.includes('HTTP 503') && !error.message.includes('must-not-appear'))
  assert.equal(fixture.calls.filter(([, path]) => path?.endsWith('/assets')).length, 1)
  assert.ok(!fixture.calls.some(([method]) => ['PUT', 'PATCH'].includes(method)))
  assert.equal(fixture.calls.filter(([, path]) => path === '/api/users/logout').length, 2)
})

test('unexpected login identity is logged out before any draft, and logout failures remain visible', async () => {
  const mismatch = publicationFixture({ wrongIdentity: true })
  await assert.rejects(mismatch.run(), /identity\/role/)
  assert.ok(!mismatch.calls.some(([method]) => method === 'draft'))
  assert.equal(mismatch.calls.filter(([, path]) => path === '/api/users/logout').length, 1)
  const cleanup = publicationFixture({ created: false, logoutFails: true })
  await cleanup.run()
  assert.equal(cleanup.logs.filter((line) => line.startsWith('Warning:')).length, 2)
})
