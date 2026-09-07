const { test, expect } = require('@playwright/test')
const AxeBuilder = require('@axe-core/playwright').default

// Visual regression isolates Users responses. Real persistence journeys use test:e2e.
test.beforeEach(async ({ page }) => {
  const { authors } = await import('../../frontend/src/data/articles.js')
  await page.route('**/api/users/**', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop()
    const author = authors.find((item) => item.id === id)
    if (id === 'refresh') return route.fulfill({ status: 401, json: { error: 'invalid_session' } })
    if (id === 'register') return route.fulfill({ status: 503, json: { error: 'users_unavailable', message: 'No se pudo completar la operación. Inténtalo de nuevo.' } })
    return route.fulfill(author ? { status: 200, json: { user: { ...author, biography: author.bio, role: 'author' } } } : { status: 404, json: { error: 'user_not_found' } })
  })
})

test('home has one editorial heading, actual navigation, and no removed newsletter', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main h1')).toHaveText('Leer también es una forma de quedarse.')
  await expect(page.locator('.masthead, .newsletter')).toHaveCount(0)
  await expect(page.locator('main article')).toHaveCount(7)
  await page.getByRole('link', { name: 'Explorar todas' }).click()
  await expect(page).toHaveURL(/\/explore$/)
  await expect(page.locator('main')).toBeFocused()
})

test('search and combined filters survive reload; clear and empty states work', async ({ page }) => {
  await page.goto('/explore')
  await page.locator('#explore-search').fill('maria')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('2 publicaciones')
  await page.getByRole('combobox', { name: 'Tipo de publicación' }).selectOption('Guía')
  await expect(page.getByRole('status')).toHaveText('1 publicación')
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('1 publicación')
  await page.locator('#explore-search').fill('no-existe-123')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No hay resultados' })).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(page.locator('main article')).toHaveCount(7)
})

test('article and profile resolve their own content and return 404 for missing resources', async ({ page }) => {
  await page.goto('/article/ciudad-a-pie')
  await expect(page.locator('.article-prose')).toContainText('el recorrido empieza sin una lista de lugares')
  await expect(page.locator('.article-page__meta')).toContainText('Mateo Salinas')
  await page.locator('.article-page__meta').getByRole('link', { name: 'Mateo Salinas' }).click()
  await expect(page.locator('main article')).toHaveCount(2)
  for (const path of ['/article/no-existe', '/profile/no-existe', '/no-existe']) {
    await page.goto(path)
    await expect(page.locator('main')).toContainText('404 · No encontrado')
  }
})

test('light, dark and system persist; reduced motion uses the immediate alternative', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('combobox', { name: 'Tema de color' }).selectOption('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition')
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Tema de color' })).toHaveValue('light')
  await page.getByRole('combobox', { name: 'Tema de color' }).selectOption('system')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('access composition is labeled, keyboard usable and never fakes an account', async ({ page, isMobile }) => {
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'Haz espacio para tus ideas.' })).toBeVisible()
  await expect(page.locator('.access-photo')).toBeVisible({ visible: !isMobile })
  await page.getByLabel('Nombre', { exact: true }).fill('Prueba Editorial')
  await page.getByLabel('Correo electrónico').fill('prueba@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('Una frase de prueba segura')
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo completar la operación')
  await page.getByRole('link', { name: 'Inicia sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/login\?returnTo=/)
  await page.getByLabel('Correo electrónico').focus()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused()
})

for (const theme of ['light', 'dark']) {
  test('screens stay inside the viewport with accessible contrast in ' + theme, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    for (const path of ['/', '/explore', '/article/primer-borrador', '/profile/elena-rivas', '/login', '/register', '/no-existe']) {
      await page.goto(path)
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(accessibility.violations).toEqual([])
    }
  })
}

test('image focus reveals actual color without shifting the grid; touch uses color directly', async ({ page, isMobile }) => {
  await page.goto('/')
  const picture = page.locator('.featured-article__image img')
  const before = await picture.boundingBox()
  if (isMobile) await expect(picture).toHaveCSS('filter', 'grayscale(0)')
  else {
    await expect(picture).toHaveCSS('filter', 'grayscale(1)')
    await page.locator('.featured-article .text-link').focus()
    await expect(picture).toHaveCSS('filter', 'grayscale(0)')
    const container = await page.locator('.featured-article__image').boundingBox()
    expect(container.width).toBeCloseTo(before.width + 1, 0)
  }
})

test('narrow phone and tablet breakpoints do not overflow', async ({ page }) => {
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/', '/login', '/register', '/explore']) {
      await page.goto(route)
      await page.locator('main').waitFor()
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
})
