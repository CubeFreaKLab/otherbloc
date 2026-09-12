import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRuntimeReadiness } from '../src/services/runtimeReadiness.js'

test('cold startup retries only safe probes, shares a flight and caches readiness', async () => {
  let time = 0, calls = 0
  const startup = createRuntimeReadiness('https://example.onrender.com/api', {
    now: () => time, sleep: async (ms) => { time += ms },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://example.onrender.com/api/ready'); assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit')
      if (++calls === 1) throw new Error('cold gateway')
      if (calls === 2) return new Response('{"ready":false}', { status: 503 })
      return new Response('{"ready":true}')
    },
  })
  await Promise.all([startup.ensure(), startup.ensure()])
  assert.equal(calls, 3)
  await startup.ensure(); assert.equal(calls, 3)
  time += 60001; await startup.ensure(); assert.equal(calls, 4)
})

test('bounded startup fails honestly and a later explicit attempt can recover', async () => {
  let time = 0, ready = false
  const startup = createRuntimeReadiness('https://example.onrender.com/api', { budgetMs: 4000, now: () => time, sleep: async (ms) => { time += ms }, fetchImpl: async () => new Response(JSON.stringify({ ready }), { status: ready ? 200 : 503 }) })
  await assert.rejects(startup.ensure(), /tardaron demasiado/)
  assert.equal(time, 4000); assert.equal(startup.getSnapshot(), false)
  ready = true; await startup.ensure()
})

test('does not probe local development, reject navigation cancellation or retry permanent errors', async () => {
  const local = createRuntimeReadiness('/api', { fetchImpl: () => assert.fail('No local probe') })
  await local.ensure()
  const controller = new AbortController(); controller.abort()
  await assert.rejects(local.ensure(controller.signal), { name: 'AbortError' })
  let count = 0
  const bad = createRuntimeReadiness('https://example.onrender.com/api', { fetchImpl: async () => { count++; return new Response('', { status: 404 }) } })
  await assert.rejects(bad.ensure(), /disponibilidad/); assert.equal(count, 1)
})
