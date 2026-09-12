import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { parseBlueprintOptions, prepareBlueprint } from '../scripts/render-blueprint.mjs'

const blueprint = JSON.parse(await readFile(new URL('../deploy/render.blueprint.example.json', import.meta.url), 'utf8'))
const expected = [ ['otherbloc-users', 'users-service', 3001], ['otherbloc-content', 'content-service', 3002], ['otherbloc-interactions', 'interactions-service', 3003], ['otherbloc-gateway', 'api-gateway', 3000] ]
const setting = (service, key) => service.envVars.find((item) => item.key === key)

test('Spark deployment separates Firestore data from authenticated Cloudinary images without billed TTL', async () => {
  for (const service of blueprint.services) {
    assert.equal(setting(service, 'FIREBASE_STORAGE_BUCKET'), undefined)
    const ownsImages = ['otherbloc-users', 'otherbloc-content'].includes(service.name)
    for (const key of ['CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      assert.deepEqual(setting(service, key), ownsImages ? { key, sync: false } : undefined)
    }
    if (service.name !== 'otherbloc-gateway') assert.equal(setting(service, 'MEDIA_STORAGE_PROVIDER').value, 'cloudinary')
    else assert.equal(setting(service, 'MEDIA_STORAGE_PROVIDER'), undefined)
  }
  const indexes = JSON.parse(await readFile(new URL('../firestore.indexes.json', import.meta.url), 'utf8'))
  assert.ok(indexes.fieldOverrides.every((field) => field.ttl !== true), 'TTL deletion requires billing; application checks session expiry')
})

test('Blueprint preparation requires both explicit choices and changes only in-memory region/plan values', async () => {
  assert.deepEqual(parseBlueprintOptions(['--plan=free', '--region=oregon']), { plan: 'free', region: 'oregon' })
  assert.deepEqual(parseBlueprintOptions(['--region=virginia', '--plan=0.5c-512mb']), { region: 'virginia', plan: '0.5c-512mb' })
  for (const args of [[], ['--plan=free'], ['--region=oregon'], ['--region=unknown', '--plan=free'], ['--region=oregon', '--plan=starter'], ['--region=oregon', '--plan=free', '--plan=free'], ['--region=oregon', '--plan=free', '--deploy']]) assert.throws(() => parseBlueprintOptions(args))
  const prepared = await prepareBlueprint({ region: 'oregon', plan: 'free' })
  const expected = structuredClone(blueprint)
  for (const service of expected.services) { service.region = 'oregon'; service.plan = 'free' }
  assert.deepEqual(prepared, expected)
  assert.equal(blueprint.services[0].region, 'OWNER_MUST_SELECT_REGION')
})

test('the infrastructure example has exactly four independent owners and no silently chosen region or plan', () => {
  assert.deepEqual(Object.keys(blueprint), ['services'])
  assert.equal(blueprint.services.length, 4)
  for (const [index, [name, workspace, port]] of expected.entries()) {
    const service = blueprint.services[index]
    assert.equal(service.name, name)
    assert.equal(service.type, 'web')
    assert.equal(service.runtime, 'node')
    assert.equal(service.repo, 'https://github.com/CubeFreaKLab/otherbloc')
    assert.equal(service.branch, 'main')
    assert.equal(service.region, 'OWNER_MUST_SELECT_REGION')
    assert.equal(service.plan, 'OWNER_MUST_SELECT_PLAN')
    assert.equal(service.autoDeployTrigger, 'off')
    assert.equal(service.healthCheckPath, '/health')
    assert.equal(service.numInstances, 1)
    assert.equal(service.rootDir, undefined)
    assert.equal(service.buildCommand, 'npm ci --omit=dev --workspace @otherbloc/' + workspace)
    assert.ok(service.startCommand.endsWith('npm start --workspace @otherbloc/' + workspace))
    assert.equal(setting(service, 'PORT').value, String(port))
    assert.equal(setting(service, 'NODE_ENV').value, 'production')
    assert.equal(setting(service, 'NODE_VERSION').value, '24.14.1')
  }
})

test('runtime signing keys have one generated source; owner Firebase credentials remain separate and absent from the gateway', () => {
  for (const service of blueprint.services) {
    assert.equal(new Set(service.envVars.map(({ key }) => key)).size, service.envVars.length)
    for (const key of ['JWT_SECRET', 'SERVICE_AUTH_SECRET']) {
      const value = setting(service, key)
      assert.equal(value.value, undefined)
      if (service.name === 'otherbloc-users') assert.equal(value.generateValue, true)
      else assert.deepEqual(value.fromService, { type: 'web', name: 'otherbloc-users', envVarKey: key })
    }
    for (const item of service.envVars) {
      assert.equal(['value', 'generateValue', 'sync', 'fromService'].filter((key) => Object.hasOwn(item, key)).length, 1)
      if (item.fromService) assert.ok(blueprint.services.some(({ name }) => name === item.fromService.name))
      assert.doesNotMatch(item.key, /EMULATOR|GOOGLE_APPLICATION_CREDENTIALS|RENDER_API_KEY|APP_REVISION|SEED_/)
    }
    if (service.name === 'otherbloc-gateway') assert.equal(service.envVars.some(({ key }) => key.startsWith('FIREBASE_')), false)
    else for (const key of ['FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']) assert.deepEqual(setting(service, key), { key, sync: false })
  }
})

test('service wiring uses assigned public HTTPS URLs and preserves the gateway GraphQL path without private-network substitution', () => {
  for (const service of blueprint.services) {
    for (const item of service.envVars.filter(({ key }) => /_SERVICE_(URL|ORIGIN)$/.test(key))) {
      assert.equal(item.fromService.envVarKey, 'RENDER_EXTERNAL_URL')
      assert.equal(item.fromService.property, undefined)
    }
  }
  const gateway = blueprint.services.at(-1)
  assert.equal(gateway.startCommand, 'INTERACTIONS_SERVICE_URL="${INTERACTIONS_SERVICE_ORIGIN}/graphql" npm start --workspace @otherbloc/api-gateway')
  assert.deepEqual(setting(gateway, 'ALLOWED_ORIGINS').fromService, { type: 'web', name: 'otherbloc-users', envVarKey: 'ALLOWED_ORIGINS' })
  assert.equal(setting(gateway, 'TRUST_PROXY').value, '1')
  assert.equal(setting(gateway, 'RATE_LIMIT_MAX').value, '18000')
})
