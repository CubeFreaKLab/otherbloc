const assert = require('node:assert/strict')
const { mkdtemp, mkdir, readFile, rm, writeFile } = require('node:fs/promises')
const { createServer } = require('node:http')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

test('CI refuses existing private configuration and snapshots without changing them', async () => {
  const { assertDisposableCheckout } = await import('../scripts/ci-config.mjs')
  const root = await mkdtemp(path.join(tmpdir(), 'otherbloc-ci-contract-'))
  try {
    assertDisposableCheckout(root)
    const configuration = path.join(root, '.env.local')
    await writeFile(configuration, 'Existing private configuration fixture\n')
    assert.throws(() => assertDisposableCheckout(root), /disposable checkout/)
    assert.equal(await readFile(configuration, 'utf8'), 'Existing private configuration fixture\n')
    await rm(configuration)
    await mkdir(path.join(root, '.local-data/current'), { recursive: true })
    assert.throws(() => assertDisposableCheckout(root), /development snapshot/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('CI strips inherited cloud targets, credentials and rate overrides and fixes both emulator hosts', async () => {
  const { ciEnvironment, assertCiEnvironment } = await import('../scripts/ci-config.mjs')
  const environment = ciEnvironment({ PATH: 'runtime-bin', NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'real-project',
    FIREBASE_PRIVATE_KEY: 'not-a-real-key', GOOGLE_APPLICATION_CREDENTIALS: '/private/service.json', JWT_SECRET: 'not-a-real-secret',
    VITE_API_URL: 'https://remote.example.test', RATE_LIMIT_MAX: '1', TRUST_PROXY: '1', SEED_PASSWORD: 'not-a-real-password',
  }, '/isolated/runtime', '00000000-0000-4000-8000-000000000000')
  assertCiEnvironment(environment)
  assert.equal(environment.PATH, 'runtime-bin')
  const windows = ciEnvironment({ Path: 'windows-runtime', Temp: '/shared/storage' }, '/isolated/windows', '00000000-0000-4000-8000-000000000000')
  assert.equal(windows.PATH, 'windows-runtime')
  assert.equal(windows.Path, undefined)
  assert.equal(windows.Temp, undefined)
  assert.equal(windows.TEMP, '/isolated/windows')
  for (const key of ['FIREBASE_PRIVATE_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'JWT_SECRET', 'SEED_PASSWORD', 'VITE_API_URL', 'RATE_LIMIT_MAX', 'TRUST_PROXY']) assert.equal(environment[key], undefined)
  assert.equal(environment.TMPDIR, '/isolated/runtime')
  for (const [key, value] of [['CI', 'false'], ['OTHERBLOC_CI_RUN_ID', ''], ['NODE_ENV', 'production'], ['FIREBASE_PROJECT_ID', 'real-project'], ['FIREBASE_STORAGE_BUCKET', 'remote.appspot.com'], ['FIRESTORE_EMULATOR_HOST', 'remote.test:8080'], ['FIREBASE_STORAGE_EMULATOR_HOST', '']]) {
    assert.throws(() => assertCiEnvironment({ ...environment, [key]: value }), /both isolated local emulators/)
  }
})

test('CI derives local rule/index paths without Hosting, imports or an exposed emulator UI', async () => {
  const { ciFirebaseConfig, ciPorts } = await import('../scripts/ci-config.mjs')
  const source = JSON.parse(await readFile(path.join(__dirname, '../firebase.json'), 'utf8'))
  const original = structuredClone(source)
  const config = ciFirebaseConfig(source, __dirname)
  assert.deepEqual(source, original)
  assert.equal(config.hosting, undefined)
  assert.equal(config.firestore.rules, path.join(__dirname, 'firestore.rules'))
  assert.equal(config.storage.rules, path.join(__dirname, 'storage.rules'))
  assert.equal(config.emulators.ui.enabled, false)
  assert.equal(config.emulators.singleProjectMode, false)
  assert.deepEqual(ciPorts, [3000, 3001, 3002, 3003, 5173, 8080, 9199, 4400, 4500, 9150])
  const runner = await readFile(path.join(__dirname, '../scripts/ci.mjs'), 'utf8')
  assert.doesNotMatch(runner, /--import|--export-on-exit/)
})

test('CI rejects occupied ports without stopping their owner and health waits require actual success', async () => {
  const { assertPortsAvailable } = await import('../scripts/ci-config.mjs')
  const { waitForServices } = await import('../scripts/ci-processes.mjs')
  const server = createServer((request, response) => { response.writeHead(request.url === '/health' ? 200 : 503); response.end() })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const signal = new AbortController().signal
  try {
    await assert.rejects(assertPortsAvailable([port]), /occupied/)
    assert.equal(server.listening, true)
    await waitForServices(['http://127.0.0.1:' + port + '/health'], signal, 1000)
    await assert.rejects(waitForServices(['http://127.0.0.1:' + port + '/unavailable'], signal, 100), /readiness failed/)
  } finally { await new Promise((resolve) => server.close(resolve)) }
  await assertPortsAvailable([port])
})

test('CI preserves real child command failures and waits for owned service shutdown', async () => {
  const { spawn } = require('node:child_process')
  const { runNode, stopServices } = await import('../scripts/ci-processes.mjs')
  await runNode('successful contract fixture', ['-e', 'process.exitCode = 0'])
  await assert.rejects(runNode('failed contract fixture', ['-e', 'process.exitCode = 7']), /exit 7/)
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject) })
  await stopServices([child])
  assert.ok(child.exitCode !== null || child.signalCode !== null)
})

test('CI workflow pins actions, checks the same checkout and runs visual checks before live services', async () => {
  const workflow = (await readFile(path.join(__dirname, '../.github/workflows/foundation-ci.yml'), 'utf8')).replaceAll('\r\n', '\n')
  assert.match(workflow, /workflow_call:/)
  assert.match(workflow, /contents: read/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /java-version: '21'/)
  assert.match(workflow, /node-version: 24/)
  assert.match(workflow, /playwright install --with-deps chromium/)
  const steps = ['npm ci', 'npm test', 'npm run lint', 'npm run build', 'npm run test:ui', 'npm run test:ci'].map((command) => workflow.indexOf('run: ' + command + '\n'))
  assert.ok(steps.every((position, index) => position >= 0 && (!index || position > steps[index - 1])))
  assert.equal([...workflow.matchAll(/uses: actions\/[\w-]+@[a-f0-9]{40} # v\d/g)].length, 3)
  assert.doesNotMatch(workflow, /secrets[.:]|upload-artifact|firebase deploy|git push|pull_request_target|continue-on-error/)
})
