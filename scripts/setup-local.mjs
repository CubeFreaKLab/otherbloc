import { randomBytes } from 'node:crypto'
import { writeFile, access } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'

export async function setupLocal() {
  const target = new URL('../.env.local', import.meta.url)
  try { await access(target); return false } catch {}
  const hosts = ['localhost', '127.0.0.1', ...Object.values(networkInterfaces()).flat().filter((entry) => entry?.family === 'IPv4' && !entry.internal).map((entry) => entry.address)]
  const contents = [
    '# Private local development settings. Never commit this file.',
    'NODE_ENV=development',
    'FIREBASE_PROJECT_ID=demo-otherbloc',
    'FIREBASE_STORAGE_BUCKET=demo-otherbloc.appspot.com',
    'FIRESTORE_EMULATOR_HOST=127.0.0.1:8080',
    'FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199',
    'JWT_SECRET=' + randomBytes(48).toString('base64url'),
    'SERVICE_AUTH_SECRET=' + randomBytes(48).toString('base64url'),
    'ALLOWED_ORIGINS=' + [...new Set(hosts)].map((host) => 'http://' + host + ':5173').concat(['http://localhost:4173', 'http://127.0.0.1:4173']).join(','),
    'USERS_SERVICE_URL=http://127.0.0.1:3001',
    'CONTENT_SERVICE_URL=http://127.0.0.1:3002',
    'INTERACTIONS_SERVICE_URL=http://127.0.0.1:3003/graphql',
    'SEED_READER_EMAIL=reader@example.test',
    'SEED_AUTHOR_EMAIL=author@example.test',
    'SEED_ADMIN_EMAIL=admin@example.test',
    'SEED_PASSWORD=' + randomBytes(18).toString('base64url'),
    '',
  ].join('\n')
  await writeFile(target, contents, { flag: 'wx', mode: 0o600 })
  return true
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(await setupLocal() ? 'Created private .env.local. Test account settings are stored there.' : 'Kept the existing .env.local unchanged.')
}
