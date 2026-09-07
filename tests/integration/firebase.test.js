import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { deleteApp } from 'firebase-admin/app'
import { FieldValue } from 'firebase-admin/firestore'
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'
import { getFirebase, validateFirebaseEnvironment } from '../../backend/users-service/src/config/firebase.js'

let firebase
let ruleEnvironment
const id = 'test-' + randomUUID()

before(async () => {
  assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-otherbloc', 'Integration tests must never run against cloud data')
  firebase = getFirebase()
  ruleEnvironment = await initializeTestEnvironment({
    projectId: 'demo-otherbloc',
    firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: await readFile('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  })
})

after(async () => {
  await ruleEnvironment?.cleanup()
  if (firebase) {
    await firebase.db.collection('_checks').doc(id).delete()
    await firebase.bucket.file('_checks/' + id).delete({ ignoreNotFound: true })
    await deleteApp(firebase.app)
  }
})

test('Firestore retains writes across independent SDK reads and concurrent atomic increments', async () => {
  const record = firebase.db.collection('_checks').doc(id)
  await record.set({ count: 0, label: 'Demostración de persistencia del emulador' })
  await Promise.all(Array.from({ length: 20 }, () => record.update({ count: FieldValue.increment(1) })))
  assert.equal((await firebase.db.collection('_checks').doc(id).get()).data().count, 20)
  await firebase.db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(record)
    transaction.update(record, { count: snapshot.data().count + 1 })
  })
  assert.equal((await record.get()).data().count, 21)
})

test('Storage retains bytes and metadata and can be read by its owning server', async () => {
  const object = firebase.bucket.file('_checks/' + id)
  const content = Buffer.from('otherbloc emulator persistence check')
  await object.save(content, { resumable: false, metadata: { contentType: 'text/plain' } })
  const [download] = await object.download()
  assert.deepEqual(download, content)
  assert.equal((await object.getMetadata())[0].contentType, 'text/plain')
})

test('direct client reads and writes are denied, including fake Firebase-authenticated identities', async () => {
  for (const context of [ruleEnvironment.unauthenticatedContext(), ruleEnvironment.authenticatedContext('forged-admin', { role: 'admin' })]) {
    await assertFails(getDoc(doc(context.firestore(), '_checks', id)))
    await assertFails(setDoc(doc(context.firestore(), '_checks', id), { count: 999 }))
    await assertFails(uploadBytes(ref(context.storage('gs://demo-otherbloc.appspot.com'), '_checks/' + id), new Uint8Array([1, 2, 3])))
  }
})

test('Firebase configuration prevents mixed emulator/cloud connections', () => {
  assert.throws(() => validateFirebaseEnvironment({ FIREBASE_PROJECT_ID: 'demo-otherbloc', FIREBASE_STORAGE_BUCKET: 'demo-otherbloc.appspot.com' }), /both emulators/)
  assert.throws(() => validateFirebaseEnvironment({ FIREBASE_PROJECT_ID: 'real-project', FIREBASE_STORAGE_BUCKET: 'real-project.firebasestorage.app', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }), /demo project/)
})
