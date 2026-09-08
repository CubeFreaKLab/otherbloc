import 'dotenv/config'

function port(value, fallback) {
  const parsed = Number.parseInt(value ?? fallback, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export const env = Object.freeze({
  port: port(process.env.PORT, 3002),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? '',
  serviceAuthSecret: process.env.SERVICE_AUTH_SECRET ?? '',
  usersServiceUrl: process.env.USERS_SERVICE_URL ?? 'http://127.0.0.1:3001',
  upstreamTimeoutMs: 10000,
  bulletinExternal: process.env.BULLETIN_EXTERNAL_ENABLED !== 'false',
})

export function validateRuntime(config = env) {
  if (Buffer.byteLength(config.jwtSecret) < 32 || Buffer.byteLength(config.serviceAuthSecret) < 32) throw new Error('JWT_SECRET and SERVICE_AUTH_SECRET must each contain at least 32 bytes')
  const url = new URL(config.usersServiceUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (config.nodeEnv === 'production' && url.protocol !== 'https:')) throw new Error('Invalid Users service URL')
}
