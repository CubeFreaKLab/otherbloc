import 'dotenv/config'

const integer = (value, fallback) => {
  if (value === undefined || value === '') return fallback
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('Invalid numeric configuration')
  return result
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: integer(process.env.PORT, 3000),
  usersServiceUrl: process.env.USERS_SERVICE_URL ?? 'http://localhost:3001',
  contentServiceUrl: process.env.CONTENT_SERVICE_URL ?? 'http://localhost:3002',
  interactionsServiceUrl: process.env.INTERACTIONS_SERVICE_URL ?? 'http://localhost:3003/graphql',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((value) => value.trim()).filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? '',
  serviceAuthSecret: process.env.SERVICE_AUTH_SECRET ?? '',
  trustProxy: integer(process.env.TRUST_PROXY, 0),
  upstreamTimeoutMs: integer(process.env.UPSTREAM_TIMEOUT_MS, 15000),
  rateLimit: integer(process.env.RATE_LIMIT_MAX, 18000),
  rateWindowMs: integer(process.env.RATE_LIMIT_WINDOW_MS, 900000),
})

export function validateRuntime(config = env) {
  if (config.port < 1 || config.port > 65535) throw new Error('PORT must be between 1 and 65535')
  for (const [name, value] of [['JWT_SECRET', config.jwtSecret], ['SERVICE_AUTH_SECRET', config.serviceAuthSecret]]) {
    if (Buffer.byteLength(value) < 32) throw new Error(name + ' must contain at least 32 bytes')
  }
  if (!config.allowedOrigins.length || config.allowedOrigins.includes('*')) throw new Error('ALLOWED_ORIGINS must contain explicit origins')
  for (const value of config.allowedOrigins) {
    const url = new URL(value)
    if (url.origin !== value || (config.nodeEnv === 'production' && url.protocol !== 'https:')) throw new Error('Invalid allowed origin')
  }
  for (const value of [config.usersServiceUrl, config.contentServiceUrl, config.interactionsServiceUrl]) {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid service URL')
    if (config.nodeEnv === 'production' && url.protocol !== 'https:') throw new Error('Production service URLs must use HTTPS')
  }
}
