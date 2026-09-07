import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { setupLocal } from './setup-local.mjs'
import { parseEmulatorArgs } from './emulator-options.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const { mode, importPath } = parseEmulatorArgs(process.argv.slice(2))
const snapshot = importPath ? path.resolve(root, importPath) : path.join(root, '.local-data/current')
const hasSnapshot = existsSync(path.join(snapshot, 'firebase-export-metadata.json'))
if (importPath && !hasSnapshot) throw new Error('The requested snapshot has no firebase-export-metadata.json; refusing to start empty')
await setupLocal()
dotenv.config({ path: path.join(root, '.env.local'), quiet: true })
if (process.env.FIREBASE_PROJECT_ID !== 'demo-otherbloc') throw new Error('Local emulator commands require demo-otherbloc, never a cloud project.')
const javaHome = process.env.OTHERBLOC_JAVA_HOME ?? process.env.JAVA_HOME
if (javaHome) process.env.PATH = path.join(javaHome, 'bin') + path.delimiter + process.env.PATH
if (process.env.OTHERBLOC_JAVA_OPTIONS) process.env.JAVA_TOOL_OPTIONS = [process.env.JAVA_TOOL_OPTIONS, process.env.OTHERBLOC_JAVA_OPTIONS].filter(Boolean).join(' ')
const cli = path.join(root, 'node_modules/firebase-tools/lib/bin/firebase.js')
const testing = mode === 'test' || mode === 'test-running'
// Storage uses a fixed path below os.tmpdir(); separate suites must not share those live blobs.
const temporary = path.join(root, '.local-data/emulator-runtime', mode === 'test' ? 'test' : 'development')
await mkdir(temporary, { recursive: true })
for (const key of ['TMP', 'TEMP', 'TMPDIR']) process.env[key] = temporary
const projectId = testing ? 'demo-otherbloc-test' : 'demo-otherbloc'
const childEnvironment = { ...process.env, GCLOUD_PROJECT: projectId }
if (testing) {
  childEnvironment.FIREBASE_PROJECT_ID = projectId
  childEnvironment.FIREBASE_STORAGE_BUCKET = projectId + '.appspot.com'
}
if (mode === 'export') {
  const exportPath = path.join(root, '.local-data/export-' + new Date().toISOString().replaceAll(':', '-'))
  if (existsSync(exportPath)) throw new Error('The export destination already exists; refusing to overwrite it')
  // The supported module API drains normally instead of the CLI's forced process.exit on Windows.
  const { default: firebaseTools } = await import('firebase-tools')
  await firebaseTools.emulators.export(exportPath, { project: 'demo-otherbloc', config: path.join(root, 'firebase.json'), nonInteractive: true })
  const metadata = JSON.parse(await readFile(path.join(exportPath, 'firebase-export-metadata.json'), 'utf8'))
  if (!metadata.firestore || !metadata.storage) throw new Error('The snapshot is incomplete: Firestore and Storage must both be running')
  console.log('Exported Firestore and Storage to ' + path.relative(root, exportPath))
} else {
  const args = mode === 'test-running' ? ['--test', '--test-concurrency=1', 'tests/integration/*.test.js'] : [cli]
  if (mode === 'test') {
    args.push('emulators:exec', '--project', projectId, '--only', 'firestore,storage', 'node --test --test-concurrency=1 tests/integration/*.test.js')
  } else if (mode !== 'test-running') {
    args.push('emulators:start', '--project', 'demo-otherbloc', '--only', 'firestore,storage', '--export-on-exit=.local-data/current')
    if (hasSnapshot) args.push('--import=' + snapshot)
  }
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: childEnvironment })
  child.on('exit', (code) => { process.exitCode = code ?? 1 })
  process.on('SIGINT', () => { /* Firebase receives the same terminal interrupt and exports its data. */ })
}
