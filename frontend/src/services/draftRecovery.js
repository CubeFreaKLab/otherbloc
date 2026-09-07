// Transient UI recovery only. Nothing is persisted to browser storage or sent by this module.
const active = new Map(), recovered = new Map(), listeners = new Set()
let revision = 0
const recordKey = (ownerId, key) => JSON.stringify([ownerId, key])
const emit = () => { revision += 1; for (const listener of listeners) listener() }

export const subscribeRecovery = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
export const recoveryRevision = () => revision
export const hasRecovery = () => recovered.size > 0
export const listRecovery = (ownerId) => ownerId ? [...recovered.values()].filter((item) => item.ownerId === ownerId) : []
export const findRecovery = (ownerId, key) => ownerId ? recovered.get(recordKey(ownerId, key)) ?? null : null

export function registerRecovery({ ownerId, key, path, label, read }) {
  const id = recordKey(ownerId, key), entry = { ownerId, key, path, label, read }
  active.set(id, entry)
  return () => { if (active.get(id) === entry) active.delete(id) }
}

export function captureRecovery(ownerId) {
  if (!ownerId) return
  for (const entry of active.values()) {
    if (entry.ownerId !== ownerId) continue
    const payload = entry.read()
    if (payload) recovered.set(recordKey(ownerId, entry.key), { ownerId, key: entry.key, path: entry.path, label: entry.label, payload: structuredClone(payload) })
  }
  if (recovered.size) emit()
}

export function forgetRecovery(ownerId, key) {
  if (recovered.delete(recordKey(ownerId, key))) emit()
}

export function reconcileRecovery(ownerId, explicitExit = false) {
  let changed = false
  for (const [id, entry] of recovered) {
    if (explicitExit || (ownerId && entry.ownerId !== ownerId)) { recovered.delete(id); changed = true }
  }
  if (changed) emit()
}

export function downloadRecovery(entry) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(entry.payload, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = 'otherbloc-cambios-' + entry.key.replace(/[^a-zA-Z0-9_-]/g, '-') + '.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
