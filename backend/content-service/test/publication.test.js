import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { decodeCursor, editorSchema, encodeCursor, normalize, publicQuerySchema, readVersion, searchFields } from '../src/models/publication.js'

test('editor schemas bound content and normalize filters without accepting arbitrary fields', () => {
  const value = { title: '', summary: '', coverId: null, coverAlt: '', type: 'Artículo', category: 'Cultura', tags: [], blocks: [] }
  assert.equal(editorSchema.safeParse(value).success, true)
  assert.equal(editorSchema.safeParse({ ...value, tags: ['Edición', 'edicion'] }).success, false)
  assert.equal(editorSchema.safeParse({ ...value, status: 'published' }).success, false)
  assert.equal(editorSchema.safeParse({ ...value, blocks: [{ type: 'script', id: randomUUID(), text: 'invalid' }] }).success, false)
  assert.equal(publicQuerySchema.parse({ category: 'tecnologia' }).category, 'Tecnología')
  assert.equal(publicQuerySchema.safeParse({ status: 'draft' }).success, false)
  assert.equal(normalize('  Edición — PÚBLICA '), 'edicion publica')
})

test('version and cursor parsing reject missing, invalid or cross-filter state', () => {
  assert.equal(readVersion('"12"'), 12)
  assert.throws(() => readVersion(), { status: 428 })
  for (const invalid of ['-1', 'no', '1.2', '0']) assert.throws(() => readVersion(invalid), { status: 400 })
  const id = randomUUID(), time = '2026-09-07T12:00:00.000Z', scope = 'filters'
  assert.deepEqual(decodeCursor(encodeCursor(time, id, scope), scope), { time, id, scope })
  assert.throws(() => decodeCursor(encodeCursor(time, id, scope), 'other'), { status: 400 })
  assert.throws(() => decodeCursor('invalid', scope), { status: 400 })
})

test('search indexes metadata word prefixes and excludes unpublished body text', () => {
  const result = searchFields({ title: 'Una estación', summary: 'Mirar la ciudad', category: 'Cultura', type: 'Crónica', tags: ['Viajes'], blocks: [{ text: 'privadosecreto' }] }, 'Elena Rivas')
  assert.ok(result.searchTerms.includes('estaci'))
  assert.ok(result.searchTerms.includes('elena'))
  assert.ok(!result.searchTerms.includes('privadosecreto'))
  assert.equal(new Set(result.searchTerms).size, result.searchTerms.length)
})

test('Firestore indexes cover every supported public, author and moderation query shape', () => {
  const definition = JSON.parse(readFileSync(new URL('../../../firestore.indexes.json', import.meta.url), 'utf8'))
  const indexes = definition.indexes.filter((index) => index.collectionGroup === 'publications')
  const shape = (fields) => fields.map((field) => field.fieldPath + ':' + (field.order ?? field.arrayConfig)).join('|')
  const known = new Set(indexes.map((index) => shape(index.fields)))
  const ordered = (fieldPath, order = 'ASCENDING') => ({ fieldPath, order })
  assert.equal(known.size, 19)
  for (let mask = 0; mask < 16; mask += 1) {
    const fields = [ordered('isPublic')]
    for (const [bit, field] of ['category', 'type', 'authorId'].entries()) if (mask & (1 << bit)) fields.push(ordered(field))
    if (mask & 8) fields.push({ fieldPath: 'searchTerms', arrayConfig: 'CONTAINS' })
    fields.push(ordered('publishedAt', 'DESCENDING'), ordered('__name__'))
    assert.ok(known.has(shape(fields)))
  }
  for (const fields of [['isDeleted', 'authorId'], ['isDeleted', 'authorId', 'status'], ['isDeleted', 'status']]) {
    assert.ok(known.has(shape([...fields.map((field) => ordered(field)), ordered('updatedAt', 'DESCENDING'), ordered('__name__')])))
  }
  assert.ok(definition.fieldOverrides.some((field) => field.collectionGroup === 'publications' && field.fieldPath === 'blocks' && field.indexes.length === 0))
})
