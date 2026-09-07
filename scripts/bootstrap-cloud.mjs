import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assertDisposableCheckout } from './ci-config.mjs'
import { parseBootstrapArgs, readBootstrapConfig, validateBootstrapCredentials, runCloudBootstrap } from './bootstrap-cloud-config.mjs'
import { waitForRevision } from './release/render.mjs'
import { seedDemoUsers, seedDemoPublications } from './seed-demo.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
let connecting = false
try {
  const options = parseBootstrapArgs(process.argv.slice(2))
  assertDisposableCheckout(root)
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  const config = readBootstrapConfig(process.env, options, { revision: git(['rev-parse', 'HEAD']), clean: git(['status', '--porcelain']) === '' })
  console.log(JSON.stringify({ mode: config.mode, stage: config.stage, projectId: config.projectId, bucket: config.bucket,
    revision: config.revision, gateway: config.gateway, planned: config.stage === 'users' ? '6 marked demo accounts, including first administrator' : '7 marked demo publications; existing records preserved' }))
  if (config.mode === 'plan') console.log('Offline plan only: no authentication, network requests or writes performed.')
  else {
    validateBootstrapCredentials(process.env, config)
    connecting = true
    await runCloudBootstrap(config, { checkHealth: waitForRevision,
      users: async () => {
        const { getFirebase } = await import('../backend/users-service/src/config/firebase.js')
        const { createUsersService } = await import('../backend/users-service/src/services/users.js')
        const { deleteApp } = await import('firebase-admin/app')
        const firebase = getFirebase()
        try { await seedDemoUsers(createUsersService({ config: {}, firebase }), process.env) }
        finally { await deleteApp(firebase.app) }
      },
      content: async () => {
        const { getFirebase } = await import('../backend/content-service/src/config/firebase.js')
        const { createPublicationsService } = await import('../backend/content-service/src/services/publications.js')
        const { deleteApp } = await import('firebase-admin/app')
        const firebase = getFirebase()
        try { await seedDemoPublications({ service: createPublicationsService({ firebase }), source: process.env, gateway: config.gateway }) }
        finally { await deleteApp(firebase.app) }
      },
    })
    console.log('Bootstrap stage finished. Verify current roles, images and real cloud persistence separately; no deployment was performed.')
  }
} catch (error) {
  console.error(connecting ? 'Cloud bootstrap stopped during health or data operations. Inspect existing state before retrying; no automatic rollback was performed. SDK/HTTP details are omitted to protect credentials.' : error.message)
  process.exitCode = 1
}
