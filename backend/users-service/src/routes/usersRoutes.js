import { Router } from 'express'
import { getUsersIndex } from '../controllers/usersController.js'

export const usersRouter = Router()

usersRouter.get('/', getUsersIndex)
