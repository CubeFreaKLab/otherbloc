const { test, expect } = require('@playwright/test')
const { readFileSync } = require('node:fs')
const source = readFileSync('frontend/src/services/runtimeReadiness.js', 'utf8')

test('the browser sends the credential-free wake request before confirming readiness', async ({ page }) => {
  let requests = 0
  await page.route('http://127.0.0.1:5173/', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Readiness test</title>' }))
  await page.route('https://owner.onrender.com/health', async (route) => {
    requests++
    expect(route.request().headers().authorization).toBeUndefined()
    expect(route.request().headers().cookie).toBeUndefined()
    await route.fulfill({ contentType: 'text/plain', body: 'awake' })
  })
  await page.goto('/')
  const outcome = await page.evaluate(async (moduleSource) => {
    const url = URL.createObjectURL(new Blob([moduleSource], { type: 'text/javascript' }))
    try {
      const { createRuntimeReadiness } = await import(url)
      let time = 0, awake = false
      const startup = createRuntimeReadiness('https://example.onrender.com/api', {
        budgetMs: 4000, now: () => time, sleep: async (ms) => { time += ms },
        fetchImpl: async (target, options) => {
          if (target.endsWith('/ready')) return Response.json({ ready: awake, wakeups: ['https://owner.onrender.com/health'] }, { status: awake ? 200 : 503 })
          const response = await fetch(target, options)
          awake = true
          return response
        },
      })
      await startup.ensure()
      return 'ready'
    } catch (error) { return error.message } finally { URL.revokeObjectURL(url) }
  }, source)
  expect(outcome).toBe('ready')
  expect(requests).toBe(1)
})
