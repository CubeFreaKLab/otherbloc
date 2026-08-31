import { getServiceStatus } from '../services/getServiceStatus.js'

export function getHealth(_request, response) {
  response.json(getServiceStatus())
}
