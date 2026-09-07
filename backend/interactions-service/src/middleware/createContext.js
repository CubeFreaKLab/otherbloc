import { randomUUID } from 'node:crypto'
import { GraphQLError } from 'graphql'
import { fail } from '../lib/errors.js'

export function createContext({ clients, service }) {
  return async ({ req }) => {
    let identity
    try { identity = await clients.authenticate(req.get('authorization')) } catch (error) {
      if (error.extensions?.code === 'UNAUTHENTICATED') throw new GraphQLError(error.message, { extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } } })
      throw error
    }
    let remaining = 160
    const charge = (amount = 1) => { remaining -= amount; if (remaining < 0) fail('OPERATION_LIMIT', 'Esta consulta solicita demasiados recursos. Reduce su tamaño.') }
    const cache = new Map()
    return {
      requestId: req.get('x-request-id') ?? randomUUID(), identity, service, charge, domains: clients.forRequest(charge),
      memo(key, operation) {
        if (!cache.has(key)) { charge(); cache.set(key, Promise.resolve().then(operation)) }
        return cache.get(key)
      },
    }
  }
}
