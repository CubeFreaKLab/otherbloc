export function errorHandler(error, _request, response, _next) {
  console.error(error)
  response.status(500).json({ error: 'internal_content_service_error' })
}
