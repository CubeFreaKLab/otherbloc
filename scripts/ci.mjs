import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { assertDisposableCheckout, assertPortsAvailable, ciEnvironment, ciFirebaseConfig } from './ci-config.mjs'
import { runNode } from './ci-processes.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

try {
  if (process.argv.length !== 2) throw new Error('test:ci accepts no flags. It always runs all API and live browser checks.')
  assertDisposableCheckout(root)
  await assertPortsAvailable()
  const runId = randomUUID()
  const temporary = path.join(root, '.local-data', 'ci-' + runId)
  await mkdir(temporary, { recursive: true })
  const environment = ciEnvironment(process.env, temporary, runId)
  const javaHome = environment.OTHERBLOC_JAVA_HOME ?? environment.JAVA_HOME
  if (javaHome) environment.PATH = path.join(javaHome, 'bin') + path.delimiter + environment.PATH
  if (environment.OTHERBLOC_JAVA_OPTIONS) environment.JAVA_TOOL_OPTIONS = [environment.JAVA_TOOL_OPTIONS, environment.OTHERBLOC_JAVA_OPTIONS].filter(Boolean).join(' ')
  await runNode('generate independent demo settings', ['scripts/setup-local.mjs'], { cwd: root, env: environment })
  const settings = dotenv.parse(await readFile(path.join(root, '.env.local')))
  if (process.env.GITHUB_ACTIONS === 'true') {
    for (const key of ['JWT_SECRET', 'SERVICE_AUTH_SECRET', 'SEED_PASSWORD']) console.log('::add-mask::' + settings[key])
  }
  Object.assign(environment, settings, { CI: 'true' })
  const source = JSON.parse(await readFile(path.join(root, 'firebase.json'), 'utf8'))
  const config = path.join(temporary, 'firebase.json')
  await writeFile(config, JSON.stringify(ciFirebaseConfig(source, root), null, 2) + '\n', { flag: 'wx' })
  console.log('CI uses fresh demo-only Firestore/Storage with no snapshot import or export. Private settings remain in this disposable checkout.')
  const controller = new AbortController()
  const cancel = () => controller.abort(new Error('CI interrupted.'))
  process.once('SIGTERM', cancel)
  // Firebase receives the same interactive SIGINT and shuts down its own emulators.
  const interrupt = () => {}
  process.on('SIGINT', interrupt)
  try {
    await runNode('emulators, API contracts and full live browser journeys', [
      'node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec',
      '--project', 'demo-otherbloc', '--config', config, '--only', 'firestore,storage', '--non-interactive',
      'node scripts/ci-live.mjs',
    ], { cwd: root, env: environment, signal: controller.signal })
  } finally {
    process.removeListener('SIGTERM', cancel)
    process.removeListener('SIGINT', interrupt)
  }
  console.log('CI live checks passed; emulator processes have shut down. This is not evidence of a cloud deployment.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
