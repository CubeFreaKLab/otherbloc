import { getServiceIndex } from '../services/getServiceStatus.js'

export function getUsersIndex(_request, response) {
  response.json(getServiceIndex())
}
