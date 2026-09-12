const { test, expect } = require('@playwright/test')
const AxeBuilder = require('@axe-core/playwright').default

test('published Firestore content and Storage images render through the gateway in both themes', async ({ page }, testInfo) => {
  const dataRequests = [], errors = []
  page.on('request', (request) => { if (request.resourceType() === 'fetch') dataRequests.push(new URL(request.url())) })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.featured-article h1')).toHaveText('Leer también es una forma de quedarse.')
  await expect(page.locator('main article')).toHaveCount(7)
  const cover = page.locator('.featured-article__image .reading-thumbnail__grey')
  await expect(cover).toHaveAttribute('src', /\/api\/publications\/leer-sin-prisa\/media\//)
  await expect.poll(() => cover.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true)
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Activar tema oscuro' : 'Activar tema claro' }).click()
    // Audit a committed theme, not a mixture of styles captured during its update.
    // These assertions also catch a genuine unreadable dark/light theme.
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await expect(page.locator('body')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(23, 23, 22)' : 'rgb(246, 245, 243)')
    await expect(page.locator('.featured-article h1')).toHaveCSS('color', theme === 'dark' ? 'rgb(246, 245, 243)' : 'rgb(0, 0, 0)')
    await page.locator('main').focus()
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('persisted-home-' + theme + '.png'), fullPage: true })
  }
  await page.locator('.featured-article .text-link').click()
  await expect(page.locator('.article-prose')).toContainText('Abrir un libro puede parecer un gesto pequeño.')
  await expect(page).toHaveTitle('Leer también es una forma de quedarse. — otherbloc')
  await page.reload()
  await expect(page.locator('.article-prose')).toContainText('Encontrar el propio ritmo')
  await page.locator('.article-page__meta').getByRole('link', { name: 'Elena Rivas' }).click()
  await expect(page.locator('main article')).toHaveCount(2)
  await expect(page.locator('main')).toContainText('Perfil de demostración')
  await page.screenshot({ path: testInfo.outputPath('persisted-profile.png'), fullPage: true })
  expect(dataRequests.length).toBeGreaterThan(5)
  expect(dataRequests.every((address) => address.port === '5173' && address.pathname.startsWith('/api/'))).toBe(true)
  expect(errors).toEqual([])
})

test('real search and filters survive reload, and unavailable content shows a recoverable error', async ({ page }, testInfo) => {
  await page.goto('/explore')
  await expect(page.locator('main article')).toHaveCount(7)
  await page.locator('#explore-search').fill('maria')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.locator('main').getByRole('status')).toHaveText('2 publicaciones')
  await page.getByRole('combobox', { name: 'Tipo de publicación' }).selectOption('Guía')
  await expect(page.locator('main').getByRole('status')).toHaveText('1 publicación')
  await page.reload()
  await expect(page.locator('main').getByRole('status')).toHaveText('1 publicación')
  await page.getByRole('link', { name: 'Del apunte al primer borrador.', exact: true }).click()
  await expect(page.locator('.article-prose li')).toHaveCount(3)
  await page.screenshot({ path: testInfo.outputPath('persisted-article.png'), fullPage: true })
  for (const path of ['/article/no-existe', '/profile/no-existe']) {
    await page.goto(path)
    await expect(page.locator('main')).toContainText('404 · No encontrado')
  }
  // Explicit fault injection only; success/retry responses come from the real gateway.
  await page.route('**/api/publications?limit=7', (route) => route.fulfill({ status: 503, json: { error: 'content_unavailable', message: 'Contenido no disponible durante esta prueba.' } }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Contenido no disponible durante esta prueba.')
  await expect(page.locator('main article')).toHaveCount(0)
  await page.unroute('**/api/publications?limit=7')
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(page.locator('main article')).toHaveCount(7)
})
