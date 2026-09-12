// Requested only by an active visitor. No timer keeps free services awake.
export function readiness(config, fetchImpl = fetch) {
  let flight = null, checkedAt = 0, ready = false
  return async (_request, response) => {
    if (!flight && Date.now() - checkedAt >= 5000) {
      flight = Promise.all([config.usersServiceUrl, config.contentServiceUrl, config.interactionsServiceUrl].map(async (target) => {
        try {
          const result = await fetchImpl(new URL('/health', target), { signal: AbortSignal.timeout(12000), redirect: 'error' })
          const healthy = result.ok && (await result.json()).status === 'ok'
          return healthy
        } catch { return false }
      })).then((results) => { ready = results.every(Boolean); checkedAt = Date.now() }).finally(() => { flight = null })
    }
    await flight
    response.set('Cache-Control', 'no-store')
    if (!ready) response.set('Retry-After', '2')
    response.status(ready ? 200 : 503).json({ ready })
  }
}
