export function errorHandler(error, request, response, _next) {
  if (response.headersSent) { response.end(); return }
  const status = error.type === 'entity.too.large' ? 413 : 500
  if (status === 500) console.error('gateway_request_failed', { requestId: request.requestId, code: error.code ?? 'internal' })
  response.status(status).json({ error: status === 413 ? 'payload_too_large' : 'internal_gateway_error', requestId: request.requestId })
}
