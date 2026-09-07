const { test, expect } = require('@playwright/test')
const AxeBuilder = require('@axe-core/playwright').default

// Visual regression explicitly fixtures domain responses; test:e2e proves persistence.
test.beforeEach(async ({ page }) => {
  const { articles, authors, categories, publicationTypes, filterArticles } = await import('../../frontend/src/data/articles.js')
  await page.route('**/api/users/**', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop()
    const author = authors.find((item) => item.id === id)
    if (id === 'refresh') return route.fulfill({ status: 401, json: { error: 'invalid_session' } })
    if (id === 'register') return route.fulfill({ status: 503, json: { error: 'users_unavailable', message: 'No se pudo completar la operación. Inténtalo de nuevo.' } })
    if (id === 'profiles') return route.fulfill({ status: 200, json: { items: authors.map((item) => ({ ...item, biography: item.bio, role: 'author' })) } })
    return route.fulfill(author ? { status: 200, json: { user: { ...author, biography: author.bio, role: 'author' } } } : { status: 404, json: { error: 'user_not_found' } })
  })
  const fixture = (item) => ({ ...item, id: item.slug, status: 'published', version: 4, readingMinutes: 1, image: '/api/publications/' + item.slug + '/media/cover', blocks: item.blocks.map((block) => ({ ...block, ...(block.type === 'heading' ? { level: 2 } : {}) })) })
  await page.route('**/api/interactions', async (route) => {
    const { operationName, variables } = route.request().postDataJSON()
    if (operationName !== 'ReadingPublication') return route.fulfill({ status: 400, json: { errors: [{ message: 'Unsupported visual fixture operation', extensions: { code: 'BAD_USER_INPUT' } }] } })
    const article = articles.find((item) => item.slug === variables.id)
    if (!article) return route.fulfill({ json: { data: { publication: null }, errors: [{ message: 'No se encontró la publicación.', extensions: { code: 'NOT_FOUND' } }] } })
    const author = authors.find((item) => item.id === article.authorId)
    const publication = { ...fixture(article), publishedAt: article.date + 'T12:00:00.000Z', coverWidth: null, coverHeight: null,
      author: { ...author, biography: author.bio, role: 'author', avatarUrl: null, demo: true },
      blocks: fixture(article).blocks.map((block, index) => ({ id: 'fixture-' + index, text: null, level: null, items: null, ordered: null, attribution: null, assetId: null, alt: null, caption: null, url: null, ...block })),
      comments: { items: [], nextCursor: null }, commentCount: 0, reactions: { active: false, count: 0 }, saved: false, followingAuthor: false,
    }
    return route.fulfill({ json: { data: { publication } } })
  })
  await page.route('**/api/publications**', async (route) => {
    const address = new URL(route.request().url()), params = address.searchParams
    const id = address.pathname.split('/')[3]
    if (id === 'options') return route.fulfill({ status: 200, json: { types: publicationTypes, categories } })
    const article = articles.find((item) => item.slug === id)
    if (article && address.pathname.includes('/media/')) return route.fulfill({ status: 200, contentType: 'image/webp', path: require('node:path').join(__dirname, '../../frontend/public', article.image) })
    if (id) return route.fulfill(article ? { status: 200, json: { publication: fixture(article) } } : { status: 404, json: { error: 'publication_not_found' } })
    const items = filterArticles(articles, { category: params.get('category'), type: params.get('type'), query: params.get('q') ?? '' }).filter((item) => !params.get('authorId') || item.authorId === params.get('authorId'))
    return route.fulfill({ status: 200, json: { items: items.slice(0, Number(params.get('limit') ?? 12)).map(fixture), nextCursor: null } })
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

test('Latin reading fonts keep original metrics and load the complete face for other alphabets', async ({ page }) => {
  const fonts = []
  page.on('response', (response) => { if (response.url().includes('/fonts/')) fonts.push(new URL(response.url()).pathname) })
  await page.goto('/')
  await expect(page.locator('main h1')).toHaveText('Leer también es una forma de quedarse.')
  await page.evaluate(() => document.fonts.ready)
  expect(fonts).toContain('/fonts/georgia-regular-latin.woff2')
  expect(fonts).not.toContain('/fonts/georgia-regular.woff2')

  const results = await page.evaluate(async () => {
    const sample = 'Árbol, escritura y café: ñ, Ü, ¿por qué? «AV» — 19,50 €; a\u0301, e\u0301, o\u0308.'
    const context = document.createElement('canvas').getContext('2d')
    const variants = [['regular', 'normal', '400'], ['bold', 'normal', '700'], ['italic', 'italic', '400'], ['bold-italic', 'italic', '700']]
    const results = []
    for (const [file, style, weight] of variants) {
      await document.fonts.load(`${style} ${weight} 24px "otherbloc Georgia"`, sample)
      context.font = `${style} ${weight} 24px "otherbloc Georgia"`
      const actual = context.measureText(sample).width
      const family = 'Original verification ' + file
      const face = new FontFace(family, `url(/fonts/georgia-${file}.woff2)`, { style, weight })
      document.fonts.add(await face.load())
      context.font = `${style} ${weight} 24px "${family}"`
      results.push({ file, actual, original: context.measureText(sample).width })
      document.fonts.delete(face)
    }
    // This range is deliberately outside Latin; the original CSS face must remain available.
    const full = await document.fonts.load('400 24px "otherbloc Georgia"', 'Ελληνικά Привет')
    return { results, full: full.map((face) => ({ family: face.family, status: face.status, range: face.unicodeRange })) }
  })
  for (const { actual, original } of results.results) expect(actual).toBeCloseTo(original, 5)
  expect(results.full.some((face) => face.status === 'loaded' && face.range === 'U+0-10FFFF')).toBe(true)
})

test('brand images reserve their original aspect ratio before the SVG arrives', async ({ page }) => {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  await page.route('**/brand/otherbloc-logo-black.svg', async (route) => { await gate; await route.continue() })
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main h1')).toHaveText('Leer también es una forma de quedarse.')
    const before = await page.locator('.brand-logo').evaluateAll((images) => images.map((image) => ({ width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height, complete: image.complete })))
    expect(before).toHaveLength(2)
    for (const image of before) { expect(image.complete).toBe(false); expect(image.width / image.height).toBeCloseTo(1532 / 291, 2) }
    release()
    await expect.poll(() => page.locator('.brand-logo').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true)
    const after = await page.locator('.brand-logo').evaluateAll((images) => images.map((image) => ({ width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height })))
    expect(after).toEqual(before.map(({ width, height }) => ({ width, height })))
  } finally { release() }
})

test('search and combined filters survive reload; clear and empty states work', async ({ page }) => {
  await page.goto('/explore')
  await page.locator('#explore-search').fill('maria')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.locator('main').getByRole('status')).toHaveText('2 publicaciones')
  await page.getByRole('combobox', { name: 'Tipo de publicación' }).selectOption('Guía')
  await expect(page.locator('main').getByRole('status')).toHaveText('1 publicación')
  await page.reload()
  await expect(page.locator('main').getByRole('status')).toHaveText('1 publicación')
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
  await expect(page.getByRole('heading', { name: 'Qué bueno volver a leerte.' })).toBeVisible()
  await page.getByLabel('Correo electrónico').focus()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused()
})

for (const theme of ['light', 'dark']) {
  test('screens stay inside the viewport with accessible contrast in ' + theme, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    for (const path of ['/', '/explore', '/article/primer-borrador', '/profile/elena-rivas', '/login', '/register', '/no-existe']) {
      await page.goto(path)
      await page.locator('main').waitFor()
      await expect(page.locator('.publication-loading')).toHaveCount(0)
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
  await expect(picture).toBeVisible()
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
      await expect(page.locator('.publication-loading')).toHaveCount(0)
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
})
