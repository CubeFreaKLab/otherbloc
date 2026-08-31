import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@as-integrations/express5'
import cors from 'cors'
import express from 'express'
import { resolvers } from './controllers/resolvers.js'
import { createContext } from './middleware/createContext.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { healthRouter } from './routes/healthRoutes.js'
import { typeDefs } from './schema/typeDefs.js'

export async function createApp() {
  const app = express()
  const apolloServer = new ApolloServer({ typeDefs, resolvers })

  await apolloServer.start()

  app.disable('x-powered-by')
  app.use('/health', healthRouter)
  app.use('/graphql', cors(), express.json(), expressMiddleware(apolloServer, { context: createContext }))
  app.use(notFound)
  app.use(errorHandler)

  return { app, apolloServer }
}
