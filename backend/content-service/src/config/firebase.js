import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

export function validateFirebaseEnvironment(source = process.env) {
  const projectId = source.FIREBASE_PROJECT_ID
  const bucket = source.FIREBASE_STORAGE_BUCKET
  if (!projectId || !bucket) throw new Error('FIREBASE_PROJECT_ID and FIREBASE_STORAGE_BUCKET are required')
  const firestoreHost = source.FIRESTORE_EMULATOR_HOST
  const storageHost = source.FIREBASE_STORAGE_EMULATOR_HOST
  if (firestoreHost || storageHost) {
    if (!projectId.startsWith('demo-') || !firestoreHost || !storageHost || source.NODE_ENV === 'production') {
      throw new Error('Emulator mode requires a demo project, both emulator hosts and non-production mode')
    }
    for (const host of [firestoreHost, storageHost]) {
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Local emulator hosts must be loopback host:port values')
    }
  } else if (projectId.startsWith('demo-')) {
    throw new Error('Demo projects require both emulators; refusing a cloud connection')
  }
  return { projectId, bucket, emulated: Boolean(firestoreHost) }
}

export function getFirebase() {
  const config = validateFirebaseEnvironment()
  const name = 'content-service'
  let app
  if (getApps().some((item) => item.name === name)) app = getApp(name)
  else {
    const options = { projectId: config.projectId, storageBucket: config.bucket }
    if (!config.emulated) {
      options.credential = process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
        ? cert({ projectId: config.projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') })
        : applicationDefault()
    }
    app = initializeApp(options, name)
  }
  return { app, db: getFirestore(app), bucket: getStorage(app).bucket() }
}
