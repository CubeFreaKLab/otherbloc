export function errorHandler(error, _request, response, _next) {
  if (error.type === 'entity.too.large') return response.status(413).json({ error: 'request_too_large', message: 'La consulta es demasiado grande.' })
  if (error instanceof SyntaxError && error.status === 400) return response.status(400).json({ error: 'invalid_json', message: 'El cuerpo JSON no es válido.' })
  console.error('Interactions HTTP error:', error.code ?? 'internal')
  response.status(500).json({ error: 'internal_interactions_service_error', message: 'No se pudo completar la solicitud.' })
}
