const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')

const repositoryRoot = join(__dirname, '..')

const resolveFromRoot = (...segments) => join(repositoryRoot, ...segments)
const readJson = (...segments) =>
  JSON.parse(readFileSync(resolveFromRoot(...segments), 'utf8'))

test('development watch configuration has an explicit stable mode and rejects misspelled options', async () => {
  const { parseWatchOptions } = await import('../scripts/run-service.mjs')
  assert.deepEqual(parseWatchOptions([]), { watch: true })
  assert.deepEqual(parseWatchOptions(['--no-watch']), { watch: false })
  for (const args of [['--nowatch'], ['--no-watch', '--watch'], ['--no-watch', '--no-watch']]) assert.throws(() => parseWatchOptions(args), /--no-watch/)
})

test('emulator commands reject unknown actions and accept explicit imports only at startup', async () => {
  const { parseEmulatorArgs } = await import('../scripts/emulator-options.mjs')
  assert.deepEqual(parseEmulatorArgs([]), { mode: 'start', importPath: null })
  assert.deepEqual(parseEmulatorArgs(['start', '--import=.local-data/a snapshot']), { mode: 'start', importPath: '.local-data/a snapshot' })
  for (const mode of ['export', 'test', 'test-running']) assert.deepEqual(parseEmulatorArgs([mode]), { mode, importPath: null })
  for (const args of [['typo'], ['start', '--import='], ['export', '--force'], ['test', '--import=x'], ['start', '--import=x', '--force']]) assert.throws(() => parseEmulatorArgs(args))
})

test('local load verification fixes the required workload and rejects incomplete or remote media datasets', async () => {
  const { loadGateway, loadOptions, parseLoadArgs, selectLoadDataset, loadRoutes } = await import('../scripts/load-config.mjs')
  assert.equal(loadGateway, 'http://127.0.0.1:3000')
  assert.equal(parseLoadArgs([]), 'load')
  assert.equal(parseLoadArgs(['--smoke']), 'smoke')
  for (const args of [['--vus=1'], ['--duration=1s'], ['--smoke', '--smoke']]) assert.throws(() => parseLoadArgs(args))
  assert.throws(() => loadOptions('unknown'))
  const options = loadOptions('load')
  assert.deepEqual(options.scenarios.reading, { executor: 'constant-vus', vus: 50, duration: '60s', gracefulStop: '10s' })
  assert.equal(loadOptions('smoke').scenarios.reading.iterations, 1)
  assert.deepEqual(options.thresholds.http_req_failed, ['rate==0'])
  assert.deepEqual(options.thresholds.checks, ['rate==1'])
  assert.deepEqual(options.thresholds.http_req_duration, ['p(95)<400'])
  for (const route of loadRoutes) assert.deepEqual(options.thresholds['http_req_duration{name:' + route + '}'], ['p(95)<400'])
  const items = Array.from({ length: 7 }, (_, index) => ({ id: 'demo-' + index, authorId: 'author-' + index % 4, image: '/api/publications/demo-' + index + '/media/test-cover', demo: true, status: 'published', title: 'Not retained in evidence' }))
  const dataset = selectLoadDataset({ items })
  assert.equal(dataset.publications.length, 7)
  assert.equal(dataset.authorIds.length, 4)
  assert.deepEqual(Object.keys(dataset.publications[0]), ['id', 'authorId', 'image'])
  assert.throws(() => selectLoadDataset({ error: 'upstream_unavailable' }))
  assert.throws(() => selectLoadDataset({ items: items.slice(0, 6) }))
  assert.throws(() => selectLoadDataset({ items: [...items, items[0]] }))
  for (const image of ['https://example.test/private', '/api/publications/demo-0/media/../../users/me', '/api/publications/demo-0/media/x?token=private']) {
    assert.throws(() => selectLoadDataset({ items: [{ ...items[0], image }, ...items.slice(1)] }))
  }
})

const services = [
  {
    directory: 'api-gateway',
    packageName: '@otherbloc/api-gateway',
    port: 3000,
  },
  {
    directory: 'users-service',
    packageName: '@otherbloc/users-service',
    port: 3001,
  },
  {
    directory: 'content-service',
    packageName: '@otherbloc/content-service',
    port: 3002,
  },
  {
    directory: 'interactions-service',
    packageName: '@otherbloc/interactions-service',
    port: 3003,
  },
]

test('preserves the required repository foundation', () => {
  const requiredPaths = [
    'frontend/src/components',
    'frontend/src/pages',
    'frontend/src/services',
    'frontend/src/styles',
    'frontend/src/utils',
    'backend/api-gateway/src',
    'backend/users-service/src',
    'backend/content-service/src',
    'backend/interactions-service/src',
    '.github/workflows/foundation-ci.yml',
    'docs/architecture.md',
    'docs/repository.md',
    'docs/frontend.md',
    'docs/development-log.md',
  ]

  for (const path of requiredPaths) {
    assert.ok(existsSync(resolveFromRoot(path)), `Missing required path: ${path}`)
  }
})

test('keeps every backend application independently runnable on its assigned port', () => {
  for (const service of services) {
    const packageJson = readJson('backend', service.directory, 'package.json')
    const environmentTemplate = readFileSync(
      resolveFromRoot('backend', service.directory, '.env.example'),
      'utf8',
    )

    assert.equal(packageJson.name, service.packageName)
    assert.equal(packageJson.main, 'src/server.js')
    assert.equal(packageJson.scripts.start, 'node src/server.js')
    assert.equal(packageJson.scripts.test, 'node --test')
    assert.match(environmentTemplate, new RegExp(`^PORT=${service.port}$`, 'm'))
    assert.ok(
      existsSync(resolveFromRoot('backend', service.directory, packageJson.main)),
      `${service.directory} is missing its runtime entry point`,
    )
  }
})

test('routes browser traffic through the gateway boundary', () => {
  const frontendEnvironment = readFileSync(
    resolveFromRoot('frontend', '.env.example'),
    'utf8',
  )
  const gatewayEnvironment = readFileSync(
    resolveFromRoot('backend', 'api-gateway', '.env.example'),
    'utf8',
  )

  assert.match(frontendEnvironment, /^VITE_API_URL=\/api$/m)
  assert.match(
    frontendEnvironment,
    /^VITE_GRAPHQL_URL=\/api\/interactions$/m,
  )
  const viteConfig = readFileSync(resolveFromRoot('frontend', 'vite.config.js'), 'utf8')
  assert.match(viteConfig, /'\/api':\s*\{\s*target:\s*'http:\/\/127\.0\.0\.1:3000'/)
  assert.match(gatewayEnvironment, /^USERS_SERVICE_URL=http:\/\/localhost:3001$/m)
  assert.match(gatewayEnvironment, /^CONTENT_SERVICE_URL=http:\/\/localhost:3002$/m)
  assert.match(
    gatewayEnvironment,
    /^INTERACTIONS_SERVICE_URL=http:\/\/localhost:3003\/graphql$/m,
  )
})

test('does not retain temporary design resources in the distributable repository', () => {
  assert.equal(existsSync(resolveFromRoot('resources')), false)
})
