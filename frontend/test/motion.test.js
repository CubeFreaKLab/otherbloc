import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeMotion } from '../src/utils/routeMotion.js'

test('reading shares a cover only with its public collections, never unrelated private areas', () => {
  for (const collection of ['/', '/explore', '/profile/elena-rivas']) {
    assert.equal(routeMotion(collection, '/article/leer-sin-prisa'), 'reading')
    assert.equal(routeMotion('/article/leer-sin-prisa', collection), 'reading')
  }
  assert.equal(routeMotion('/account/saved', '/article/leer-sin-prisa'), 'fade')
  assert.equal(routeMotion('/article/uno', '/article/dos'), 'fade')
})

test('lateral motion represents explicit parent-child navigation, not path depth or siblings', () => {
  for (const [parent, child] of [['/account', '/account/saved'], ['/account', '/author'], ['/account', '/admin/users'], ['/author', '/author/publications/example'], ['/admin/publications', '/admin/publications/example']]) {
    assert.equal(routeMotion(parent, child), 'forward')
    assert.equal(routeMotion(child, parent), 'backward')
  }
  for (const [from, to] of [['/', '/explore'], ['/account/saved', '/account/following'], ['/admin/users', '/admin/publications'], ['/login', '/register'], ['/author/publications/example', '/explore']]) assert.equal(routeMotion(from, to), 'fade')
  assert.equal(routeMotion('/explore', '/explore'), 'none')
})
