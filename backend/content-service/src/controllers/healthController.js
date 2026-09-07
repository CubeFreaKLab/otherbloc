import { getServiceStatus } from '../services/getServiceStatus.js'
import { revision } from '../config/revision.js'

export function getHealth(_request, response) {
  response.set('Cache-Control', 'no-store').json({ ...getServiceStatus(), revision })
}
