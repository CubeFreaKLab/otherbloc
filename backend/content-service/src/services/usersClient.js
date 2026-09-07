import jwt from 'jsonwebtoken'
import { fail } from '../lib/errors.js'

export function createUsersClient(config, fetchImpl = fetch) {
  return {
    async authenticate(header, optional = false) {
      if (!header && optional) return null
      let claims
      try {
        if (!header?.startsWith('Bearer ')) throw new Error('token')
        claims = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ['HS256'], issuer: 'otherbloc-users', audience: 'otherbloc-platform' })
        if (claims.kind !== 'access' || typeof claims.sub !== 'string' || typeof claims.sid !== 'string') throw new Error('claims')
      } catch { fail(401, 'invalid_token', 'Inicia sesión de nuevo para continuar.') }
      let response
      try {
        response = await fetchImpl(new URL('/internal/session', config.usersServiceUrl), {
          headers: { 'X-Service-Key': config.serviceAuthSecret, Authorization: header }, signal: AbortSignal.timeout(config.upstreamTimeoutMs), redirect: 'error',
        })
      } catch { fail(503, 'identity_unavailable', 'No se pudo comprobar la sesión. Inténtalo de nuevo.') }
      if (response.status === 401) fail(401, 'invalid_session', 'Tu sesión ya no está activa. Vuelve a entrar.')
      if (!response.ok) fail(503, 'identity_unavailable', 'No se pudo comprobar la sesión. Inténtalo de nuevo.')
      const body = await response.json()
      if (body.user?.id !== claims.sub || body.sessionId !== claims.sid || !['reader', 'author', 'admin'].includes(body.user.role)) fail(503, 'invalid_identity_response', 'No se pudo comprobar la sesión.')
      return { id: body.user.id, name: body.user.name, role: body.user.role }
    },
  }
}
