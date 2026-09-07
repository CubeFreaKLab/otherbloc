import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { cpus, platform, release, totalmem } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { loadGateway, loadOptions, loadRoutes, parseLoadArgs, selectLoadDataset } from './load-config.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const mode = parseLoadArgs(process.argv.slice(2))
const config = dotenv.parse(await readFile(path.join(root, '.env.local'), 'utf8'))
if (config.FIREBASE_PROJECT_ID !== 'demo-otherbloc' || config.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || config.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199' || config.NODE_ENV === 'production') throw new Error('Load testing is restricted to the local demo and both loopback emulators')
const binary = process.env.K6_BINARY || 'k6'
const version = execFileSync(binary, ['version'], { encoding: 'utf8' }).trim()
for (const port of [3000, 3001, 3002, 3003]) {
  const response = await fetch('http://127.0.0.1:' + port + '/health', { signal: AbortSignal.timeout(5000), redirect: 'error' })
  if (!response.ok) throw new Error('Start the four applications with node scripts/dev.mjs --no-watch')
}
const response = await fetch(loadGateway + '/api/publications?limit=12', { signal: AbortSignal.timeout(15000), redirect: 'error' })
if (!response.ok) throw new Error('Cannot read the real public demo dataset')
const dataset = selectLoadDataset(await response.json())
const startedAt = new Date().toISOString()
const output = path.join(root, '.local-data', 'load-' + mode + '-' + startedAt.replaceAll(':', '-'))
await mkdir(output, { recursive: true })
const datasetPath = path.join(output, 'dataset.json'), summaryPath = path.join(output, 'summary.json')
const scripts = ['scripts/load-config.mjs', 'scripts/load.mjs', 'tests/load/reading.js']
const environment = {
  startedAt, mode, target: loadGateway, version, node: process.version,
  os: { platform: platform(), release: release(), logicalCpus: cpus().length, cpu: cpus()[0]?.model, memoryBytes: totalmem() },
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  trackedChanges: execFileSync('git', ['status', '--short', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean),
  scriptHashes: Object.fromEntries(await Promise.all(scripts.map(async (file) => [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')]))),
  options: loadOptions(mode), routes: loadRoutes, thinkTimeSeconds: 1,
  localGatewayLimits: { max: Number(config.RATE_LIMIT_MAX || 18000), windowMs: Number(config.RATE_LIMIT_WINDOW_MS || 900000) },
  scope: 'Anonymous read-only, no browser cache; gateway, three services, emulators and generator on this host. Not cloud capacity or authenticated-write throughput.',
}
await writeFile(datasetPath, JSON.stringify(dataset, null, 2) + '\n', { flag: 'wx' })
await writeFile(path.join(output, 'environment.json'), JSON.stringify(environment, null, 2) + '\n', { flag: 'wx' })
// Ignore inherited k6 overrides/proxies so they cannot change the recorded workload or target.
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^K6_|^(?:HTTP|HTTPS|ALL|NO)_PROXY$/i.test(key)))
Object.assign(childEnv, { K6_NO_USAGE_REPORT: 'true', NO_PROXY: '127.0.0.1,localhost', OTHERBLOC_LOAD_MODE: mode, OTHERBLOC_LOAD_DATASET: datasetPath, OTHERBLOC_LOAD_SUMMARY: summaryPath })
console.log('Running ' + mode + ': ' + version + '\nPrivate evidence: ' + path.relative(root, output))
const log = createWriteStream(path.join(output, 'output.txt'), { flags: 'wx' })
const child = spawn(binary, ['run', '--quiet', '--no-color', 'tests/load/reading.js'], { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] })
child.stdout.on('data', (chunk) => { process.stdout.write(chunk); log.write(chunk) })
child.stderr.on('data', (chunk) => { process.stderr.write(chunk); log.write(chunk) })
const exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (code) => resolve(code ?? 1)) })
await new Promise((resolve, reject) => { log.on('error', reject); log.end(resolve) })
await writeFile(path.join(output, 'result.json'), JSON.stringify({ exitCode, finishedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' })
process.exitCode = exitCode
