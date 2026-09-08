import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cities, createBulletin } from '../src/services/bulletin.js'

const start = Date.parse('2026-09-07T18:00:00Z')
const sample = (now) => cities.map(() => ({ current: { temperature_2m: 15.6, weather_code: 61, is_day: 1, time: now / 1000 } }))
const prices = { error: [], result: { XXBTZUSD: { c: ['100.25'] }, XETHZUSD: { c: ['20.50'] } } }
const publications = async () => ({ items: [{ id: 'own-public', slug: 'una-nota', title: 'Una nota', secretField: 'not exported' }] })

test('bulletin coalesces concurrent requests and caches each source independently without forwarding identity', async () => {
  let now = start
  const requests = [], reads = []
  const bulletin = createBulletin({ now: () => now, listPublic: async (input) => { reads.push(input); return publications() }, fetchImpl: async (url, options) => {
    requests.push({ url, options })
    await new Promise((resolve) => setImmediate(resolve))
    return { ok: true, json: async () => url.includes('open-meteo') ? sample(now) : prices }
  } })
  const [one, two] = await Promise.all([bulletin(), bulletin()])
  assert.deepEqual(one, two)
  assert.equal(requests.length, 2)
  assert.equal(reads.length, 1)
  assert.deepEqual(reads[0], { limit: 4 })
  assert.equal(one.weather.items.length, 9)
  assert.equal(one.weather.items[0].city, 'La Paz')
  assert.equal(one.crypto.items[0].price, 100.25)
  assert.deepEqual(one.headlines.items[0], { id: 'own-public', slug: 'una-nota', title: 'Una nota' })
  for (const { options } of requests) {
    assert.deepEqual(options.headers, { Accept: 'application/json' })
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
  }
  now += 61000
  await bulletin()
  assert.equal(reads.length, 2); assert.equal(requests.length, 2)
  now += 240000
  await bulletin()
  assert.equal(requests.length, 3)
  assert.ok(requests.at(-1).url.includes('kraken'))
})

test('unavailable, malformed and expired sources are omitted with a retry cooldown, never stale fallback prices', async () => {
  let now = start, fail = false, requests = 0
  const bulletin = createBulletin({ now: () => now, listPublic: publications, fetchImpl: async (url) => {
    requests++
    if (fail) throw new Error('offline')
    return { ok: true, json: async () => url.includes('open-meteo') ? sample(now) : prices }
  } })
  assert.ok((await bulletin()).crypto)
  now += 301000; fail = true
  const partial = await bulletin()
  assert.equal(partial.crypto, null); assert.ok(partial.weather); assert.ok(partial.headlines)
  const count = requests
  await bulletin(); assert.equal(requests, count)
  now += 61000; fail = false
  assert.ok((await bulletin()).crypto)
  const invalid = createBulletin({ now: () => now, listPublic: publications, fetchImpl: async () => ({ ok: true, json: async () => ({ error: ['rate limit'] }) }) })
  assert.deepEqual(Object.keys(await invalid()), ['weather', 'crypto', 'headlines'])
  assert.equal((await invalid()).weather, null); assert.equal((await invalid()).crypto, null)
})

test('old weather, missing or invalid numeric values do not become current temperatures or zero prices', async () => {
  const weather = sample(start)
  weather[0].current.temperature_2m = null
  weather[1].current.time -= 7200
  weather[2].current.weather_code = null
  const bulletin = createBulletin({ now: () => start, listPublic: async () => { throw new Error('database unavailable') }, fetchImpl: async (url) => ({ ok: true, json: async () => url.includes('open-meteo') ? weather : { error: [], result: { XXBTZUSD: { c: [null] }, XETHZUSD: { c: ['invalid'] } } } }) })
  const result = await bulletin()
  assert.equal(result.weather.items.length, 6)
  assert.equal(result.crypto, null)
  assert.equal(result.headlines, null)
})

test('external data can be disabled without losing published headlines or making any provider requests', async () => {
  const bulletin = createBulletin({ external: false, listPublic: publications, fetchImpl: () => { throw new Error('must not be called') } })
  const result = await bulletin()
  assert.equal(result.weather, null); assert.equal(result.crypto, null); assert.equal(result.headlines.items.length, 1)
})
