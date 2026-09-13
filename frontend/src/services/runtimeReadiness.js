// Free Render instances sleep while idle. Probe safe health endpoints before
// sending an operation, so writes (including login) are never blindly replayed.
export function createRuntimeReadiness(apiUrl, { fetchImpl = fetch, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), budgetMs = 240000, enabled = /^https:\/\/[^/]+\.onrender\.com\/api$/.test(apiUrl) } = {}) {
  let flight = null, readyAt = -Infinity, waiting = false
  const listeners = new Set()
  const publish = (value) => { waiting = value; for (const listener of listeners) listener() }
  async function probe() {
    const deadline = now() + budgetMs
    const awakened = new Set()
    const notice = setTimeout(() => publish(true), 800)
    try {
      while (now() < deadline) {
        let response
        try {
          response = await fetchImpl(apiUrl + '/ready', { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(Math.max(1, Math.min(75000, deadline - now()))) })
        } catch { /* A sleeping gateway can time out before the first response. */ }
        if (response?.ok || response?.status === 503) {
          // Hosting startup pages can be HTML with HTTP 200. Only the JSON
          // readiness contract is success, and parsing belongs to this budget.
          let data
          try { data = await response.json() } catch { /* Startup response, not application data. */ }
          if (response.ok && data?.ready === true) { readyAt = now(); return }
          // Render-to-Render probes did not wake sleeping owners in the real
          // deployment. An active visitor may send one credential-free GET to
          // each public health URL. Opaque responses are NOT readiness: only
          // the gateway's subsequent JSON contract permits business requests.
          const wakeups = Array.isArray(data?.wakeups) ? [...new Set(data.wakeups)].filter((url) =>
            typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.onrender\.com\/health$/.test(url) && !awakened.has(url)).slice(0, 3 - awakened.size) : []
          if (wakeups.length && now() < deadline) await Promise.allSettled(wakeups.map((url) => {
            awakened.add(url)
            // Fetch requires follow for no-cors, even when the URL does not
            // redirect. Credentials remain omitted throughout this safe GET.
            return fetchImpl(url, { method: 'GET', mode: 'no-cors', credentials: 'omit', cache: 'no-store', redirect: 'follow', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(Math.max(1, Math.min(65000, deadline - now()))) })
          }))
        } else if (response && ![502, 503, 504].includes(response.status)) throw new Error('No se pudo comprobar la disponibilidad de otherbloc. Inténtalo de nuevo.')
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
