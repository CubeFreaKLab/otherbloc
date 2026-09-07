import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { assertCleanManifest, checkProductionProtection, readHostingConfig, verifyHosting } from '../scripts/release/hosting.mjs'

const sha = 'a'.repeat(40)
const gateway = 'https://otherbloc-gateway.onrender.com'
const environment = { FIREBASE_PROJECT_ID: 'fixture-project', FIREBASE_HOSTING_ORIGIN: 'https://fixture-project.web.app', GOOGLE_WORKLOAD_IDENTITY_PROVIDER: 'projects/123456/locations/global/workloadIdentityPools/fixture/providers/github', GOOGLE_DEPLOY_SERVICE_ACCOUNT: 'deploy-fixture@fixture-project.iam.gserviceaccount.com', VITE_API_URL: gateway + '/api', VITE_GRAPHQL_URL: gateway + '/api/interactions' }
const hosting = readHostingConfig(environment, gateway)
const manifest = { application: 'otherbloc', revision: sha, dirty: false, source: 'environment' }
const protectedEnvironment = { name: 'production', protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 1 } }] }], deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } }
const branchPolicies = { total_count: 1, branch_policies: [{ name: 'main', type: 'branch' }] }

test('Hosting configuration binds the actual project, default site, WIF service account and gateway-only frontend', () => {
  assert.deepEqual(hosting, { projectId: 'fixture-project', origin: 'https://fixture-project.web.app' })
  for (const override of [
    { FIREBASE_PROJECT_ID: 'demo-otherbloc' }, { FIREBASE_PROJECT_ID: '--other' }, { FIREBASE_HOSTING_ORIGIN: 'https://another.web.app' },
    { FIREBASE_HOSTING_ORIGIN: 'https://fixture-project.web.app/path' }, { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
    { FIREBASE_TOKEN: 'fixture-not-a-token' }, { FIREBASE_PRIVATE_KEY: 'fixture-not-a-key' },
    { GOOGLE_WORKLOAD_IDENTITY_PROVIDER: 'incomplete' }, { GOOGLE_DEPLOY_SERVICE_ACCOUNT: 'deploy-fixture@other-project.iam.gserviceaccount.com' },
    { GOOGLE_DEPLOY_SERVICE_ACCOUNT: 'deploy-fixture@extra@fixture-project.iam.gserviceaccount.com' },
    { VITE_API_URL: '/api' }, { VITE_GRAPHQL_URL: 'https://otherbloc-interactions.onrender.com/graphql' },
  ]) assert.throws(() => readHostingConfig({ ...environment, ...override }, gateway))
})

test('release manifests must identify exactly the clean workflow build, never local or unavailable metadata', () => {
  assertCleanManifest(manifest, sha)
  for (const override of [{ revision: null }, { revision: 'b'.repeat(40) }, { dirty: true }, { dirty: null }, { source: 'git' }, { application: 'other' }, { unexpected: 'field' }]) {
    assert.throws(() => assertCleanManifest({ ...manifest, ...override }, sha), /clean workflow build/)
  }
})

test('production protection is read with minimal GET requests and requires a real reviewer and main-only policy', async () => {
  const calls = []
  const result = await checkProductionProtection('fixture-not-a-token', async (url, init) => {
    calls.push({ url, init })
    return Response.json(url.includes('deployment-branch-policies') ? branchPolicies : protectedEnvironment)
  })
  assert.deepEqual(result, { environment: 'production', requiredReviewers: 1, branch: 'main' })
  assert.equal(calls.length, 2)
  for (const { url, init } of calls) {
    assert.ok(url.startsWith('https://api.github.com/repos/CubeFreaKLab/otherbloc/environments/production'))
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'error')
    assert.equal(init.headers['X-GitHub-Api-Version'], '2026-03-10')
  }
})

test('missing reviewers, unrestricted environments, extra/wildcard/tag policies and unreadable settings fail closed', async () => {
  for (const [actualEnvironment, policies] of [
    [{ ...protectedEnvironment, name: 'staging' }, branchPolicies], [{ ...protectedEnvironment, protection_rules: [] }, branchPolicies],
    [{ ...protectedEnvironment, protection_rules: [{ type: 'required_reviewers', reviewers: [] }] }, branchPolicies],
    [{ ...protectedEnvironment, deployment_branch_policy: null }, branchPolicies],
    [protectedEnvironment, { ...branchPolicies, total_count: 2 }], [protectedEnvironment, { total_count: 1, branch_policies: [{ name: '*', type: 'branch' }] }],
    [protectedEnvironment, { total_count: 1, branch_policies: [{ name: 'main', type: 'tag' }] }],
  ]) await assert.rejects(checkProductionProtection('fixture-not-a-token', async (url) => Response.json(url.includes('deployment-branch-policies') ? policies : actualEnvironment)))
  await assert.rejects(checkProductionProtection('fixture-not-a-token', async () => Response.json({ message: 'fixture-secret' }, { status: 403 })), (error) => error.message.includes('HTTP 403') && !error.message.includes('fixture-secret'))
  await assert.rejects(checkProductionProtection('fixture-not-a-token', async () => { throw new Error('fixture-secret') }), (error) => !error.message.includes('fixture-secret'))
})

test('Hosting verification retries stale CDN content but only accepts the exact clean non-cached manifest', async () => {
  let time = 0, attempts = 0
  const result = await verifyHosting(hosting, sha, { now: () => time, sleep: async (ms) => { time += ms }, fetcher: async (url, init) => {
    assert.equal(url, hosting.origin + '/version.json')
    assert.equal(init.redirect, 'error')
    assert.equal(init.headers, undefined)
    attempts += 1
    return Response.json(attempts === 1 ? { ...manifest, revision: 'b'.repeat(40) } : manifest, { headers: { 'Cache-Control': 'no-store' } })
  } })
  assert.deepEqual(result, manifest)
  assert.equal(attempts, 2)
  for (const response of [() => Response.json(manifest), () => Response.json({ ...manifest, dirty: true }, { headers: { 'Cache-Control': 'no-store' } }), () => new Response('', { status: 503 })]) {
    let tick = 0
    await assert.rejects(verifyHosting(hosting, sha, { now: () => tick, sleep: async (ms) => { tick += ms }, timeoutMs: 10000, fetcher: async () => response() }), /timeout/)
  }
})

test('the dependency-free release gate rejects local context before network and accepts only the complete dispatch identity', () => {
  const allowed = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: 'CubeFreaKLab/otherbloc', GITHUB_REF: 'refs/heads/main', GITHUB_WORKFLOW_REF: 'CubeFreaKLab/otherbloc/.github/workflows/release.yml@refs/heads/main', GITHUB_SHA: sha, RELEASE_APPROVED_SHA: sha }
  const good = spawnSync(process.execPath, ['scripts/release-check.mjs', '--context'], { env: allowed, encoding: 'utf8', timeout: 5000 })
  assert.equal(good.status, 0, good.stderr)
  for (const override of [{ GITHUB_ACTIONS: 'false' }, { GITHUB_SHA: '', RELEASE_APPROVED_SHA: '' }, { GITHUB_REF: 'refs/tags/main' }, { RELEASE_APPROVED_SHA: 'b'.repeat(40) }]) {
    const result = spawnSync(process.execPath, ['scripts/release-check.mjs', '--protection'], { env: { ...allowed, ...override }, encoding: 'utf8', timeout: 5000 })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /approved main-branch release workflow/)
  }
})

test('release workflow gates same-commit CI, approval and sequential Render before late WIF and Hosting', async () => {
  const workflow = (await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')).replaceAll('\r\n', '\n')
  assert.match(workflow, /workflow_dispatch:/)
  assert.doesNotMatch(workflow, /\n {2}(?:push|pull_request|workflow_run|pull_request_target):|secrets: inherit|upload-artifact|continue-on-error|git push/)
  assert.match(workflow, /cancel-in-progress: false/)
  assert.match(workflow, /ci:\n {4}needs: gate\n {4}uses: \.\/\.github\/workflows\/foundation-ci.yml/)
  assert.match(workflow, /release:\n {4}needs: \[gate, ci\]/)
  assert.match(workflow, /environment:\n {6}name: production/)
  assert.equal([...workflow.matchAll(/id-token: write/g)].length, 1)
  const order = ['node scripts/release-check.mjs --config', 'npm run build', 'node scripts/release-check.mjs --build', 'node scripts/release-render.mjs --deploy', 'uses: google-github-actions/auth@', 'firebase.js deploy --only hosting', 'node scripts/release-check.mjs --live'].map((value) => workflow.indexOf(value))
  assert.ok(order.every((position, index) => position >= 0 && (!index || position > order[index - 1])))
  assert.match(workflow, /--project "\$FIREBASE_PROJECT_ID" --non-interactive/)
  assert.equal([...workflow.matchAll(/uses: (?:actions\/[\w-]+|google-github-actions\/auth)@[a-f0-9]{40} # v\d/g)].length, 5)
  assert.equal([...workflow.matchAll(/secrets\.RENDER_API_KEY/g)].length, 1)
})

test('temporary WIF credentials are excluded from Git and Hosting uploads', async () => {
  const ignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8')
  const firebase = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'))
  assert.match(ignore, /gha-creds-\*\.json/)
  assert.ok(firebase.hosting.ignore.includes('**/gha-creds-*.json'))
  assert.equal(firebase.hosting.public, 'frontend/dist')
  assert.ok(firebase.hosting.headers.find(({ source }) => source === '/version.json').headers.some(({ key, value }) => key === 'Cache-Control' && value === 'no-store'))
})
