import { ZodError } from 'zod'
import { HttpError } from '../lib/errors.js'

export function errorHandler(error, request, response, _next) {
  if (error instanceof ZodError) return response.status(400).json({ error: 'validation_error', message: 'Revisa los campos de la publicación.', fields: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) })
  if (error instanceof HttpError) return response.status(error.status).json({ error: error.code, message: error.message })
  if (error.type === 'entity.too.large') return response.status(413).json({ error: 'body_too_large', message: 'El archivo o contenido supera el tamaño permitido.' })
  if (error.type === 'entity.parse.failed') return response.status(400).json({ error: 'invalid_json', message: 'El contenido enviado no es válido.' })
  console.error('Content request failed', { code: error.code ?? 'unknown', requestId: request.get('x-request-id') })
  response.status(503).json({ error: 'content_unavailable', message: 'No se pudo completar la operación. Inténtalo de nuevo.' })
}
