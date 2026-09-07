import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { before, after, test } from 'node:test'
import { deleteApp } from 'firebase-admin/app'
import { createApp as createUsersApp } from '../../backend/users-service/src/app.js'
import { createApp as createContentApp } from '../../backend/content-service/src/app.js'
import { createApp as createGatewayApp } from '../../backend/api-gateway/src/app.js'
import { getUsersFirebase, getContentFirebase } from './firebase-clients.js'
import { createUsersService } from '../../backend/users-service/src/services/users.js'
import { createPublicationsService } from '../../backend/content-service/src/services/publications.js'
import { digest } from '../../backend/users-service/src/lib/sessions.js'
import { demoAccounts, seedDemoUsers, seedDemoPublications } from '../../scripts/seed-demo.mjs'
import { articles } from '../../frontend/src/data/articles.js'

const source = { SEED_READER_EMAIL: 'seed-reader@example.test', SEED_AUTHOR_EMAIL: 'seed-author@example.test', SEED_ADMIN_EMAIL: 'seed-admin@example.test', SEED_PASSWORD: randomBytes(32).toString('base64url') }
const accounts = demoAccounts(source), publicationIds = articles.map(({ slug }) => slug)
const config = { nodeEnv: 'test', jwtSecret: randomBytes(48).toString('base64url'), serviceAuthSecret: randomBytes(48).toString('base64url'),
  allowedOrigins: ['http://127.0.0.1:5173'], accessSeconds: 900, sessionDays: 7, trustProxy: 0, upstreamTimeoutMs: 15000, rateLimit: 18000, rateWindowMs: 900000 }
const servers = []
let usersFirebase, contentFirebase, originalSecurity, claimed = false, gateway, usersService, contentService
const hash = (data) => createHash('sha256').update(JSON.stringify(data)).digest('hex')
async function listen(app) {
  const server = app.listen(0, '127.0.0.1')
  servers.push(server)
  await new Promise((resolve) => server.once('listening', resolve))
  return 'http://127.0.0.1:' + server.address().port
}

before(async () => {
  assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-otherbloc-test')
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080')
  assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199')
  usersFirebase = getUsersFirebase(); contentFirebase = getContentFirebase()
  originalSecurity = await usersFirebase.db.collection('userSecurity').doc('platform').get()
  // Fixed demo IDs are used by the real seeds: refuse existing records before claiming test ownership.
  for (const account of accounts) {
    assert.equal((await usersFirebase.db.collection('users').doc(account.id).get()).exists, false, 'Seed test ID already exists; nothing was reset.')
    assert.equal((await usersFirebase.db.collection('userEmails').doc(digest(account.email)).get()).exists, false, 'Seed test email already exists.')
    assert.equal((await usersFirebase.db.collection('userSessions').where('userId', '==', account.id).get()).empty, true, 'Seed sessions already exist.')
  }
  for (const id of publicationIds) {
    assert.equal((await contentFirebase.db.collection('publications').doc(id).get()).exists, false, 'Seed publication already exists.')
    assert.equal((await contentFirebase.db.collection('publicationAssets').where('publicationId', '==', id).get()).empty, true, 'Seed assets already exist.')
  }
  claimed = true
  config.usersServiceUrl = await listen(createUsersApp({ config, firebase: usersFirebase }))
  const contentUrl = await listen(createContentApp({ config, firebase: contentFirebase }))
  gateway = await listen(createGatewayApp({ config: { ...config, contentServiceUrl: contentUrl, interactionsServiceUrl: 'http://127.0.0.1:1/graphql' } }))
  usersService = createUsersService({ config, firebase: usersFirebase })
  contentService = createPublicationsService({ firebase: contentFirebase })
})

after(async () => {
  for (const server of servers.reverse()) await new Promise((resolve) => server.close(resolve))
  if (claimed) {
    for (const id of publicationIds) {
      const assets = await contentFirebase.db.collection('publicationAssets').where('publicationId', '==', id).get()
      for (const document of assets.docs) {
        for (const path of [document.data().path, ...Object.values(document.data().variants ?? {}).map(({ path }) => path)]) await contentFirebase.bucket.file(path).delete({ ignoreNotFound: true })
        await document.ref.delete()
      }
      await contentFirebase.db.recursiveDelete(contentFirebase.db.collection('publications').doc(id))
    }
    for (const account of accounts) {
      const sessions = await usersFirebase.db.collection('userSessions').where('userId', '==', account.id).get()
      for (const document of sessions.docs) await document.ref.delete()
      await usersFirebase.db.collection('users').doc(account.id).delete()
      await usersFirebase.db.collection('userEmails').doc(digest(account.email)).delete()
    }
    const reference = usersFirebase.db.collection('userSecurity').doc('platform')
    if (originalSecurity.exists) await reference.set(originalSecurity.data())
    else await reference.delete()
  }
  if (contentFirebase) await deleteApp(contentFirebase.app)
  if (usersFirebase) await deleteApp(usersFirebase.app)
})

test('shared seeds create six persisted demo roles and seven Storage-backed public readings, then preserve them on rerun', async () => {
  const logs = [], log = (value) => logs.push(value)
  await seedDemoUsers(usersService, source, log)
  const userHashes = []
  for (const account of accounts) {
    const record = (await usersFirebase.db.collection('users').doc(account.id).get()).data()
    assert.equal(record.role, account.role)
    assert.equal(record.demo, true)
    assert.equal(typeof record.passwordHash, 'string')
    assert.notEqual(record.passwordHash, source.SEED_PASSWORD)
    userHashes.push(hash(record))
  }
  await seedDemoPublications({ service: contentService, source, gateway, log })
  const publicationHashes = []
  for (const article of articles) {
    const record = (await contentFirebase.db.collection('publications').doc(article.slug).get()).data()
    assert.equal(record.demo, true)
    assert.equal(record.status, 'published')
    assert.equal(record.authorId, article.authorId)
    publicationHashes.push(hash(record))
    const response = await fetch(gateway + '/api/publications/' + article.slug, { redirect: 'error' })
    assert.equal(response.status, 200)
    const { publication } = await response.json()
    assert.equal(publication.title, article.title)
    const image = await fetch(gateway + '/api/publications/' + article.slug + '/media/' + record.coverId, { redirect: 'error' })
    assert.equal(image.status, 200)
    assert.match(image.headers.get('content-type'), /image\/webp/)
    assert.ok((await image.arrayBuffer()).byteLength > 0)
  }
  await seedDemoUsers(usersService, source, log)
  await seedDemoPublications({ service: contentService, source, gateway, log })
  for (const [index, account] of accounts.entries()) assert.equal(hash((await usersFirebase.db.collection('users').doc(account.id).get()).data()), userHashes[index])
  for (const [index, id] of publicationIds.entries()) assert.equal(hash((await contentFirebase.db.collection('publications').doc(id).get()).data()), publicationHashes[index])
  assert.equal(logs.filter((line) => line.includes('kept existing demo publication')).length, 7)
  assert.equal(logs.filter((line) => line.includes('kept existing demo account')).length, 6)
  assert.ok(logs.every((line) => !line.includes(source.SEED_PASSWORD) && !line.startsWith('Warning:')))
})
