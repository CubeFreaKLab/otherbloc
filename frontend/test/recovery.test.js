import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captureRecovery, findRecovery, forgetRecovery, hasRecovery, listRecovery, reconcileRecovery, registerRecovery } from '../src/services/draftRecovery.js'

test('recovery snapshots are transient, owned, cloned and cleared on another account or explicit exit', () => {
  const draft = { text: 'Cambios aún no enviados', baseVersion: 3 }
  const stop = registerRecovery({ ownerId: 'one', key: 'publication:one', path: '/author/publications/one', label: 'Tu publicación', read: () => draft })
  assert.equal(hasRecovery(), false)
  captureRecovery('other')
  assert.equal(hasRecovery(), false)
  captureRecovery('one')
  draft.text = 'Una edición posterior'
  assert.equal(findRecovery('one', 'publication:one').payload.text, 'Cambios aún no enviados')
  assert.deepEqual(listRecovery(null), [])
  assert.deepEqual(listRecovery('other'), [])
  reconcileRecovery(null)
  assert.equal(hasRecovery(), true)
  reconcileRecovery('one')
  assert.equal(hasRecovery(), true)
  reconcileRecovery('other')
  assert.equal(hasRecovery(), false)
  captureRecovery('one')
  forgetRecovery('other', 'publication:one')
  assert.equal(hasRecovery(), true)
  forgetRecovery('one', 'publication:one')
  assert.equal(hasRecovery(), false)
  captureRecovery('one')
  reconcileRecovery(null, true)
  assert.equal(hasRecovery(), false)
  stop()
  captureRecovery('one')
  assert.equal(hasRecovery(), false)
})
