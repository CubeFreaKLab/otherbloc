import { randomUUID } from 'node:crypto'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { verifyAccess } from './middleware/verifyAccess.js'
import { proxyTo } from './middleware/proxyTo.js'
import { healthRouter } from './routes/healthRoutes.js'
import { gatewayRouter } from './routes/gatewayRoutes.js'
import { readiness } from './routes/readiness.js'

export function createApp({ config = env, fetchImpl = fetch } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.set('case sensitive routing', true)
  app.set('trust proxy', config.trustProxy)
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: config.nodeEnv === 'production' ? undefined : false,
  }))
  app.use((request, response, next) => {
    request.requestId = randomUUID()
    response.set('X-Request-Id', request.requestId)
    const origin = request.get('origin')
    if (origin && !config.allowedOrigins.includes(origin)) return response.status(403).json({ error: 'origin_not_allowed' })
    next()
  })
  app.use(cors({
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Otherbloc-Request', 'If-Match'],
    exposedHeaders: ['ETag', 'Retry-After', 'X-Request-Id'],
    maxAge: 600,
  }))
  app.use('/health', healthRouter)
  app.use('/api', rateLimit({
    windowMs: config.rateWindowMs, limit: config.rateLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Demasiadas solicitudes. Inténtalo más tarde.' },
  }))
  app.use(['/api/users/register', '/api/users/login'], rateLimit({
    windowMs: 900000, limit: config.authRateLimit ?? 30, standardHeaders: 'draft-8', legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'authentication_rate_limited', message: 'Demasiados intentos de acceso. Espera unos minutos.' },
  }))
  app.get('/api/ready', readiness(config, fetchImpl))
  app.use('/api', verifyAccess(config))
  app.use('/api', express.raw({ type: () => true, limit: '6mb' }))
  app.use('/api/users', proxyTo(config.usersServiceUrl, '/api/users', config, fetchImpl))
  app.use('/api/publications', proxyTo(config.contentServiceUrl, '/api/publications', config, fetchImpl))
  app.use('/api/interactions', proxyTo(config.interactionsServiceUrl, '/graphql', config, fetchImpl, true))
  app.use('/api', gatewayRouter)
  app.use(notFound)
  app.use(errorHandler)
  return app
}
