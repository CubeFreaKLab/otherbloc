import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { registerSchema, idSchema } from '../backend/users-service/src/models/user.js'
import { articles, authors } from '../frontend/src/data/articles.js'

export function demoAccounts(source) {
  const definitions = [
    { id: 'demo-reader', name: 'Lector de muestra', email: source.SEED_READER_EMAIL, role: 'reader' },
    ...authors.map((author, index) => ({ id: author.id, name: author.name, email: index === 0 ? source.SEED_AUTHOR_EMAIL : author.id + '@example.test', role: 'author', biography: author.bio })),
    { id: 'demo-admin', name: 'Administración de muestra', email: source.SEED_ADMIN_EMAIL, role: 'admin' },
  ].map((definition) => ({ ...definition, ...registerSchema.parse({ name: definition.name, email: definition.email, password: source.SEED_PASSWORD }),
    id: idSchema.parse(definition.id), biography: definition.biography ?? 'Cuenta de demostración para pruebas de otherbloc.' }))
  if (new Set(definitions.map(({ email }) => email)).size !== definitions.length) throw new Error('Demo account emails must be distinct.')
  return definitions
}

export async function seedDemoUsers(service, source, log = console.log) {
  // Validate the entire input before the first owner-service write.
  const definitions = demoAccounts(source)
  for (const definition of definitions) {
    const result = await service.seed(definition)
    log(definition.role + ': ' + (result.created ? 'created' : 'kept existing demo account'))
  }
}

export async function seedDemoPublications({ service, source, gateway, prepareImages = false, log = console.log,
  fetcher = fetch, publications = articles, readAsset = (article) => readFile(new URL('../frontend/public' + article.image, import.meta.url)) }) {
  const accounts = new Map(demoAccounts(source).map((account) => [account.id, account]))
  const sessions = new Map()
  async function request(method, path, { token, body, type, version } = {}) {
    const headers = { 'X-Otherbloc-Request': '1' }
    if (token) headers.Authorization = 'Bearer ' + token
    if (body !== undefined) headers['Content-Type'] = type ?? 'application/json'
    if (version !== undefined) headers['If-Match'] = '"' + version + '"'
    const response = await fetcher(gateway + path, { method, headers, redirect: 'error',
      body: body === undefined ? undefined : type ? body : JSON.stringify(body), signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error('Seed request failed: ' + method + ' ' + path + ' HTTP ' + response.status + '; inspect existing state before retrying.')
    return response.status === 204 ? null : response.json()
  }
  async function login(id) {
    if (sessions.has(id)) return sessions.get(id)
    const account = accounts.get(id)
    if (!account) throw new Error('Unknown demo account.')
    const result = await request('POST', '/api/users/login', { body: { email: account.email, password: account.password } })
    if (typeof result.accessToken !== 'string' || !result.accessToken) throw new Error('Demo login did not return an access token.')
    // Retain the token for logout even when the returned identity is unexpected.
    const session = { token: result.accessToken, identity: { id: result.user?.id, name: result.user?.name, role: result.user?.role } }
    sessions.set(id, session)
    if (session.identity.id !== id || session.identity.role !== account.role) throw new Error('Demo account identity/role does not match; no role was changed.')
    return session
  }
  try {
    const admin = await login('demo-admin')
    for (const article of [...publications].reverse()) {
      const author = await login(article.authorId)
      const draft = await service.seedDraft(article.slug, author.identity)
      if (!draft.created) {
        if (prepareImages) await service.prepareSeedImages(article.slug, author.identity)
        log(article.slug + ': kept existing demo publication (' + draft.publication.status + ')')
        continue
      }
      const base = '/api/publications/' + article.slug
      const { asset } = await request('POST', base + '/assets', { token: author.token, body: await readAsset(article), type: 'image/webp' })
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
      log(article.slug + ': created, reviewed, published and read through the gateway')
    }
    log('Demo publication seed complete. Existing records were not overwritten; interrupted drafts can be continued by their author.')
  } finally {
    for (const session of sessions.values()) {
      await request('POST', '/api/users/logout', { token: session.token, body: {} })
        .catch(() => log('Warning: demo session logout was not confirmed; inspect/revoke it before acceptance.'))
    }
  }
}
