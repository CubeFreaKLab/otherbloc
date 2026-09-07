import 'dotenv/config'

function port(value, fallback) {
  const parsed = Number.parseInt(value ?? fallback, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export const env = Object.freeze({
  port: port(process.env.PORT, 3001),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? '',
  serviceAuthSecret: process.env.SERVICE_AUTH_SECRET ?? '',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((value) => value.trim()).filter(Boolean),
  accessSeconds: 900,
  sessionDays: 7,
})

export function validateRuntime(config = env) {
  for (const [name, value] of [['JWT_SECRET', config.jwtSecret], ['SERVICE_AUTH_SECRET', config.serviceAuthSecret]]) {
    if (Buffer.byteLength(value) < 32) throw new Error(name + ' must contain at least 32 bytes')
  }
  if (!config.allowedOrigins.length || config.allowedOrigins.includes('*')) throw new Error('Explicit ALLOWED_ORIGINS are required')
  for (const origin of config.allowedOrigins) {
    const url = new URL(origin)
    if (url.origin !== origin || (config.nodeEnv === 'production' && url.protocol !== 'https:')) throw new Error('Invalid allowed origin')
  }
}
