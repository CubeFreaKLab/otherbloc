import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { confirmTags } from '../src/services/tags.js'
import { fromWritingDocument, toWritingDocument, safeLink } from '../src/services/writingDocument.js'

test('tags split spaces commas and pasted lines, deduplicate, and keep invalid unfinished entries', () => {
  assert.deepEqual(confirmTags([], 'cultura ciudad , CULTURA\nescritura'), { tags: ['cultura', 'ciudad', 'escritura'], input: '', error: '' })
  const long = 'a'.repeat(31), eight = ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho']
  const result = confirmTags(eight, long + ' nueve')
  assert.deepEqual(result.tags, eight)
  assert.equal(result.input, long + ' nueve')
  assert.match(result.error, /31|30 caracteres/)
  assert.match(result.error, /nueve/)
  assert.deepEqual(confirmTags(['Ciudad'], ' CIUDAD , , ').tags, ['Ciudad'])
  assert.deepEqual(confirmTags(['#Ciudad'], 'ciudad').tags, ['#Ciudad'])
})

test('existing photos and text survive the writing conversion without exposing HTML', () => {
  const blocks = [
    { id: randomUUID(), type: 'paragraph', text: 'Primera línea\nSegunda línea' },
    { id: randomUUID(), type: 'heading', text: 'Subtítulo', level: 3 },
    { id: randomUUID(), type: 'quote', text: 'Una idea.', attribution: 'Fuente original' },
    { id: randomUUID(), type: 'list', items: ['Primera', 'Segunda'], ordered: true },
    { id: randomUUID(), type: 'image', assetId: randomUUID(), alt: 'Fotografía original', caption: 'Pie original' },
  ]
  const converted = fromWritingDocument(toWritingDocument(blocks))
  assert.deepEqual(converted.map(({ formatted: _formatted, formattedItems: _items, ...block }) => block), blocks)
  assert.equal(safeLink('javascript:alert(1)'), false)
  assert.equal(safeLink('data:text/html,bad'), false)
  assert.equal(safeLink('https://example.com/nota'), true)
  assert.equal(safeLink('mailto:persona@example.test'), true)
})

test('bold italic links and formatted lists round trip; trailing empty writing line stays out of submission', () => {
  const formatted = [{ text: 'Una ', bold: true }, { text: 'idea', italic: true, href: 'https://example.com/' }]
  const blocks = [{ id: randomUUID(), type: 'paragraph', text: 'Una idea', formatted }, { id: randomUUID(), type: 'list', ordered: false, items: ['Una idea'], formattedItems: [{ runs: formatted }] }]
  const document = toWritingDocument(blocks)
  document.content.push({ type: 'paragraph' })
  assert.deepEqual(fromWritingDocument(document), blocks)
})
