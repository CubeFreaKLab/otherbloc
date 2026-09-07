import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { deleteApp } from 'firebase-admin/app'
import jwt from 'jsonwebtoken'
import sharp from 'sharp'
import { createApp as createUsersApp } from '../../backend/users-service/src/app.js'
import { createApp as createGatewayApp } from '../../backend/api-gateway/src/app.js'
import { getFirebase } from '../../backend/users-service/src/config/firebase.js'
import { createUsersService } from '../../backend/users-service/src/services/users.js'
import { cookieOptions, digest } from '../../backend/users-service/src/lib/sessions.js'

const prefix = 'test-' + randomUUID()
const password = 'Una frase segura de demostración 2026'
const origin = 'http://127.0.0.1:5173'
const config = { nodeEnv: 'test', jwtSecret: 'test-only-jwt-secret-'.repeat(4), serviceAuthSecret: 'test-only-service-secret-'.repeat(4),
  allowedOrigins: [origin], accessSeconds: 900, sessionDays: 7, trustProxy: 0, upstreamTimeoutMs: 15000, rateLimit: 5000, rateWindowMs: 60000, authRateLimit: 100 }
let firebase, usersServer, gatewayServer, baseUrl, usersUrl, service, originalSecurity
let clock = Date.now()
const owned = new Map()
const state = (response) => ({ id: response.body.user.id, token: response.body.accessToken, cookie: response.cookies[0]?.split(';')[0] })
const emailFor = (id) => id + '@example.test'

async function http(method, path, options = {}) {
  const headers = { 'X-Otherbloc-Request': '1', Origin: origin, ...options.headers }
  if (options.token) headers.Authorization = 'Bearer ' + options.token
  if (options.cookie) headers.Cookie = options.cookie
  if (options.body !== undefined) headers['Content-Type'] = options.type ?? 'application/json'
  const response = await fetch((options.direct ? usersUrl : baseUrl) + path, {
    method, headers, body: options.body === undefined ? undefined : options.type ? options.body : JSON.stringify(options.body),
  })
  const body = response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer())
  return { status: response.status, body, cookies: response.headers.getSetCookie(), headers: response.headers }
}

async function register(label = randomUUID()) {
  const email = emailFor(prefix + '-' + label)
  const result = await http('POST', '/api/users/register', { body: { name: 'Persona de prueba', email, password } })
  assert.equal(result.status, 201)
  owned.set(result.body.user.id, email)
  return state(result)
}

async function seed(role) {
  const id = prefix + '-' + role
  const email = emailFor(id)
  await service.seed({ id, email, password, role, name: 'Prueba ' + role })
  owned.set(id, email)
  return state(await http('POST', '/api/users/login', { body: { email, password } }))
}

before(async () => {
  assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-otherbloc-test')
  firebase = getFirebase()
  originalSecurity = await firebase.db.collection('userSecurity').doc('platform').get()
  service = createUsersService({ config, firebase, now: () => clock })
  usersServer = createUsersApp({ config, firebase, now: () => clock }).listen(0, '127.0.0.1')
  await new Promise((resolve) => usersServer.once('listening', resolve))
  usersUrl = 'http://127.0.0.1:' + usersServer.address().port
  gatewayServer = createGatewayApp({ config: { ...config, usersServiceUrl: usersUrl, contentServiceUrl: 'http://127.0.0.1:1', interactionsServiceUrl: 'http://127.0.0.1:1/graphql' } }).listen(0, '127.0.0.1')
  await new Promise((resolve) => gatewayServer.once('listening', resolve))
  baseUrl = 'http://127.0.0.1:' + gatewayServer.address().port
})

after(async () => {
  for (const server of [gatewayServer, usersServer]) if (server) await new Promise((resolve) => server.close(resolve))
  if (firebase) {
    for (const [id, email] of owned) {
      for (const collection of ['userSessions', 'userAvatars']) {
        const docs = await firebase.db.collection(collection).where('userId', '==', id).get()
        for (const doc of docs.docs) {
          if (collection === 'userAvatars') await firebase.bucket.file(doc.data().path).delete({ ignoreNotFound: true })
          await doc.ref.delete()
        }
      }
      await firebase.db.collection('users').doc(id).delete()
      await firebase.db.collection('userEmails').doc(digest(email)).delete()
    }
    const ref = firebase.db.collection('userSecurity').doc('platform')
    if (originalSecurity?.exists) await ref.set(originalSecurity.data())
    else await ref.delete()
    await deleteApp(firebase.app)
  }
})

test('registration is persisted, unique and never returns credentials or accepts administrative privilege', async () => {
  const email = emailFor(prefix + '-strict')
  const forbidden = await http('POST', '/api/users/register', { body: { name: 'Intento', email, password, role: 'admin' } })
  assert.equal(forbidden.status, 400)
  const user = await register('unique')
  const doc = (await firebase.db.collection('users').doc(user.id).get()).data()
  assert.equal(doc.role, 'reader')
  assert.ok(doc.passwordHash.startsWith('scrypt$65536$8$2$'))
  assert.notEqual(doc.passwordHash, password)
  const publicProfile = await http('GET', '/api/users/' + user.id)
  assert.equal(publicProfile.status, 200)
  for (const field of ['email', 'password', 'passwordHash', 'authVersion', 'status']) assert.equal(field in publicProfile.body.user, false)
  const me = await http('GET', '/api/users/me', { token: user.token })
  assert.equal(me.body.user.email, owned.get(user.id))
  assert.equal('passwordHash' in me.body.user, false)
  const duplicate = await http('POST', '/api/users/register', { body: { name: 'Otra', email: owned.get(user.id).toUpperCase(), password } })
  assert.equal(duplicate.status, 409)
  assert.equal((await http('GET', '/api/users/' + prefix + '-missing')).status, 404)
  const profiles = await http('GET', '/api/users/profiles?ids=' + user.id + ',' + prefix + '-missing,' + user.id)
  assert.equal(profiles.status, 200)
  assert.equal(profiles.body.items.length, 1)
  assert.equal(profiles.body.items[0].id, user.id)
  for (const field of ['email', 'passwordHash', 'status', 'authVersion']) assert.equal(field in profiles.body.items[0], false)
  assert.equal((await http('GET', '/api/users/profiles?ids=' + Array.from({ length: 41 }, () => randomUUID()).join(','))).status, 400)
  assert.equal((await http('GET', '/api/users/profiles?ids=invalid%2Fid')).status, 400)
})

test('registration uses an atomic email reservation under concurrency', async () => {
  const email = emailFor(prefix + '-concurrent')
  const results = await Promise.all([1, 2].map(() => http('POST', '/api/users/register', { body: { name: 'Concurrente', email, password } })))
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409])
  const created = results.find((result) => result.status === 201)
  owned.set(created.body.user.id, email)
})

test('login rejects wrong credentials, direct service calls, expired tokens and forged identity headers', async () => {
  const user = await register()
  assert.equal((await http('POST', '/api/users/login', { body: { email: owned.get(user.id), password: 'incorrecta' } })).status, 401)
  assert.equal((await http('POST', '/api/users/login', { body: { email: emailFor(prefix + '-none'), password } })).status, 401)
  const login = await http('POST', '/api/users/login', { body: { email: owned.get(user.id), password } })
  assert.equal(login.status, 200)
  assert.ok(login.cookies[0].includes('HttpOnly'))
  assert.ok(login.cookies[0].includes('SameSite=Lax'))
  assert.equal('refreshToken' in login.body, false)
  assert.equal((await http('GET', '/api/users/me', { direct: true, token: user.token })).status, 403)
  assert.equal((await http('GET', '/api/users/me', { headers: { 'x-user-id': user.id, 'x-user-role': 'admin' } })).status, 401)
  const expired = jwt.sign({ sub: user.id, sid: randomUUID(), av: 0, kind: 'access' }, config.jwtSecret, { issuer: 'otherbloc-users', audience: 'otherbloc-platform', expiresIn: -1 })
  assert.equal((await http('GET', '/api/users/me', { token: expired })).status, 401)
  const internal = await http('GET', '/internal/session', { direct: true, token: user.token, headers: { 'X-Service-Key': config.serviceAuthSecret } })
  assert.equal(internal.status, 200)
  assert.equal(internal.body.user.id, user.id)
  assert.equal((await http('POST', '/api/users/logout', { token: user.token, body: {} })).status, 204)
  assert.equal((await http('GET', '/api/users/me', { token: user.token })).status, 401)
})

test('refresh survives process re-creation, rotates once for concurrent tabs, and rejects expired/revoked sessions', async () => {
  const user = await register()
  const token = decodeURIComponent(user.cookie.split('=')[1])
  const sid = token.split('.')[0]
  const stored = (await firebase.db.collection('userSessions').doc(sid).get()).data()
  assert.equal(stored.refreshHash, digest(token))
  assert.equal(JSON.stringify(stored).includes(token), false)
  const independent = createUsersService({ config, firebase, now: () => clock })
  assert.equal((await independent.refresh(token)).user.id, user.id)
  clock += 61000
  const results = await Promise.all([1, 2, 3].map(() => http('POST', '/api/users/refresh', { cookie: user.cookie, body: {} })))
  assert.deepEqual(results.map((item) => item.status), [200, 200, 200])
  const cookies = results.map((item) => item.cookies[0].split(';')[0])
  assert.ok(cookies.every((item) => item === cookies[0]))
  assert.ok(cookies[0] !== user.cookie)
  clock += 31000
  assert.equal((await http('POST', '/api/users/refresh', { cookie: user.cookie, body: {} })).status, 401)
  assert.equal((await http('POST', '/api/users/refresh', { cookie: cookies[0], headers: { 'X-Otherbloc-Request': '' }, body: {} })).status, 403)
  assert.equal((await http('POST', '/api/users/refresh', { cookie: cookies[0], headers: { Origin: 'https://untrusted.example' }, body: {} })).status, 403)
  assert.equal((await http('POST', '/api/users/logout', { cookie: cookies[0], body: {} })).status, 204)
  assert.equal((await http('GET', '/api/users/me', { token: user.token })).status, 401)
  assert.equal((await http('POST', '/api/users/refresh', { cookie: cookies[0], body: {} })).status, 401)
  assert.equal((await http('POST', '/api/users/logout', { cookie: cookies[0], body: {} })).status, 204)
  const expiring = await register()
  clock += 8 * 86400000
  assert.equal((await http('POST', '/api/users/refresh', { cookie: expiring.cookie, body: {} })).status, 401)
  clock = Date.now()
  assert.deepEqual(cookieOptions({ nodeEnv: 'production' }), { httpOnly: true, secure: true, sameSite: 'none', partitioned: true, path: '/' })
})

test('own profile is editable without changing privileges and password change invalidates all sessions', async () => {
  const user = await register()
  const other = await register()
  assert.equal((await http('PATCH', '/api/users/me', { token: user.token, body: { name: 'Editado', biography: 'Perfil propio', role: 'admin' } })).status, 400)
  assert.equal((await http('PATCH', '/api/users/' + other.id, { token: user.token, body: { name: 'Ajeno' } })).status, 404)
  const updated = await http('PATCH', '/api/users/me', { token: user.token, body: { name: 'Nombre editado', biography: 'Una biografía propia.' } })
  assert.equal(updated.status, 200)
  assert.equal((await http('GET', '/api/users/' + user.id)).body.user.biography, 'Una biografía propia.')
  const requested = await http('POST', '/api/users/me/author-request', { token: user.token, body: {} })
  assert.equal(requested.body.user.authorRequested, true)
  assert.equal(requested.body.user.role, 'reader')
  assert.equal((await http('GET', '/api/users', { token: user.token })).status, 403)
  const changed = await http('POST', '/api/users/me/password', { token: user.token, body: { currentPassword: password, password: 'Otra frase segura de demostración 2026' } })
  assert.equal(changed.status, 204)
  assert.equal((await http('GET', '/api/users/me', { token: user.token })).status, 401)
  assert.equal((await http('POST', '/api/users/refresh', { cookie: user.cookie, body: {} })).status, 401)
})

test('only administrators change permissions; changes revoke sessions and suspended profiles disappear', async () => {
  const admin = await seed('admin')
  const author = await seed('author')
  const reader = await register()
  assert.equal((await http('PATCH', '/api/users/' + reader.id + '/permissions', { token: author.token, body: { role: 'admin', status: 'active' } })).status, 403)
  assert.equal((await http('PATCH', '/api/users/' + admin.id + '/permissions', { token: admin.token, body: { role: 'reader', status: 'active' } })).status, 403)
  const result = await http('PATCH', '/api/users/' + reader.id + '/permissions', { token: admin.token, body: { role: 'author', status: 'active' } })
  assert.equal(result.body.user.role, 'author')
  assert.equal((await http('GET', '/api/users/me', { token: reader.token })).status, 401)
  const listing = await http('GET', '/api/users?limit=2', { token: admin.token })
  assert.equal(listing.body.items.length, 2)
  assert.ok(listing.body.nextCursor)
  const next = await http('GET', '/api/users?limit=2&cursor=' + listing.body.nextCursor, { token: admin.token })
  assert.ok(next.body.items.every((item) => !listing.body.items.some((previous) => previous.id === item.id)))
  assert.equal((await http('PATCH', '/api/users/' + author.id + '/permissions', { token: admin.token, body: { role: 'author', status: 'suspended' } })).status, 200)
  assert.equal((await http('GET', '/api/users/' + author.id)).status, 404)
  assert.deepEqual((await http('GET', '/api/users/profiles?ids=' + author.id)).body.items, [])
  assert.equal((await http('GET', '/api/users/me', { token: author.token })).status, 401)
  assert.equal((await http('POST', '/api/users/login', { body: { email: owned.get(author.id), password } })).status, 401)
})

test('avatars use Storage references and real bytes, with format/size/ownership checks and removal', async () => {
  const user = await register()
  const image = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#373735' } }).png().toBuffer()
  assert.equal((await http('PUT', '/api/users/me/avatar', { token: user.token, body: image, type: 'image/svg+xml' })).status, 415)
  assert.equal((await http('PUT', '/api/users/me/avatar', { token: user.token, body: Buffer.from('<svg>invalid</svg>'), type: 'image/png' })).status, 415)
  assert.equal((await http('PUT', '/api/users/me/avatar', { token: user.token, body: Buffer.alloc(2 * 1024 * 1024 + 1), type: 'image/png' })).status, 413)
  const upload = await http('PUT', '/api/users/me/avatar', { token: user.token, body: image, type: 'image/png' })
  assert.equal(upload.status, 200)
  assert.ok(upload.body.user.avatarUrl.startsWith('/api/users/' + user.id + '/avatar'))
  const media = await http('GET', upload.body.user.avatarUrl)
  assert.equal(media.status, 200)
  assert.equal((await sharp(media.body).metadata()).format, 'webp')
  const record = (await firebase.db.collection('users').doc(user.id).get()).data()
  const asset = (await firebase.db.collection('userAvatars').doc(record.avatarId).get()).data()
  assert.equal(asset.userId, user.id)
  assert.deepEqual((await firebase.bucket.file(asset.path).download())[0], media.body)
  assert.equal((await http('DELETE', '/api/users/me/avatar', { token: user.token })).status, 200)
  assert.equal((await http('GET', upload.body.user.avatarUrl)).status, 404)
})
