import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { requireService, requireUser } from './middleware/security.js'
import { privateUser } from './models/user.js'
import { healthRouter } from './routes/healthRoutes.js'
import { createUsersRouter } from './routes/usersRoutes.js'
import { createUsersService } from './services/users.js'

export function createApp({ config = env, firebase, now = Date.now } = {}) {
  const app = express()
  const service = createUsersService({ config, firebase, now })
  app.disable('x-powered-by')
  app.set('case sensitive routing', true)
  app.use(helmet({ strictTransportSecurity: config.nodeEnv === 'production' ? undefined : false }))
  app.use('/health', healthRouter)
  app.use(requireService(config))
  app.use(express.json({ limit: '32kb' }))
  app.get('/internal/session', requireUser(service), (request, response) => response.json({ user: privateUser(request.identity.user), sessionId: request.identity.sid }))
  app.use('/api/users', createUsersRouter(service, config))
  app.use(notFound)
  app.use(errorHandler)

  return app
}
