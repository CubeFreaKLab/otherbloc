import { setTimeout as delay } from 'node:timers/promises'

export const repository = 'CubeFreaKLab/otherbloc'
const repositoryUrl = 'https://github.com/' + repository
const pending = new Set(['created', 'queued', 'build_in_progress', 'pre_deploy_in_progress', 'update_in_progress'])
const failed = new Set(['deactivated', 'build_failed', 'update_failed', 'canceled', 'pre_deploy_failed'])
const definitions = [
  ['USERS', 'users-service', 'otherbloc-users'],
  ['CONTENT', 'content-service', 'otherbloc-content'],
  ['INTERACTIONS', 'interactions-service', 'otherbloc-interactions'],
  ['GATEWAY', 'api-gateway', 'otherbloc-gateway'],
]

function requireValue(condition, message) { if (!condition) throw new Error(message) }
const sameRepo = (value) => typeof value === 'string' && value.replace(/\.git$/, '') === repositoryUrl

export function readRenderConfig(environment = process.env) {
  const revision = environment.GITHUB_SHA ?? environment.APP_REVISION
  requireValue(typeof revision === 'string' && /^[a-f0-9]{40}$/.test(revision), 'A complete lowercase release SHA is required')
  if (environment.APP_REVISION) requireValue(environment.APP_REVISION === revision, 'Release revision declarations disagree')
  const blueprintId = environment.RENDER_BLUEPRINT_ID
  requireValue(/^exs-[a-z0-9]{20}$/.test(blueprintId ?? ''), 'RENDER_BLUEPRINT_ID must identify the approved Blueprint')
  const services = definitions.map(([key, healthService, name]) => {
    const id = environment['RENDER_' + key + '_SERVICE_ID']
    const origin = environment['RENDER_' + key + '_ORIGIN']
    requireValue(/^srv-[a-z0-9]{20}$/.test(id ?? ''), 'RENDER_' + key + '_SERVICE_ID is invalid')
    let url
    try { url = new URL(origin) } catch { throw new Error('RENDER_' + key + '_ORIGIN is invalid') }
    requireValue(url.origin === origin && url.protocol === 'https:' && !url.port && /^[a-z0-9-]+\.onrender\.com$/.test(url.hostname), 'RENDER_' + key + '_ORIGIN must be its canonical HTTPS Render origin')
    return { key, name, healthService, id, origin }
  })
  requireValue(new Set(services.map(({ id }) => id)).size === 4, 'Four distinct Render services are required')
  requireValue(new Set(services.map(({ origin }) => origin)).size === 4, 'Four distinct Render origins are required')
  return { revision, blueprintId, services }
}

export function assertReleaseContext(environment, revision) {
  requireValue(typeof revision === 'string' && /^[a-f0-9]{40}$/.test(revision)
    && environment.GITHUB_ACTIONS === 'true' && environment.GITHUB_EVENT_NAME === 'workflow_dispatch'
    && environment.GITHUB_REPOSITORY === repository && environment.GITHUB_REF === 'refs/heads/main'
    && environment.GITHUB_WORKFLOW_REF === repository + '/.github/workflows/release.yml@refs/heads/main'
    && environment.GITHUB_SHA === revision && environment.RELEASE_APPROVED_SHA === revision,
  'Deployment requires the approved main-branch release workflow at the exact SHA')
}

export function createRenderClient(token, fetcher = fetch) {
  requireValue(typeof token === 'string' && token.length > 0 && !/[\r\n]/.test(token), 'RENDER_API_KEY is required')
  return async (path, { method = 'GET', body } = {}) => {
    requireValue(/^\/(?:services|blueprints)\/[a-z0-9-]+(?:\/deploys(?:\/[a-z0-9-]+)?(?:\?limit=20)?)?$/.test(path), 'Unsupported Render API path')
    requireValue(method === 'GET' || (method === 'POST' && /^\/services\/srv-[a-z0-9]{20}\/deploys$/.test(path)), 'Unsupported Render API operation')
    let response
    try {
      response = await fetcher('https://api.render.com/v1' + path, {
        method, redirect: 'error', signal: AbortSignal.timeout(method === 'POST' ? 60000 : 15000),
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    } catch {
      throw new Error(method === 'POST' ? 'Render deploy request outcome is uncertain; inspect Render before any retry' : 'Render read request failed; no automatic retry')
    }
    const accepted = method === 'POST' ? [201, 202] : [200]
    requireValue(accepted.includes(response.status), 'Render ' + method + ' returned HTTP ' + response.status + (method === 'POST' ? '; inspect Render before any retry' : ''))
    try { return await response.json() } catch { throw new Error('Invalid Render response; inspect deployment state before retrying') }
  }
}

export async function preflightRender(config, request) {
  const blueprint = await request('/blueprints/' + config.blueprintId)
  // Render also reports "paused" when automatic Blueprint syncing is disabled.
  // This does not suspend the services; validate each owned runtime below.
  requireValue(blueprint?.id === config.blueprintId && blueprint.autoSync === false && ['in_sync', 'paused'].includes(blueprint.status)
    && sameRepo(blueprint.repo) && blueprint.branch === 'main' && blueprint.path === 'render.yaml', 'Blueprint must be in sync or paused, target the approved repository/main/render.yaml and have Auto Sync disabled')
  requireValue(Array.isArray(blueprint.resources) && blueprint.resources.length === 4 && config.services.every(({ id, name }) =>
    blueprint.resources.filter((resource) => resource.id === id && resource.name === name && resource.type === 'web_service').length === 1), 'Blueprint must own exactly the four approved web services')
  for (const service of config.services) {
    const actual = await request('/services/' + service.id)
    requireValue(actual?.id === service.id && actual.name === service.name && actual.type === 'web_service'
      && sameRepo(actual.repo) && actual.branch === 'main' && actual.autoDeploy === 'no' && actual.suspended === 'not_suspended'
      && actual.serviceDetails?.url === service.origin && actual.serviceDetails.runtime === 'node' && actual.serviceDetails.healthCheckPath === '/health',
    service.name + ': unexpected service identity, source, runtime, URL or automatic deployment settings')
    const recent = await request('/services/' + service.id + '/deploys?limit=20')
    requireValue(Array.isArray(recent) && recent.every(({ deploy }) => deploy && (deploy.status === 'live' || failed.has(deploy.status))), service.name + ': another deployment is active or its state is unknown')
  }
  return { revision: config.revision, services: config.services.map(({ name, id, origin }) => ({ name, id, origin })) }
}

function checkDeploy(deploy, revision, expectedId) {
  requireValue(/^dep-[a-z0-9]{1,64}$/.test(deploy?.id ?? ''), 'Render did not return a valid deploy ID; inspect Render before retrying')
  if (expectedId) requireValue(deploy.id === expectedId, 'Render returned a different deployment')
  requireValue(pending.has(deploy.status) || failed.has(deploy.status) || deploy.status === 'live', 'Unknown Render deploy status')
  if (deploy.commit?.id) requireValue(deploy.commit.id === revision, 'Render deploy commit differs from the release SHA')
  if (deploy.status === 'live') requireValue(deploy.commit?.id === revision, 'Live Render deployment does not identify the expected commit')
  requireValue(!failed.has(deploy.status), 'Render deployment ended with ' + deploy.status)
}

export async function waitForRevision(service, revision, { fetcher = fetch, sleep = delay, now = Date.now, timeoutMs = 120000 } = {}) {
  const deadline = now() + timeoutMs
  while (now() < deadline) {
    try {
      const response = await fetcher(service.origin + '/health', { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) })
      const body = response.status === 200 ? await response.json() : null
      if (body?.service === service.healthService && body.status === 'ok' && body.revision === revision && response.headers.get('cache-control')?.split(',').some((item) => item.trim() === 'no-store')) return
    } catch { /* A warming service is not ready; all attempts are bounded. */ }
    await sleep(Math.min(5000, Math.max(0, deadline - now())))
  }
  throw new Error(service.name + ': healthy exact revision was not observed before timeout')
}

export async function deployRender(config, request, { fetcher = fetch, sleep = delay, now = Date.now, log = console.log, deployTimeoutMs = 1200000, healthTimeoutMs = 120000 } = {}) {
  await preflightRender(config, request)
  const completed = []
  for (const service of config.services) {
    log(JSON.stringify({ event: 'deploy-request', service: service.name, revision: config.revision }))
    let deploy = await request('/services/' + service.id + '/deploys', { method: 'POST', body: { commitId: config.revision } })
    requireValue(/^dep-[a-z0-9]{1,64}$/.test(deploy?.id ?? ''), 'Render did not return a valid deploy ID; inspect Render before retrying')
    log(JSON.stringify({ event: 'deploy-created', service: service.name, deployId: deploy.id, revision: config.revision }))
    checkDeploy(deploy, config.revision)
    const id = deploy.id
    const deadline = now() + deployTimeoutMs
    let previousStatus
    while (true) {
      checkDeploy(deploy, config.revision, id)
      if (deploy.status !== previousStatus) log(JSON.stringify({ event: 'deploy-status', service: service.name, deployId: id, status: deploy.status, revision: config.revision }))
      previousStatus = deploy.status
      if (deploy.status === 'live') break
      requireValue(now() < deadline, service.name + ': deploy timeout; inspect Render before retrying')
      await sleep(Math.min(10000, Math.max(0, deadline - now())))
      requireValue(now() < deadline, service.name + ': deploy timeout; inspect Render before retrying')
      deploy = await request('/services/' + service.id + '/deploys/' + id)
    }
    await waitForRevision(service, config.revision, { fetcher, sleep, now, timeoutMs: healthTimeoutMs })
    completed.push({ service: service.name, deployId: id, revision: config.revision })
    log(JSON.stringify({ event: 'service-verified', ...completed.at(-1) }))
  }
  return completed
}
