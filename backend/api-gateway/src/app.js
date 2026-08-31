import cors from 'cors'
import express from 'express'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { gatewayRouter } from './routes/gatewayRoutes.js'
import { healthRouter } from './routes/healthRoutes.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors())
  app.use(express.json())
  app.use('/health', healthRouter)
  app.use('/api', gatewayRouter)
  app.use(notFound)
  app.use(errorHandler)

  return app
}
