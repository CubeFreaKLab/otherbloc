import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initials } from '../src/utils/initials.js'

test('account initials use the actual name and handle whitespace accents and single names', () => {
  assert.equal(initials('  Elena   Rivas '), 'ER')
  assert.equal(initials('álvaro díaz pérez'), 'ÁD')
  assert.equal(initials('Marina'), 'M')
  assert.equal(initials(''), '')
})
