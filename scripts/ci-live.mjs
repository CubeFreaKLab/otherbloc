import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { assertCiEnvironment } from './ci-config.mjs'
import { runNode, stopServices, waitForServices } from './ci-processes.mjs'
import { runService, services } from './run-service.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const controller = new AbortController()
const children = []
let stopping = false
const cancel = () => controller.abort(new Error('Live CI interrupted.'))
process.once('SIGINT', cancel)
process.once('SIGTERM', cancel)
const run = (label, args, env = process.env) => runNode(label, args, { cwd: root, env, signal: controller.signal })

try {
  assertCiEnvironment(process.env)
  const files = (await readdir(new URL('../tests/integration/', import.meta.url))).filter((file) => file.endsWith('.test.js')).sort().map((file) => 'tests/integration/' + file)
  if (!files.length) throw new Error('No API integration tests found.')
  await run('isolated API integration tests', ['--test', '--test-concurrency=1', ...files], {
    ...process.env, FIREBASE_PROJECT_ID: 'demo-otherbloc-test', GCLOUD_PROJECT: 'demo-otherbloc-test', FIREBASE_STORAGE_BUCKET: 'demo-otherbloc-test.appspot.com',
  })
  for (const name of Object.keys(services)) {
    controller.signal.throwIfAborted()
    const child = await runService(name, { watch: false })
    children.push(child)
    child.once('error', () => controller.abort(new Error(name + ' could not start.')))
    child.once('exit', (code) => { if (!stopping) controller.abort(new Error(name + ' stopped unexpectedly (exit ' + code + ').')) })
  }
  await waitForServices(Object.entries(services).map(([name, port]) => 'http://127.0.0.1:' + port + (name === 'frontend' ? '/' : '/health')), controller.signal)
  await run('seed six independent demo accounts', ['scripts/seed-users.mjs'])
  await run('seed seven publications with actual Storage images', ['scripts/seed-content.mjs'])
  await run('full desktop/mobile E2E suite (no retries)', ['scripts/e2e.mjs'])
} catch (error) {
  console.error(controller.signal.aborted ? controller.signal.reason.message : error.message)
  process.exitCode = 1
} finally {
  stopping = true
  await stopServices(children)
  process.removeListener('SIGINT', cancel)
  process.removeListener('SIGTERM', cancel)
}
