import { publicRequest } from './publications'

let cached, cachedUntil = 0, flight
export function loadBulletin() {
  if (cached && Date.now() < cachedUntil) return Promise.resolve(cached)
  if (!flight) flight = publicRequest('/publications/bulletin').then((data) => {
    cached = data; cachedUntil = Date.now() + 25000
    return data
  }).finally(() => { flight = null })
  return flight
}
