import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const root = fileURLToPath(new URL('..', import.meta.url))
dotenv.config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)), quiet: true })
if (process.env.FIREBASE_PROJECT_ID !== 'demo-otherbloc') throw new Error('Browser integration tests require local demo-otherbloc.')
for (const url of ['http://127.0.0.1:3000/health', 'http://127.0.0.1:3001/health', 'http://127.0.0.1:5173']) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!response?.ok) throw new Error('Start npm run dev and npm run emulators, then npm run seed:users, before test:e2e.')
}
const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.e2e.config.js', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', env: process.env })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
