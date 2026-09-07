import { parseWatchOptions, runService, services } from './run-service.mjs'

const options = parseWatchOptions(process.argv.slice(2))
const children = []
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) child.kill('SIGTERM')
}
for (const name of Object.keys(services)) {
  const child = await runService(name, options)
  children.push(child)
  child.on('exit', (code) => { if (!stopping) stop(code ?? 1) })
  child.on('error', () => stop(1))
}
console.log('Frontend + gateway + three services started (backend watch ' + (options.watch ? 'on' : 'off') + '). Run npm run emulators in a separate terminal.')
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
