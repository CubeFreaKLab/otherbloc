import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

export function runNode(label, args, { cwd, env, signal } = {}) {
  console.log('\nCI: ' + label)
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, signal, stdio: 'inherit' })
    let failure
    child.once('error', (error) => { failure = error })
    child.once('close', (code, termination) => {
      if (failure) reject(failure)
      else if (code === 0) resolve()
      else reject(new Error(label + ' failed (' + (termination ?? 'exit ' + code) + ').'))
    })
  })
}

export async function waitForServices(urls, signal, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  const pending = new Set(urls)
  while (pending.size && Date.now() < deadline) {
    signal.throwIfAborted()
    await Promise.all([...pending].map(async (url) => {
      const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]) }).catch(() => null)
      if (response?.ok) pending.delete(url)
      await response?.body?.cancel()
    }))
    if (pending.size) await delay(250, undefined, { signal })
  }
  if (pending.size) throw new Error('CI readiness failed for: ' + [...pending].join(', '))
}

export async function stopServices(children) {
  await Promise.all(children.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    const force = setTimeout(() => child.kill('SIGKILL'), 5000)
    child.once('close', () => { clearTimeout(force); resolve() })
    child.kill('SIGTERM')
  })))
}
