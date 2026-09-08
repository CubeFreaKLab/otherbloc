const { test, expect } = require('@playwright/test')
const { randomUUID } = require('node:crypto')
const { mkdir } = require('node:fs/promises')
const AxeBuilder = require('@axe-core/playwright').default
const evidence = '.project/evidence/header-refinements-2026-09-07'
const saved = (page) => expect(page.locator('.writing-save')).toHaveText('Guardado')

test('theme expands from the icon in both directions without a hover square, and falls back safely', async ({ page, isMobile }) => {
  await mkdir(evidence, { recursive: true })
  await page.addInitScript(() => {
    window.themeAnimations = []
    window.pauseTheme = true
    const animate = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options)
      if (options?.pseudoElement === '::view-transition-new(root)') {
        window.themeAnimations.push({ frames, animation })
        if (window.pauseTheme) { animation.pause(); animation.currentTime = 150 }
      }
      return animation
    }
  })
  await page.goto('/')
  await expect(page.locator('.featured-article')).toBeVisible()
  const button = page.getByRole('button', { name: 'Activar tema oscuro' })
  await expect(page.locator('.session-access')).toBeVisible()
  await expect(page.locator('.account-access')).toHaveCount(0)
  if (!isMobile) await button.hover()
  await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const box = await button.boundingBox()
  await button.click()
  await expect.poll(() => page.evaluate(() => window.themeAnimations.length)).toBe(1)
  const first = await page.evaluate(() => window.themeAnimations[0].frames.clipPath[0])
  expect(first).toBe(`circle(0px at ${box.x + box.width / 2}px ${box.y + box.height / 2}px)`)
  await page.screenshot({ path: evidence + '/tema-circular-' + (isMobile ? 'movil' : 'escritorio') + '.png' })
  await page.evaluate(() => { window.pauseTheme = false; window.themeAnimations[0].animation.finish() })
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition')
  await page.getByRole('button', { name: 'Activar tema claro' }).click()
  await expect.poll(() => page.evaluate(() => window.themeAnimations.length)).toBe(2)
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition')
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Activar tema oscuro' }).click()
  expect(await page.evaluate(() => window.themeAnimations.length)).toBe(0)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => { document.startViewTransition = undefined })
  await page.getByRole('button', { name: 'Activar tema claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('one responsive header hides downward, slides back upward, and stays accessible with menu or keyboard focus', async ({ page, isMobile }) => {
  await page.goto('/')
  const header = page.locator('.site-header')
  await expect(page.locator('.featured-article')).toBeVisible()
  await page.locator('main').focus()
  await page.evaluate(() => scrollTo({ top: 700, behavior: 'instant' }))
  await expect(header).toHaveAttribute('data-collapsed', 'true')
  await expect.poll(() => header.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThan(1)
  await page.evaluate(() => scrollBy({ top: -90, behavior: 'instant' }))
  await expect(header).toHaveAttribute('data-collapsed', 'false')
  await expect.poll(() => header.evaluate((node) => Math.abs(node.getBoundingClientRect().top))).toBeLessThan(1)
  if (isMobile) {
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await page.evaluate(() => scrollBy({ top: 90, behavior: 'instant' }))
    await expect(header).toHaveAttribute('data-collapsed', 'false')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeFocused()
  }
  await page.locator('.session-access').focus()
  await expect(page.locator('.session-access')).toBeInViewport()
  await expect(page.locator('.session-access')).toHaveCSS('outline-style', 'solid')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await header.evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThan(.001)
  await page.locator('main').focus()
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  for (const width of [320, 390, 489, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('signed-in plus creates one own draft, cover is directly discoverable, resize preserves the title and navigation protects edits', async ({ page, request, isMobile }) => {
  test.setTimeout(90000)
  const email = 'header-' + randomUUID() + '@example.test', password = 'Una nota local para probar la cabecera 2026'
  let id, releaseCreation
  const created = [], errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/publications') created.push(request.postDataJSON().id) })
  try {
    await page.goto('/register')
    await page.getByLabel('Nombre', { exact: true }).fill('Marina Flores')
    await page.getByLabel('Correo electrónico').fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
    await expect(page.locator('.account-access__initials')).toHaveText('MF')
    await expect(page.locator('.account-avatar__initial')).toHaveText('MF')
    await page.locator('.write-access').focus()
    await page.keyboard.press('Enter')
    const prose = page.getByRole('textbox', { name: 'Texto de la publicación' })
    await expect(prose).toBeVisible()
    id = new URL(page.url()).pathname.split('/').pop()
    expect(created).toEqual([id])
    const title = 'Una ciudad para caminar despacio y encontrar historias en las cosas que siempre estuvieron cerca'
    await page.getByLabel('Título', { exact: true }).fill(title)
    await prose.fill('Este cuaderno empieza con una caminata. Con una mirada atenta, las calles de siempre también pueden contarnos algo nuevo.')
    await page.getByRole('button', { name: 'Añadir portada', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Subir portada', exact: true })).toBeInViewport()
    await page.getByLabel('Archivo de portada').setInputFiles('frontend/public/images/ciudad.webp')
    await expect(page.getByRole('button', { name: 'Cambiar portada', exact: true })).toBeEnabled()
    await page.getByLabel('Descripción de la portada').fill('Una calle de Sucre con fachadas blancas y montañas al fondo')
    await page.getByRole('button', { name: 'Cerrar detalles' }).click()
    await saved(page); await page.reload()
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue(title)
    await expect.poll(() => page.locator('.writing-cover').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true)
    const viewport = page.viewportSize()
    for (const width of [1440, 1100, 1280, 1440, 320, 489, 768, viewport.width]) {
      await page.setViewportSize({ width, height: viewport.height })
      await expect.poll(() => page.getByLabel('Título', { exact: true }).evaluate((node) => node.scrollHeight - node.clientHeight)).toBeLessThan(2)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const overlaps = await page.locator('.writing-header').evaluate((node) => {
        const controls = [...node.querySelectorAll('a, button')].map((element) => ({ label: element.getAttribute('aria-label') || element.textContent, rect: element.getBoundingClientRect() })).filter(({ rect }) => rect.width && rect.height)
        return controls.flatMap((a, i) => controls.slice(i + 1).filter((b) => Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1 && Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 1).map((b) => [a.label, b.label]))
      })
      expect(overlaps).toEqual([])
    }
    await page.getByLabel('Título', { exact: true }).fill('La ciudad también se escribe a pie')
    await saved(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const theme of ['claro', 'oscuro']) {
      if (theme === 'oscuro') await page.getByRole('button', { name: 'Activar tema oscuro' }).click()
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
      await page.locator('main').focus()
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
      await mkdir(evidence, { recursive: true })
      await page.screenshot({ path: evidence + '/editor-portada-' + (isMobile ? 'movil-' : '') + theme + '.png', fullPage: true })
    }
    const header = page.locator('.writing-header')
    await page.evaluate(() => scrollTo({ top: 500, behavior: 'instant' }))
    await expect(header).toHaveAttribute('data-collapsed', 'true')
    await page.evaluate(() => scrollBy({ top: -60, behavior: 'instant' }))
    await expect(header).toHaveAttribute('data-collapsed', 'false')
    await page.route('**/api/publications/' + id, (route) => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: 'content_unavailable', message: 'No se pudo guardar. Inténtalo de nuevo.' } }) : route.continue())
    await prose.fill('Mi texto todavía no debe desaparecer.')
    await page.getByRole('link', { name: 'Escribir una nota', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Seguir editando' }).click()
    expect(created).toEqual([id])
    await expect(prose).toHaveText('Mi texto todavía no debe desaparecer.')
    await page.unrouteAll({ behavior: 'wait' })
    await page.getByRole('button', { name: /Guardar ahora|Reintentar/, exact: true }).click(); await saved(page)
    let started, delivered
    const waiting = new Promise((resolve) => { started = resolve }), delivery = new Promise((resolve) => { delivered = resolve }), gate = new Promise((resolve) => { releaseCreation = resolve })
    await page.route('**/api/publications', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      const response = await route.fetch(); started(); await gate; await route.fulfill({ response }); delivered()
    })
    await page.locator('.write-access').click(); await waiting
    await page.locator('.site-header__brand').click()
    await expect(page).toHaveURL(/\/$/)
    releaseCreation(); await delivery
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await expect(page).toHaveURL(/\/$/)
    expect(created).toHaveLength(2)
    expect(errors).toEqual([])
  } finally {
    releaseCreation?.()
    await page.unrouteAll({ behavior: 'wait' })
    if (created.length) {
      const login = await request.post('/api/users/login', { headers: { 'X-Otherbloc-Request': '1' }, data: { email, password } })
      const headers = { 'X-Otherbloc-Request': '1', Authorization: 'Bearer ' + (await login.json()).accessToken }
      for (const ownId of created) {
        const current = (await (await request.get('/api/publications/' + ownId, { headers })).json()).publication
        if (current) expect((await request.delete('/api/publications/' + ownId, { headers: { ...headers, 'If-Match': '"' + current.version + '"' } })).status()).toBe(204)
      }
      await request.post('/api/users/logout', { headers, data: {} })
    }
  }
})
