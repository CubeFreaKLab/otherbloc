import { getServiceIndex } from '../services/getServiceStatus.js'

export function getContentIndex(_request, response) {
  response.json(getServiceIndex())
}
