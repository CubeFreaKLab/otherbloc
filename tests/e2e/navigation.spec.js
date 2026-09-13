const { test, expect } = require('@playwright/test')
const { randomUUID } = require('node:crypto')
const AxeBuilder = require('@axe-core/playwright').default

async function observeExit(page, selector) {
  await page.evaluate((selector) => {
    const node = document.querySelector(selector)
    window.navigationExit = null
    const observer = new MutationObserver(() => {
      if (!node.inert) return
      window.navigationExit = { text: node.textContent, animations: node.getAnimations().length, inert: node.inert }
      observer.disconnect()
    })
    observer.observe(node, { attributes: true, attributeFilter: ['inert'] })
  }, selector)
}

async function login(page, role) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(process.env['SEED_' + role.toUpperCase() + '_EMAIL'])
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env.SEED_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByLabel('Nombre público')).toBeVisible()
}

test('back restores the original reading link and scroll after the actual feed finishes loading', async ({ page }) => {
  await page.goto('/explore')
  const links = page.locator('.article-card h3 a')
  await expect(links).toHaveCount(7)
  const source = links.last()
  await source.scrollIntoViewIfNeeded()
  await source.focus()
  const before = await page.evaluate(() => ({ y: scrollY, href: document.activeElement.getAttribute('href') }))
  await source.click()
  await expect(page.locator('.article-prose')).toBeVisible()
  await page.route('**/api/publications?**', async (route) => {
    const response = await route.fetch()
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.fulfill({ response })
  })
  await page.goBack()
  await expect(page.locator('.publication-loading')).toHaveCount(0)
  await expect(source).toBeFocused()
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before.y, 0)
})

test('a direct reading fragment waits for content and focuses its real section', async ({ page }) => {
  await page.goto('/article/leer-sin-prisa')
  const heading = page.locator('.article-prose h2[id]').first()
  await expect(heading).toBeVisible()
  const fragment = await heading.getAttribute('id')
  await page.goto('/article/leer-sin-prisa#' + fragment)
  await expect(page.locator('#' + fragment)).toBeFocused()
  await expect.poll(() => page.locator('#' + fragment).evaluate((node) => Math.abs(node.getBoundingClientRect().top - parseFloat(getComputedStyle(node).scrollMarginTop)))).toBeLessThan(3)
})

test('mobile menu enters and exits without moving the reading and immediately releases keyboard access', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.featured-article')).toBeVisible()
  const original = await page.locator('main').boundingBox()
  for (const reducedMotion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion })
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    const nav = page.locator('#site-navigation')
    await expect(nav).toHaveCSS('opacity', '1')
    expect((await page.locator('main').boundingBox()).y).toBe(original.y)
    await nav.getByRole('link', { name: 'Ciudad', exact: true }).focus()
    await observeExit(page, '#site-navigation')
    await page.screenshot({ path: testInfo.outputPath('mobile-menu-' + reducedMotion + '.png') })
    await page.keyboard.press('Escape')
    if (reducedMotion === 'no-preference') expect((await page.evaluate(() => window.navigationExit)).animations).toBeGreaterThan(0)
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeFocused()
    await expect(nav).toHaveAttribute('inert', '')
    await expect(nav).toHaveCSS('display', 'none')
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await nav.getByRole('link', { name: 'Ciudad', exact: true }).click()
    await expect(page).toHaveURL(/category=ciudad/)
    await expect(nav).toHaveCSS('display', 'none')
    await page.goto('/')
    await expect(page.locator('.featured-article')).toBeVisible()
  }
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).not.toHaveAttribute('inert')
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
})

test('dialog cancellation retains the outgoing visual but releases focus and pending text immediately', async ({ page }, testInfo) => {
  await page.goto('/register')
  await page.getByLabel('Nombre', { exact: true }).fill('Prueba de navegación')
  await page.getByLabel('Correo electrónico').fill('navigation-' + randomUUID() + '@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('Una navegación de prueba segura 2026')
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByLabel('Biografía', { exact: true })).toBeVisible()
  await page.getByLabel('Biografía', { exact: true }).fill('Texto pendiente que no debe perderse al cancelar.')
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Activar tema oscuro' : 'Activar tema claro' }).click()
    const source = page.getByRole('link', { name: 'Ver perfil público' })
    await source.click()
    const dialog = page.getByRole('dialog', { name: 'Tienes cambios sin guardar' })
    await expect(dialog).toHaveCSS('opacity', '1')
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('navigation-dialog-' + theme + '.png') })
    await observeExit(page, 'dialog')
    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => window.navigationExit !== null)).toBe(true)
    const exit = await page.evaluate(() => window.navigationExit)
    expect(exit.animations).toBeGreaterThan(0)
    expect(exit.text).toContain('Tienes cambios sin guardar')
    await expect(source).toBeFocused()
    await expect(page.locator('dialog')).not.toHaveAttribute('open')
    await expect(page.locator('dialog')).toHaveCSS('display', 'none')
    await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue('Texto pendiente que no debe perderse al cancelar.')
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('link', { name: 'Ver perfil público' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Seguir editando' }).click()
  await expect(page.locator('dialog')).toHaveCSS('display', 'none')
  await page.getByLabel('Biografía', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
})

test('footer follows actual reader author and administrator access and its library link works', async ({ page }) => {
  for (const role of ['reader', 'author', 'admin']) {
    await login(page, role)
    const footer = page.locator('footer')
    await expect(footer.getByRole('link', { name: 'Iniciar sesión', exact: true })).toHaveCount(0)
    await expect(footer.getByRole('link', { name: 'Mis publicaciones', exact: true })).toHaveCount(1)
    await expect(footer.getByRole('link', { name: 'Revisar publicaciones', exact: true })).toHaveCount(role === 'admin' ? 1 : 0)
    await footer.getByRole('link', { name: 'Autores que sigues', exact: true }).click()
    await expect(page.locator('main h1')).toHaveText('Autores que sigues')
    await footer.getByRole('link', { name: 'Mi cuenta', exact: true }).click()
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
  }
})

test('a reader using the keyboard during a delayed return is not pulled away when data arrives', async ({ page }) => {
  await page.goto('/explore')
  await page.locator('.article-card h3 a').last().click()
  await expect(page.locator('.article-prose')).toBeVisible()
  let release
  const responseGate = new Promise((resolve) => { release = resolve })
  await page.route('**/api/publications?**', async (route) => {
    const response = await route.fetch()
    await responseGate
    await route.fulfill({ response })
  })
  await page.goBack()
  await expect(page.locator('.route-pending')).toBeVisible()
  const preference = page.locator('.theme-control')
  await preference.focus()
  await page.keyboard.press('ArrowDown')
  release()
  await expect(page).toHaveURL(/\/explore$/)
  await expect(page.locator('.route-pending')).toHaveCount(0)
  await expect(preference).toBeFocused()
})

test('writing after a slow navigation starts cancels it and retains the unsent comment', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Nombre', { exact: true }).fill('Lectura pendiente')
  await page.getByLabel('Correo electrónico').fill('navigation-' + randomUUID() + '@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('Una navegación de prueba segura 2026')
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByLabel('Nombre público')).toBeVisible()
  await page.goto('/article/leer-sin-prisa')
  const comment = page.getByLabel('Tu comentario', { exact: true })
  await expect(comment).toHaveValue('')
  let release
  const responseGate = new Promise((resolve) => { release = resolve })
  const writes = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/interactions') && request.postDataJSON()?.operationName === 'WriteComment') writes.push(request)
  })
  await page.route('**/api/publications?**', async (route) => {
    const response = await route.fetch()
    await responseGate
    await route.fulfill({ response })
  })
  try {
    await page.getByRole('link', { name: 'Volver a explorar' }).click()
    await expect(page.locator('.route-pending')).toBeVisible()
    await comment.fill('Empecé a escribir mientras se cargaba la otra vista.')
    await expect(page.locator('.route-pending')).toHaveCount(0)
    release()
    await expect(page).toHaveURL(/\/article\/leer-sin-prisa$/)
    await expect(comment).toHaveValue('Empecé a escribir mientras se cargaba la otra vista.')
    expect(writes).toHaveLength(0)
    await comment.fill('')
    await page.unroute('**/api/publications?**')
    await page.getByRole('link', { name: 'Volver a explorar' }).click()
    await expect(page).toHaveURL(/\/explore$/)
  } finally { release() }
})

test('late history cancellation retains the original entries and the new comment focus', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Nombre', { exact: true }).fill('Lectura con historial')
  await page.getByLabel('Correo electrónico').fill('navigation-' + randomUUID() + '@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('Una navegación de prueba segura 2026')
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByLabel('Nombre público')).toBeVisible()
  await page.goto('/explore')
  await page.getByRole('link', { name: 'Leer también es una forma de quedarse.', exact: true }).click()
  const comment = page.getByLabel('Tu comentario', { exact: true })
  await expect(comment).toHaveValue('')
  // Model a completed scroll before Back. Cancelling that Back must not
  // restore this older focus over the comment written while it was pending.
  await page.locator('main').focus()
  await page.evaluate(() => document.dispatchEvent(new Event('scrollend')))
  const original = await page.evaluate(() => ({ key: history.state.key, index: history.state.idx }))
  let release
  const gate = new Promise((resolve) => { release = resolve })
  await page.route('**/api/publications?**', async (route) => { const response = await route.fetch(); await gate; await route.fulfill({ response }) })
  try {
    await page.goBack()
    await expect(page.locator('.route-pending')).toBeVisible()
    await comment.fill('Escribí después de pulsar Atrás.')
    await expect(page.locator('.route-pending')).toHaveCount(0)
    release()
    await expect(page).toHaveURL(/\/article\/leer-sin-prisa$/)
    await expect(comment).toHaveValue('Escribí después de pulsar Atrás.')
    await expect(comment).toBeFocused()
    expect(await page.evaluate(() => ({ key: history.state.key, index: history.state.idx }))).toEqual(original)
    await comment.fill('')
    await page.unroute('**/api/publications?**')
    await page.goBack()
    await expect(page).toHaveURL(/\/explore$/)
    await expect(page.locator('.article-card')).toHaveCount(7)
    await page.goForward()
    await expect(page).toHaveURL(/\/article\/leer-sin-prisa$/)
    await expect(comment).toHaveValue('')
  } finally { release() }
})
