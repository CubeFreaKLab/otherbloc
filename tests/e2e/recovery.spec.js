const { test, expect } = require('@playwright/test')
const { randomUUID } = require('node:crypto')
const AxeBuilder = require('@axe-core/playwright').default
const password = 'Una recuperación de prueba privada 2026'
const headers = { 'X-Otherbloc-Request': '1', Origin: 'http://127.0.0.1:5173' }

async function register(page, navigate = true) {
  const email = 'recovery-' + randomUUID() + '@example.test'
  if (navigate) await page.goto('/register')
  await page.getByLabel('Nombre', { exact: true }).fill('Cuenta de recuperación')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByLabel('Nombre público')).toBeVisible()
  return email
}

async function submitLogin(page, email, value = password) {
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(value)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
}

async function revoke(page) {
  // Revoke the real current server session outside the SPA, as another client could do.
  const response = await page.request.post('/api/users/logout', { headers, data: {} })
  expect(response.status()).toBe(204)
}

test('revoked session keeps private profile edits in memory until the same account explicitly restores them', async ({ page }, testInfo) => {
  const email = await register(page), text = 'Biografía que debe recuperarse ' + randomUUID()
  await page.getByLabel('Biografía', { exact: true }).fill(text)
  await revoke(page)
  await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tus cambios siguen en esta pestaña' })).toBeVisible()
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(text)
  await expect(page.getByRole('button', { name: /Descargar copia/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Volver a entrar', exact: true }).click()
  await submitLogin(page, email)
  await expect(page.getByLabel('Biografía', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Descartar copia de tu perfil', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '¿Descartar estos cambios recuperables?' })
  await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByLabel('Biografía', { exact: true })).toBeDisabled()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Tema de color' }).selectOption(theme)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('session-recovery-' + theme + '.png'), fullPage: true })
  }
  await page.getByRole('button', { name: 'Recuperar cambios de esta pestaña', exact: true }).click()
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue(text)
  await expect(page.getByRole('heading', { name: 'Tus cambios siguen en esta pestaña' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Tu perfil se guardó')
  await page.reload()
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue(text)
  await page.getByLabel('Biografía', { exact: true }).fill('Esta segunda copia se descartará explícitamente.')
  await revoke(page)
  await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
  await page.getByRole('link', { name: 'Volver a entrar', exact: true }).click()
  await submitLogin(page, email)
  await page.getByRole('button', { name: 'Descartar copia de tu perfil', exact: true }).click()
  await page.getByRole('dialog', { name: '¿Descartar estos cambios recuperables?' }).getByRole('button', { name: 'Descartar copia temporal', exact: true }).click()
  await expect(page.locator('.draft-recovery')).toHaveCount(0)
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue(text)
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue(text)
})

test('entering another account discards the previous pending profile without disclosing its contents', async ({ page }) => {
  await register(page)
  const privateText = 'Copia privada de la cuenta anterior ' + randomUUID()
  await page.getByLabel('Biografía', { exact: true }).fill(privateText)
  await revoke(page)
  await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
  await page.getByRole('link', { name: 'Volver a entrar', exact: true }).click()
  await expect(page.locator('.draft-recovery')).toContainText('Si entras con otra cuenta, esta copia se elimina')
  await page.getByRole('link', { name: 'Crea una cuenta', exact: true }).click()
  await register(page, false)
  await expect(page.locator('.draft-recovery')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(privateText)
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue('')
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => /draft|recovery|token|session|user/i.test(key)))).toBe(false)
})

test('comment attempt survives reauthentication and can be retried without changing its UUID', async ({ page }) => {
  const email = await register(page), text = 'Comentario recuperado ' + randomUUID(), attempts = []
  await page.goto('/article/leer-sin-prisa')
  await page.getByLabel('Tu comentario', { exact: true }).fill(text)
  page.on('request', (request) => {
    if (request.url().endsWith('/api/interactions') && request.postDataJSON()?.operationName === 'WriteComment') attempts.push(request.postDataJSON().variables.input.id)
  })
  await revoke(page)
  await page.getByRole('button', { name: 'Publicar comentario', exact: true }).click()
  await expect(page.locator('.draft-recovery')).toBeVisible()
  await expect(page.getByLabel('Tu comentario', { exact: true })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(text)
  await page.getByRole('link', { name: 'Volver a entrar', exact: true }).click()
  await submitLogin(page, email)
  await page.getByRole('button', { name: 'Recuperar cambios de esta pestaña', exact: true }).click()
  await expect(page.getByLabel('Tu comentario', { exact: true })).toHaveValue(text)
  await page.getByRole('button', { name: 'Reintentar comentario', exact: true }).click()
  const row = page.locator('.comment-item').filter({ hasText: text })
  await expect(row).toHaveCount(1)
  expect(attempts).toHaveLength(2)
  expect(attempts[0]).toBe(attempts[1])
  await expect(page.getByRole('button', { name: 'Publicar comentario', exact: true })).toBeDisabled()
  await page.reload()
  await expect(row).toHaveCount(1)
  await row.getByRole('button', { name: 'Eliminar mi comentario' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar comentario', exact: true }).click()
  await expect(row).toHaveCount(0)
})

for (const concurrent of [false, true]) test('author recovery ' + (concurrent ? 'keeps its original version and cannot overwrite newer server work' : 'restores and saves unchanged-version work'), async ({ page, request }, testInfo) => {
  await page.goto('/login')
  await submitLogin(page, process.env.SEED_AUTHOR_EMAIL, process.env.SEED_PASSWORD)
  await page.getByRole('link', { name: 'Mis publicaciones', exact: true }).click()
  await page.getByRole('button', { name: 'Nueva publicación', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tu publicación' })).toBeVisible()
  const id = new URL(page.url()).pathname.split('/').pop()
  const remote = await request.post('/api/users/login', { headers, data: { email: process.env.SEED_AUTHOR_EMAIL, password: process.env.SEED_PASSWORD } })
  const authorized = { ...headers, Authorization: 'Bearer ' + (await remote.json()).accessToken }
  try {
    await revoke(page)
    await page.getByLabel('Título', { exact: true }).fill('Texto local que necesita recuperación')
    await page.getByRole('button', { name: 'Guardar ahora', exact: true }).click()
    await expect(page.locator('.draft-recovery')).toBeVisible()
    await expect(page.getByLabel('Título', { exact: true })).toHaveCount(0)
    const current = (await (await request.get('/api/publications/' + id, { headers: authorized })).json()).publication
    const document = Object.fromEntries(['title', 'summary', 'type', 'category', 'tags', 'coverId', 'coverAlt', 'blocks'].map((key) => [key, current[key]]))
    if (concurrent) {
      const changed = await request.put('/api/publications/' + id, { headers: { ...authorized, 'If-Match': '"' + current.version + '"' }, data: { ...document, title: 'Trabajo posterior guardado por otra sesión' } })
      expect(changed.status()).toBe(200)
    }
    await page.getByRole('link', { name: 'Volver a entrar', exact: true }).click()
    await submitLogin(page, process.env.SEED_AUTHOR_EMAIL, process.env.SEED_PASSWORD)
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue(concurrent ? 'Trabajo posterior guardado por otra sesión' : current.title)
    await page.getByRole('button', { name: 'Recuperar cambios de esta pestaña', exact: true }).click()
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Texto local que necesita recuperación')
    if (concurrent) {
      await expect(page.getByRole('alert')).toContainText('El servidor cambió mientras tu sesión estaba interrumpida')
      await page.getByRole('button', { name: 'Guardar ahora', exact: true }).click()
      await expect(page.getByRole('alert')).toContainText('versión')
    } else await expect(page.locator('.editor-toolbar [role="status"]')).toHaveText('Borrador guardado')
    const verified = (await (await request.get('/api/publications/' + id, { headers: authorized })).json()).publication
    expect(verified.title).toBe(concurrent ? 'Trabajo posterior guardado por otra sesión' : 'Texto local que necesita recuperación')
    if (concurrent) {
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Descargar mis cambios', exact: true }).click()
      await (await download).saveAs(testInfo.outputPath('recovered-draft.json'))
      await page.getByRole('button', { name: 'Recargar contenido del servidor', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Recuperar versión guardada', exact: true }).click()
    }
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue(verified.title)
  } finally {
    const current = await request.get('/api/publications/' + id, { headers: authorized })
    if (current.ok()) {
      const { publication } = await current.json()
      expect((await request.delete('/api/publications/' + id, { headers: { ...authorized, 'If-Match': '"' + publication.version + '"' } })).status()).toBe(204)
    }
    await request.post('/api/users/logout', { headers: authorized, data: {} })
  }
})
