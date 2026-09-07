import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { deleteApp } from 'firebase-admin/app'
import { setupLocal } from './setup-local.mjs'
import { getFirebase } from '../backend/users-service/src/config/firebase.js'
import { seedDemoUsers } from './seed-demo.mjs'

await setupLocal()
dotenv.config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)), quiet: true })
if (process.env.FIREBASE_PROJECT_ID !== 'demo-otherbloc' || process.env.NODE_ENV === 'production') throw new Error('This seed command only accepts the local demo project.')
const { env, validateRuntime } = await import('../backend/users-service/src/config/env.js')
const { createUsersService } = await import('../backend/users-service/src/services/users.js')
validateRuntime()
const firebase = getFirebase()
try {
  const service = createUsersService({ config: env, firebase })
  await seedDemoUsers(service, process.env)
  console.log('Demo accounts ready. Their configurable credentials remain in your private .env.local.')
} finally { await deleteApp(firebase.app) }
