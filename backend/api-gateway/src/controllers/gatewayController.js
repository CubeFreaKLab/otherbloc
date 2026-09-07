export function getGatewayIndex(_request, response) {
  response.json({ service: 'api-gateway', routes: ['/api/users', '/api/publications', '/api/interactions'] })
}
