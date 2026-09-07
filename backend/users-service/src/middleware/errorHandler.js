import { ZodError } from 'zod'
import { HttpError } from '../lib/errors.js'

export function errorHandler(error, request, response, _next) {
  if (error instanceof ZodError) return response.status(400).json({ error: 'validation_error', message: 'Revisa los campos del formulario.', fields: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) })
  if (error instanceof HttpError) {
    if (error.status === 429) response.set('Retry-After', '3')
    return response.status(error.status).json({ error: error.code, message: error.message })
  }
  if (error.type === 'entity.too.large') return response.status(413).json({ error: 'body_too_large', message: 'El archivo o contenido supera el tamaño permitido.' })
  if (error.type === 'entity.parse.failed') return response.status(400).json({ error: 'invalid_json', message: 'El contenido enviado no es válido.' })
  console.error('Users request failed', { code: error.code ?? 'unknown', requestId: request.get('x-request-id') })
  response.status(503).json({ error: 'users_unavailable', message: 'No se pudo completar la operación. Inténtalo de nuevo.' })
}
