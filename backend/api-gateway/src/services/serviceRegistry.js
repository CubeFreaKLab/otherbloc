import { env } from '../config/env.js'
import { serviceTarget } from '../models/serviceTarget.js'

export function getServiceRegistry() {
  return Object.freeze({
    users: serviceTarget('users', env.usersServiceUrl),
    content: serviceTarget('content', env.contentServiceUrl),
    interactions: serviceTarget('interactions', env.interactionsServiceUrl),
  })
}
