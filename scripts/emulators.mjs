import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { setupLocal } from './setup-local.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
await setupLocal()
dotenv.config({ path: path.join(root, '.env.local'), quiet: true })
if (process.env.FIREBASE_PROJECT_ID !== 'demo-otherbloc') throw new Error('Local emulator commands require demo-otherbloc, never a cloud project.')
const javaHome = process.env.OTHERBLOC_JAVA_HOME ?? process.env.JAVA_HOME
if (javaHome) process.env.PATH = path.join(javaHome, 'bin') + path.delimiter + process.env.PATH
if (process.env.OTHERBLOC_JAVA_OPTIONS) process.env.JAVA_TOOL_OPTIONS = [process.env.JAVA_TOOL_OPTIONS, process.env.OTHERBLOC_JAVA_OPTIONS].filter(Boolean).join(' ')
const cli = path.join(root, 'node_modules/firebase-tools/lib/bin/firebase.js')
const mode = process.argv[2] ?? 'start'
const testing = mode === 'test' || mode === 'test-running'
const projectId = testing ? 'demo-otherbloc-test' : 'demo-otherbloc'
const childEnvironment = { ...process.env, GCLOUD_PROJECT: projectId }
if (testing) {
  childEnvironment.FIREBASE_PROJECT_ID = projectId
  childEnvironment.FIREBASE_STORAGE_BUCKET = projectId + '.appspot.com'
}
const args = mode === 'test-running' ? ['--test', '--test-concurrency=1', 'tests/integration/*.test.js'] : [cli]
if (mode === 'test') {
  args.push('emulators:exec', '--project', projectId, '--only', 'firestore,storage', 'node --test --test-concurrency=1 tests/integration/*.test.js')
} else if (mode === 'export') {
  args.push('emulators:export', '.local-data/export-' + new Date().toISOString().replaceAll(':', '-'), '--project', 'demo-otherbloc')
} else if (mode !== 'test-running') {
  args.push('emulators:start', '--project', 'demo-otherbloc', '--only', 'firestore,storage', '--export-on-exit=.local-data/current')
  if (existsSync(path.join(root, '.local-data/current/firebase-export-metadata.json'))) args.push('--import=.local-data/current')
}
const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: childEnvironment })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
process.on('SIGINT', () => { /* Firebase receives the same terminal interrupt and exports its data. */ })
