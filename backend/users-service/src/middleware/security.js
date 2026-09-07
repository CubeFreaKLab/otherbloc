import { constantEqual } from '../lib/sessions.js'

export function requireService(config) {
  return (request, response, next) => {
    if (config.serviceAuthSecret.length < 32 || !constantEqual(request.get('x-service-key'), config.serviceAuthSecret)) {
      return response.status(403).json({ error: 'service_access_required', message: 'Accede a través del gateway.' })
    }
    response.set('Cache-Control', 'no-store')
    next()
  }
}

export function requireSessionRequest(config) {
  return (request, response, next) => {
    const origin = request.get('origin')
    if (request.get('x-otherbloc-request') !== '1' || (origin && !config.allowedOrigins.includes(origin))) {
      return response.status(403).json({ error: 'invalid_session_request', message: 'No se pudo validar el origen de la solicitud.' })
    }
    next()
  }
}

export function requireUser(service) {
  return async (request, _response, next) => {
    request.identity = await service.authenticate(request.get('authorization'))
    next()
  }
}
