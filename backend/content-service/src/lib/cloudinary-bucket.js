import { v2 as cloudinary } from 'cloudinary'
import { HttpError } from './errors.js'

const MAX_BYTES = 10 * 1024 * 1024

export function cloudinaryOptions(source) {
  if (!/^[a-z0-9_-]+$/i.test(source.CLOUDINARY_CLOUD_NAME ?? '') || !/^\d+$/.test(source.CLOUDINARY_API_KEY ?? '')
    || !source.CLOUDINARY_API_SECRET?.trim() || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(source.FIREBASE_PROJECT_ID ?? '')) {
    throw new Error('Configure FIREBASE_PROJECT_ID and the private CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET settings.')
  }
  return { cloud_name: source.CLOUDINARY_CLOUD_NAME, api_key: source.CLOUDINARY_API_KEY, api_secret: source.CLOUDINARY_API_SECRET,
    secure: true, upload_prefix: 'https://api.cloudinary.com', resource_type: 'image', type: 'authenticated', timeout: 8000, signature_algorithm: 'sha256' }
}

// The existing service checks ownership before calling this file interface.
// No Cloudinary delivery URL or signature is stored in Firestore or sent to the browser.
export function createCloudinaryBucket(source, { sdk = cloudinary, fetchImpl = fetch, now = Date.now } = {}) {
  const options = cloudinaryOptions(source)
  const created = new Set()
  const unavailable = () => new HttpError(503, 'image_storage_unavailable', 'No pudimos completar la operación con la imagen. Inténtalo de nuevo.')
  return {
    file(path) {
      if (typeof path !== 'string' || !/^publications\/[a-z0-9_-]+\/[a-z0-9_-]+\.webp$/i.test(path)) {
        throw new HttpError(400, 'invalid_image_path', 'La referencia de la imagen no es válida.')
      }
      const publicId = 'otherbloc/' + source.FIREBASE_PROJECT_ID + '/' + path.slice(0, -5)
      return {
        async save(bytes) {
          if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES) throw unavailable()
          try {
            const result = await sdk.uploader.upload('data:image/webp;base64,' + bytes.toString('base64'),
              { ...options, public_id: publicId, asset_folder: 'otherbloc', overwrite: false, unique_filename: false })
            if (result.existing) throw unavailable()
            if (result.public_id !== publicId || result.type !== 'authenticated' || result.resource_type !== 'image' || result.format !== 'webp') throw unavailable()
            created.add(path)
          } catch { throw unavailable() }
        },
        async download() {
          try {
            const timestamp = Math.floor(now() / 1000)
            const url = sdk.utils.private_download_url(publicId, 'webp', { ...options, timestamp, expires_at: timestamp + 60, attachment: false })
            const target = new URL(url)
            if (target.origin !== 'https://api.cloudinary.com' || target.pathname !== '/v1_1/' + options.cloud_name + '/image/download') throw unavailable()
            const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000), redirect: 'error', headers: { Accept: 'image/webp' } })
            if (response.status === 404) {
              await response.body?.cancel()
              throw new HttpError(404, 'image_not_found', 'No encontramos esta imagen.')
            }
            if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'image/webp'
              || Number(response.headers.get('content-length')) > MAX_BYTES) {
              await response.body?.cancel()
              throw unavailable()
            }
            if (!response.body) throw unavailable()
            const chunks = []
            let size = 0
            for await (const chunk of response.body) {
              size += chunk.length
              if (size > MAX_BYTES) throw unavailable()
              chunks.push(chunk)
            }
            if (!size) throw unavailable()
            return [Buffer.concat(chunks)]
          } catch (error) {
            if (error instanceof HttpError && error.status === 404) throw error
            throw unavailable()
          }
        },
        async delete() {
          // Cleanup may only remove assets confirmed as newly created by this operation.
          // An ambiguous upload failure is left for manual review, never retried/destructively guessed.
          if (!created.has(path)) return
          try {
            await sdk.uploader.destroy(publicId, { ...options, invalidate: true })
            created.delete(path)
          } catch { throw unavailable() }
        },
      }
    },
  }
}
