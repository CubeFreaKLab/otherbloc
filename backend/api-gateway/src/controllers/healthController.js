import { getServiceRegistry } from '../services/serviceRegistry.js'
import { revision } from '../config/revision.js'

export function getHealth(_request, response) {
  const services = Object.values(getServiceRegistry()).map(({ name }) => name)

  response.set('Cache-Control', 'no-store').json({
    service: 'api-gateway',
    status: 'ok',
    revision,
    services,
  })
}
