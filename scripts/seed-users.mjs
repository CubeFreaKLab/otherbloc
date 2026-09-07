import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { deleteApp } from 'firebase-admin/app'
import { setupLocal } from './setup-local.mjs'
import { getFirebase } from '../backend/users-service/src/config/firebase.js'
import { registerSchema, idSchema } from '../backend/users-service/src/models/user.js'
import { authors } from '../frontend/src/data/articles.js'

await setupLocal()
dotenv.config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)), quiet: true })
if (process.env.FIREBASE_PROJECT_ID !== 'demo-otherbloc' || process.env.NODE_ENV === 'production') throw new Error('This seed command only accepts the local demo project.')
const { env, validateRuntime } = await import('../backend/users-service/src/config/env.js')
const { createUsersService } = await import('../backend/users-service/src/services/users.js')
validateRuntime()
const firebase = getFirebase()
try {
  const service = createUsersService({ config: env, firebase })
  const definitions = [
    { id: 'demo-reader', name: 'Lector de muestra', email: process.env.SEED_READER_EMAIL, role: 'reader' },
    ...authors.map((author, index) => ({ id: author.id, name: author.name, email: index === 0 ? process.env.SEED_AUTHOR_EMAIL : author.id + '@example.test', role: 'author', biography: author.bio })),
    { id: 'demo-admin', name: 'Administración de muestra', email: process.env.SEED_ADMIN_EMAIL, role: 'admin' },
  ]
  for (const definition of definitions) {
    const input = registerSchema.parse({ name: definition.name, email: definition.email, password: process.env.SEED_PASSWORD })
    const result = await service.seed({ ...input, id: idSchema.parse(definition.id), role: definition.role, biography: definition.biography ?? 'Cuenta de demostración para pruebas de otherbloc.' })
    console.log(definition.role + ': ' + (result.created ? 'created' : 'kept existing demo account'))
  }
  console.log('Demo accounts ready. Their configurable credentials remain in your private .env.local.')
} finally { await deleteApp(firebase.app) }
