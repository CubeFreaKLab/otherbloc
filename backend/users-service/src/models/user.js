import { z } from 'zod'

export const roles = ['reader', 'author', 'admin']
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, 'Identificador no válido.')
const name = z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(80)
const email = z.string().trim().toLowerCase().email('Escribe un correo válido.').max(254)
const password = z.string().min(12, 'Usa al menos 12 caracteres.').max(128)
export const registerSchema = z.object({ name, email, password }).strict()
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict()
export const profileSchema = z.object({ name, biography: z.string().trim().max(600, 'La biografía admite hasta 600 caracteres.') }).strict()
export const adminSchema = z.object({ role: z.enum(roles), status: z.enum(['active', 'suspended']) }).strict()
export const passwordSchema = z.object({ currentPassword: z.string().min(1).max(128), password }).strict()
export const listSchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: idSchema.optional() }).strict()
export const publicProfilesSchema = z.object({ ids: z.string().max(3240).transform((value) => [...new Set(value.split(','))]).pipe(z.array(idSchema).min(1).max(40)) }).strict()

export function publicUser(user) {
  return { id: user.id, name: user.name, biography: user.biography, role: user.role,
    avatarUrl: user.avatarId ? '/api/users/' + user.id + '/avatar?v=' + user.avatarId : null,
    createdAt: user.createdAt, demo: Boolean(user.demo) }
}

export function privateUser(user) {
  return { ...publicUser(user), email: user.email, status: user.status, authorRequested: user.authorRequested, updatedAt: user.updatedAt }
}
