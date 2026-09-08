import { z } from 'zod'
import { fail } from '../lib/errors.js'

export const publicationTypes = ['Artículo', 'Opinión', 'Análisis', 'Reseña', 'Noticia', 'Crónica', 'Guía']
export const categories = ['Cultura', 'Ciudad', 'Tecnología', 'Escritura']
export const statuses = ['draft', 'review', 'published', 'archived']
export const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/, 'Identificador no válido.')
const assetId = z.string().uuid()
const text = z.string().max(6000)
const blockId = z.string().uuid()
const run = z.object({ text: z.string().max(6000), bold: z.boolean().optional(), italic: z.boolean().optional(), href: z.string().max(2048).regex(/^(https?:\/\/|mailto:)[^\s]+$/i).optional() }).strict()
const formatted = z.array(run).max(1000).optional()
const block = z.discriminatedUnion('type', [
  z.object({ id: blockId, type: z.literal('paragraph'), text, formatted }).strict(),
  z.object({ id: blockId, type: z.literal('heading'), text: z.string().max(200), formatted, level: z.union([z.literal(2), z.literal(3)]) }).strict(),
  z.object({ id: blockId, type: z.literal('list'), items: z.array(z.string().max(500)).max(50), formattedItems: z.array(z.object({ runs: z.array(run).max(500) }).strict()).max(50).optional(), ordered: z.boolean() }).strict(),
  z.object({ id: blockId, type: z.literal('quote'), text, formatted, attribution: z.string().max(160) }).strict(),
  z.object({ id: blockId, type: z.literal('image'), assetId: assetId.nullable(), alt: z.string().max(300), caption: z.string().max(500) }).strict(),
])
export const createSchema = z.object({ id: z.string().uuid(), title: z.string().trim().max(160).default('') }).strict()
export const editorSchema = z.object({
  title: z.string().trim().max(160), summary: z.string().trim().max(400), coverId: assetId.nullable(), coverAlt: z.string().max(300),
  type: z.enum(publicationTypes), category: z.enum(categories), tags: z.array(z.string().trim().min(1).max(30)).max(8),
  blocks: z.array(block).max(80),
}).strict().superRefine((value, context) => {
  for (const [index, item] of value.blocks.entries()) {
    const joined = (runs) => runs.map((run) => run.text).join('')
    if (item.formatted && joined(item.formatted) !== item.text) context.addIssue({ code: 'custom', message: 'El formato no coincide con el texto.', path: ['blocks', index] })
    if (item.formattedItems && (item.items.length !== item.formattedItems.length || item.items.some((text, i) => joined(item.formattedItems[i].runs) !== text))) context.addIssue({ code: 'custom', message: 'El formato no coincide con la lista.', path: ['blocks', index] })
  }
  if (new Set(value.blocks.map((item) => item.id)).size !== value.blocks.length) context.addIssue({ code: 'custom', message: 'Cada bloque debe tener un identificador único.', path: ['blocks'] })
  if (new Set(value.tags.map(normalize)).size !== value.tags.length) context.addIssue({ code: 'custom', message: 'No repitas etiquetas.', path: ['tags'] })
})
export const statusSchema = z.object({ status: z.enum(statuses), reason: z.string().trim().max(1000).default('') }).strict()
export const mediaQuerySchema = z.object({ width: z.enum(['640', '960']).optional() }).strict()
const canonicalCategory = z.preprocess((value) => typeof value === 'string' ? categories.find((item) => normalize(item) === normalize(value)) ?? value : value, z.enum(categories))
const commonQuery = { limit: z.coerce.number().int().min(1).max(40).default(12), cursor: z.string().max(1000).optional() }
export const publicQuerySchema = z.object({ ...commonQuery, q: z.string().trim().max(80).optional(), type: z.enum(publicationTypes).optional(), category: canonicalCategory.optional(), authorId: idSchema.optional() }).strict()
export const ownQuerySchema = z.object({ ...commonQuery, status: z.enum(statuses).optional() }).strict()
export const moderationQuerySchema = z.object({ ...commonQuery, status: z.enum(['review', 'published', 'archived']).default('review') }).strict()

export const assetsIn = (publication) => [...new Set([publication.coverId, ...publication.blocks.filter((item) => item.type === 'image').map((item) => item.assetId)].filter(Boolean))]
export const mediaPath = (publicationId, id) => id ? '/api/publications/' + publicationId + '/media/' + id : null

export function searchFields(publication, authorName) {
  const searchText = normalize([publication.title, publication.summary, publication.category, publication.type, ...publication.tags, authorName].join(' '))
  const searchTerms = new Set()
  for (const word of searchText.split(' ')) {
    for (let length = 1; length <= Math.min(word.length, 24); length += 1) searchTerms.add(word.slice(0, length))
  }
  return { searchText, searchTerms: [...searchTerms].slice(0, 3000) }
}

export function requirePublishable(publication) {
  const hasContent = publication.blocks.some((item) => item.type === 'image' ? item.assetId : item.type === 'list' ? item.items.some((text) => text.trim()) : item.text.trim())
  if (publication.title.length < 5 || publication.summary.length < 20 || !publication.coverId || !publication.coverAlt.trim() || !hasContent) {
    fail(400, 'publication_incomplete', 'Antes de enviar a revisión, escribe un título de al menos 5 caracteres y algo de texto. En Detalles, completa el resumen (20 caracteres) y una portada con descripción.')
  }
  for (const item of publication.blocks) {
    // Blank prose lines are spacing in continuous writing, not incomplete form fields.
    if (item.type === 'paragraph' && !item.text.trim()) continue
    const valid = item.type === 'image' ? item.assetId && item.alt.trim() : item.type === 'list' ? item.items.length && item.items.every((text) => text.trim()) : item.text.trim()
    if (!valid) fail(400, 'incomplete_block', 'Completa o quita el texto vacío y describe cada imagen antes de enviar a revisión.')
  }
}

export function publicationJson(publication, { detail = false, privateFields = false } = {}) {
  const value = { id: publication.id, slug: publication.id, title: publication.title, summary: publication.summary, authorId: publication.authorId,
    type: publication.type, category: publication.category, tags: publication.tags, status: publication.status, version: publication.version,
    coverId: publication.coverId, coverAlt: publication.coverAlt, coverWidth: publication.coverWidth ?? null, coverHeight: publication.coverHeight ?? null, image: mediaPath(publication.id, publication.coverId), imageAlt: publication.coverAlt,
    publishedAt: publication.publishedAt, date: publication.publishedAt?.slice(0, 10) ?? null, readingMinutes: publication.readingMinutes, demo: Boolean(publication.demo) }
  if (detail) value.blocks = publication.blocks.map((item) => item.type === 'image' ? { ...item, url: mediaPath(publication.id, item.assetId) } : item)
  if (privateFields) Object.assign(value, { createdAt: publication.createdAt, updatedAt: publication.updatedAt, archivedAt: publication.archivedAt, moderationNote: publication.moderationNote })
  return value
}

export function readVersion(header) {
  if (!header) fail(428, 'version_required', 'Recarga el borrador antes de guardar.')
  const value = Number(header.replace(/^"|"$/g, ''))
  if (!Number.isSafeInteger(value) || value < 1) fail(400, 'invalid_version', 'La versión enviada no es válida.')
  return value
}

export function decodeCursor(cursor, scope) {
  if (!cursor) return null
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString())
    if (value.scope !== scope || typeof value.time !== 'string' || Number.isNaN(Date.parse(value.time)) || !idSchema.safeParse(value.id).success) throw new Error('cursor')
    return value
  } catch { fail(400, 'invalid_cursor', 'El cursor no corresponde a estos filtros. Vuelve a cargar la primera página.') }
}
export const encodeCursor = (time, id, scope) => Buffer.from(JSON.stringify({ time, id, scope })).toString('base64url')
