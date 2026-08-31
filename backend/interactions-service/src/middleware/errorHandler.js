export function errorHandler(error, _request, response, _next) {
  console.error(error)
  response.status(500).json({ error: 'internal_interactions_service_error' })
}
