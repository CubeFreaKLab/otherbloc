import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { deleteApp } from 'firebase-admin/app'
import jwt from 'jsonwebtoken'
import sharp from 'sharp'
import { createApp as createUsersApp } from '../../backend/users-service/src/app.js'
import { createApp as createContentApp } from '../../backend/content-service/src/app.js'
import { createApp as createGatewayApp } from '../../backend/api-gateway/src/app.js'
import { getFirebase as getUsersFirebase } from '../../backend/users-service/src/config/firebase.js'
import { getFirebase as getContentFirebase } from '../../backend/content-service/src/config/firebase.js'
import { createUsersService } from '../../backend/users-service/src/services/users.js'
import { digest } from '../../backend/users-service/src/lib/sessions.js'

const prefix = 'test-' + randomUUID()
const password = 'Una frase segura de contenido 2026'
const origin = 'http://127.0.0.1:5173'
const config = { nodeEnv: 'test', jwtSecret: 'content-test-only-jwt-'.repeat(4), serviceAuthSecret: 'content-test-only-service-'.repeat(4),
  allowedOrigins: [origin], accessSeconds: 900, sessionDays: 7, trustProxy: 0, upstreamTimeoutMs: 15000, rateLimit: 10000, rateWindowMs: 60000, authRateLimit: 100 }
let usersFirebase, contentFirebase, usersServer, contentServer, gatewayServer, baseUrl, contentUrl, originalSecurity, imageBytes
const users = {}, ownedPublications = new Set(), ownedUsers = new Map()
const url = (id, suffix = '') => '/api/publications/' + id + suffix
const listen = (app, port = 0) => new Promise((resolve) => { const server = app.listen(port, '127.0.0.1', () => resolve(server)) })
const close = (server) => server ? new Promise((resolve) => server.close(resolve)) : Promise.resolve()

async function http(method, path, options = {}) {
  const headers = { 'X-Otherbloc-Request': '1', Origin: origin, ...options.headers }
  if (options.user) headers.Authorization = 'Bearer ' + options.user.token
  if (options.version !== undefined) headers['If-Match'] = '"' + options.version + '"'
  if (options.body !== undefined) headers['Content-Type'] = options.type ?? 'application/json'
  const response = await fetch((options.direct ? contentUrl : baseUrl) + path, {
    method, headers, body: options.body === undefined ? undefined : options.type ? options.body : JSON.stringify(options.body),
  })
  return { status: response.status, headers: response.headers, body: response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer()) }
}

async function create(user = users.author) {
  const id = randomUUID()
  ownedPublications.add(id)
  const response = await http('POST', '/api/publications', { user, body: { id, title: 'Un borrador de prueba' } })
  assert.equal(response.status, 201, response.body.message)
  return response.body.publication
}

function editor(publication, changes = {}) {
  const { title, summary, coverId, coverAlt, type, category, tags, blocks } = publication
  return { title, summary, coverId, coverAlt, type, category, tags, blocks: blocks.map(({ url: _url, ...block }) => block), ...changes }
}

async function complete(user = users.author, changes = {}) {
  const draft = await create(user)
  const upload = await http('POST', url(draft.id, '/assets'), { user, body: imageBytes, type: 'image/png' })
  assert.equal(upload.status, 201, upload.body.message)
  const assetId = upload.body.asset.id
  const blocks = [
    { id: randomUUID(), type: 'heading', text: 'Mirar la ciudad', level: 2 },
    { id: randomUUID(), type: 'paragraph', text: 'La ciudad también se descubre al caminar despacio y prestar atención a sus plazas.' },
    { id: randomUUID(), type: 'list', items: ['Caminar', 'Observar', 'Escribir'], ordered: true },
    { id: randomUUID(), type: 'quote', text: 'Mirar es el primer paso.', attribution: 'Texto de demostración' },
    { id: randomUUID(), type: 'image', assetId, alt: 'Imagen de prueba en color', caption: 'Recurso sintético para verificar Storage.' },
  ]
  const response = await http('PUT', url(draft.id), { user, version: draft.version, body: editor(draft, {
    title: 'Crónica de una ciudad caminable', summary: 'Una mirada a las plazas, sus lectores y el ritmo de la ciudad.', category: 'Ciudad', type: 'Crónica',
    coverId: assetId, coverAlt: 'Un recurso de prueba', tags: ['Lectura', 'Espacio público'], blocks, ...changes,
  }) })
  assert.equal(response.status, 200, response.body.message)
  return response.body.publication
}

async function transition(publication, status, user, reason) {
  const response = await http('PATCH', url(publication.id, '/status'), { user, version: publication.version, body: { status, ...(reason ? { reason } : {}) } })
  assert.equal(response.status, 200, response.body.message)
  return response.body.publication
}

before(async () => {
  assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-otherbloc-test')
  usersFirebase = getUsersFirebase(); contentFirebase = getContentFirebase()
  originalSecurity = await usersFirebase.db.collection('userSecurity').doc('platform').get()
  usersServer = await listen(createUsersApp({ config, firebase: usersFirebase }))
  config.usersServiceUrl = 'http://127.0.0.1:' + usersServer.address().port
  contentServer = await listen(createContentApp({ config, firebase: contentFirebase }))
  contentUrl = 'http://127.0.0.1:' + contentServer.address().port
  gatewayServer = await listen(createGatewayApp({ config: { ...config, contentServiceUrl: contentUrl, interactionsServiceUrl: 'http://127.0.0.1:1/graphql' } }))
  baseUrl = 'http://127.0.0.1:' + gatewayServer.address().port
  const seed = createUsersService({ config, firebase: usersFirebase })
  for (const label of ['reader', 'author', 'other', 'admin']) {
    const id = prefix + '-' + label, email = id + '@example.test', role = label === 'other' ? 'author' : label
    ownedUsers.set(id, email)
    await seed.seed({ id, email, role, name: 'Persona ' + label, password })
    const login = await http('POST', '/api/users/login', { body: { email, password } })
    assert.equal(login.status, 200)
    users[label] = { id, token: login.body.accessToken }
  }
  imageBytes = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#9a6746' } }).png().toBuffer()
})

after(async () => {
  await close(gatewayServer); await close(contentServer); await close(usersServer)
  if (contentFirebase) {
    for (const id of ownedPublications) {
      const assets = await contentFirebase.db.collection('publicationAssets').where('publicationId', '==', id).get()
      for (const doc of assets.docs) {
        for (const path of [doc.data().path, ...Object.values(doc.data().variants ?? {}).map((variant) => variant.path)]) await contentFirebase.bucket.file(path).delete({ ignoreNotFound: true })
        await doc.ref.delete()
      }
      await contentFirebase.db.recursiveDelete(contentFirebase.db.collection('publications').doc(id))
    }
    await deleteApp(contentFirebase.app)
  }
  if (usersFirebase) {
    for (const [id, email] of ownedUsers) {
      const sessions = await usersFirebase.db.collection('userSessions').where('userId', '==', id).get()
      for (const doc of sessions.docs) await doc.ref.delete()
      await usersFirebase.db.collection('users').doc(id).delete()
      await usersFirebase.db.collection('userEmails').doc(digest(email)).delete()
    }
    const reference = usersFirebase.db.collection('userSecurity').doc('platform')
    if (originalSecurity?.exists) await reference.set(originalSecurity.data())
    else await reference.delete()
    await deleteApp(usersFirebase.app)
  }
})

test('creation is authenticated, author-owned and idempotent; drafts remain private even to moderation retries', async () => {
  const id = randomUUID()
  assert.equal((await http('POST', '/api/publications', { body: { id } })).status, 401)
  assert.equal((await http('POST', '/api/publications', { user: users.reader, body: { id } })).status, 403)
  assert.equal((await http('GET', '/api/publications', { direct: true })).status, 403)
  assert.equal((await http('POST', '/api/publications', { user: users.author, body: { id, authorId: users.other.id } })).status, 400)
  const draft = await create()
  const retry = await http('POST', '/api/publications', { user: users.author, body: { id: draft.id, title: 'No debe sobrescribir' } })
  assert.equal(retry.status, 200)
  assert.equal(retry.body.publication.title, draft.title)
  assert.equal((await http('POST', '/api/publications', { user: users.other, body: { id: draft.id } })).status, 409)
  for (const user of [undefined, users.reader, users.other, users.admin]) assert.equal((await http('GET', url(draft.id), { user })).status, 404)
  assert.equal((await http('PATCH', url(draft.id, '/status'), { user: users.admin, version: 1, body: { status: 'draft' } })).status, 404)
  assert.equal((await http('GET', url(draft.id), { user: users.author })).status, 200)
  assert.equal((await http('GET', url(randomUUID()))).status, 404)
  assert.equal((await http('GET', '/api/publications/mine', { user: users.reader })).status, 403)
  assert.equal((await http('GET', '/api/publications/moderation', { user: users.author })).status, 403)
  assert.equal((await http('GET', '/api/publications/options')).body.types.length, 7)
})

test('all five block types persist in Firestore and survive replacing the HTTP application', async () => {
  const publication = await complete()
  const stored = (await contentFirebase.db.collection('publications').doc(publication.id).get()).data()
  assert.deepEqual(stored.blocks, editor(publication).blocks)
  assert.equal(stored.authorId, users.author.id)
  assert.equal(stored.version, 2)
  const port = contentServer.address().port
  await close(contentServer)
  contentServer = await listen(createContentApp({ config, firebase: contentFirebase }), port)
  const recovered = await http('GET', url(publication.id), { user: users.author })
  assert.equal(recovered.status, 200)
  assert.deepEqual(recovered.body.publication, publication)
  assert.equal(recovered.headers.get('etag'), '"2"')
  assert.equal(recovered.headers.get('cache-control'), 'private, no-store')
})

test('optimistic versions prevent overwrites and strict schemas reject forged ownership and repeated blocks', async () => {
  const draft = await create(), body = editor(draft)
  assert.equal((await http('PUT', url(draft.id), { user: users.author, body })).status, 428)
  assert.equal((await http('PUT', url(draft.id), { user: users.other, body, version: 1 })).status, 403)
  assert.equal((await http('PUT', url(draft.id), { user: users.admin, body, version: 1 })).status, 403)
  assert.equal((await http('PUT', url(draft.id), { user: users.author, body: { ...body, authorId: users.admin.id }, version: 1 })).status, 400)
  const block = { id: randomUUID(), type: 'paragraph', text: 'Texto' }
  assert.equal((await http('PUT', url(draft.id), { user: users.author, body: { ...body, blocks: [block, block] }, version: 1 })).status, 400)
  const results = await Promise.all(['Primera edición', 'Segunda edición'].map((title) => http('PUT', url(draft.id), { user: users.author, body: { ...body, title }, version: 1 })))
  assert.deepEqual(results.map((item) => item.status).sort(), [200, 409])
  const current = await http('GET', url(draft.id), { user: users.author })
  assert.equal(current.body.publication.title, results.find((item) => item.status === 200).body.publication.title)
  assert.equal(current.body.publication.version, 2)
})

test('Storage uploads enforce bytes, type, size and publication ownership before attaching references', async () => {
  const draft = await create()
  const upload = (body, type = 'image/png', user = users.author) => http('POST', url(draft.id, '/assets'), { user, body, type })
  assert.equal((await upload(imageBytes, 'image/png', users.other)).status, 403)
  assert.equal((await upload(imageBytes, 'image/jpeg')).status, 415)
  assert.equal((await upload(Buffer.from('<svg/>'), 'image/svg+xml')).status, 415)
  assert.equal((await upload(Buffer.from('invalid'))).status, 415)
  assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413)
  const result = await upload(imageBytes)
  assert.equal(result.status, 201)
  const asset = result.body.asset
  assert.equal((await http('GET', asset.url)).status, 404)
  assert.equal((await http('GET', asset.url, { user: users.admin })).status, 404)
  const media = await http('GET', asset.url, { user: users.author })
  assert.equal(media.status, 200)
  assert.equal(media.headers.get('cache-control'), 'private, no-store')
  assert.equal((await sharp(media.body).metadata()).format, 'webp')
  const stored = (await contentFirebase.db.collection('publicationAssets').doc(asset.id).get()).data()
  assert.deepEqual((await contentFirebase.bucket.file(stored.path).download())[0], media.body)
  const resized = await http('GET', asset.url + '?width=640', { user: users.author })
  assert.equal(resized.status, 200)
  assert.equal((await sharp(resized.body).metadata()).width, 640)
  assert.equal((await http('GET', asset.url + '?width=640')).status, 404)
  assert.equal((await http('GET', asset.url + '?width=32', { user: users.author })).status, 400)
  const other = await create()
  assert.equal((await http('PUT', url(other.id), { user: users.author, version: 1, body: editor(other, { coverId: asset.id }) })).status, 400)
  assert.equal((await http('GET', url(other.id, '/media/' + asset.id), { user: users.author })).status, 404)
})

test('review validates completeness; only administrators approve and only public attached media is readable', async () => {
  const draft = await create()
  assert.equal((await http('PATCH', url(draft.id, '/status'), { user: users.author, version: 1, body: { status: 'review' } })).status, 400)
  let publication = await complete()
  const unused = await http('POST', url(publication.id, '/assets'), { user: users.author, type: 'image/png', body: imageBytes })
  publication = await transition(publication, 'review', users.author)
  assert.equal((await http('GET', url(publication.id))).status, 404)
  assert.equal((await http('GET', url(publication.id), { user: users.admin })).status, 200)
  assert.equal((await http('GET', publication.image, { user: users.admin })).status, 200)
  assert.equal((await http('GET', unused.body.asset.url, { user: users.admin })).status, 404)
  assert.equal((await http('PUT', url(publication.id), { user: users.author, version: publication.version, body: editor(publication) })).status, 409)
  assert.equal((await http('PATCH', url(publication.id, '/status'), { user: users.author, version: publication.version, body: { status: 'published' } })).status, 403)
  publication = await transition(publication, 'published', users.admin)
  const visible = await http('GET', url(publication.id))
  assert.equal(visible.status, 200)
  for (const field of ['searchText', 'searchTerms', 'authorName', 'moderationNote', 'isDeleted', 'createdAt']) assert.equal(field in visible.body.publication, false)
  assert.equal((await http('GET', publication.image)).status, 200)
  assert.equal((await http('GET', unused.body.asset.url)).status, 404)
  assert.equal((await http('DELETE', url(publication.id), { user: users.author, version: publication.version })).status, 409)
  assert.equal((await transition(publication, 'published', users.admin)).version, publication.version)
  const history = await contentFirebase.db.collection('publications').doc(publication.id).collection('history').orderBy('version').get()
  assert.deepEqual(history.docs.map((doc) => doc.data().actorId), [users.author.id, users.admin.id])
})

test('moderation rejection, withdrawal, archiving and deletion follow the documented lifecycle', async () => {
  let publication = await complete()
  publication = await transition(publication, 'review', users.author)
  assert.equal((await http('PATCH', url(publication.id, '/status'), { user: users.admin, version: publication.version, body: { status: 'draft' } })).status, 400)
  publication = await transition(publication, 'draft', users.admin, 'Amplía la fuente de la cita.')
  assert.equal(publication.moderationNote.reason, 'Amplía la fuente de la cita.')
  publication = await transition(publication, 'review', users.author)
  publication = await transition(publication, 'draft', users.author)
  publication = await transition(publication, 'review', users.author)
  publication = await transition(publication, 'published', users.admin)
  assert.equal((await http('PATCH', url(publication.id, '/status'), { user: users.admin, version: publication.version, body: { status: 'archived' } })).status, 400)
  publication = await transition(publication, 'archived', users.admin, 'Revisión de una referencia.')
  assert.equal((await http('GET', url(publication.id))).status, 404)
  assert.equal((await http('GET', publication.image)).status, 404)
  assert.equal((await http('PATCH', url(publication.id, '/status'), { user: users.admin, version: publication.version, body: { status: 'draft' } })).status, 409)
  publication = await transition(publication, 'draft', users.author)
  assert.equal((await http('DELETE', url(publication.id), { user: users.other, version: publication.version })).status, 403)
  assert.equal((await http('DELETE', url(publication.id), { user: users.author, version: publication.version })).status, 204)
  assert.equal((await http('DELETE', url(publication.id), { user: users.author, version: publication.version })).status, 204)
  assert.equal((await http('GET', url(publication.id), { user: users.author })).status, 404)
  assert.equal((await http('GET', publication.image, { user: users.author })).status, 404)
  assert.equal((await contentFirebase.db.collection('publications').doc(publication.id).get()).data().isDeleted, true)
})

test('public, author and moderation listings paginate without private leaks and bind cursors to their filters', async () => {
  const selected = []
  for (const title of ['Lecturas de una plaza', 'Lecturas de un barrio', 'Lecturas de una estación']) {
    let item = await complete(users.other, { title, category: 'Cultura', type: 'Guía', tags: ['Recorridos'] })
    item = await transition(item, 'review', users.other)
    item = await transition(item, 'published', users.admin)
    selected.push(item.id)
  }
  await create(users.other)
  const filter = '?limit=2&category=cultura&type=' + encodeURIComponent('Guía') + '&authorId=' + users.other.id
  const first = await http('GET', '/api/publications' + filter)
  assert.equal(first.status, 200)
  assert.equal(first.body.items.length, 2)
  assert.ok(first.body.nextCursor)
  const second = await http('GET', '/api/publications' + filter + '&cursor=' + first.body.nextCursor)
  assert.equal(second.status, 200)
  assert.deepEqual([...first.body.items, ...second.body.items].map((item) => item.id).sort(), selected.sort())
  assert.equal(second.body.nextCursor, null)
  assert.equal((await http('GET', '/api/publications?cursor=' + first.body.nextCursor)).status, 400)
  const search = await http('GET', '/api/publications' + filter + '&q=lect%20estaci')
  assert.equal(search.body.items.length, 1)
  assert.equal(search.body.items[0].title, 'Lecturas de una estación')
  assert.equal(search.body.searchMode, 'metadata-word-prefixes')
  const mine = await http('GET', '/api/publications/mine?limit=40', { user: users.other })
  assert.equal(mine.body.items.length, 4)
  assert.ok(mine.body.items.every((item) => item.authorId === users.other.id))
  const pending = await complete(users.other)
  await transition(pending, 'review', users.other)
  const moderation = await http('GET', '/api/publications/moderation', { user: users.admin })
  assert.ok(moderation.body.items.some((item) => item.id === pending.id))
  assert.ok(moderation.body.items.every((item) => item.status === 'review'))
  assert.equal((await http('GET', '/api/publications?limit=41')).status, 400)
})

test('competing moderation decisions commit one state and one corresponding audit entry', async () => {
  const publication = await transition(await complete(), 'review', users.author)
  const results = await Promise.all(['published', 'draft'].map((status) => http('PATCH', url(publication.id, '/status'), {
    user: users.admin, version: publication.version, body: { status, reason: 'Decisión concurrente de prueba.' },
  })))
  assert.deepEqual(results.map((item) => item.status).sort(), [200, 409])
  const winner = results.find((item) => item.status === 200).body.publication
  const history = await contentFirebase.db.collection('publications').doc(publication.id).collection('history').orderBy('version').get()
  assert.equal(history.size, 2)
  assert.equal(history.docs.at(-1).data().to, winner.status)
  assert.equal(history.docs.at(-1).data().version, winner.version)
})

test('identity outages fail closed without faking writes; anonymous published reads remain available', async () => {
  const actual = config.usersServiceUrl
  config.usersServiceUrl = 'http://127.0.0.1:1'
  try {
    assert.equal((await http('GET', '/api/publications/mine', { user: users.author })).status, 503)
    assert.equal((await http('POST', '/api/publications', { user: users.author, body: { id: randomUUID() } })).status, 503)
    assert.equal((await http('GET', '/api/publications')).status, 200)
  } finally { config.usersServiceUrl = actual }
  const expired = jwt.sign({ sub: users.author.id, sid: randomUUID(), kind: 'access', av: 0 }, config.jwtSecret, { issuer: 'otherbloc-users', audience: 'otherbloc-platform', expiresIn: -1 })
  assert.equal((await http('GET', '/api/publications/mine', { user: { token: expired } })).status, 401)
  assert.equal((await http('POST', '/api/publications', { headers: { 'x-user-id': users.author.id, 'x-user-role': 'admin' }, body: { id: randomUUID() } })).status, 401)
})

test('role changes and logout are revalidated by Users instead of trusting token role claims', async () => {
  const draft = await create(users.other)
  const demoted = await http('PATCH', '/api/users/' + users.other.id + '/permissions', { user: users.admin, body: { role: 'reader', status: 'active' } })
  assert.equal(demoted.status, 200)
  assert.equal((await http('PUT', url(draft.id), { user: users.other, version: 1, body: editor(draft) })).status, 401)
  const login = await http('POST', '/api/users/login', { body: { email: ownedUsers.get(users.other.id), password } })
  assert.equal((await http('POST', '/api/publications', { user: { token: login.body.accessToken }, body: { id: randomUUID() } })).status, 403)
  assert.equal((await http('POST', '/api/users/logout', { user: users.author, body: {} })).status, 204)
  assert.equal((await http('GET', '/api/publications/mine', { user: users.author })).status, 401)
})
