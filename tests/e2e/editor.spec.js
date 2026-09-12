const { test, expect } = require('@playwright/test')
const { randomUUID } = require('node:crypto')
const AxeBuilder = require('@axe-core/playwright').default
const demoPassword = 'Un cuaderno de prueba local 2026'
const baseHeaders = { 'X-Otherbloc-Request': '1' }
const prose = (page) => page.getByRole('textbox', { name: 'Texto de la publicación' })
const saved = (page) => expect(page.locator('.writing-save')).toHaveText('Guardado')
test.beforeEach(async ({ page }) => { page.setDefaultTimeout(10000) })

async function login(page, role = 'author') {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(process.env['SEED_' + role.toUpperCase() + '_EMAIL'])
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env.SEED_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible()
}
async function create(page) {
  await page.locator('main').getByRole('link', { name: 'Mis publicaciones', exact: true }).click()
  await page.getByRole('button', { name: 'Nueva publicación', exact: true }).click()
  await expect(prose(page)).toBeVisible()
  return new URL(page.url()).pathname.split('/').pop()
}
async function details(page) { await page.getByRole('button', { name: 'Detalles', exact: true }).click() }
async function closeDetails(page) { await page.getByRole('button', { name: 'Cerrar detalles' }).click() }
async function confirm(page, label) {
  const dialog = page.getByRole('dialog', { name: /\?/ })
  await expect(dialog.getByRole('button', { name: label, exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await expect(dialog).not.toBeVisible()
}
async function credentials(request, email = process.env.SEED_AUTHOR_EMAIL, password = process.env.SEED_PASSWORD) {
  const result = await request.post('/api/users/login', { headers: baseHeaders, data: { email, password } })
  expect(result.ok()).toBe(true)
  return { ...baseHeaders, Authorization: 'Bearer ' + (await result.json()).accessToken }
}
async function cleanup(request, id, email, password) {
  if (!id) return
  const headers = await credentials(request, email, password)
  try {
    const current = await request.get('/api/publications/' + id, { headers })
    if (current.status() === 404) return
    let { publication } = await current.json()
    if (['review', 'published'].includes(publication.status)) {
      const changed = await request.patch('/api/publications/' + id + '/status', { headers: { ...headers, 'If-Match': '"' + publication.version + '"' }, data: { status: publication.status === 'review' ? 'draft' : 'archived' } })
      expect(changed.ok()).toBe(true); publication = (await changed.json()).publication
    }
    expect((await request.delete('/api/publications/' + id, { headers: { ...headers, 'If-Match': '"' + publication.version + '"' } })).status()).toBe(204)
  } finally { await request.post('/api/users/logout', { headers, data: {} }) }
}
async function command(page, text) {
  await page.keyboard.insertText('/' + text)
  await expect(page.getByRole('listbox', { name: 'Añadir al texto' })).toBeVisible()
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter')
}
async function paste(page, target, text, html) {
  await target.evaluate((node, { text, html }) => {
    const clipboardData = new DataTransfer(); clipboardData.setData('text/plain', text)
    if (html) clipboardData.setData('text/html', html)
    node.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  }, { text, html })
}

test('registration to immediate writing, rich content, tags, recovery, admin approval and public reading', async ({ page, browser, request }, testInfo) => {
  test.setTimeout(150000)
  const email = 'writing-' + randomUUID() + '@example.test'
  const adminContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', viewport: page.viewportSize() })
  const visitorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', viewport: page.viewportSize() })
  const admin = await adminContext.newPage(), visitor = await visitorContext.newPage(), errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  let id
  try {
    await page.goto('/register')
    await page.getByLabel('Nombre', { exact: true }).fill('Cuaderno de prueba')
    await page.getByLabel('Correo electrónico').fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill(demoPassword)
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Solicitar acceso de autor' })).toHaveCount(0)
    id = await create(page)
    await expect(page.locator('.site-header__search')).toHaveCount(0)
    await page.getByLabel('Título', { exact: true }).fill('Yo')
    await saved(page); await page.reload()
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Yo')
    const title = 'La ciudad en un cuaderno ' + id.slice(0, 8)
    await page.getByLabel('Título', { exact: true }).fill(title)
    await prose(page).click()
    await paste(page, prose(page), 'Una idea con formato.', '<p><strong>Una idea</strong> con <em>formato</em>.</p>')
    await expect(prose(page).locator('strong')).toHaveText('Una idea')
    await expect(prose(page).locator('em')).toHaveText('formato')
    await prose(page).press('Control+End'); await page.keyboard.press('Enter')
    await page.keyboard.insertText('Una referencia')
    await page.keyboard.press('Home'); await page.keyboard.press('Shift+End')
    await page.getByRole('button', { name: 'Enlace', exact: true }).click()
    await page.getByRole('dialog', { name: 'Enlace', exact: true }).getByLabel('Dirección').fill('https://example.com/lectura')
    await page.getByRole('button', { name: 'Aplicar enlace' }).click()
    await expect(prose(page).locator('a')).toHaveText('Una referencia')
    await prose(page).press('Control+End'); await page.keyboard.press('Enter')
    await command(page, 'sub')
    await page.keyboard.insertText('Mirar despacio')
    await page.keyboard.press('Enter'); await command(page, 'viñetas')
    await page.keyboard.insertText('Caminar'); await page.keyboard.press('Enter'); await page.keyboard.insertText('Observar')
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await command(page, 'numerada')
    await page.keyboard.insertText('Primera idea'); await page.keyboard.press('Enter'); await page.keyboard.insertText('Segunda idea')
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await command(page, 'cita')
    await page.keyboard.insertText('Escribir es volver a mirar.')
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
    await page.getByText('Fuente de la cita', { exact: true }).click()
    await page.getByLabel('Autoría o fuente de la cita').fill('Texto original de demostración')
    await prose(page).press('Control+End')
    await page.getByRole('button', { name: 'Añadir al texto', exact: true }).click()
    await page.getByRole('option', { name: 'Imagen', exact: true }).click()
    await page.getByLabel('Archivo de imagen', { exact: true }).setInputFiles('frontend/public/images/lectura.webp')
    await expect(page.getByRole('button', { name: 'Cambiar imagen', exact: true })).toBeEnabled()
    await page.getByLabel('Descripción de la imagen', { exact: true }).fill('Una persona lee en una biblioteca')
    await page.getByLabel('Pie de imagen', { exact: true }).fill('Fotografía original de otherbloc')
    await details(page)
    await page.getByLabel('Resumen', { exact: true }).fill('Una nota de demostración para recorrer la ciudad con atención y guardar nuestras primeras ideas.')
    await page.getByLabel('Categoría', { exact: true }).selectOption('Ciudad')
    const tags = page.getByLabel('Etiquetas', { exact: true })
    await tags.pressSequentially('cultura ciudad ')
    await expect(page.locator('.tag-piece')).toHaveCount(2)
    await tags.fill('CULTURA'); await tags.press('Enter')
    await expect(page.locator('.tag-piece')).toHaveCount(2)
    await paste(page, tags, 'escritura, barrio\nciudad')
    await expect(page.locator('.tag-piece')).toHaveCount(4)
    await page.getByRole('button', { name: 'Quitar etiqueta barrio' }).click()
    await expect(tags).toBeFocused()
    await tags.fill('a'.repeat(31)); await tags.press('Enter')
    await expect(page.locator('#tags-error')).toContainText('30 caracteres')
    await page.getByLabel('Archivo de portada').setInputFiles('frontend/public/images/lectura.webp')
    await expect(page.getByRole('button', { name: 'Cambiar portada' })).toBeEnabled()
    await page.getByLabel('Descripción de la portada').fill('Una persona leyendo en una biblioteca')
    await closeDetails(page); await saved(page)
    page.once('dialog', (dialog) => dialog.accept())
    await page.reload(); await details(page)
    await expect(tags).toHaveValue('a'.repeat(31))
    await expect(page.locator('.tag-piece')).toHaveCount(3)
    await tags.fill(''); await closeDetails(page)
    await expect(prose(page).locator('strong')).toHaveText('Una idea')
    await expect(prose(page).locator('a')).toHaveAttribute('href', 'https://example.com/lectura')
    await expect(prose(page).locator('ol li')).toHaveCount(2)
    await expect(prose(page).locator('ul li')).toHaveCount(2)
    await expect(prose(page).locator('h2')).toHaveText('Mirar despacio')
    await expect(prose(page).getByRole('img')).toBeVisible()
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Activar tema oscuro' : 'Activar tema claro' }).click()
      await page.mouse.move(0, 0)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(audit.violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('editor-' + theme + '.png'), fullPage: true })
    }
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click()
    await expect(page.locator('.editor-preview strong')).toHaveText('Una idea')
    await expect(page.locator('.editor-preview cite')).toHaveText('Texto original de demostración')
    const headers = await credentials(request, email, demoPassword)
    const current = (await (await request.get('/api/publications/' + id, { headers })).json()).publication
    expect((await request.patch('/api/publications/' + id + '/status', { headers: { ...headers, 'If-Match': '"' + current.version + '"' }, data: { status: 'published' } })).status()).toBe(403)
    expect((await request.patch('/api/users/me', { headers, data: { role: 'admin' } })).status()).toBe(400)
    expect((await request.get('/api/users', { headers })).status()).toBe(403)
    await visitor.goto('/article/' + id); await expect(visitor.locator('main')).toContainText('404')
    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click(); await confirm(page, 'Enviar a revisión')
    await page.getByRole('button', { name: 'Escribir', exact: true }).click()
    await expect(prose(page)).toHaveAttribute('contenteditable', 'false')
    await login(admin, 'admin')
    await admin.goto('/admin/publications/' + id)
    await expect(admin.locator('.editor-preview')).toContainText('Mirar despacio')
    await admin.getByRole('button', { name: 'Aprobar publicación' }).click()
    await admin.getByRole('button', { name: 'Aprobar y publicar' }).click()
    await expect(admin.getByRole('status')).toContainText('Estado actualizado: publicada')
    await visitor.reload(); await expect(visitor.locator('main h1')).toHaveText(title)
    await expect(visitor.locator('.article-prose strong')).toHaveText('Una idea')
    await expect(visitor.locator('.article-prose em')).toHaveText('formato')
    await expect(visitor.locator('.article-prose a')).toHaveAttribute('href', 'https://example.com/lectura')
    await expect(visitor.locator('.article-prose ol li')).toHaveCount(2)
    await expect(visitor.locator('.article-prose ul li')).toHaveCount(2)
    await expect(visitor.locator('.article-prose figure img')).toHaveCSS('filter', 'none')
    await expect.poll(() => visitor.locator('.article-prose figure img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true)
    const foreign = await credentials(request)
    const foreignEdit = { ...Object.fromEntries(['title', 'summary', 'coverId', 'coverAlt', 'type', 'category', 'tags'].map((key) => [key, current[key]])), blocks: current.blocks.map(({ url: _url, ...block }) => block) }
    expect((await request.put('/api/publications/' + id, { headers: { ...foreign, 'If-Match': '"' + current.version + '"' }, data: foreignEdit })).status()).toBe(403)
    expect(errors).toEqual([])
  } finally { await adminContext.close(); await visitorContext.close(); await cleanup(request, id, email, demoPassword) }
})

test('autosave preserves typing during a slow save and protects navigation until the operation finishes', async ({ page, request }) => {
  let id, release
  try {
    await login(page); id = await create(page)
    let signalStarted
    const started = new Promise((resolve) => { signalStarted = resolve }), gate = new Promise((resolve) => { release = resolve })
    let intercepted = false
    await page.route('**/api/publications/' + id, async (route) => { if (route.request().method() !== 'PUT' || intercepted) return route.continue(); intercepted = true; signalStarted(); await gate; await route.continue() })
    await prose(page).fill('Primera versión en camino'); await started
    await prose(page).press('Control+End'); await page.keyboard.insertText(' y nuevos cambios durante el guardado.')
    await page.getByLabel('Título', { exact: true }).fill('Segunda versión escrita durante el guardado')
    await page.getByRole('link', { name: 'Mis publicaciones', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Hay una operación en curso' })
    await expect(dialog).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Salir sin guardar' })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Seguir editando' }).click()
    release(); await saved(page); await page.reload()
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Segunda versión escrita durante el guardado')
    await expect(prose(page)).toContainText('y nuevos cambios durante el guardado.')
    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click(); await confirm(page, 'Enviar a revisión')
    await expect(page.getByRole('alert')).toContainText(/resumen|portada/)
    await expect(page.locator('.writing-eyebrow')).toHaveText('Borrador')
  } finally { release?.(); await page.unrouteAll({ behavior: 'wait' }); await cleanup(request, id) }
})

test('two editor tabs detect version conflicts without overwriting and recovery requires confirmation', async ({ page, context, request }) => {
  let id
  const second = await context.newPage()
  try {
    await login(page); id = await create(page)
    await prose(page).fill('Texto de partida'); await saved(page)
    await second.goto('/author/publications/' + id); await expect(prose(second)).toContainText('Texto de partida')
    await prose(page).fill('Texto guardado por la primera pestaña'); await saved(page)
    await prose(second).fill('Mi propuesta local que debe conservarse')
    await expect(second.getByRole('alert')).toContainText(/cambi|versión/i)
    await expect(prose(second)).toContainText('Mi propuesta local que debe conservarse')
    const download = second.waitForEvent('download'); await second.getByRole('button', { name: 'Descargar mis cambios' }).click()
    expect((await download).suggestedFilename()).toBe('otherbloc-borrador-' + id + '.json')
    await second.getByRole('button', { name: 'Recuperar versión guardada', exact: true }).click()
    await expect(second.getByRole('dialog', { name: '¿Recuperar la versión guardada?' })).toBeVisible()
    await second.keyboard.press('Escape'); await expect(second.getByRole('dialog')).not.toBeVisible(); await expect(prose(second)).toContainText('Mi propuesta local')
    await second.getByRole('button', { name: 'Recuperar versión guardada', exact: true }).click(); await confirm(second, 'Recuperar versión guardada')
    await expect(prose(second)).toContainText('Texto guardado por la primera pestaña'); await saved(second)
  } finally { await second.close(); await cleanup(request, id) }
})

test('existing reader account can write but cannot enter moderation workspaces', async ({ page }) => {
  await login(page, 'reader'); await page.goto('/author')
  await expect(page.getByRole('button', { name: 'Nueva publicación' })).toBeEnabled()
  for (const path of ['/admin/users', '/admin/publications', '/admin/publications/not-allowed']) { await page.goto(path); await expect(page.getByRole('heading', { name: 'Acceso no permitido' })).toBeVisible() }
})

test('failed saves retain text; retry, selection, undo, redo, slash escape and pending tags remain usable', async ({ page, request }) => {
  let id
  try {
    await login(page); id = await create(page)
    const path = '**/api/publications/' + id
    await page.route(path, (route) => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'content_unavailable', message: 'No se pudo guardar. Inténtalo de nuevo.' } }) : route.continue())
    await prose(page).fill('Texto que no debe perderse')
    await expect(page.getByRole('alert')).toContainText('No se pudo guardar')
    await expect(prose(page)).toHaveText('Texto que no debe perderse')
    await page.unroute(path); await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await saved(page)
    await prose(page).press('Control+End'); await page.keyboard.press('Enter'); await page.keyboard.insertText('/noexiste')
    await expect(page.getByRole('listbox')).toContainText('No hay opciones'); await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0); await expect(prose(page)).toContainText('/noexiste')
    await page.keyboard.press('Home'); await page.keyboard.press('Shift+End'); await page.keyboard.press('Backspace')
    await page.keyboard.insertText('Última línea')
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await expect(prose(page)).not.toContainText('Última línea')
    await page.getByRole('button', { name: 'Rehacer', exact: true }).click(); await expect(prose(page)).toContainText('Última línea')
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click(); await page.getByRole('button', { name: 'Escribir', exact: true }).click()
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await expect(prose(page)).not.toContainText('Última línea')
    await prose(page).press('Control+End')
    await page.getByRole('button', { name: 'Añadir al texto', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.getByLabel('Buscar opción').fill('sub')
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
    expect(await prose(page).evaluate((node) => node === document.activeElement)).toBe(true)
    await page.keyboard.insertText('Subtítulo desde el teclado')
    await expect(prose(page).locator('h2')).toContainText('Subtítulo desde el teclado')
    await saved(page); await details(page)
    await paste(page, page.getByLabel('Etiquetas', { exact: true }), 'uno dos tres cuatro cinco seis siete ocho nueve')
    await expect(page.locator('.tag-piece')).toHaveCount(8)
    await expect(page.getByLabel('Etiquetas', { exact: true })).toHaveValue('nueve')
    await expect(page.locator('#tags-error')).toContainText('nueve')
    await page.getByRole('button', { name: 'Quitar etiqueta uno' }).click()
    await expect(page.getByLabel('Etiquetas', { exact: true })).toBeFocused()
    await expect(page.locator('#tags-error')).not.toHaveAttribute('role', 'alert')
    await page.getByLabel('Etiquetas', { exact: true }).press('Enter')
    await expect(page.locator('.tag-piece')).toHaveCount(8)
    await expect(page.getByRole('button', { name: 'Quitar etiqueta nueve' })).toBeVisible()
    await page.getByRole('button', { name: 'Eliminar publicación', exact: true }).click(); await confirm(page, 'Eliminar publicación')
    await expect(page).toHaveURL(/\/author$/)
  } finally { await page.unrouteAll({ behavior: 'wait' }); await cleanup(request, id) }
})
