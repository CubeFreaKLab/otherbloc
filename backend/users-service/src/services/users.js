import { randomUUID } from 'node:crypto'
import { FieldPath } from 'firebase-admin/firestore'
import sharp from 'sharp'
import { getFirebase } from '../config/firebase.js'
import { fail } from '../lib/errors.js'
import { hashPassword, verifyPassword } from '../lib/passwords.js'
import { accessToken, constantEqual, digest, nextRefresh, readAccess, refreshSessionId, sessionMaterial } from '../lib/sessions.js'
import { privateUser, publicUser } from '../models/user.js'

export function createUsersService({ config, firebase = getFirebase, now = Date.now }) {
  const clients = () => typeof firebase === 'function' ? firebase() : firebase
  const userRef = (id) => clients().db.collection('users').doc(id)
  const sessionRef = (id) => clients().db.collection('userSessions').doc(id)
  const emailRef = (email) => clients().db.collection('userEmails').doc(digest(email))
  const securityRef = () => clients().db.collection('userSecurity').doc('platform')
  const withId = (snapshot) => snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null

  function checkActor(user, session, identity) {
    if (!user || user.status !== 'active' || user.authVersion !== identity.authVersion || !session || session.userId !== user.id
      || session.authVersion !== user.authVersion || session.revokedAt !== null || session.expiresAtMs <= now()) {
      fail(401, 'invalid_session', 'Tu sesión ya no está activa. Inicia sesión de nuevo.')
    }
    return user
  }

  async function transactionActor(transaction, identity) {
    const [user, session] = await transaction.getAll(userRef(identity.id), sessionRef(identity.sid))
    return checkActor(withId(user), session.data(), identity)
  }

  function authResult(user, sid, refreshToken, expiresAtMs) {
    return { user: privateUser(user), accessToken: accessToken(user, sid, now(), config), expiresIn: config.accessSeconds,
      refreshToken, expiresAtMs }
  }

  function newUser(input, role = 'reader', id = randomUUID()) {
    const time = new Date(now()).toISOString()
    return { id, name: input.name, email: input.email, role, status: 'active', biography: input.biography ?? '',
      avatarId: null, authorRequested: false, authVersion: 0, createdAt: time, updatedAt: time }
  }

  return {
    async register(input) {
      const user = { ...newUser(input), passwordHash: await hashPassword(input.password) }
      const session = sessionMaterial(user, now(), config)
      const batch = clients().db.batch()
      batch.create(emailRef(user.email), { userId: user.id })
      batch.create(userRef(user.id), user)
      batch.create(sessionRef(session.sid), session.data)
      try { await batch.commit() } catch (error) {
        if (error.code === 6) fail(409, 'email_unavailable', 'No se puede registrar este correo. Si ya tienes cuenta, inicia sesión.')
        throw error
      }
      return authResult(user, session.sid, session.refreshToken, session.data.expiresAtMs)
    },

    async login(input) {
      const email = await emailRef(input.email).get()
      const user = email.exists ? withId(await userRef(email.data().userId).get()) : null
      const matches = await verifyPassword(input.password, user?.passwordHash)
      if (!matches || !user || user.status !== 'active') fail(401, 'invalid_credentials', 'El correo o la contraseña no son correctos.')
      const session = sessionMaterial(user, now(), config)
      const current = await clients().db.runTransaction(async (transaction) => {
        const currentUser = withId(await transaction.get(userRef(user.id)))
        if (!currentUser || currentUser.passwordHash !== user.passwordHash || currentUser.status !== 'active'
          || currentUser.authVersion !== user.authVersion) fail(401, 'invalid_credentials', 'Vuelve a iniciar sesión.')
        transaction.create(sessionRef(session.sid), session.data)
        return currentUser
      })
      return authResult(current, session.sid, session.refreshToken, session.data.expiresAtMs)
    },

    async authenticate(header) {
      const identity = readAccess(header, now(), config)
      const [user, session] = await clients().db.getAll(userRef(identity.id), sessionRef(identity.sid))
      const current = checkActor(withId(user), session.data(), identity)
      return { ...identity, user: current }
    },

    async refresh(token) {
      const sid = refreshSessionId(token)
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const snapshot = await sessionRef(sid).get()
        const session = snapshot.data()
        if (!session || session.revokedAt !== null || session.expiresAtMs <= now()) fail(401, 'invalid_session', 'Inicia sesión de nuevo.')
        const user = withId(await userRef(session.userId).get())
        checkActor(user, session, { authVersion: session.authVersion })
        let resultToken = token
        const hash = digest(token)
        if (constantEqual(hash, session.refreshHash)) {
          if (now() >= session.rotateAfter) {
            resultToken = nextRefresh(token, config.jwtSecret)
            try {
              await snapshot.ref.update({ refreshHash: digest(resultToken), previousHash: hash, previousUntil: now() + 30000, rotateAfter: now() + 60000 }, { lastUpdateTime: snapshot.updateTime })
            } catch (error) {
              if ([9, 10].includes(error.code)) continue
              throw error
            }
          }
        } else if (session.previousUntil >= now() && constantEqual(hash, session.previousHash)) {
          // Simultaneous requests receive the same successor; only hashes are stored.
          resultToken = nextRefresh(token, config.jwtSecret)
          if (!constantEqual(digest(resultToken), session.refreshHash)) fail(401, 'invalid_session', 'Inicia sesión de nuevo.')
        } else fail(401, 'invalid_session', 'Inicia sesión de nuevo.')
        return authResult(user, sid, resultToken, session.expiresAtMs)
      }
      fail(409, 'session_changed', 'La sesión cambió en otra pestaña. Inténtalo de nuevo.')
    },

    async logout(token, header) {
      if (header) {
        let identity
        try { identity = readAccess(header, now(), config) } catch { /* An expired access token does not prevent cookie logout. */ }
        if (identity) {
          await clients().db.runTransaction(async (transaction) => {
            const record = await transaction.get(sessionRef(identity.sid))
            if (record.exists && record.data().userId === identity.id) transaction.update(record.ref, { revokedAt: now() })
          })
        }
      }
      if (!token) return
      let sid
      try { sid = refreshSessionId(token) } catch { return }
      await clients().db.runTransaction(async (transaction) => {
        const record = await transaction.get(sessionRef(sid))
        const value = record.data()
        if (value && (constantEqual(digest(token), value.refreshHash) || constantEqual(digest(token), value.previousHash))) {
          transaction.update(record.ref, { revokedAt: now() })
        }
      })
    },

    async getPublic(id) {
      const user = withId(await userRef(id).get())
      if (!user || user.status !== 'active') fail(404, 'user_not_found', 'No encontramos este perfil.')
      return publicUser(user)
    },

    async updateProfile(identity, input) {
      return clients().db.runTransaction(async (transaction) => {
        const user = await transactionActor(transaction, identity)
        const changes = { ...input, updatedAt: new Date(now()).toISOString() }
        transaction.update(userRef(user.id), changes)
        return privateUser({ ...user, ...changes })
      })
    },

    async requestAuthor(identity) {
      return clients().db.runTransaction(async (transaction) => {
        const user = await transactionActor(transaction, identity)
        if (user.role !== 'reader') fail(409, 'already_author', 'Esta cuenta ya tiene permisos editoriales.')
        transaction.update(userRef(user.id), { authorRequested: true, updatedAt: new Date(now()).toISOString() })
        return privateUser({ ...user, authorRequested: true })
      })
    },

    async changePassword(identity, input) {
      if (!await verifyPassword(input.currentPassword, identity.user.passwordHash)) fail(400, 'incorrect_password', 'La contraseña actual no es correcta.')
      const passwordHash = await hashPassword(input.password)
      await clients().db.runTransaction(async (transaction) => {
        const user = await transactionActor(transaction, identity)
        if (user.passwordHash !== identity.user.passwordHash) fail(409, 'account_changed', 'Tu cuenta cambió. Vuelve a iniciar sesión.')
        transaction.update(userRef(user.id), { passwordHash, authVersion: user.authVersion + 1, updatedAt: new Date(now()).toISOString() })
      })
    },

    async list(identity, { limit, cursor }) {
      if (identity.user.role !== 'admin') fail(403, 'forbidden', 'Solo administración puede consultar las cuentas.')
      let query = clients().db.collection('users').orderBy(FieldPath.documentId()).limit(limit + 1)
      if (cursor) query = query.startAfter(cursor)
      const result = await query.get()
      return { items: result.docs.slice(0, limit).map((doc) => privateUser(withId(doc))), nextCursor: result.size > limit ? result.docs[limit - 1].id : null }
    },

    async updatePermissions(identity, id, input) {
      return clients().db.runTransaction(async (transaction) => {
        const actor = await transactionActor(transaction, identity)
        if (actor.role !== 'admin') fail(403, 'forbidden', 'Solo administración puede cambiar permisos.')
        if (id === actor.id) fail(403, 'self_permission_change', 'No puedes cambiar tus propios permisos o estado.')
        const [targetSnapshot, security] = await transaction.getAll(userRef(id), securityRef())
        const target = withId(targetSnapshot)
        if (!target) fail(404, 'user_not_found', 'No encontramos esta cuenta.')
        const wasAdmin = target.role === 'admin' && target.status === 'active'
        const becomesAdmin = input.role === 'admin' && input.status === 'active'
        const count = (security.data()?.activeAdmins ?? 0) + Number(becomesAdmin) - Number(wasAdmin)
        if (count < 1) fail(409, 'last_admin', 'Debe quedar al menos un administrador activo.')
        const changed = target.role !== input.role || target.status !== input.status
        const changes = { ...input, authorRequested: false, authVersion: target.authVersion + Number(changed), updatedAt: new Date(now()).toISOString() }
        transaction.update(targetSnapshot.ref, changes)
        transaction.set(securityRef(), { activeAdmins: count })
        return privateUser({ ...target, ...changes })
      })
    },

    async uploadAvatar(identity, bytes, contentType) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) fail(415, 'invalid_image_type', 'Usa una imagen JPEG, PNG o WebP.')
      if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 2 * 1024 * 1024) fail(413, 'image_too_large', 'El avatar debe pesar como máximo 2 MB.')
      let output
      try {
        const image = sharp(bytes, { limitInputPixels: 16000000, animated: false, failOn: 'warning' })
        const metadata = await image.metadata()
        const mime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[metadata.format]
        if (mime !== contentType || metadata.width < 32 || metadata.height < 32 || (metadata.pages ?? 1) > 1) throw new Error('format')
        output = await image.rotate().resize(512, 512, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
      } catch { fail(415, 'invalid_image', 'No se pudo leer la imagen. Usa un JPEG, PNG o WebP estático de al menos 32 × 32 píxeles.') }
      const id = randomUUID()
      const path = 'avatars/' + identity.id + '/' + id + '.webp'
      const { db, bucket } = clients()
      const file = bucket.file(path)
      await file.save(output, { resumable: false, metadata: { contentType: 'image/webp', cacheControl: 'private, no-store' } })
      let result
      try {
        result = await db.runTransaction(async (transaction) => {
          const user = await transactionActor(transaction, identity)
          transaction.create(db.collection('userAvatars').doc(id), { userId: user.id, path, size: output.length, contentType: 'image/webp', createdAt: new Date(now()).toISOString() })
          transaction.update(userRef(user.id), { avatarId: id, updatedAt: new Date(now()).toISOString() })
          return { user: privateUser({ ...user, avatarId: id }), previous: user.avatarId }
        })
      } catch (error) {
        await file.delete({ ignoreNotFound: true }).catch(() => {})
        throw error
      }
      // Old objects remain private until a maintenance pass; no cross-system atomic delete is assumed.
      return result.user
    },

    async removeAvatar(identity) {
      return clients().db.runTransaction(async (transaction) => {
        const user = await transactionActor(transaction, identity)
        transaction.update(userRef(user.id), { avatarId: null, updatedAt: new Date(now()).toISOString() })
        return privateUser({ ...user, avatarId: null })
      })
    },

    async avatar(id, requestedVersion) {
      const user = withId(await userRef(id).get())
      if (!user || user.status !== 'active' || !user.avatarId || (requestedVersion && requestedVersion !== user.avatarId)) fail(404, 'avatar_not_found', 'No hay un avatar disponible.')
      const record = await clients().db.collection('userAvatars').doc(user.avatarId).get()
      if (!record.exists || record.data().userId !== id) fail(404, 'avatar_not_found', 'No hay un avatar disponible.')
      const [bytes] = await clients().bucket.file(record.data().path).download()
      return bytes
    },

    async seed(input) {
      // Only invoked by the local seed command. Never exposed as an HTTP route.
      const existing = await emailRef(input.email).get()
      if (existing.exists) {
        const user = withId(await userRef(existing.data().userId).get())
        if (!user?.demo || user.id !== input.id) fail(409, 'seed_conflict', 'Seed email belongs to a different account; no data changed.')
        return { id: user.id, created: false }
      }
      const user = { ...newUser(input, input.role, input.id), passwordHash: await hashPassword(input.password), demo: true }
      return clients().db.runTransaction(async (transaction) => {
        const [email, target, security] = await transaction.getAll(emailRef(user.email), userRef(user.id), securityRef())
        if (email.exists || target.exists) fail(409, 'seed_conflict', 'Seed identifiers already exist; no data changed.')
        transaction.create(emailRef(user.email), { userId: user.id })
        transaction.create(userRef(user.id), user)
        if (user.role === 'admin') transaction.set(securityRef(), { activeAdmins: (security.data()?.activeAdmins ?? 0) + 1 })
        return { id: user.id, created: true }
      })
    },
  }
}
