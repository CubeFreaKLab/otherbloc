import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getFirebase as users } from '../../backend/users-service/src/config/firebase.js'
import { getFirebase as content } from '../../backend/content-service/src/config/firebase.js'
import { getFirebase as interactions } from '../../backend/interactions-service/src/config/firebase.js'

const suffix = randomBytes(8).toString('hex')
export const testDatabaseId = 'integration-' + suffix
export const testBucketName = 'demo-otherbloc-test-' + suffix + '.appspot.com'

function isolated(factory) {
  assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-otherbloc-test', 'Integration clients only accept their fixed demo project.')
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080')
  assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199')
  assert.notEqual(process.env.NODE_ENV, 'production')
  const firebase = factory()
  // One real emulator database/bucket per test-file process; project labels alone do not isolate imported data.
  return { ...firebase, db: getFirestore(firebase.app, testDatabaseId), bucket: getStorage(firebase.app).bucket(testBucketName) }
}

export const getUsersFirebase = () => isolated(users)
export const getContentFirebase = () => isolated(content)
export const getInteractionsFirebase = () => isolated(interactions)
