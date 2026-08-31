import { randomUUID } from 'node:crypto'

export async function createContext({ req }) {
  return {
    requestId: req.get('x-request-id') ?? randomUUID(),
  }
}
