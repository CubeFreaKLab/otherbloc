export const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
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
  for (const listener of listeners) listener()
}

function acceptSession(value) {
  token = value.accessToken
  setSessionUser(value.user)
}

async function send(path, options = {}, access = false) {
  const headers = { 'X-Otherbloc-Request': '1', ...options.headers }
  let body = options.body
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }
  if (access && token) headers.Authorization = 'Bearer ' + token
  let response
  try {
    response = await fetch(apiUrl + path, { ...options, body, headers, credentials: 'include', signal: options.signal ?? AbortSignal.timeout(20000) })
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
      token = null
      snapshot = { user: null, status: error.status === 401 ? 'anonymous' : 'error', error: error.status === 401 ? null : error.message }
      for (const listener of listeners) listener()
    }
    throw error
  }).finally(() => { refreshFlight = null })
  return refreshFlight
}

export async function gatewayRequest(path, options = {}) {
  try { return await send(path, options, true) } catch (error) {
    if (error.status !== 401 || options.retryAuth === false) throw error
    await refreshSession()
    return send(path, options, true)
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
  await send('/users/logout', { method: 'POST', body: {} })
  epoch += 1
  token = null
  setSessionUser(null)
}

export function clearSession() {
  epoch += 1
  token = null
  setSessionUser(null)
}

export function gatewayMediaUrl(path) {
  if (!path?.startsWith('/api/')) return null
  return apiUrl + path.slice(4)
}
