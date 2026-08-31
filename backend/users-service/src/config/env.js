import 'dotenv/config'

function port(value, fallback) {
  const parsed = Number.parseInt(value ?? fallback, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export const env = Object.freeze({
  port: port(process.env.PORT, 3001),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
})
