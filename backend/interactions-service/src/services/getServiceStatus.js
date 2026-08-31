import { serviceStatus } from '../models/serviceStatus.js'

export function getServiceStatus() {
  return { ...serviceStatus }
}
