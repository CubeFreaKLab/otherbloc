const { test, expect } = require('@playwright/test')
const { randomUUID } = require('node:crypto')
const sharp = require('sharp')
const AxeBuilder = require('@axe-core/playwright').default

const testPassword = 'Una frase local de verificación 2026'

async function register(page) {
  const unique = randomUUID()
  const email = 'e2e-' + unique + '@example.test'
  const name = 'Prueba ' + unique.slice(0, 8)
  await page.goto('/register')
  await page.getByLabel('Nombre', { exact: true }).fill(name)
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(testPassword)
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible()
  await expect(page.getByLabel('Nombre público')).toHaveValue(name)
  const href = await page.getByRole('link', { name: 'Ver perfil público' }).getAttribute('href')
  return { email, name, id: href.split('/').pop() }
}

async function login(page, email, password) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible()
}

async function logout(page) {
  await page.goto('/account')
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
}

test('real registration, live header avatar, profile persistence, immediate writing and logout', async ({ page, context }, testInfo) => {
  const user = await register(page)
  await expect(page.locator('.account-access__initials')).toHaveText('P' + user.name.split(' ')[1][0].toUpperCase())
  const requests = []
  page.on('request', (request) => { if (request.resourceType() === 'fetch') requests.push(new URL(request.url())) })
  await page.getByLabel('Biografía', { exact: true }).fill('Perfil de demostración guardado en Firestore, no en el navegador.')
  await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Tu perfil se guardó')
  await page.reload()
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue('Perfil de demostración guardado en Firestore, no en el navegador.')
  const cookies = await context.cookies()
  expect(cookies.some((cookie) => cookie.name === 'ob_refresh' && cookie.httpOnly)).toBe(true)
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => /token|session|user|password/i.test(key)))).toBe(false)
  const avatar = await sharp({ create: { width: 96, height: 96, channels: 3, background: '#373735' } }).png().toBuffer()
  await page.getByLabel('Archivo de avatar').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: avatar })
  await expect(page.getByRole('status')).toContainText('Tu avatar se guardó')
  await expect(page.getByRole('img', { name: 'Tu avatar actual' })).toBeVisible()
  await expect(page.locator('.account-access img')).toHaveAttribute('src', await page.getByRole('img', { name: 'Tu avatar actual' }).getAttribute('src'))
  await page.getByRole('link', { name: 'Ver perfil público' }).click()
  await expect(page.locator('main')).toContainText('Perfil de demostración guardado en Firestore')
  await expect(page.locator('main')).not.toContainText(user.email)
  await page.goto('/account')
  await expect(page.getByRole('button', { name: 'Solicitar acceso de autor' })).toHaveCount(0)
  await expect(page.locator('main').getByRole('link', { name: 'Mis publicaciones', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Quitar avatar', exact: true }).click()
  await expect(page.locator('.account-access img')).toHaveCount(0)
  await expect(page.locator('.account-access__initials')).toHaveText('P' + user.name.split(' ')[1][0].toUpperCase())
  await expect(page.locator('.account-avatar__initial')).toHaveText('P' + user.name.split(' ')[1][0].toUpperCase())
  await page.reload()
  await expect(page.locator('.account-access img')).toHaveCount(0)
  for (const colorScheme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== colorScheme) {
      const themeButton = page.getByRole('button', { name: colorScheme === 'dark' ? 'Activar tema oscuro' : 'Activar tema claro' })
      // A full-page capture may leave the compact header in its scroll-away interval.
      // Keyboard focus must bring it back before activating the same real control.
      await themeButton.focus()
      await expect(themeButton).toBeInViewport()
      await themeButton.press('Enter')
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator('main').focus()
    await page.screenshot({ path: testInfo.outputPath('account-' + colorScheme + '.png'), fullPage: true })
  }
  expect(requests.every((url) => url.pathname.startsWith('/api/') && url.port === '5173')).toBe(true)
  await logout(page)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Este espacio es tuyo' })).toBeVisible()
  await login(page, user.email, testPassword)
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue('Perfil de demostración guardado en Firestore, no en el navegador.')
})

test('unsaved profile changes are protected, including keyboard focus in the confirmation dialog', async ({ page }) => {
  await register(page)
  await page.getByLabel('Biografía', { exact: true }).fill('Este cambio todavía no está guardado.')
  await page.getByRole('link', { name: 'Ver perfil público' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Seguir editando' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue('Este cambio todavía no está guardado.')
  await page.getByRole('link', { name: 'Ver perfil público' }).click()
  await dialog.getByRole('button', { name: 'Salir sin guardar' }).click()
  await expect(page).toHaveURL(/\/profile\//)
  await page.goto('/account')
  await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue('')
})

test('normal accounts cannot administer users; administrative role changes still revoke sessions', async ({ page }, testInfo) => {
  const reader = await register(page)
  await expect(page.locator('main').getByRole('link', { name: 'Mis publicaciones', exact: true })).toBeVisible()
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Acceso no permitido' })).toBeVisible()
  await logout(page)
  await login(page, process.env.SEED_ADMIN_EMAIL, process.env.SEED_PASSWORD)
  await page.locator('main').getByRole('link', { name: 'Administrar usuarios' }).click()
  await expect(page.locator('.admin-users-list li').first()).toBeVisible()
  let row = page.locator('[data-user-id="' + reader.id + '"]')
  while (!await row.count()) {
    const more = page.getByRole('button', { name: 'Cargar más usuarios' })
    await expect(more).toBeVisible()
    await more.click()
    await expect(page.getByRole('button', { name: 'Cargando…', exact: true })).toHaveCount(0)
    row = page.locator('[data-user-id="' + reader.id + '"]')
  }
  await expect(row).not.toContainText('Solicita ser autor')
  await row.getByRole('button', { name: 'Gestionar a ' + reader.name }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Rol de la cuenta').selectOption('author')
  await dialog.getByRole('button', { name: 'Confirmar permisos' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(row).toContainText('Autor')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.locator('main').focus()
  await page.screenshot({ path: testInfo.outputPath('admin-users.png'), fullPage: true })
  await logout(page)
  await login(page, reader.email, testPassword)
  await expect(page.locator('.account-profile__heading .eyebrow')).toHaveText('Leer y escribir')
  await expect(page.getByRole('button', { name: 'Solicitar acceso de autor' })).toHaveCount(0)
})
