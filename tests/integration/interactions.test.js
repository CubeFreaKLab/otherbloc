import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { deleteApp } from 'firebase-admin/app'
import jwt from 'jsonwebtoken'
import sharp from 'sharp'
import { createApp as createUsersApp } from '../../backend/users-service/src/app.js'
import { createApp as createContentApp } from '../../backend/content-service/src/app.js'
import { createApp as createInteractionsApp } from '../../backend/interactions-service/src/app.js'
import { createApp as createGatewayApp } from '../../backend/api-gateway/src/app.js'
import { getUsersFirebase, getContentFirebase, getInteractionsFirebase } from './firebase-clients.js'
import { createUsersService } from '../../backend/users-service/src/services/users.js'
import { digest } from '../../backend/users-service/src/lib/sessions.js'

const prefix = 'test-' + randomUUID(), password = 'Una frase de prueba para interacciones 2026', origin = 'http://127.0.0.1:5173'
const config = { nodeEnv: 'test', jwtSecret: 'interactions-test-only-jwt-'.repeat(4), serviceAuthSecret: 'interactions-test-service-'.repeat(4), allowedOrigins: [origin],
  accessSeconds: 900, sessionDays: 7, trustProxy: 0, upstreamTimeoutMs: 15000, rateLimit: 100000, rateWindowMs: 60000, authRateLimit: 100 }
const people = {}, publications = new Set(), ownedUsers = new Map()
let usersFirebase, contentFirebase, interactionsFirebase, usersServer, contentServer, interactionsServer, apolloServer, gatewayServer, originalSecurity, baseUrl, interactionsUrl, outage = null, imageBytes
const listen = (app, port = 0) => new Promise((resolve) => { const server = app.listen(port, '127.0.0.1', () => resolve(server)) })
const close = (server) => server ? new Promise((resolve) => server.close(resolve)) : Promise.resolve()

async function http(method, path, { person, body, version, type, direct = false, headers: extra = {} } = {}) {
  const headers = { 'X-Otherbloc-Request': '1', Origin: origin, ...extra }
  if (person) headers.Authorization = 'Bearer ' + person.token
  if (body !== undefined) headers['Content-Type'] = type ?? 'application/json'
  if (version !== undefined) headers['If-Match'] = '"' + version + '"'
  const response = await fetch((direct ? interactionsUrl : baseUrl) + path, { method, headers, body: body === undefined ? undefined : type ? body : JSON.stringify(body) })
  return { status: response.status, body: await response.json() }
}
const gql = (query, variables = {}, person, options = {}) => http('POST', options.direct ? '/graphql' : '/api/interactions', { ...options, person, body: { query, variables } })
const data = (result) => { assert.equal(result.status, 200); assert.equal(result.body.errors, undefined, JSON.stringify(result.body.errors)); return result.body.data }
const errorCode = (result) => result.body.errors?.[0]?.extensions.code ?? result.body.error
async function transition(publication, status, person = people.author) {
  const response = await http('PATCH', '/api/publications/' + publication.id + '/status', { person, version: publication.version, body: { status } })
  assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body.publication
}
async function publication(publish = true) {
  const id = randomUUID(); publications.add(id)
  let response = await http('POST', '/api/publications', { person: people.author, body: { id, title: 'Publicación para interacciones ' + id.slice(0, 6) } })
  assert.equal(response.status, 201)
  let value = response.body.publication
  if (!publish) return value
  const uploaded = await http('POST', '/api/publications/' + id + '/assets', { person: people.author, body: imageBytes, type: 'image/png' })
  assert.equal(uploaded.status, 201)
  response = await http('PUT', '/api/publications/' + id, { person: people.author, version: value.version, body: {
    title: value.title, summary: 'Documento sintético para comprobar los límites entre servicios.', type: 'Artículo', category: 'Cultura', tags: ['Prueba'],
    coverId: uploaded.body.asset.id, coverAlt: 'Superficie de prueba', blocks: [{ id: randomUUID(), type: 'paragraph', text: 'Texto conservado en el servicio de Contenido.' }],
  } })
  assert.equal(response.status, 200); value = await transition(response.body.publication, 'review')
  return transition(value, 'published', people.admin)
}
const compound = 'query($id: ID!, $userId: ID) { publication(id: $id, userId: $userId) { id title author { id name } blocks { type text } comments { items { id text userId author { id name } canDelete } nextCursor } commentCount reactions { active count } saved followingAuthor } }'
const relationMutation = (name, flag) => 'mutation($id: ID!, $active: Boolean!, $userId: ID) { ' + name + '(' + (name === 'followAuthor' ? 'authorId' : 'publicationId') + ': $id, ' + flag + ': $active, userId: $userId) { active } }'
const saveQuery = relationMutation('savePublication', 'saved'), reactQuery = relationMutation('reactToPublication', 'active'), followQuery = relationMutation('followAuthor', 'following')
const addQuery = 'mutation($input: AddCommentInput!, $userId: ID) { addComment(input: $input, userId: $userId) { id text userId author { name } canDelete } }'
const removeComment = 'mutation($id: ID!) { deleteComment(id: $id) }'
const savedQuery = 'query($limit: Int, $cursor: String, $userId: ID) { savedPublications(limit: $limit, cursor: $cursor, userId: $userId) { items { id publicationId savedAt publication { id title author { name } } } nextCursor } }'
const upstreamFetch = (url, options) => outage && url.origin === config[outage + 'ServiceUrl'] ? Promise.resolve(Response.json({ error: 'test_outage' }, { status: 503 })) : fetch(url, options)

before(async () => {
  assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-otherbloc-test')
  usersFirebase = getUsersFirebase(); contentFirebase = getContentFirebase(); interactionsFirebase = getInteractionsFirebase()
  originalSecurity = await usersFirebase.db.collection('userSecurity').doc('platform').get()
  usersServer = await listen(createUsersApp({ config, firebase: usersFirebase })); config.usersServiceUrl = 'http://127.0.0.1:' + usersServer.address().port
  contentServer = await listen(createContentApp({ config, firebase: contentFirebase })); config.contentServiceUrl = 'http://127.0.0.1:' + contentServer.address().port
  const app = await createInteractionsApp({ config, firebase: interactionsFirebase, fetchImpl: upstreamFetch }); apolloServer = app.apolloServer
  interactionsServer = await listen(app.app); interactionsUrl = 'http://127.0.0.1:' + interactionsServer.address().port
  config.interactionsServiceUrl = interactionsUrl + '/graphql'
  gatewayServer = await listen(createGatewayApp({ config })); baseUrl = 'http://127.0.0.1:' + gatewayServer.address().port
  const seed = createUsersService({ config, firebase: usersFirebase })
  for (const label of ['reader', 'other', 'author', 'admin']) {
    const id = prefix + '-' + label, email = id + '@example.test', role = label === 'other' ? 'reader' : label
    ownedUsers.set(id, email); await seed.seed({ id, email, role, name: 'Persona ' + label, password })
    const signed = await http('POST', '/api/users/login', { body: { email, password } }); assert.equal(signed.status, 200)
    people[label] = { id, token: signed.body.accessToken }
  }
  imageBytes = await sharp({ create: { width: 128, height: 96, channels: 3, background: '#858575' } }).png().toBuffer()
})

after(async () => {
  await close(gatewayServer); await close(interactionsServer); await apolloServer?.stop(); await close(contentServer); await close(usersServer)
  if (interactionsFirebase) {
    for (const name of ['comments', 'reactions', 'savedPublications', 'follows']) {
      for (const id of ownedUsers.keys()) {
        const rows = await interactionsFirebase.db.collection(name).where('userId', '==', id).get()
        for (const row of rows.docs) await row.ref.delete()
      }
    }
    for (const id of publications) await interactionsFirebase.db.collection('publicationInteractionStats').doc(id).delete()
    for (const id of ownedUsers.keys()) await interactionsFirebase.db.collection('authorInteractionStats').doc(id).delete()
    await deleteApp(interactionsFirebase.app)
  }
  if (contentFirebase) {
    for (const id of publications) {
      const assets = await contentFirebase.db.collection('publicationAssets').where('publicationId', '==', id).get()
      for (const asset of assets.docs) {
        for (const path of [asset.data().path, ...Object.values(asset.data().variants ?? {}).map((item) => item.path)]) await contentFirebase.bucket.file(path).delete({ ignoreNotFound: true })
        await asset.ref.delete()
      }
      await contentFirebase.db.recursiveDelete(contentFirebase.db.collection('publications').doc(id))
    }
    await deleteApp(contentFirebase.app)
  }
  if (usersFirebase) {
    for (const [id, email] of ownedUsers) {
      for (const session of (await usersFirebase.db.collection('userSessions').where('userId', '==', id).get()).docs) await session.ref.delete()
      await usersFirebase.db.collection('users').doc(id).delete(); await usersFirebase.db.collection('userEmails').doc(digest(email)).delete()
    }
    const reference = usersFirebase.db.collection('userSecurity').doc('platform')
    if (originalSecurity?.exists) await reference.set(originalSecurity.data()); else await reference.delete()
    await deleteApp(usersFirebase.app)
  }
})

test('compound GraphQL reads actual owner-service data and rejects private publications and impersonation', async () => {
  const item = await publication(), draft = await publication(false)
  const result = data(await gql(compound, { id: item.id })).publication
  assert.equal(result.title, item.title); assert.equal(result.author.name, 'Persona author'); assert.equal(result.blocks[0].text, item.blocks[0].text)
  assert.equal(result.saved, false); assert.deepEqual(result.reactions, { active: false, count: 0 }); assert.equal(result.commentCount, 0)
  for (const person of [undefined, people.author, people.admin]) assert.equal(errorCode(await gql(compound, { id: draft.id }, person)), 'NOT_FOUND')
  assert.equal(errorCode(await gql(compound, { id: randomUUID() })), 'NOT_FOUND')
  assert.equal(errorCode(await gql(compound, { id: item.id, userId: people.other.id }, people.reader)), 'FORBIDDEN')
  assert.equal(errorCode(await gql(compound, { id: item.id, userId: people.reader.id })), 'UNAUTHENTICATED')
  assert.equal((await gql(compound, { id: item.id }, undefined, { direct: true })).status, 403)
  assert.equal(errorCode(await gql(saveQuery, { id: draft.id, active: true }, people.author)), 'NOT_FOUND')
  assert.equal(errorCode(await gql(saveQuery, { id: item.id, active: true, userId: people.other.id }, people.reader)), 'FORBIDDEN')
})

test('concurrent reactions are unique and atomically update the real count across repeated add/remove operations', async () => {
  const item = await publication()
  const mutate = (active, person = people.reader) => gql(reactQuery, { id: item.id, active }, person)
  const first = await Promise.all(Array.from({ length: 8 }, () => mutate(true)))
  for (const result of first) assert.equal(data(result).reactToPublication.active, true)
  assert.equal(data(await gql(compound, { id: item.id }, people.reader)).publication.reactions.count, 1)
  data(await mutate(true, people.other))
  assert.equal(data(await gql(compound, { id: item.id })).publication.reactions.count, 2)
  for (const result of await Promise.all(Array.from({ length: 8 }, () => mutate(false)))) assert.equal(data(result).reactToPublication.active, false)
  const after = data(await gql(compound, { id: item.id }, people.reader)).publication.reactions
  assert.deepEqual(after, { count: 1, active: false })
  data(await mutate(false, people.other))
  assert.equal((await interactionsFirebase.db.collection('publicationInteractionStats').doc(item.id).get()).data().reactionCount, 0)
})

test('comments use idempotent IDs, retain author identity and decrement exactly once on owner deletion', async () => {
  const item = await publication(), input = { id: randomUUID(), publicationId: item.id, text: '<script>no HTML execution</script> Texto de prueba.' }
  for (const result of await Promise.all(Array.from({ length: 6 }, () => gql(addQuery, { input }, people.reader)))) assert.equal(data(result).addComment.id, input.id)
  const own = data(await gql(compound, { id: item.id }, people.reader)).publication
  assert.equal(own.commentCount, 1); assert.equal(own.comments.items.length, 1); assert.equal(own.comments.items[0].text, input.text)
  assert.equal(own.comments.items[0].author.name, 'Persona reader'); assert.equal(own.comments.items[0].canDelete, true)
  assert.equal(data(await gql(compound, { id: item.id })).publication.comments.items[0].canDelete, false)
  assert.equal(errorCode(await gql(addQuery, { input: { ...input, text: 'Different' } }, people.reader)), 'CONFLICT')
  assert.equal(errorCode(await gql(addQuery, { input: { ...input, id: randomUUID(), text: '' } }, people.reader)), 'BAD_USER_INPUT')
  assert.equal(errorCode(await gql(removeComment, { id: input.id }, people.other)), 'FORBIDDEN')
  for (const result of await Promise.all(Array.from({ length: 6 }, () => gql(removeComment, { id: input.id }, people.reader)))) assert.equal(data(result).deleteComment, true)
  const cleared = data(await gql(compound, { id: item.id })).publication
  assert.equal(cleared.commentCount, 0); assert.equal(cleared.comments.items.length, 0)
  assert.equal((await interactionsFirebase.db.collection('comments').doc(input.id).get()).data().isDeleted, true)
})

test('saved lists paginate only the current user and retain removable references after publication archival', async () => {
  const items = await Promise.all([publication(), publication(), publication()])
  for (const item of items) for (const result of await Promise.all([gql(saveQuery, { id: item.id, active: true }, people.reader), gql(saveQuery, { id: item.id, active: true }, people.reader)])) data(result)
  const first = data(await gql(savedQuery, { limit: 2 }, people.reader)).savedPublications
  assert.equal(first.items.length, 2); assert.ok(first.nextCursor)
  const second = data(await gql(savedQuery, { limit: 2, cursor: first.nextCursor }, people.reader)).savedPublications
  assert.equal(second.items.length, 1); assert.equal(second.nextCursor, null)
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 3)
  assert.equal(data(await gql(savedQuery, { limit: 20 }, people.other)).savedPublications.items.length, 0)
  assert.equal(errorCode(await gql(savedQuery, { cursor: first.nextCursor }, people.other)), 'BAD_USER_INPUT')
  await transition(items[0], 'archived')
  assert.equal(errorCode(await gql(compound, { id: items[0].id }, people.reader)), 'NOT_FOUND')
  const hidden = data(await gql(savedQuery, { limit: 20 }, people.reader)).savedPublications.items.find((item) => item.publicationId === items[0].id)
  assert.equal(hidden.publication, null)
  data(await gql(saveQuery, { id: items[0].id, active: false }, people.reader))
  assert.equal(data(await gql(savedQuery, { limit: 20 }, people.reader)).savedPublications.items.some((item) => item.publicationId === items[0].id), false)
})

test('following authors is private per account, idempotent and restricted to an actual active author', async () => {
  const variables = { id: people.author.id, active: true }
  for (const result of await Promise.all(Array.from({ length: 6 }, () => gql(followQuery, variables, people.reader)))) data(result)
  const query = 'query($id: ID!) { authorInteractions(authorId: $id) { author { id name } following followerCount } }'
  assert.deepEqual(data(await gql(query, { id: people.author.id }, people.reader)).authorInteractions, { author: { id: people.author.id, name: 'Persona author' }, following: true, followerCount: 1 })
  assert.equal(errorCode(await gql(followQuery, variables, people.author)), 'BAD_USER_INPUT')
  assert.equal(data(await gql(followQuery, { id: people.other.id, active: true }, people.reader)).followAuthor.active, true)
  data(await gql(followQuery, { id: people.other.id, active: false }, people.reader))
  const list = 'query { followingAuthors { items { authorId followedAt author { name } } nextCursor } }'
  assert.equal(data(await gql(list, {}, people.reader)).followingAuthors.items.length, 1)
  assert.equal(data(await gql(list, {}, people.other)).followingAuthors.items.length, 0)
  for (const result of await Promise.all(Array.from({ length: 6 }, () => gql(followQuery, { ...variables, active: false }, people.reader)))) data(result)
  assert.equal(data(await gql(query, { id: people.author.id }, people.reader)).authorInteractions.followerCount, 0)
})

test('upstream failures do not create interactions or fabricate compound data', async () => {
  const item = await publication()
  try {
    outage = 'content'
    assert.equal(errorCode(await gql(reactQuery, { id: item.id, active: true }, people.reader)), 'SERVICE_UNAVAILABLE')
    assert.equal(errorCode(await gql(compound, { id: item.id })), 'SERVICE_UNAVAILABLE')
    assert.equal((await interactionsFirebase.db.collection('reactions').where('publicationId', '==', item.id).get()).size, 0)
    outage = 'users'
    assert.equal(errorCode(await gql(compound, { id: item.id }, people.reader)), 'SERVICE_UNAVAILABLE')
    const publicFailure = await gql(compound, { id: item.id })
    assert.equal(errorCode(publicFailure), 'SERVICE_UNAVAILABLE'); assert.equal(publicFailure.body.data.publication.author, null)
  } finally { outage = null }
})

test('comment and followed-author cursors paginate without duplicates and reject cross-resource reuse', async () => {
  const item = await publication(), otherItem = await publication()
  for (let i = 0; i < 3; i += 1) data(await gql(addQuery, { input: { id: randomUUID(), publicationId: item.id, text: 'Comentario ' + i } }, people.reader))
  const query = 'query($id: ID!, $limit: Int, $cursor: String) { publication(id: $id) { comments(limit: $limit, cursor: $cursor) { items { id text } nextCursor } } }'
  const first = data(await gql(query, { id: item.id, limit: 2 })).publication.comments
  const next = data(await gql(query, { id: item.id, limit: 2, cursor: first.nextCursor })).publication.comments
  assert.equal(first.items.length, 2); assert.equal(next.items.length, 1); assert.equal(next.nextCursor, null)
  assert.equal(new Set([...first.items, ...next.items].map((row) => row.id)).size, 3)
  assert.equal(errorCode(await gql(query, { id: otherItem.id, cursor: first.nextCursor })), 'BAD_USER_INPUT')
  assert.equal(errorCode(await gql(query, { id: item.id, limit: 41 })), 'BAD_USER_INPUT')
  for (const id of [people.author.id, people.admin.id]) data(await gql(followQuery, { id, active: true }, people.reader))
  const following = 'query($cursor: String) { followingAuthors(limit: 1, cursor: $cursor) { items { id author { id } } nextCursor } }'
  const f1 = data(await gql(following, {}, people.reader)).followingAuthors
  const f2 = data(await gql(following, { cursor: f1.nextCursor }, people.reader)).followingAuthors
  assert.equal(f1.items.length, 1); assert.equal(f2.items.length, 1); assert.notEqual(f1.items[0].id, f2.items[0].id); assert.equal(f2.nextCursor, null)
})

test('interactions survive replacing the HTTP/Apollo application with a new instance', async () => {
  const item = await publication()
  data(await gql(saveQuery, { id: item.id, active: true }, people.reader))
  data(await gql(reactQuery, { id: item.id, active: true }, people.reader))
  data(await gql(addQuery, { input: { id: randomUUID(), publicationId: item.id, text: 'Persistente tras recrear la aplicación.' } }, people.reader))
  const port = interactionsServer.address().port
  await close(interactionsServer); await apolloServer.stop()
  const recreated = await createInteractionsApp({ config, firebase: interactionsFirebase, fetchImpl: upstreamFetch })
  apolloServer = recreated.apolloServer; interactionsServer = await listen(recreated.app, port)
  const result = data(await gql(compound, { id: item.id }, people.reader)).publication
  assert.equal(result.saved, true); assert.deepEqual(result.reactions, { count: 1, active: true })
  assert.equal(result.comments.items[0].text, 'Persistente tras recrear la aplicación.')
})

test('expired, forged and revoked identities cannot mutate even when their old role claims remain', async () => {
  const item = await publication()
  const expired = jwt.sign({ kind: 'access', sid: randomUUID() }, config.jwtSecret, { algorithm: 'HS256', subject: people.reader.id, issuer: 'otherbloc-users', audience: 'otherbloc-platform', expiresIn: -1 })
  assert.equal((await gql(reactQuery, { id: item.id, active: true }, { token: expired })).status, 401)
  assert.equal((await gql(reactQuery, { id: item.id, active: true }, { token: 'forged' })).status, 401)
  const changed = await http('PATCH', '/api/users/' + people.other.id + '/permissions', { person: people.admin, body: { role: 'reader', status: 'suspended' } })
  assert.equal(changed.status, 200)
  const revoked = await gql(reactQuery, { id: item.id, active: true }, people.other)
  assert.equal(revoked.status, 401); assert.equal(errorCode(revoked), 'UNAUTHENTICATED')
})
