import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRuntimeReadiness } from '../src/services/runtimeReadiness.js'

test('cold startup retries only safe probes, shares a flight and caches readiness', async () => {
  let time = 0, calls = 0
  const startup = createRuntimeReadiness('https://example.onrender.com/api', {
    now: () => time, sleep: async (ms) => { time += ms },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://example.onrender.com/api/ready'); assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit')
      assert.deepEqual(options.headers, { Accept: 'application/json' })
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

test('startup HTML and a pending JSON contract are not mistaken for readiness or permanent failure', async () => {
  let time = 0, calls = 0
  const startup = createRuntimeReadiness('https://example.onrender.com/api', {
    now: () => time, sleep: async (ms) => { time += ms },
    fetchImpl: async () => {
      calls++
      if (calls === 1) return new Response('<html>Starting service</html>')
      if (calls === 2) return Response.json({ ready: false })
      return Response.json({ ready: true })
    },
  })
  await startup.ensure()
  assert.equal(calls, 3)
  assert.equal(startup.getSnapshot(), false)
})

test('safe startup probe gives a cold dependency time to answer within the overall budget', async (t) => {
  let timeout
  t.mock.method(AbortSignal, 'timeout', (ms) => { timeout = ms; return new AbortController().signal })
  const startup = createRuntimeReadiness('https://example.onrender.com/api', {
    fetchImpl: async () => Response.json({ ready: true }),
  })
  await startup.ensure()
  assert.equal(timeout, 75000)
})

test('an active visitor wakes only public health endpoints once, without treating opaque responses as readiness', async () => {
  let time = 0, probes = 0
  const wakes = []
  const startup = createRuntimeReadiness('https://example.onrender.com/api', {
    now: () => time, sleep: async (ms) => { time += ms },
    fetchImpl: async (url, options) => {
      if (url.endsWith('/ready')) {
        if (++probes === 3) return Response.json({ ready: true })
        return Response.json({ ready: false, wakeups: ['https://owner.onrender.com/health', 'https://owner.onrender.com/health', 'http://localhost/health', 'https://owner.onrender.com/api/users', 'https://bad.example/health'] }, { status: 503 })
      }
      assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit')
      assert.equal(options.mode, 'no-cors'); assert.equal(options.redirect, 'follow')
      assert.equal(options.referrerPolicy, 'no-referrer')
      wakes.push(url)
      return { type: 'opaque', status: 0 }
    },
  })
  await Promise.all([startup.ensure(), startup.ensure()])
  assert.deepEqual(wakes, ['https://owner.onrender.com/health'])
  assert.equal(probes, 3)
})

test('failed visitor wake signals remain bounded and cannot make readiness succeed', async () => {
  let time = 0, wakes = 0
  const startup = createRuntimeReadiness('https://example.onrender.com/api', {
    budgetMs: 4000, now: () => time, sleep: async (ms) => { time += ms },
    fetchImpl: async (url) => {
      if (url.endsWith('/ready')) return Response.json({ ready: false, wakeups: ['https://owner.onrender.com/health'] }, { status: 503 })
      wakes++; throw new Error('network unavailable')
    },
  })
  await assert.rejects(startup.ensure(), /tardaron demasiado/)
  assert.equal(wakes, 1); assert.equal(time, 4000)
})
