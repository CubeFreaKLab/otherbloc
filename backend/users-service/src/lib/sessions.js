import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { fail } from './errors.js'

export const digest = (value) => createHash('sha256').update(value).digest('hex')
export function constantEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function sessionMaterial(user, now, config) {
  const sid = randomUUID()
  const refreshToken = sid + '.' + randomBytes(32).toString('base64url')
  const expiresAtMs = now + config.sessionDays * 86400000
  return {
    sid, refreshToken,
    data: { userId: user.id, authVersion: user.authVersion, refreshHash: digest(refreshToken), previousHash: null,
      previousUntil: 0, rotateAfter: now + 60000, createdAt: now, expiresAtMs, expiresAt: new Date(expiresAtMs), revokedAt: null },
  }
}

export function nextRefresh(token, secret) {
  const sid = token.split('.')[0]
  return sid + '.' + createHmac('sha256', secret).update('otherbloc-refresh-rotation:' + token).digest('base64url')
}

export function refreshSessionId(token) {
  if (!/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(token ?? '')) fail(401, 'invalid_session', 'Inicia sesión para continuar.')
  return token.slice(0, 36)
}

export function accessToken(user, sid, now, config) {
  return jwt.sign({ sid, kind: 'access', av: user.authVersion, iat: Math.floor(now / 1000) }, config.jwtSecret,
    { algorithm: 'HS256', issuer: 'otherbloc-users', audience: 'otherbloc-platform', subject: user.id, expiresIn: config.accessSeconds })
}

export function readAccess(header, now, config) {
  try {
    if (!header?.startsWith('Bearer ')) throw new Error('missing')
    const value = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ['HS256'], issuer: 'otherbloc-users', audience: 'otherbloc-platform', clockTimestamp: Math.floor(now / 1000) })
    if (value.kind !== 'access' || !/^[A-Za-z0-9_-]{1,80}$/.test(value.sub ?? '') || !/^[0-9a-f-]{36}$/.test(value.sid ?? '') || typeof value.exp !== 'number' || !Number.isSafeInteger(value.av)) throw new Error('claims')
    return { id: value.sub, sid: value.sid, authVersion: value.av }
  } catch { fail(401, 'invalid_token', 'La sesión venció o no es válida. Inicia sesión de nuevo.') }
}

export const cookieName = (config) => config.nodeEnv === 'production' ? '__Host-ob_refresh' : 'ob_refresh'
export const cookieOptions = (config) => ({ httpOnly: true, secure: config.nodeEnv === 'production', sameSite: config.nodeEnv === 'production' ? 'none' : 'lax', partitioned: config.nodeEnv === 'production', path: '/' })

export function readRefreshCookie(request, config) {
  const name = cookieName(config) + '='
  const part = (request.get('cookie') ?? '').split(';').map((item) => item.trim()).find((item) => item.startsWith(name))
  try { return part ? decodeURIComponent(part.slice(name.length)) : '' } catch { return '' }
}
