import { createHash } from 'node:crypto'
import { z } from 'zod'
import { fail, parse } from '../lib/errors.js'

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/, 'Identificador no válido.')
export const userIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, 'Identificador de usuario no válido.')
export const commentSchema = z.object({ id: z.string().uuid(), publicationId: idSchema, text: z.string().trim().min(1).max(2000) }).strict()
export const pageSchema = z.object({ limit: z.number().int().min(1).max(40).default(20), cursor: z.string().max(1000).nullish() }).strict()
export const relationId = (userId, targetId) => createHash('sha256').update(JSON.stringify([userId, targetId])).digest('hex')

export function pagination(input, scope) {
  const { limit, cursor } = parse(pageSchema, input)
  if (!cursor) return { limit, after: null }
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString())
    if (value.scope !== scope || !idSchema.safeParse(value.id).success || typeof value.time !== 'string' || Number.isNaN(Date.parse(value.time))) throw new Error('invalid cursor')
    return { limit, after: value }
  } catch { fail('BAD_USER_INPUT', 'El cursor no corresponde a esta lista. Vuelve a la primera página.') }
}

export function connection(snapshot, limit, scope, field, serialize = (item) => item) {
  const selected = snapshot.docs.slice(0, limit)
  const last = selected.at(-1)
  return { items: selected.map((item) => serialize({ ...item.data(), id: item.id })), nextCursor: snapshot.size > limit && last ? Buffer.from(JSON.stringify({ scope, time: last.get(field), id: last.id })).toString('base64url') : null }
}

export const commentJson = (value) => ({ id: value.id, publicationId: value.publicationId, userId: value.userId, text: value.isDeleted ? '' : value.text, createdAt: value.createdAt, deleted: value.isDeleted })
