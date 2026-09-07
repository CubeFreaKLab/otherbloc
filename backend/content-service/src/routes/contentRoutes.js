import express, { Router } from 'express'
import { categories, createSchema, editorSchema, idSchema, mediaQuerySchema, moderationQuerySchema, ownQuerySchema, publicQuerySchema, publicationTypes, readVersion, statusSchema } from '../models/publication.js'
import { requireUser } from '../middleware/security.js'

export function createContentRouter(service, users) {
  const router = Router()
  const auth = requireUser(users), optional = requireUser(users, true)
  const id = (request) => idSchema.parse(request.params.id)
  const send = (response, publication, status = 200) => response.status(status).set('Cache-Control', 'private, no-store').set('ETag', '"' + publication.version + '"').json({ publication })
  router.get('/options', (_request, response) => response.json({ types: publicationTypes, categories }))
  router.get('/mine', auth, async (request, response) => response.json(await service.listMine(request.identity, ownQuerySchema.parse(request.query))))
  router.get('/moderation', auth, async (request, response) => response.json(await service.listModeration(request.identity, moderationQuerySchema.parse(request.query))))
  router.get('/', async (request, response) => response.json(await service.listPublic(publicQuerySchema.parse(request.query))))
  router.post('/', auth, async (request, response) => { const result = await service.create(request.identity, createSchema.parse(request.body)); send(response, result.publication, result.created ? 201 : 200) })
  const update = async (request, response) => send(response, await service.update(id(request), request.identity, editorSchema.parse(request.body), readVersion(request.get('if-match'))))
  router.put('/:id', auth, update)
  router.patch('/:id', auth, update)
  router.patch('/:id/status', auth, async (request, response) => send(response, await service.transition(id(request), request.identity, statusSchema.parse(request.body), readVersion(request.get('if-match')))))
  router.delete('/:id', auth, async (request, response) => { await service.remove(id(request), request.identity, readVersion(request.get('if-match'))); response.status(204).end() })
  router.post('/:id/assets', auth, express.raw({ type: () => true, limit: '5mb' }), async (request, response) => response.status(201).json({ asset: await service.upload(id(request), request.identity, request.body, request.get('content-type')?.split(';')[0]) }))
  router.get('/:id/media/:assetId', optional, async (request, response) => {
    const media = await service.media(id(request), idSchema.parse(request.params.assetId), request.identity, mediaQuerySchema.parse(request.query).width)
    response.type('image/webp').set('Cache-Control', media.public ? 'public, max-age=60' : 'private, no-store').send(media.bytes)
  })
  router.get('/:id', optional, async (request, response) => send(response, await service.get(id(request), request.identity)))
  return router
}
