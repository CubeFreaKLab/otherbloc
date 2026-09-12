import { captureRecovery, hasRecovery, reconcileRecovery } from './draftRecovery'
import { createRuntimeReadiness } from './runtimeReadiness'

export const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
export const runtimeReadiness = createRuntimeReadiness(apiUrl)
let token = null
let refreshFlight = null
let epoch = 0
let snapshot = { user: null, status: 'loading', error: null }
const listeners = new Set()

export class ApiError extends Error {
  constructor(message, status = 0, code = 'network_error', fields = []) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const subscribeSession = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
export const getSession = () => snapshot
export const getAccessToken = () => token
export function setSessionUser(user) {
  snapshot = { user, status: user ? 'authenticated' : 'anonymous', error: null }
  if (user) reconcileRecovery(user.id)
  for (const listener of listeners) listener()
}

function acceptSession(value) {
  token = value.accessToken
  setSessionUser(value.user)
}

async function send(path, options = {}, access = false) {
  try { await runtimeReadiness.ensure(options.signal) } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(error.message, 503, 'runtime_starting')
  }
  const headers = { 'X-Otherbloc-Request': '1', ...options.headers }
  let body = options.body
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }
  if (access && token) headers.Authorization = 'Bearer ' + token
  let response
  try {
    const timeout = AbortSignal.timeout(20000)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    response = await fetch(apiUrl + path, { ...options, body, headers, credentials: 'include', signal })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('No se pudo conectar con otherbloc. Comprueba tu conexión e inténtalo de nuevo.')
  }
  if (response.status === 204) return null
  let data
  if (response.headers.get('content-type')?.includes('json')) data = await response.json()
  else if (response.ok && options.responseType === 'blob') return response.blob()
  if (!response.ok) throw new ApiError(data?.message ?? 'No se pudo completar la solicitud. Inténtalo de nuevo.', response.status, data?.error, data?.fields)
  if (data === undefined) throw new ApiError('El servidor devolvió una respuesta inesperada.', response.status, 'invalid_response')
  return data
}

export function refreshSession() {
  if (refreshFlight) return refreshFlight
  const currentEpoch = epoch
  refreshFlight = send('/users/refresh', { method: 'POST', body: {} }).then((value) => {
    if (epoch === currentEpoch) acceptSession(value)
    return value
  }).catch((error) => {
    if (epoch === currentEpoch) {
      try { captureRecovery(snapshot.user?.id) } finally {
        // Recovery must never prevent clearing an invalid session.
        token = null
        snapshot = { user: null, status: error.status === 401 ? 'anonymous' : 'error', error: error.status === 401 ? null : error.message }
        for (const listener of listeners) listener()
      }
    }
    throw error
  }).finally(() => { refreshFlight = null })
  return refreshFlight
}

export async function gatewayRequest(path, options = {}) {
  const identity = snapshot.user?.id ?? null
  const sameIdentity = () => {
    if (!options.anonymous && identity !== (snapshot.user?.id ?? null)) throw new ApiError('La sesión cambió durante la solicitud. Revisa la cuenta y vuelve a cargar antes de continuar.', 409, 'session_changed')
  }
  try {
    const result = await send(path, options, !options.anonymous)
    sameIdentity()
    return result
  } catch (error) {
    if (error.status !== 401 || options.retryAuth === false || options.anonymous) throw error
    await refreshSession()
    // A cookie changed by another tab must not replay the old account's write as a new user.
    sameIdentity()
    const result = await send(path, options, true)
    sameIdentity()
    return result
  }
}

export async function signIn(mode, input) {
  await refreshFlight?.catch(() => {})
  const value = await send('/users/' + mode, { method: 'POST', body: input })
  epoch += 1
  acceptSession(value)
  // Confirm that the browser retained its HttpOnly cookie before promising persistence.
  try { await refreshSession() } catch (error) {
    if (error.status === 401) {
      await send('/users/logout', { method: 'POST', body: {}, headers: { Authorization: 'Bearer ' + value.accessToken } }).catch(() => {})
      throw new ApiError('El navegador no conservó la sesión. Permite las cookies de este sitio y vuelve a entrar.', 401, 'cookies_required')
    }
    throw error
  }
  return getSession().user
}

export async function signOut() {
  await refreshFlight?.catch(() => {})
  if (hasRecovery()) throw new ApiError('Recupera o descarta las copias temporales antes de cerrar sesión.', 409, 'recovery_pending')
  await send('/users/logout', { method: 'POST', body: {} })
  epoch += 1
  token = null
  reconcileRecovery(null, true)
  setSessionUser(null)
}

export function clearSession() {
  epoch += 1
  token = null
  reconcileRecovery(null, true)
  setSessionUser(null)
}

export function gatewayMediaUrl(path) {
  if (!path?.startsWith('/api/')) return null
  return apiUrl + path.slice(4)
}
