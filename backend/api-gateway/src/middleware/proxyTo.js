import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export function proxyTo(target, prefix, config, fetchImpl = fetch, exact = false) {
  return async (request, response) => {
    if (!config.serviceAuthSecret) return response.status(503).json({ error: 'gateway_not_configured' })
    if (exact && !['/', ''].includes(request.path)) return response.status(404).json({ error: 'route_not_found' })
    let upstreamUrl
    try {
      const decoded = decodeURIComponent(request.path)
      if (/(^|\/)\.{1,2}(\/|$)|\\|\0|%2f|%5c/i.test(decoded)) throw new Error('invalid_path')
      const targetUrl = new URL(target)
      const base = targetUrl.origin + prefix
      const suffix = exact ? request.url.replace(/^\/?/, '') : request.url
      upstreamUrl = new URL(base + (exact ? (suffix ? '?' + suffix.replace(/^\?/, '') : '') : suffix))
      if (upstreamUrl.pathname !== prefix && !upstreamUrl.pathname.startsWith(prefix + '/')) throw new Error('invalid_path')
    } catch {
      return response.status(400).json({ error: 'invalid_path' })
    }
    const headers = { 'X-Service-Key': config.serviceAuthSecret, 'X-Request-Id': request.requestId }
    for (const name of ['authorization', 'content-type', 'accept', 'if-match']) {
      const value = request.get(name)
      if (value) headers[name] = value
    }
    if (prefix === '/api/users') {
      for (const name of ['cookie', 'origin', 'x-otherbloc-request']) {
        const value = request.get(name)
        if (value) headers[name] = value
      }
    }
    const controller = new AbortController()
    const onClose = () => { if (!response.writableEnded) controller.abort() }
    response.once('close', onClose)
    try {
      const upstream = await fetchImpl(upstreamUrl, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(config.upstreamTimeoutMs)]),
      })
      if (upstream.status >= 300 && upstream.status < 400) {
        await upstream.body?.cancel()
        return response.status(502).json({ error: 'unexpected_upstream_redirect' })
      }
      response.status(upstream.status)
      for (const name of ['content-type', 'cache-control', 'etag', 'retry-after']) {
        const value = upstream.headers.get(name)
        if (value) response.set(name, value)
      }
      if (!upstream.headers.has('cache-control')) response.set('Cache-Control', 'no-store')
      if (prefix === '/api/users') {
        const cookies = upstream.headers.getSetCookie()
        if (cookies.length) response.set('Set-Cookie', cookies)
      }
      if (upstream.body && request.method !== 'HEAD') await pipeline(Readable.fromWeb(upstream.body), response)
      else response.end()
    } catch (error) {
      if (response.headersSent || response.destroyed) return
      const timedOut = error.name === 'TimeoutError'
      response.status(timedOut ? 504 : 502).json({
        error: timedOut ? 'service_timeout' : 'service_unavailable',
        message: 'El servicio no está disponible. Inténtalo de nuevo.',
        requestId: request.requestId,
      })
    } finally {
      response.removeListener('close', onClose)
    }
  }
}
