import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { setupLocal } from './setup-local.mjs'

export const services = {
  'api-gateway': 3000,
  'users-service': 3001,
  'content-service': 3002,
  'interactions-service': 3003,
  frontend: 5173,
}
const root = fileURLToPath(new URL('..', import.meta.url))

export async function runService(name, { watch = true } = {}) {
  if (!Object.hasOwn(services, name)) throw new Error('Unknown application name')
  await setupLocal()
  dotenv.config({ path: path.join(root, '.env.local'), quiet: true })
  if (process.env.FIREBASE_PROJECT_ID !== 'demo-otherbloc') throw new Error('Local development requires demo-otherbloc')
  const frontend = name === 'frontend'
  const cwd = path.join(root, frontend ? 'frontend' : 'backend/' + name)
  const args = frontend
    ? [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '0.0.0.0', '--port', '5173', '--strictPort']
    : [...(watch ? ['--watch'] : []), 'src/server.js']
  return spawn(process.execPath, args, { cwd, stdio: 'inherit', env: { ...process.env, PORT: String(services[name]) } })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const child = await runService(process.argv[2])
  child.on('exit', (code) => { process.exitCode = code ?? 1 })
  process.on('SIGTERM', () => child.kill('SIGTERM'))
}
