const { test, expect } = require('@playwright/test')

async function observeTransitions(page) {
  await page.addInitScript(() => {
    window.routeTransitions = []
    const native = document.startViewTransition?.bind(document)
    if (!native) return
    const snapshot = () => ({
      loading: Boolean(document.querySelector('main [aria-busy="true"]')),
      covers: [...document.querySelectorAll('img')].filter((node) => getComputedStyle(node).viewTransitionName === 'reading-cover').map((node) => ({ loaded: node.complete && node.naturalWidth > 0, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })),
    })
    document.startViewTransition = (update) => {
      const record = { mode: document.documentElement.dataset.themeTransition ? 'theme' : document.documentElement.dataset.routeMotion, before: snapshot() }
      window.routeTransitions.push(record)
      const transition = native(async () => { await update(); record.after = snapshot() })
      transition.ready.then(() => {
        record.ready = true
        record.animations = document.getAnimations().filter((animation) => animation.effect?.pseudoElement?.startsWith('::view-transition')).map((animation) => ({ target: animation.effect.pseudoElement, duration: animation.effect.getTiming().duration }))
        if (window.pauseRouteMotion && record.mode === 'reading') {
          window.pausedRouteAnimations = document.getAnimations().filter((animation) => animation.effect?.pseudoElement?.startsWith('::view-transition'))
          // Every animation shares one timeline instant, not its individual midpoint.
          for (const animation of window.pausedRouteAnimations) { animation.pause(); animation.currentTime = 160 }
        }
      }).catch((error) => { record.error = error.name })
      transition.finished.then(() => { record.finished = true })
      return transition
    }
  })
}

test('reading transitions do not scale thumbnails in either direction', async ({ page }, testInfo) => {
  await observeTransitions(page)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const theme of ['light', 'dark']) {
    await page.goto('/')
    await expect(page.locator('.featured-article')).toBeVisible()
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Activar tema oscuro' : 'Activar tema claro' }).click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition')
    const source = page.locator('.featured-article .text-link')
    await source.scrollIntoViewIfNeeded()
    await source.focus()
    await page.evaluate(() => { window.pauseRouteMotion = true })
    await source.click()
    await expect(page).toHaveURL(/\/article\/leer-sin-prisa$/)
    await expect.poll(() => page.evaluate(() => window.routeTransitions.at(-1)?.ready)).toBe(true)
    const forward = await page.evaluate(() => window.routeTransitions.at(-1))
    expect(forward.mode).toBe('reading')
    expect(forward.before.covers).toHaveLength(0)
    expect(forward.after.covers).toHaveLength(1)
    expect(forward.after.covers[0].loaded).toBe(true)
    expect(forward.after.loading).toBe(false)
    expect(forward.animations.some((animation) => animation.target === '::view-transition-group(reading-cover)')).toBe(false)
    expect(forward.animations.some((animation) => animation.target === '::view-transition-new(reading-cover)' && animation.duration === 320)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('reading-continuity-' + theme + '.png') })
    await page.evaluate(() => { window.pauseRouteMotion = false; for (const animation of window.pausedRouteAnimations) animation.play() })
    await expect.poll(() => page.evaluate(() => window.routeTransitions.at(-1)?.finished)).toBe(true)
    await expect(page.locator('main')).toHaveCSS('view-transition-name', 'none')
    await expect(page.locator('.article-prose')).toBeVisible()
    await page.goBack()
    await expect(source).toBeFocused()
    await expect.poll(() => page.evaluate(() => window.routeTransitions.at(-1)?.finished)).toBe(true)
    const back = await page.evaluate(() => window.routeTransitions.at(-1))
    expect(back.mode).toBe('reading')
    expect(back.ready).toBe(true)
    expect(back.before.covers).toHaveLength(1)
    expect(back.after.covers).toHaveLength(0)
    await expect(page.locator('.featured-article__image')).toHaveAttribute('data-revealed', 'false')
    await expect(page.locator('.featured-article__image .reading-thumbnail__grey')).toHaveCSS('transform', 'none')
    expect(errors).toEqual([])
  }
})

test('main destinations fade, private navigation reverses, and theme toggles without an extra route transition', async ({ page }) => {
  await observeTransitions(page)
  await page.goto('/')
  await expect(page.locator('.featured-article')).toBeVisible()
  await page.locator('footer').getByRole('link', { name: 'Todas las publicaciones', exact: true }).click()
  await expect(page).toHaveURL(/\/explore$/)
  await expect.poll(() => page.evaluate(() => window.routeTransitions.at(-1)?.finished)).toBe(true)
  expect(await page.evaluate(() => window.routeTransitions.at(-1).mode)).toBe('fade')
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(process.env.SEED_READER_EMAIL)
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env.SEED_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByLabel('Nombre público')).toBeVisible()
  await page.locator('main').getByRole('link', { name: 'Publicaciones guardadas', exact: true }).click()
  await expect(page.locator('main h1')).toHaveText('Publicaciones guardadas')
  await expect.poll(() => page.evaluate(() => window.routeTransitions.at(-1)?.finished)).toBe(true)
  expect(await page.evaluate(() => window.routeTransitions.at(-1).mode)).toBe('forward')
  await page.locator('main').getByRole('link', { name: 'Mi cuenta', exact: true }).click()
  await expect(page.getByLabel('Nombre público')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.routeTransitions.at(-1)?.finished)).toBe(true)
  expect(await page.evaluate(() => window.routeTransitions.at(-1).mode)).toBe('backward')
  const beforeTheme = await page.evaluate(() => window.routeTransitions.length)
  await page.getByRole('button', { name: 'Activar tema oscuro' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => window.routeTransitions.length)).toBe(beforeTheme)
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
})

test('reduced motion and browsers without view transitions retain actual navigation', async ({ page }) => {
  await observeTransitions(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.featured-article .text-link').click()
  await expect(page.locator('.article-prose')).toBeVisible()
  expect(await page.evaluate(() => window.routeTransitions)).toHaveLength(0)
  await expect(page.locator('main')).toHaveCSS('view-transition-name', 'none')
  await page.goBack()
  await expect(page.locator('.featured-article .text-link')).toBeFocused()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.featured-article .text-link').click()
  await expect(page).toHaveURL(/\/article\/leer-sin-prisa$/)
  await expect.poll(() => page.evaluate(() => window.routeTransitions.at(-1)?.finished)).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goBack()
  await expect(page.locator('.featured-article .text-link')).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.routeTransitions.at(-1)?.finished)).toBe(true)
  const reducedReturn = await page.evaluate(() => window.routeTransitions.at(-1))
  expect(reducedReturn.mode).toBe('none')
  expect(reducedReturn.animations).toHaveLength(0)
  await expect(page.locator('main')).toHaveCSS('view-transition-name', 'none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => { document.startViewTransition = undefined })
  await page.goto('/')
  await page.locator('.featured-article .text-link').click()
  await expect(page.locator('.article-prose')).toBeVisible()
  expect(await page.evaluate(() => window.routeTransitions)).toHaveLength(0)
})

test('an interrupted real reading request never freezes the old page or commits its late result', async ({ page }) => {
  await observeTransitions(page)
  await page.goto('/')
  await expect(page.locator('.featured-article')).toBeVisible()
  let release, completed
  const gate = new Promise((resolve) => { release = resolve })
  const delivered = new Promise((resolve) => { completed = resolve })
  await page.route('**/api/interactions', async (route) => {
    const response = await route.fetch()
    await gate
    try { await route.fulfill({ response }) } finally { completed() }
  })
  try {
    await page.locator('.featured-article .text-link').click()
    await expect(page.locator('.route-pending')).toBeVisible()
    expect(await page.evaluate(() => window.routeTransitions)).toHaveLength(0)
    await expect(page.locator('.featured-article')).toBeVisible()
    await page.locator('footer').getByRole('link', { name: 'Todas las publicaciones', exact: true }).click()
    await expect(page).toHaveURL(/\/explore$/)
    release(); await delivered
    await expect(page.locator('.route-pending')).toHaveCount(0)
    await expect(page).toHaveURL(/\/explore$/)
    expect(await page.evaluate(() => window.routeTransitions.some((transition) => transition.mode === 'reading'))).toBe(false)
  } finally { release() }
})

test('a stalled cover decoder reaches its budget and reading remains usable with a fade', async ({ page }) => {
  await observeTransitions(page)
  await page.goto('/')
  const cover = page.locator('.featured-article__image .reading-thumbnail__grey')
  await expect.poll(() => cover.evaluate((node) => node.complete && node.naturalWidth > 0)).toBe(true)
  // Explicit decoder fault; publication and interaction responses still come from real services.
  await page.evaluate(() => { HTMLImageElement.prototype.decode = () => new Promise(() => {}) })
  await page.locator('.featured-article .text-link').click()
  await expect(page.locator('.route-pending')).toBeVisible()
  await expect(page.locator('.article-prose')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.routeTransitions.at(-1)?.finished)).toBe(true)
  const transition = await page.evaluate(() => window.routeTransitions.at(-1))
  expect(transition.mode).toBe('fade')
  expect(transition.ready).toBe(true)
  expect(transition.before.covers).toHaveLength(0)
  expect(transition.after.covers).toHaveLength(0)
  await expect(page.getByRole('button', { name: 'Compartir', exact: true })).toBeEnabled()
})
