import { createPrivateKey } from 'node:crypto'
import { readRenderConfig } from './release/render.mjs'
import { demoAccounts } from './seed-demo.mjs'

const requireValue = (condition, message) => { if (!condition) throw new Error(message) }

export function parseBootstrapArgs(args) {
  const options = {}
  for (const argument of args) {
    if (['--plan', '--apply'].includes(argument)) {
      requireValue(!options.mode, 'Choose exactly one mode: --plan or --apply.')
      options.mode = argument.slice(2)
    } else if (argument.startsWith('--stage=')) {
      requireValue(!options.stage, 'Duplicate bootstrap stage.')
      options.stage = argument.slice(8)
    } else if (argument.startsWith('--confirm-project=')) {
      requireValue(options.confirmProject === undefined, 'Duplicate project confirmation.')
      options.confirmProject = argument.slice(18)
    } else throw new Error('Unknown bootstrap option; no operation started.')
  }
  requireValue(options.mode && ['users', 'content'].includes(options.stage), 'Specify --plan or --apply and --stage=users or --stage=content.')
  requireValue(options.mode === 'apply' ? Boolean(options.confirmProject) : options.confirmProject === undefined, 'Only --apply requires --confirm-project=<approved-project>.')
  return options
}

export function readBootstrapConfig(source, options, { revision, clean }) {
  requireValue(['plan', 'apply'].includes(options.mode) && ['users', 'content'].includes(options.stage), 'Invalid bootstrap mode or stage.')
  requireValue(source.NODE_ENV === 'production' && source.CI !== 'true' && source.GITHUB_ACTIONS !== 'true', 'Cloud bootstrap requires an explicit operator production environment, outside CI.')
  for (const [key, value] of Object.entries(source)) {
    if (value && (/EMULATOR/i.test(key) || /^(GOOGLE_APPLICATION_CREDENTIALS|FIREBASE_CONFIG|FIREBASE_TOKEN|DOTENV_.*|RENDER_API_KEY|GITHUB_TOKEN)$/i.test(key))) {
      throw new Error('Remove emulator, implicit credential, dotenv override and deployment-token settings before cloud bootstrap.')
    }
  }
  requireValue(source.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS verification must remain enabled.')
  requireValue(clean === true && /^[a-f0-9]{40}$/.test(revision ?? '') && source.BOOTSTRAP_REVISION === revision, 'Bootstrap requires a clean checkout at the exact BOOTSTRAP_REVISION.')
  for (const key of ['APP_REVISION', 'GITHUB_SHA', 'RENDER_GIT_COMMIT']) requireValue(!source[key] || source[key] === revision, 'Revision declarations disagree.')
  const projectId = source.FIREBASE_PROJECT_ID
  requireValue(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId ?? '') && !projectId.startsWith('demo-'), 'An explicit real Firebase project ID is required.')
  const bucket = source.FIREBASE_STORAGE_BUCKET
  requireValue([projectId + '.firebasestorage.app', projectId + '.appspot.com'].includes(bucket), 'Bootstrap requires the approved project default Storage bucket.')
  if (options.mode === 'apply') requireValue(options.confirmProject === projectId, 'Project confirmation does not match the configured destination.')
  const render = readRenderConfig({ ...source, GITHUB_SHA: revision, APP_REVISION: revision })
  return { mode: options.mode, stage: options.stage, projectId, bucket, revision, services: render.services,
    gateway: render.services.find(({ key }) => key === 'GATEWAY').origin }
}

export function validateBootstrapCredentials(source, config) {
  const email = source.FIREBASE_CLIENT_EMAIL ?? ''
  requireValue(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(email.split('@')[0]) && email.split('@').length === 2
    && email.endsWith('@' + config.projectId + '.iam.gserviceaccount.com'), 'The owner-service credential must belong to the approved project.')
  try {
    const key = createPrivateKey(source.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '')
    requireValue(key.asymmetricKeyType === 'rsa', 'Invalid key type.')
  } catch { throw new Error('A valid owner-service RSA private key is required; no credential value is logged.') }
  requireValue(typeof source.SEED_PASSWORD === 'string' && source.SEED_PASSWORD.length >= 24 && source.SEED_PASSWORD.length <= 128, 'Use a private demo password of 24–128 characters, unique to this cloud environment.')
  try { demoAccounts(source) } catch { throw new Error('Configure valid distinct demo emails and a valid password before any cloud write.') }
}

export async function runCloudBootstrap(config, { checkHealth, users, content, log = console.log }) {
  requireValue(config.mode === 'apply' && ['users', 'content'].includes(config.stage), 'Only a validated apply stage may access cloud data.')
  for (const service of config.services) {
    await checkHealth(service, config.revision)
    log(service.healthService + ': exact revision verified')
  }
  log('Starting approved ' + config.stage + ' demo stage; no reset or automatic rollback.')
  await (config.stage === 'users' ? users() : content())
}
