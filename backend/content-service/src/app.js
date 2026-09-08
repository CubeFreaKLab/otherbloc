import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { requireService } from './middleware/security.js'
import { createContentRouter } from './routes/contentRoutes.js'
import { healthRouter } from './routes/healthRoutes.js'
import { createPublicationsService } from './services/publications.js'
import { createUsersClient } from './services/usersClient.js'
import { createBulletin } from './services/bulletin.js'

export function createApp({ config = env, firebase, fetchImpl = fetch, now = Date.now } = {}) {
  const app = express()

  app.disable('x-powered-by')
  app.set('case sensitive routing', true)
  app.use(helmet({ strictTransportSecurity: config.nodeEnv === 'production' ? undefined : false }))
  app.use('/health', healthRouter)
  app.use(requireService(config))
  app.use(express.json({ limit: '512kb' }))
  const publications = createPublicationsService({ firebase, now })
  const bulletin = createBulletin({ fetchImpl, now, listPublic: publications.listPublic, external: config.bulletinExternal !== false })
  app.get('/api/publications/bulletin', async (_request, response) => response.set('Cache-Control', 'no-store').json(await bulletin()))
  app.use('/api/publications', createContentRouter(publications, createUsersClient(config, fetchImpl)))
  app.use(notFound)
  app.use(errorHandler)

  return app
}
