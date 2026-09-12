// Free Render instances sleep while idle. Probe safe health endpoints before
// sending an operation, so writes (including login) are never blindly replayed.
export function createRuntimeReadiness(apiUrl, { fetchImpl = fetch, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), budgetMs = 180000, enabled = /^https:\/\/[^/]+\.onrender\.com\/api$/.test(apiUrl) } = {}) {
  let flight = null, readyAt = -Infinity, waiting = false
  const listeners = new Set()
  const publish = (value) => { waiting = value; for (const listener of listeners) listener() }
  async function probe() {
    const deadline = now() + budgetMs
    const notice = setTimeout(() => publish(true), 800)
    try {
      while (now() < deadline) {
        let response
        try {
          response = await fetchImpl(apiUrl + '/ready', { method: 'GET', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(Math.max(1, Math.min(20000, deadline - now()))) })
        } catch { /* A sleeping gateway can time out before the first response. */ }
        if (response?.ok && (await response.json()).ready === true) { readyAt = now(); return }
        if (response && ![502, 503, 504].includes(response.status)) throw new Error('No se pudo comprobar la disponibilidad de otherbloc. Inténtalo de nuevo.')
        if (now() < deadline) await sleep(Math.min(2000, deadline - now()))
      }
      throw new Error('Los servidores tardaron demasiado en iniciar. Espera un momento y pulsa Reintentar.')
    } finally { clearTimeout(notice); publish(false) }
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot: () => waiting,
    async ensure(signal) {
      signal?.throwIfAborted()
      if (!enabled || now() - readyAt < 60000) return
      if (!flight) flight = probe().finally(() => { flight = null })
      if (!signal) return flight
      await new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        flight.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
      })
      signal.throwIfAborted()
    },
  }
}
