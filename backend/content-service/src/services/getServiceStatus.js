import { serviceInfo } from '../models/serviceInfo.js'

export function getServiceStatus() {
  return {
    service: serviceInfo.name,
    status: 'ok',
    transport: serviceInfo.transport,
  }
}

export function getServiceIndex() {
  return {
    service: serviceInfo.name,
    status: 'foundation-ready',
    capabilities: serviceInfo.capabilities,
  }
}
