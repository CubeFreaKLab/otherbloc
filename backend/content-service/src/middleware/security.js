import { timingSafeEqual } from 'node:crypto'

export function requireService(config) {
  return (request, response, next) => {
    const supplied = Buffer.from(request.get('x-service-key') ?? '')
    const expected = Buffer.from(config.serviceAuthSecret)
    if (expected.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return response.status(403).json({ error: 'service_access_required', message: 'Accede a través del gateway.' })
    response.set('Cache-Control', 'no-store')
    next()
  }
}

export function requireUser(users, optional = false) {
  return async (request, _response, next) => { request.identity = await users.authenticate(request.get('authorization'), optional); next() }
}
