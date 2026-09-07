import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@as-integrations/express5'
import express from 'express'
import helmet from 'helmet'
import { resolvers } from './controllers/resolvers.js'
import { createContext } from './middleware/createContext.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { healthRouter } from './routes/healthRoutes.js'
import { typeDefs } from './schema/typeDefs.js'
import { env } from './config/env.js'
import { createDomainClients } from './services/domainClients.js'
import { createInteractionService } from './services/interactions.js'
import { boundedOperation, requireService } from './middleware/security.js'
import { formatError } from './lib/errors.js'

export async function createApp({ config = env, firebase, fetchImpl = fetch, now } = {}) {
  const app = express()
  const service = createInteractionService({ firebase, now })
  const clients = createDomainClients(config, fetchImpl)
  const apolloServer = new ApolloServer({ typeDefs, resolvers, formatError, includeStacktraceInErrorResponses: false,
    introspection: config.nodeEnv !== 'production', hideSchemaDetailsFromClientErrors: true, maxRecursiveSelections: 300,
    validationRules: [boundedOperation], allowBatchedHttpRequests: false, persistedQueries: false,
  })

  await apolloServer.start()

  app.disable('x-powered-by')
  app.use(helmet({ strictTransportSecurity: config.nodeEnv === 'production' ? undefined : false }))
  app.use('/health', healthRouter)
  app.use(requireService(config))
  app.use('/graphql', express.json({ limit: '128kb' }), expressMiddleware(apolloServer, { context: createContext({ clients, service }) }))
  app.use(notFound)
  app.use(errorHandler)

  return { app, apolloServer }
}
