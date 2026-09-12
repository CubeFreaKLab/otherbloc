// Requested only by an active visitor. No timer keeps free services awake.
export function readiness(config, fetchImpl = fetch, report = (event) => console.warn(JSON.stringify(event))) {
  let flight = null, checkedAt = 0, ready = false
  return async (_request, response) => {
    if (!flight && Date.now() - checkedAt >= 5000) {
      flight = Promise.all([config.usersServiceUrl, config.contentServiceUrl, config.interactionsServiceUrl].map(async (target, index) => {
        const started = Date.now()
        const diagnostic = { event: 'runtime_dependency_unready', service: ['users', 'content', 'interactions'][index] }
        try {
          // A cold Free instance can take longer than a normal API request.
          // Keep this safe probe connected while Render starts the service.
          const result = await fetchImpl(new URL('/health', target), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(60000), redirect: 'error' })
          diagnostic.status = result.status
          const healthy = result.ok && (await result.json()).status === 'ok'
          if (!healthy) report({ ...diagnostic, reason: 'health_response', elapsedMs: Date.now() - started })
          return healthy
        } catch (error) {
          // Only bounded categories belong in logs, never URLs, bodies,
          // credentials or exception messages from an upstream provider.
          const reason = error.name === 'TimeoutError' ? 'timeout' : error.name === 'SyntaxError' ? 'non_json' : 'network_error'
          report({ ...diagnostic, reason, elapsedMs: Date.now() - started })
          return false
        }
      })).then((results) => { ready = results.every(Boolean); checkedAt = Date.now() }).finally(() => { flight = null })
    }
    await flight
    response.set('Cache-Control', 'no-store')
    if (!ready) response.set('Retry-After', '2')
    response.status(ready ? 200 : 503).json({ ready })
  }
}
