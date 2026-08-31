import { Router } from 'express'
import { getGatewayIndex } from '../controllers/gatewayController.js'

export const gatewayRouter = Router()

gatewayRouter.get('/', getGatewayIndex)
