import { fileURLToPath } from 'node:url'
import { deleteApp } from 'firebase-admin/app'
import dotenv from 'dotenv'
import { setupLocal } from './setup-local.mjs'
import { getFirebase } from '../backend/content-service/src/config/firebase.js'
import { seedDemoPublications } from './seed-demo.mjs'

await setupLocal()
dotenv.config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)), quiet: true })
if (process.env.FIREBASE_PROJECT_ID !== 'demo-otherbloc' || process.env.NODE_ENV === 'production') throw new Error('This seed only accepts the local demo project, never cloud data.')
const { createPublicationsService } = await import('../backend/content-service/src/services/publications.js')
const firebase = getFirebase()
try {
  await seedDemoPublications({ service: createPublicationsService({ firebase }), source: process.env,
    gateway: 'http://127.0.0.1:3000', prepareImages: process.argv.includes('--prepare-images') })
} finally { await deleteApp(firebase.app) }
