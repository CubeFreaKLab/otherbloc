import { randomUUID } from 'node:crypto'
import { FieldPath } from 'firebase-admin/firestore'
import sharp from 'sharp'
import { getFirebase } from '../config/firebase.js'
import { fail } from '../lib/errors.js'
import { imageVariants, saveImage, variantRecords } from '../lib/images.js'
import { assetsIn, decodeCursor, encodeCursor, normalize, publicationJson, requirePublishable, searchFields } from '../models/publication.js'

export function createPublicationsService({ firebase = getFirebase, now = Date.now } = {}) {
  const clients = () => typeof firebase === 'function' ? firebase() : firebase
  const collection = () => clients().db.collection('publications')
  const assetRef = (id) => clients().db.collection('publicationAssets').doc(id)
  const withId = (snapshot) => snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null
  const time = () => new Date(now()).toISOString()
  function authorOnly(identity) {
    if (!identity || !['author', 'admin'].includes(identity.role)) fail(403, 'author_required', 'Necesitas permisos de autor para crear publicaciones.')
  }
  function exists(publication) {
    if (!publication || publication.isDeleted) fail(404, 'publication_not_found', 'No encontramos esta publicación.')
    return publication
  }
  function owns(publication, identity) {
    authorOnly(identity)
    if (publication.authorId !== identity.id) fail(403, 'not_publication_owner', 'Solo su autor puede modificar esta publicación.')
  }
  function canRead(publication, identity) {
    exists(publication)
    if (publication.isPublic || publication.authorId === identity?.id || (identity?.role === 'admin' && publication.status !== 'draft')) return
    fail(404, 'publication_not_found', 'No encontramos esta publicación.')
  }
  function version(publication, expected) {
    if (publication.version !== expected) fail(409, 'version_conflict', 'La publicación cambió en otra pestaña. Conserva tus cambios y recarga la versión del servidor antes de volver a guardar.')
  }
  async function validateAssets(reader, publication) {
    const ids = assetsIn(publication)
    if (!ids.length) return new Map()
    const records = await reader.getAll(...ids.map(assetRef))
    if (records.some((record) => !record.exists || record.data().publicationId !== publication.id || record.data().authorId !== publication.authorId)) {
      fail(400, 'invalid_asset_reference', 'Una imagen no pertenece a esta publicación o ya no está disponible.')
    }
    return new Map(records.map((record) => [record.id, record.data()]))
  }
  function audit(transaction, publication, identity, from, to, reason) {
    transaction.create(collection().doc(publication.id).collection('history').doc(randomUUID()), { actorId: identity.id, from, to, reason, at: time(), version: publication.version + 1 })
  }
  async function commitVersioned(batch) {
    try { await batch.commit() } catch (error) {
      if (error.code === 9 || error.code === 5) fail(409, 'version_conflict', 'La publicación cambió en otra pestaña. Conserva tus cambios y recarga la versión del servidor antes de volver a guardar.')
      throw error
    }
  }
  function initial(id, identity, title, demo = false) {
    const value = { id, authorId: identity.id, authorName: identity.name, title, summary: '', coverId: null, coverAlt: '', type: 'Artículo', category: 'Cultura', tags: [], blocks: [],
      status: 'draft', isPublic: false, isDeleted: false, deletedAt: null, version: 1, readingMinutes: 1, createdAt: time(), updatedAt: time(),
      publishedAt: null, firstPublishedAt: null, archivedAt: null, moderationNote: null, demo }
    return { ...value, ...searchFields(value, identity.name) }
  }

  async function listing(kind, identity, input) {
    const scope = JSON.stringify({ kind, owner: kind === 'mine' ? identity.id : undefined, category: input.category, type: input.type, authorId: input.authorId, status: input.status, q: normalize(input.q ?? '') })
    const cursor = decodeCursor(input.cursor, scope)
    const order = kind === 'public' ? 'publishedAt' : 'updatedAt'
    let query = collection()
    if (kind === 'public') query = query.where('isPublic', '==', true)
    else query = query.where('isDeleted', '==', false)
    if (kind === 'mine') query = query.where('authorId', '==', identity.id)
    if (input.status) query = query.where('status', '==', input.status)
    for (const key of ['category', 'type', 'authorId']) if (input[key]) query = query.where(key, '==', input[key])
    const terms = normalize(input.q ?? '').split(' ').filter(Boolean)
    if (terms.length) query = query.where('searchTerms', 'array-contains', [...terms].sort((a, b) => b.length - a.length)[0].slice(0, 24))
    query = query.orderBy(order, 'desc').orderBy(FieldPath.documentId(), 'asc')
    if (cursor) query = query.startAfter(cursor.time, cursor.id)
    if (!terms.length) {
      const result = await query.limit(input.limit + 1).get()
      const items = result.docs.slice(0, input.limit)
      const last = items.at(-1)
      return { items: items.map((doc) => publicationJson(withId(doc), { privateFields: kind !== 'public' })), nextCursor: result.size > input.limit ? encodeCursor(last.data()[order], last.id, scope) : null }
    }
    const items = []
    let scanned = 0, last = null, more = false
    while (scanned < 200 && items.length < input.limit) {
      const batchSize = Math.min(200 - scanned, Math.max(24, input.limit * 2))
      const result = await query.limit(batchSize).get()
      more = result.size === batchSize
      for (let index = 0; index < result.docs.length; index += 1) {
        const doc = result.docs[index]
        last = doc; scanned += 1
        const value = withId(doc)
        const words = value.searchText.split(' ')
        if (terms.every((term) => words.some((word) => word.startsWith(term)))) items.push(publicationJson(value))
        if (items.length === input.limit) { more ||= index < result.docs.length - 1; break }
      }
      if (!more || !last) break
      query = query.startAfter(last.data()[order], last.id)
    }
    return { items, nextCursor: more && last ? encodeCursor(last.data()[order], last.id, scope) : null, searchMode: 'metadata-word-prefixes', scanned }
  }

  return {
    async create(identity, input) {
      authorOnly(identity)
      const publication = initial(input.id, identity, input.title)
      try { await collection().doc(publication.id).create(publication) } catch (error) {
        if (error.code !== 6) throw error
        const existing = withId(await collection().doc(publication.id).get())
        if (existing?.authorId !== identity.id || existing?.isDeleted) fail(409, 'creation_id_unavailable', 'No se puede reutilizar este identificador de creación.')
        return { publication: publicationJson(existing, { detail: true, privateFields: true }), created: false }
      }
      return { publication: publicationJson(publication, { detail: true, privateFields: true }), created: true }
    },

    async get(id, identity) {
      const publication = withId(await collection().doc(id).get())
      canRead(publication, identity)
      return publicationJson(publication, { detail: true, privateFields: publication.authorId === identity?.id || identity?.role === 'admin' })
    },

    async update(id, identity, input, expected) {
      authorOnly(identity)
      const db = clients().db
      const reference = collection().doc(id)
      const snapshot = await reference.get()
      const publication = exists(withId(snapshot))
      owns(publication, identity); version(publication, expected)
      if (publication.status !== 'draft') fail(409, 'draft_required', 'Solo se pueden editar borradores. Retira la revisión o recupera el archivo primero.')
      const words = input.blocks.flatMap((item) => item.type === 'list' ? item.items : item.text ?? item.caption ?? '').join(' ').trim().split(/\s+/).filter(Boolean).length
      const changes = { ...input, ...searchFields(input, identity.name), authorName: identity.name, readingMinutes: Math.max(1, Math.ceil(words / 220)), updatedAt: time(), moderationNote: null, version: publication.version + 1 }
      const updated = { ...publication, ...changes }
      const assets = await validateAssets(db, updated)
      const cover = assets.get(input.coverId)
      Object.assign(changes, { coverWidth: cover?.width ?? null, coverHeight: cover?.height ?? null })
      Object.assign(updated, changes)
      const batch = db.batch()
      batch.update(reference, changes, { lastUpdateTime: snapshot.updateTime })
      await commitVersioned(batch)
      return publicationJson(updated, { detail: true, privateFields: true })
    },

    async transition(id, identity, input, expected) {
      if (!identity) fail(401, 'authentication_required', 'Inicia sesión para continuar.')
      const db = clients().db
      const reference = collection().doc(id)
      const snapshot = await reference.get()
      const publication = exists(withId(snapshot))
      const owner = publication.authorId === identity.id && ['author', 'admin'].includes(identity.role)
      const admin = identity.role === 'admin'
      if (!owner && !admin) fail(403, 'forbidden', 'No tienes permiso para cambiar el estado de esta publicación.')
      canRead(publication, identity)
      if (input.status === 'published' && !admin) fail(403, 'moderator_required', 'Solo administración puede aprobar la publicación.')
      if (publication.status === input.status) return publicationJson(publication, { detail: true, privateFields: true })
      version(publication, expected)
      const from = publication.status, to = input.status
      const allowed = (owner && from === 'draft' && to === 'review') || (from === 'review' && to === 'draft' && (owner || admin))
        || (admin && from === 'review' && to === 'published') || ((owner || admin) && from === 'published' && to === 'archived')
        || (owner && from === 'archived' && to === 'draft')
      if (!allowed) fail(409, 'invalid_transition', 'No se permite este cambio de estado.')
      if (!owner && (to === 'draft' || to === 'archived') && !input.reason) fail(400, 'moderation_reason_required', 'Explica el motivo de esta decisión de moderación.')
      if (to === 'review' || to === 'published') { requirePublishable(publication); await validateAssets(db, publication) }
      const changes = { status: to, isPublic: to === 'published', version: publication.version + 1, updatedAt: time(),
        moderationNote: ['draft', 'archived'].includes(to) && admin && !owner ? { reason: input.reason, at: time() } : null }
      if (to === 'published') Object.assign(changes, { publishedAt: time(), firstPublishedAt: publication.firstPublishedAt ?? time() })
      if (to === 'archived') changes.archivedAt = time()
      if (from === 'archived') changes.archivedAt = null
      const batch = db.batch()
      batch.update(reference, changes, { lastUpdateTime: snapshot.updateTime })
      audit(batch, publication, identity, from, to, input.reason)
      await commitVersioned(batch)
      return publicationJson({ ...publication, ...changes }, { detail: true, privateFields: true })
    },

    async remove(id, identity, expected) {
      authorOnly(identity)
      const db = clients().db
      const reference = collection().doc(id)
      const snapshot = await reference.get()
      const publication = withId(snapshot)
      if (!publication) fail(404, 'publication_not_found', 'No encontramos esta publicación.')
      owns(publication, identity)
      if (publication.isDeleted) return
      version(publication, expected)
      if (!['draft', 'archived'].includes(publication.status)) fail(409, 'cannot_delete_active_publication', 'Archiva la publicación o retírala a borrador antes de eliminarla.')
      const batch = db.batch()
      batch.update(reference, { isDeleted: true, isPublic: false, deletedAt: time(), updatedAt: time(), version: publication.version + 1 }, { lastUpdateTime: snapshot.updateTime })
      audit(batch, publication, identity, publication.status, publication.status, 'Eliminación lógica por su autor')
      await commitVersioned(batch)
    },

    listPublic(input) { return listing('public', null, input) },
    listMine(identity, input) { authorOnly(identity); return listing('mine', identity, input) },
    listModeration(identity, input) {
      if (identity?.role !== 'admin') fail(403, 'moderator_required', 'Solo administración puede moderar publicaciones.')
      return listing('moderation', identity, input)
    },

    async upload(id, identity, bytes, contentType) {
      authorOnly(identity)
      const publication = exists(withId(await collection().doc(id).get()))
      owns(publication, identity)
      if (publication.status !== 'draft') fail(409, 'draft_required', 'Solo se pueden subir imágenes a un borrador.')
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) fail(415, 'invalid_image_type', 'Usa imágenes JPEG, PNG o WebP.')
      if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 5 * 1024 * 1024) fail(413, 'image_too_large', 'La imagen admite como máximo 5 MB.')
      let output, dimensions
      try {
        const source = sharp(bytes, { limitInputPixels: 24000000, animated: false, failOn: 'warning' })
        const metadata = await source.metadata()
        if ({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[metadata.format] !== contentType || metadata.width < 32 || metadata.height < 32 || (metadata.pages ?? 1) > 1) throw new Error('image')
        const converted = await source.rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true })
        output = converted.data; dimensions = { width: converted.info.width, height: converted.info.height }
      } catch { fail(415, 'invalid_image', 'No se pudo leer la imagen. Usa un JPEG, PNG o WebP estático de al menos 32 × 32 píxeles.') }
      const assetId = randomUUID(), path = 'publications/' + id + '/' + assetId + '.webp'
      const bucket = clients().bucket
      const variants = await imageVariants(output, path, dimensions.width)
      const paths = [path, ...variants.map((variant) => variant.path)]
      try {
        await saveImage(bucket, path, output)
        for (const variant of variants) await saveImage(bucket, variant.path, variant.bytes)
        await clients().db.runTransaction(async (transaction) => {
          const current = exists(withId(await transaction.get(collection().doc(id))))
          owns(current, identity)
          if (current.status !== 'draft') fail(409, 'draft_required', 'El borrador cambió de estado durante la subida.')
          transaction.create(assetRef(assetId), { publicationId: id, authorId: identity.id, path, size: output.length, contentType: 'image/webp', ...dimensions, variants: variantRecords(variants), createdAt: time() })
        })
      } catch (error) { await Promise.all(paths.map((path) => bucket.file(path).delete({ ignoreNotFound: true }).catch(() => {}))); throw error }
      return { id: assetId, ...dimensions, size: output.length, url: '/api/publications/' + id + '/media/' + assetId }
    },

    async media(id, imageId, identity, width) {
      const publication = exists(withId(await collection().doc(id).get()))
      const attached = assetsIn(publication).includes(imageId)
      const owner = publication.authorId === identity?.id
      const moderator = identity?.role === 'admin' && publication.status !== 'draft'
      if (!(publication.isPublic && attached) && !owner && !(moderator && attached)) fail(404, 'image_not_found', 'No encontramos esta imagen.')
      const asset = await assetRef(imageId).get()
      if (!asset.exists || asset.data().publicationId !== id || asset.data().authorId !== publication.authorId) fail(404, 'image_not_found', 'No encontramos esta imagen.')
      const [bytes] = await clients().bucket.file(asset.data().variants?.[width]?.path ?? asset.data().path).download()
      return { bytes, public: publication.isPublic && attached }
    },

    async prepareSeedImages(id, identity) {
      const reference = collection().doc(id), snapshot = await reference.get()
      const publication = exists(withId(snapshot))
      owns(publication, identity)
      if (!publication.demo) fail(409, 'seed_conflict', 'Only demo publication assets can be prepared by the seed.')
      const assets = await validateAssets(clients().db, publication)
      for (const [assetId, asset] of assets) {
        if (asset.variants) continue
        const [bytes] = await clients().bucket.file(asset.path).download()
        const variants = await imageVariants(bytes, asset.path, asset.width)
        for (const variant of variants) await saveImage(clients().bucket, variant.path, variant.bytes)
        await assetRef(assetId).update({ variants: variantRecords(variants) })
      }
      const cover = assets.get(publication.coverId)
      if (cover && (!publication.coverWidth || !publication.coverHeight)) await reference.update({ coverWidth: cover.width, coverHeight: cover.height }, { lastUpdateTime: snapshot.updateTime })
    },

    async seedDraft(id, identity) {
      authorOnly(identity)
      const reference = collection().doc(id)
      const existing = await reference.get()
      if (existing.exists) {
        if (!existing.data().demo || existing.data().authorId !== identity.id) fail(409, 'seed_conflict', 'Seed ID belongs to another publication.')
        return { created: false, publication: publicationJson(withId(existing), { detail: true, privateFields: true }) }
      }
      const value = initial(id, identity, '', true)
      await reference.create(value)
      return { created: true, publication: publicationJson(value, { detail: true, privateFields: true }) }
    },
  }
}
