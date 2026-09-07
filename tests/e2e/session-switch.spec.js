const { test, expect } = require('@playwright/test')
const { randomUUID } = require('node:crypto')

test('refresh cannot replay a pending profile write under a different account cookie', async ({ page }) => {
  const password = 'Una prueba de cambio de cuenta 2026', targetEmail = 'target-' + randomUUID() + '@example.test'
  const headers = { 'X-Otherbloc-Request': '1', Origin: 'http://127.0.0.1:5173' }
  await page.goto('/register')
  await page.getByLabel('Nombre', { exact: true }).fill('Cuenta origen de prueba')
  await page.getByLabel('Correo electrónico').fill('source-' + randomUUID() + '@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByLabel('Nombre público')).toHaveValue('Cuenta origen de prueba')
  await page.getByLabel('Biografía', { exact: true }).fill('Este texto pertenece solo a la cuenta de origen.')
  expect((await page.request.post('/api/users/logout', { headers, data: {} })).status()).toBe(204)
  // A separate HTTP client changes this browser context's cookie, but not the SPA's token.
  const target = await page.request.post('/api/users/register', { headers, data: { name: 'Cuenta destino de prueba', email: targetEmail, password } })
  expect(target.status()).toBe(201)
  const requests = []
  page.on('request', (request) => { if (request.method() === 'PATCH' && request.url().endsWith('/api/users/me')) requests.push(request) })
  try {
    await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
    await expect(page.getByLabel('Nombre público')).toHaveValue('Cuenta destino de prueba')
    await page.waitForLoadState('networkidle')
    await page.reload()
    await expect(page.getByLabel('Nombre público')).toHaveValue('Cuenta destino de prueba')
    await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue('')
    expect(requests).toHaveLength(1)
  } finally {
    // Clear only this synthetic target profile if a regression wrote the test text into it.
    const signed = await page.request.post('/api/users/login', { headers, data: { email: targetEmail, password } })
    const authorized = { ...headers, Authorization: 'Bearer ' + (await signed.json()).accessToken }
    await page.request.patch('/api/users/me', { headers: authorized, data: { name: 'Cuenta destino de prueba', biography: '' } })
    await page.request.post('/api/users/logout', { headers: authorized, data: {} })
  }
})
