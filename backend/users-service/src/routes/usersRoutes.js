import express, { Router } from 'express'
import { adminSchema, idSchema, listSchema, loginSchema, passwordSchema, privateUser, profileSchema, publicProfilesSchema, registerSchema } from '../models/user.js'
import { cookieName, cookieOptions, readRefreshCookie } from '../lib/sessions.js'
import { requireSessionRequest, requireUser } from '../middleware/security.js'

export function createUsersRouter(service, config) {
  const router = Router()
  const auth = requireUser(service)
  const sessionRequest = requireSessionRequest(config)
  const id = (request) => idSchema.parse(request.params.id)
  function sendSession(response, result, status = 200) {
    response.cookie(cookieName(config), result.refreshToken, { ...cookieOptions(config), expires: new Date(result.expiresAtMs) })
    response.status(status).json({ user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn })
  }

  router.post('/register', sessionRequest, async (request, response) => sendSession(response, await service.register(registerSchema.parse(request.body)), 201))
  router.post('/login', sessionRequest, async (request, response) => sendSession(response, await service.login(loginSchema.parse(request.body))))
  router.post('/refresh', sessionRequest, async (request, response) => sendSession(response, await service.refresh(readRefreshCookie(request, config))))
  router.post('/logout', sessionRequest, async (request, response) => {
    await service.logout(readRefreshCookie(request, config), request.get('authorization'))
    response.clearCookie(cookieName(config), cookieOptions(config)).status(204).end()
  })
  router.get('/me', auth, (request, response) => response.json({ user: privateUser(request.identity.user) }))
  router.patch('/me', auth, async (request, response) => response.json({ user: await service.updateProfile(request.identity, profileSchema.parse(request.body)) }))
  router.post('/me/author-request', auth, async (request, response) => response.json({ user: await service.requestAuthor(request.identity) }))
  router.post('/me/password', auth, async (request, response) => {
    await service.changePassword(request.identity, passwordSchema.parse(request.body))
    response.clearCookie(cookieName(config), cookieOptions(config)).status(204).end()
  })
  router.put('/me/avatar', auth, express.raw({ type: () => true, limit: '2mb' }), async (request, response) => {
    response.json({ user: await service.uploadAvatar(request.identity, request.body, request.get('content-type')?.split(';')[0]) })
  })
  router.delete('/me/avatar', auth, async (request, response) => response.json({ user: await service.removeAvatar(request.identity) }))
  router.get('/', auth, async (request, response) => response.json(await service.list(request.identity, listSchema.parse(request.query))))
  router.get('/profiles', async (request, response) => response.json({ items: await service.getPublicProfiles(publicProfilesSchema.parse(request.query).ids) }))
  router.patch('/:id/permissions', auth, async (request, response) => response.json({ user: await service.updatePermissions(request.identity, id(request), adminSchema.parse(request.body)) }))
  router.get('/:id/avatar', async (request, response) => {
    const bytes = await service.avatar(id(request), typeof request.query.v === 'string' ? request.query.v : null)
    response.type('image/webp').set('Cache-Control', 'public, max-age=60').send(bytes)
  })
  router.get('/:id', async (request, response) => response.json({ user: await service.getPublic(id(request)) }))
  return router
}
