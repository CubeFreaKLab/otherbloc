const { test, expect } = require('@playwright/test')
const AxeBuilder = require('@axe-core/playwright').default

function fixture(now = Date.now()) {
  const group = (items) => ({ items, fetchedAt: now, expiresAt: now + 900000 })
  return {
    weather: group(['La Paz', 'Sucre', 'Santa Cruz', 'Cochabamba', 'Oruro', 'Potosí', 'Tarija', 'Trinidad', 'Cobija'].map((city, index) => ({ city, temperature: 12 + index, code: [0, 2, 3, 45, 61, 75, 95, 55, 0][index], day: index !== 8, observedAt: now }))),
    crypto: group([{ symbol: 'BTC', name: 'Bitcoin', price: 12345.67 }, { symbol: 'ETH', name: 'Ethereum', price: 2345.67 }]),
    headlines: group([{ id: 'leer-sin-prisa', slug: 'leer-sin-prisa', title: 'Leer también es una forma de quedarse.' }]),
  }
}
const active = (page) => page.locator('.bulletin__row:not(.bulletin__row--out)')

test('the bulletin completes each horizontal sequence then descends into prices and real publication links', async ({ page }) => {
  await page.route('**/api/publications/bulletin', (route) => route.fulfill({ json: fixture() }))
  await page.goto('/')
  await expect(page.locator('.featured-article')).toBeVisible()
  await expect(page.locator('.bulletin__stage')).toHaveAttribute('data-section', 'weather')
  await expect(active(page).locator('.bulletin__items:not([aria-hidden]) .bulletin__item')).toHaveCount(9)
  await expect(active(page).locator('.bulletin__viewport')).not.toHaveCSS('mask-image', 'none')
  const travel = active(page).locator('.bulletin__track')
  await expect.poll(() => travel.evaluate((node) => getComputedStyle(node).animationPlayState)).toBe('running')
  const distance = await travel.evaluate((node) => parseFloat(node.style.getPropertyValue('--travel')))
  expect(distance).toBeLessThan(0)
  await travel.evaluate((node) => { const animation = node.getAnimations().find((item) => item.animationName === 'bulletin-travel'); animation.currentTime = animation.effect.getTiming().duration * .8; animation.pause() })
  await expect(active(page).locator('.bulletin__items:not([aria-hidden])').getByText('Cobija', { exact: true })).toBeInViewport()
  await travel.evaluate((node) => node.getAnimations().find((item) => item.animationName === 'bulletin-travel').finish())
  await expect(page.locator('.bulletin__stage')).toHaveAttribute('data-section', 'crypto')
  await expect(active(page).locator('.bulletin__items:not([aria-hidden])').getByText('BTC', { exact: true })).toBeVisible()
  expect(await active(page).locator('.bulletin__track').evaluate((node) => parseFloat(node.style.getPropertyValue('--travel')))).toBeLessThan(0)
  await expect(page.locator('.bulletin__row--out')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('.bulletin__row--out')).toHaveCount(0)
  await active(page).locator('.bulletin__track').evaluate((node) => node.getAnimations().find((item) => item.animationName === 'bulletin-travel').finish())
  await expect(page.locator('.bulletin__stage')).toHaveAttribute('data-section', 'headlines')
  const link = active(page).getByRole('link')
  await link.focus()
  await expect(page.locator('.bulletin')).toHaveAttribute('data-paused', 'true')
  await expect(link).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/article\/leer-sin-prisa$/)
  await expect(page.locator('.article-prose')).toBeVisible()
})

test('visible repeated headlines remain clickable without duplicating the keyboard sequence', async ({ page }) => {
  const response = fixture(); response.weather = null; response.crypto = null
  await page.route('**/api/publications/bulletin', (route) => route.fulfill({ json: response }))
  await page.goto('/')
  await expect(page.locator('.featured-article')).toBeVisible()
  await expect(page.locator('.bulletin__stage')).toHaveAttribute('data-section', 'headlines')
  const row = active(page)
  await expect(row.getByRole('link')).toHaveCount(1)
  await expect.poll(() => row.locator('.bulletin__track').evaluate((node) => node.getAnimations().some((item) => item.animationName === 'bulletin-travel'))).toBe(true)
  await row.locator('.bulletin__track').evaluate((node) => { const animation = node.getAnimations().find((item) => item.animationName === 'bulletin-travel'); animation.currentTime = animation.effect.getTiming().duration * .95; animation.pause() })
  const repeat = row.locator('.bulletin__repeat a')
  await expect(repeat).toHaveAttribute('tabindex', '-1')
  await repeat.click()
  await expect(page).toHaveURL(/\/article\/leer-sin-prisa$/)
  await expect(page.locator('.article-prose')).toBeVisible()
})

test('pause, source attribution, keyboard scrolling, reduced motion and mobile widths remain usable', async ({ page }) => {
  await page.route('**/api/publications/bulletin', (route) => route.fulfill({ json: fixture() }))
  await page.goto('/')
  await expect(page.locator('.bulletin__stage')).toBeVisible()
  await page.getByRole('button', { name: 'Pausar la franja informativa' }).click()
  await page.locator('main').focus()
  await expect(page.locator('.bulletin')).toHaveAttribute('data-paused', 'true')
  await expect(active(page).locator('.bulletin__track')).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: 'Fuentes y actualización de los datos' }).click()
  const sources = page.locator('#bulletin-sources')
  await expect(sources).toBeVisible()
  await expect(sources.getByRole('link', { name: 'Open-Meteo', exact: true })).toHaveAttribute('href', 'https://open-meteo.com/')
  await expect(sources.getByRole('link', { name: 'Kraken', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sources).toBeHidden()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('button', { name: /Reanudar la franja/ })).toHaveCount(0)
  const viewport = active(page).locator('.bulletin__viewport')
  await viewport.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => viewport.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Ver siguiente sección informativa' }).click()
  await expect(page.locator('.bulletin__stage')).toHaveAttribute('data-section', 'crypto')
  await expect(active(page)).toHaveCSS('animation-name', 'none')
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Activar tema oscuro' }).click()
    await expect(active(page).locator('.bulletin__label')).toHaveCSS('color', theme === 'dark' ? 'rgb(169, 169, 163)' : 'rgb(100, 100, 96)')
    const results = await new AxeBuilder({ page }).include('.site-header').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
  }
  for (const width of [320, 390, 489, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.locator('.bulletin__date')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ver siguiente sección informativa' })).toBeInViewport()
  }
})

test('Bolivia date rolls over while missing or expired providers leave no invented values and can recover', async ({ page }) => {
  const instant = new Date('2026-09-08T03:59:45Z')
  await page.clock.install({ time: instant })
  let response = fixture(instant.getTime())
  response.weather.expiresAt = instant.getTime() + 10000
  response.crypto = null; response.headlines = null
  await page.route('**/api/publications/bulletin', (route) => route.fulfill({ json: response }))
  await page.goto('/')
  await expect(page.locator('.bulletin__stage')).toHaveAttribute('data-section', 'weather')
  await expect(page.locator('.bulletin__date')).toHaveAttribute('datetime', '2026-09-07')
  response = { weather: null, crypto: null, headlines: null }
  await page.clock.runFor(31000)
  await expect(page.locator('.bulletin__date')).toHaveAttribute('datetime', '2026-09-08')
  await expect(page.locator('.bulletin__stage')).toHaveCount(0)
  response = fixture(instant.getTime() + 62000); response.weather = null; response.headlines = null
  await page.clock.runFor(31000)
  await expect(page.locator('.bulletin__stage')).toHaveAttribute('data-section', 'crypto')
  await expect(page.locator('.bulletin')).not.toContainText('La Paz')
})
