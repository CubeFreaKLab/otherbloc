const { test, expect } = require('@playwright/test')
const { randomUUID } = require('node:crypto')
const sharp = require('sharp')
const AxeBuilder = require('@axe-core/playwright').default

const headers = { 'X-Otherbloc-Request': '1', Origin: 'http://127.0.0.1:5173' }
const url = (id) => '/api/publications/' + id

async function authorize(request, role) {
  const response = await request.post('/api/users/login', { headers, data: { email: process.env[role === 'admin' ? 'SEED_ADMIN_EMAIL' : 'SEED_AUTHOR_EMAIL'], password: process.env.SEED_PASSWORD } })
  expect(response.status()).toBe(200)
  return { ...headers, Authorization: 'Bearer ' + (await response.json()).accessToken }
}

async function signIn(page, role = 'admin') {
  await page.getByLabel('Correo electrónico').fill(process.env[role === 'admin' ? 'SEED_ADMIN_EMAIL' : 'SEED_AUTHOR_EMAIL'])
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env.SEED_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
}

async function transition(request, authorization, publication, status) {
  const response = await request.patch(url(publication.id) + '/status', { headers: { ...authorization, 'If-Match': '"' + publication.version + '"' }, data: { status } })
  expect(response.status()).toBe(200)
  return (await response.json()).publication
}

async function current(request, authorization, id) {
  const response = await request.get(url(id), { headers: authorization })
  expect(response.status()).toBe(200)
  return (await response.json()).publication
}

async function prepare(request, authorization, id) {
  const created = await request.post('/api/publications', { headers: authorization, data: { id, title: 'Revisión recuperable ' + id } })
  expect(created.status()).toBe(201)
  let publication = (await created.json()).publication
  const image = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#717168' } }).png().toBuffer()
  const uploaded = await request.post(url(id) + '/assets', { headers: { ...authorization, 'Content-Type': 'image/png' }, data: image })
  expect(uploaded.status()).toBe(201)
  const document = Object.fromEntries(['title', 'summary', 'type', 'category', 'tags', 'coverId', 'coverAlt', 'blocks'].map((key) => [key, publication[key]]))
  const updated = await request.put(url(id), { headers: { ...authorization, 'If-Match': '"' + publication.version + '"' }, data: {
    ...document, summary: 'Contenido sintético para comprobar que una decisión editorial conserva su versión y su autoría.',
    coverId: (await uploaded.json()).asset.id, coverAlt: 'Superficie gris de prueba',
    blocks: [{ id: randomUUID(), type: 'paragraph', text: 'Este texto pertenece al borrador de prueba, no a la copia personal de la observación administrativa.' }],
  } })
  expect(updated.status()).toBe(200)
  publication = (await updated.json()).publication
  return transition(request, authorization, publication, 'review')
}

// Only the UUID created by this test is withdrawn and logically deleted through its owner API.
async function cleanup(request, authorization, id) {
  const response = await request.get(url(id), { headers: authorization })
  if (response.status() === 404) return
  expect(response.status()).toBe(200)
  let publication = (await response.json()).publication
  if (['review', 'published'].includes(publication.status)) publication = await transition(request, authorization, publication, publication.status === 'review' ? 'draft' : 'archived')
  expect((await request.delete(url(id), { headers: { ...authorization, 'If-Match': '"' + publication.version + '"' } })).status()).toBe(204)
}

for (const scenario of ['return', 'archive', 'changed', 'inaccessible', 'other-account']) test('moderation recovery: ' + scenario + ' keeps personal reasons separate from publication versions', async ({ page, request }, testInfo) => {
  const id = randomUUID(), owner = await authorize(request, 'author'), admin = await authorize(request, 'admin')
  const reason = 'Observación personal que no debe perderse ' + id
  const errors = [], decisions = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (request.method() === 'PATCH' && request.url().endsWith(url(id) + '/status')) decisions.push(request.postDataJSON()) })
  try {
    let publication = await prepare(request, owner, id)
    if (scenario === 'archive') publication = await transition(request, admin, publication, 'published')
    await page.goto('/login?returnTo=' + encodeURIComponent('/admin/publications/' + id))
    await signIn(page)
    await page.getByRole('button', { name: scenario === 'archive' ? 'Archivar publicación' : 'Devolver al autor', exact: true }).click()
    await page.getByLabel('Motivo para el autor').fill(reason)
    expect((await page.request.post('/api/users/logout', { headers, data: {} })).status()).toBe(204)
    await page.getByRole('button', { name: scenario === 'archive' ? 'Confirmar archivo' : 'Devolver a borrador', exact: true }).click()
    await expect(page.locator('.draft-recovery')).toBeVisible()
    await expect(page.getByLabel('Motivo para el autor')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(reason)
    await expect(page.getByRole('button', { name: /Descargar copia/ })).toHaveCount(0)
    expect((await current(request, owner, id)).version).toBe(publication.version)
    if (scenario === 'changed') publication = await transition(request, admin, publication, 'published')
    if (scenario === 'inaccessible') publication = await transition(request, owner, publication, 'draft')
    await page.getByRole('link', { name: 'Volver a entrar', exact: true }).click()
    if (scenario === 'other-account') {
      await signIn(page, 'author')
      await expect(page.getByRole('heading', { name: 'Acceso no permitido', exact: true })).toBeVisible()
      await expect(page.locator('.draft-recovery')).toHaveCount(0)
      await expect(page.locator('body')).not.toContainText(reason)
      await expect(page.getByRole('button', { name: /Descargar copia/ })).toHaveCount(0)
      expect((await current(request, owner, id)).version).toBe(publication.version)
      expect(decisions).toHaveLength(1)
      expect(errors).toEqual([])
      return
    }
    await signIn(page)
    await expect(page.getByRole('heading', { name: 'Revisar publicación', exact: true })).toBeVisible()
    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descargar copia de tu observación editorial', exact: true }).click()
    const stream = await (await downloadEvent).createReadStream(), chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual({ reason, action: scenario === 'archive' ? 'archived' : 'draft', version: scenario === 'changed' || scenario === 'inaccessible' ? publication.version - 1 : publication.version })
    if (scenario === 'return' || scenario === 'archive') {
      await expect(page.getByRole('button', { name: scenario === 'archive' ? 'Archivar publicación' : 'Devolver al autor', exact: true })).toBeDisabled()
      await expect(page.getByLabel('Motivo para el autor')).toHaveCount(0)
      await page.getByRole('button', { name: 'Recuperar cambios de esta pestaña', exact: true }).click()
      await expect(page.getByLabel('Motivo para el autor')).toHaveValue(reason)
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: scenario === 'archive' ? 'Confirmar archivo' : 'Devolver a borrador', exact: true }).click()
      await expect(page.locator('main').getByRole('status')).toContainText(scenario === 'archive' ? 'Estado actualizado: archivada' : 'Publicación devuelta')
      const verified = await current(request, owner, id)
      expect(verified.status).toBe(scenario === 'archive' ? 'archived' : 'draft')
      expect(verified.version).toBe(publication.version + 1)
      expect(verified.moderationNote.reason).toBe(reason)
      expect(decisions).toHaveLength(2)
    } else {
      await expect(page.getByRole('button', { name: 'Recuperar cambios de esta pestaña', exact: true })).toHaveCount(0)
      if (scenario === 'changed') {
        await expect(page.getByLabel('Tu observación anterior')).toHaveValue(reason)
        await expect(page.getByLabel('Tu observación anterior')).toHaveAttribute('readonly', '')
        await expect(page.getByRole('button', { name: 'Archivar publicación', exact: true })).toBeDisabled()
        await page.emulateMedia({ reducedMotion: 'reduce' })
        for (const theme of ['light', 'dark']) {
          await page.getByRole('combobox', { name: 'Tema de color' }).selectOption(theme)
          await expect(page.locator('body')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(23, 23, 22)' : 'rgb(246, 245, 243)')
          await expect(page.locator('.recovery-choice')).toHaveCSS('color', theme === 'dark' ? 'rgb(246, 245, 243)' : 'rgb(0, 0, 0)')
          expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
          await page.screenshot({ path: testInfo.outputPath('moderation-recovery-' + theme + '.png'), fullPage: true })
        }
      } else {
        await expect(page.locator('main')).toContainText('No encontramos esta publicación o ya no está disponible para revisión.')
        await expect(page.locator('.editor-preview')).toHaveCount(0)
        await expect(page.locator('main')).not.toContainText(publication.blocks[0].text)
      }
      await page.getByRole('button', { name: 'Descartar copia de tu observación editorial', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Descartar copia temporal', exact: true }).click()
      await expect(page.locator('.draft-recovery')).toHaveCount(0)
      if (scenario === 'changed') await expect(page.getByRole('button', { name: 'Archivar publicación', exact: true })).toBeEnabled()
      expect((await current(request, owner, id)).version).toBe(publication.version)
      expect(decisions).toHaveLength(1)
    }
    expect(errors).toEqual([])
  } finally {
    await cleanup(request, owner, id)
    await request.post('/api/users/logout', { headers: owner, data: {} })
    await request.post('/api/users/logout', { headers: admin, data: {} })
  }
})

test('an authenticated identity swap remounts the private workspace before showing the new account data', async ({ page, request }) => {
  const id = randomUUID(), owner = await authorize(request, 'author'), title = 'Borrador privado de la cuenta anterior ' + id
  const created = await request.post('/api/publications', { headers: owner, data: { id, title } })
  expect(created.status()).toBe(201)
  try {
    await page.goto('/login?returnTo=%2Fauthor')
    await signIn(page, 'author')
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
    expect((await page.request.post('/api/users/logout', { headers, data: {} })).status()).toBe(204)
    await authorize(page.request, 'admin')
    const writes = []
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/publications')) writes.push(request) })
    const nextList = page.waitForResponse((response) => response.url().includes('/api/publications/mine?') && response.status() === 200)
    await page.getByRole('button', { name: 'Nueva publicación', exact: true }).click()
    await nextList
    await expect(page.getByRole('button', { name: 'Nueva publicación', exact: true })).toBeEnabled()
    await expect(page.locator('main')).not.toContainText(title)
    await expect(page).toHaveURL(/\/author$/)
    expect(writes).toHaveLength(1)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Nueva publicación', exact: true })).toBeVisible()
    await expect(page.locator('main')).not.toContainText(title)
  } finally {
    await cleanup(request, owner, id)
    await request.post('/api/users/logout', { headers: owner, data: {} })
    await page.request.post('/api/users/logout', { headers, data: {} })
  }
})
