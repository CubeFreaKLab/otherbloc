import { FieldPath, FieldValue } from 'firebase-admin/firestore'
import { setTimeout as delay } from 'node:timers/promises'
import { getFirebase } from '../config/firebase.js'
import { fail, parse, requireIdentity } from '../lib/errors.js'
import { commentJson, commentSchema, connection, idSchema, pagination, relationId, userIdSchema } from '../models/interaction.js'

const collision = (error) => [6, 9, 10, 'already-exists', 'failed-precondition', 'aborted'].includes(error.code)

export function createInteractionService({ firebase = getFirebase, now = () => new Date() } = {}) {
  const db = () => (typeof firebase === 'function' ? firebase() : firebase).db
  const time = () => now().toISOString()
  async function atomic(operation) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { return await operation() } catch (error) {
        if (!collision(error)) throw error
        if (attempt === 4) fail('CONFLICT', 'Hay cambios simultáneos. Vuelve a intentarlo.')
        await delay(10 * (attempt + 1))
      }
    }
  }
  const statsRef = (id) => db().collection('publicationInteractionStats').doc(id)
  function increment(batch, reference, field, amount) {
    batch.set(reference, { [field]: FieldValue.increment(amount), updatedAt: time() }, { merge: true })
  }
  async function setRelation(collection, identity, targetField, targetId, active, counter = null) {
    return atomic(async () => {
      const reference = db().collection(collection).doc(relationId(identity.id, targetId))
      const snapshot = await reference.get(), previous = snapshot.data()
      if (Boolean(previous?.active) === active) return { active }
      const batch = db().batch()
      const value = { userId: identity.id, [targetField]: targetId, active, updatedAt: time(), createdAt: previous?.createdAt ?? time() }
      if (snapshot.exists) batch.update(reference, value, { lastUpdateTime: snapshot.updateTime })
      else batch.create(reference, value)
      if (counter) increment(batch, counter.reference, counter.field, active ? 1 : -1)
      await batch.commit()
      return { active }
    })
  }
  async function ownRelations(collection, identity, input) {
    requireIdentity(identity)
    const scope = collection + ':' + identity.id, { limit, after } = pagination(input, scope)
    let query = db().collection(collection).where('userId', '==', identity.id).where('active', '==', true).orderBy('updatedAt', 'desc').orderBy(FieldPath.documentId())
    if (after) query = query.startAfter(after.time, after.id)
    return connection(await query.limit(limit + 1).get(), limit, scope, 'updatedAt')
  }
  const relation = async (collection, identity, target) => identity ? Boolean((await db().collection(collection).doc(relationId(identity.id, target)).get()).data()?.active) : false

  return {
    async publicationStats(publicationId) {
      const value = (await statsRef(parse(idSchema, publicationId)).get()).data()
      return { commentCount: value?.commentCount ?? 0, reactionCount: value?.reactionCount ?? 0 }
    },
    async authorStats(authorId) {
      return { followerCount: (await db().collection('authorInteractionStats').doc(parse(userIdSchema, authorId)).get()).data()?.followerCount ?? 0 }
    },
    async comments(publicationId, input) {
      const scope = 'comments:' + parse(idSchema, publicationId), { limit, after } = pagination(input, scope)
      let query = db().collection('comments').where('publicationId', '==', publicationId).where('isDeleted', '==', false).orderBy('createdAt').orderBy(FieldPath.documentId())
      if (after) query = query.startAfter(after.time, after.id)
      return connection(await query.limit(limit + 1).get(), limit, scope, 'createdAt', commentJson)
    },
    async addComment(identity, input) {
      requireIdentity(identity)
      const value = parse(commentSchema, input)
      return atomic(async () => {
        const reference = db().collection('comments').doc(value.id), snapshot = await reference.get()
        if (snapshot.exists) {
          const existing = snapshot.data()
          if (existing.userId !== identity.id || existing.publicationId !== value.publicationId || existing.text !== value.text || existing.isDeleted) fail('CONFLICT', 'Este intento de comentario ya fue utilizado. Recarga los comentarios antes de enviarlo otra vez.')
          return commentJson({ ...existing, id: snapshot.id })
        }
        const comment = { ...value, userId: identity.id, createdAt: time(), isDeleted: false, deletedAt: null }
        const batch = db().batch()
        batch.create(reference, comment)
        increment(batch, statsRef(value.publicationId), 'commentCount', 1)
        await batch.commit()
        return commentJson(comment)
      })
    },
    async deleteComment(identity, id) {
      requireIdentity(identity)
      return atomic(async () => {
        const reference = db().collection('comments').doc(parse(idSchema, id)), snapshot = await reference.get()
        if (!snapshot.exists) fail('NOT_FOUND', 'No encontramos este comentario.')
        const value = snapshot.data()
        if (value.userId !== identity.id) fail('FORBIDDEN', 'Solo puedes eliminar tus propios comentarios.')
        if (value.isDeleted) return true
        const batch = db().batch()
        batch.update(reference, { isDeleted: true, deletedAt: time() }, { lastUpdateTime: snapshot.updateTime })
        increment(batch, statsRef(value.publicationId), 'commentCount', -1)
        await batch.commit()
        return true
      })
    },
    async react(identity, publicationId, active) {
      requireIdentity(identity); parse(idSchema, publicationId)
      return setRelation('reactions', identity, 'publicationId', publicationId, active, { reference: statsRef(publicationId), field: 'reactionCount' })
    },
    async save(identity, publicationId, active) {
      requireIdentity(identity); parse(idSchema, publicationId)
      return setRelation('savedPublications', identity, 'publicationId', publicationId, active)
    },
    async follow(identity, authorId, active) {
      requireIdentity(identity); parse(userIdSchema, authorId)
      if (identity.id === authorId) fail('BAD_USER_INPUT', 'No puedes seguir tu propio perfil.')
      return setRelation('follows', identity, 'authorId', authorId, active, { reference: db().collection('authorInteractionStats').doc(authorId), field: 'followerCount' })
    },
    saved: (identity, publicationId) => relation('savedPublications', identity, publicationId),
    reacted: (identity, publicationId) => relation('reactions', identity, publicationId),
    following: (identity, authorId) => relation('follows', identity, authorId),
    savedPublications: (identity, input) => ownRelations('savedPublications', identity, input),
    followingAuthors: (identity, input) => ownRelations('follows', identity, input),
  }
}
