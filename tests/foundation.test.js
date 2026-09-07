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
