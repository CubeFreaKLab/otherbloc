const { test, expect } = require('@playwright/test')
const sharp = require('sharp')
const AxeBuilder = require('@axe-core/playwright').default

async function login(page, role = 'author') {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(role === 'admin' ? process.env.SEED_ADMIN_EMAIL : role === 'reader' ? process.env.SEED_READER_EMAIL : process.env.SEED_AUTHOR_EMAIL)
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env.SEED_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible()
}

async function create(page) {
  await page.getByRole('link', { name: 'Mis publicaciones', exact: true }).click()
  await page.getByRole('button', { name: 'Nueva publicación', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tu publicación' })).toBeVisible()
  return new URL(page.url()).pathname.split('/').pop()
}

const saved = (page) => expect(page.locator('.editor-toolbar [role="status"]')).toHaveText('Borrador guardado')

async function confirm(page, label) {
  const dialog = page.getByRole('dialog', { name: /\?/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: label, exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await expect(dialog).not.toBeVisible()
}

// Cleanup uses the same HTTP gateway and author permissions as the application.
// It only touches the UUID created by this test; media/audit retention is server-managed.
async function cleanup(request, id) {
  if (!id) return
  const headers = { 'X-Otherbloc-Request': '1' }
  const signed = await request.post('/api/users/login', { headers, data: { email: process.env.SEED_AUTHOR_EMAIL, password: process.env.SEED_PASSWORD } })
  expect(signed.ok()).toBe(true)
  const { accessToken } = await signed.json()
  headers.Authorization = 'Bearer ' + accessToken
  try {
    const current = await request.get('/api/publications/' + id, { headers })
    if (current.status() === 404) return
    expect(current.ok()).toBe(true)
    let { publication } = await current.json()
    if (['review', 'published'].includes(publication.status)) {
      const result = await request.patch('/api/publications/' + id + '/status', { headers: { ...headers, 'If-Match': '"' + publication.version + '"' }, data: { status: publication.status === 'review' ? 'draft' : 'archived' } })
      expect(result.ok()).toBe(true)
      publication = (await result.json()).publication
    }
    const removed = await request.delete('/api/publications/' + id, { headers: { ...headers, 'If-Match': '"' + publication.version + '"' } })
    expect(removed.status()).toBe(204)
  } finally { await request.post('/api/users/logout', { headers, data: {} }) }
}

test('author writes all blocks; admin returns, approves and archives; public visibility follows real state', async ({ page, browser, request }, testInfo) => {
  test.setTimeout(180000)
  let id
  const adminContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', viewport: page.viewportSize() })
  const visitorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', viewport: page.viewportSize() })
  const admin = await adminContext.newPage(), visitor = await visitorContext.newPage()
  const errors = [], requests = []
  for (const surface of [page, admin, visitor]) {
    surface.on('pageerror', (error) => errors.push(error.message))
    surface.on('request', (item) => { if (item.resourceType() === 'fetch') requests.push(new URL(item.url())) })
  }
  try {
    await login(page)
    id = await create(page)
    const title = 'Cuaderno de prueba ' + id.slice(0, 8)
    await page.getByLabel('Título', { exact: true }).fill(title)
    await page.getByLabel('Resumen', { exact: true }).fill('Una publicación sintética para comprobar el recorrido completo del editor y su revisión.')
    await page.getByLabel('Tipo de publicación', { exact: true }).selectOption('Guía')
    await page.getByLabel('Categoría', { exact: true }).selectOption('Escritura')
    await page.getByLabel('Etiquetas', { exact: true }).fill('prueba, cuaderno')
    await page.getByLabel('Archivo de portada').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })
    await expect(page.getByRole('alert')).toContainText('JPEG, PNG o WebP')
    const image = { name: 'editor.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#717168' } }).png().toBuffer() }
    await page.getByLabel('Archivo de portada').setInputFiles(image)
    await expect(page.getByRole('button', { name: 'Cambiar portada' })).toBeEnabled()
    await page.getByLabel('Descripción de la portada').fill('Superficie gris de prueba')
    await page.getByRole('button', { name: 'Añadir texto', exact: true }).click()
    await page.getByLabel('Texto del bloque 1').fill('Este párrafo se conserva en Firestore después de cerrar y abrir el editor.')
    await page.getByRole('button', { name: 'Añadir encabezado', exact: true }).click()
    await page.getByLabel('Encabezado del bloque 2').fill('El orden de las ideas')
    await page.getByRole('button', { name: 'Añadir lista', exact: true }).click()
    await page.getByLabel('Elementos de la lista, uno por línea').fill('Primera idea\nSegunda idea')
    await page.getByLabel('Lista numerada').check()
    await page.getByRole('button', { name: 'Añadir cita', exact: true }).click()
    await page.getByLabel('Cita del bloque 4').fill('Escribir también es volver a leer.')
    await page.getByLabel('Autoría o fuente de la cita').fill('Texto sintético de esta prueba')
    await page.getByRole('button', { name: 'Añadir imagen', exact: true }).click()
    await page.getByLabel('Archivo de imagen del bloque 5').setInputFiles(image)
    await expect(page.getByRole('button', { name: 'Cambiar imagen del bloque 5' })).toBeEnabled()
    await page.getByLabel('Descripción de la imagen', { exact: true }).fill('Segunda superficie gris de prueba')
    await page.getByLabel('Pie de imagen').fill('Imagen generada para verificar la subida.')
    await saved(page)
    await page.reload()
    await expect(page.locator('.editor-block')).toHaveCount(5)
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue(title)
    await expect(page.getByLabel('Lista numerada')).toBeChecked()
    await expect.poll(() => page.getByRole('img', { name: 'Superficie gris de prueba', exact: true }).evaluate((element) => element.naturalWidth)).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Eliminar bloque 5', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '¿Eliminar este bloque?' }).getByRole('button', { name: 'Cancelar' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('.editor-block')).toHaveCount(5)
    await page.getByRole('button', { name: 'Subir bloque 2', exact: true }).click()
    await expect(page.locator('.editor-block').first().getByRole('heading')).toHaveText('1. Encabezado')
    await saved(page)
    for (const theme of ['light', 'dark']) {
      await page.getByRole('combobox', { name: 'Tema de color' }).selectOption(theme)
      await page.locator('main').focus()
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: testInfo.outputPath('editor-' + theme + '.png'), fullPage: true })
    }
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click()
    await expect(page.locator('.editor-preview ol li')).toHaveCount(2)
    await expect(page.locator('.editor-preview cite')).toHaveText('Texto sintético de esta prueba')
    await expect(page.locator('.editor-preview figure img')).toHaveAttribute('src', /^blob:/)
    await visitor.goto('/article/' + id)
    await expect(visitor.locator('main')).toContainText('404 · No encontrado')
    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click()
    await confirm(page, 'Enviar a revisión')
    await expect(page.locator('.editor-heading .publication-status')).toHaveText('En revisión')
    await page.getByRole('button', { name: 'Volver al editor' }).click()
    await expect(page.getByLabel('Título', { exact: true })).toBeDisabled()
    await login(admin, 'admin')
    await admin.getByRole('link', { name: 'Revisar publicaciones' }).click()
    await admin.getByRole('link', { name: title, exact: true }).click()
    await expect(admin.locator('.editor-preview')).toContainText('El orden de las ideas')
    await admin.getByRole('button', { name: 'Devolver al autor' }).click()
    const reason = 'Añade la procedencia del texto antes de publicar.'
    await admin.getByLabel('Motivo para el autor').fill(reason)
    await admin.getByRole('button', { name: 'Devolver a borrador' }).click()
    await expect(admin.getByRole('status')).toContainText('Publicación devuelta')
    await page.reload()
    await expect(page.locator('.moderation-note')).toContainText(reason)
    await page.getByLabel('Resumen', { exact: true }).fill('Texto sintético original escrito para esta prueba de la aplicación, sin contenido de terceros.')
    await saved(page)
    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click()
    await confirm(page, 'Enviar a revisión')
    await admin.reload()
    await admin.getByRole('button', { name: 'Aprobar publicación' }).click()
    await admin.getByRole('button', { name: 'Aprobar y publicar' }).click()
    await expect(admin.getByRole('status')).toContainText('Estado actualizado: publicada')
    expect((await new AxeBuilder({ page: admin }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    await admin.locator('main').focus()
    await admin.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await admin.screenshot({ path: testInfo.outputPath('moderation-published.png'), fullPage: true })
    await visitor.reload()
    await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(visitor.locator('.article-prose ol li')).toHaveCount(2)
    await expect.poll(() => visitor.locator('.article-prose figure img').evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true)
    const publicMedia = await visitor.locator('.article-prose figure img').getAttribute('src')
    await admin.getByRole('button', { name: 'Archivar publicación' }).click()
    await admin.getByLabel('Motivo para el autor').fill('Prueba concluida: retirar esta publicación sintética.')
    await admin.getByRole('button', { name: 'Confirmar archivo' }).click()
    await expect(admin.getByRole('status')).toContainText('Estado actualizado: archivada')
    await visitor.reload()
    await expect(visitor.locator('main')).toContainText('404 · No encontrado')
    expect((await visitor.request.get(publicMedia)).status()).toBe(404)
    await page.reload()
    await expect(page.locator('.moderation-note')).toContainText('Prueba concluida')
    await page.getByRole('button', { name: 'Recuperar como borrador' }).click()
    await confirm(page, 'Volver a borrador')
    await expect(page.getByLabel('Título', { exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Eliminar publicación', exact: true }).click()
    await confirm(page, 'Eliminar publicación')
    await expect(page).toHaveURL(/\/author$/)
    expect(requests.length).toBeGreaterThan(20)
    expect(requests.every((url) => url.pathname.startsWith('/api/') && url.port === '5173')).toBe(true)
    expect(errors).toEqual([])
  } finally {
    await adminContext.close(); await visitorContext.close()
    await cleanup(request, id)
  }
})

test('autosave preserves typing during a slow save and blocks navigation until the operation finishes', async ({ page, request }) => {
  let id, release
  try {
    await login(page); id = await create(page)
    let signalStarted
    const started = new Promise((resolve) => { signalStarted = resolve })
    const gate = new Promise((resolve) => { release = resolve })
    let intercepted = false
    await page.route('**/api/publications/' + id, async (route) => {
      if (route.request().method() !== 'PUT' || intercepted) return route.continue()
      intercepted = true; signalStarted()
      await gate; await route.continue()
    })
    await page.getByLabel('Título', { exact: true }).fill('Primera versión en camino')
    await started
    await page.getByLabel('Título', { exact: true }).fill('Segunda versión escrita durante el guardado')
    await page.getByRole('link', { name: 'Mis publicaciones', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Hay una operación en curso' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Salir sin guardar' })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Seguir editando' }).click()
    release()
    await saved(page)
    await page.reload()
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Segunda versión escrita durante el guardado')
    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click()
    await confirm(page, 'Enviar a revisión')
    await expect(page.getByRole('alert')).toContainText(/resumen|portada|Completa/)
    await expect(page.locator('.editor-heading .publication-status')).toHaveText('Borrador')
  } finally { release?.(); await page.unrouteAll({ behavior: 'wait' }); await cleanup(request, id) }
})

test('two editor tabs detect version conflicts without overwriting; recovery requires confirmation', async ({ page, context, request }, testInfo) => {
  let id
  const second = await context.newPage()
  try {
    await login(page); id = await create(page)
    await page.getByLabel('Título', { exact: true }).fill('Versión de partida')
    await saved(page)
    await second.goto('/author/publications/' + id)
    await expect(second.getByLabel('Título', { exact: true })).toHaveValue('Versión de partida')
    await page.getByLabel('Título', { exact: true }).fill('Versión guardada por la primera pestaña')
    await saved(page)
    await second.getByLabel('Título', { exact: true }).fill('Mi propuesta local que debe conservarse')
    await expect(second.getByRole('alert')).toContainText(/cambi|versión/i)
    await expect(second.getByLabel('Título', { exact: true })).toHaveValue('Mi propuesta local que debe conservarse')
    const downloadEvent = second.waitForEvent('download')
    await second.getByRole('button', { name: 'Descargar mis cambios' }).click()
    const download = await downloadEvent
    expect(download.suggestedFilename()).toBe('otherbloc-borrador-' + id + '.json')
    await second.getByRole('link', { name: 'Mis publicaciones', exact: true }).click()
    await expect(second.getByRole('dialog', { name: 'Tienes cambios sin guardar' })).toBeVisible()
    await second.keyboard.press('Escape')
    await second.getByRole('button', { name: 'Recargar contenido del servidor' }).click()
    await expect(second.getByRole('dialog', { name: '¿Recuperar la versión del servidor?' })).toBeVisible()
    await expect(second.getByRole('dialog', { name: '¿Recuperar la versión del servidor?' })).toHaveCSS('opacity', '1')
    expect((await new AxeBuilder({ page: second }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    await second.screenshot({ path: testInfo.outputPath('editor-conflict-confirmation.png') })
    await confirm(second, 'Recuperar versión guardada')
    await expect(second.getByLabel('Título', { exact: true })).toHaveValue('Versión guardada por la primera pestaña')
    await saved(second)
    await page.reload()
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Versión guardada por la primera pestaña')
  } finally { await second.close(); await cleanup(request, id) }
})

test('reader cannot enter author or moderation workspaces', async ({ page }) => {
  await login(page, 'reader')
  for (const path of ['/author', '/author/publications/not-allowed', '/admin/publications', '/admin/publications/not-allowed']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'Acceso no permitido' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nueva publicación' })).toHaveCount(0)
  }
})

test('failed saves retain edits and recover; invalid local changes do not prevent confirmed draft deletion', async ({ page, request }) => {
  let id
  try {
    await login(page); id = await create(page)
    const path = '**/api/publications/' + id
    await page.route(path, (route) => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'content_unavailable', message: 'El servicio no está disponible durante esta prueba.' } }) : route.continue())
    await page.getByLabel('Título', { exact: true }).fill('Texto que no debe perderse por un fallo de red')
    await expect(page.getByRole('alert')).toContainText('servicio no está disponible')
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Texto que no debe perderse por un fallo de red')
    await page.unroute(path)
    await page.getByRole('button', { name: 'Guardar ahora', exact: true }).click()
    await saved(page)
    await page.reload()
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Texto que no debe perderse por un fallo de red')
    await page.getByRole('button', { name: 'Añadir texto', exact: true }).click()
    await page.getByLabel('Texto del bloque 1').fill('Bloque que sí se eliminará con confirmación.')
    await saved(page)
    await page.getByRole('button', { name: 'Eliminar bloque 1', exact: true }).click()
    await confirm(page, 'Eliminar bloque')
    await expect(page.locator('.editor-block')).toHaveCount(0)
    await saved(page)
    await page.getByLabel('Etiquetas', { exact: true }).fill('duplicada, duplicada')
    await expect(page.getByRole('alert')).toContainText(/etiquetas/)
    await page.getByRole('button', { name: 'Eliminar publicación', exact: true }).click()
    await confirm(page, 'Eliminar publicación')
    await expect(page).toHaveURL(/\/author$/)
  } finally { await page.unrouteAll({ behavior: 'wait' }); await cleanup(request, id) }
})
