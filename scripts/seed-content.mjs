import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { deleteApp } from 'firebase-admin/app'
import dotenv from 'dotenv'
import { setupLocal } from './setup-local.mjs'
import { getFirebase } from '../backend/content-service/src/config/firebase.js'
import { articles, authors } from '../frontend/src/data/articles.js'

await setupLocal()
dotenv.config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)), quiet: true })
if (process.env.FIREBASE_PROJECT_ID !== 'demo-otherbloc' || process.env.NODE_ENV === 'production') throw new Error('This seed only accepts the local demo project, never cloud data.')
const { createPublicationsService } = await import('../backend/content-service/src/services/publications.js')
const firebase = getFirebase()
const service = createPublicationsService({ firebase })
const gateway = 'http://127.0.0.1:3000'
const sessions = new Map()

async function request(method, path, { token, body, type, version } = {}) {
  const headers = { 'X-Otherbloc-Request': '1' }
  if (token) headers.Authorization = 'Bearer ' + token
  if (body !== undefined) headers['Content-Type'] = type ?? 'application/json'
  if (version !== undefined) headers['If-Match'] = '"' + version + '"'
  const response = await fetch(gateway + path, { method, headers, body: body === undefined ? undefined : type ? body : JSON.stringify(body), signal: AbortSignal.timeout(20000) })
  const result = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(method + ' ' + path + ': ' + response.status + ' ' + (result.message ?? result.error))
  return result
}

async function login(id) {
  if (sessions.has(id)) return sessions.get(id)
  const email = id === 'demo-admin' ? process.env.SEED_ADMIN_EMAIL : id === authors[0].id ? process.env.SEED_AUTHOR_EMAIL : id + '@example.test'
  const result = await request('POST', '/api/users/login', { body: { email, password: process.env.SEED_PASSWORD } })
  if (result.user.id !== id || !['author', 'admin'].includes(result.user.role)) throw new Error('Seed account identity/role does not match. Run seed:users first and check private configuration.')
  const session = { token: result.accessToken, identity: { id, name: result.user.name, role: result.user.role } }
  sessions.set(id, session)
  return session
}

try {
  const admin = await login('demo-admin')
  for (const article of [...articles].reverse()) {
    const author = await login(article.authorId)
    const draft = await service.seedDraft(article.slug, author.identity)
    if (!draft.created) {
      if (process.argv.includes('--prepare-images')) await service.prepareSeedImages(article.slug, author.identity)
      console.log(article.slug + ': kept existing demo publication (' + draft.publication.status + ')')
      continue
    }
    const base = '/api/publications/' + article.slug
    const bytes = await readFile(new URL('../frontend/public' + article.image, import.meta.url))
    const { asset } = await request('POST', base + '/assets', { token: author.token, body: bytes, type: 'image/webp' })
    const blocks = article.blocks.map((block) => ({ ...block, id: randomUUID(),
      ...(block.type === 'heading' ? { level: 2 } : {}), ...(block.type === 'quote' ? { attribution: 'Edición de demostración' } : {}), ...(block.type === 'list' ? { ordered: false } : {}),
    }))
    let { publication } = await request('PUT', base, { token: author.token, version: draft.publication.version, body: {
      title: article.title, summary: article.summary, category: article.category, type: article.type, tags: article.tags,
      coverId: asset.id, coverAlt: article.imageAlt, blocks,
    } })
    ;({ publication } = await request('PATCH', base + '/status', { token: author.token, version: publication.version, body: { status: 'review' } }))
    ;({ publication } = await request('PATCH', base + '/status', { token: admin.token, version: publication.version, body: { status: 'published' } }))
    const persisted = await request('GET', base)
    if (persisted.publication.status !== 'published' || persisted.publication.title !== article.title) throw new Error('Public read did not match the seeded publication.')
    console.log(article.slug + ': created, reviewed, published and read through the gateway')
  }
  console.log('Demo publication seed complete. Existing records were not overwritten; interrupted drafts can be continued by their author.')
} finally {
  for (const session of sessions.values()) await request('POST', '/api/users/logout', { token: session.token, body: {} }).catch(() => {})
  await deleteApp(firebase.app)
}
