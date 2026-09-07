import jwt from 'jsonwebtoken'

export function verifyAccess(config) {
  return (request, response, next) => {
    const header = request.get('authorization')
    if (header) {
      try {
        if (!header.startsWith('Bearer ') || !config.jwtSecret) throw new Error('invalid_token')
        const claims = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ['HS256'], issuer: 'otherbloc-users', audience: 'otherbloc-platform' })
        if (claims.kind !== 'access' || typeof claims.sub !== 'string' || typeof claims.sid !== 'string' || typeof claims.exp !== 'number') throw new Error('invalid_token')
        request.auth = claims
      } catch {
        return response.status(401).json({ error: 'invalid_token', message: 'La sesión venció o no es válida.' })
      }
    }
    const path = request.path
    const authEntry = /^\/users\/(register|login|refresh|logout)$/.test(path)
    const protectedRead = /^\/users(?:\/me(?:\/|$)|\/?$)/.test(path) || /^\/publications\/(mine|assets)(?:\/|$)/.test(path)
    const restWrite = !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && /^\/(users|publications)(\/|$)/.test(path) && !authEntry
    if ((protectedRead || restWrite) && !request.auth) return response.status(401).json({ error: 'authentication_required', message: 'Inicia sesión para continuar.' })
    next()
  }
}
