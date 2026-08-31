import { getServiceRegistry } from '../services/serviceRegistry.js'

export function getGatewayIndex(_request, response) {
  const routes = Object.values(getServiceRegistry()).map(({ name }) => `/api/${name}`)

  response.json({
    service: 'api-gateway',
    routes,
  })
}
