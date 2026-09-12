import assert from 'node:assert/strict'
import { test } from 'node:test'
import { v2 as cloudinary } from 'cloudinary'
import { createCloudinaryBucket as usersBucket } from '../backend/users-service/src/lib/cloudinary-bucket.js'
import { createCloudinaryBucket as contentBucket } from '../backend/content-service/src/lib/cloudinary-bucket.js'
import { validateFirebaseEnvironment as usersConfig } from '../backend/users-service/src/config/firebase.js'
import { validateFirebaseEnvironment as contentConfig } from '../backend/content-service/src/config/firebase.js'
import { validateFirebaseEnvironment as interactionsConfig } from '../backend/interactions-service/src/config/firebase.js'

const source = { FIREBASE_PROJECT_ID: 'otherbloc-fixture', MEDIA_STORAGE_PROVIDER: 'cloudinary', NODE_ENV: 'production',
  CLOUDINARY_CLOUD_NAME: 'fixture-cloud', CLOUDINARY_API_KEY: '123456789', CLOUDINARY_API_SECRET: 'synthetic-test-secret' }
const local = { FIREBASE_PROJECT_ID: 'demo-otherbloc', FIREBASE_STORAGE_BUCKET: 'demo-otherbloc.appspot.com',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199' }

test('all services explicitly select cloud files without a Firebase bucket and preserve isolated local emulators', () => {
  for (const configure of [usersConfig, contentConfig, interactionsConfig]) {
    assert.equal(configure(source).provider, 'cloudinary')
    assert.equal(configure(source).bucket, undefined)
    assert.equal(configure(local).provider, 'firebase')
    assert.equal(configure(local).emulated, true)
    for (const value of [
      { ...source, FIREBASE_STORAGE_BUCKET: 'old-files.appspot.com' },
      { ...local, MEDIA_STORAGE_PROVIDER: 'cloudinary' },
      { ...source, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
      { ...source, FIREBASE_PROJECT_ID: 'demo-otherbloc' },
      { ...source, MEDIA_STORAGE_PROVIDER: 'typo' },
      { ...local, FIREBASE_STORAGE_EMULATOR_HOST: '' },
    ]) assert.throws(() => configure(value))
  }
  const interactionSource = Object.fromEntries(Object.entries(source).filter(([key]) => !key.startsWith('CLOUDINARY_')))
  assert.doesNotThrow(() => interactionsConfig(interactionSource), 'Interactions has no access to images or their credentials')
  for (const configure of [usersConfig, contentConfig]) assert.throws(() => configure(interactionSource))
})

for (const [owner, createBucket] of [['avatars', usersBucket], ['publications', contentBucket]]) {
  const path = owner + '/owner-id/asset-id-640.webp'
  const publicId = 'otherbloc/otherbloc-fixture/' + path.slice(0, -5)
  const bytes = Buffer.from('synthetic WebP bytes; image decoding is enforced by the owning service')
  function fixture({ upload, download, destroy, utils = cloudinary.utils } = {}) {
    const calls = []
    const sdk = { utils, uploader: {
      upload: async (input, options) => { calls.push(['upload', input, options]); return upload ? upload(input, options) : { public_id: publicId, resource_type: 'image', type: 'authenticated', format: 'webp' } },
      destroy: async (id, options) => { calls.push(['destroy', id, options]); return destroy ? destroy() : { result: 'ok' } },
    } }
    const bucket = createBucket(source, { sdk, now: () => 1700000000000, fetchImpl: async (url, options) => {
      calls.push(['download', url, options])
      return download ? download() : new Response(bytes, { headers: { 'Content-Type': 'image/webp' } })
    } })
    return { calls, bucket }
  }

  test(owner + ': validates server credentials and refuses arbitrary or cross-owner paths', () => {
    for (const key of ['FIREBASE_PROJECT_ID', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      assert.throws(() => createBucket({ ...source, [key]: '' }))
    }
    const { bucket, calls } = fixture()
    for (const invalid of ['https://example.test/a.webp', '../secret.webp', owner + '/id/../image.webp', owner + '/id/image.jpg',
      owner + '/id/file.webp?token=x', (owner === 'avatars' ? 'publications' : 'avatars') + '/id/asset.webp']) assert.throws(() => bucket.file(invalid))
    assert.equal(calls.length, 0)
  })

  test(owner + ': uses authenticated non-overwriting uploads and an expiring server-only download', async () => {
    const { bucket, calls } = fixture()
    await bucket.file(path).save(bytes)
    const [kind, input, options] = calls[0]
    assert.equal(kind, 'upload')
    assert.equal(input, 'data:image/webp;base64,' + bytes.toString('base64'))
    assert.equal(options.public_id, publicId)
    assert.equal(options.type, 'authenticated')
    assert.equal(options.overwrite, false)
    assert.equal(options.signature_algorithm, 'sha256')
    assert.deepEqual(await bucket.file(path).download(), [bytes])
    const url = new URL(calls[1][1])
    assert.equal(url.origin, 'https://api.cloudinary.com')
    assert.equal(url.searchParams.get('public_id'), publicId)
    assert.equal(url.searchParams.get('type'), 'authenticated')
    assert.equal(url.searchParams.get('expires_at'), '1700000060')
    assert.ok(url.searchParams.get('signature'))
    assert.equal(url.href.includes(source.CLOUDINARY_API_SECRET), false)
    assert.equal(calls[1][2].redirect, 'error')
    assert.ok(calls[1][2].signal instanceof AbortSignal)
    await bucket.file(path).delete({ ignoreNotFound: true })
    assert.equal(calls[2][0], 'destroy')
    assert.equal(calls[2][1], publicId)
    assert.equal(calls[2][2].type, 'authenticated')
    await bucket.file(path).delete()
    assert.equal(calls.length, 3, 'Only this operation’s confirmed new assets may be cleaned up')
  })

  test(owner + ': never deletes existing assets or retries ambiguous uploads', async () => {
    for (const upload of [() => ({ existing: true }), () => { throw new Error('private-url?secret=' + source.CLOUDINARY_API_SECRET) }]) {
      const { bucket, calls } = fixture({ upload })
      await assert.rejects(bucket.file(path).save(bytes), (error) => error.status === 503 && !error.message.includes(source.CLOUDINARY_API_SECRET))
      await bucket.file(path).delete()
      assert.equal(calls.length, 1)
    }
  })

  test(owner + ': rejects failed, redirected, non-image or oversized downloads without leaking provider errors', async () => {
    for (const download of [
      () => new Response('not found', { status: 404 }),
      () => new Response('provider details', { status: 429 }),
      () => new Response('redirect', { status: 302 }),
      () => new Response('html', { headers: { 'Content-Type': 'text/html' } }),
      () => new Response('too large', { headers: { 'Content-Type': 'image/webp', 'Content-Length': String(11 * 1024 * 1024) } }),
      () => new Response(new Uint8Array(10 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'image/webp' } }),
      () => { throw new Error('https://private?signature=' + source.CLOUDINARY_API_SECRET) },
    ]) {
      const { bucket, calls } = fixture({ download })
      await assert.rejects(bucket.file(path).download(), (error) => [404, 503].includes(error.status) && !error.message.includes(source.CLOUDINARY_API_SECRET))
      assert.equal(calls.length, 1)
    }
    const { bucket, calls } = fixture({ utils: { private_download_url: () => 'https://example.test/redirect' } })
    await assert.rejects(bucket.file(path).download())
    assert.equal(calls.length, 0)
  })
}
