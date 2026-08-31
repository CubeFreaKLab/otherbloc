import 'dotenv/config'

function port(value, fallback) {
  const parsed = Number.parseInt(value ?? fallback, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export const env = Object.freeze({
  port: port(process.env.PORT, 3000),
  usersServiceUrl: process.env.USERS_SERVICE_URL ?? 'http://localhost:3001',
  contentServiceUrl: process.env.CONTENT_SERVICE_URL ?? 'http://localhost:3002',
  interactionsServiceUrl:
    process.env.INTERACTIONS_SERVICE_URL ?? 'http://localhost:3003/graphql',
})
