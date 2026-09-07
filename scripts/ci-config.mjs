import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'

export const ciPorts = [3000, 3001, 3002, 3003, 5173, 8080, 9199, 4400, 4500, 9150]

export function assertDisposableCheckout(root) {
  for (const directory of ['', 'frontend', 'backend/api-gateway', 'backend/users-service', 'backend/content-service', 'backend/interactions-service']) {
    for (const name of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local', '.env.test', '.env.test.local']) {
      if (existsSync(path.join(root, directory, name))) throw new Error('CI requires a disposable checkout without private environment files; existing configuration was not changed.')
    }
  }
  if (existsSync(path.join(root, '.local-data/current'))) throw new Error('CI must not use an existing development snapshot. Use a separate disposable checkout.')
}

export async function assertPortsAvailable(ports = ciPorts) {
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = createServer()
      server.once('error', () => reject(new Error('CI port ' + port + ' is occupied; no running process was stopped.')))
      server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(resolve))
    })
  }
}

export function ciEnvironment(source, temporary, runId) {
  const environment = Object.fromEntries(Object.entries(source).filter(([key]) => !/^(FIREBASE_|FIRESTORE_|GCLOUD_|GOOGLE_|JWT_|SERVICE_AUTH_|SEED_|VITE_|DOTENV_|OTHERBLOC_CI_|RATE_LIMIT_|APP_REVISION$|RENDER_GIT_COMMIT$|TRUST_PROXY$|UPSTREAM_TIMEOUT_MS$|ALLOWED_ORIGINS$|USERS_SERVICE_URL$|CONTENT_SERVICE_URL$|INTERACTIONS_SERVICE_URL$|PORT$|NODE_ENV$|PATH$|TMP$|TEMP$|TMPDIR$|CI$)/i.test(key)))
  const runtimePath = Object.entries(source).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? ''
  return { ...environment, PATH: runtimePath, CI: 'true', NODE_ENV: 'development', OTHERBLOC_CI_RUN_ID: runId,
    FIREBASE_PROJECT_ID: 'demo-otherbloc', GCLOUD_PROJECT: 'demo-otherbloc',
    FIREBASE_STORAGE_BUCKET: 'demo-otherbloc.appspot.com',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
    TMP: temporary, TEMP: temporary, TMPDIR: temporary,
  }
}

export function assertCiEnvironment(environment) {
  if (environment.CI !== 'true' || !/^[a-f0-9-]{36}$/.test(environment.OTHERBLOC_CI_RUN_ID ?? '') ||
      environment.NODE_ENV !== 'development' || environment.FIREBASE_PROJECT_ID !== 'demo-otherbloc' ||
      environment.FIREBASE_STORAGE_BUCKET !== 'demo-otherbloc.appspot.com' ||
      environment.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || environment.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') {
    throw new Error('Live CI must run inside scripts/ci.mjs with both isolated local emulators.')
  }
}

export function ciFirebaseConfig(source, root) {
  return {
    firestore: { ...source.firestore, rules: path.join(root, source.firestore.rules), indexes: path.join(root, source.firestore.indexes) },
    storage: { ...source.storage, rules: path.join(root, source.storage.rules) },
    emulators: {
      firestore: { host: '127.0.0.1', port: 8080, websocketPort: 9150 },
      storage: { host: '127.0.0.1', port: 9199 },
      hub: { host: '127.0.0.1', port: 4400 }, logging: { host: '127.0.0.1', port: 4500 },
      ui: { enabled: false }, singleProjectMode: false,
    },
  }
}
