import { getServiceRegistry } from '../services/serviceRegistry.js'

export function getHealth(_request, response) {
  const services = Object.values(getServiceRegistry()).map(({ name }) => name)

  response.json({
    service: 'api-gateway',
    status: 'ok',
    services,
  })
}
