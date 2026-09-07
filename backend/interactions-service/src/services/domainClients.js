import jwt from 'jsonwebtoken'
import { fail, parse } from '../lib/errors.js'
import { idSchema, userIdSchema } from '../models/interaction.js'

export function createDomainClients(config, fetchImpl = fetch) {
  async function request(base, path, authorization, { missing = false, identity = false } = {}) {
    let response, value
    try {
      response = await fetchImpl(new URL(path, base), { headers: { 'X-Service-Key': config.serviceAuthSecret, ...(authorization ? { Authorization: authorization } : {}) }, signal: AbortSignal.timeout(config.upstreamTimeoutMs), redirect: 'error' })
    } catch { fail('SERVICE_UNAVAILABLE', 'No se pudo consultar el servicio propietario. Inténtalo de nuevo.') }
    if (response.status === 404 && missing) return null
    if (response.status === 401 && identity) fail('UNAUTHENTICATED', 'Tu sesión ya no está activa. Vuelve a entrar.')
    if (!response.ok) fail('SERVICE_UNAVAILABLE', 'El servicio propietario no está disponible. Inténtalo de nuevo.')
    try { value = await response.json() } catch { fail('SERVICE_UNAVAILABLE', 'El servicio propietario devolvió una respuesta no válida.') }
    return value
  }

  return {
    async authenticate(header) {
      if (!header) return null
      let claims
      try {
        if (!header.startsWith('Bearer ')) throw new Error('token')
        claims = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ['HS256'], issuer: 'otherbloc-users', audience: 'otherbloc-platform' })
        if (claims.kind !== 'access' || typeof claims.sub !== 'string' || typeof claims.sid !== 'string' || typeof claims.exp !== 'number') throw new Error('claims')
      } catch { fail('UNAUTHENTICATED', 'Inicia sesión de nuevo para continuar.') }
      const value = await request(config.usersServiceUrl, '/internal/session', header, { identity: true })
      if (value.user?.id !== claims.sub || value.sessionId !== claims.sid || !['reader', 'author', 'admin'].includes(value.user.role)) fail('SERVICE_UNAVAILABLE', 'No se pudo comprobar tu identidad actual.')
      return { id: value.user.id, name: value.user.name, role: value.user.role }
    },
    forRequest(charge) {
      const publications = new Map(), profiles = new Map()
      let queued = [], scheduled = false
      async function dispatch() {
        const pending = queued; queued = []; scheduled = false
        for (let offset = 0; offset < pending.length; offset += 40) {
          const group = pending.slice(offset, offset + 40)
          try {
            charge(group.length)
            const value = await request(config.usersServiceUrl, '/api/users/profiles?ids=' + group.map((entry) => encodeURIComponent(entry.id)).join(','))
            if (!Array.isArray(value.items) || value.items.some((item) => !group.some((entry) => entry.id === item.id))) fail('SERVICE_UNAVAILABLE', 'No se pudieron comprobar los perfiles.')
            const byId = new Map(value.items.map((profile) => [profile.id, profile]))
            for (const entry of group) entry.resolve(byId.get(entry.id) ?? null)
          } catch (error) { for (const entry of group) entry.reject(error) }
        }
      }
      return {
        publication(id) {
          parse(idSchema, id)
          if (!publications.has(id)) {
            charge()
            publications.set(id, request(config.contentServiceUrl, '/api/publications/' + encodeURIComponent(id), null, { missing: true }).then((value) => {
              if (value === null) return null
              if (value.publication?.id !== id || value.publication.status !== 'published' || !Array.isArray(value.publication.blocks)) fail('SERVICE_UNAVAILABLE', 'No se pudo comprobar la publicación pública.')
              return value.publication
            }))
          }
          return publications.get(id)
        },
        profile(id) {
          parse(userIdSchema, id)
          if (!profiles.has(id)) {
            profiles.set(id, new Promise((resolve, reject) => { queued.push({ id, resolve, reject }) }))
            if (!scheduled) { scheduled = true; queueMicrotask(dispatch) }
          }
          return profiles.get(id)
        },
      }
    },
  }
}
