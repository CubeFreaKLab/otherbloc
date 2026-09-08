import assert from 'node:assert/strict'
import { test } from 'node:test'
import { availableBulletins, boliviaDate, weatherCondition } from '../src/utils/bulletin.js'

test('the date uses Bolivia midnight, not the device time zone or a hardcoded example', () => {
  assert.equal(boliviaDate('2026-09-08T03:59:59Z').iso, '2026-09-07')
  assert.equal(boliviaDate('2026-09-08T04:00:00Z').iso, '2026-09-08')
  assert.match(boliviaDate('2027-01-01T04:00:00Z').text, /1 de enero de 2027/)
})

test('weather icons distinguish day/night, clouds, fog, precipitation, snow and thunderstorms', () => {
  for (const [code, day, icon] of [[0, true, 'sun'], [0, false, 'moon'], [2, true, 'cloudSun'], [1, false, 'cloudMoon'], [3, true, 'cloud'], [45, true, 'fog'], [55, true, 'rain'], [61, true, 'rain'], [82, true, 'rain'], [75, true, 'snow'], [99, true, 'storm']]) assert.equal(weatherCondition(code, day).icon, icon)
  assert.equal(weatherCondition(999, true).text, 'Condición no disponible')
})

test('only available, nonempty and fresh groups enter the rotation in editorial order', () => {
  const valid = { expiresAt: 200, items: [1] }
  assert.deepEqual(availableBulletins({ headlines: valid, weather: valid, crypto: valid }, 100).map(({ key }) => key), ['weather', 'crypto', 'headlines'])
  assert.deepEqual(availableBulletins({ weather: valid, crypto: null, headlines: { ...valid, items: [] } }, 200), [])
  assert.deepEqual(availableBulletins(null, 100), [])
})
