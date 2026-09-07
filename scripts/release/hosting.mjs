import { setTimeout as delay } from 'node:timers/promises'
import { repository } from './render.mjs'

function requireValue(condition, message) { if (!condition) throw new Error(message) }

export function readHostingConfig(environment, gatewayOrigin) {
  const projectId = environment.FIREBASE_PROJECT_ID
  requireValue(typeof projectId === 'string' && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) && !projectId.startsWith('demo-'), 'An approved real FIREBASE_PROJECT_ID is required')
  const origin = environment.FIREBASE_HOSTING_ORIGIN
  requireValue(origin === 'https://' + projectId + '.web.app', 'FIREBASE_HOSTING_ORIGIN must identify the approved default Hosting site')
  requireValue(!environment.FIRESTORE_EMULATOR_HOST && !environment.FIREBASE_STORAGE_EMULATOR_HOST && !environment.FIREBASE_TOKEN && !environment.FIREBASE_PRIVATE_KEY,
    'Cloud release must not inherit emulators, legacy tokens or runtime private keys')
  requireValue(/^projects\/[0-9]+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(environment.GOOGLE_WORKLOAD_IDENTITY_PROVIDER ?? ''), 'A complete approved Google workload identity provider is required')
  const serviceAccount = environment.GOOGLE_DEPLOY_SERVICE_ACCOUNT
  requireValue(typeof serviceAccount === 'string' && serviceAccount.split('@').length === 2 && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(serviceAccount.split('@')[0]) && serviceAccount.endsWith('@' + projectId + '.iam.gserviceaccount.com'), 'The deployment service account must belong to the approved project')
  requireValue(environment.VITE_API_URL === gatewayOrigin + '/api' && environment.VITE_GRAPHQL_URL === gatewayOrigin + '/api/interactions', 'The production frontend must use only the approved gateway')
  return { projectId, origin }
}

export function assertCleanManifest(manifest, revision) {
  requireValue(/^[a-f0-9]{40}$/.test(revision) && manifest?.application === 'otherbloc' && manifest.revision === revision
    && manifest.dirty === false && manifest.source === 'environment'
    && Object.keys(manifest).sort().join(',') === 'application,dirty,revision,source', 'Frontend must identify the exact clean workflow build')
}

export async function checkProductionProtection(token, fetcher = fetch) {
  requireValue(typeof token === 'string' && token.length > 0 && !/[\r\n]/.test(token), 'A read-only Actions token is required to verify production protection')
  const request = async (suffix) => {
    let response
    try {
      response = await fetcher('https://api.github.com/repos/' + repository + '/environments/production' + suffix, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' },
      })
    } catch { throw new Error('Production protection read failed; no deployment is authorized by this check') }
    requireValue(response.status === 200, 'Production protection read returned HTTP ' + response.status)
    try { return await response.json() } catch { throw new Error('Invalid production protection response') }
  }
  const environment = await request('')
  const reviewers = environment?.protection_rules?.find((rule) => rule.type === 'required_reviewers')?.reviewers
  requireValue(environment?.name === 'production' && Array.isArray(reviewers) && reviewers.length > 0
    && reviewers.every((item) => ['User', 'Team'].includes(item.type) && Number.isSafeInteger(item.reviewer?.id) && item.reviewer.id > 0),
  'The existing production environment must require an identified reviewer')
  requireValue(environment.deployment_branch_policy?.protected_branches === false && environment.deployment_branch_policy.custom_branch_policies === true,
    'Production must restrict deployments through a selected main branch policy')
  const policies = await request('/deployment-branch-policies?per_page=100')
  requireValue(policies.total_count === 1 && policies.branch_policies?.length === 1 && policies.branch_policies[0].name === 'main'
    && [undefined, 'branch'].includes(policies.branch_policies[0].type), 'Production must allow only main, not wildcard or tag policies')
  return { environment: 'production', requiredReviewers: reviewers.length, branch: 'main' }
}

export async function verifyHosting(config, revision, { fetcher = fetch, now = Date.now, sleep = delay, timeoutMs = 120000 } = {}) {
  const deadline = now() + timeoutMs
  while (now() < deadline) {
    try {
      const response = await fetcher(config.origin + '/version.json', { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (response.status === 200 && response.headers.get('cache-control')?.split(',').some((part) => part.trim() === 'no-store')) {
        const manifest = await response.json()
        assertCleanManifest(manifest, revision)
        return manifest
      }
    } catch { /* CDN propagation or stale metadata is not successful release evidence. */ }
    await sleep(Math.min(5000, Math.max(0, deadline - now())))
  }
  throw new Error('Hosting did not serve the exact clean, non-cached release manifest before timeout')
}
