export function notFound(request, response) {
  response.status(404).json({
    error: 'route_not_found',
    path: request.originalUrl,
  })
}
