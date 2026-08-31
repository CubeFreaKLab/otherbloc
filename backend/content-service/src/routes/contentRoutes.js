import { Router } from 'express'
import { getContentIndex } from '../controllers/contentController.js'

export const contentRouter = Router()

contentRouter.get('/', getContentIndex)
