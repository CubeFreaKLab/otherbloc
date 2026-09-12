import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

export function validateFirebaseEnvironment(source = process.env) {
  const projectId = source.FIREBASE_PROJECT_ID
  const bucket = source.FIREBASE_STORAGE_BUCKET
  const provider = source.MEDIA_STORAGE_PROVIDER || 'firebase'
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required')
  if (!['firebase', 'cloudinary'].includes(provider)) throw new Error('MEDIA_STORAGE_PROVIDER must be firebase or cloudinary')
  if (provider === 'firebase' && !bucket) throw new Error('FIREBASE_STORAGE_BUCKET is required for Firebase Storage')
  if (provider === 'cloudinary' && bucket) throw new Error('Remove FIREBASE_STORAGE_BUCKET when selecting Cloudinary; existing files are not migrated automatically')
  const firestoreHost = source.FIRESTORE_EMULATOR_HOST
  const storageHost = source.FIREBASE_STORAGE_EMULATOR_HOST
  if (firestoreHost || storageHost) {
    if (provider !== 'firebase') throw new Error('Local emulators cannot upload to Cloudinary; keep local data isolated')
    if (!projectId.startsWith('demo-') || !firestoreHost || !storageHost || source.NODE_ENV === 'production') {
      throw new Error('Emulator mode requires a demo project, both emulator hosts and non-production mode')
    }
    for (const host of [firestoreHost, storageHost]) {
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Local emulator hosts must be loopback host:port values')
    }
  } else if (projectId.startsWith('demo-')) {
    throw new Error('Demo projects require both emulators; refusing a cloud connection')
  }
  return { projectId, bucket, provider, emulated: Boolean(firestoreHost) }
}

export function getFirebase() {
  const config = validateFirebaseEnvironment()
  const name = 'interactions-service'
  let app
  if (getApps().some((item) => item.name === name)) app = getApp(name)
  else {
    const options = { projectId: config.projectId, ...(config.bucket ? { storageBucket: config.bucket } : {}) }
    if (!config.emulated) {
      options.credential = process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
        ? cert({ projectId: config.projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') })
        : applicationDefault()
    }
    app = initializeApp(options, name)
  }
  return { app, db: getFirestore(app), bucket: config.provider === 'cloudinary' ? null : getStorage(app).bucket() }
}
